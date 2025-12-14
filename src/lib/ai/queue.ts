/**
 * AI 请求队列和并发控制
 * AI Request Queue and Concurrency Control
 */

import type { ChatCompletionRequest, ChatCompletionResponse, AIProvider } from './types';

// ==================== 队列配置类型 ====================

export interface QueueConfig {
  /** 最大并发请求数 */
  maxConcurrent: number;
  /** 速率限制配置 */
  rateLimit?: {
    /** 时间窗口内最大请求数 */
    requests: number;
    /** 时间窗口（毫秒） */
    perMilliseconds: number;
  };
  /** 请求优先级函数 */
  priority?: (request: QueuedRequest) => number;
  /** 队列最大长度 */
  maxQueueSize?: number;
  /** 请求超时（毫秒） */
  timeout?: number;
}

export interface QueuedRequest {
  id: string;
  request: ChatCompletionRequest;
  provider: AIProvider;
  priority: number;
  createdAt: number;
  resolve: (response: ChatCompletionResponse) => void;
  reject: (error: Error) => void;
}

export interface QueueStats {
  pending: number;
  active: number;
  completed: number;
  failed: number;
  averageWaitTime: number;
  averageProcessTime: number;
}

// ==================== 请求队列实现 ====================

export class RequestQueue {
  private queue: QueuedRequest[] = [];
  private activeRequests = 0;
  private config: Required<QueueConfig>;
  private requestTimestamps: number[] = [];
  private stats = {
    completed: 0,
    failed: 0,
    totalWaitTime: 0,
    totalProcessTime: 0,
  };
  private executor?: (request: ChatCompletionRequest, provider: AIProvider) => Promise<ChatCompletionResponse>;

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = {
      maxConcurrent: 3,
      maxQueueSize: 100,
      timeout: 60000,
      rateLimit: config.rateLimit,
      priority: config.priority ?? (() => 0),
      ...config,
    } as Required<QueueConfig>;
  }

  /**
   * 设置请求执行器
   */
  setExecutor(executor: (request: ChatCompletionRequest, provider: AIProvider) => Promise<ChatCompletionResponse>): void {
    this.executor = executor;
  }

  /**
   * 添加请求到队列
   */
  async enqueue(
    request: ChatCompletionRequest,
    provider: AIProvider
  ): Promise<ChatCompletionResponse> {
    if (this.queue.length >= this.config.maxQueueSize) {
      throw new Error('Queue is full');
    }

    return new Promise<ChatCompletionResponse>((resolve, reject) => {
      const queuedRequest: QueuedRequest = {
        id: generateQueueId(),
        request,
        provider,
        priority: this.config.priority({ 
          id: '', 
          request, 
          provider, 
          priority: 0, 
          createdAt: Date.now(),
          resolve: () => {},
          reject: () => {},
        }),
        createdAt: Date.now(),
        resolve,
        reject,
      };

      // 按优先级插入队列
      const insertIndex = this.queue.findIndex(
        item => item.priority < queuedRequest.priority
      );
      if (insertIndex === -1) {
        this.queue.push(queuedRequest);
      } else {
        this.queue.splice(insertIndex, 0, queuedRequest);
      }

      // 尝试处理队列
      this.processQueue();
    });
  }

  /**
   * 处理队列中的请求
   */
  private async processQueue(): Promise<void> {
    while (
      this.queue.length > 0 &&
      this.activeRequests < this.config.maxConcurrent &&
      this.canMakeRequest()
    ) {
      const queuedRequest = this.queue.shift();
      if (!queuedRequest) continue;

      this.activeRequests++;
      const waitTime = Date.now() - queuedRequest.createdAt;
      this.stats.totalWaitTime += waitTime;

      // 记录请求时间戳（用于速率限制）
      this.requestTimestamps.push(Date.now());

      const startTime = Date.now();

      try {
        if (!this.executor) {
          throw new Error('No executor set for queue');
        }

        // 设置超时
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), this.config.timeout);
        });

        const response = await Promise.race([
          this.executor(queuedRequest.request, queuedRequest.provider),
          timeoutPromise,
        ]);

        this.stats.completed++;
        this.stats.totalProcessTime += Date.now() - startTime;
        queuedRequest.resolve(response);
      } catch (error) {
        this.stats.failed++;
        this.stats.totalProcessTime += Date.now() - startTime;
        queuedRequest.reject(error instanceof Error ? error : new Error(String(error)));
      } finally {
        this.activeRequests--;
        // 继续处理队列
        this.processQueue();
      }
    }
  }

  /**
   * 检查是否可以发起新请求（速率限制）
   */
  private canMakeRequest(): boolean {
    if (!this.config.rateLimit) return true;

    const now = Date.now();
    const windowStart = now - this.config.rateLimit.perMilliseconds;

    // 清理过期的时间戳
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > windowStart);

    return this.requestTimestamps.length < this.config.rateLimit.requests;
  }

  /**
   * 获取队列统计信息
   */
  getStats(): QueueStats {
    const totalRequests = this.stats.completed + this.stats.failed;
    return {
      pending: this.queue.length,
      active: this.activeRequests,
      completed: this.stats.completed,
      failed: this.stats.failed,
      averageWaitTime: totalRequests > 0 ? this.stats.totalWaitTime / totalRequests : 0,
      averageProcessTime: totalRequests > 0 ? this.stats.totalProcessTime / totalRequests : 0,
    };
  }

  /**
   * 清空队列
   */
  clear(): void {
    for (const request of this.queue) {
      request.reject(new Error('Queue cleared'));
    }
    this.queue = [];
  }

  /**
   * 获取队列长度
   */
  get length(): number {
    return this.queue.length;
  }

  /**
   * 获取活跃请求数
   */
  get active(): number {
    return this.activeRequests;
  }

  /**
   * 暂停队列处理
   */
  private paused = false;

  pause(): void {
    this.paused = true;
  }

  /**
   * 恢复队列处理
   */
  resume(): void {
    this.paused = false;
    this.processQueue();
  }

  /**
   * 检查队列是否暂停
   */
  get isPaused(): boolean {
    return this.paused;
  }
}

