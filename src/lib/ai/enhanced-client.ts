/**
 * 增强 AI 客户端
 * Enhanced AI Client - Integrates middleware, cache, queue, and cost tracking
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
  AdapterCapabilities,
  EmbeddingRequest,
  EmbeddingResponse,
  ImageGenerationRequest,
  ImageGenerationResponse,
  SpeechRequest,
  SpeechResponse,
  TranscriptionRequest,
  TranscriptionResponse,
  RerankRequest,
  RerankResponse,
} from './types';
import { AIClient, AIClientConfig } from './client';
import { MiddlewareManager, MiddlewareContext, generateRequestId } from './middleware';
import { AICache, MemoryCache, CacheConfig, defaultCacheKeyGenerator } from './cache';
import { RequestQueue, QueueConfig, RATE_LIMIT_PRESETS } from './queue';
import { CostTracker, CostTrackerConfig } from './cost-tracker';
import { AIDiagnostics, DiagnosticsReport, ConnectionTestResult } from './diagnostics';

// ==================== 增强客户端配置 ====================

export interface EnhancedAIClientConfig extends AIClientConfig {
  /** 中间件管理器 */
  middleware?: MiddlewareManager;
  /** 缓存配置 */
  cache?: CacheConfig | AICache;
  /** 队列配置 */
  queue?: QueueConfig;
  /** 成本追踪配置 */
  costTracker?: CostTrackerConfig;
  /** 是否启用诊断 */
  enableDiagnostics?: boolean;
  /** 是否自动应用速率限制预设 */
  autoRateLimit?: boolean;
}

// ==================== 增强客户端实现 ====================

export class EnhancedAIClient extends AIClient {
  private middleware: MiddlewareManager;
  private cache: AICache | null = null;
  private queues = new Map<AIProvider, RequestQueue>();
  private costTracker: CostTracker | null = null;
  private diagnostics: AIDiagnostics | null = null;
  private queueConfig?: QueueConfig;
  private autoRateLimit: boolean;

  constructor(config?: EnhancedAIClientConfig) {
    super(config);

    this.middleware = config?.middleware || new MiddlewareManager();
    this.autoRateLimit = config?.autoRateLimit ?? true;

    // 初始化缓存
    if (config?.cache) {
      if ('get' in config.cache) {
        this.cache = config.cache as AICache;
      } else {
        this.cache = new MemoryCache(config.cache as CacheConfig);
      }
    }

    // 保存队列配置
    this.queueConfig = config?.queue;

    // 初始化成本追踪器
    if (config?.costTracker) {
      this.costTracker = new CostTracker(config.costTracker);
    }

    // 初始化诊断工具
    if (config?.enableDiagnostics) {
      this.diagnostics = new AIDiagnostics(this.getAdaptersMap());
    }
  }

  /**
   * 获取内部适配器映射（用于诊断）
   */
  private getAdaptersMap(): Map<AIProvider, AIAdapter> {
    const map = new Map<AIProvider, AIAdapter>();
    for (const provider of this.getProviders()) {
      try {
        map.set(provider, this.getAdapter(provider));
      } catch {
        // 忽略获取失败的适配器
      }
    }
    return map;
  }

  /**
   * 获取或创建提供商队列
   */
  private getQueue(provider: AIProvider): RequestQueue {
    if (!this.queues.has(provider)) {
      const presetConfig = this.autoRateLimit ? RATE_LIMIT_PRESETS[provider] : undefined;
      const config = { ...presetConfig, ...this.queueConfig };
      this.queues.set(provider, new RequestQueue(config));
    }
    return this.queues.get(provider)!;
  }

