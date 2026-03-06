/**
 * Circuit Breaker 单元测试
 * Circuit Breaker Unit Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
    CircuitBreaker,
    CircuitBreakerManager,
    createCircuitBreakerMiddleware,
    createRetryWithBackoffMiddleware,
} from '../circuit-breaker';
import type { MiddlewareContext } from '../middleware';
import type { AIError } from '../types';

describe('CircuitBreaker', () => {
    let breaker: CircuitBreaker;

    beforeEach(() => {
        breaker = new CircuitBreaker({
            failureThreshold: 3,
            recoveryTimeout: 1000,
            halfOpenRequests: 1,
        });
    });

    describe('Initial State', () => {
        it('starts in closed state', () => {
            expect(breaker.getState()).toBe('closed');
        });

        it('allows requests when closed', () => {
            expect(breaker.canPass()).toBe(true);
        });

        it('has zero failures initially', () => {
            const stats = breaker.getStats();
            expect(stats.failures).toBe(0);
            expect(stats.successes).toBe(0);
        });
    });

    describe('Failure Tracking', () => {
        it('increments failure count on recordFailure', () => {
            breaker.recordFailure('server_error');
            expect(breaker.getStats().failures).toBe(1);
        });

        it('resets failure count on success', () => {
            breaker.recordFailure('server_error');
            breaker.recordFailure('server_error');
            breaker.recordSuccess();
            expect(breaker.getStats().failures).toBe(0);
        });

        it('opens after reaching failure threshold', () => {
            breaker.recordFailure('server_error');
            breaker.recordFailure('server_error');
            breaker.recordFailure('server_error');
            expect(breaker.getState()).toBe('open');
        });

        it('ignores non-trippable errors', () => {
            const customBreaker = new CircuitBreaker({
                failureThreshold: 1,
                recoveryTimeout: 1000,
                tripOnErrors: ['rate_limit'],
            });

            customBreaker.recordFailure('validation_error');
            expect(customBreaker.getState()).toBe('closed');

            customBreaker.recordFailure('rate_limit');
            expect(customBreaker.getState()).toBe('open');
        });
    });

    describe('Open State', () => {
        beforeEach(() => {
            // Trip the breaker
            for (let i = 0; i < 3; i++) {
                breaker.recordFailure('server_error');
            }
        });

        it('blocks requests when open', () => {
            expect(breaker.canPass()).toBe(false);
        });

        it('records openedAt timestamp', () => {
            expect(breaker.getStats().openedAt).not.toBeNull();
        });
    });

    describe('Half-Open State', () => {
        beforeEach(() => {
            vi.useFakeTimers();
            // Trip the breaker
            for (let i = 0; i < 3; i++) {
                breaker.recordFailure('server_error');
            }
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('transitions to half-open after recovery timeout', () => {
            expect(breaker.getState()).toBe('open');
            vi.advanceTimersByTime(1001);
            expect(breaker.getState()).toBe('half-open');
        });

        it('allows limited requests in half-open state', () => {
            vi.advanceTimersByTime(1001);
            expect(breaker.canPass()).toBe(true);
        });

        it('closes on successful half-open request', () => {
            vi.advanceTimersByTime(1001);
            breaker.canPass(); // Check state transition
            breaker.recordSuccess();
            expect(breaker.getState()).toBe('closed');
        });

        it('reopens on failed half-open request', () => {
            vi.advanceTimersByTime(1001);
            breaker.canPass(); // Check state transition
            breaker.recordFailure('server_error');
            expect(breaker.getState()).toBe('open');
        });
    });

    describe('Reset', () => {
        it('resets to closed state', () => {
            for (let i = 0; i < 3; i++) {
                breaker.recordFailure('server_error');
            }
            expect(breaker.getState()).toBe('open');

            breaker.reset();
            expect(breaker.getState()).toBe('closed');
            expect(breaker.getStats().failures).toBe(0);
        });
    });
});

describe('CircuitBreakerManager', () => {
    let manager: CircuitBreakerManager;

    beforeEach(() => {
        manager = new CircuitBreakerManager({
            failureThreshold: 2,
            recoveryTimeout: 500,
        });
    });

    it('creates breaker for new provider', () => {
        const breaker = manager.getBreaker('openai');
        expect(breaker).toBeInstanceOf(CircuitBreaker);
        expect(breaker.getState()).toBe('closed');
    });

    it('returns same breaker for same provider', () => {
        const breaker1 = manager.getBreaker('openai');
        const breaker2 = manager.getBreaker('openai');
        expect(breaker1).toBe(breaker2);
    });

    it('creates separate breakers for different providers', () => {
        const openaiBreaker = manager.getBreaker('openai');
        const anthropicBreaker = manager.getBreaker('anthropic');
        expect(openaiBreaker).not.toBe(anthropicBreaker);
    });

    it('returns all stats', () => {
        manager.getBreaker('openai').recordFailure('server_error');
        manager.getBreaker('anthropic');

        const allStats = manager.getAllStats();
        expect(allStats['openai'].failures).toBe(1);
        expect(allStats['anthropic'].failures).toBe(0);
    });

    it('resets all breakers', () => {
        const openaiBreaker = manager.getBreaker('openai');
        openaiBreaker.recordFailure('server_error');
        openaiBreaker.recordFailure('server_error');
        expect(openaiBreaker.getState()).toBe('open');

        manager.resetAll();
        expect(openaiBreaker.getState()).toBe('closed');
    });
});

describe('createCircuitBreakerMiddleware', () => {
    it('creates middleware with manager', () => {
        const middleware = createCircuitBreakerMiddleware();
        expect(middleware.name).toBe('circuit-breaker');
        expect(middleware.manager).toBeInstanceOf(CircuitBreakerManager);
    });

    it('allows request when circuit is closed', () => {
        const middleware = createCircuitBreakerMiddleware();
        const request = { model: 'gpt-4', messages: [] };
        const context: MiddlewareContext = {
            provider: 'openai',
            requestId: 'test-1',
            startTime: Date.now(),
        };

        const result = middleware.onRequest!(request as any, context);
        expect(result).toBe(request);
    });

    it('throws when circuit is open', () => {
        const middleware = createCircuitBreakerMiddleware({
            failureThreshold: 1,
        });

        const context: MiddlewareContext = {
            provider: 'openai',
            requestId: 'test-1',
            startTime: Date.now(),
        };

        // Trigger failure
        const error: AIError = { code: 'server_error', message: 'Server error', provider: 'openai' };
        middleware.onError!(error, { ...context, retryCount: 0 });

        // Now circuit should be open
        expect(() => {
            middleware.onRequest!({ model: 'gpt-4', messages: [] } as any, context);
        }).toThrow('Circuit breaker is open');
    });

    it('records success on response', () => {
        const middleware = createCircuitBreakerMiddleware();
        const context: MiddlewareContext = {
            provider: 'openai',
            requestId: 'test-1',
            startTime: Date.now(),
        };

        const response = { id: '1', choices: [], model: 'gpt-4' };
        middleware.onResponse!(response as any, { ...context, duration: 100 });

        const stats = middleware.manager.getBreaker('openai').getStats();
        expect(stats.successes).toBe(1);
    });
});

describe('createRetryWithBackoffMiddleware', () => {
    it('creates middleware with correct name', () => {
        const middleware = createRetryWithBackoffMiddleware();
        expect(middleware.name).toBe('retry-with-backoff');
    });

    it('initializes retry info on request', async () => {
        const middleware = createRetryWithBackoffMiddleware();
        const request = { model: 'gpt-4', messages: [] };
        const context: MiddlewareContext = {
            provider: 'openai',
            requestId: 'test-1',
            startTime: Date.now(),
        };

        const result = await middleware.onRequest!(request as any, context);
        expect(result).toBe(request);
    });

    it('triggers retry callback on retryable error', async () => {
        const onRetry = vi.fn();
        const middleware = createRetryWithBackoffMiddleware({
            maxRetries: 3,
            baseDelay: 10,  // Use short delay
            maxDelay: 100,
            jitter: 0,      // Disable jitter for predictable timing
            onRetry,
        });

        const context: MiddlewareContext = {
            provider: 'openai',
            requestId: 'test-retry-1',
            startTime: Date.now(),
        };

        await middleware.onRequest!({ model: 'gpt-4', messages: [] } as any, context);

        const error: AIError = { code: 'rate_limit', message: 'Rate limited', provider: 'openai' };

        // Call onError - it will call onRetry synchronously before the delay
        await middleware.onError!(error, { ...context, retryCount: 0 });

        // onRetry should have been called with the expected delay (baseDelay * 2^1 = 20)
        expect(onRetry).toHaveBeenCalledTimes(1);
        expect(onRetry).toHaveBeenCalledWith(error, 1, expect.any(Number));
    });

    it('does not retry non-retryable errors', async () => {
        const onRetry = vi.fn();
        const middleware = createRetryWithBackoffMiddleware({
            maxRetries: 3,
            onRetry,
            retryableErrors: ['rate_limit'],
        });

        const context: MiddlewareContext = {
            provider: 'openai',
            requestId: 'test-2',
            startTime: Date.now(),
        };

        await middleware.onRequest!({ model: 'gpt-4', messages: [] } as any, context);

        const error: AIError = { code: 'validation_error', message: 'Invalid input', provider: 'openai' };
        await middleware.onError!(error, { ...context, retryCount: 0 });

        expect(onRetry).not.toHaveBeenCalled();
    });

    it('respects max retries limit', async () => {
        const onRetry = vi.fn();
        const middleware = createRetryWithBackoffMiddleware({
            maxRetries: 2,
            baseDelay: 1,
            jitter: 0,
            onRetry,
        });

        const context: MiddlewareContext = {
            provider: 'openai',
            requestId: 'test-max-retries',
            startTime: Date.now(),
        };

        await middleware.onRequest!({ model: 'gpt-4', messages: [] } as any, context);

        const error: AIError = { code: 'rate_limit', message: 'Rate limited', provider: 'openai' };

        // First retry
        await middleware.onError!(error, { ...context, retryCount: 0 });
        expect(onRetry).toHaveBeenCalledTimes(1);

        // Second retry
        await middleware.onError!(error, { ...context, retryCount: 1 });
        expect(onRetry).toHaveBeenCalledTimes(2);

        // Third should not retry (max is 2)
        await middleware.onError!(error, { ...context, retryCount: 2 });
        expect(onRetry).toHaveBeenCalledTimes(2); // Still 2
    });
});
