/**
 * AI Provider 工厂函数 - 全模态支持
 * AI Provider Factory Functions - Full Multimodal Support
 * 
 * 借鉴 Vercel AI SDK 的设计模式，提供类似 createOpenAI 的工厂函数
 */

import type { ProviderConfig, AIProvider } from './types';
import { AIClient } from './client';

// ============= 配置类型 =============

export interface OpenAIFactoryConfig {
  apiKey: string;
  baseURL?: string;
  organization?: string;
  defaultModel?: string;
}

export interface AnthropicFactoryConfig {
  apiKey: string;
  baseURL?: string;
  anthropicVersion?: string;
  defaultModel?: string;
}

export interface GoogleFactoryConfig {
  apiKey: string;
  baseURL?: string;
  defaultModel?: string;
}

export interface AzureOpenAIFactoryConfig {
  apiKey: string;
  resourceName: string;
  deploymentName: string;
  apiVersion?: string;
}

export interface GenericFactoryConfig {
  apiKey: string;
  baseURL?: string;
  defaultModel?: string;
  headers?: Record<string, string>;
}

// ============= 模型引用类型 =============

export interface ModelReference {
  provider: string;
  modelId: string;
  config: ProviderConfig;
}

// ============= 工厂函数 =============

/**
 * 创建 OpenAI 提供商
 * 
 * @example
 * const openai = createOpenAI({ apiKey: 'sk-xxx' });
 * const model = openai('gpt-4o');
 */
export function createOpenAI(config: OpenAIFactoryConfig) {
  return (modelId?: string): ModelReference => ({
    provider: 'openai',
    modelId: modelId || config.defaultModel || 'gpt-4o-mini',
    config: {
      provider: 'openai',
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      headers: config.organization 
        ? { 'OpenAI-Organization': config.organization }
        : undefined,
    },
  });
}

/**
 * 创建 Anthropic 提供商
 * 
 * @example
 * const anthropic = createAnthropic({ apiKey: 'sk-ant-xxx' });
 * const model = anthropic('claude-sonnet-4-5');
 */
export function createAnthropic(config: AnthropicFactoryConfig) {
  return (modelId?: string): ModelReference => ({
    provider: 'anthropic',
    modelId: modelId || config.defaultModel || 'claude-sonnet-4-5',
    config: {
      provider: 'anthropic',
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      headers: {
        'anthropic-version': config.anthropicVersion || '2023-06-01',
      },
    },
  });
}

/**
 * 创建 Google (Gemini) 提供商
 * 
 * @example
 * const google = createGoogle({ apiKey: 'xxx' });
 * const model = google('gemini-2.5-pro');
 */
export function createGoogle(config: GoogleFactoryConfig) {
  return (modelId?: string): ModelReference => ({
    provider: 'google',
    modelId: modelId || config.defaultModel || 'gemini-2.5-pro',
    config: {
      provider: 'openai', // Google API 兼容 OpenAI 格式
      apiKey: config.apiKey,
      baseURL: config.baseURL || 'https://generativelanguage.googleapis.com/v1beta/openai',
    },
  });
}

/**
 * 创建 Azure OpenAI 提供商
 * 
 * @example
 * const azure = createAzureOpenAI({
 *   apiKey: 'xxx',
 *   resourceName: 'my-resource',
 *   deploymentName: 'gpt-4',
 * });
 * const model = azure();
 */
export function createAzureOpenAI(config: AzureOpenAIFactoryConfig) {
  const apiVersion = config.apiVersion || '2024-02-15-preview';
  const baseURL = `https://${config.resourceName}.openai.azure.com/openai/deployments/${config.deploymentName}`;
  
  return (modelId?: string): ModelReference => ({
    provider: 'azure',
    modelId: modelId || config.deploymentName,
    config: {
      provider: 'openai',
      apiKey: config.apiKey,
      baseURL,
      headers: {
        'api-key': config.apiKey,
      },
    },
  });
}

/**
 * 创建 Cerebras 提供商
 * 
 * @example
 * const cerebras = createCerebras({ apiKey: 'csk-xxx' });
 * const model = cerebras('llama3.1-70b');
 */
export function createCerebras(config: GenericFactoryConfig) {
  return (modelId?: string): ModelReference => ({
    provider: 'cerebras',
    modelId: modelId || config.defaultModel || 'llama3.1-70b',
    config: {
      provider: 'cerebras',
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    },
  });
}

/**
 * 创建智谱 GLM 提供商
 * 
 * @example
 * const glm = createGLM({ apiKey: 'xxx.xxx' });
 * const model = glm('glm-4-plus');
 */
export function createGLM(config: GenericFactoryConfig) {
  return (modelId?: string): ModelReference => ({
    provider: 'glm',
    modelId: modelId || config.defaultModel || 'glm-4-plus',
    config: {
      provider: 'glm',
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    },
  });
}

/**
 * 创建 Groq 提供商
 * 
 * @example
 * const groq = createGroq({ apiKey: 'gsk_xxx' });
 * const model = groq('llama-3.3-70b-versatile');
 */
export function createGroq(config: GenericFactoryConfig) {
  return (modelId?: string): ModelReference => ({
    provider: 'groq',
    modelId: modelId || config.defaultModel || 'llama-3.3-70b-versatile',
    config: {
      provider: 'groq',
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    },
  });
}

