/**
 * Gateway API Key 管理
 * Gateway API Key Management
 */

// 默认密钥存储路径
const DEFAULT_KEYS_PATH = './.ai-server-gateway-keys.json';

/** Gateway API Key */
export interface GatewayApiKey {
  /** 密钥 ID */
  id: string;
  /** 密钥名称（用于识别） */
  name: string;
  /** 密钥前缀（用于显示，如 sk-...abc） */
  prefix: string;
  /** 密钥哈希（不存储明文） */
  keyHash: string;
  /** 创建时间 */
  createdAt: number;
  /** 最后使用时间 */
  lastUsedAt?: number;
  /** 过期时间（可选） */
  expiresAt?: number;
  /** 是否启用 */
  enabled: boolean;
  /** 权限范围 */
  scopes?: string[];
  /** 速率限制（每分钟请求数） */
  rateLimit?: number;
  /** 使用统计 */
  usageCount: number;
}

/** 创建密钥请求 */
export interface CreateKeyRequest {
  name: string;
  expiresIn?: number; // 毫秒
  scopes?: string[];
  rateLimit?: number;
}

/** 创建密钥响应 */
export interface CreateKeyResponse {
  id: string;
  name: string;
  key: string; // 明文密钥，仅在创建时返回
  prefix: string;
  createdAt: number;
  expiresAt?: number;
}

/** 密钥存储格式 */
interface KeysStorage {
  version: number;
  keys: GatewayApiKey[];
}

/**
 * 生成随机密钥
 */
function generateApiKey(prefix: string = 'gw'): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const length = 48;
  let key = '';
  
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
      key += chars[array[i] % chars.length];
    }
  } else {
    for (let i = 0; i < length; i++) {
      key += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  
  return `${prefix}-${key}`;
}

/**
 * 生成密钥 ID
 */
function generateKeyId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `key_${timestamp}${random}`;
}

/**
 * 获取密钥前缀（用于显示）
 */
function getKeyPrefix(key: string): string {
  if (key.length <= 12) return key;
  return `${key.substring(0, 6)}...${key.substring(key.length - 4)}`;
}

/**
 * 哈希密钥
 */
async function hashKey(key: string): Promise<string> {
  // 尝试使用 Web Crypto API
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  // 尝试使用 Node.js crypto
  try {
    const nodeCrypto = await import('crypto');
    return nodeCrypto.createHash('sha256').update(key).digest('hex');
  } catch {
    // 简单回退哈希
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
  }
}

/**
 * Gateway API Key 管理器
 */
export class GatewayKeyManager {
  private keysPath: string;
  private keys: Map<string, GatewayApiKey> = new Map();
  private keyHashIndex: Map<string, string> = new Map(); // hash -> id

  constructor(keysPath: string = DEFAULT_KEYS_PATH) {
    this.keysPath = keysPath;
  }

