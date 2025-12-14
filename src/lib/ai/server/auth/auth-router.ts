/**
 * 认证路由
 * Authentication Router
 */

import type { AuthContext, LoginRequest, ChangePasswordRequest } from './types';
import type { AuthMiddleware } from './middleware';
import { detectRuntimeMode } from './runtime-mode';

export interface HttpRequest {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  body?: unknown;
  query?: Record<string, string>;
}

export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body?: unknown;
}

export interface AuthRouterConfig {
  /** 路由前缀 */
  prefix?: string;
}

/**
 * 认证路由器
 */
export class AuthRouter {
  private authMiddleware: AuthMiddleware;
  private prefix: string;
  private runtimeMode = detectRuntimeMode();

  constructor(authMiddleware: AuthMiddleware, config: AuthRouterConfig = {}) {
    this.authMiddleware = authMiddleware;
    this.prefix = config.prefix ?? '/internal/auth';
  }

  /**
   * 处理请求
   */
  async handle(req: HttpRequest): Promise<HttpResponse | null> {
    const path = req.path;

    // 检查前缀
    if (!path.startsWith(this.prefix)) {
      return null;
    }

    const subPath = path.slice(this.prefix.length) || '/';

    // 登录
    if (subPath === '/login' && req.method === 'POST') {
      return this.handleLogin(req);
    }

    // 登出
    if (subPath === '/logout' && req.method === 'POST') {
      return this.handleLogout(req);
    }

    // 修改密码
    if (subPath === '/change-password' && req.method === 'POST') {
      return this.handleChangePassword(req);
    }

    // 获取当前用户信息
    if (subPath === '/me' && req.method === 'GET') {
      return this.handleGetMe(req);
    }

    // 获取认证状态
    if (subPath === '/status' && req.method === 'GET') {
      return this.handleStatus();
    }

    return null;
  }

  /**
   * 处理登录
   */
  private async handleLogin(req: HttpRequest): Promise<HttpResponse> {
    // Electron 模式不需要登录
    if (this.runtimeMode === 'electron') {
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          success: true,
          message: 'Electron mode - no login required',
          role: 'admin',
        },
      };
    }

    const body = req.body as LoginRequest | undefined;

    if (!body?.username || !body?.password) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: { success: false, error: 'Username and password required' },
      };
    }

    const result = await this.authMiddleware.login(body.username, body.password);

    if (!result.success) {
      return {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
        body: result,
      };
    }

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: result,
    };
  }

  /**
   * 处理登出
   */
  private async handleLogout(req: HttpRequest): Promise<HttpResponse> {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      this.authMiddleware.logout(token);
    }

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { success: true },
    };
  }

  /**
   * 处理修改密码
   */
  private async handleChangePassword(req: HttpRequest): Promise<HttpResponse> {
    // 先认证
    const auth = await this.authMiddleware.authenticate(req);

    if (auth.role !== 'admin' || !auth.authenticated) {
      return {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
        body: { success: false, error: 'Admin authentication required' },
      };
    }

    const body = req.body as ChangePasswordRequest | undefined;

    if (!body?.currentPassword || !body?.newPassword) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: { success: false, error: 'Current and new password required' },
      };
    }

    if (body.newPassword.length < 8) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: { success: false, error: 'New password must be at least 8 characters' },
      };
    }

    const success = await this.authMiddleware.changePassword(body.currentPassword, body.newPassword);

    if (!success) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: { success: false, error: 'Current password is incorrect' },
      };
    }

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { success: true, message: 'Password changed successfully' },
    };
  }

  /**
   * 获取当前用户信息
   */
  private async handleGetMe(req: HttpRequest): Promise<HttpResponse> {
    const auth = await this.authMiddleware.authenticate(req);

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        role: auth.role,
        userId: auth.userId,
        authenticated: auth.authenticated,
        mode: auth.mode,
        runtimeMode: this.runtimeMode,
      },
    };
  }

  /**
   * 获取认证状态
   */
  private handleStatus(): HttpResponse {
    const credentialsInfo = this.authMiddleware.getCredentialsManager().getInfo();
    const activeSessions = this.authMiddleware.getSessionManager().getActiveCount();

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        runtimeMode: this.runtimeMode,
        requiresAuth: this.runtimeMode === 'node',
        adminConfigured: !!credentialsInfo,
        activeSessions,
      },
    };
  }
}

/**
 * 创建认证路由器
 */
export function createAuthRouter(authMiddleware: AuthMiddleware, config?: AuthRouterConfig): AuthRouter {
  return new AuthRouter(authMiddleware, config);
}
