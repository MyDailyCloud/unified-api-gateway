/**
 * 内存速率限制器
 * In-Memory Rate Limiter
 */

/** 速率限制配置 */
export interface RateLimitConfig {
  /** 窗口大小（毫秒） */
  windowMs: number;
  /** 窗口内最大请求数 */
  maxRequests: number;
}

/** 速率限制结果 */
export interface RateLimitResult {
  /** 是否允许请求 */
  allowed: boolean;
  /** 剩余请求数 */
  remaining: number;
  /** 重置时间（毫秒时间戳） */
  resetAt: number;
  /** 当前窗口请求数 */
  current: number;
  /** 限制（每窗口最大请求数） */
  limit: number;
  /** 重试等待时间（毫秒，仅在被限制时） */
  retryAfter?: number;
}

/** 滑动窗口条目 */
interface WindowEntry {
  timestamps: number[];
  lastCleanup: number;
}

/**
 * 滑动窗口速率限制器
 */
export class RateLimiter {
  private windows: Map<string, WindowEntry> = new Map();
  private defaultConfig: RateLimitConfig;
  private keyConfigs: Map<string, RateLimitConfig> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(defaultConfig: RateLimitConfig = { windowMs: 60000, maxRequests: 60 }) {
    this.defaultConfig = defaultConfig;
    this.startCleanup();
  }

  /**
   * 检查并记录请求
   */
  check(key: string, config?: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    const effectiveConfig = config || this.keyConfigs.get(key) || this.defaultConfig;
    const { windowMs, maxRequests } = effectiveConfig;
    const windowStart = now - windowMs;

    // 获取或创建窗口条目
    let entry = this.windows.get(key);
    if (!entry) {
      entry = { timestamps: [], lastCleanup: now };
      this.windows.set(key, entry);
    }

    // 清理过期的时间戳
    entry.timestamps = entry.timestamps.filter(ts => ts > windowStart);
    entry.lastCleanup = now;

    const current = entry.timestamps.length;
    const allowed = current < maxRequests;
    const resetAt = entry.timestamps.length > 0 
      ? entry.timestamps[0] + windowMs 
      : now + windowMs;

    if (allowed) {
      entry.timestamps.push(now);
    }

    return {
      allowed,
      remaining: Math.max(0, maxRequests - entry.timestamps.length),
      resetAt,
      current: entry.timestamps.length,
      limit: maxRequests,
      retryAfter: allowed ? undefined : resetAt - now,
    };
  }

  /**
   * 仅检查不记录
   */
  peek(key: string, config?: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    const effectiveConfig = config || this.keyConfigs.get(key) || this.defaultConfig;
    const { windowMs, maxRequests } = effectiveConfig;
    const windowStart = now - windowMs;

    const entry = this.windows.get(key);
    if (!entry) {
      return {
        allowed: true,
        remaining: maxRequests,
        resetAt: now + windowMs,
        current: 0,
        limit: maxRequests,
      };
    }

    const validTimestamps = entry.timestamps.filter(ts => ts > windowStart);
    const current = validTimestamps.length;

    return {
      allowed: current < maxRequests,
      remaining: Math.max(0, maxRequests - current),
      resetAt: validTimestamps.length > 0 ? validTimestamps[0] + windowMs : now + windowMs,
      current,
      limit: maxRequests,
      retryAfter: current >= maxRequests 
        ? (validTimestamps[0] + windowMs - now) 
        : undefined,
    };
  }

  /**
   * 设置特定 key 的配置
   */
  setKeyConfig(key: string, config: RateLimitConfig): void {
    this.keyConfigs.set(key, config);
  }

  /**
   * 移除特定 key 的配置
   */
  removeKeyConfig(key: string): void {
    this.keyConfigs.delete(key);
  }

  /**
   * 重置特定 key 的计数
   */
  reset(key: string): void {
    this.windows.delete(key);
  }

