/**
 * AI 请求/响应中间件
 * AI Request/Response Middleware
 */

import type { 
  ChatCompletionRequest, 
  ChatCompletionResponse, 
  StreamChunk,
  AIError,
  AIProvider 
} from './types';

// ==================== 中间件类型 ====================

export interface MiddlewareContext {
  provider: AIProvider;
  requestId: string;
  startTime: number;
  metadata?: Record<string, unknown>;
}

export interface AIMiddleware {
  name: string;
  
  /** 请求发送前 */
  onRequest?: (
    request: ChatCompletionRequest, 
    context: MiddlewareContext
  ) => ChatCompletionRequest | Promise<ChatCompletionRequest>;
  
  /** 响应接收后 */
  onResponse?: (
    response: ChatCompletionResponse, 
    context: MiddlewareContext & { duration: number }
  ) => ChatCompletionResponse | Promise<ChatCompletionResponse>;
  
  /** 错误发生时 */
  onError?: (
    error: AIError, 
    context: MiddlewareContext & { retryCount: number }
  ) => void | Promise<void>;
  
  /** 流式数据块 */
  onStream?: (
    chunk: StreamChunk, 
    context: MiddlewareContext
  ) => StreamChunk | Promise<StreamChunk>;
  
  /** 请求完成 */
  onComplete?: (
    context: MiddlewareContext & { 
      duration: number; 
      success: boolean;
      tokensUsed?: { prompt: number; completion: number; total: number };
    }
  ) => void | Promise<void>;
}

// ==================== 中间件管理器 ====================

export class MiddlewareManager {
  private middlewares: AIMiddleware[] = [];

  /**
   * 添加中间件
   */
  use(middleware: AIMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * 移除中间件
   */
  remove(name: string): boolean {
    const index = this.middlewares.findIndex(m => m.name === name);
    if (index !== -1) {
      this.middlewares.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * 执行请求中间件链
   */
  async executeRequest(
    request: ChatCompletionRequest,
    context: MiddlewareContext
  ): Promise<ChatCompletionRequest> {
    let result = request;
    for (const middleware of this.middlewares) {
      if (middleware.onRequest) {
        result = await middleware.onRequest(result, context);
      }
    }
    return result;
  }

  /**
   * 执行响应中间件链
   */
  async executeResponse(
    response: ChatCompletionResponse,
    context: MiddlewareContext & { duration: number }
  ): Promise<ChatCompletionResponse> {
    let result = response;
    for (const middleware of this.middlewares) {
      if (middleware.onResponse) {
        result = await middleware.onResponse(result, context);
      }
    }
    return result;
  }

  /**
   * 执行错误中间件链
   */
  async executeError(
    error: AIError,
    context: MiddlewareContext & { retryCount: number }
  ): Promise<void> {
    for (const middleware of this.middlewares) {
      if (middleware.onError) {
        await middleware.onError(error, context);
      }
    }
  }

  /**
   * 执行流式中间件链
   */
  async executeStream(
    chunk: StreamChunk,
    context: MiddlewareContext
  ): Promise<StreamChunk> {
    let result = chunk;
    for (const middleware of this.middlewares) {
      if (middleware.onStream) {
        result = await middleware.onStream(result, context);
      }
    }
    return result;
  }

  /**
   * 执行完成中间件链
   */
  async executeComplete(
    context: MiddlewareContext & { 
      duration: number; 
      success: boolean;
      tokensUsed?: { prompt: number; completion: number; total: number };
    }
  ): Promise<void> {
    for (const middleware of this.middlewares) {
      if (middleware.onComplete) {
        await middleware.onComplete(context);
      }
    }
  }

  /**
   * 获取所有中间件
   */
  getMiddlewares(): readonly AIMiddleware[] {
    return [...this.middlewares];
  }
}

// ==================== 内置中间件 ====================

/**
 * 日志中间件
 */
export function createLoggingMiddleware(options?: {
  logRequest?: boolean;
  logResponse?: boolean;
  logErrors?: boolean;
  logger?: (message: string, data?: unknown) => void;
}): AIMiddleware {
  const { 
    logRequest = true, 
    logResponse = true, 
    logErrors = true,
    logger = console.log 
  } = options || {};

  return {
    name: 'logging',
    onRequest: (request, context) => {
      if (logRequest) {
        logger(`[AI Request] ${context.requestId}`, {
          provider: context.provider,
          model: request.model,
          messageCount: request.messages.length,
        });
      }
      return request;
    },
    onResponse: (response, context) => {
      if (logResponse) {
        logger(`[AI Response] ${context.requestId}`, {
          provider: context.provider,
          model: response.model,
          duration: context.duration,
          tokens: response.usage,
        });
      }
      return response;
    },
    onError: (error, context) => {
      if (logErrors) {
        logger(`[AI Error] ${context.requestId}`, {
          provider: context.provider,
          code: error.code,
          message: error.message,
          retryCount: context.retryCount,
        });
      }
    },
  };
}

/**
 * 性能监控中间件
 */
export function createPerformanceMiddleware(options?: {
  slowThreshold?: number;
  onSlowRequest?: (context: MiddlewareContext & { duration: number }) => void;
}): AIMiddleware {
  const { slowThreshold = 5000, onSlowRequest } = options || {};

  return {
    name: 'performance',
    onComplete: (context) => {
      if (context.duration > slowThreshold) {
        if (onSlowRequest) {
          onSlowRequest(context);
        } else {
          console.warn(`[Slow AI Request] ${context.requestId} took ${context.duration}ms`);
        }
      }
    },
  };
}

/**
 * 重试中间件（记录重试信息）
 */
export function createRetryMiddleware(options?: {
  onRetry?: (error: AIError, retryCount: number, context: MiddlewareContext) => void;
}): AIMiddleware {
  return {
    name: 'retry',
    onError: (error, context) => {
      if (context.retryCount > 0 && options?.onRetry) {
        options.onRetry(error, context.retryCount, context);
      }
    },
  };
}

/**
 * 创建中间件管理器
 */
export function createMiddlewareManager(): MiddlewareManager {
  return new MiddlewareManager();
}

/**
 * 生成唯一请求 ID
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