  /**
   * 增强的聊天完成 - 集成所有基础设施
   */
  async chat(
    request: ChatCompletionRequest,
    provider?: AIProvider
  ): Promise<ChatCompletionResponse> {
    const targetProvider = provider || this.getProviders()[0];
    if (!targetProvider) {
      throw new AIError('No provider available', 'NO_PROVIDER', 'custom');
    }

    const requestId = generateRequestId();
    const startTime = Date.now();
    const context: MiddlewareContext = {
      provider: targetProvider,
      requestId,
      startTime,
    };

    try {
      // 1. 执行请求中间件
      let processedRequest = await this.middleware.executeRequest(request, context);

      // 2. 检查缓存
      if (this.cache) {
        const cacheKey = defaultCacheKeyGenerator(processedRequest);
        const cached = await this.cache.get(cacheKey);
        if (cached) {
          const duration = Date.now() - startTime;
          await this.middleware.executeComplete({
            ...context,
            duration,
            success: true,
            tokensUsed: cached.usage ? {
              prompt: cached.usage.prompt_tokens,
              completion: cached.usage.completion_tokens,
              total: cached.usage.total_tokens,
            } : undefined,
          });
          return cached;
        }
      }

      // 3. 通过队列发送请求
      const queue = this.getQueue(targetProvider);
      queue.setExecutor((req, prov) => super.chat(req, prov));
      const response = await queue.enqueue(processedRequest, targetProvider);

      const duration = Date.now() - startTime;

      // 4. 执行响应中间件
      const processedResponse = await this.middleware.executeResponse(response, {
        ...context,
        duration,
      });

      // 5. 追踪成本
      if (this.costTracker) {
        this.costTracker.track(processedResponse, targetProvider);
      }

      // 6. 存入缓存
      if (this.cache) {
        const cacheKey = defaultCacheKeyGenerator(processedRequest);
        await this.cache.set(cacheKey, processedResponse);
      }

      // 7. 执行完成中间件
      await this.middleware.executeComplete({
        ...context,
        duration,
        success: true,
        tokensUsed: processedResponse.usage ? {
          prompt: processedResponse.usage.prompt_tokens,
          completion: processedResponse.usage.completion_tokens,
          total: processedResponse.usage.total_tokens,
        } : undefined,
      });

      return processedResponse;
    } catch (error) {
      const duration = Date.now() - startTime;

      // 执行错误中间件
      if (error instanceof AIError) {
        await this.middleware.executeError(error, { ...context, retryCount: 0 });
      }

      // 执行完成中间件
      await this.middleware.executeComplete({
        ...context,
        duration,
        success: false,
      });

      throw error;
    }
  }

  /**
   * 增强的流式聊天 - 集成中间件
   */
  async *chatStream(
    request: ChatCompletionRequest,
    provider?: AIProvider
  ): AsyncIterable<StreamChunk> {
    const targetProvider = provider || this.getProviders()[0];
    if (!targetProvider) {
      throw new AIError('No provider available', 'NO_PROVIDER', 'custom');
    }

    const requestId = generateRequestId();
    const startTime = Date.now();
    const context: MiddlewareContext = {
      provider: targetProvider,
      requestId,
      startTime,
    };

    try {
      // 执行请求中间件
      const processedRequest = await this.middleware.executeRequest(request, context);

      // 发送流式请求
      for await (const chunk of super.chatStream(processedRequest, targetProvider)) {
        // 执行流式中间件
        const processedChunk = await this.middleware.executeStream(chunk, context);
        yield processedChunk;
      }

      // 执行完成中间件
      await this.middleware.executeComplete({
        ...context,
        duration: Date.now() - startTime,
        success: true,
      });
    } catch (error) {
      if (error instanceof AIError) {
        await this.middleware.executeError(error, { ...context, retryCount: 0 });
      }

      await this.middleware.executeComplete({
        ...context,
        duration: Date.now() - startTime,
        success: false,
      });

      throw error;
    }
  }

  // ==================== 中间件管理 ====================

  /**
   * 获取中间件管理器
   */
  getMiddleware(): MiddlewareManager {
    return this.middleware;
  }

  // ==================== 缓存管理 ====================

  /**
   * 获取缓存实例
   */
  getCache(): AICache | null {
    return this.cache;
  }

  /**
   * 设置缓存
   */
  setCache(cache: AICache | null): void {
    this.cache = cache;
  }

  /**
   * 清空缓存
   */
  async clearCache(): Promise<void> {
    if (this.cache) {
      await this.cache.clear();
    }
  }

  // ==================== 成本追踪 ====================

  /**
   * 获取成本追踪器
   */
  getCostTracker(): CostTracker | null {
    return this.costTracker;
  }

  /**
   * 获取当月成本
   */
  getCurrentMonthCost(): number {
    return this.costTracker?.getCurrentMonthCost() || 0;
  }

  /**
   * 获取今日成本
   */
  getTodayCost(): number {
    return this.costTracker?.getTodayCost() || 0;
  }

  // ==================== 队列管理 ====================

  /**
   * 获取队列统计
   */
  getQueueStats(): Record<AIProvider, { pending: number; active: number }> {
    const stats: Record<string, { pending: number; active: number }> = {};
    for (const [provider, queue] of this.queues) {
      const queueStats = queue.getStats();
      stats[provider] = { pending: queueStats.pending, active: queueStats.active };
    }
    return stats as Record<AIProvider, { pending: number; active: number }>;
  }

  // ==================== 诊断工具 ====================

  /**
   * 测试所有连接
   */
  async testConnections(): Promise<ConnectionTestResult[]> {
    if (!this.diagnostics) {
      this.diagnostics = new AIDiagnostics(this.getAdaptersMap());
    }
    return this.diagnostics.testAllConnections();
  }

  /**
   * 生成诊断报告
   */
  async getDiagnostics(): Promise<DiagnosticsReport> {
    if (!this.diagnostics) {
      this.diagnostics = new AIDiagnostics(this.getAdaptersMap());
    }
    return this.diagnostics.generateReport();
  }

