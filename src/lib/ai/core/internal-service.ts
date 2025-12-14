/**
 * 内部服务 - UI 使用
 * Internal Service - For UI Usage
 */

import { AIClient } from '../client';
import { ProviderRateLimiter } from '../queue';
import type { UnifiedStorage } from '../storage/types';
import { ConversationManager, createConversationManager } from '../models/conversation';
import { MessageManager, createMessageManager } from '../models/message';
import { ApiKeyManager, createApiKeyManager } from '../models/api-key';
import { createCryptoProvider } from '../storage/encryption';
import type { AIProvider, ChatCompletionRequest as SDKChatRequest } from '../types';
import type {
  InternalServiceConfig,
  InternalChatRequest,
  InternalChatResponse,
  ProviderInfo,
  StatsResponse,
  IInternalService,
} from './types';

// 提供商显示名称
const PROVIDER_NAMES: Record<AIProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google AI',
  azure: 'Azure OpenAI',
  deepseek: 'DeepSeek',
  moonshot: 'Moonshot',
  qwen: 'Alibaba Qwen',
  groq: 'Groq',
  cerebras: 'Cerebras',
  glm: 'Zhipu GLM',
  cohere: 'Cohere',
  mistral: 'Mistral',
  together: 'Together AI',
  openrouter: 'OpenRouter',
  ollama: 'Ollama',
  lmstudio: 'LM Studio',
  llamacpp: 'llama.cpp',
  vllm: 'vLLM',
  minimax: 'MiniMax',
  custom: 'Custom',
};

// 提供商默认模型
const DEFAULT_MODELS: Record<AIProvider, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini'],
  anthropic: ['claude-3-5-sonnet-20241022'],
  google: ['gemini-2.0-flash-exp'],
  azure: ['gpt-4o'],
  deepseek: ['deepseek-chat'],
  moonshot: ['moonshot-v1-8k'],
  qwen: ['qwen-turbo'],
  groq: ['llama-3.3-70b-versatile'],
  cerebras: ['llama3.1-70b'],
  glm: ['glm-4'],
  cohere: ['command-r-plus'],
  mistral: ['mistral-large-latest'],
  together: ['meta-llama/Llama-3-70b-chat-hf'],
  openrouter: ['openai/gpt-4o'],
  ollama: ['llama3.2'],
  lmstudio: ['local-model'],
  llamacpp: ['local-model'],
  vllm: ['local-model'],
  minimax: ['abab6.5-chat'],
  custom: [],
};

/**
 * 提取字符串内容
 */
function extractContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((p: any) => p.type === 'text')
      .map((p: any) => p.text)
      .join('');
  }
  return '';
}

export class InternalService implements IInternalService {
  private client: AIClient;
  private rateLimiter: ProviderRateLimiter;
  private storage: UnifiedStorage;
  private config: InternalServiceConfig;
  
  private conversationManager: ConversationManager;
  private messageManager: MessageManager;
  private apiKeyManager: ApiKeyManager;
  
  private startTime = Date.now();
  private requestCount = 0;
  private successCount = 0;
  private errorCount = 0;

  private apiKeyManagerPromise: Promise<ApiKeyManager> | null = null;

  constructor(
    client: AIClient,
    rateLimiter: ProviderRateLimiter,
    storage: UnifiedStorage,
    encryptionKey: string,
    config: InternalServiceConfig = {}
  ) {
    this.client = client;
    this.rateLimiter = rateLimiter;
    this.storage = storage;
    this.config = {
      enablePersistence: true,
      maxConversations: 100,
      maxMessagesPerConversation: 1000,
      ...config,
    };
    
    // Placeholder - will be initialized lazily
    this.apiKeyManager = null as any;
    
    this.conversationManager = createConversationManager(storage);
    this.messageManager = createMessageManager(storage);
    
    // 创建加密提供者
    const cryptoProvider = createCryptoProvider();
    this.apiKeyManager = createApiKeyManager(storage, cryptoProvider, encryptionKey);
  }

