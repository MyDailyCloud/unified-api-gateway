/**
 * API Key 数据模型
 * API Key Data Model
 * 
 * 安全存储提供商 API 密钥
 */

import type { AIProvider } from '../types';
import type { UnifiedStorage } from '../storage/types';
import type { CryptoProvider } from '../storage/encryption';

// ==================== API Key 类型定义 ====================

export interface StoredApiKey {
  provider: AIProvider;
  encryptedKey: string;
  createdAt: number;
  updatedAt: number;
  label?: string;
  isValid?: boolean;
  lastValidatedAt?: number;
}

export interface ApiKeyInput {
  provider: AIProvider;
  apiKey: string;
  label?: string;
}

// ==================== 存储键 ====================

const API_KEY_PREFIX = 'apikey:';

// ==================== API Key 管理器 ====================

export class ApiKeyManager {
  private crypto: CryptoProvider;
  private encryptionKey: string;

  constructor(
    private storage: UnifiedStorage,
    crypto: CryptoProvider,
    encryptionKey: string
  ) {
    this.crypto = crypto;
    this.encryptionKey = encryptionKey;
  }

  /**
   * 存储 API Key
   */
  async store(input: ApiKeyInput): Promise<StoredApiKey> {
    const encryptedKey = await this.crypto.encrypt(input.apiKey, this.encryptionKey);
    const now = Date.now();
    
    const stored: StoredApiKey = {
      provider: input.provider,
      encryptedKey,
      label: input.label,
      createdAt: now,
      updatedAt: now,
    };
    
    await this.storage.set(`${API_KEY_PREFIX}${input.provider}`, stored);
    return stored;
  }

  /**
   * 获取解密的 API Key
   */
  async get(provider: AIProvider): Promise<string | null> {
    const stored = await this.storage.get<StoredApiKey>(`${API_KEY_PREFIX}${provider}`);
    if (!stored) return null;
    
    try {
      return await this.crypto.decrypt(stored.encryptedKey, this.encryptionKey);
    } catch {
      console.error(`Failed to decrypt API key for ${provider}`);
      return null;
    }
  }

  /**
   * 获取存储的 API Key 元数据（不含实际密钥）
   */
  async getMetadata(provider: AIProvider): Promise<Omit<StoredApiKey, 'encryptedKey'> | null> {
    const stored = await this.storage.get<StoredApiKey>(`${API_KEY_PREFIX}${provider}`);
    if (!stored) return null;
    
    const { encryptedKey, ...metadata } = stored;
    return metadata;
  }

  /**
   * 删除 API Key
   */
  async delete(provider: AIProvider): Promise<boolean> {
    return this.storage.delete(`${API_KEY_PREFIX}${provider}`);
  }

  /**
   * 列出所有存储的提供商
   */
  async listProviders(): Promise<AIProvider[]> {
    const keys = await this.storage.keys(API_KEY_PREFIX);
    return keys.map(k => k.replace(API_KEY_PREFIX, '') as AIProvider);
  }

  /**
   * 检查提供商是否有存储的 API Key
   */
  async has(provider: AIProvider): Promise<boolean> {
    return this.storage.has(`${API_KEY_PREFIX}${provider}`);
  }

  /**
   * 更新验证状态
   */
  async updateValidation(provider: AIProvider, isValid: boolean): Promise<void> {
    const stored = await this.storage.get<StoredApiKey>(`${API_KEY_PREFIX}${provider}`);
    if (!stored) return;
    
    stored.isValid = isValid;
    stored.lastValidatedAt = Date.now();
    stored.updatedAt = Date.now();
    
    await this.storage.set(`${API_KEY_PREFIX}${provider}`, stored);
  }

  /**
   * 获取所有 API Key 的元数据
   */
  async listAll(): Promise<Array<Omit<StoredApiKey, 'encryptedKey'>>> {
    const providers = await this.listProviders();
    const result: Array<Omit<StoredApiKey, 'encryptedKey'>> = [];
    
    for (const provider of providers) {
      const metadata = await this.getMetadata(provider);
      if (metadata) {
        result.push(metadata);
      }
    }
    
    return result;
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建 API Key 管理器
 */
export function createApiKeyManager(
  storage: UnifiedStorage,
  crypto: CryptoProvider,
  encryptionKey: string
): ApiKeyManager {
  return new ApiKeyManager(storage, crypto, encryptionKey);
}

/**
 * 生成加密密钥（用于首次初始化）
 */
export function generateEncryptionKey(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  
  // 回退方案
  return Math.random().toString(36).slice(2) + 
         Math.random().toString(36).slice(2) + 
         Math.random().toString(36).slice(2);
}
