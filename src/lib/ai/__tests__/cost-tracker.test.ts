/**
 * 成本追踪单元测试
 * Cost Tracker Unit Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
    CostTracker,
    createCostTracker,
    formatCost,
    formatTokens,
    MODEL_PRICING,
    type TokenUsage,
    type CostRecord,
} from '../cost-tracker';
import type { ChatCompletionResponse } from '../types';

// ==================== Mock Data ====================

const createMockResponse = (model: string, promptTokens = 100, completionTokens = 50): ChatCompletionResponse => ({
    id: `chatcmpl-${Date.now()}`,
    object: 'chat.completion',
    created: Date.now(),
    model,
    choices: [
        {
            index: 0,
            message: { role: 'assistant', content: 'Hello!' },
            finish_reason: 'stop',
        },
    ],
    usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
    },
});

const mockUsage: TokenUsage = {
    promptTokens: 1000,
    completionTokens: 500,
    totalTokens: 1500,
};

// ==================== MODEL_PRICING Tests ====================

describe('MODEL_PRICING', () => {
    it('has pricing for OpenAI models', () => {
        expect(MODEL_PRICING['gpt-4']).toBeDefined();
        expect(MODEL_PRICING['gpt-4o']).toBeDefined();
        expect(MODEL_PRICING['gpt-3.5-turbo']).toBeDefined();
    });

    it('has pricing for Anthropic models', () => {
        expect(MODEL_PRICING['claude-3-5-sonnet-20241022']).toBeDefined();
        expect(MODEL_PRICING['claude-3-opus-20240229']).toBeDefined();
    });

    it('has pricing for DeepSeek models', () => {
        expect(MODEL_PRICING['deepseek-chat']).toBeDefined();
        expect(MODEL_PRICING['deepseek-reasoner']).toBeDefined();
    });

    it('pricing has correct structure', () => {
        for (const [model, pricing] of Object.entries(MODEL_PRICING)) {
            expect(pricing.inputPer1kTokens).toBeTypeOf('number');
            expect(pricing.outputPer1kTokens).toBeTypeOf('number');
            expect(pricing.inputPer1kTokens).toBeGreaterThanOrEqual(0);
            expect(pricing.outputPer1kTokens).toBeGreaterThanOrEqual(0);
        }
    });
});

// ==================== CostTracker Tests ====================

describe('CostTracker', () => {
    let tracker: CostTracker;

    beforeEach(() => {
        tracker = new CostTracker();
    });

    describe('Basic Configuration', () => {
        it('creates with default config', () => {
            expect(tracker).toBeInstanceOf(CostTracker);
        });

        it('accepts custom config', () => {
            const customTracker = new CostTracker({
                enabled: false,
                maxRecords: 100,
            });
            expect(customTracker).toBeInstanceOf(CostTracker);
        });
    });

    describe('Pricing', () => {
        it('gets pricing for known models', () => {
            const pricing = tracker.getPricing('gpt-4');
            expect(pricing).not.toBeNull();
            expect(pricing?.inputPer1kTokens).toBe(0.03);
            expect(pricing?.outputPer1kTokens).toBe(0.06);
        });

        it('returns null for unknown models', () => {
            const pricing = tracker.getPricing('unknown-model-xyz');
            expect(pricing).toBeNull();
        });

        it('allows setting custom pricing', () => {
            tracker.setCustomPricing('custom-model', {
                inputPer1kTokens: 0.01,
                outputPer1kTokens: 0.02,
            });

            const pricing = tracker.getPricing('custom-model');
            expect(pricing?.inputPer1kTokens).toBe(0.01);
            expect(pricing?.outputPer1kTokens).toBe(0.02);
        });

        it('custom pricing overrides default', () => {
            tracker.setCustomPricing('gpt-4', {
                inputPer1kTokens: 0.001,
                outputPer1kTokens: 0.002,
            });

            const pricing = tracker.getPricing('gpt-4');
            expect(pricing?.inputPer1kTokens).toBe(0.001);
        });
    });

    describe('Cost Calculation', () => {
        it('calculates cost correctly', () => {
            // gpt-4: input = $0.03/1k, output = $0.06/1k
            const cost = tracker.calculateCost('gpt-4', mockUsage);
            // 1000 prompt * 0.03/1000 + 500 completion * 0.06/1000 = 0.03 + 0.03 = 0.06
            expect(cost).toBeCloseTo(0.06, 4);
        });

        it('returns 0 for unknown models', () => {
            const cost = tracker.calculateCost('unknown-model', mockUsage);
            expect(cost).toBe(0);
        });
    });

    describe('Tracking', () => {
        it('tracks requests and returns record', () => {
            const response = createMockResponse('gpt-4', 1000, 500);
            const record = tracker.track(response, 'openai');

            expect(record).not.toBeNull();
            expect(record?.provider).toBe('openai');
            expect(record?.model).toBe('gpt-4');
            expect(record?.usage.totalTokens).toBe(1500);
            expect(record?.cost).toBeGreaterThan(0);
        });

        it('returns null when disabled', () => {
            const disabledTracker = new CostTracker({ enabled: false });
            const response = createMockResponse('gpt-4');
            const record = disabledTracker.track(response, 'openai');

            expect(record).toBeNull();
        });

        it('returns null when no usage data', () => {
            const response: ChatCompletionResponse = {
                id: 'test',
                object: 'chat.completion',
                created: Date.now(),
                model: 'gpt-4',
                choices: [{ index: 0, message: { role: 'assistant', content: 'Hi' }, finish_reason: 'stop' }],
            };
            const record = tracker.track(response, 'openai');

            expect(record).toBeNull();
        });

        it('includes metadata in record', () => {
            const response = createMockResponse('gpt-4');
            const record = tracker.track(response, 'openai', { requestId: 'req-123' });

            expect(record?.metadata?.requestId).toBe('req-123');
        });
    });

    describe('Usage Statistics', () => {
        beforeEach(() => {
            tracker.track(createMockResponse('gpt-4', 100, 50), 'openai');
            tracker.track(createMockResponse('gpt-4', 200, 100), 'openai');
            tracker.track(createMockResponse('claude-3-5-sonnet-20241022', 150, 75), 'anthropic');
        });

        it('gets overall usage stats', () => {
            const stats = tracker.getUsage();

            expect(stats.totalRequests).toBe(3);
            expect(stats.totalTokens.totalTokens).toBe(675); // 150 + 300 + 225
        });

        it('gets usage stats by provider', () => {
            const openaiStats = tracker.getUsage('openai');
            const anthropicStats = tracker.getUsage('anthropic');

            expect(openaiStats.totalRequests).toBe(2);
            expect(anthropicStats.totalRequests).toBe(1);
        });

        it('calculates averages correctly', () => {
            const stats = tracker.getUsage();

            expect(stats.averageTokensPerRequest).toBe(225); // 675 / 3
            expect(stats.averageCostPerRequest).toBeGreaterThan(0);
        });
    });

    describe('Billing Report', () => {
        beforeEach(() => {
            // Add records for different days
            tracker.track(createMockResponse('gpt-4', 100, 50), 'openai');
            tracker.track(createMockResponse('deepseek-chat', 200, 100), 'deepseek');
        });

        it('generates billing report for date range', () => {
            const startDate = new Date(Date.now() - 86400000); // Yesterday
            const endDate = new Date();

            const report = tracker.getBilling(startDate, endDate);

            expect(report.startDate).toEqual(startDate);
            expect(report.endDate).toEqual(endDate);
            expect(report.totalCost).toBeGreaterThan(0);
        });

        it('breaks down by provider', () => {
            const report = tracker.getBilling(
                new Date(Date.now() - 86400000),
                new Date()
            );

            expect(report.byProvider['openai']).toBeDefined();
            expect(report.byProvider['deepseek']).toBeDefined();
            expect(report.byProvider['openai'].requests).toBe(1);
        });

        it('breaks down by model', () => {
            const report = tracker.getBilling(
                new Date(Date.now() - 86400000),
                new Date()
            );

            expect(report.byModel['gpt-4']).toBeDefined();
            expect(report.byModel['deepseek-chat']).toBeDefined();
        });

        it('includes daily breakdown', () => {
            const report = tracker.getBilling(
                new Date(Date.now() - 86400000),
                new Date()
            );

            expect(report.dailyBreakdown.length).toBeGreaterThan(0);
            expect(report.dailyBreakdown[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });
    });

    describe('Monthly and Daily Cost', () => {
        it('gets current month cost', () => {
            tracker.track(createMockResponse('gpt-4', 1000, 500), 'openai');
            const cost = tracker.getCurrentMonthCost();

            expect(cost).toBeGreaterThan(0);
        });

        it('gets today cost', () => {
            tracker.track(createMockResponse('gpt-4', 1000, 500), 'openai');
            const cost = tracker.getTodayCost();

            expect(cost).toBeGreaterThan(0);
        });
    });

    describe('Budget Alerts', () => {
        it('calls onBudgetWarning when threshold exceeded', () => {
            const warningCallback = vi.fn();
            const budgetTracker = new CostTracker({
                budgetWarning: 0.001,
                onBudgetWarning: warningCallback,
            });

            budgetTracker.track(createMockResponse('gpt-4', 1000, 500), 'openai');

            expect(warningCallback).toHaveBeenCalled();
        });

        it('calls onBudgetExceeded when limit exceeded', () => {
            const exceededCallback = vi.fn();
            const budgetTracker = new CostTracker({
                budgetLimit: 0.001,
                onBudgetExceeded: exceededCallback,
            });

            budgetTracker.track(createMockResponse('gpt-4', 1000, 500), 'openai');

            expect(exceededCallback).toHaveBeenCalled();
        });
    });

    describe('Export and Import', () => {
        it('exports records', () => {
            tracker.track(createMockResponse('gpt-4'), 'openai');
            tracker.track(createMockResponse('gpt-4'), 'openai');

            const exported = tracker.export();

            expect(exported).toHaveLength(2);
            expect(exported[0].model).toBe('gpt-4');
        });

        it('imports records', () => {
            const records: CostRecord[] = [
                {
                    id: 'cost_1',
                    provider: 'openai',
                    model: 'gpt-4',
                    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
                    cost: 0.01,
                    timestamp: Date.now(),
                },
            ];

            tracker.import(records);
            const exported = tracker.export();

            expect(exported).toHaveLength(1);
        });

        it('clears all records', () => {
            tracker.track(createMockResponse('gpt-4'), 'openai');
            tracker.clear();

            expect(tracker.export()).toHaveLength(0);
        });
    });

    describe('Record Cleanup', () => {
        it('respects maxRecords limit', () => {
            const smallTracker = new CostTracker({ maxRecords: 3 });

            for (let i = 0; i < 5; i++) {
                smallTracker.track(createMockResponse('gpt-4'), 'openai');
            }

            expect(smallTracker.export().length).toBeLessThanOrEqual(3);
        });

        it('removes old records based on retention', () => {
            const shortRetentionTracker = new CostTracker({
                retention: 1, // 1ms retention
            });

            shortRetentionTracker.track(createMockResponse('gpt-4'), 'openai');

            // Wait a bit and add another
            vi.useFakeTimers();
            vi.advanceTimersByTime(100);

            shortRetentionTracker.track(createMockResponse('gpt-4'), 'openai');

            // The old record should be cleaned up
            expect(shortRetentionTracker.export().length).toBe(1);

            vi.useRealTimers();
        });
    });
});

// ==================== Factory Function Tests ====================

describe('createCostTracker', () => {
    it('creates a CostTracker instance', () => {
        const tracker = createCostTracker();
        expect(tracker).toBeInstanceOf(CostTracker);
    });

    it('accepts custom config', () => {
        const tracker = createCostTracker({ enabled: false });
        expect(tracker).toBeInstanceOf(CostTracker);
    });
});

// ==================== Formatting Functions Tests ====================

describe('formatCost', () => {
    it('formats cost as USD by default', () => {
        const formatted = formatCost(1.2345);
        expect(formatted).toContain('$');
        expect(formatted).toContain('1.2345');
    });

    it('supports other currencies', () => {
        const formatted = formatCost(1.2345, 'EUR');
        expect(formatted).toContain('€');
    });

    it('handles zero', () => {
        const formatted = formatCost(0);
        expect(formatted).toContain('0.0000');
    });

    it('handles small decimals', () => {
        const formatted = formatCost(0.0001);
        expect(formatted).toContain('0.0001');
    });
});

describe('formatTokens', () => {
    it('formats small numbers as-is', () => {
        expect(formatTokens(500)).toBe('500');
    });

    it('formats thousands as K', () => {
        expect(formatTokens(1500)).toBe('1.5K');
        expect(formatTokens(10000)).toBe('10.0K');
    });

    it('formats millions as M', () => {
        expect(formatTokens(1500000)).toBe('1.50M');
        expect(formatTokens(2000000)).toBe('2.00M');
    });

    it('handles edge cases', () => {
        expect(formatTokens(999)).toBe('999');
        expect(formatTokens(1000)).toBe('1.0K');
        expect(formatTokens(999999)).toBe('1000.0K');
    });
});
