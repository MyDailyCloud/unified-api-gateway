/**
 * 统一 AI SDK 导出
 * Unified AI SDK Exports
 */

// 类型
export * from './types';

// 适配器
export * from './adapters';

// 客户端
export { AIClient, getAIClient, setAIClient, type AIClientConfig } from './client';

// Hooks
export { useAI, useChat, type UseAIOptions, type UseAIReturn, type UseChatOptions, type UseChatReturn } from './hooks/use-ai';

// 工厂函数
export {
  createOpenAI,
  createAnthropic,
  createGoogle,
  createAzureOpenAI,
  createCerebras,
  createGLM,
  createGroq,
  createDeepSeek,
  createMoonshot,
  createQwen,
  createCustomProvider,
  createMultimodalOpenAI,
  createMultimodalGoogle,
  type OpenAIFactoryConfig,
  type AnthropicFactoryConfig,
  type GoogleFactoryConfig,
  type AzureOpenAIFactoryConfig,
  type GenericFactoryConfig,
  type ModelReference,
  type MultimodalProviderConfig,
  type MultimodalModelRef,
} from './factory';

// 注册表
export {
  createProviderRegistry,
  createEmptyRegistry,
  createModelRouter,
  type ProviderFactory,
  type ProviderRegistry,
  type ProviderRegistryConfig,
  type ModelRouter,
} from './registry';

// 中间件
export {
  MiddlewareManager,
  createMiddlewareManager,
  createLoggingMiddleware,
  createPerformanceMiddleware,
  createRetryMiddleware,
  generateRequestId,
  type AIMiddleware,
  type MiddlewareContext,
} from './middleware';

// 缓存
export {
  MemoryCache,
  LocalStorageCache,
  createCache,
  defaultCacheKeyGenerator,
  type AICache,
  type CacheConfig,
  type CacheEntry,
  type CacheStats,
} from './cache';

// 请求队列
export {
  RequestQueue,
  ProviderRateLimiter,
  createRequestQueue,
  createProviderRateLimiter,
  RATE_LIMIT_PRESETS,
  type QueueConfig,
  type QueuedRequest,
  type QueueStats,
} from './queue';

// 成本追踪
export {
  CostTracker,
  createCostTracker,
  formatCost,
  formatTokens,
  MODEL_PRICING,
  type TokenUsage,
  type CostRecord,
  type UsageStats,
  type BillingReport,
  type CostTrackerConfig,
  type PricingInfo,
} from './cost-tracker';

// 诊断工具
export {
  AIDiagnostics,
  createDiagnostics,
  formatDiagnosticsReport,
  type ConnectionTestResult,
  type DiagnosticsReport,
  type HealthCheckOptions,
} from './diagnostics';

// 增强客户端
export {
  EnhancedAIClient,
  getEnhancedAIClient,
  setEnhancedAIClient,
  createEnhancedAIClient,
  type EnhancedAIClientConfig,
} from './enhanced-client';

// Electron 集成
export * from './electron';