  /**
   * 获取最快的提供商
   */
  async getFastestProvider(): Promise<AIProvider | null> {
    if (!this.diagnostics) {
      this.diagnostics = new AIDiagnostics(this.getAdaptersMap());
    }
    return this.diagnostics.getFastestProvider();
  }
  
  // ==================== 全模态增强方法 ====================
  
  /**
   * 增强的文本嵌入
   */
  async embed(
    request: EmbeddingRequest,
    provider?: AIProvider
  ): Promise<EmbeddingResponse> {
    const targetProvider = provider || this.getProviders()[0];
    const requestId = generateRequestId();
    const startTime = Date.now();
    const context: MiddlewareContext = {
      provider: targetProvider,
      requestId,
      startTime,
    };
    
    try {
      await this.middleware.executeRequest({ model: request.model, messages: [] }, context);
      const response = await super.embed(request, targetProvider);
      await this.middleware.executeComplete({
        ...context,
        duration: Date.now() - startTime,
        success: true,
      });
      return response;
    } catch (error) {
      await this.middleware.executeComplete({
        ...context,
        duration: Date.now() - startTime,
        success: false,
      });
      throw error;
    }
  }
  
  /**
   * 增强的图像生成
   */
  async generateImage(
    request: ImageGenerationRequest,
    provider?: AIProvider
  ): Promise<ImageGenerationResponse> {
    const targetProvider = provider || this.getProviders()[0];
    const requestId = generateRequestId();
    const startTime = Date.now();
    const context: MiddlewareContext = {
      provider: targetProvider,
      requestId,
      startTime,
    };
    
    try {
      await this.middleware.executeRequest({ model: request.model, messages: [] }, context);
      const response = await super.generateImage(request, targetProvider);
      await this.middleware.executeComplete({
        ...context,
        duration: Date.now() - startTime,
        success: true,
      });
      return response;
    } catch (error) {
      await this.middleware.executeComplete({
        ...context,
        duration: Date.now() - startTime,
        success: false,
      });
      throw error;
    }
  }
  
  /**
   * 增强的语音合成
   */
  async speak(
    request: SpeechRequest,
    provider?: AIProvider
  ): Promise<SpeechResponse> {
    const targetProvider = provider || this.getProviders()[0];
    const requestId = generateRequestId();
    const startTime = Date.now();
    const context: MiddlewareContext = {
      provider: targetProvider,
      requestId,
      startTime,
    };
    
    try {
      await this.middleware.executeRequest({ model: request.model, messages: [] }, context);
      const response = await super.speak(request, targetProvider);
      await this.middleware.executeComplete({
        ...context,
        duration: Date.now() - startTime,
        success: true,
      });
      return response;
    } catch (error) {
      await this.middleware.executeComplete({
        ...context,
        duration: Date.now() - startTime,
        success: false,
      });
      throw error;
    }
  }
  
  /**
   * 增强的语音识别
   */
  async transcribe(
    request: TranscriptionRequest,
    provider?: AIProvider
  ): Promise<TranscriptionResponse> {
    const targetProvider = provider || this.getProviders()[0];
    const requestId = generateRequestId();
    const startTime = Date.now();
    const context: MiddlewareContext = {
      provider: targetProvider,
      requestId,
      startTime,
    };
    
    try {
      await this.middleware.executeRequest({ model: request.model, messages: [] }, context);
      const response = await super.transcribe(request, targetProvider);
      await this.middleware.executeComplete({
        ...context,
        duration: Date.now() - startTime,
        success: true,
      });
      return response;
    } catch (error) {
      await this.middleware.executeComplete({
        ...context,
        duration: Date.now() - startTime,
        success: false,
      });
      throw error;
    }
  }
  
  /**
   * 增强的重排序
   */
  async rerank(
    request: RerankRequest,
    provider?: AIProvider
  ): Promise<RerankResponse> {
    const targetProvider = provider || this.getProviders()[0];
    const requestId = generateRequestId();
    const startTime = Date.now();
    const context: MiddlewareContext = {
      provider: targetProvider,
      requestId,
      startTime,
    };
    
    try {
      await this.middleware.executeRequest({ model: request.model, messages: [] }, context);
      const response = await super.rerank(request, targetProvider);
      await this.middleware.executeComplete({
        ...context,
        duration: Date.now() - startTime,
        success: true,
      });
      return response;
    } catch (error) {
      await this.middleware.executeComplete({
        ...context,
        duration: Date.now() - startTime,
        success: false,
      });
      throw error;
    }
  }
}

// ==================== 工厂函数 ====================

let enhancedClient: EnhancedAIClient | null = null;

export function getEnhancedAIClient(): EnhancedAIClient {
  if (!enhancedClient) {
    enhancedClient = new EnhancedAIClient();
  }
  return enhancedClient;
}

export function setEnhancedAIClient(client: EnhancedAIClient): void {
  enhancedClient = client;
}

export function createEnhancedAIClient(config?: EnhancedAIClientConfig): EnhancedAIClient {
  return new EnhancedAIClient(config);
}