  /**
   * 获取所有活跃 key 的状态
   */
  getStatus(): Map<string, RateLimitResult> {
    const status = new Map<string, RateLimitResult>();
    for (const key of this.windows.keys()) {
      status.set(key, this.peek(key));
    }
    return status;
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    activeKeys: number;
    totalRequests: number;
    blockedKeys: number;
  } {
    let totalRequests = 0;
    let blockedKeys = 0;
    const now = Date.now();

    for (const [key, entry] of this.windows.entries()) {
      const config = this.keyConfigs.get(key) || this.defaultConfig;
      const windowStart = now - config.windowMs;
      const validTimestamps = entry.timestamps.filter(ts => ts > windowStart);
      totalRequests += validTimestamps.length;
      
      if (validTimestamps.length >= config.maxRequests) {
        blockedKeys++;
      }
    }

    return {
      activeKeys: this.windows.size,
      totalRequests,
      blockedKeys,
    };
  }

  /**
   * 清理过期数据
   */
  cleanup(): void {
    const now = Date.now();
    const maxWindowMs = Math.max(
      this.defaultConfig.windowMs,
      ...Array.from(this.keyConfigs.values()).map(c => c.windowMs)
    );

    for (const [key, entry] of this.windows.entries()) {
      const config = this.keyConfigs.get(key) || this.defaultConfig;
      const windowStart = now - config.windowMs;
      
      entry.timestamps = entry.timestamps.filter(ts => ts > windowStart);
      
      // 如果超过 2 个窗口时间没有请求，删除条目
      if (entry.timestamps.length === 0 && now - entry.lastCleanup > maxWindowMs * 2) {
        this.windows.delete(key);
      }
    }
  }

  /**
   * 启动自动清理
   */
  private startCleanup(): void {
    if (this.cleanupInterval) return;
    
    // 每分钟清理一次
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);

    // 确保不阻止进程退出
    if (typeof this.cleanupInterval === 'object' && 'unref' in this.cleanupInterval) {
      (this.cleanupInterval as NodeJS.Timeout).unref();
    }
  }

  /**
   * 停止自动清理
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * 销毁限制器
   */
  destroy(): void {
    this.stopCleanup();
    this.windows.clear();
    this.keyConfigs.clear();
  }
}

/**
 * 创建 API Key 专用速率限制器
 */
export class ApiKeyRateLimiter {
  private limiter: RateLimiter;
  private defaultRpm: number;

  constructor(defaultRpm: number = 60) {
    this.defaultRpm = defaultRpm;
    this.limiter = new RateLimiter({
      windowMs: 60000,
      maxRequests: defaultRpm,
    });
  }

  /**
   * 检查 API Key 请求
   */
  checkApiKey(apiKeyId: string, customRpm?: number): RateLimitResult {
    const config = customRpm 
      ? { windowMs: 60000, maxRequests: customRpm }
      : undefined;
    return this.limiter.check(`apikey:${apiKeyId}`, config);
  }

  /**
   * 设置 API Key 的速率限制
   */
  setApiKeyLimit(apiKeyId: string, rpm: number): void {
    this.limiter.setKeyConfig(`apikey:${apiKeyId}`, {
      windowMs: 60000,
      maxRequests: rpm,
    });
  }

  /**
   * 移除 API Key 的速率限制配置
   */
  removeApiKeyLimit(apiKeyId: string): void {
    this.limiter.removeKeyConfig(`apikey:${apiKeyId}`);
  }

  /**
   * 重置 API Key 的计数
   */
  resetApiKey(apiKeyId: string): void {
    this.limiter.reset(`apikey:${apiKeyId}`);
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return this.limiter.getStats();
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.limiter.destroy();
  }
}

/**
 * 全局速率限制器实例
 */
let globalRateLimiter: RateLimiter | null = null;
let globalApiKeyRateLimiter: ApiKeyRateLimiter | null = null;

export function getRateLimiter(config?: RateLimitConfig): RateLimiter {
  if (!globalRateLimiter) {
    globalRateLimiter = new RateLimiter(config);
  }
  return globalRateLimiter;
}

export function getApiKeyRateLimiter(defaultRpm?: number): ApiKeyRateLimiter {
  if (!globalApiKeyRateLimiter) {
    globalApiKeyRateLimiter = new ApiKeyRateLimiter(defaultRpm);
  }
  return globalApiKeyRateLimiter;
}

export function createRateLimiter(config?: RateLimitConfig): RateLimiter {
  return new RateLimiter(config);
}

export function createApiKeyRateLimiter(defaultRpm?: number): ApiKeyRateLimiter {
  return new ApiKeyRateLimiter(defaultRpm);
}
