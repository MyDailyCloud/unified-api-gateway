/**
 * AI Provider Registry
 * Provider 注册表
 * 
 * 借鉴 Vercel AI SDK 的设计，提供统一的 Provider 路由能力
 */

import type { ProviderConfig, ModelInfo } from './types';
import type { ModelReference } from './factory';
import { AIClient } from './client';

// ============= 类型定义 =============

export interface ProviderFactory {
  (modelId: string): ModelReference;
}

export interface ProviderRegistryConfig {
  providers: Record<string, ProviderFactory>;
  defaultProvider?: string;
}

export interface ProviderRegistry {
  /**
   * 获取语言模型引用
   * @param id 格式: "provider/model" 或 "model"（使用默认 provider）
   */
  languageModel(id: string): ModelReference;
  
  /**
   * 注册新的 provider
   */
  registerProvider(name: string, factory: ProviderFactory): void;
  
  /**
   * 获取所有已注册的 provider
   */
  getProviders(): string[];
  
  /**
   * 检查 provider 是否已注册
   */
  hasProvider(name: string): boolean;
  
  /**
   * 创建绑定的 AI 客户端
   */
  createClient(): AIClient;
}

// ============= 实现 =============

/**
 * 创建 Provider 注册表
 * 
 * @example
 * import { createProviderRegistry, createOpenAI, createAnthropic } from '@/lib/ai';
 * 
 * const registry = createProviderRegistry({
 *   providers: {
 *     openai: createOpenAI({ apiKey: 'sk-xxx' }),
 *     anthropic: createAnthropic({ apiKey: 'sk-ant-xxx' }),
 *   },
 *   defaultProvider: 'openai',
 * });
 * 
 * // 获取模型
 * const model = registry.languageModel('openai/gpt-4o');
 * const defaultModel = registry.languageModel('gpt-4o'); // 使用默认 provider
 */
export function createProviderRegistry(config: ProviderRegistryConfig): ProviderRegistry {
  const providers = new Map<string, ProviderFactory>(Object.entries(config.providers));
  const defaultProvider = config.defaultProvider;

  return {
    languageModel(id: string): ModelReference {
      const parts = id.split('/');
      let providerName: string;
      let modelId: string;

      if (parts.length >= 2) {
        // 格式: "provider/model"
        providerName = parts[0];
        modelId = parts.slice(1).join('/');
      } else {
        // 只有 model，使用默认 provider
        if (!defaultProvider) {
          throw new Error(
            `No default provider configured. Use "provider/model" format or set defaultProvider.`
          );
        }
        providerName = defaultProvider;
        modelId = id;
      }

      const factory = providers.get(providerName);
      if (!factory) {
        throw new Error(
          `Provider "${providerName}" not found. Available: ${Array.from(providers.keys()).join(', ')}`
        );
      }

      return factory(modelId);
    },

    registerProvider(name: string, factory: ProviderFactory): void {
      providers.set(name, factory);
    },

    getProviders(): string[] {
      return Array.from(providers.keys());
    },

    hasProvider(name: string): boolean {
      return providers.has(name);
    },

    createClient(): AIClient {
      const client = new AIClient();
      
      // 注册所有 providers
      for (const [name, factory] of providers) {
        // 调用工厂获取默认模型的配置
        const ref = factory('');
        client.registerProvider(ref.config);
      }
      
      return client;
    },
  };
}

// ============= 预设 Registry =============

/**
 * 创建空的 Provider Registry
 */
export function createEmptyRegistry(): ProviderRegistry {
  return createProviderRegistry({ providers: {} });
}

// ============= 模型路由器 =============

export interface ModelRouter {
  route(modelId: string): { provider: string; model: string };
}

/**
 * 创建智能模型路由器
 * 根据模型 ID 自动识别 provider
 * 
 * @example
 * const router = createModelRouter();
 * router.route('gpt-4o') // { provider: 'openai', model: 'gpt-4o' }
 * router.route('claude-sonnet-4-5') // { provider: 'anthropic', model: 'claude-sonnet-4-5' }
 */
export function createModelRouter(): ModelRouter {
  const patterns: Array<{ pattern: RegExp; provider: string }> = [
    // OpenAI
    { pattern: /^(gpt-|o1-|o3-|o4-|text-|dall-e|whisper|tts)/i, provider: 'openai' },
    // Anthropic
    { pattern: /^claude/i, provider: 'anthropic' },
    // Google
    { pattern: /^gemini/i, provider: 'google' },
    // Cerebras
    { pattern: /^(llama.*cerebras|cs-)/i, provider: 'cerebras' },
    // GLM
    { pattern: /^(glm-|chatglm)/i, provider: 'glm' },
    // Groq
    { pattern: /^(llama-|mixtral-|gemma-).*(groq)/i, provider: 'groq' },
    // DeepSeek
    { pattern: /^deepseek/i, provider: 'deepseek' },
    // Moonshot
    { pattern: /^moonshot/i, provider: 'moonshot' },
    // Qwen
    { pattern: /^(qwen|qwq)/i, provider: 'qwen' },
  ];

  return {
    route(modelId: string): { provider: string; model: string } {
      // 如果已经包含 provider 前缀
      if (modelId.includes('/')) {
        const [provider, ...rest] = modelId.split('/');
        return { provider, model: rest.join('/') };
      }

      // 根据模型名称模式匹配
      for (const { pattern, provider } of patterns) {
        if (pattern.test(modelId)) {
          return { provider, model: modelId };
        }
      }

      // 默认返回 openai
      return { provider: 'openai', model: modelId };
    },
  };
}

// ============= 类型导出 =============

export type { ModelReference } from './factory';
