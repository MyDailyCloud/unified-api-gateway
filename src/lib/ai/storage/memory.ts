/**
 * 内存存储实现
 * Memory Storage Implementation
 * 
 * 适用于开发、测试环境，或临时数据存储
 */

import type { UnifiedStorage, StorageInfo, StorageItem } from './types';

export class MemoryStorage implements UnifiedStorage {
  private store = new Map<string, StorageItem>();
  private cleanupInterval?: ReturnType<typeof setInterval>;

  constructor(options?: { cleanupIntervalMs?: number }) {
    // 自动清理过期项
    if (options?.cleanupIntervalMs) {
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, options.cleanupIntervalMs);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const item = this.store.get(key);
    if (!item) return null;
    
    // 检查过期
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    
    return item.value as T;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const now = Date.now();
    const item: StorageItem<T> = {
      key,
      value,
      createdAt: this.store.get(key)?.createdAt || now,
      updatedAt: now,
      expiresAt: ttl ? now + ttl : undefined,
    };
    this.store.set(key, item);
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async has(key: string): Promise<boolean> {
    const item = this.store.get(key);
    if (!item) return false;
    
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return false;
    }
    
    return true;
  }

  async keys(prefix?: string): Promise<string[]> {
    const allKeys = Array.from(this.store.keys());
    if (!prefix) return allKeys;
    return allKeys.filter(k => k.startsWith(prefix));
  }

  async list<T>(prefix: string): Promise<T[]> {
    const keys = await this.keys(prefix);
    const results: T[] = [];
    
    for (const key of keys) {
      const value = await this.get<T>(key);
      if (value !== null) {
        results.push(value);
      }
    }
    
    return results;
  }

  async getMany<T>(keys: string[]): Promise<(T | null)[]> {
    return Promise.all(keys.map(key => this.get<T>(key)));
  }

  async setMany<T>(entries: Array<[string, T]>): Promise<void> {
    for (const [key, value] of entries) {
      await this.set(key, value);
    }
  }

  async deleteMany(keys: string[]): Promise<number> {
    let deleted = 0;
    for (const key of keys) {
      if (this.store.delete(key)) {
        deleted++;
      }
    }
    return deleted;
  }

  async transaction<T>(fn: (storage: UnifiedStorage) => Promise<T>): Promise<T> {
    // 内存存储没有真正的事务，直接执行
    return fn(this);
  }

  getInfo(): StorageInfo {
    return {
      type: 'memory',
      version: '1.0.0',
      currentSize: this.store.size,
      features: {
        transactions: false,
        ttl: true,
        prefix: true,
        batch: true,
      },
    };
  }

  async close(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.store) {
      if (item.expiresAt && now > item.expiresAt) {
        this.store.delete(key);
      }
    }
  }
}

/**
 * 创建内存存储实例
 */
export function createMemoryStorage(options?: { cleanupIntervalMs?: number }): UnifiedStorage {
  return new MemoryStorage(options);
}
