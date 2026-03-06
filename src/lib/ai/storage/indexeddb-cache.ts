/**
 * IndexedDB 缓存实现
 * IndexedDB Cache Implementation
 * 
 * 支持大容量缓存存储，适用于浏览器环境
 */

import type { ChatCompletionResponse } from '../types';
import type { AICache, CacheConfig, CacheEntry, CacheStats } from '../cache';

// ==================== IndexedDB 缓存配置 ====================

export interface IndexedDBCacheConfig extends Partial<CacheConfig> {
    /** 数据库名称 */
    dbName?: string;
    /** 存储对象名称 */
    storeName?: string;
    /** 数据库版本 */
    version?: number;
}

// ==================== IndexedDB 缓存实现 ====================

export class IndexedDBCache implements AICache {
    private dbName: string;
    private storeName: string;
    private version: number;
    private db: IDBDatabase | null = null;
    private config: CacheConfig;
    private stats = { hits: 0, misses: 0 };
    private initPromise: Promise<void> | null = null;

    constructor(config: IndexedDBCacheConfig = {}) {
        this.dbName = config.dbName ?? 'ai-gateway-cache';
        this.storeName = config.storeName ?? 'responses';
        this.version = config.version ?? 1;
        this.config = {
            enabled: config.enabled ?? true,
            ttl: config.ttl ?? 5 * 60 * 1000, // 5 minutes
            maxSize: config.maxSize ?? 500,
            storage: 'indexedDB',
        };
    }

    /**
     * 初始化数据库连接
     */
    async init(): Promise<void> {
        if (this.db) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = new Promise((resolve, reject) => {
            if (typeof indexedDB === 'undefined') {
                reject(new Error('IndexedDB is not available'));
                return;
            }

            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                // 创建存储对象
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
                    store.createIndex('expiresAt', 'expiresAt', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }
            };
        });

        return this.initPromise;
    }

    /**
     * 确保数据库已初始化
     */
    private async ensureDb(): Promise<IDBDatabase> {
        await this.init();
        if (!this.db) {
            throw new Error('IndexedDB not initialized');
        }
        return this.db;
    }

    /**
     * 获取缓存值
     */
    async get(key: string): Promise<ChatCompletionResponse | null> {
        if (!this.config.enabled) return null;

        try {
            const db = await this.ensureDb();

            return new Promise((resolve) => {
                const transaction = db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.get(key);

                request.onerror = () => {
                    this.stats.misses++;
                    resolve(null);
                };

                request.onsuccess = () => {
                    const entry = request.result as CacheEntry<ChatCompletionResponse> & { key: string } | undefined;

                    if (!entry) {
                        this.stats.misses++;
                        resolve(null);
                        return;
                    }

                    // 检查是否过期
                    if (Date.now() > entry.expiresAt) {
                        this.delete(key); // 异步删除过期条目
                        this.stats.misses++;
                        resolve(null);
                        return;
                    }

                    this.stats.hits++;
                    resolve(entry.value);
                };
            });
        } catch {
            this.stats.misses++;
            return null;
        }
    }

    /**
     * 设置缓存值
     */
    async set(key: string, value: ChatCompletionResponse, ttl?: number): Promise<void> {
        if (!this.config.enabled) return;

        try {
            const db = await this.ensureDb();
            const now = Date.now();

            // 检查容量
            const count = await this.count();
            if (count >= this.config.maxSize) {
                await this.evictOldest();
            }

            return new Promise((resolve, reject) => {
                const transaction = db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);

                const entry = {
                    key,
                    value,
                    expiresAt: now + (ttl ?? this.config.ttl),
                    createdAt: now,
                    hits: 0,
                };

                const request = store.put(entry);

                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve();
            });
        } catch {
            // 忽略存储错误
        }
    }

    /**
     * 删除缓存条目
     */
    async delete(key: string): Promise<boolean> {
        try {
            const db = await this.ensureDb();

            return new Promise((resolve) => {
                const transaction = db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const request = store.delete(key);

                request.onerror = () => resolve(false);
                request.onsuccess = () => resolve(true);
            });
        } catch {
            return false;
        }
    }

    /**
     * 清空所有缓存
     */
    async clear(): Promise<void> {
        try {
            const db = await this.ensureDb();

            return new Promise((resolve, reject) => {
                const transaction = db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const request = store.clear();

                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    this.stats = { hits: 0, misses: 0 };
                    resolve();
                };
            });
        } catch {
            // 忽略错误
        }
    }

    /**
     * 检查键是否存在
     */
    async has(key: string): Promise<boolean> {
        const value = await this.get(key);
        return value !== null;
    }

    /**
     * 获取缓存统计
     */
    getStats(): CacheStats {
        const total = this.stats.hits + this.stats.misses;
        return {
            ...this.stats,
            size: 0, // 异步获取，这里返回 0，可通过 count() 获取真实值
            hitRate: total > 0 ? this.stats.hits / total : 0,
        };
    }

    /**
     * 获取缓存条目数量
     */
    async count(): Promise<number> {
        try {
            const db = await this.ensureDb();

            return new Promise((resolve) => {
                const transaction = db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.count();

                request.onerror = () => resolve(0);
                request.onsuccess = () => resolve(request.result);
            });
        } catch {
            return 0;
        }
    }

    /**
     * 清理过期条目
     */
    async cleanup(): Promise<number> {
        try {
            const db = await this.ensureDb();
            const now = Date.now();
            let deletedCount = 0;

            return new Promise((resolve) => {
                const transaction = db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const index = store.index('expiresAt');
                const range = IDBKeyRange.upperBound(now);
                const request = index.openCursor(range);

                request.onsuccess = (event) => {
                    const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                    if (cursor) {
                        cursor.delete();
                        deletedCount++;
                        cursor.continue();
                    }
                };

                transaction.oncomplete = () => resolve(deletedCount);
                transaction.onerror = () => resolve(deletedCount);
            });
        } catch {
            return 0;
        }
    }

    /**
     * 淘汰最旧的条目
     */
    private async evictOldest(): Promise<void> {
        try {
            const db = await this.ensureDb();

            return new Promise((resolve) => {
                const transaction = db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const index = store.index('createdAt');
                const request = index.openCursor();

                request.onsuccess = (event) => {
                    const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                    if (cursor) {
                        cursor.delete();
                        // 只删除一个
                    }
                };

                transaction.oncomplete = () => resolve();
                transaction.onerror = () => resolve();
            });
        } catch {
            // 忽略错误
        }
    }

    /**
     * 关闭数据库连接
     */
    close(): void {
        if (this.db) {
            this.db.close();
            this.db = null;
            this.initPromise = null;
        }
    }
}

// ==================== 工厂函数 ====================

export function createIndexedDBCache(config?: IndexedDBCacheConfig): IndexedDBCache {
    return new IndexedDBCache(config);
}
