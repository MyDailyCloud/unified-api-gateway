/**
 * 认证中间件
 * Authentication Middleware
 */

import type { AuthContext, AuthConfig, AuthMode, UserRole } from './types';
import { detectRuntimeMode } from './runtime-mode';
import { CredentialsManager } from './credentials';
import { SessionManager } from './session';
import type { GatewayKeyManager, GatewayApiKey } from './gateway-keys';

export interface HttpRequest {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  body?: unknown;
  query?: Record<string, string>;
}

export interface AuthMiddlewareConfig extends AuthConfig {
  /** 凭据管理器 */
  credentialsManager?: CredentialsManager;
  /** 会话管理器 */
  sessionManager?: SessionManager;
  /** Gateway Key 管理器 */
  gatewayKeyManager?: GatewayKeyManager;
}

/** 扩展的认证上下文（包含 Gateway Key 信息） */
export interface ExtendedAuthContext extends AuthContext {
  /** Gateway Key 信息（如果使用 Gateway 模式） */
  gatewayKey?: GatewayApiKey;
}

/**
 * 认证中间件
 */
export class AuthMiddleware {
  private config: AuthMiddlewareConfig;
  private credentialsManager: CredentialsManager;
  private sessionManager: SessionManager;
  private gatewayKeyManager?: GatewayKeyManager;
  private runtimeMode = detectRuntimeMode();

  constructor(config: AuthMiddlewareConfig) {
    this.config = config;
    this.credentialsManager = config.credentialsManager ?? new CredentialsManager(config.credentialsPath);
    this.sessionManager = config.sessionManager ?? new SessionManager(config.sessionTimeout);
    this.gatewayKeyManager = config.gatewayKeyManager;
  }

  /**
   * 认证请求
   */
  async authenticate(req: HttpRequest): Promise<AuthContext> {
    // Electron 模式：始终作为 admin
    if (this.runtimeMode === 'electron') {
      return {
        role: 'admin',
        mode: 'none',
        userId: 'admin',
        authenticated: true,
      };
    }

    // Node.js 模式：检查认证
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const authMode = req.headers['x-auth-mode'] || req.headers['X-Auth-Mode'];
    const provider = req.headers['x-provider'] || req.headers['X-Provider'];

    // 无认证头：匿名用户
    if (!authHeader) {
      return {
        role: 'anonymous',
        mode: 'none',
        userId: 'anonymous',
        authenticated: false,
      };
    }

    // Passthrough 模式：使用 Provider API Key
    if (authMode === 'passthrough') {
      const providerApiKey = authHeader.replace(/^Bearer\s+/i, '');
      return {
        role: 'anonymous',
        mode: 'passthrough',
        userId: 'anonymous',
        authenticated: false,
        providerApiKey,
        targetProvider: provider as string | undefined,
      };
    }

    // Basic 认证：Admin 登录
    if (authHeader.startsWith('Basic ')) {
      const base64Credentials = authHeader.slice(6);
      try {
        const credentials = atob(base64Credentials);
        const [username, password] = credentials.split(':');
        
        const valid = await this.credentialsManager.verify(username, password);
        if (valid) {
          return {
            role: 'admin',
            mode: 'none',
            userId: 'admin',
            authenticated: true,
          };
        }
      } catch {
        // 解码失败
      }
      
      return {
        role: 'anonymous',
        mode: 'none',
        userId: 'anonymous',
        authenticated: false,
      };
    }

    // Bearer Token：检查 Session 或 Gateway API Key
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);

      // 检查是否为静态 Gateway API Key（向后兼容）
      if (this.config.gatewayApiKey && token === this.config.gatewayApiKey) {
        return {
          role: 'anonymous',
          mode: 'gateway',
          userId: 'gateway-user',
          authenticated: true,
        };
      }

      // 检查是否为动态 Gateway API Key
      if (this.gatewayKeyManager) {
        const { valid, keyInfo } = await this.gatewayKeyManager.verify(token);
        if (valid && keyInfo) {
          return {
            role: 'anonymous',
            mode: 'gateway',
            userId: `gateway-${keyInfo.id}`,
            authenticated: true,
            gatewayKey: keyInfo,
          } as ExtendedAuthContext;
        }
      }

      // 检查是否为 Session Token
      const { valid, session } = this.sessionManager.validate(token);
      if (valid && session) {
        return {
          role: session.role,
          mode: 'none',
          userId: session.userId,
          authenticated: true,
        };
      }
    }

    // 认证失败
    return {
      role: 'anonymous',
      mode: 'none',
      userId: 'anonymous',
      authenticated: false,
    };
  }

  /**
   * Admin 登录
   */
  async login(username: string, password: string): Promise<{ success: boolean; token?: string; expiresAt?: number; error?: string }> {
    const valid = await this.credentialsManager.verify(username, password);
    
    if (!valid) {
      return { success: false, error: 'Invalid credentials' };
    }

    const session = this.sessionManager.create('admin', 'admin');
    
    return {
      success: true,
      token: session.id,
      expiresAt: session.expiresAt,
    };
  }

  /**
   * 登出
   */
  logout(token: string): boolean {
    return this.sessionManager.delete(token);
  }

  /**
   * 修改密码
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<boolean> {
    return this.credentialsManager.changePassword(currentPassword, newPassword);
  }

  /**
   * 获取凭据管理器
   */
  getCredentialsManager(): CredentialsManager {
    return this.credentialsManager;
  }

  /**
   * 获取会话管理器
   */
  getSessionManager(): SessionManager {
    return this.sessionManager;
  }

  /**
   * 获取运行时模式
   */
  getRuntimeMode() {
    return this.runtimeMode;
  }

  /**
   * 获取 Gateway Key 管理器
   */
  getGatewayKeyManager(): GatewayKeyManager | undefined {
    return this.gatewayKeyManager;
  }

  /**
   * 设置 Gateway Key 管理器
   */
  setGatewayKeyManager(manager: GatewayKeyManager): void {
    this.gatewayKeyManager = manager;
  }
}

