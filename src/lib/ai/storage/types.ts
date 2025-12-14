/**
 * 统一存储层类型定义
 * Unified Storage Layer Type Definitions
 */

// ==================== 存储类型 ====================

export type StorageType = 
  | 'memory'          // 所有环境 - 开发/测试
  | 'localStorage'    // 浏览器
  | 'indexedDB'       // 浏览器 (大数据)
  | 'sqlite'          // Node.js / Electron
  | 'cloudflare-kv'   // Cloudflare Workers
  | 'cloudflare-d1';  // Cloudflare Workers (SQLite)

// ==================== 存储信息 ====================

export interface StorageInfo {
  type: StorageType;
  version: string;
  maxSize?: number;
  currentSize?: number;
  features: {
    transactions: boolean;
    ttl: boolean;
    prefix: boolean;
    batch: boolean;
  };
}

// ==================== 统一存储接口 ====================

export interface UnifiedStorage {
  // 基础 KV 操作
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  has(key: string): Promise<boolean>;
  
  // 列表操作
  keys(prefix?: string): Promise<string[]>;
  list<T>(prefix: string): Promise<T[]>;
  
  // 批量操作
  getMany<T>(keys: string[]): Promise<(T | null)[]>;
  setMany<T>(entries: Array<[string, T]>): Promise<void>;
  deleteMany(keys: string[]): Promise<number>;
  
  // 事务支持（可选）
  transaction?<T>(fn: (storage: UnifiedStorage) => Promise<T>): Promise<T>;
  
  // 元数据
  getInfo(): StorageInfo;
  
  // 生命周期
  close?(): Promise<void>;
  clear?(): Promise<void>;
}

// ==================== 存储配置 ====================

export interface StorageConfig {
  type: StorageType;
  /** SQLite 数据库路径 */
  dbPath?: string;
  /** 加密密钥（用于敏感数据） */
  encryptionKey?: string;
  /** 表名前缀 */
  tablePrefix?: string;
  /** 调试模式 */
  debug?: boolean;
}

// ==================== 存储项目包装 ====================

export interface StorageItem<T = unknown> {
  key: string;
  value: T;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
}

// ==================== 工厂函数类型 ====================

export type StorageFactory = (config?: Partial<StorageConfig>) => UnifiedStorage;
