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
  type OpenAIFactoryConfig,
  type AnthropicFactoryConfig,
  type GoogleFactoryConfig,
  type AzureOpenAIFactoryConfig,
  type GenericFactoryConfig,
  type ModelReference,
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
