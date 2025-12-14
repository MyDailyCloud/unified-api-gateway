/**
 * SQLite 存储实现
 * SQLite Storage Implementation
 * 
 * 适用于 Node.js 和 Electron 环境
 * 使用 better-sqlite3 作为底层驱动
 */

import type { UnifiedStorage, StorageInfo, StorageConfig } from './types';

// ==================== 类型定义 ====================

interface BetterSqlite3Database {
  prepare(sql: string): BetterSqlite3Statement;
  exec(sql: string): void;
  close(): void;
  transaction<T>(fn: () => T): () => T;
}

interface BetterSqlite3Statement {
  run(...params: unknown[]): { changes: number };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

interface StorageRow {
  key: string;
  value: string;
  created_at: number;
  updated_at: number;
  expires_at: number | null;
}

// ==================== SQLite 存储类 ====================

export class SQLiteStorage implements UnifiedStorage {
  private db: BetterSqlite3Database | null = null;
  private config: StorageConfig;
  private tableName: string;

  constructor(config: Partial<StorageConfig> = {}) {
    this.config = {
      type: 'sqlite',
      dbPath: config.dbPath || './ai-sdk.db',
      tablePrefix: config.tablePrefix || 'ai_',
      debug: config.debug || false,
      ...config,
    };
    this.tableName = `${this.config.tablePrefix}storage`;
  }