  /**
   * 内部聊天
   */
  async chat(request: InternalChatRequest): Promise<InternalChatResponse> {
    this.requestCount++;
    
    try {
      const provider = request.provider ?? 'openai';
      const model = request.model ?? DEFAULT_MODELS[provider]?.[0] ?? 'gpt-4o-mini';
      
      // 获取或创建对话
      let conversationId = request.conversationId;
      if (!conversationId && this.config.enablePersistence) {
        const conversation = await this.conversationManager.create({
          title: request.message.substring(0, 50),
          model,
          provider,
        });
        conversationId = conversation.id;
      }
      
      // 获取历史消息
      let messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt });
      }
      
      if (conversationId && this.config.enablePersistence) {
        const historyMessages = await this.messageManager.getByConversation(conversationId);
        messages = messages.concat(
          historyMessages.map(m => ({
            role: m.role as 'system' | 'user' | 'assistant',
            content: m.content,
          }))
        );
      }
      
      // 添加当前消息
      messages.push({ role: 'user', content: request.message });
      
      // 保存用户消息
      if (conversationId && this.config.enablePersistence) {
        await this.messageManager.add({
          conversationId,
          role: 'user',
          content: request.message,
        });
      }
      
      // 发送请求
      const sdkRequest: SDKChatRequest = {
        model,
        messages,
      };
      
      const response = await this.rateLimiter.request(
        sdkRequest,
        provider,
        (req, prov) => this.client.chat(req, prov)
      );
      
      // 从响应中提取内容
      const rawContent = response.choices?.[0]?.message?.content;
      const content = extractContent(rawContent);
      
      // 保存助手回复
      let messageId = '';
      if (conversationId && this.config.enablePersistence) {
        const savedMessage = await this.messageManager.add({
          conversationId,
          role: 'assistant',
          content,
        });
        messageId = savedMessage.id;
        
        // 更新对话时间
        await this.conversationManager.update(conversationId, {});
      }
      
      this.successCount++;
      
      return {
        conversationId: conversationId ?? '',
        messageId,
        content,
        model,
        provider,
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        } : undefined,
      };
    } catch (error) {
      this.errorCount++;
      throw error;
    }
  }

  /**
   * 流式聊天
   */
  async streamChat(
    request: InternalChatRequest,
    onChunk: (content: string) => void
  ): Promise<InternalChatResponse> {
    this.requestCount++;
    
    try {
      const provider = request.provider ?? 'openai';
      const model = request.model ?? DEFAULT_MODELS[provider]?.[0] ?? 'gpt-4o-mini';
      
      // 获取或创建对话
      let conversationId = request.conversationId;
      if (!conversationId && this.config.enablePersistence) {
        const conversation = await this.conversationManager.create({
          title: request.message.substring(0, 50),
          model,
          provider,
        });
        conversationId = conversation.id;
      }
      
      // 获取历史消息
      let messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt });
      }
      
      if (conversationId && this.config.enablePersistence) {
        const historyMessages = await this.messageManager.getByConversation(conversationId);
        messages = messages.concat(
          historyMessages.map(m => ({
            role: m.role as 'system' | 'user' | 'assistant',
            content: m.content,
          }))
        );
      }
      
      messages.push({ role: 'user', content: request.message });
      
      // 保存用户消息
      if (conversationId && this.config.enablePersistence) {
        await this.messageManager.add({
          conversationId,
          role: 'user',
          content: request.message,
        });
      }
      
      // 发送流式请求
      const sdkRequest: SDKChatRequest = {
        model,
        messages,
        stream: true,
      };
      
      let fullContent = '';
      
      const adapter = this.client.getAdapter(provider);
      for await (const chunk of adapter.chatStream(sdkRequest)) {
        const rawContent = chunk.choices?.[0]?.delta?.content;
        const textContent = extractContent(rawContent);
        if (textContent) {
          fullContent += textContent;
          onChunk(textContent);
        }
      }
      
      // 保存助手回复
      let messageId = '';
      if (conversationId && this.config.enablePersistence) {
        const savedMessage = await this.messageManager.add({
          conversationId,
          role: 'assistant',
          content: fullContent,
        });
        messageId = savedMessage.id;
        
        await this.conversationManager.update(conversationId, {});
      }
      
      this.successCount++;
      
      return {
        conversationId: conversationId ?? '',
        messageId,
        content: fullContent,
        model,
        provider,
      };
    } catch (error) {
      this.errorCount++;
      throw error;
    }
  }

  /**
   * 获取对话列表
   */
  async listConversations(options?: { limit?: number; offset?: number }) {
    const conversations = await this.conversationManager.list({
      limit: options?.limit ?? 50,
      offset: options?.offset ?? 0,
    });
    
    return conversations.map(c => ({
      id: c.id,
      title: c.title,
      updatedAt: c.updatedAt,
    }));
  }

  /**
   * 获取对话消息
   */
  async getConversationMessages(conversationId: string) {
    const messages = await this.messageManager.getByConversation(conversationId);
    return messages.map(m => ({
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    }));
  }

  /**
   * 删除对话
   */
  async deleteConversation(conversationId: string): Promise<boolean> {
    // 先删除所有消息
    await this.messageManager.deleteByConversation(conversationId);
    // 再删除对话
    return this.conversationManager.delete(conversationId);
  }

  /**
   * 获取提供商列表
   */
  async listProviders(): Promise<ProviderInfo[]> {
    const registeredProviders = this.client.getProviders();
    const storedProvidersList = await this.apiKeyManager.listProviders();
    const storedProviders = new Set(storedProvidersList);
    
    const providers: ProviderInfo[] = [];
    
    for (const provider of Object.keys(PROVIDER_NAMES) as AIProvider[]) {
      const isRegistered = registeredProviders.includes(provider);
      const hasKey = storedProviders.has(provider);
      
      providers.push({
        provider,
        name: PROVIDER_NAMES[provider],
        hasApiKey: hasKey,
        models: DEFAULT_MODELS[provider] || [],
        status: isRegistered ? 'active' : hasKey ? 'inactive' : 'inactive',
      });
    }
    
    return providers;
  }

  /**
   * 设置 API Key
   */
  async setApiKey(provider: AIProvider, apiKey: string): Promise<void> {
    await this.apiKeyManager.store({ provider, apiKey });
  }

  /**
   * 删除 API Key
   */
  async deleteApiKey(provider: AIProvider): Promise<boolean> {
    return this.apiKeyManager.delete(provider);
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<StatsResponse> {
    const conversations = await this.conversationManager.list({ limit: 1000 });
    let totalMessages = 0;
    
    for (const conv of conversations) {
      const messages = await this.messageManager.getByConversation(conv.id);
      totalMessages += messages.length;
    }
    
    return {
      uptime: Date.now() - this.startTime,
      requests: {
        total: this.requestCount,
        success: this.successCount,
        failed: this.errorCount,
      },
      queue: {
        pending: 0,
        processing: 0,
      },
      storage: {
        conversations: conversations.length,
        messages: totalMessages,
      },
    };
  }
}
