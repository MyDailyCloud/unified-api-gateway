/**
 * AI 响应缓存层
 * AI Response Caching Layer
 */

import type { ChatCompletionRequest, ChatCompletionResponse } from './types';

// ==================== 缓存类型 ====================

export interface CacheConfig {
  /** 是否启用缓存 */
  enabled: boolean;
  /** 缓存过期时间（毫秒） */
  ttl: number;
  /** 最大缓存条目数 */
  maxSize: number;
  /** 自定义缓存键生成器 */
  keyGenerator?: (request: ChatCompletionRequest) => string;
  /** 是否缓存流式响应 */
  cacheStreaming?: boolean;
  /** 缓存存储类型 */
  storage?: 'memory' | 'localStorage' | 'indexedDB';
}

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
  hits: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

// ==================== 缓存接口 ====================

export interface AICache {
  get(key: string): Promise<ChatCompletionResponse | null>;
  set(key: string, value: ChatCompletionResponse, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
  getStats(): CacheStats;
}

// ==================== 内存缓存实现 ====================

export class MemoryCache implements AICache {
  private cache = new Map<string, CacheEntry<ChatCompletionResponse>>();
  private stats = { hits: 0, misses: 0 };
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      enabled: true,
      ttl: 5 * 60 * 1000, // 5分钟
      maxSize: 100,
      ...config,
    };
  }

  async get(key: string): Promise<ChatCompletionResponse | null> {
    if (!this.config.enabled) return null;

    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    entry.hits++;
    this.stats.hits++;
    return entry.value;
  }

  async set(key: string, value: ChatCompletionResponse, ttl?: number): Promise<void> {
    if (!this.config.enabled) return;

    // 检查容量，如果满了则删除最旧的条目
    if (this.cache.size >= this.config.maxSize) {
      this.evictOldest();
    }

    const now = Date.now();
    this.cache.set(key, {
      value,
      expiresAt: now + (ttl ?? this.config.ttl),
      createdAt: now,
      hits: 0,
    });
  }

  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * 清理过期条目
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

// ==================== LocalStorage 缓存实现 ====================

export class LocalStorageCache implements AICache {
  private prefix: string;
  private config: CacheConfig;
  private stats = { hits: 0, misses: 0 };

  constructor(config: Partial<CacheConfig> & { prefix?: string } = {}) {
    this.prefix = config.prefix ?? 'ai_cache_';
    this.config = {
      enabled: true,
      ttl: 5 * 60 * 1000,
      maxSize: 50,
      ...config,
    };
  }

  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  async get(key: string): Promise<ChatCompletionResponse | null> {
    if (!this.config.enabled || typeof localStorage === 'undefined') return null;

    try {
      const data = localStorage.getItem(this.getKey(key));
      if (!data) {
        this.stats.misses++;
        return null;
      }

      const entry: CacheEntry<ChatCompletionResponse> = JSON.parse(data);
      if (Date.now() > entry.expiresAt) {
        localStorage.removeItem(this.getKey(key));
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      return entry.value;
    } catch {
      this.stats.misses++;
      return null;
    }
  }

  async set(key: string, value: ChatCompletionResponse, ttl?: number): Promise<void> {
    if (!this.config.enabled || typeof localStorage === 'undefined') return;

    try {
      const now = Date.now();
      const entry: CacheEntry<ChatCompletionResponse> = {
        value,
        expiresAt: now + (ttl ?? this.config.ttl),
        createdAt: now,
        hits: 0,
      };
      localStorage.setItem(this.getKey(key), JSON.stringify(entry));
    } catch (e) {
      // localStorage 满了，清理一些旧数据
      this.cleanup();
    }
  }

  async delete(key: string): Promise<boolean> {
    if (typeof localStorage === 'undefined') return false;
    localStorage.removeItem(this.getKey(key));
    return true;
  }

  async clear(): Promise<void> {
    if (typeof localStorage === 'undefined') return;
    
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.prefix)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    this.stats = { hits: 0, misses: 0 };
  }

  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== null;
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    let size = 0;
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(this.prefix)) {
          size++;
        }
      }
    }
    return {
      ...this.stats,
      size,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  cleanup(): void {
    if (typeof localStorage === 'undefined') return;
    
    const now = Date.now();
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.prefix)) {
        try {
          const data = localStorage.getItem(key);
          if (data) {
            const entry: CacheEntry<ChatCompletionResponse> = JSON.parse(data);
            if (now > entry.expiresAt) {
              localStorage.removeItem(key);
            }
          }
        } catch {
          localStorage.removeItem(key);
        }
      }
    }
  }
}

// ==================== 缓存键生成器 ====================

/**
 * 默认缓存键生成器
 */
export function defaultCacheKeyGenerator(request: ChatCompletionRequest): string {
  const keyData = {
    model: request.model,
    messages: request.messages.map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    })),
    temperature: request.temperature,
    max_tokens: request.max_tokens,
    tools: request.tools?.map(t => t.function.name),
  };
  
  return hashString(JSON.stringify(keyData));
}

/**
 * 简单字符串哈希
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// ==================== 工厂函数 ====================

export function createCache(config?: Partial<CacheConfig>): AICache {
  const storage = config?.storage ?? 'memory';
  
  switch (storage) {
    case 'localStorage':
      return new LocalStorageCache(config);
    case 'memory':
    default:
      return new MemoryCache(config);
  }
}