// ==================== 提供商级别的速率限制器 ====================

export class ProviderRateLimiter {
  private limiters = new Map<AIProvider, RequestQueue>();
  private defaultConfig: Partial<QueueConfig>;

  constructor(defaultConfig?: Partial<QueueConfig>) {
    this.defaultConfig = defaultConfig ?? {};
  }

  /**
   * 为提供商设置配置
   */
  setProviderConfig(provider: AIProvider, config: Partial<QueueConfig>): void {
    const queue = this.getOrCreateQueue(provider);
    Object.assign(queue, config);
  }

  /**
   * 获取或创建提供商队列
   */
  private getOrCreateQueue(provider: AIProvider): RequestQueue {
    if (!this.limiters.has(provider)) {
      this.limiters.set(provider, new RequestQueue(this.defaultConfig));
    }
    return this.limiters.get(provider)!;
  }

  /**
   * 通过队列发送请求
   */
  async request(
    request: ChatCompletionRequest,
    provider: AIProvider,
    executor: (req: ChatCompletionRequest, prov: AIProvider) => Promise<ChatCompletionResponse>
  ): Promise<ChatCompletionResponse> {
    const queue = this.getOrCreateQueue(provider);
    queue.setExecutor(executor);
    return queue.enqueue(request, provider);
  }

  /**
   * 获取所有提供商的统计信息
   */
  getAllStats(): Record<AIProvider, QueueStats> {
    const stats: Record<string, QueueStats> = {};
    for (const [provider, queue] of this.limiters) {
      stats[provider] = queue.getStats();
    }
    return stats as Record<AIProvider, QueueStats>;
  }
}

// ==================== 工具函数 ====================

function generateQueueId(): string {
  return `queue_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 创建请求队列
 */
export function createRequestQueue(config?: Partial<QueueConfig>): RequestQueue {
  return new RequestQueue(config);
}

/**
 * 创建提供商速率限制器
 */
export function createProviderRateLimiter(config?: Partial<QueueConfig>): ProviderRateLimiter {
  return new ProviderRateLimiter(config);
}

// ==================== 预设的速率限制配置 ====================

export const RATE_LIMIT_PRESETS: Record<AIProvider, Partial<QueueConfig>> = {
  openai: {
    maxConcurrent: 5,
    rateLimit: { requests: 60, perMilliseconds: 60000 },
  },
  anthropic: {
    maxConcurrent: 4,
    rateLimit: { requests: 50, perMilliseconds: 60000 },
  },
  cerebras: {
    maxConcurrent: 10,
    rateLimit: { requests: 100, perMilliseconds: 60000 },
  },
  glm: {
    maxConcurrent: 5,
    rateLimit: { requests: 60, perMilliseconds: 60000 },
  },
  groq: {
    maxConcurrent: 8,
    rateLimit: { requests: 30, perMilliseconds: 60000 },
  },
  deepseek: {
    maxConcurrent: 5,
    rateLimit: { requests: 60, perMilliseconds: 60000 },
  },
  moonshot: {
    maxConcurrent: 3,
    rateLimit: { requests: 20, perMilliseconds: 60000 },
  },
  qwen: {
    maxConcurrent: 5,
    rateLimit: { requests: 60, perMilliseconds: 60000 },
  },
  minimax: {
    maxConcurrent: 3,
    rateLimit: { requests: 30, perMilliseconds: 60000 },
  },
  google: {
    maxConcurrent: 5,
    rateLimit: { requests: 60, perMilliseconds: 60000 },
  },
  azure: {
    maxConcurrent: 5,
    rateLimit: { requests: 60, perMilliseconds: 60000 },
  },
  mistral: {
    maxConcurrent: 5,
    rateLimit: { requests: 60, perMilliseconds: 60000 },
  },
  cohere: {
    maxConcurrent: 5,
    rateLimit: { requests: 100, perMilliseconds: 60000 },
  },
  together: {
    maxConcurrent: 5,
    rateLimit: { requests: 60, perMilliseconds: 60000 },
  },
  openrouter: {
    maxConcurrent: 5,
    rateLimit: { requests: 60, perMilliseconds: 60000 },
  },
  ollama: {
    maxConcurrent: 1,
    rateLimit: { requests: 10, perMilliseconds: 60000 },
  },
  lmstudio: {
    maxConcurrent: 1,
    rateLimit: { requests: 10, perMilliseconds: 60000 },
  },
  llamacpp: {
    maxConcurrent: 1,
    rateLimit: { requests: 10, perMilliseconds: 60000 },
  },
  vllm: {
    maxConcurrent: 5,
    rateLimit: { requests: 60, perMilliseconds: 60000 },
  },
  custom: {
    maxConcurrent: 5,
    rateLimit: { requests: 60, perMilliseconds: 60000 },
  },
};
