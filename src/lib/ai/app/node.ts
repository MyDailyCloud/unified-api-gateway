/**
 * Node.js 应用启动器
 * Node.js Application Launcher
 */

import { AICore, createAICore, type AICoreConfig } from '../core';
import { createHttpServer, type HttpServerConfig, type HttpServerInstance } from '../transport';
import type { StorageConfig } from '../storage/types';
import type { AIProvider } from '../types';

export interface NodeAppConfig {
  /** 核心配置 */
  core?: AICoreConfig;
  /** HTTP 服务器配置 */
  http?: HttpServerConfig;
  /** 存储配置 */
  storage?: Partial<StorageConfig>;
  /** 预配置的提供商 */
  providers?: Array<{
    provider: AIProvider;
    apiKey: string;
    baseUrl?: string;
  }>;
  /** 启动模式 */
  mode?: 'api-only' | 'internal-only' | 'full';
}

export interface NodeAppInstance {
  /** AICore 实例 */
  core: AICore;
  /** HTTP 服务器实例 */
  server: HttpServerInstance;
  /** 启动应用 */
  start(): Promise<void>;
  /** 停止应用 */
  stop(): Promise<void>;
}

/**
 * 创建 Node.js 应用
 */
export async function createNodeApp(config: NodeAppConfig = {}): Promise<NodeAppInstance> {
  const mode = config.mode ?? 'full';

  // 创建核心
  const core = await createAICore({
    ...config.core,
    storage: config.storage,
  });

  // 注册预配置的提供商
  if (config.providers) {
    const { 
      createOpenAI, 
      createAnthropic, 
      createGoogle,
      createDeepSeek,
      createMoonshot,
      createQwen,
      createGroq,
      createGLM,
    } = await import('../factory');

    for (const { provider, apiKey, baseUrl } of config.providers) {
      let adapter;
      switch (provider) {
        case 'openai':
          adapter = createOpenAI({ apiKey, baseUrl });
          break;
        case 'anthropic':
          adapter = createAnthropic({ apiKey, baseUrl });
          break;
        case 'google':
          adapter = createGoogle({ apiKey });
          break;
        case 'deepseek':
          adapter = createDeepSeek({ apiKey });
          break;
        case 'moonshot':
          adapter = createMoonshot({ apiKey });
          break;
        case 'qwen':
          adapter = createQwen({ apiKey });
          break;
        case 'groq':
          adapter = createGroq({ apiKey });
          break;
        case 'glm':
          adapter = createGLM({ apiKey });
          break;
        default:
          console.warn(`Unknown provider: ${provider}`);
          continue;
      }
      core.registerProvider(provider, adapter);
    }
  }

  // 配置 HTTP 服务器
  const httpConfig: HttpServerConfig = {
    ...config.http,
  };

  // 根据模式调整配置
  if (mode === 'api-only') {
    httpConfig.internal = { ...httpConfig.internal, prefix: '/_disabled_internal' };
  } else if (mode === 'internal-only') {
    httpConfig.api = { ...httpConfig.api, enableAuth: true };
  }

  const server = createHttpServer(core, httpConfig);

  return {
    core,
    server,
    async start() {
      await server.start();
      console.log(`Node.js AI App started in ${mode} mode`);
    },
    async stop() {
      await server.stop();
      await core.close();
      console.log('Node.js AI App stopped');
    },
  };
}

/**
 * 快速启动 Node.js 服务器
 */
export async function startNodeServer(config: NodeAppConfig = {}): Promise<NodeAppInstance> {
  const app = await createNodeApp(config);
  await app.start();
  return app;
}
