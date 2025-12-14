/**
 * Gateway API Key 路由
 * Gateway API Key Router
 */

import type { GatewayKeyManager, CreateKeyRequest, GatewayApiKey } from './gateway-keys';
import type { AuthMiddleware } from './middleware';

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

export interface GatewayKeyRouterConfig {
  /** 路由前缀 */
  prefix?: string;
}

/**
 * Gateway Key 路由器
 */
export class GatewayKeyRouter {
  private keyManager: GatewayKeyManager;
  private authMiddleware: AuthMiddleware;
  private prefix: string;

  constructor(
    keyManager: GatewayKeyManager,
    authMiddleware: AuthMiddleware,
    config: GatewayKeyRouterConfig = {}
  ) {
    this.keyManager = keyManager;
    this.authMiddleware = authMiddleware;
    this.prefix = config.prefix ?? '/internal/gateway-keys';
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

    // 验证 Admin 权限
    const auth = await this.authMiddleware.authenticate(req);
    if (auth.role !== 'admin' || !auth.authenticated) {
      return {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'Admin authentication required' },
      };
    }

    const subPath = path.slice(this.prefix.length) || '/';

    // 列出所有密钥
    if (subPath === '/' && req.method === 'GET') {
      return this.handleList();
    }

    // 创建新密钥
    if (subPath === '/' && req.method === 'POST') {
      return this.handleCreate(req);
    }

    // 获取统计
    if (subPath === '/stats' && req.method === 'GET') {
      return this.handleStats();
    }

    // 单个密钥操作
    const keyIdMatch = subPath.match(/^\/([^/]+)$/);
    if (keyIdMatch) {
      const keyId = keyIdMatch[1];

      if (req.method === 'GET') {
        return this.handleGet(keyId);
      }

      if (req.method === 'PUT' || req.method === 'PATCH') {
        return this.handleUpdate(keyId, req);
      }

      if (req.method === 'DELETE') {
        return this.handleRevoke(keyId);
      }
    }

    // 重新生成密钥
    const regenerateMatch = subPath.match(/^\/([^/]+)\/regenerate$/);
    if (regenerateMatch && req.method === 'POST') {
      return this.handleRegenerate(regenerateMatch[1]);
    }

    // 启用/禁用密钥
    const enableMatch = subPath.match(/^\/([^/]+)\/enable$/);
    if (enableMatch && req.method === 'POST') {
      return this.handleSetEnabled(enableMatch[1], true);
    }

    const disableMatch = subPath.match(/^\/([^/]+)\/disable$/);
    if (disableMatch && req.method === 'POST') {
      return this.handleSetEnabled(disableMatch[1], false);
    }

    return null;
  }

  /**
   * 列出所有密钥
   */
  private handleList(): HttpResponse {
    const keys = this.keyManager.list();
    
    // 移除敏感信息
    const safeKeys = keys.map(this.sanitizeKey);

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        keys: safeKeys,
        total: keys.length,
      },
    };
  }

  /**
   * 创建新密钥
   */
  private async handleCreate(req: HttpRequest): Promise<HttpResponse> {
    const body = req.body as CreateKeyRequest | undefined;

    if (!body?.name) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'Name is required' },
      };
    }

    if (body.name.length > 100) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'Name must be less than 100 characters' },
      };
    }

    try {
      const result = await this.keyManager.create({
        name: body.name,
        expiresIn: body.expiresIn,
        scopes: body.scopes,
        rateLimit: body.rateLimit,
      });

      return {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
        body: {
          ...result,
          message: 'API key created. Save it now - it will not be shown again.',
        },
      };
    } catch (error) {
      return {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'Failed to create API key' },
      };
    }
  }

  /**
   * 获取单个密钥
   */
  private handleGet(keyId: string): HttpResponse {
    const key = this.keyManager.get(keyId);

    if (!key) {
      return {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'API key not found' },
      };
    }

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: this.sanitizeKey(key),
    };
  }

  /**
   * 更新密钥
   */
  private async handleUpdate(keyId: string, req: HttpRequest): Promise<HttpResponse> {
    const body = req.body as Partial<Pick<GatewayApiKey, 'name' | 'scopes' | 'rateLimit' | 'expiresAt'>> | undefined;

    if (!body) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'Request body is required' },
      };
    }

    const updated = await this.keyManager.update(keyId, body);

    if (!updated) {
      return {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'API key not found' },
      };
    }

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: this.sanitizeKey(updated),
    };
  }

  /**
   * 撤销密钥
   */
  private async handleRevoke(keyId: string): Promise<HttpResponse> {
    const revoked = await this.keyManager.revoke(keyId);

    if (!revoked) {
      return {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'API key not found' },
      };
    }

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { success: true, message: 'API key revoked' },
    };
  }

  /**
   * 重新生成密钥
   */
  private async handleRegenerate(keyId: string): Promise<HttpResponse> {
    const result = await this.keyManager.regenerate(keyId);

    if (!result) {
      return {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'API key not found' },
      };
    }

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        ...result,
        message: 'API key regenerated. Save it now - it will not be shown again.',
      },
    };
  }

  /**
   * 启用/禁用密钥
   */
  private async handleSetEnabled(keyId: string, enabled: boolean): Promise<HttpResponse> {
    const success = await this.keyManager.setEnabled(keyId, enabled);

    if (!success) {
      return {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'API key not found' },
      };
    }

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { 
        success: true, 
        message: `API key ${enabled ? 'enabled' : 'disabled'}`,
      },
    };
  }

  /**
   * 获取统计
   */
  private handleStats(): HttpResponse {
    const stats = this.keyManager.getStats();

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: stats,
    };
  }

  /**
   * 移除敏感信息
   */
  private sanitizeKey(key: GatewayApiKey): Omit<GatewayApiKey, 'keyHash'> & { keyHash?: never } {
    const { keyHash, ...safe } = key;
    return safe;
  }
}

/**
 * 创建 Gateway Key 路由器
 */
export function createGatewayKeyRouter(
  keyManager: GatewayKeyManager,
  authMiddleware: AuthMiddleware,
  config?: GatewayKeyRouterConfig
): GatewayKeyRouter {
  return new GatewayKeyRouter(keyManager, authMiddleware, config);
}