/**
 * 创建 DeepSeek 提供商
 * 
 * @example
 * const deepseek = createDeepSeek({ apiKey: 'sk-xxx' });
 * const model = deepseek('deepseek-chat');
 */
export function createDeepSeek(config: GenericFactoryConfig) {
  return (modelId?: string): ModelReference => ({
    provider: 'deepseek',
    modelId: modelId || config.defaultModel || 'deepseek-chat',
    config: {
      provider: 'deepseek',
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    },
  });
}

/**
 * 创建 Moonshot (Kimi) 提供商
 * 
 * @example
 * const moonshot = createMoonshot({ apiKey: 'sk-xxx' });
 * const model = moonshot('moonshot-v1-128k');
 */
export function createMoonshot(config: GenericFactoryConfig) {
  return (modelId?: string): ModelReference => ({
    provider: 'moonshot',
    modelId: modelId || config.defaultModel || 'moonshot-v1-128k',
    config: {
      provider: 'moonshot',
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    },
  });
}

/**
 * 创建通义千问 (Qwen) 提供商
 * 
 * @example
 * const qwen = createQwen({ apiKey: 'sk-xxx' });
 * const model = qwen('qwen-max');
 */
export function createQwen(config: GenericFactoryConfig) {
  return (modelId?: string): ModelReference => ({
    provider: 'qwen',
    modelId: modelId || config.defaultModel || 'qwen-max',
    config: {
      provider: 'qwen',
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    },
  });
}

/**
 * 创建自定义提供商
 * 
 * @example
 * const custom = createCustomProvider({
 *   apiKey: 'xxx',
 *   baseURL: 'https://your-api.com/v1',
 * });
 * const model = custom('your-model');
 */
export function createCustomProvider(config: GenericFactoryConfig & { name?: string }) {
  return (modelId: string): ModelReference => ({
    provider: config.name || 'custom',
    modelId,
    config: {
      provider: 'custom',
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      headers: config.headers,
    },
  });
}

// ============= 全模态工厂对象 =============

/**
 * 全模态提供商配置
 */
export interface MultimodalProviderConfig {
  apiKey: string;
  baseURL?: string;
  defaultModel?: string;
  organization?: string;
}

/**
 * 全模态模型引用
 */
export interface MultimodalModelRef {
  chat: (modelId?: string) => ModelReference;
  embedding: (modelId?: string) => ModelReference;
  image: (modelId?: string) => ModelReference;
  speech: (modelId?: string) => ModelReference;
  transcription: (modelId?: string) => ModelReference;
}

/**
 * 创建全模态 OpenAI 提供商
 * 
 * @example
 * const openai = createMultimodalOpenAI({ apiKey: 'sk-xxx' });
 * 
 * // 文本生成
 * const chatModel = openai.chat('gpt-4o');
 * 
 * // 文本嵌入
 * const embedModel = openai.embedding('text-embedding-3-small');
 * 
 * // 图像生成
 * const imageModel = openai.image('dall-e-3');
 * 
 * // 语音合成
 * const speechModel = openai.speech('tts-1');
 * 
 * // 语音识别
 * const transcriptionModel = openai.transcription('whisper-1');
 */
export function createMultimodalOpenAI(config: MultimodalProviderConfig): MultimodalModelRef {
  const baseConfig: ProviderConfig = {
    provider: 'openai',
    apiKey: config.apiKey,
    baseURL: config.baseURL || 'https://api.openai.com/v1',
    headers: config.organization ? { 'OpenAI-Organization': config.organization } : undefined,
  };
  
  return {
    chat: (modelId?: string): ModelReference => ({
      provider: 'openai',
      modelId: modelId || config.defaultModel || 'gpt-4o-mini',
      config: baseConfig,
    }),
    embedding: (modelId?: string): ModelReference => ({
      provider: 'openai',
      modelId: modelId || 'text-embedding-3-small',
      config: baseConfig,
    }),
    image: (modelId?: string): ModelReference => ({
      provider: 'openai',
      modelId: modelId || 'dall-e-3',
      config: baseConfig,
    }),
    speech: (modelId?: string): ModelReference => ({
      provider: 'openai',
      modelId: modelId || 'tts-1',
      config: baseConfig,
    }),
    transcription: (modelId?: string): ModelReference => ({
      provider: 'openai',
      modelId: modelId || 'whisper-1',
      config: baseConfig,
    }),
  };
}

/**
 * 创建全模态 Google 提供商
 */
export function createMultimodalGoogle(config: MultimodalProviderConfig): Partial<MultimodalModelRef> {
  const baseConfig: ProviderConfig = {
    provider: 'google',
    apiKey: config.apiKey,
    baseURL: config.baseURL || 'https://generativelanguage.googleapis.com/v1beta',
  };
  
  return {
    chat: (modelId?: string): ModelReference => ({
      provider: 'google',
      modelId: modelId || config.defaultModel || 'gemini-2.5-pro',
      config: baseConfig,
    }),
    embedding: (modelId?: string): ModelReference => ({
      provider: 'google',
      modelId: modelId || 'text-embedding-004',
      config: baseConfig,
    }),
    image: (modelId?: string): ModelReference => ({
      provider: 'google',
      modelId: modelId || 'gemini-2.0-flash-exp',
      config: baseConfig,
    }),
  };
}
