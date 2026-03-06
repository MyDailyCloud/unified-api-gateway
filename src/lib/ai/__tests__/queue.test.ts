/**
 * 请求队列单元测试
 * Request Queue Unit Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
    RequestQueue,
    ProviderRateLimiter,
    createRequestQueue,
    createProviderRateLimiter,
    RATE_LIMIT_PRESETS,
    type QueueConfig,
} from '../queue';
import type { ChatCompletionRequest, ChatCompletionResponse } from '../types';

// ==================== Mock Data ====================

const mockRequest: ChatCompletionRequest = {
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello' }],
};

const mockResponse: ChatCompletionResponse = {
    id: 'chatcmpl-test',
    object: 'chat.completion',
    created: Date.now(),
    model: 'gpt-4',
    choices: [
        {
            index: 0,
            message: { role: 'assistant', content: 'Hi!' },
            finish_reason: 'stop',
        },
    ],
    usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
};

const createMockExecutor = (delay = 0, shouldFail = false) => {
    return vi.fn(async (): Promise<ChatCompletionResponse> => {
        if (delay > 0) {
            await new Promise(r => setTimeout(r, delay));
        }
        if (shouldFail) {
            throw new Error('Mock executor failed');
        }
        return mockResponse;
    });
};

// ==================== RequestQueue Tests ====================

describe('RequestQueue', () => {
    let queue: RequestQueue;
    let executor: ReturnType<typeof createMockExecutor>;

    beforeEach(() => {
        queue = new RequestQueue({ maxConcurrent: 2, timeout: 5000 });
        executor = createMockExecutor();
        queue.setExecutor(executor);
    });

    describe('Basic Operations', () => {
        it('creates with default config', () => {
            const defaultQueue = new RequestQueue();
            expect(defaultQueue.length).toBe(0);
            expect(defaultQueue.active).toBe(0);
        });

        it('enqueues and processes requests', async () => {
            const result = await queue.enqueue(mockRequest, 'openai');
            expect(result).toEqual(mockResponse);
            expect(executor).toHaveBeenCalledTimes(1);
        });

        it('processes multiple requests', async () => {
            const promises = [
                queue.enqueue(mockRequest, 'openai'),
                queue.enqueue(mockRequest, 'openai'),
                queue.enqueue(mockRequest, 'openai'),
            ];

            const results = await Promise.all(promises);
            expect(results).toHaveLength(3);
            expect(executor).toHaveBeenCalledTimes(3);
        });
    });

    describe('Concurrency Control', () => {
        it('respects maxConcurrent limit', async () => {
            const slowExecutor = createMockExecutor(50);
            queue.setExecutor(slowExecutor);

            // Start 5 requests with max concurrent of 2
            const promises = Array(5).fill(null).map(() =>
                queue.enqueue(mockRequest, 'openai')
            );

            // Give some time for processing to start
            await new Promise(r => setTimeout(r, 10));

            // Should have exactly 2 active
            expect(queue.active).toBe(2);

            await Promise.all(promises);
        });

        it('tracks active and pending counts correctly', async () => {
            const slowExecutor = createMockExecutor(50);
            queue.setExecutor(slowExecutor);

            const promises = Array(4).fill(null).map(() =>
                queue.enqueue(mockRequest, 'openai')
            );

            await new Promise(r => setTimeout(r, 10));

            const stats = queue.getStats();
            expect(stats.active).toBe(2);
            expect(stats.pending).toBe(2);

            await Promise.all(promises);
        });
    });

    describe('Queue Statistics', () => {
        it('tracks completed requests', async () => {
            await queue.enqueue(mockRequest, 'openai');
            await queue.enqueue(mockRequest, 'openai');

            const stats = queue.getStats();
            expect(stats.completed).toBe(2);
            expect(stats.failed).toBe(0);
        });

        it('tracks failed requests', async () => {
            const failingExecutor = createMockExecutor(0, true);
            queue.setExecutor(failingExecutor);

            try {
                await queue.enqueue(mockRequest, 'openai');
            } catch {
                // Expected
            }

            const stats = queue.getStats();
            expect(stats.failed).toBe(1);
        });

        it('calculates average times', async () => {
            const slowExecutor = createMockExecutor(20);
            queue.setExecutor(slowExecutor);

            await queue.enqueue(mockRequest, 'openai');

            const stats = queue.getStats();
            expect(stats.averageProcessTime).toBeGreaterThan(0);
            expect(stats.averageWaitTime).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Queue Full', () => {
        it('throws when queue is full', async () => {
            const smallQueue = new RequestQueue({ maxQueueSize: 2, maxConcurrent: 1 });
            const slowExecutor = createMockExecutor(100);
            smallQueue.setExecutor(slowExecutor);

            // First request starts processing immediately
            smallQueue.enqueue(mockRequest, 'openai');

            // These go to queue
            smallQueue.enqueue(mockRequest, 'openai');
            smallQueue.enqueue(mockRequest, 'openai');

            // This should throw
            await expect(
                smallQueue.enqueue(mockRequest, 'openai')
            ).rejects.toThrow('Queue is full');
        });
    });

    describe('Queue Clear', () => {
        it('rejects all pending requests when cleared', async () => {
            const slowExecutor = createMockExecutor(100);
            queue.setExecutor(slowExecutor);

            const promises = Array(4).fill(null).map(() =>
                queue.enqueue(mockRequest, 'openai').catch(e => e.message)
            );

            await new Promise(r => setTimeout(r, 10));

            queue.clear();

            const results = await Promise.all(promises);
            const cleared = results.filter(r => r === 'Queue cleared');
            expect(cleared.length).toBeGreaterThan(0);
        });
    });

    describe('Pause and Resume', () => {
        it('pauses queue processing', () => {
            queue.pause();
            expect(queue.isPaused).toBe(true);
        });

        it('resumes queue processing', () => {
            queue.pause();
            queue.resume();
            expect(queue.isPaused).toBe(false);
        });
    });

    describe('No Executor', () => {
        it('throws when no executor is set', async () => {
            const noExecQueue = new RequestQueue();

            await expect(
                noExecQueue.enqueue(mockRequest, 'openai')
            ).rejects.toThrow('No executor set for queue');
        });
    });

    describe('Priority', () => {
        it('processes higher priority requests first', async () => {
            const callOrder: string[] = [];
            const slowExecutor = vi.fn(async (req: ChatCompletionRequest) => {
                callOrder.push(req.model);
                return mockResponse;
            });

            const priorityQueue = new RequestQueue({
                maxConcurrent: 1,
                priority: (qr) => {
                    // Higher model name = higher priority
                    return qr.request.model === 'high' ? 10 : 1;
                },
            });
            priorityQueue.setExecutor(slowExecutor);

            // Enqueue low priority first, then high
            const lowReq = { ...mockRequest, model: 'low' };
            const highReq = { ...mockRequest, model: 'high' };

            const p1 = priorityQueue.enqueue(lowReq, 'openai');
            const p2 = priorityQueue.enqueue(highReq, 'openai');
            const p3 = priorityQueue.enqueue(lowReq, 'openai');

            await Promise.all([p1, p2, p3]);

            // First request (low) was already processing, then high should be next
            expect(callOrder[1]).toBe('high');
        });
    });

    describe('Rate Limiting', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('respects rate limit configuration', async () => {
            const rateLimitedQueue = new RequestQueue({
                maxConcurrent: 10,
                rateLimit: { requests: 2, perMilliseconds: 1000 },
            });
            rateLimitedQueue.setExecutor(executor);

            // First two should process immediately
            const p1 = rateLimitedQueue.enqueue(mockRequest, 'openai');
            const p2 = rateLimitedQueue.enqueue(mockRequest, 'openai');

            await vi.advanceTimersByTimeAsync(10);

            await p1;
            await p2;

            expect(executor).toHaveBeenCalledTimes(2);
        });
    });
});

// ==================== ProviderRateLimiter Tests ====================

describe('ProviderRateLimiter', () => {
    let limiter: ProviderRateLimiter;
    let executor: ReturnType<typeof createMockExecutor>;

    beforeEach(() => {
        limiter = new ProviderRateLimiter({ maxConcurrent: 2 });
        executor = createMockExecutor();
    });

    it('creates separate queues per provider', async () => {
        await limiter.request(mockRequest, 'openai', executor);
        await limiter.request(mockRequest, 'anthropic', executor);

        const stats = limiter.getAllStats();
        expect(Object.keys(stats)).toContain('openai');
        expect(Object.keys(stats)).toContain('anthropic');
    });

    it('tracks stats per provider', async () => {
        await limiter.request(mockRequest, 'openai', executor);
        await limiter.request(mockRequest, 'openai', executor);
        await limiter.request(mockRequest, 'anthropic', executor);

        const stats = limiter.getAllStats();
        expect(stats['openai'].completed).toBe(2);
        expect(stats['anthropic'].completed).toBe(1);
    });

    it('allows setting provider-specific config', () => {
        limiter.setProviderConfig('openai', { maxConcurrent: 5 });
        // No error thrown
        expect(true).toBe(true);
    });
});

// ==================== Factory Functions Tests ====================

describe('createRequestQueue', () => {
    it('creates a RequestQueue instance', () => {
        const queue = createRequestQueue();
        expect(queue).toBeInstanceOf(RequestQueue);
    });

    it('accepts custom config', () => {
        const queue = createRequestQueue({ maxConcurrent: 10 });
        expect(queue).toBeInstanceOf(RequestQueue);
    });
});

describe('createProviderRateLimiter', () => {
    it('creates a ProviderRateLimiter instance', () => {
        const limiter = createProviderRateLimiter();
        expect(limiter).toBeInstanceOf(ProviderRateLimiter);
    });
});

// ==================== RATE_LIMIT_PRESETS Tests ====================

describe('RATE_LIMIT_PRESETS', () => {
    it('has presets for major providers', () => {
        expect(RATE_LIMIT_PRESETS.openai).toBeDefined();
        expect(RATE_LIMIT_PRESETS.anthropic).toBeDefined();
        expect(RATE_LIMIT_PRESETS.google).toBeDefined();
        expect(RATE_LIMIT_PRESETS.groq).toBeDefined();
        expect(RATE_LIMIT_PRESETS.ollama).toBeDefined();
    });

    it('presets have valid structure', () => {
        for (const [provider, config] of Object.entries(RATE_LIMIT_PRESETS)) {
            expect(config.maxConcurrent).toBeTypeOf('number');
            expect(config.rateLimit).toBeDefined();
            expect(config.rateLimit?.requests).toBeTypeOf('number');
            expect(config.rateLimit?.perMilliseconds).toBeTypeOf('number');
        }
    });

    it('local providers have lower concurrency', () => {
        expect(RATE_LIMIT_PRESETS.ollama.maxConcurrent).toBeLessThanOrEqual(2);
        expect(RATE_LIMIT_PRESETS.lmstudio.maxConcurrent).toBeLessThanOrEqual(2);
        expect(RATE_LIMIT_PRESETS.llamacpp.maxConcurrent).toBeLessThanOrEqual(2);
    });

    it('cloud providers have higher concurrency', () => {
        expect(RATE_LIMIT_PRESETS.openai.maxConcurrent).toBeGreaterThanOrEqual(3);
        expect(RATE_LIMIT_PRESETS.anthropic.maxConcurrent).toBeGreaterThanOrEqual(3);
        expect(RATE_LIMIT_PRESETS.cerebras.maxConcurrent).toBeGreaterThanOrEqual(5);
    });
});
