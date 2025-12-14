/**
 * AI SDK Server Configuration Loader
 * 配置加载器 - 支持文件配置和环境变量
 */

import type { AIProvider } from '../types';

export interface ProviderConfigEntry {
  provider: AIProvider;
  apiKey: string; // 支持 "env:VAR_NAME" 格式
  baseUrl?: string;
  defaultModel?: string;
}

export interface ServerConfig {
  port: number;
  host: string;
  providers: ProviderConfigEntry[];
  cors?: {
    enabled: boolean;
    origins?: string[];
  };
  rateLimit?: {
    enabled: boolean;
    maxRequests: number;
    windowMs: number;
  };
  logging?: {
    enabled: boolean;
    level: 'debug' | 'info' | 'warn' | 'error';
  };
}

const DEFAULT_CONFIG: ServerConfig = {
  port: 3000,
  host: '0.0.0.0',
  providers: [],
  cors: {
    enabled: true,
    origins: ['*'],
  },
  logging: {
    enabled: true,
    level: 'info',
  },
};

/**
 * 解析环境变量引用
 * Parse environment variable references like "env:OPENAI_API_KEY"
 */
export function resolveEnvValue(value: string): string {
  if (value.startsWith('env:')) {
    const envKey = value.slice(4);
    const envValue = process.env[envKey];
    if (!envValue) {
      console.warn(`Warning: Environment variable ${envKey} is not set`);
      return '';
    }
    return envValue;
  }
  return value;
}

/**
 * 从文件加载配置
 * Load configuration from file (.ai-sdk.json or ai-sdk.config.json)
 */
export async function loadConfigFromFile(configPath?: string): Promise<Partial<ServerConfig>> {
  const fs = await import('fs').then(m => m.promises);
  const path = await import('path');
  
  const configFiles = configPath 
    ? [configPath]
    : [
        '.ai-sdk.json',
        'ai-sdk.config.json',
        path.join(process.cwd(), '.ai-sdk.json'),
        path.join(process.cwd(), 'ai-sdk.config.json'),
      ];

  for (const file of configFiles) {
    try {
      const content = await fs.readFile(file, 'utf-8');
      const config = JSON.parse(content);
      console.log(`Loaded config from ${file}`);
      return config;
    } catch {
      // File not found or invalid, continue
    }
  }

  return {};
}

/**
 * 从环境变量加载配置
 * Load configuration from environment variables
 */
export function loadConfigFromEnv(): Partial<ServerConfig> {
  const config: Partial<ServerConfig> = {};

  if (process.env.AI_SDK_PORT) {
    config.port = parseInt(process.env.AI_SDK_PORT, 10);
  }

  if (process.env.AI_SDK_HOST) {
    config.host = process.env.AI_SDK_HOST;
  }

  // 自动检测常见的 API Key 环境变量
  // Auto-detect common API key environment variables
  const providers: ProviderConfigEntry[] = [];

  const providerEnvMap: Record<string, AIProvider> = {
    OPENAI_API_KEY: 'openai' as AIProvider,
    ANTHROPIC_API_KEY: 'anthropic' as AIProvider,
    GOOGLE_API_KEY: 'google' as AIProvider,
    DEEPSEEK_API_KEY: 'deepseek' as AIProvider,
    GROQ_API_KEY: 'groq' as AIProvider,
    MISTRAL_API_KEY: 'mistral' as AIProvider,
    COHERE_API_KEY: 'cohere' as AIProvider,
    TOGETHER_API_KEY: 'together' as AIProvider,
    OPENROUTER_API_KEY: 'openrouter' as AIProvider,
    QWEN_API_KEY: 'qwen' as AIProvider,
    MOONSHOT_API_KEY: 'moonshot' as AIProvider,
    GLM_API_KEY: 'glm' as AIProvider,
    CEREBRAS_API_KEY: 'cerebras' as AIProvider,
  };

  for (const [envKey, provider] of Object.entries(providerEnvMap)) {
    if (process.env[envKey]) {
      providers.push({
        provider,
        apiKey: process.env[envKey]!,
      });
    }
  }

  // Ollama 特殊处理（不需要 API Key）
  if (process.env.OLLAMA_HOST || process.env.OLLAMA_BASE_URL) {
    providers.push({
      provider: 'ollama' as AIProvider,
      apiKey: '',
      baseUrl: process.env.OLLAMA_HOST || process.env.OLLAMA_BASE_URL,
    });
  }

  if (providers.length > 0) {
    config.providers = providers;
  }

  return config;
}

/**
 * 合并并解析完整配置
 * Merge and resolve complete configuration
 */
export async function loadConfig(configPath?: string): Promise<ServerConfig> {
  const fileConfig = await loadConfigFromFile(configPath);
  const envConfig = loadConfigFromEnv();

  // 合并配置：环境变量 > 文件配置 > 默认配置
  const merged: ServerConfig = {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    ...envConfig,
  };

  // 合并 providers（文件 + 环境变量）
  const fileProviders = fileConfig.providers || [];
  const envProviders = envConfig.providers || [];
  
  // 使用 Map 去重，环境变量优先
  const providerMap = new Map<AIProvider, ProviderConfigEntry>();
  
  for (const p of fileProviders) {
    providerMap.set(p.provider, {
      ...p,
      apiKey: resolveEnvValue(p.apiKey),
    });
  }
  
  for (const p of envProviders) {
    providerMap.set(p.provider, p);
  }

  merged.providers = Array.from(providerMap.values());

  return merged;
}

/**
 * 验证配置有效性
 * Validate configuration
 */
export function validateConfig(config: ServerConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.port < 1 || config.port > 65535) {
    errors.push(`Invalid port: ${config.port}`);
  }

  if (config.providers.length === 0) {
    errors.push('No providers configured. Set API keys via environment variables or config file.');
  }

  for (const p of config.providers) {
    if (!p.provider) {
      errors.push('Provider entry missing "provider" field');
    }
    const noKeyProviders = ['ollama', 'lmstudio', 'llamacpp', 'vllm'];
    if (!p.apiKey && !noKeyProviders.includes(p.provider)) {
      errors.push(`Provider ${p.provider} requires an API key`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 生成示例配置文件
 * Generate example configuration file
 */
export function generateExampleConfig(): string {
  const example: ServerConfig = {
    port: 3000,
    host: '0.0.0.0',
    providers: [
      { provider: 'openai' as AIProvider, apiKey: 'env:OPENAI_API_KEY' },
      { provider: 'anthropic' as AIProvider, apiKey: 'env:ANTHROPIC_API_KEY' },
      { provider: 'ollama' as AIProvider, apiKey: '', baseUrl: 'http://localhost:11434' },
    ],
    cors: {
      enabled: true,
      origins: ['*'],
    },
    logging: {
      enabled: true,
      level: 'info',
    },
  };

  return JSON.stringify(example, null, 2);
}
