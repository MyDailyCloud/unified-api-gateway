/**
 * 缓存层单元测试
 * Cache Layer Unit Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
    MemoryCache,
    LocalStorageCache,
    createCache,
    defaultCacheKeyGenerator,
} from '../cache';
import type { ChatCompletionResponse, ChatCompletionRequest } from '../types';

// Mock response for testing
const mockResponse: ChatCompletionResponse = {
    id: 'chatcmpl-test',
    object: 'chat.completion',
    created: Date.now(),
    model: 'gpt-4',
    choices: [
        {
            index: 0,
            message: { role: 'assistant', content: 'Hello, world!' },
            finish_reason: 'stop',
        },
    ],
    usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
    },
};

describe('MemoryCache', () => {
    let cache: MemoryCache;

    beforeEach(() => {
        cache = new MemoryCache({
            ttl: 1000,
            maxSize: 3,
            enabled: true,
        });
    });

    describe('Basic Operations', () => {
        it('stores and retrieves values', async () => {
            await cache.set('key1', mockResponse);
            const result = await cache.get('key1');
            expect(result).toEqual(mockResponse);
        });

        it('returns null for non-existent keys', async () => {
            const result = await cache.get('nonexistent');
            expect(result).toBeNull();
        });

        it('checks if key exists', async () => {
            await cache.set('key1', mockResponse);
            expect(await cache.has('key1')).toBe(true);
            expect(await cache.has('key2')).toBe(false);
        });

        it('deletes keys', async () => {
            await cache.set('key1', mockResponse);
            const deleted = await cache.delete('key1');
            expect(deleted).toBe(true);
            expect(await cache.get('key1')).toBeNull();
        });

        it('clears all entries', async () => {
            await cache.set('key1', mockResponse);
            await cache.set('key2', mockResponse);
            await cache.clear();
            expect(await cache.get('key1')).toBeNull();
            expect(await cache.get('key2')).toBeNull();
        });
    });

    describe('TTL Expiration', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('returns null for expired entries', async () => {
            await cache.set('key1', mockResponse);
            vi.advanceTimersByTime(1001);
            const result = await cache.get('key1');
            expect(result).toBeNull();
        });

        it('respects custom TTL', async () => {
            await cache.set('key1', mockResponse, 500);
            vi.advanceTimersByTime(400);
            expect(await cache.get('key1')).toEqual(mockResponse);
            vi.advanceTimersByTime(200);
            expect(await cache.get('key1')).toBeNull();
        });

        it('cleanup removes expired entries', async () => {
            await cache.set('key1', mockResponse);
            await cache.set('key2', mockResponse, 2000);
            vi.advanceTimersByTime(1001);
            cache.cleanup();
            expect(await cache.has('key1')).toBe(false);
            expect(await cache.has('key2')).toBe(true);
        });
    });

    describe('Capacity Management', () => {
        it('evicts oldest entry when full', async () => {
            await cache.set('key1', mockResponse);
            await cache.set('key2', mockResponse);
            await cache.set('key3', mockResponse);
            await cache.set('key4', mockResponse); // Should evict key1

            expect(await cache.has('key1')).toBe(false);
            expect(await cache.has('key2')).toBe(true);
            expect(await cache.has('key3')).toBe(true);
            expect(await cache.has('key4')).toBe(true);
        });
    });

    describe('Statistics', () => {
        it('tracks hit/miss stats', async () => {
            await cache.set('key1', mockResponse);

            await cache.get('key1'); // Hit
            await cache.get('key1'); // Hit
            await cache.get('key2'); // Miss

            const stats = cache.getStats();
            expect(stats.hits).toBe(2);
            expect(stats.misses).toBe(1);
            expect(stats.hitRate).toBeCloseTo(0.667, 2);
            expect(stats.size).toBe(1);
        });

        it('resets stats on clear', async () => {
            await cache.set('key1', mockResponse);
            await cache.get('key1');
            await cache.clear();

            const stats = cache.getStats();
            expect(stats.hits).toBe(0);
            expect(stats.misses).toBe(0);
        });
    });

    describe('Disabled Cache', () => {
        it('returns null when disabled', async () => {
            const disabledCache = new MemoryCache({ enabled: false });
            await disabledCache.set('key1', mockResponse);
            expect(await disabledCache.get('key1')).toBeNull();
        });
    });
});

describe('LocalStorageCache', () => {
    let cache: LocalStorageCache;
    let mockStorage: { [key: string]: string };

    beforeEach(() => {
        mockStorage = {};

        // Mock localStorage
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => mockStorage[key] || null,
            setItem: (key: string, value: string) => { mockStorage[key] = value; },
            removeItem: (key: string) => { delete mockStorage[key]; },
            clear: () => { mockStorage = {}; },
            key: (index: number) => Object.keys(mockStorage)[index] || null,
            get length() { return Object.keys(mockStorage).length; },
        });

        cache = new LocalStorageCache({
            prefix: 'test_',
            ttl: 1000,
            enabled: true,
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('stores and retrieves values from localStorage', async () => {
        await cache.set('key1', mockResponse);
        const result = await cache.get('key1');
        expect(result).toEqual(mockResponse);
    });

    it('uses prefix for keys', async () => {
        await cache.set('key1', mockResponse);
        expect(mockStorage['test_key1']).toBeDefined();
    });

    it('clears only prefixed keys', async () => {
        mockStorage['other_key'] = 'other_value';
        await cache.set('key1', mockResponse);
        await cache.clear();
        expect(mockStorage['other_key']).toBeDefined();
    });
});

describe('createCache', () => {
    it('creates MemoryCache by default', () => {
        const cache = createCache();
        expect(cache).toBeInstanceOf(MemoryCache);
    });

    it('creates MemoryCache when storage is memory', () => {
        const cache = createCache({ storage: 'memory' });
        expect(cache).toBeInstanceOf(MemoryCache);
    });

    it('creates LocalStorageCache when storage is localStorage', () => {
        vi.stubGlobal('localStorage', {
            getItem: () => null,
            setItem: () => { },
            removeItem: () => { },
            clear: () => { },
            key: () => null,
            length: 0,
        });

        const cache = createCache({ storage: 'localStorage' });
        expect(cache).toBeInstanceOf(LocalStorageCache);

        vi.unstubAllGlobals();
    });
});

describe('defaultCacheKeyGenerator', () => {
    it('generates consistent keys for same request', () => {
        const request: ChatCompletionRequest = {
            model: 'gpt-4',
            messages: [{ role: 'user', content: 'Hello' }],
            temperature: 0.7,
        };

        const key1 = defaultCacheKeyGenerator(request);
        const key2 = defaultCacheKeyGenerator(request);
        expect(key1).toBe(key2);
    });

    it('generates different keys for different requests', () => {
        const request1: ChatCompletionRequest = {
            model: 'gpt-4',
            messages: [{ role: 'user', content: 'Hello' }],
        };

        const request2: ChatCompletionRequest = {
            model: 'gpt-4',
            messages: [{ role: 'user', content: 'Goodbye' }],
        };

        const key1 = defaultCacheKeyGenerator(request1);
        const key2 = defaultCacheKeyGenerator(request2);
        expect(key1).not.toBe(key2);
    });

    it('includes temperature in key', () => {
        const request1: ChatCompletionRequest = {
            model: 'gpt-4',
            messages: [{ role: 'user', content: 'Hello' }],
            temperature: 0.5,
        };

        const request2: ChatCompletionRequest = {
            model: 'gpt-4',
            messages: [{ role: 'user', content: 'Hello' }],
            temperature: 0.9,
        };

        const key1 = defaultCacheKeyGenerator(request1);
        const key2 = defaultCacheKeyGenerator(request2);
        expect(key1).not.toBe(key2);
    });
});
