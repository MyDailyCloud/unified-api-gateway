/**
 * AICore - 统一核心入口
 * AICore - Unified Core Entry Point
 */

import { AIClient, getAIClient } from '../client';
import { ProviderRateLimiter, createProviderRateLimiter } from '../queue';
import { createStorage, type UnifiedStorage } from '../storage';
import { generateEncryptionKey } from '../models/api-key';
import { AIService } from './ai-service';
import { InternalService } from './internal-service';
import type { AICoreConfig, AIServiceConfig, InternalServiceConfig } from './types';
import type { AIProvider, ProviderConfig, AIAdapter } from '../types';

export class AICore {
  /** 对外 AI 服务（OpenAI 兼容 API） */
  readonly ai: AIService;
  
  /** 内部服务（UI 使用） */
  readonly internal: InternalService;
  
  /** 统一存储 */
  readonly storage: UnifiedStorage;
  
  /** 速率限制器 */
  readonly rateLimiter: ProviderRateLimiter;
  
  /** AI 客户端 */
  readonly client: AIClient;
  
  private constructor(
    client: AIClient,
    storage: UnifiedStorage,
    rateLimiter: ProviderRateLimiter,
    aiService: AIService,
    internalService: InternalService
  ) {
    this.client = client;
    this.storage = storage;
    this.rateLimiter = rateLimiter;
    this.ai = aiService;
    this.internal = internalService;
  }

  /**
   * 创建 AICore 实例
   */
  static async create(config: AICoreConfig = {}): Promise<AICore> {
    // 创建存储
    const storage = await createStorage(config.storage);
    
    // 获取或创建客户端
    const client = getAIClient() ?? new AIClient();
    
    // 创建速率限制器
    const rateLimiter = config.enableRateLimiting !== false
      ? createProviderRateLimiter()
      : createProviderRateLimiter(); // 始终创建，但可以禁用
    
    // 加密密钥
    const encryptionKey = config.encryptionKey ?? generateEncryptionKey();
    
    // 创建服务
    const aiService = new AIService(client, rateLimiter, {});
    const internalService = new InternalService(
      client,
      rateLimiter,
      storage,
      encryptionKey,
      {}
    );
    
    return new AICore(client, storage, rateLimiter, aiService, internalService);
  }

  /**
   * 注册提供商（使用 ProviderConfig）
   */
  registerProvider(config: ProviderConfig): void {
    this.client.registerProvider(config);
  }

  /**
   * 使用适配器注册提供商
   */
  registerProviderWithAdapter(provider: AIProvider, adapter: AIAdapter): void {
    // 直接设置适配器
    (this.client as any).adapters.set(provider, adapter);
  }

  /**
   * 获取已注册的提供商
   */
  getRegisteredProviders(): AIProvider[] {
    return this.client.getProviders();
  }

  /**
   * 关闭并清理资源
   */
  async close(): Promise<void> {
    if (this.storage.close) {
      await this.storage.close();
    }
  }
}

/**
 * 创建 AICore 实例
 */
export async function createAICore(config: AICoreConfig = {}): Promise<AICore> {
  return AICore.create(config);
}

// 导出类型
export * from './types';
export { AIService } from './ai-service';
export { InternalService } from './internal-service';
