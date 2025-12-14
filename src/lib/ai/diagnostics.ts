/**
 * AI 连接诊断工具
 * AI Connection Diagnostics
 */

import type { AIProvider, AIAdapter, ModelInfo } from './types';

// ==================== 诊断类型 ====================

export interface ConnectionTestResult {
  provider: AIProvider;
  success: boolean;
  latency?: number;
  error?: string;
  models?: number;
  timestamp: number;
}

export interface DiagnosticsReport {
  timestamp: number;
  environment: {
    userAgent: string;
    platform: string;
    language: string;
  };
  providers: ConnectionTestResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    averageLatency: number;
  };
}

export interface HealthCheckOptions {
  timeout?: number;
  testChat?: boolean;
  parallel?: boolean;
}

// ==================== 诊断工具类 ====================

export class AIDiagnostics {
  private adapters: Map<AIProvider, AIAdapter>;

  constructor(adapters: Map<AIProvider, AIAdapter>) {
    this.adapters = adapters;
  }

  /**
   * 测试单个提供商连接
   */
  async testConnection(
    provider: AIProvider,
    options: HealthCheckOptions = {}
  ): Promise<ConnectionTestResult> {
    const { timeout = 10000, testChat = false } = options;
    const adapter = this.adapters.get(provider);

    if (!adapter) {
      return {
        provider,
        success: false,
        error: 'Provider not registered',
        timestamp: Date.now(),
      };
    }

    const startTime = Date.now();

    try {
      // 创建超时 Promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout')), timeout);
      });

      // 测试 API 连接
      const testPromise = testChat
        ? this.testChatConnection(adapter)
        : adapter.listModels();

      const result = await Promise.race([testPromise, timeoutPromise]);
      const latency = Date.now() - startTime;

      return {
        provider,
        success: true,
        latency,
        models: Array.isArray(result) ? result.length : undefined,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        provider,
        success: false,
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      };
    }
  }

  /**
   * 测试所有提供商连接
   */
  async testAllConnections(
    options: HealthCheckOptions = {}
  ): Promise<ConnectionTestResult[]> {
    const { parallel = true } = options;
    const providers = Array.from(this.adapters.keys());

    if (parallel) {
      return Promise.all(
        providers.map(provider => this.testConnection(provider, options))
      );
    }

    const results: ConnectionTestResult[] = [];
    for (const provider of providers) {
      results.push(await this.testConnection(provider, options));
    }
    return results;
  }

  /**
   * 生成完整诊断报告
   */
  async generateReport(options: HealthCheckOptions = {}): Promise<DiagnosticsReport> {
    const providers = await this.testAllConnections(options);

    const successful = providers.filter(p => p.success);
    const failed = providers.filter(p => !p.success);
    const latencies = successful.map(p => p.latency || 0);
    const averageLatency = latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0;

    return {
      timestamp: Date.now(),
      environment: {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
        language: typeof navigator !== 'undefined' ? navigator.language : 'unknown',
      },
      providers,
      summary: {
        total: providers.length,
        successful: successful.length,
        failed: failed.length,
        averageLatency: Math.round(averageLatency),
      },
    };
  }

  /**
   * 获取最快的可用提供商
   */
  async getFastestProvider(
    providers?: AIProvider[],
    options: HealthCheckOptions = {}
  ): Promise<AIProvider | null> {
    const targetProviders = providers || Array.from(this.adapters.keys());
    const results = await Promise.all(
      targetProviders.map(provider => this.testConnection(provider, options))
    );

    const successful = results
      .filter(r => r.success && r.latency !== undefined)
      .sort((a, b) => (a.latency || Infinity) - (b.latency || Infinity));

    return successful.length > 0 ? successful[0].provider : null;
  }

  /**
   * 检查提供商健康状态
   */
  async isHealthy(provider: AIProvider): Promise<boolean> {
    const result = await this.testConnection(provider, { timeout: 5000 });
    return result.success;
  }

  /**
   * 获取所有健康的提供商
   */
  async getHealthyProviders(): Promise<AIProvider[]> {
    const results = await this.testAllConnections({ timeout: 5000, parallel: true });
    return results.filter(r => r.success).map(r => r.provider);
  }

  /**
   * 测试聊天连接（发送简单请求）
   */
  private async testChatConnection(adapter: AIAdapter): Promise<boolean> {
    const models = await adapter.listModels();
    if (models.length === 0) return true;

    // 使用第一个模型进行简单测试
    const response = await adapter.chat({
      model: models[0].id,
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 5,
    });

    return response.choices.length > 0;
  }
}

// ==================== 工厂函数 ====================

export function createDiagnostics(adapters: Map<AIProvider, AIAdapter>): AIDiagnostics {
  return new AIDiagnostics(adapters);
}

/**
 * 格式化诊断报告为可读文本
 */
export function formatDiagnosticsReport(report: DiagnosticsReport): string {
  const lines: string[] = [
    '=== AI Diagnostics Report ===',
    `Generated: ${new Date(report.timestamp).toISOString()}`,
    '',
    '--- Environment ---',
    `Platform: ${report.environment.platform}`,
    `Language: ${report.environment.language}`,
    '',
    '--- Providers ---',
  ];

  for (const provider of report.providers) {
    const status = provider.success ? '✓' : '✗';
    const latency = provider.latency ? `${provider.latency}ms` : '-';
    const models = provider.models !== undefined ? `(${provider.models} models)` : '';
    const error = provider.error ? ` [${provider.error}]` : '';
    
    lines.push(`${status} ${provider.provider}: ${latency} ${models}${error}`);
  }

  lines.push('');
  lines.push('--- Summary ---');
  lines.push(`Total: ${report.summary.total}`);
  lines.push(`Successful: ${report.summary.successful}`);
  lines.push(`Failed: ${report.summary.failed}`);
  lines.push(`Average Latency: ${report.summary.averageLatency}ms`);

  return lines.join('\n');
}
