/**
 * 统一存储模块
 * Unified Storage Module
 */

// 类型导出
export type {
  StorageType,
  StorageInfo,
  UnifiedStorage,
  StorageConfig,
  StorageItem,
  StorageFactory,
} from './types';

// 实现导出
export { MemoryStorage, createMemoryStorage } from './memory';
export { SQLiteStorage, createSQLiteStorage } from './sqlite';

// 加密工具
export {
  simpleEncrypt,
  simpleDecrypt,
  createNodeCryptoProvider,
  createWebCryptoProvider,
  createCryptoProvider,
  type CryptoProvider,
} from './encryption';

// ==================== 存储工厂 ====================

import type { UnifiedStorage, StorageConfig, StorageType } from './types';
import { createMemoryStorage } from './memory';

/**
 * 检测运行时环境
 */
export function detectRuntime(): 'browser' | 'node' | 'electron' | 'cloudflare' | 'deno' | 'unknown' {
  // Cloudflare Workers
  if (typeof globalThis.caches !== 'undefined' && 
      typeof (globalThis as any).Deno === 'undefined' &&
      typeof process === 'undefined') {
    return 'cloudflare';
  }
  
  // Deno
  if (typeof (globalThis as any).Deno !== 'undefined') {
    return 'deno';
  }
  
  // Electron
  if (typeof process !== 'undefined' && process.versions?.electron) {
    return 'electron';
  }
  
  // Node.js
  if (typeof process !== 'undefined' && process.versions?.node) {
    return 'node';
  }
  
  // Browser
  if (typeof window !== 'undefined') {
    return 'browser';
  }
  
  return 'unknown';
}

/**
 * 自动选择最佳存储类型
 */
export function getRecommendedStorageType(): StorageType {
  const runtime = detectRuntime();
  
  switch (runtime) {
    case 'node':
    case 'electron':
      return 'sqlite';
    case 'browser':
      return 'indexedDB';
    case 'cloudflare':
      return 'cloudflare-kv';
    default:
      return 'memory';
  }
}

/**
 * 创建存储实例
 */
export async function createStorage(config?: Partial<StorageConfig>): Promise<UnifiedStorage> {
  const type = config?.type || getRecommendedStorageType();
  
  switch (type) {
    case 'memory':
      return createMemoryStorage();
    
    case 'sqlite': {
      const { createSQLiteStorage } = await import('./sqlite');
      return createSQLiteStorage(config);
    }
    
    case 'localStorage':
    case 'indexedDB':
      // 浏览器存储将在未来实现
      console.warn(`${type} storage not yet implemented, falling back to memory`);
      return createMemoryStorage();
    
    case 'cloudflare-kv':
    case 'cloudflare-d1':
      // Cloudflare 存储将在未来实现
      throw new Error(`${type} storage requires Cloudflare environment bindings`);
    
    default:
      return createMemoryStorage();
  }
}
