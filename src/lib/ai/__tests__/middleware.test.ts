/**
 * 中间件单元测试
 * Middleware Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    MiddlewareManager,
    createMiddlewareManager,
    createLoggingMiddleware,
    createPerformanceMiddleware,
    createRetryMiddleware,
    createStructuredLoggingMiddleware,
    generateRequestId,
    type AIMiddleware,
    type MiddlewareContext,
} from '../middleware';
import type { ChatCompletionRequest, ChatCompletionResponse, StreamChunk, AIError } from '../types';

// ==================== Mock Data ====================

const mockRequest: ChatCompletionRequest = {
    model: 'gpt-4',
    messages: [
        { role: 'user', content: 'Hello, world!' },
    ],
};

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

const mockContext: MiddlewareContext = {
    provider: 'openai',
    requestId: 'test-req-001',
    startTime: Date.now(),
};

const mockError: AIError = {
    code: 'rate_limit',
    message: 'Rate limit exceeded',
    provider: 'openai',
    retryable: true,
};

const mockChunk: StreamChunk = {
    id: 'chunk-1',
    object: 'chat.completion.chunk',
    created: Date.now(),
    model: 'gpt-4',
    choices: [
        {
            index: 0,
            delta: { content: 'Hello' },
            finish_reason: null,
        },
    ],
};

// ==================== MiddlewareManager Tests ====================

describe('MiddlewareManager', () => {
    let manager: MiddlewareManager;

    beforeEach(() => {
        manager = new MiddlewareManager();
    });

    describe('use() and getMiddlewares()', () => {
        it('adds middleware to the chain', () => {
            const middleware: AIMiddleware = { name: 'test' };
            manager.use(middleware);
            expect(manager.getMiddlewares()).toHaveLength(1);
            expect(manager.getMiddlewares()[0].name).toBe('test');
        });

        it('returns self for chaining', () => {
            const result = manager.use({ name: 'test1' }).use({ name: 'test2' });
            expect(result).toBe(manager);
            expect(manager.getMiddlewares()).toHaveLength(2);
        });

        it('preserves middleware order', () => {
            manager.use({ name: 'first' }).use({ name: 'second' }).use({ name: 'third' });
            const names = manager.getMiddlewares().map(m => m.name);
            expect(names).toEqual(['first', 'second', 'third']);
        });
    });

    describe('remove()', () => {
        it('removes middleware by name', () => {
            manager.use({ name: 'keep' }).use({ name: 'remove' }).use({ name: 'keep2' });
            const result = manager.remove('remove');
            expect(result).toBe(true);
            expect(manager.getMiddlewares()).toHaveLength(2);
            expect(manager.getMiddlewares().map(m => m.name)).toEqual(['keep', 'keep2']);
        });

        it('returns false if middleware not found', () => {
            manager.use({ name: 'test' });
            const result = manager.remove('nonexistent');
            expect(result).toBe(false);
            expect(manager.getMiddlewares()).toHaveLength(1);
        });
    });

    describe('executeRequest()', () => {
        it('executes all onRequest handlers in order', async () => {
            const calls: string[] = [];

            manager.use({
                name: 'first',
                onRequest: (req) => {
                    calls.push('first');
                    return req;
                },
            });
            manager.use({
                name: 'second',
                onRequest: (req) => {
                    calls.push('second');
                    return req;
                },
            });

            await manager.executeRequest(mockRequest, mockContext);
            expect(calls).toEqual(['first', 'second']);
        });

        it('passes modified request to next middleware', async () => {
            manager.use({
                name: 'modifier',
                onRequest: (req) => ({
                    ...req,
                    model: 'gpt-4-turbo',
                }),
            });
            manager.use({
                name: 'checker',
                onRequest: (req) => {
                    expect(req.model).toBe('gpt-4-turbo');
                    return req;
                },
            });

            const result = await manager.executeRequest(mockRequest, mockContext);
            expect(result.model).toBe('gpt-4-turbo');
        });

        it('handles async onRequest handlers', async () => {
            manager.use({
                name: 'async',
                onRequest: async (req) => {
                    await new Promise(r => setTimeout(r, 10));
                    return { ...req, model: 'async-model' };
                },
            });

            const result = await manager.executeRequest(mockRequest, mockContext);
            expect(result.model).toBe('async-model');
        });

        it('skips middleware without onRequest', async () => {
            manager.use({ name: 'noHandler' });
            manager.use({
                name: 'withHandler',
                onRequest: (req) => ({ ...req, model: 'modified' }),
            });

            const result = await manager.executeRequest(mockRequest, mockContext);
            expect(result.model).toBe('modified');
        });
    });

    describe('executeResponse()', () => {
        it('executes all onResponse handlers', async () => {
            const calls: string[] = [];

            manager.use({
                name: 'first',
                onResponse: (res) => {
                    calls.push('first');
                    return res;
                },
            });
            manager.use({
                name: 'second',
                onResponse: (res) => {
                    calls.push('second');
                    return res;
                },
            });

            await manager.executeResponse(mockResponse, { ...mockContext, duration: 100 });
            expect(calls).toEqual(['first', 'second']);
        });

        it('passes duration in context', async () => {
            manager.use({
                name: 'checker',
                onResponse: (res, ctx) => {
                    expect(ctx.duration).toBe(500);
                    return res;
                },
            });

            await manager.executeResponse(mockResponse, { ...mockContext, duration: 500 });
        });
    });

    describe('executeError()', () => {
        it('executes all onError handlers', async () => {
            const errors: AIError[] = [];

            manager.use({
                name: 'first',
                onError: (err) => { errors.push(err); },
            });
            manager.use({
                name: 'second',
                onError: (err) => { errors.push(err); },
            });

            await manager.executeError(mockError, { ...mockContext, retryCount: 1 });
            expect(errors).toHaveLength(2);
        });

        it('passes retryCount in context', async () => {
            manager.use({
                name: 'checker',
                onError: (_, ctx) => {
                    expect(ctx.retryCount).toBe(3);
                },
            });

            await manager.executeError(mockError, { ...mockContext, retryCount: 3 });
        });
    });

    describe('executeStream()', () => {
        it('executes all onStream handlers', async () => {
            let chunkContent = '';

            manager.use({
                name: 'first',
                onStream: (chunk) => {
                    chunkContent += 'A';
                    return chunk;
                },
            });
            manager.use({
                name: 'second',
                onStream: (chunk) => {
                    chunkContent += 'B';
                    return chunk;
                },
            });

            await manager.executeStream(mockChunk, mockContext);
            expect(chunkContent).toBe('AB');
        });
    });

    describe('executeComplete()', () => {
        it('executes all onComplete handlers', async () => {
            const completions: boolean[] = [];

            manager.use({
                name: 'first',
                onComplete: (ctx) => { completions.push(ctx.success); },
            });
            manager.use({
                name: 'second',
                onComplete: (ctx) => { completions.push(ctx.success); },
            });

            await manager.executeComplete({
                ...mockContext,
                duration: 100,
                success: true,
                tokensUsed: { prompt: 10, completion: 5, total: 15 },
            });

            expect(completions).toEqual([true, true]);
        });
    });
});

// ==================== Factory Functions Tests ====================

describe('createMiddlewareManager', () => {
    it('creates a new MiddlewareManager instance', () => {
        const manager = createMiddlewareManager();
        expect(manager).toBeInstanceOf(MiddlewareManager);
        expect(manager.getMiddlewares()).toHaveLength(0);
    });
});

describe('generateRequestId', () => {
    it('generates unique IDs', () => {
        const ids = new Set<string>();
        for (let i = 0; i < 100; i++) {
            ids.add(generateRequestId());
        }
        expect(ids.size).toBe(100);
    });

    it('starts with req_ prefix', () => {
        const id = generateRequestId();
        expect(id).toMatch(/^req_\d+_[a-z0-9]+$/);
    });
});

// ==================== Built-in Middleware Tests ====================

describe('createLoggingMiddleware', () => {
    it('creates middleware with correct name', () => {
        const middleware = createLoggingMiddleware();
        expect(middleware.name).toBe('logging');
    });

    it('logs requests when logRequest is true', async () => {
        const logs: unknown[] = [];
        const middleware = createLoggingMiddleware({
            logger: (msg, data) => logs.push({ msg, data }),
        });

        await middleware.onRequest!(mockRequest, mockContext);
        expect(logs).toHaveLength(1);
        expect(logs[0]).toMatchObject({
            msg: expect.stringContaining('[AI Request]'),
        });
    });

    it('does not log requests when logRequest is false', async () => {
        const logs: unknown[] = [];
        const middleware = createLoggingMiddleware({
            logRequest: false,
            logger: (msg) => logs.push(msg),
        });

        await middleware.onRequest!(mockRequest, mockContext);
        expect(logs).toHaveLength(0);
    });

    it('logs responses when logResponse is true', async () => {
        const logs: unknown[] = [];
        const middleware = createLoggingMiddleware({
            logger: (msg, data) => logs.push({ msg, data }),
        });

        await middleware.onResponse!(mockResponse, { ...mockContext, duration: 100 });
        expect(logs).toHaveLength(1);
        expect(logs[0]).toMatchObject({
            msg: expect.stringContaining('[AI Response]'),
        });
    });

    it('logs errors when logErrors is true', async () => {
        const logs: unknown[] = [];
        const middleware = createLoggingMiddleware({
            logger: (msg, data) => logs.push({ msg, data }),
        });

        await middleware.onError!(mockError, { ...mockContext, retryCount: 1 });
        expect(logs).toHaveLength(1);
        expect(logs[0]).toMatchObject({
            msg: expect.stringContaining('[AI Error]'),
        });
    });

    it('returns request/response unchanged', async () => {
        const middleware = createLoggingMiddleware({ logger: () => { } });

        const reqResult = await middleware.onRequest!(mockRequest, mockContext);
        expect(reqResult).toBe(mockRequest);

        const resResult = await middleware.onResponse!(mockResponse, { ...mockContext, duration: 100 });
        expect(resResult).toBe(mockResponse);
    });
});

describe('createPerformanceMiddleware', () => {
    it('creates middleware with correct name', () => {
        const middleware = createPerformanceMiddleware();
        expect(middleware.name).toBe('performance');
    });

    it('calls onSlowRequest for slow requests', async () => {
        const slowRequests: number[] = [];
        const middleware = createPerformanceMiddleware({
            slowThreshold: 1000,
            onSlowRequest: (ctx) => slowRequests.push(ctx.duration),
        });

        await middleware.onComplete!({
            ...mockContext,
            duration: 2000,
            success: true,
        });

        expect(slowRequests).toEqual([2000]);
    });

    it('does not call onSlowRequest for fast requests', async () => {
        const slowRequests: number[] = [];
        const middleware = createPerformanceMiddleware({
            slowThreshold: 1000,
            onSlowRequest: (ctx) => slowRequests.push(ctx.duration),
        });

        await middleware.onComplete!({
            ...mockContext,
            duration: 500,
            success: true,
        });

        expect(slowRequests).toHaveLength(0);
    });

    it('uses default threshold of 5000ms', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
        const middleware = createPerformanceMiddleware();

        await middleware.onComplete!({
            ...mockContext,
            duration: 6000,
            success: true,
        });

        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });
});

describe('createRetryMiddleware', () => {
    it('creates middleware with correct name', () => {
        const middleware = createRetryMiddleware();
        expect(middleware.name).toBe('retry');
    });

    it('calls onRetry when retryCount > 0', async () => {
        const retries: number[] = [];
        const middleware = createRetryMiddleware({
            onRetry: (_, count) => retries.push(count),
        });

        await middleware.onError!(mockError, { ...mockContext, retryCount: 2 });
        expect(retries).toEqual([2]);
    });

    it('does not call onRetry when retryCount is 0', async () => {
        const retries: number[] = [];
        const middleware = createRetryMiddleware({
            onRetry: (_, count) => retries.push(count),
        });

        await middleware.onError!(mockError, { ...mockContext, retryCount: 0 });
        expect(retries).toHaveLength(0);
    });
});

describe('createStructuredLoggingMiddleware', () => {
    it('creates middleware with correct name', () => {
        const middleware = createStructuredLoggingMiddleware();
        expect(middleware.name).toBe('structured-logging');
    });

    it('logs structured entries via custom logger', async () => {
        const entries: unknown[] = [];
        const middleware = createStructuredLoggingMiddleware({
            logger: (entry) => entries.push(entry),
        });

        await middleware.onRequest!(mockRequest, mockContext);

        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
            level: 'info',
            event: 'request',
            requestId: mockContext.requestId,
            provider: mockContext.provider,
            model: mockRequest.model,
        });
    });

    it('logs response with usage info', async () => {
        const entries: unknown[] = [];
        const middleware = createStructuredLoggingMiddleware({
            logger: (entry) => entries.push(entry),
        });

        await middleware.onResponse!(mockResponse, { ...mockContext, duration: 200 });

        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
            level: 'info',
            event: 'response',
            duration: 200,
            tokens: { prompt: 10, completion: 5, total: 15 },
        });
    });

    it('logs errors with error details', async () => {
        const entries: unknown[] = [];
        const middleware = createStructuredLoggingMiddleware({
            logger: (entry) => entries.push(entry),
        });

        await middleware.onError!(mockError, { ...mockContext, retryCount: 1 });

        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
            level: 'error',
            event: 'error',
            error: { code: 'rate_limit', message: 'Rate limit exceeded' },
        });
    });

    it('respects log level filtering', async () => {
        const entries: unknown[] = [];
        const middleware = createStructuredLoggingMiddleware({
            level: 'warn',
            logger: (entry) => entries.push(entry),
        });

        // info should be filtered
        await middleware.onRequest!(mockRequest, mockContext);
        expect(entries).toHaveLength(0);

        // error should pass
        await middleware.onError!(mockError, { ...mockContext, retryCount: 1 });
        expect(entries).toHaveLength(1);
    });

    it('outputs JSON format when configured', async () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
        const middleware = createStructuredLoggingMiddleware({ format: 'json' });

        await middleware.onRequest!(mockRequest, mockContext);

        expect(logSpy).toHaveBeenCalled();
        const output = logSpy.mock.calls[0][0];
        expect(() => JSON.parse(output)).not.toThrow();
        logSpy.mockRestore();
    });

    it('redacts sensitive fields', async () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
        const middleware = createStructuredLoggingMiddleware({
            format: 'json',
            redactKeys: ['secret'],
        });

        const contextWithSecret = {
            ...mockContext,
            metadata: { secret: 'super-secret-value' },
        };

        await middleware.onRequest!(mockRequest, contextWithSecret);

        const output = logSpy.mock.calls[0][0];
        expect(output).not.toContain('super-secret-value');
        logSpy.mockRestore();
    });
});
