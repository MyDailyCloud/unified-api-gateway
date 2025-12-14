/**
 * 会话管理
 * Session Management
 */

import type { Session, UserRole } from './types';

// 默认会话超时：24 小时
const DEFAULT_SESSION_TIMEOUT = 24 * 60 * 60 * 1000;

/**
 * 生成会话 ID
 */
function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint32Array(4);
    crypto.getRandomValues(array);
    const cryptoPart = Array.from(array).map(n => n.toString(36)).join('');
    return `${timestamp}-${cryptoPart}`;
  }
  
  return `${timestamp}-${randomPart}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * 会话管理器
 */
export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private sessionTimeout: number;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(sessionTimeout: number = DEFAULT_SESSION_TIMEOUT) {
    this.sessionTimeout = sessionTimeout;
  }

  /**
   * 启动清理定时器
   */
  startCleanup(interval: number = 60000): void {
    if (this.cleanupInterval) {
      return;
    }
    
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, interval);
  }

  /**
   * 停止清理定时器
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * 创建会话
   */
  create(userId: string, role: UserRole): Session {
    const now = Date.now();
    const session: Session = {
      id: generateSessionId(),
      userId,
      role,
      createdAt: now,
      expiresAt: now + this.sessionTimeout,
    };

    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * 获取会话
   */
  get(sessionId: string): Session | null {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return null;
    }

    // 检查是否过期
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(sessionId);
      return null;
    }

    return session;
  }

  /**
   * 验证会话
   */
  validate(sessionId: string): { valid: boolean; session?: Session } {
    const session = this.get(sessionId);
    
    if (!session) {
      return { valid: false };
    }

    return { valid: true, session };
  }

  /**
   * 刷新会话
   */
  refresh(sessionId: string): Session | null {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return null;
    }

    // 检查是否过期
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(sessionId);
      return null;
    }

    // 刷新过期时间
    session.expiresAt = Date.now() + this.sessionTimeout;
    return session;
  }

  /**
   * 删除会话
   */
  delete(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * 删除用户的所有会话
   */
  deleteByUser(userId: string): number {
    let count = 0;
    for (const [id, session] of this.sessions) {
      if (session.userId === userId) {
        this.sessions.delete(id);
        count++;
      }
    }
    return count;
  }

  /**
   * 清理过期会话
   */
  cleanup(): number {
    const now = Date.now();
    let count = 0;
    
    for (const [id, session] of this.sessions) {
      if (now > session.expiresAt) {
        this.sessions.delete(id);
        count++;
      }
    }
    
    return count;
  }

  /**
   * 获取活跃会话数
   */
  getActiveCount(): number {
    return this.sessions.size;
  }

  /**
   * 获取用户的活跃会话
   */
  getByUser(userId: string): Session[] {
    const sessions: Session[] = [];
    const now = Date.now();
    
    for (const session of this.sessions.values()) {
      if (session.userId === userId && now <= session.expiresAt) {
        sessions.push(session);
      }
    }
    
    return sessions;
  }
}

/**
 * 创建会话管理器
 */
export function createSessionManager(sessionTimeout?: number): SessionManager {
  return new SessionManager(sessionTimeout);
}
