/**
 * 断路器中间件
 * Circuit Breaker Middleware
 * 
 * 防止级联故障，在服务不可用时快速失败
 */

import type { 
  AIMiddleware, 
  MiddlewareContext 
} from './middleware';
import type { 
  ChatCompletionRequest, 
  ChatCompletionResponse,
  AIError,
  AIProvider 
} from './types';

// ==================== 断路器状态 ====================

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  /** 连续失败次数阈值，达到后开启断路器 */
  failureThreshold: number;
  /** 断路器打开后的恢复超时时间（毫秒） */
  recoveryTimeout: number;
  /** 半开状态允许的测试请求数 */
  halfOpenRequests: number;
  /** 可被断路器处理的错误类型 */
  tripOnErrors?: string[];
  /** 当断路器打开时的回退响应 */
  fallbackResponse?: ChatCompletionResponse;
  /** 状态变更回调 */
  onStateChange?: (provider: AIProvider, oldState: CircuitState, newState: CircuitState) => void;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  openedAt: number | null;
  halfOpenRequests: number;
}

// ==================== 断路器实现 ====================

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private successes = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private openedAt: number | null = null;
  private halfOpenRequestCount = 0;
  private config: Required<CircuitBreakerConfig>;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      recoveryTimeout: config.recoveryTimeout ?? 30000,
      halfOpenRequests: config.halfOpenRequests ?? 1,
      tripOnErrors: config.tripOnErrors ?? ['rate_limit', 'server_error', 'timeout', 'network_error'],
      fallbackResponse: config.fallbackResponse ?? undefined as any,
      onStateChange: config.onStateChange ?? (() => {}),
    };
  }

  /**
   * 检查是否允许请求通过
   */
  canPass(): boolean {
    this.checkStateTransition();
    
    switch (this.state) {
      case 'closed':
        return true;
      case 'open':
        return false;
      case 'half-open':
        return this.halfOpenRequestCount < this.config.halfOpenRequests;
      default:
        return true;
    }
  }

  /**
   * 记录成功
   */
  recordSuccess(): void {
    this.successes++;
    this.lastSuccessTime = Date.now();
    this.failures = 0;
    
    if (this.state === 'half-open') {
      this.halfOpenRequestCount++;
      if (this.halfOpenRequestCount >= this.config.halfOpenRequests) {
        this.transitionTo('closed');
      }
    }
  }

  /**
   * 记录失败
   */
  recordFailure(errorCode?: string): void {
    // 检查是否是可触发断路的错误
    if (errorCode && this.config.tripOnErrors.length > 0) {
      if (!this.config.tripOnErrors.includes(errorCode)) {
        return; // 忽略非触发错误
      }
    }
    
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.state === 'half-open') {
      // 半开状态下失败，直接回到打开
      this.transitionTo('open');
    } else if (this.state === 'closed' && this.failures >= this.config.failureThreshold) {
      // 达到失败阈值，打开断路器
      this.transitionTo('open');
    }
  }

  /**
   * 获取当前状态
   */
  getState(): CircuitState {
    this.checkStateTransition();
    return this.state;
  }

  /**
   * 获取统计信息
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      openedAt: this.openedAt,
      halfOpenRequests: this.halfOpenRequestCount,
    };
  }

  /**
   * 重置断路器
   */
  reset(): void {
    const oldState = this.state;
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    this.openedAt = null;
    this.halfOpenRequestCount = 0;
    
    if (oldState !== 'closed') {
      this.config.onStateChange?.({} as AIProvider, oldState, 'closed');
    }
  }

  /**
   * 检查状态转换
   */
  private checkStateTransition(): void {
    if (this.state === 'open' && this.openedAt) {
      const elapsed = Date.now() - this.openedAt;
      if (elapsed >= this.config.recoveryTimeout) {
        this.transitionTo('half-open');
      }
    }
  }

  /**
   * 状态转换
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    
    if (newState === 'open') {
      this.openedAt = Date.now();
      this.halfOpenRequestCount = 0;
    } else if (newState === 'half-open') {
      this.halfOpenRequestCount = 0;
    } else if (newState === 'closed') {
      this.failures = 0;
      this.openedAt = null;
      this.halfOpenRequestCount = 0;
    }
    
    this.config.onStateChange?.({} as AIProvider, oldState, newState);
  }
}

// ==================== 提供商级别断路器管理 ====================

export class CircuitBreakerManager {
  private breakers = new Map<AIProvider, CircuitBreaker>();
  private config: Partial<CircuitBreakerConfig>;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = config ?? {};
  }

  /**
   * 获取或创建断路器
   */
  getBreaker(provider: AIProvider): CircuitBreaker {
    let breaker = this.breakers.get(provider);
    if (!breaker) {
      breaker = new CircuitBreaker({
        ...this.config,
        onStateChange: (_, oldState, newState) => {
          console.log(`[CircuitBreaker] ${provider}: ${oldState} → ${newState}`);
          this.config.onStateChange?.(provider, oldState, newState);
        },
      });
      this.breakers.set(provider, breaker);
    }
    return breaker;
  }

  /**
   * 获取所有断路器状态
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    for (const [provider, breaker] of this.breakers) {
      stats[provider] = breaker.getStats();
    }
    return stats;
  }

  /**
   * 重置所有断路器
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}

// ==================== 断路器中间件 ====================

/**
 * 创建断路器中间件
 * 
 * @example
 * const circuitBreakerMiddleware = createCircuitBreakerMiddleware({
 *   failureThreshold: 5,
 *   recoveryTimeout: 30000,
 *   onStateChange: (provider, oldState, newState) => {
 *     console.log(`${provider}: ${oldState} → ${newState}`);
 *   },
 * });
 * 
 * middlewareManager.use(circuitBreakerMiddleware);
 */
