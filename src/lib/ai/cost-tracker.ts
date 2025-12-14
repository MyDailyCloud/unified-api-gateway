/**
 * AI 成本追踪模块
 * AI Cost Tracking Module
 */

import type { ChatCompletionResponse, AIProvider, ModelInfo } from './types';

// ==================== 成本类型 ====================

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface CostRecord {
  id: string;
  provider: AIProvider;
  model: string;
  usage: TokenUsage;
  cost: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface UsageStats {
  provider: AIProvider;
  totalRequests: number;
  totalTokens: TokenUsage;
  totalCost: number;
  averageTokensPerRequest: number;
  averageCostPerRequest: number;
}

export interface BillingReport {
  startDate: Date;
  endDate: Date;
  totalCost: number;
  byProvider: Record<AIProvider, {
    requests: number;
    tokens: TokenUsage;
    cost: number;
  }>;
  byModel: Record<string, {
    requests: number;
    tokens: TokenUsage;
    cost: number;
  }>;
  dailyBreakdown: Array<{
    date: string;
    cost: number;
    tokens: number;
    requests: number;
  }>;
}

export interface CostTrackerConfig {
  /** 是否启用追踪 */
  enabled: boolean;
  /** 存储限制（条目数） */
  maxRecords: number;
  /** 记录保留时间（毫秒） */
  retention: number;
  /** 预算警告阈值（美元） */
  budgetWarning?: number;
  /** 预算限制（美元） */
  budgetLimit?: number;
  /** 预算回调 */
  onBudgetWarning?: (current: number, limit: number) => void;
  onBudgetExceeded?: (current: number, limit: number) => void;
}

// ==================== 定价表 ====================

export interface PricingInfo {
  inputPer1kTokens: number;
  outputPer1kTokens: number;
}

export const MODEL_PRICING: Record<string, PricingInfo> = {
  // OpenAI
  'gpt-4o': { inputPer1kTokens: 0.005, outputPer1kTokens: 0.015 },
  'gpt-4o-mini': { inputPer1kTokens: 0.00015, outputPer1kTokens: 0.0006 },
  'gpt-4-turbo': { inputPer1kTokens: 0.01, outputPer1kTokens: 0.03 },
  'gpt-4': { inputPer1kTokens: 0.03, outputPer1kTokens: 0.06 },
  'gpt-3.5-turbo': { inputPer1kTokens: 0.0005, outputPer1kTokens: 0.0015 },
  'o1': { inputPer1kTokens: 0.015, outputPer1kTokens: 0.06 },
  'o1-mini': { inputPer1kTokens: 0.003, outputPer1kTokens: 0.012 },
  'o3-mini': { inputPer1kTokens: 0.0011, outputPer1kTokens: 0.0044 },
  
  // Anthropic
  'claude-3-5-sonnet-20241022': { inputPer1kTokens: 0.003, outputPer1kTokens: 0.015 },
  'claude-sonnet-4-5': { inputPer1kTokens: 0.003, outputPer1kTokens: 0.015 },
  'claude-3-opus-20240229': { inputPer1kTokens: 0.015, outputPer1kTokens: 0.075 },
  'claude-3-haiku-20240307': { inputPer1kTokens: 0.00025, outputPer1kTokens: 0.00125 },
  
  // DeepSeek
  'deepseek-chat': { inputPer1kTokens: 0.00014, outputPer1kTokens: 0.00028 },
  'deepseek-coder': { inputPer1kTokens: 0.00014, outputPer1kTokens: 0.00028 },
  'deepseek-reasoner': { inputPer1kTokens: 0.00055, outputPer1kTokens: 0.00219 },
  
  // Cerebras
  'llama3.1-70b': { inputPer1kTokens: 0.00085, outputPer1kTokens: 0.00085 },
  'llama3.1-8b': { inputPer1kTokens: 0.0001, outputPer1kTokens: 0.0001 },
  
  // GLM
  'glm-4-plus': { inputPer1kTokens: 0.007, outputPer1kTokens: 0.007 },
  'glm-4': { inputPer1kTokens: 0.014, outputPer1kTokens: 0.014 },
  'glm-4-flash': { inputPer1kTokens: 0.0001, outputPer1kTokens: 0.0001 },
  
  // Groq
  'llama-3.3-70b-versatile': { inputPer1kTokens: 0.00059, outputPer1kTokens: 0.00079 },
  'mixtral-8x7b-32768': { inputPer1kTokens: 0.00024, outputPer1kTokens: 0.00024 },
  
  // Moonshot
  'moonshot-v1-8k': { inputPer1kTokens: 0.0017, outputPer1kTokens: 0.0017 },
  'moonshot-v1-32k': { inputPer1kTokens: 0.0034, outputPer1kTokens: 0.0034 },
  'moonshot-v1-128k': { inputPer1kTokens: 0.0085, outputPer1kTokens: 0.0085 },
  
  // Qwen
  'qwen-max': { inputPer1kTokens: 0.0028, outputPer1kTokens: 0.0112 },
  'qwen-plus': { inputPer1kTokens: 0.0006, outputPer1kTokens: 0.0017 },
  'qwen-turbo': { inputPer1kTokens: 0.00035, outputPer1kTokens: 0.0007 },
};

// ==================== 成本追踪器 ====================

export class CostTracker {
  private records: CostRecord[] = [];
  private config: Required<CostTrackerConfig>;
  private customPricing = new Map<string, PricingInfo>();

  constructor(config: Partial<CostTrackerConfig> = {}) {
    this.config = {
      enabled: true,
      maxRecords: 10000,
      retention: 30 * 24 * 60 * 60 * 1000, // 30天
      budgetWarning: undefined,
      budgetLimit: undefined,
      onBudgetWarning: undefined,
      onBudgetExceeded: undefined,
      ...config,
    } as Required<CostTrackerConfig>;
  }

  /**
   * 设置自定义定价
   */
  setCustomPricing(model: string, pricing: PricingInfo): void {
    this.customPricing.set(model, pricing);
  }

  /**
   * 获取模型定价
   */
  getPricing(model: string): PricingInfo | null {
    return this.customPricing.get(model) ?? MODEL_PRICING[model] ?? null;
  }

  /**
   * 计算请求成本
   */
  calculateCost(model: string, usage: TokenUsage): number {
    const pricing = this.getPricing(model);
    if (!pricing) return 0;

    const inputCost = (usage.promptTokens / 1000) * pricing.inputPer1kTokens;
    const outputCost = (usage.completionTokens / 1000) * pricing.outputPer1kTokens;
    return inputCost + outputCost;
  }

  /**
   * 追踪请求
   */
  track(
    response: ChatCompletionResponse,
    provider: AIProvider,
    metadata?: Record<string, unknown>
  ): CostRecord | null {
    if (!this.config.enabled || !response.usage) return null;

    const usage: TokenUsage = {
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
    };

    const cost = this.calculateCost(response.model, usage);

    const record: CostRecord = {
      id: `cost_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      provider,
      model: response.model,
      usage,
      cost,
      timestamp: Date.now(),
      metadata,
    };

    this.records.push(record);
    this.cleanup();
    this.checkBudget();

    return record;
  }

  /**
   * 获取使用统计
   */
  getUsage(provider?: AIProvider): UsageStats {
    const filtered = provider 
      ? this.records.filter(r => r.provider === provider)
      : this.records;

    const totalTokens: TokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };

    let totalCost = 0;

    for (const record of filtered) {
      totalTokens.promptTokens += record.usage.promptTokens;
      totalTokens.completionTokens += record.usage.completionTokens;
      totalTokens.totalTokens += record.usage.totalTokens;
      totalCost += record.cost;
    }

    return {
      provider: provider ?? 'openai',
      totalRequests: filtered.length,
      totalTokens,
      totalCost,
      averageTokensPerRequest: filtered.length > 0 ? totalTokens.totalTokens / filtered.length : 0,
      averageCostPerRequest: filtered.length > 0 ? totalCost / filtered.length : 0,
    };
  }

  /**
   * 获取账单报告
   */
  getBilling(startDate: Date, endDate: Date): BillingReport {
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();

    const filtered = this.records.filter(
      r => r.timestamp >= startTime && r.timestamp <= endTime
    );

    const byProvider: BillingReport['byProvider'] = {} as BillingReport['byProvider'];
    const byModel: BillingReport['byModel'] = {};
    const dailyMap = new Map<string, { cost: number; tokens: number; requests: number }>();

    let totalCost = 0;

    for (const record of filtered) {
      totalCost += record.cost;

      // 按提供商统计
      if (!byProvider[record.provider]) {
        byProvider[record.provider] = {
          requests: 0,
          tokens: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          cost: 0,
        };
      }
      byProvider[record.provider].requests++;
      byProvider[record.provider].tokens.promptTokens += record.usage.promptTokens;
      byProvider[record.provider].tokens.completionTokens += record.usage.completionTokens;
      byProvider[record.provider].tokens.totalTokens += record.usage.totalTokens;
      byProvider[record.provider].cost += record.cost;

      // 按模型统计
      if (!byModel[record.model]) {
        byModel[record.model] = {
          requests: 0,
          tokens: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          cost: 0,
        };
      }
      byModel[record.model].requests++;
      byModel[record.model].tokens.promptTokens += record.usage.promptTokens;
      byModel[record.model].tokens.completionTokens += record.usage.completionTokens;
      byModel[record.model].tokens.totalTokens += record.usage.totalTokens;
      byModel[record.model].cost += record.cost;

      // 按天统计
      const dateKey = new Date(record.timestamp).toISOString().split('T')[0];
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { cost: 0, tokens: 0, requests: 0 });
      }
      const daily = dailyMap.get(dateKey)!;
      daily.cost += record.cost;
      daily.tokens += record.usage.totalTokens;
      daily.requests++;
    }

    return {
      startDate,
      endDate,
      totalCost,
      byProvider,
      byModel,
      dailyBreakdown: Array.from(dailyMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  /**
   * 获取当月成本
   */
  getCurrentMonthCost(): number {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return this.records
      .filter(r => r.timestamp >= startOfMonth.getTime())
      .reduce((sum, r) => sum + r.cost, 0);
  }

  /**
   * 获取今日成本
   */
  getTodayCost(): number {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return this.records
      .filter(r => r.timestamp >= startOfDay.getTime())
      .reduce((sum, r) => sum + r.cost, 0);
  }

  /**
   * 检查预算
   */
  private checkBudget(): void {
    const currentCost = this.getCurrentMonthCost();

    if (this.config.budgetWarning && currentCost >= this.config.budgetWarning) {
      this.config.onBudgetWarning?.(currentCost, this.config.budgetWarning);
    }

    if (this.config.budgetLimit && currentCost >= this.config.budgetLimit) {
      this.config.onBudgetExceeded?.(currentCost, this.config.budgetLimit);
    }
  }

  /**
   * 清理过期记录
   */
  private cleanup(): void {
    const cutoff = Date.now() - this.config.retention;
    this.records = this.records.filter(r => r.timestamp > cutoff);

    // 如果超过最大记录数，删除最旧的
    if (this.records.length > this.config.maxRecords) {
      this.records = this.records.slice(-this.config.maxRecords);
    }
  }

  /**
   * 导出记录
   */
  export(): CostRecord[] {
    return [...this.records];
  }

  /**
   * 导入记录
   */
  import(records: CostRecord[]): void {
    this.records = [...this.records, ...records];
    this.cleanup();
  }

  /**
   * 清空所有记录
   */
  clear(): void {
    this.records = [];
  }
}

// ==================== 工厂函数 ====================

export function createCostTracker(config?: Partial<CostTrackerConfig>): CostTracker {
  return new CostTracker(config);
}

/**
 * 格式化成本为字符串
 */
export function formatCost(cost: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(cost);
}

/**
 * 格式化 token 数量
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(2)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toString();
}
