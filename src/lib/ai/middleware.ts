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

// ==================== 结构化日志中间件 ====================

export interface StructuredLogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  requestId: string;
  provider: string;
  event: 'request' | 'response' | 'error' | 'stream' | 'complete';
  duration?: number;
  model?: string;
  tokens?: { prompt: number; completion: number; total: number };
  error?: { code: string; message: string };
  metadata?: Record<string, unknown>;
}

export interface StructuredLoggingConfig {
  /** 日志级别 */
  level: 'debug' | 'info' | 'warn' | 'error';
  /** 输出格式 */
  format: 'json' | 'text';
  /** 敏感字段脱敏 */
  redactKeys?: string[];
  /** 是否记录消息内容 */
  logContent?: boolean;
  /** 自定义日志输出 */
  logger?: (entry: StructuredLogEntry) => void;
}

/**
 * 创建结构化日志中间件
 * 
 * @example
 * const loggingMiddleware = createStructuredLoggingMiddleware({
 *   level: 'info',
 *   format: 'json',
 *   redactKeys: ['api_key', 'authorization'],
 * });
 */
export function createStructuredLoggingMiddleware(options?: Partial<StructuredLoggingConfig>): AIMiddleware {
  const config: StructuredLoggingConfig = {
    level: options?.level ?? 'info',
    format: options?.format ?? 'text',
    redactKeys: options?.redactKeys ?? ['api_key', 'apiKey', 'authorization', 'token'],
    logContent: options?.logContent ?? false,
    logger: options?.logger,
  };

  const levelPriority: Record<string, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  const shouldLog = (level: 'debug' | 'info' | 'warn' | 'error'): boolean => {
    return levelPriority[level] >= levelPriority[config.level];
  };

  const redact = (obj: Record<string, unknown>): Record<string, unknown> => {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (config.redactKeys?.some(k => key.toLowerCase().includes(k.toLowerCase()))) {
        result[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        result[key] = redact(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }
    return result;
  };

  const log = (entry: StructuredLogEntry): void => {
    if (!shouldLog(entry.level)) return;

    if (config.logger) {
      config.logger(entry);
      return;
    }

    if (config.format === 'json') {
      console.log(JSON.stringify(redact(entry as unknown as Record<string, unknown>)));
    } else {
      const parts = [
        `[${entry.timestamp}]`,
        `[${entry.level.toUpperCase()}]`,
        `[${entry.requestId}]`,
        `[${entry.provider}]`,
        entry.event,
      ];

      if (entry.model) parts.push(`model=${entry.model}`);
      if (entry.duration !== undefined) parts.push(`duration=${entry.duration}ms`);
      if (entry.tokens) parts.push(`tokens=${entry.tokens.total}`);
      if (entry.error) parts.push(`error=${entry.error.code}: ${entry.error.message}`);

      const message = parts.join(' ');

      switch (entry.level) {
        case 'debug': console.debug(message); break;
        case 'info': console.info(message); break;
        case 'warn': console.warn(message); break;
        case 'error': console.error(message); break;
      }
    }
  };

  return {
    name: 'structured-logging',

    onRequest: (request, context) => {
      log({
        timestamp: new Date().toISOString(),
        level: 'info',
        requestId: context.requestId,
        provider: context.provider,
        event: 'request',
        model: request.model,
        metadata: {
          messageCount: request.messages.length,
          hasTools: !!request.tools?.length,
          stream: request.stream,
        },
      });
      return request;
    },

    onResponse: (response, context) => {
      log({
        timestamp: new Date().toISOString(),
        level: 'info',
        requestId: context.requestId,
        provider: context.provider,
        event: 'response',
        duration: context.duration,
        model: response.model,
        tokens: response.usage ? {
          prompt: response.usage.prompt_tokens,
          completion: response.usage.completion_tokens,
          total: response.usage.total_tokens,
        } : undefined,
      });
      return response;
    },

    onError: (error, context) => {
      log({
        timestamp: new Date().toISOString(),
        level: 'error',
        requestId: context.requestId,
        provider: context.provider,
        event: 'error',
        error: {
          code: error.code || 'unknown',
          message: error.message,
        },
        metadata: {
          retryCount: context.retryCount,
          retryable: error.retryable,
        },
      });
    },

    onComplete: (context) => {
      log({
        timestamp: new Date().toISOString(),
        level: 'debug',
        requestId: context.requestId,
        provider: context.provider,
        event: 'complete',
        duration: context.duration,
        tokens: context.tokensUsed,
        metadata: {
          success: context.success,
        },
      });
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