/**
 * 路由权限检查
 */
export interface RoutePermission {
  /** 允许的角色 */
  roles: UserRole[];
  /** 是否允许匿名 */
  allowAnonymous?: boolean;
  /** 是否需要认证 */
  requireAuth?: boolean;
}

// 预定义路由权限
export const ROUTE_PERMISSIONS: Record<string, RoutePermission> = {
  // 公开路由
  'GET /health': { roles: ['admin', 'anonymous'], allowAnonymous: true },
  'GET /v1/models': { roles: ['admin', 'anonymous'], allowAnonymous: true },
  'GET /v1/stats': { roles: ['admin', 'anonymous'], allowAnonymous: true },
  
  // 用户路由（匿名可访问已配置的模型）
  'POST /v1/chat/completions': { roles: ['admin', 'anonymous'], allowAnonymous: true },
  'GET /internal/providers': { roles: ['admin', 'anonymous'], allowAnonymous: true },
  'POST /internal/chat': { roles: ['admin', 'anonymous'], allowAnonymous: true },
  
  // 认证路由（公开）
  'POST /internal/auth/login': { roles: ['admin', 'anonymous'], allowAnonymous: true },
  'POST /internal/auth/logout': { roles: ['admin', 'anonymous'], allowAnonymous: true },
  'GET /internal/auth/status': { roles: ['admin', 'anonymous'], allowAnonymous: true },
  'GET /internal/auth/me': { roles: ['admin', 'anonymous'], allowAnonymous: true },
  
  // Admin 路由 - Provider 管理
  'POST /internal/providers/:provider/key': { roles: ['admin'], requireAuth: true },
  'DELETE /internal/providers/:provider/key': { roles: ['admin'], requireAuth: true },
  
  // Admin 路由 - 认证管理
  'POST /internal/auth/change-password': { roles: ['admin'], requireAuth: true },
  
  // Admin 路由 - Gateway Key 管理
  'GET /internal/gateway-keys': { roles: ['admin'], requireAuth: true },
  'POST /internal/gateway-keys': { roles: ['admin'], requireAuth: true },
  'GET /internal/gateway-keys/stats': { roles: ['admin'], requireAuth: true },
  'GET /internal/gateway-keys/:id': { roles: ['admin'], requireAuth: true },
  'PUT /internal/gateway-keys/:id': { roles: ['admin'], requireAuth: true },
  'PATCH /internal/gateway-keys/:id': { roles: ['admin'], requireAuth: true },
  'DELETE /internal/gateway-keys/:id': { roles: ['admin'], requireAuth: true },
  'POST /internal/gateway-keys/:id/regenerate': { roles: ['admin'], requireAuth: true },
  'POST /internal/gateway-keys/:id/enable': { roles: ['admin'], requireAuth: true },
  'POST /internal/gateway-keys/:id/disable': { roles: ['admin'], requireAuth: true },
  
  // Admin 路由 - 统计
  'GET /internal/stats': { roles: ['admin'], requireAuth: true },
};

/**
 * 检查路由权限
 */
export function checkRoutePermission(
  method: string,
  path: string,
  auth: AuthContext
): { allowed: boolean; reason?: string } {
  // 构建路由键
  const routeKey = `${method} ${path}`;
  
  // 查找精确匹配
  let permission = ROUTE_PERMISSIONS[routeKey];
  
  // 尝试模式匹配
  if (!permission) {
    for (const [pattern, perm] of Object.entries(ROUTE_PERMISSIONS)) {
      const [permMethod, permPath] = pattern.split(' ');
      if (method !== permMethod) continue;
      
      // 简单路径匹配（支持 :param）
      const pathRegex = new RegExp(
        '^' + permPath.replace(/:[^/]+/g, '[^/]+') + '$'
      );
      
      if (pathRegex.test(path)) {
        permission = perm;
        break;
      }
    }
  }

  // 未定义权限：默认需要 admin
  if (!permission) {
    if (auth.role === 'admin' && auth.authenticated) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Permission denied' };
  }

  // 检查是否允许匿名
  if (permission.allowAnonymous) {
    return { allowed: true };
  }

  // 检查是否需要认证
  if (permission.requireAuth && !auth.authenticated) {
    return { allowed: false, reason: 'Authentication required' };
  }

  // 检查角色
  if (!permission.roles.includes(auth.role)) {
    return { allowed: false, reason: 'Permission denied' };
  }

  return { allowed: true };
}

/**
 * 创建认证中间件
 */
export function createAuthMiddleware(config: AuthMiddlewareConfig): AuthMiddleware {
  return new AuthMiddleware(config);
}
