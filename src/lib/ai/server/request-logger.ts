/**
 * 请求日志记录器
 * Request Logger
 */

/** 请求日志条目 */
export interface RequestLogEntry {
  /** 请求 ID */
  id: string;
  /** 时间戳 */
  timestamp: number;
  /** HTTP 方法 */
  method: string;
  /** 请求路径 */
  path: string;
  /** 状态码 */
  status: number;
  /** 响应时间（毫秒） */
  duration: number;
  /** 客户端 IP */
  clientIp?: string;
  /** User Agent */
  userAgent?: string;
  /** API Key ID（如果有） */
  apiKeyId?: string;
  /** API Key 名称（如果有） */
  apiKeyName?: string;
  /** 请求体大小 */
  requestSize?: number;
  /** 响应体大小 */
  responseSize?: number;
  /** 错误信息 */
  error?: string;
  /** 模型（对于 AI 请求） */
  model?: string;
  /** Token 使用量 */
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  /** 额外元数据 */
  metadata?: Record<string, unknown>;
}

/** 日志过滤条件 */
export interface LogFilter {
  startTime?: number;
  endTime?: number;
  path?: string;
  method?: string;
  status?: number;
  minStatus?: number;
  maxStatus?: number;
  apiKeyId?: string;
  hasError?: boolean;
  limit?: number;
  offset?: number;
}

/** 日志统计 */
export interface LogStats {
  totalRequests: number;
  successRequests: number;
  errorRequests: number;
  avgDuration: number;
  totalTokens: number;
  requestsByPath: Record<string, number>;
  requestsByStatus: Record<number, number>;
  requestsByApiKey: Record<string, number>;
}

/**
 * 请求日志管理器（内存存储）
 */
export class RequestLogger {
  private logs: RequestLogEntry[] = [];
  private maxEntries: number;
  private listeners: Set<(entry: RequestLogEntry) => void> = new Set();

  constructor(maxEntries: number = 10000) {
    this.maxEntries = maxEntries;
  }

  /**
   * 记录请求
   */
  log(entry: Omit<RequestLogEntry, 'id' | 'timestamp'>): RequestLogEntry {
    const fullEntry: RequestLogEntry = {
      ...entry,
      id: this.generateId(),
      timestamp: Date.now(),
    };

    this.logs.push(fullEntry);

    // 限制日志数量
    if (this.logs.length > this.maxEntries) {
      this.logs = this.logs.slice(-this.maxEntries);
    }

    // 通知监听器
    this.listeners.forEach(listener => {
      try {
        listener(fullEntry);
      } catch (error) {
        console.error('Log listener error:', error);
      }
    });

    return fullEntry;
  }

  /**
   * 开始计时（返回结束函数）
   */
  startRequest(info: {
    method: string;
    path: string;
    clientIp?: string;
    userAgent?: string;
    apiKeyId?: string;
    apiKeyName?: string;
    requestSize?: number;
    model?: string;
  }): (result: {
    status: number;
    responseSize?: number;
    error?: string;
    tokens?: RequestLogEntry['tokens'];
    metadata?: Record<string, unknown>;
  }) => RequestLogEntry {
    const startTime = Date.now();

    return (result) => {
      return this.log({
        method: info.method,
        path: info.path,
        clientIp: info.clientIp,
        userAgent: info.userAgent,
        apiKeyId: info.apiKeyId,
        apiKeyName: info.apiKeyName,
        requestSize: info.requestSize,
        model: info.model,
        status: result.status,
        duration: Date.now() - startTime,
        responseSize: result.responseSize,
        error: result.error,
        tokens: result.tokens,
        metadata: result.metadata,
      });
    };
  }

