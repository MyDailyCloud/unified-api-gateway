/**
 * 本地服务自动发现
 * Local Service Auto-Discovery
 * 
 * 自动检测本地运行的 AI 推理服务
 */

import type { AIProvider } from './types';

export interface LocalServiceInfo {
  provider: AIProvider;
  name: string;
  baseURL: string;
  available: boolean;
  version?: string;
  models?: string[];
  error?: string;
}

export interface DiscoveryConfig {
  timeout?: number;
  services?: Array<{
    provider: AIProvider;
    name: string;
    url: string;
    healthEndpoint?: string;
    modelsEndpoint?: string;
    versionEndpoint?: string;
  }>;
}

// 默认服务配置
const DEFAULT_SERVICES: DiscoveryConfig['services'] = [
  {
    provider: 'ollama' as AIProvider,
    name: 'Ollama',
    url: 'http://localhost:11434',
    healthEndpoint: '/api/tags',
    modelsEndpoint: '/api/tags',
    versionEndpoint: '/api/version',
  },
  {
    provider: 'vllm' as AIProvider,
    name: 'vLLM',
    url: 'http://localhost:8000',
    healthEndpoint: '/health',
    modelsEndpoint: '/v1/models',
    versionEndpoint: '/version',
  },
  {
    provider: 'lmstudio' as AIProvider,
    name: 'LM Studio',
    url: 'http://localhost:1234',
    healthEndpoint: '/v1/models',
    modelsEndpoint: '/v1/models',
  },
  {
    provider: 'llamacpp' as AIProvider,
    name: 'llama.cpp',
    url: 'http://localhost:8080',
    healthEndpoint: '/health',
    modelsEndpoint: '/v1/models',
  },
  // 额外端口检测
  {
    provider: 'vllm' as AIProvider,
    name: 'vLLM (alt)',
    url: 'http://localhost:8001',
    healthEndpoint: '/health',
    modelsEndpoint: '/v1/models',
  },
  {
    provider: 'llamacpp' as AIProvider,
    name: 'llama.cpp (alt)',
    url: 'http://localhost:8081',
    healthEndpoint: '/health',
    modelsEndpoint: '/v1/models',
  },
];

/**
 * 自动发现本地运行的 AI 推理服务
 */
export async function discoverLocalServices(
  config?: DiscoveryConfig
): Promise<LocalServiceInfo[]> {
  const timeout = config?.timeout ?? 2000;
  const services = config?.services ?? DEFAULT_SERVICES;
  
  const results = await Promise.all(
    services.map(async (service): Promise<LocalServiceInfo> => {
      const result: LocalServiceInfo = {
        provider: service.provider,
        name: service.name,
        baseURL: service.url,
        available: false,
      };
      
      try {
        // 健康检查
        const healthUrl = `${service.url}${service.healthEndpoint || '/health'}`;
        const healthResp = await fetch(healthUrl, {
          signal: AbortSignal.timeout(timeout),
        });
        
        if (!healthResp.ok) {
          result.error = `Health check failed: ${healthResp.status}`;
          return result;
        }
        
        result.available = true;
        
        // 获取版本
        if (service.versionEndpoint) {
          try {
            const versionResp = await fetch(`${service.url}${service.versionEndpoint}`, {
              signal: AbortSignal.timeout(timeout),
            });
            if (versionResp.ok) {
              const versionData = await versionResp.json();
              result.version = versionData.version || versionData.Version || 'unknown';
            }
          } catch {
            // 忽略版本获取错误
          }
        }
        
        // 获取模型列表
        if (service.modelsEndpoint) {
          try {
            const modelsResp = await fetch(`${service.url}${service.modelsEndpoint}`, {
              signal: AbortSignal.timeout(timeout),
            });
            if (modelsResp.ok) {
              const modelsData = await modelsResp.json();
              
              // 处理不同格式的响应
              if (Array.isArray(modelsData.data)) {
                result.models = modelsData.data.map((m: any) => m.id || m.name);
              } else if (Array.isArray(modelsData.models)) {
                result.models = modelsData.models.map((m: any) => m.name || m.model);
              } else if (Array.isArray(modelsData)) {
                result.models = modelsData.map((m: any) => m.id || m.name || m);
              }
            }
          } catch {
            // 忽略模型列表获取错误
          }
        }
        
      } catch (error) {
        result.error = error instanceof Error ? error.message : 'Connection failed';
      }
      
      return result;
    })
  );
  
  // 过滤掉重复的服务 (基于 URL)
  const seen = new Set<string>();
  return results.filter(r => {
    if (seen.has(r.baseURL)) return false;
    seen.add(r.baseURL);
    return true;
  });
}

/**
 * 获取可用的本地服务
 */
export async function getAvailableLocalServices(
  config?: DiscoveryConfig
): Promise<LocalServiceInfo[]> {
  const services = await discoverLocalServices(config);
  return services.filter(s => s.available);
}

/**
 * 检测特定服务是否可用
 */
export async function isServiceAvailable(
  provider: AIProvider,
  baseURL?: string
): Promise<boolean> {
  const defaultUrls: Record<string, string> = {
    ollama: 'http://localhost:11434',
    vllm: 'http://localhost:8000',
    lmstudio: 'http://localhost:1234',
    llamacpp: 'http://localhost:8080',
  };
  
  const url = baseURL || defaultUrls[provider];
  if (!url) return false;
  
  try {
    const endpoints = ['/health', '/v1/models', '/api/tags'];
    
    for (const endpoint of endpoints) {
      try {
        const resp = await fetch(`${url}${endpoint}`, {
          signal: AbortSignal.timeout(2000),
        });
        if (resp.ok) return true;
      } catch {
        continue;
      }
    }
    
    return false;
  } catch {
    return false;
  }
}

/**
 * 创建服务发现器
 */
export function createServiceDiscovery(config?: DiscoveryConfig) {
  let cachedResults: LocalServiceInfo[] | null = null;
  let lastDiscoveryTime = 0;
  const cacheTimeout = 30000; // 30 秒缓存
  
  return {
    /**
     * 发现所有服务
     */
    async discover(force = false): Promise<LocalServiceInfo[]> {
      const now = Date.now();
      if (!force && cachedResults && now - lastDiscoveryTime < cacheTimeout) {
        return cachedResults;
      }
      
      cachedResults = await discoverLocalServices(config);
      lastDiscoveryTime = now;
      return cachedResults;
    },
    
    /**
     * 获取可用服务
     */
    async getAvailable(): Promise<LocalServiceInfo[]> {
      const services = await this.discover();
      return services.filter(s => s.available);
    },
    
    /**
     * 检查特定服务
     */
    async check(provider: AIProvider, baseURL?: string): Promise<boolean> {
      return isServiceAvailable(provider, baseURL);
    },
    
    /**
     * 清除缓存
     */
    clearCache(): void {
      cachedResults = null;
      lastDiscoveryTime = 0;
    },
  };
}

// 导出默认发现器
export const serviceDiscovery = createServiceDiscovery();