  /**
   * 加载密钥
   */
  async load(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const data = await fs.readFile(this.keysPath, 'utf-8');
      const storage: KeysStorage = JSON.parse(data);
      
      this.keys.clear();
      this.keyHashIndex.clear();
      
      for (const key of storage.keys) {
        this.keys.set(key.id, key);
        this.keyHashIndex.set(key.keyHash, key.id);
      }
    } catch {
      // 文件不存在或无效，使用空集合
      this.keys.clear();
      this.keyHashIndex.clear();
    }
  }

  /**
   * 保存密钥
   */
  async save(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const storage: KeysStorage = {
        version: 1,
        keys: Array.from(this.keys.values()),
      };
      await fs.writeFile(this.keysPath, JSON.stringify(storage, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save gateway keys:', error);
      throw error;
    }
  }

  /**
   * 创建新密钥
   */
  async create(request: CreateKeyRequest): Promise<CreateKeyResponse> {
    const id = generateKeyId();
    const key = generateApiKey();
    const keyHash = await hashKey(key);
    const now = Date.now();

    const apiKey: GatewayApiKey = {
      id,
      name: request.name,
      prefix: getKeyPrefix(key),
      keyHash,
      createdAt: now,
      expiresAt: request.expiresIn ? now + request.expiresIn : undefined,
      enabled: true,
      scopes: request.scopes,
      rateLimit: request.rateLimit,
      usageCount: 0,
    };

    this.keys.set(id, apiKey);
    this.keyHashIndex.set(keyHash, id);
    await this.save();

    return {
      id,
      name: request.name,
      key, // 明文密钥，仅此时返回
      prefix: apiKey.prefix,
      createdAt: now,
      expiresAt: apiKey.expiresAt,
    };
  }

  /**
   * 验证密钥
   */
  async verify(key: string): Promise<{ valid: boolean; keyInfo?: GatewayApiKey; reason?: string }> {
    const keyHash = await hashKey(key);
    const keyId = this.keyHashIndex.get(keyHash);

    if (!keyId) {
      return { valid: false, reason: 'Invalid API key' };
    }

    const apiKey = this.keys.get(keyId);
    if (!apiKey) {
      return { valid: false, reason: 'Key not found' };
    }

    if (!apiKey.enabled) {
      return { valid: false, reason: 'API key is disabled' };
    }

    if (apiKey.expiresAt && Date.now() > apiKey.expiresAt) {
      return { valid: false, reason: 'API key has expired' };
    }

    // 更新使用统计
    apiKey.lastUsedAt = Date.now();
    apiKey.usageCount++;
    
    // 异步保存，不阻塞验证
    this.save().catch(err => console.error('Failed to update key usage:', err));

    return { valid: true, keyInfo: apiKey };
  }

  /**
   * 获取密钥信息
   */
  get(id: string): GatewayApiKey | undefined {
    return this.keys.get(id);
  }

  /**
   * 列出所有密钥
   */
  list(): GatewayApiKey[] {
    return Array.from(this.keys.values());
  }

  /**
   * 列出有效密钥
   */
  listActive(): GatewayApiKey[] {
    const now = Date.now();
    return Array.from(this.keys.values()).filter(key => 
      key.enabled && (!key.expiresAt || key.expiresAt > now)
    );
  }

  /**
   * 启用/禁用密钥
   */
  async setEnabled(id: string, enabled: boolean): Promise<boolean> {
    const key = this.keys.get(id);
    if (!key) return false;

    key.enabled = enabled;
    await this.save();
    return true;
  }

  /**
   * 撤销（删除）密钥
   */
  async revoke(id: string): Promise<boolean> {
    const key = this.keys.get(id);
    if (!key) return false;

    this.keyHashIndex.delete(key.keyHash);
    this.keys.delete(id);
    await this.save();
    return true;
  }

  /**
   * 更新密钥
   */
  async update(id: string, updates: Partial<Pick<GatewayApiKey, 'name' | 'scopes' | 'rateLimit' | 'expiresAt'>>): Promise<GatewayApiKey | null> {
    const key = this.keys.get(id);
    if (!key) return null;

    if (updates.name !== undefined) key.name = updates.name;
    if (updates.scopes !== undefined) key.scopes = updates.scopes;
    if (updates.rateLimit !== undefined) key.rateLimit = updates.rateLimit;
    if (updates.expiresAt !== undefined) key.expiresAt = updates.expiresAt;

    await this.save();
    return key;
  }

  /**
   * 重新生成密钥（保留 ID 和设置，生成新密钥）
   */
  async regenerate(id: string): Promise<{ key: string; prefix: string } | null> {
    const existingKey = this.keys.get(id);
    if (!existingKey) return null;

    // 删除旧哈希索引
    this.keyHashIndex.delete(existingKey.keyHash);

    // 生成新密钥
    const newKey = generateApiKey();
    const newHash = await hashKey(newKey);

    existingKey.keyHash = newHash;
    existingKey.prefix = getKeyPrefix(newKey);
    existingKey.usageCount = 0;
    existingKey.lastUsedAt = undefined;

    this.keyHashIndex.set(newHash, id);
    await this.save();

    return {
      key: newKey,
      prefix: existingKey.prefix,
    };
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    total: number;
    active: number;
    disabled: number;
    expired: number;
    totalUsage: number;
  } {
    const now = Date.now();
    let active = 0;
    let disabled = 0;
    let expired = 0;
    let totalUsage = 0;

    for (const key of this.keys.values()) {
      totalUsage += key.usageCount;
      
      if (!key.enabled) {
        disabled++;
      } else if (key.expiresAt && key.expiresAt < now) {
        expired++;
      } else {
        active++;
      }
    }

    return {
      total: this.keys.size,
      active,
      disabled,
      expired,
      totalUsage,
    };
  }
}

/**
 * 创建 Gateway Key 管理器
 */
export function createGatewayKeyManager(path?: string): GatewayKeyManager {
  return new GatewayKeyManager(path);
}