  /**
   * 初始化数据库连接
   */
  async initialize(): Promise<void> {
    if (this.db) return;

    try {
      // 动态导入 better-sqlite3
      const Database = await this.importDatabase();
      this.db = new Database(this.config.dbPath!);
      
      // 创建表
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS ${this.tableName} (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          expires_at INTEGER
        );
        
        CREATE INDEX IF NOT EXISTS idx_${this.tableName}_expires 
        ON ${this.tableName}(expires_at);
        
        CREATE INDEX IF NOT EXISTS idx_${this.tableName}_key_prefix 
        ON ${this.tableName}(key);
      `);

      this.log('Database initialized');
    } catch (error) {
      throw new Error(`Failed to initialize SQLite: ${error}`);
    }
  }

  private async importDatabase(): Promise<new (path: string) => BetterSqlite3Database> {
    try {
      // Node.js / Electron 环境 - 动态导入避免 bundler 错误
      // @ts-ignore - 动态导入外部模块
      const module = await (new Function('return import("better-sqlite3")'))();
      return module.default || module;
    } catch {
      throw new Error(
        'better-sqlite3 not found. Install it with: npm install better-sqlite3'
      );
    }
  }

  private ensureInitialized(): void {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
  }

  private log(message: string): void {
    if (this.config.debug) {
      console.log(`[SQLiteStorage] ${message}`);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    this.ensureInitialized();
    
    const stmt = this.db!.prepare(
      `SELECT value, expires_at FROM ${this.tableName} WHERE key = ?`
    );
    const row = stmt.get(key) as StorageRow | undefined;
    
    if (!row) return null;
    
    // 检查过期
    if (row.expires_at && Date.now() > row.expires_at) {
      await this.delete(key);
      return null;
    }
    
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return row.value as unknown as T;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    this.ensureInitialized();
    
    const now = Date.now();
    const valueStr = JSON.stringify(value);
    const expiresAt = ttl ? now + ttl : null;
    
    const stmt = this.db!.prepare(`
      INSERT INTO ${this.tableName} (key, value, created_at, updated_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at,
        expires_at = excluded.expires_at
    `);
    
    stmt.run(key, valueStr, now, now, expiresAt);
  }

  async delete(key: string): Promise<boolean> {
    this.ensureInitialized();
    
    const stmt = this.db!.prepare(
      `DELETE FROM ${this.tableName} WHERE key = ?`
    );
    const result = stmt.run(key);
    return result.changes > 0;
  }

  async has(key: string): Promise<boolean> {
    this.ensureInitialized();
    
    const stmt = this.db!.prepare(
      `SELECT 1 FROM ${this.tableName} WHERE key = ? AND (expires_at IS NULL OR expires_at > ?)`
    );
    const row = stmt.get(key, Date.now());
    return !!row;
  }

  async keys(prefix?: string): Promise<string[]> {
    this.ensureInitialized();
    
    let sql = `SELECT key FROM ${this.tableName} WHERE (expires_at IS NULL OR expires_at > ?)`;
    const params: unknown[] = [Date.now()];
    
    if (prefix) {
      sql += ' AND key LIKE ?';
      params.push(`${prefix}%`);
    }
    
    const stmt = this.db!.prepare(sql);
    const rows = stmt.all(...params) as Array<{ key: string }>;
    return rows.map(r => r.key);
  }

  async list<T>(prefix: string): Promise<T[]> {
    this.ensureInitialized();
    
    const stmt = this.db!.prepare(`
      SELECT value FROM ${this.tableName} 
      WHERE key LIKE ? AND (expires_at IS NULL OR expires_at > ?)
    `);
    const rows = stmt.all(`${prefix}%`, Date.now()) as Array<{ value: string }>;
    
    return rows.map(r => {
      try {
        return JSON.parse(r.value) as T;
      } catch {
        return r.value as unknown as T;
      }
    });
  }

  async getMany<T>(keys: string[]): Promise<(T | null)[]> {
    return Promise.all(keys.map(key => this.get<T>(key)));
  }

  async setMany<T>(entries: Array<[string, T]>): Promise<void> {
    this.ensureInitialized();
    
    const insertFn = this.db!.transaction(() => {
      for (const [key, value] of entries) {
        const now = Date.now();
        const valueStr = JSON.stringify(value);
        
        this.db!.prepare(`
          INSERT INTO ${this.tableName} (key, value, created_at, updated_at, expires_at)
          VALUES (?, ?, ?, ?, NULL)
          ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = excluded.updated_at
        `).run(key, valueStr, now, now);
      }
    });
    
    insertFn();
  }

  async deleteMany(keys: string[]): Promise<number> {
    this.ensureInitialized();
    
    let deleted = 0;
    const deleteFn = this.db!.transaction(() => {
      for (const key of keys) {
        const result = this.db!.prepare(
          `DELETE FROM ${this.tableName} WHERE key = ?`
        ).run(key);
        deleted += result.changes;
      }
    });
    
    deleteFn();
    return deleted;
  }

  async transaction<T>(fn: (storage: UnifiedStorage) => Promise<T>): Promise<T> {
    this.ensureInitialized();
    
    // better-sqlite3 事务是同步的，这里用 wrapper
    return fn(this);
  }

  getInfo(): StorageInfo {
    return {
      type: 'sqlite',
      version: '1.0.0',
      features: {
        transactions: true,
        ttl: true,
        prefix: true,
        batch: true,
      },
    };
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.log('Database closed');
    }
  }

  async clear(): Promise<void> {
    this.ensureInitialized();
    this.db!.exec(`DELETE FROM ${this.tableName}`);
  }

  /**
   * 清理过期数据
   */
  async cleanup(): Promise<number> {
    this.ensureInitialized();
    
    const stmt = this.db!.prepare(
      `DELETE FROM ${this.tableName} WHERE expires_at IS NOT NULL AND expires_at < ?`
    );
    const result = stmt.run(Date.now());
    this.log(`Cleaned up ${result.changes} expired items`);
    return result.changes;
  }

  /**
   * 获取数据库统计信息
   */
  async getStats(): Promise<{ count: number; size: number }> {
    this.ensureInitialized();
    
    const countStmt = this.db!.prepare(`SELECT COUNT(*) as count FROM ${this.tableName}`);
    const countRow = countStmt.get() as { count: number };
    
    const sizeStmt = this.db!.prepare(`SELECT SUM(LENGTH(value)) as size FROM ${this.tableName}`);
    const sizeRow = sizeStmt.get() as { size: number | null };
    
    return {
      count: countRow.count,
      size: sizeRow.size || 0,
    };
  }
}

/**
 * 创建 SQLite 存储实例
 */
export async function createSQLiteStorage(config?: Partial<StorageConfig>): Promise<SQLiteStorage> {
  const storage = new SQLiteStorage(config);
  await storage.initialize();
  return storage;
}
