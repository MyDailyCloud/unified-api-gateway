/**
 * 统一 AI 客户端
 * Unified AI Client - Single entry point for all AI providers
 */

import {
  AIAdapter,
  AIProvider,
  ProviderConfig,
  ChatCompletionRequest,
  ChatCompletionResponse,
  StreamChunk,
  ModelInfo,
  AIError,
} from './types';
import {
  OpenAIAdapter,
  AnthropicAdapter,
  CerebrasAdapter,
  GLMAdapter,
  GroqAdapter,
  DeepSeekAdapter,
  MoonshotAdapter,
  QwenAdapter,
  CustomAdapter,
  CustomAdapterConfig,
} from './adapters';

export interface AIClientConfig {
  defaultProvider?: AIProvider;
  providers?: ProviderConfig[];
}

export class AIClient {
  private adapters: Map<AIProvider, AIAdapter> = new Map();
  private defaultProvider?: AIProvider;
  
  constructor(config?: AIClientConfig) {
    this.defaultProvider = config?.defaultProvider;
    
    if (config?.providers) {
      for (const providerConfig of config.providers) {
        this.registerProvider(providerConfig);
      }
    }
  }
  
  /**
   * 注册 AI 提供商 (ProviderConfig 必须包含 provider 字段)
   */
  registerProvider(config: ProviderConfig): void {
    const adapter = this.createAdapter(config);
    this.adapters.set(adapter.provider, adapter);
    
    if (!this.defaultProvider) {
      this.defaultProvider = adapter.provider;
    }
  }
  
  /**
   * 移除 AI 提供商
   */
  unregisterProvider(provider: AIProvider): void {
    this.adapters.delete(provider);
    
    if (this.defaultProvider === provider) {
      this.defaultProvider = this.adapters.keys().next().value;
    }
  }
  
  /**
   * 获取已注册的提供商列表
   */
  getProviders(): AIProvider[] {
    return Array.from(this.adapters.keys());
  }
  
  /**
   * 获取指定提供商的适配器
   */
  getAdapter(provider?: AIProvider): AIAdapter {
    const targetProvider = provider || this.defaultProvider;
    
    if (!targetProvider) {
      throw new AIError(
        'No provider specified and no default provider configured',
        'NO_PROVIDER',
        'custom'
      );
    }
    
    const adapter = this.adapters.get(targetProvider);
    
    if (!adapter) {
      throw new AIError(
        `Provider ${targetProvider} not registered`,
        'PROVIDER_NOT_FOUND',
        targetProvider
      );
    }
    
    return adapter;
  }
  
  /**
   * 设置默认提供商
   */
  setDefaultProvider(provider: AIProvider): void {
    if (!this.adapters.has(provider)) {
      throw new AIError(
        `Provider ${provider} not registered`,
        'PROVIDER_NOT_FOUND',
        provider
      );
    }
    this.defaultProvider = provider;
  }
  
  /**
   * 聊天完成 - 非流式
   */
  async chat(
    request: ChatCompletionRequest,
    provider?: AIProvider
  ): Promise<ChatCompletionResponse> {
    const adapter = this.getAdapter(provider);
    return adapter.chat(request);
  }
  
  /**
   * 聊天完成 - 流式
   */
  async *chatStream(
    request: ChatCompletionRequest,
    provider?: AIProvider
  ): AsyncIterable<StreamChunk> {
    const adapter = this.getAdapter(provider);
    yield* adapter.chatStream(request);
  }
  
  /**
   * 获取所有可用模型
   */
  async listAllModels(): Promise<ModelInfo[]> {
    const allModels: ModelInfo[] = [];
    
    for (const adapter of this.adapters.values()) {
      try {
        const models = await adapter.listModels();
        allModels.push(...models);
      } catch (error) {
        console.warn(`Failed to list models for ${adapter.provider}:`, error);
      }
    }
    
    return allModels;
  }
  
  /**
   * 获取指定提供商的模型
   */
  async listModels(provider?: AIProvider): Promise<ModelInfo[]> {
    const adapter = this.getAdapter(provider);
    return adapter.listModels();
  }
  
  /**
   * 验证提供商 API Key
   */
  async validateProvider(provider?: AIProvider): Promise<boolean> {
    const adapter = this.getAdapter(provider);
    return adapter.validateApiKey();
  }
  
  /**
   * 带回退的聊天完成
   */
  async chatWithFallback(
    request: ChatCompletionRequest,
    providers: AIProvider[]
  ): Promise<ChatCompletionResponse & { usedProvider: AIProvider }> {
    let lastError: Error | null = null;
    
    for (const provider of providers) {
      try {
        const adapter = this.adapters.get(provider);
        if (!adapter) continue;
        
        const response = await adapter.chat(request);
        return { ...response, usedProvider: provider };
      } catch (error) {
        lastError = error as Error;
        console.warn(`Provider ${provider} failed:`, error);
      }
    }
    
    throw lastError || new AIError(
      'All providers failed',
      'ALL_PROVIDERS_FAILED',
      'custom'
    );
  }
  
  /**
   * 创建适配器实例
   */
  private createAdapter(config: ProviderConfig): AIAdapter {
    switch (config.provider) {
      case 'openai':
        return new OpenAIAdapter(config);
      case 'anthropic':
        return new AnthropicAdapter(config);
      case 'cerebras':
        return new CerebrasAdapter(config);
      case 'glm':
        return new GLMAdapter(config);
      case 'groq':
        return new GroqAdapter(config);
      case 'deepseek':
        return new DeepSeekAdapter(config);
      case 'moonshot':
        return new MoonshotAdapter(config);
      case 'qwen':
        return new QwenAdapter(config);
      case 'custom':
        return new CustomAdapter(config as CustomAdapterConfig);
      default:
        throw new AIError(
          `Unknown provider: ${config.provider}`,
          'UNKNOWN_PROVIDER',
          config.provider
        );
    }
  }
}

// 单例导出
let defaultClient: AIClient | null = null;

export function getAIClient(): AIClient {
  if (!defaultClient) {
    defaultClient = new AIClient();
  }
  return defaultClient;
}

export function setAIClient(client: AIClient): void {
  defaultClient = client;
}