export function createCircuitBreakerMiddleware(
  config?: Partial<CircuitBreakerConfig>
): AIMiddleware & { manager: CircuitBreakerManager } {
  const manager = new CircuitBreakerManager(config);

  const middleware: AIMiddleware & { manager: CircuitBreakerManager } = {
    name: 'circuit-breaker',
    manager,

    onRequest: (request, context) => {
      const breaker = manager.getBreaker(context.provider);
      
      if (!breaker.canPass()) {
        // 断路器打开，抛出错误
        const error: AIError = {
          code: 'circuit_open',
          message: `Circuit breaker is open for provider: ${context.provider}. Service temporarily unavailable.`,
          provider: context.provider,
          retryable: false,
        };
        throw error;
      }
      
      return request;
    },

    onResponse: (response, context) => {
      const breaker = manager.getBreaker(context.provider);
      breaker.recordSuccess();
      return response;
    },

    onError: (error, context) => {
      const breaker = manager.getBreaker(context.provider);
      breaker.recordFailure(error.code);
    },
  };

  return middleware;
}

// ==================== 智能重试中间件 ====================

export interface RetryWithBackoffConfig {
  /** 最大重试次数 */
  maxRetries: number;
  /** 基础延迟时间（毫秒） */
  baseDelay: number;
  /** 最大延迟时间（毫秒） */
  maxDelay: number;
  /** 可重试的错误码 */
  retryableErrors: string[];
  /** 抖动因子 (0-1)，用于避免重试风暴 */
  jitter: number;
  /** 重试回调 */
  onRetry?: (error: AIError, attempt: number, delay: number) => void;
}

/**
 * 计算指数退避延迟
 */
function calculateBackoffDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  jitter: number
): number {
  // 指数退避: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, maxDelay);
  
  // 添加抖动
  const jitterAmount = cappedDelay * jitter * Math.random();
  
  return Math.floor(cappedDelay + jitterAmount);
}

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 创建智能重试中间件
 * 
 * @example
 * const retryMiddleware = createRetryWithBackoffMiddleware({
 *   maxRetries: 3,
 *   baseDelay: 1000,
 *   maxDelay: 30000,
 *   retryableErrors: ['rate_limit', 'timeout', 'server_error'],
 * });
 */
export function createRetryWithBackoffMiddleware(
  config?: Partial<RetryWithBackoffConfig>
): AIMiddleware {
  const opts: Required<RetryWithBackoffConfig> = {
    maxRetries: config?.maxRetries ?? 3,
    baseDelay: config?.baseDelay ?? 1000,
    maxDelay: config?.maxDelay ?? 30000,
    retryableErrors: config?.retryableErrors ?? ['rate_limit', 'timeout', 'server_error', 'network_error'],
    jitter: config?.jitter ?? 0.2,
    onRetry: config?.onRetry ?? ((error, attempt, delay) => {
      console.log(`[Retry] Attempt ${attempt} after ${delay}ms: ${error.message}`);
    }),
  };

  // 存储重试信息
  const retryMap = new Map<string, { attempt: number; shouldRetry: boolean }>();

  return {
    name: 'retry-with-backoff',

    onRequest: async (request, context) => {
      // 初始化重试信息
      if (!retryMap.has(context.requestId)) {
        retryMap.set(context.requestId, { attempt: 0, shouldRetry: false });
      }
      return request;
    },

    onError: async (error, context) => {
      const retryInfo = retryMap.get(context.requestId) || { attempt: 0, shouldRetry: false };
      
      // 检查是否可重试
      const isRetryable = opts.retryableErrors.includes(error.code || '');
      const hasRetriesLeft = retryInfo.attempt < opts.maxRetries;
      
      if (isRetryable && hasRetriesLeft) {
        retryInfo.attempt++;
        retryInfo.shouldRetry = true;
        retryMap.set(context.requestId, retryInfo);
        
        // 计算退避延迟
        const backoffDelay = calculateBackoffDelay(
          retryInfo.attempt,
          opts.baseDelay,
          opts.maxDelay,
          opts.jitter
        );
        
        opts.onRetry(error, retryInfo.attempt, backoffDelay);
        
        // 执行延迟
        await delay(backoffDelay);
      }
    },

    onComplete: (context) => {
      // 清理重试信息
      retryMap.delete(context.requestId);
    },
  };
}

// ==================== 工厂函数 ====================

let globalCircuitBreakerManager: CircuitBreakerManager | null = null;

/**
 * 获取全局断路器管理器
 */
export function getCircuitBreakerManager(): CircuitBreakerManager {
  if (!globalCircuitBreakerManager) {
    globalCircuitBreakerManager = new CircuitBreakerManager();
  }
  return globalCircuitBreakerManager;
}

/**
 * 设置全局断路器管理器
 */
export function setCircuitBreakerManager(manager: CircuitBreakerManager): void {
  globalCircuitBreakerManager = manager;
}
