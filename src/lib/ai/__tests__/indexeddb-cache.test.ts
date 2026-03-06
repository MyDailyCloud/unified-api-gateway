/**
 * IndexedDB 缓存单元测试
 * IndexedDB Cache Unit Tests
 * 
 * 注意: IndexedDB 在 Node.js 测试环境中不可用
 * 这里使用 mock 测试类的逻辑
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
    IndexedDBCache,
    createIndexedDBCache,
    type IndexedDBCacheConfig,
} from '../storage/indexeddb-cache';
import type { ChatCompletionResponse } from '../types';

// ==================== Mock Data ====================

const mockResponse: ChatCompletionResponse = {
    id: 'chatcmpl-test',
    object: 'chat.completion',
    created: Date.now(),
    model: 'gpt-4',
    choices: [
        {
            index: 0,
            message: { role: 'assistant', content: 'Hello!' },
            finish_reason: 'stop',
        },
    ],
    usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
    },
};

// ==================== Mock IndexedDB ====================

class MockIDBRequest<T> {
    result: T | undefined;
    error: Error | null = null;
    onsuccess: (() => void) | null = null;
    onerror: (() => void) | null = null;

    success(result: T) {
        this.result = result;
        this.onsuccess?.();
    }

    fail(error: Error) {
        this.error = error;
        this.onerror?.();
    }
}

class MockIDBObjectStore {
    private data = new Map<string, unknown>();

    get(key: string): MockIDBRequest<unknown> {
        const request = new MockIDBRequest<unknown>();
        setTimeout(() => request.success(this.data.get(key)), 0);
        return request;
    }

    put(entry: { key: string;[k: string]: unknown }): MockIDBRequest<void> {
        const request = new MockIDBRequest<void>();
        this.data.set(entry.key, entry);
        setTimeout(() => request.success(undefined), 0);
        return request;
    }

    delete(key: string): MockIDBRequest<void> {
        const request = new MockIDBRequest<void>();
        this.data.delete(key);
        setTimeout(() => request.success(undefined), 0);
        return request;
    }

    clear(): MockIDBRequest<void> {
        const request = new MockIDBRequest<void>();
        this.data.clear();
        setTimeout(() => request.success(undefined), 0);
        return request;
    }

    count(): MockIDBRequest<number> {
        const request = new MockIDBRequest<number>();
        setTimeout(() => request.success(this.data.size), 0);
        return request;
    }

    index(_name: string): MockIDBObjectStore {
        return this;
    }

    openCursor(_range?: IDBKeyRange): MockIDBRequest<IDBCursorWithValue | null> {
        const request = new MockIDBRequest<IDBCursorWithValue | null>();
        setTimeout(() => request.success(null), 0);
        return request;
    }

    createIndex(_name: string, _keyPath: string, _options?: IDBIndexParameters) {
        return this;
    }
}

class MockIDBTransaction {
    private store = new MockIDBObjectStore();
    oncomplete: (() => void) | null = null;
    onerror: (() => void) | null = null;

    objectStore(_name: string): MockIDBObjectStore {
        return this.store;
    }
}

class MockIDBDatabase {
    objectStoreNames = { contains: () => false };

    transaction(_storeNames: string[], _mode?: string): MockIDBTransaction {
        return new MockIDBTransaction();
    }

    createObjectStore(_name: string, _options?: IDBObjectStoreParameters): MockIDBObjectStore {
        return new MockIDBObjectStore();
    }

    close() { }
}

// ==================== IndexedDBCache Tests ====================

describe('IndexedDBCache', () => {
    describe('Constructor and Configuration', () => {
        it('creates with default config', () => {
            const cache = new IndexedDBCache();
            expect(cache).toBeInstanceOf(IndexedDBCache);
        });

        it('accepts custom config', () => {
            const cache = new IndexedDBCache({
                dbName: 'custom-db',
                storeName: 'custom-store',
                version: 2,
                ttl: 10000,
                maxSize: 100,
            });
            expect(cache).toBeInstanceOf(IndexedDBCache);
        });
    });

    describe('Without IndexedDB (Node.js environment)', () => {
        let cache: IndexedDBCache;

        beforeEach(() => {
            cache = new IndexedDBCache();
        });

        it('init() rejects when IndexedDB unavailable', async () => {
            await expect(cache.init()).rejects.toThrow('IndexedDB is not available');
        });

        it('get() returns null when not initialized', async () => {
            const result = await cache.get('test-key');
            expect(result).toBeNull();
        });

        it('set() silently fails when not initialized', async () => {
            await expect(cache.set('key', mockResponse)).resolves.toBeUndefined();
        });

        it('delete() returns false when not initialized', async () => {
            const result = await cache.delete('key');
            expect(result).toBe(false);
        });

        it('has() returns false when not initialized', async () => {
            const result = await cache.has('key');
            expect(result).toBe(false);
        });

        it('count() returns 0 when not initialized', async () => {
            const result = await cache.count();
            expect(result).toBe(0);
        });

        it('cleanup() returns 0 when not initialized', async () => {
            const result = await cache.cleanup();
            expect(result).toBe(0);
        });

        it('clear() resolves when not initialized', async () => {
            await expect(cache.clear()).resolves.toBeUndefined();
        });
    });

    describe('Statistics', () => {
        let cache: IndexedDBCache;

        beforeEach(() => {
            cache = new IndexedDBCache();
        });

        it('tracks hits and misses', async () => {
            // These will be misses since cache is not initialized
            await cache.get('key1');
            await cache.get('key2');
            await cache.get('key3');

            const stats = cache.getStats();
            expect(stats.misses).toBe(3);
            expect(stats.hits).toBe(0);
            expect(stats.hitRate).toBe(0);
        });
    });

    describe('With Mocked IndexedDB', () => {
        let cache: IndexedDBCache;
        let mockDb: MockIDBDatabase;

        beforeEach(() => {
            mockDb = new MockIDBDatabase();

            // Mock indexedDB.open
            const mockOpen = vi.fn(() => {
                const request = {
                    result: mockDb,
                    error: null,
                    onsuccess: null as (() => void) | null,
                    onerror: null as (() => void) | null,
                    onupgradeneeded: null as ((event: unknown) => void) | null,
                };

                setTimeout(() => {
                    request.onsuccess?.();
                }, 0);

                return request;
            });

            vi.stubGlobal('indexedDB', { open: mockOpen });

            cache = new IndexedDBCache();
        });

        afterEach(() => {
            vi.unstubAllGlobals();
            cache.close();
        });

        it('initializes successfully with mocked IndexedDB', async () => {
            await expect(cache.init()).resolves.toBeUndefined();
        });

        it('init() is idempotent', async () => {
            await cache.init();
            await expect(cache.init()).resolves.toBeUndefined();
        });
    });

    describe('close()', () => {
        it('closes database connection', () => {
            const cache = new IndexedDBCache();
            // Should not throw even when no db connection
            expect(() => cache.close()).not.toThrow();
        });
    });

    describe('Disabled Cache', () => {
        it('returns null on get when disabled', async () => {
            const disabledCache = new IndexedDBCache({ enabled: false });
            const result = await disabledCache.get('key');
            expect(result).toBeNull();
        });

        it('does nothing on set when disabled', async () => {
            const disabledCache = new IndexedDBCache({ enabled: false });
            await disabledCache.set('key', mockResponse);
            // Should complete without error
        });
    });
});

// ==================== Factory Function Tests ====================

describe('createIndexedDBCache', () => {
    it('creates an IndexedDBCache instance', () => {
        const cache = createIndexedDBCache();
        expect(cache).toBeInstanceOf(IndexedDBCache);
    });

    it('accepts custom config', () => {
        const cache = createIndexedDBCache({
            dbName: 'test-db',
            ttl: 60000,
        });
        expect(cache).toBeInstanceOf(IndexedDBCache);
    });
});

// ==================== Integration with Cache Interface ====================

describe('IndexedDBCache implements AICache interface', () => {
    it('has all required methods', () => {
        const cache = new IndexedDBCache();

        expect(typeof cache.get).toBe('function');
        expect(typeof cache.set).toBe('function');
        expect(typeof cache.delete).toBe('function');
        expect(typeof cache.clear).toBe('function');
        expect(typeof cache.has).toBe('function');
        expect(typeof cache.getStats).toBe('function');
    });
});
