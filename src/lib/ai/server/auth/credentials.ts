/**
 * Admin 凭据管理
 * Admin Credentials Management
 */

import type { AdminCredentials } from './types';

// 默认凭据文件路径
const DEFAULT_CREDENTIALS_PATH = './.ai-server-credentials.json';

/**
 * 生成随机密码
 */
export function generateRandomPassword(length: number = 16): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  
  // 使用 crypto 如果可用
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
      password += chars[array[i] % chars.length];
    }
  } else {
    // 回退到 Math.random
    for (let i = 0; i < length; i++) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  
  return password;
}

/**
 * 生成盐值
 */
export function generateSalt(length: number = 32): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let salt = '';
  
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
      salt += chars[array[i] % chars.length];
    }
  } else {
    for (let i = 0; i < length; i++) {
      salt += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  
  return salt;
}

/**
 * 简单哈希函数（生产环境应使用 bcrypt 或 argon2）
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const data = password + salt;
  
  // 尝试使用 Web Crypto API
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  // 尝试使用 Node.js crypto
  try {
    const nodeCrypto = await import('crypto');
    return nodeCrypto.createHash('sha256').update(data).digest('hex');
  } catch {
    // 简单回退哈希（仅用于开发）
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
  }
}

/**
 * 验证密码
 */
export async function verifyPassword(password: string, salt: string, hash: string): Promise<boolean> {
  const computedHash = await hashPassword(password, salt);
  return computedHash === hash;
}

/**
 * 凭据管理器
 */
export class CredentialsManager {
  private credentialsPath: string;
  private credentials: AdminCredentials | null = null;

  constructor(credentialsPath: string = DEFAULT_CREDENTIALS_PATH) {
    this.credentialsPath = credentialsPath;
  }

  /**
   * 加载凭据
   */
  async load(): Promise<AdminCredentials | null> {
    try {
      const fs = await import('fs/promises');
      const data = await fs.readFile(this.credentialsPath, 'utf-8');
      this.credentials = JSON.parse(data);
      return this.credentials;
    } catch {
      return null;
    }
  }

  /**
   * 保存凭据
   */
  async save(credentials: AdminCredentials): Promise<void> {
    try {
      const fs = await import('fs/promises');
      await fs.writeFile(this.credentialsPath, JSON.stringify(credentials, null, 2), 'utf-8');
      this.credentials = credentials;
    } catch (error) {
      console.error('Failed to save credentials:', error);
      throw error;
    }
  }

  /**
   * 初始化凭据（如果不存在则创建）
   * 返回生成的明文密码（仅首次创建时）
   */
  async initialize(): Promise<{ credentials: AdminCredentials; generatedPassword?: string }> {
    const existing = await this.load();
    
    if (existing) {
      return { credentials: existing };
    }

    // 生成新凭据
    const password = generateRandomPassword();
    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);

    const credentials: AdminCredentials = {
      username: 'admin',
      passwordHash,
      salt,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await this.save(credentials);

    return { credentials, generatedPassword: password };
  }

  /**
   * 验证登录
   */
  async verify(username: string, password: string): Promise<boolean> {
    if (!this.credentials) {
      await this.load();
    }

    if (!this.credentials) {
      return false;
    }

    if (username !== this.credentials.username) {
      return false;
    }

    return verifyPassword(password, this.credentials.salt, this.credentials.passwordHash);
  }

  /**
   * 修改密码
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<boolean> {
    if (!this.credentials) {
      await this.load();
    }

    if (!this.credentials) {
      return false;
    }

    // 验证当前密码
    const valid = await verifyPassword(currentPassword, this.credentials.salt, this.credentials.passwordHash);
    if (!valid) {
      return false;
    }

    // 生成新哈希
    const salt = generateSalt();
    const passwordHash = await hashPassword(newPassword, salt);

    this.credentials = {
      ...this.credentials,
      passwordHash,
      salt,
      updatedAt: Date.now(),
    };

    await this.save(this.credentials);
    return true;
  }

  /**
   * 获取凭据（不包含敏感信息）
   */
  getInfo(): { username: string; createdAt: number; updatedAt: number } | null {
    if (!this.credentials) {
      return null;
    }
    return {
      username: this.credentials.username,
      createdAt: this.credentials.createdAt,
      updatedAt: this.credentials.updatedAt,
    };
  }
}

/**
 * 创建凭据管理器
 */
export function createCredentialsManager(path?: string): CredentialsManager {
  return new CredentialsManager(path);
}
