/**
 * 加密工具
 * Encryption Utilities
 * 
 * 用于 API Key 等敏感数据的加密存储
 */

// ==================== 简单加密实现 ====================

/**
 * 简单的 XOR 加密（仅用于基本混淆，不适合高安全场景）
 * 生产环境建议使用 node:crypto 或 Web Crypto API
 */
export function simpleEncrypt(text: string, key: string): string {
  const textBytes = new TextEncoder().encode(text);
  const keyBytes = new TextEncoder().encode(key);
  const encrypted = new Uint8Array(textBytes.length);
  
  for (let i = 0; i < textBytes.length; i++) {
    encrypted[i] = textBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  
  return btoa(String.fromCharCode(...encrypted));
}

export function simpleDecrypt(encrypted: string, key: string): string {
  const encryptedBytes = new Uint8Array(
    atob(encrypted).split('').map(c => c.charCodeAt(0))
  );
  const keyBytes = new TextEncoder().encode(key);
  const decrypted = new Uint8Array(encryptedBytes.length);
  
  for (let i = 0; i < encryptedBytes.length; i++) {
    decrypted[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  
  return new TextDecoder().decode(decrypted);
}

// ==================== Node.js 加密实现 ====================

export interface CryptoProvider {
  encrypt(text: string, key: string): Promise<string>;
  decrypt(encrypted: string, key: string): Promise<string>;
}

/**
 * 创建 Node.js crypto 加密提供者
 */
export async function createNodeCryptoProvider(): Promise<CryptoProvider> {
  const crypto = await import('node:crypto');
  
  return {
    async encrypt(text: string, key: string): Promise<string> {
      const algorithm = 'aes-256-gcm';
      const keyHash = crypto.createHash('sha256').update(key).digest();
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(algorithm, keyHash, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return JSON.stringify({
        iv: iv.toString('hex'),
        data: encrypted,
        tag: authTag.toString('hex'),
      });
    },
    
    async decrypt(encryptedStr: string, key: string): Promise<string> {
      const { iv, data, tag } = JSON.parse(encryptedStr);
      
      const algorithm = 'aes-256-gcm';
      const keyHash = crypto.createHash('sha256').update(key).digest();
      const decipher = crypto.createDecipheriv(
        algorithm,
        keyHash,
        Buffer.from(iv, 'hex')
      );
      
      decipher.setAuthTag(Buffer.from(tag, 'hex'));
      
      let decrypted = decipher.update(data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    },
  };
}

/**
 * 创建 Web Crypto API 加密提供者
 */
export async function createWebCryptoProvider(): Promise<CryptoProvider> {
  return {
    async encrypt(text: string, key: string): Promise<string> {
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(key),
        'PBKDF2',
        false,
        ['deriveKey']
      );
      
      const cryptoKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: encoder.encode('ai-sdk-salt'),
          iterations: 100000,
          hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
      );
      
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        data
      );
      
      return JSON.stringify({
        iv: Array.from(iv),
        data: Array.from(new Uint8Array(encrypted)),
      });
    },
    
    async decrypt(encryptedStr: string, key: string): Promise<string> {
      const { iv, data } = JSON.parse(encryptedStr);
      const encoder = new TextEncoder();
      
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(key),
        'PBKDF2',
        false,
        ['deriveKey']
      );
      
      const cryptoKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: encoder.encode('ai-sdk-salt'),
          iterations: 100000,
          hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );
      
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        cryptoKey,
        new Uint8Array(data)
      );
      
      return new TextDecoder().decode(decrypted);
    },
  };
}

/**
 * 自动选择加密提供者（异步）
 */
export async function createCryptoProvider(): Promise<CryptoProvider> {
  // 检查是否在 Node.js 环境
  if (typeof process !== 'undefined' && process.versions?.node) {
    return createNodeCryptoProvider();
  }
  
  // 检查是否支持 Web Crypto API
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    return createWebCryptoProvider();
  }
  
  // 回退到简单加密
  return createSimpleCryptoProvider();
}

/**
 * 创建简单加密提供者（同步，适用于不需要强加密的场景）
 */
export function createSimpleCryptoProvider(): CryptoProvider {
  return {
    encrypt: async (text, key) => simpleEncrypt(text, key),
    decrypt: async (encrypted, key) => simpleDecrypt(encrypted, key),
  };
}