  /**
   * 获取日志
   */
  getLogs(filter?: LogFilter): RequestLogEntry[] {
    let result = [...this.logs];

    if (filter) {
      if (filter.startTime) {
        result = result.filter(log => log.timestamp >= filter.startTime!);
      }
      if (filter.endTime) {
        result = result.filter(log => log.timestamp <= filter.endTime!);
      }
      if (filter.path) {
        result = result.filter(log => log.path.includes(filter.path!));
      }
      if (filter.method) {
        result = result.filter(log => log.method === filter.method);
      }
      if (filter.status !== undefined) {
        result = result.filter(log => log.status === filter.status);
      }
      if (filter.minStatus !== undefined) {
        result = result.filter(log => log.status >= filter.minStatus!);
      }
      if (filter.maxStatus !== undefined) {
        result = result.filter(log => log.status <= filter.maxStatus!);
      }
      if (filter.apiKeyId) {
        result = result.filter(log => log.apiKeyId === filter.apiKeyId);
      }
      if (filter.hasError !== undefined) {
        result = result.filter(log => filter.hasError ? !!log.error : !log.error);
      }
    }

    // 按时间倒序
    result.sort((a, b) => b.timestamp - a.timestamp);

    // 分页
    const offset = filter?.offset ?? 0;
    const limit = filter?.limit ?? 100;
    return result.slice(offset, offset + limit);
  }

  /**
   * 获取统计信息
   */
  getStats(filter?: Pick<LogFilter, 'startTime' | 'endTime' | 'apiKeyId'>): LogStats {
    let logs = [...this.logs];

    if (filter) {
      if (filter.startTime) {
        logs = logs.filter(log => log.timestamp >= filter.startTime!);
      }
      if (filter.endTime) {
        logs = logs.filter(log => log.timestamp <= filter.endTime!);
      }
      if (filter.apiKeyId) {
        logs = logs.filter(log => log.apiKeyId === filter.apiKeyId);
      }
    }

    const stats: LogStats = {
      totalRequests: logs.length,
      successRequests: 0,
      errorRequests: 0,
      avgDuration: 0,
      totalTokens: 0,
      requestsByPath: {},
      requestsByStatus: {},
      requestsByApiKey: {},
    };

    let totalDuration = 0;

    for (const log of logs) {
      // 成功/错误统计
      if (log.status >= 200 && log.status < 400) {
        stats.successRequests++;
      } else {
        stats.errorRequests++;
      }

      // 持续时间
      totalDuration += log.duration;

      // Token 统计
      if (log.tokens) {
        stats.totalTokens += log.tokens.total;
      }

      // 路径统计
      stats.requestsByPath[log.path] = (stats.requestsByPath[log.path] || 0) + 1;

      // 状态码统计
      stats.requestsByStatus[log.status] = (stats.requestsByStatus[log.status] || 0) + 1;

      // API Key 统计
      if (log.apiKeyId) {
        const keyLabel = log.apiKeyName || log.apiKeyId;
        stats.requestsByApiKey[keyLabel] = (stats.requestsByApiKey[keyLabel] || 0) + 1;
      }
    }

    stats.avgDuration = logs.length > 0 ? Math.round(totalDuration / logs.length) : 0;

    return stats;
  }

  /**
   * 清除日志
   */
  clear(filter?: Pick<LogFilter, 'startTime' | 'endTime'>): number {
    const originalCount = this.logs.length;

    if (filter) {
      this.logs = this.logs.filter(log => {
        if (filter.startTime && log.timestamp >= filter.startTime) {
          if (!filter.endTime || log.timestamp <= filter.endTime) {
            return false;
          }
        }
        return true;
      });
    } else {
      this.logs = [];
    }

    return originalCount - this.logs.length;
  }

  /**
   * 添加监听器
   */
  subscribe(listener: (entry: RequestLogEntry) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 导出日志
   */
  export(): RequestLogEntry[] {
    return [...this.logs];
  }

  /**
   * 导入日志
   */
  import(entries: RequestLogEntry[]): void {
    this.logs = [...entries].slice(-this.maxEntries);
  }

  private generateId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

/**
 * 全局请求日志实例
 */
let globalLogger: RequestLogger | null = null;

export function getRequestLogger(maxEntries?: number): RequestLogger {
  if (!globalLogger) {
    globalLogger = new RequestLogger(maxEntries);
  }
  return globalLogger;
}

export function createRequestLogger(maxEntries?: number): RequestLogger {
  return new RequestLogger(maxEntries);
}
