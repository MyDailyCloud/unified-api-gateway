/**
 * AI 服务 - 对外 API（OpenAI 兼容）
 * AI Service - External API (OpenAI Compatible)
 */

import { AIClient } from '../client';
import { ProviderRateLimiter } from '../queue';
import type { AIProvider, ChatCompletionRequest as SDKChatRequest } from '../types';
import type {
  AIServiceConfig,
  OpenAIChatCompletionRequest,
  OpenAIChatCompletionResponse,
  OpenAIChatCompletionChunk,
  ModelsResponse,
  ModelInfo,
  IAIService,
} from './types';

// 提供商模型映射
const PROVIDER_MODELS: Record<AIProvider, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
  google: ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  azure: ['gpt-4o', 'gpt-4'],
  deepseek: ['deepseek-chat', 'deepseek-coder'],
  moonshot: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
  qwen: ['qwen-turbo', 'qwen-plus', 'qwen-max'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
  cerebras: ['llama3.1-8b', 'llama3.1-70b', 'llama-3.3-70b', 'llama3.3-70b'],
  glm: ['glm-4', 'glm-4-flash'],
  cohere: ['command-r-plus', 'command-r', 'command'],
  mistral: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest'],
  together: ['meta-llama/Llama-3-70b-chat-hf', 'mistralai/Mixtral-8x7B-Instruct-v0.1'],
  openrouter: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet'],
  ollama: ['llama3.2', 'qwen2.5', 'mistral'],
  lmstudio: ['local-model'],
  llamacpp: ['local-model'],
  vllm: ['local-model'],
  minimax: ['abab6.5-chat', 'abab5.5-chat'],
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

export class AIService implements IAIService {
  private client: AIClient;
  private rateLimiter: ProviderRateLimiter;
  private config: AIServiceConfig;
  private requestCount = 0;
  private successCount = 0;
  private errorCount = 0;
  private startTime = Date.now();

  constructor(
    client: AIClient,
    rateLimiter: ProviderRateLimiter,
    config: AIServiceConfig = {}
  ) {
    this.client = client;
    this.rateLimiter = rateLimiter;
    this.config = {
      defaultModel: 'gpt-4o-mini',
      defaultProvider: 'openai',
      maxTokens: 4096,
      timeout: 60000,
      enableStreaming: true,
      ...config,
    };
  }

  /**
   * 聊天补全 - OpenAI 兼容 API
   */
  async chatCompletion(request: OpenAIChatCompletionRequest): Promise<OpenAIChatCompletionResponse> {
    this.requestCount++;

    try {
      const { provider, model } = this.resolveModel(request.model);
      
      const sdkRequest: SDKChatRequest = {
        model,
        messages: request.messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        temperature: request.temperature,
        max_tokens: request.max_tokens ?? this.config.maxTokens,
        top_p: request.top_p,
        frequency_penalty: request.frequency_penalty,
        presence_penalty: request.presence_penalty,
        stop: request.stop,
      };

      const response = await this.rateLimiter.request(
        sdkRequest,
        provider,
        (req, prov) => this.client.chat(req, prov)
      );

      this.successCount++;

      // 从 SDK 响应转换为 OpenAI 格式
      const rawContent = response.choices?.[0]?.message?.content;
      const content = extractContent(rawContent);
      const finishReason = response.choices?.[0]?.finish_reason ?? 'stop';

      return {
        id: response.id ?? `chatcmpl-${this.generateId()}`,
        object: 'chat.completion',
        created: response.created ?? Math.floor(Date.now() / 1000),
        model: response.model ?? model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content,
          },
          finish_reason: finishReason as 'stop' | 'length' | 'content_filter',
        }],
        usage: response.usage ? {
          prompt_tokens: response.usage.prompt_tokens,
          completion_tokens: response.usage.completion_tokens,
          total_tokens: response.usage.total_tokens,
        } : undefined,
      };
    } catch (error) {
      this.errorCount++;
      throw error;
    }
  }

  /**
   * 流式聊天补全
   */
  async streamChatCompletion(
    request: OpenAIChatCompletionRequest,
    onChunk: (chunk: OpenAIChatCompletionChunk) => void
  ): Promise<void> {
    if (!this.config.enableStreaming) {
      throw new Error('Streaming is disabled');
    }

    this.requestCount++;
    const responseId = `chatcmpl-${this.generateId()}`;
    const created = Math.floor(Date.now() / 1000);
    const model = request.model ?? this.config.defaultModel!;

    try {
      const { provider, model: resolvedModel } = this.resolveModel(request.model);
      
      const sdkRequest: SDKChatRequest = {
        model: resolvedModel,
        messages: request.messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        temperature: request.temperature,
        max_tokens: request.max_tokens ?? this.config.maxTokens,
        top_p: request.top_p,
        stream: true,
      };

      // 发送初始 chunk（带 role）
      onChunk({
        id: responseId,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [{
          index: 0,
          delta: { role: 'assistant' },
          finish_reason: null,
        }],
      });

      const adapter = this.client.getAdapter(provider);
      
      // 使用适配器的流式方法 (chatStream)
      for await (const chunk of adapter.chatStream(sdkRequest)) {
        const content = chunk.choices?.[0]?.delta?.content;
        if (content) {
          const textContent = extractContent(content);
          if (textContent) {
            onChunk({
              id: responseId,
              object: 'chat.completion.chunk',
              created,
              model,
              choices: [{
                index: 0,
                delta: { content: textContent },
                finish_reason: null,
              }],
            });
          }
        }
      }

      // 发送结束 chunk
      onChunk({
        id: responseId,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: 'stop',
        }],
      });

      this.successCount++;
    } catch (error) {
      this.errorCount++;
      throw error;
    }
  }

  /**
   * 获取模型列表
   */
  async listModels(): Promise<ModelsResponse> {
    const models: ModelInfo[] = [];
    const now = Math.floor(Date.now() / 1000);

    // 获取已注册的提供商
    const registeredProviders = this.client.getProviders();

    for (const provider of registeredProviders) {
      const providerModels = PROVIDER_MODELS[provider] || [];
      for (const modelId of providerModels) {
        models.push({
          id: modelId,
          object: 'model',
          created: now,
          owned_by: provider,
        });
      }
    }

    return {
      object: 'list',
      data: models,
    };
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      uptime: Date.now() - this.startTime,
      requests: {
        total: this.requestCount,
        success: this.successCount,
        failed: this.errorCount,
      },
    };
  }

  /**
   * 解析模型名称到提供商和模型
   */
  private resolveModel(modelName?: string): { provider: AIProvider; model: string } {
    const model = modelName ?? this.config.defaultModel!;
    
    // 检查是否是 provider/model 格式
    if (model.includes('/')) {
      const [providerPart, ...modelParts] = model.split('/');
      const provider = providerPart as AIProvider;
      if (PROVIDER_MODELS[provider]) {
        return { provider, model: modelParts.join('/') };
      }
    }

    // 查找模型所属提供商
    for (const [provider, models] of Object.entries(PROVIDER_MODELS)) {
      if (models.includes(model)) {
        return { provider: provider as AIProvider, model };
      }
    }

    // 默认提供商
    return { provider: this.config.defaultProvider!, model };
  }

  /**
   * 生成请求 ID
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }
}
