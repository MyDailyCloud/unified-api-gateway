/**
 * HTTP 服务器 - 统一入口
 * HTTP Server - Unified Entry Point
 */

import type { AICore } from '../../core';
import { ApiRouter, type ApiRouterConfig, type HttpRequest, type HttpResponse } from './api-router';
import { InternalRouter, type InternalRouterConfig } from './internal-router';
import type { 
  AuthMiddleware, 
  AuthRouter, 
  GatewayKeyRouter,
  AuthContext,
  ExtendedAuthContext 
} from '../../server/auth';
import { checkRoutePermission } from '../../server/auth';

export interface HttpServerConfig {
  /** API 端口（对外服务） */
  apiPort?: number;
  /** 内部端口（UI 服务） */
  internalPort?: number;
  /** 统一端口（同时处理 API 和内部请求） */
  port?: number;
  /** 主机地址 */
  host?: string;
  /** API 路由配置 */
  api?: ApiRouterConfig;
  /** 内部路由配置 */
  internal?: InternalRouterConfig;
  /** 认证中间件 */
  authMiddleware?: AuthMiddleware;
  /** 认证路由器 */
  authRouter?: AuthRouter;
  /** Gateway Key 路由器 */
  gatewayKeyRouter?: GatewayKeyRouter;
  /** CORS 配置 */
  cors?: {
    enabled?: boolean;
    origins?: string[];
  };
}

export interface HttpServerInstance {
  /** 启动服务器 */
  start(): Promise<void>;
  /** 停止服务器 */
  stop(): Promise<void>;
  /** 处理请求（用于自定义服务器集成） */
  handleRequest(req: HttpRequest): Promise<HttpResponse>;
  /** 获取端口信息 */
  getPorts(): { api?: number; internal?: number; unified?: number };
}

/** 扩展请求，包含认证上下文 */
export interface AuthenticatedRequest extends HttpRequest {
  auth?: AuthContext | ExtendedAuthContext;
}

/**
 * 创建 API 路由器
 */
export function createApiRouter(aiService: InstanceType<typeof import('../../core/ai-service').AIService>, config?: ApiRouterConfig): ApiRouter {
  return new ApiRouter(aiService, config);
}

/**
 * 创建内部路由器
 */
export function createInternalRouter(internalService: InstanceType<typeof import('../../core/internal-service').InternalService>, config?: InternalRouterConfig): InternalRouter {
  return new InternalRouter(internalService, config);
}

/**
 * 获取 CORS 头
 */
function getCorsHeaders(config: HttpServerConfig): Record<string, string> {
  const origins = config.cors?.origins ?? ['*'];
  const origin = origins.includes('*') ? '*' : origins.join(', ');
  
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Auth-Mode, X-Provider',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * 添加 CORS 头到响应
 */
function addCorsHeaders(response: HttpResponse, config: HttpServerConfig): HttpResponse {
  const corsHeaders = getCorsHeaders(config);
  return {
    ...response,
    headers: {
      ...corsHeaders,
      ...response.headers,
    },
  };
}

/**
 * 创建错误响应
 */
function errorResponse(status: number, message: string, config: HttpServerConfig): HttpResponse {
  return addCorsHeaders({
    status,
    headers: { 'Content-Type': 'application/json' },
    body: {
      error: {
        message,
        type: status === 401 ? 'authentication_error' : 
              status === 403 ? 'permission_denied' :
              status === 400 ? 'invalid_request_error' : 
              status === 404 ? 'not_found_error' : 'api_error',
        code: status,
      },
    },
  }, config);
}

/**
 * 创建 HTTP 服务器
 */
export function createHttpServer(core: AICore, config: HttpServerConfig = {}): HttpServerInstance {
  const apiRouter = new ApiRouter(core.ai, config.api);
  const internalRouter = new InternalRouter(core.internal, config.internal);
  const authMiddleware = config.authMiddleware;
  const authRouter = config.authRouter;
  const gatewayKeyRouter = config.gatewayKeyRouter;
  
  const serverConfig = {
    apiPort: config.apiPort,
    internalPort: config.internalPort,
    port: config.port ?? 3000,
    host: config.host ?? '0.0.0.0',
  };

  let httpModule: typeof import('http') | null = null;
  let apiServer: import('http').Server | null = null;
  let internalServer: import('http').Server | null = null;
  let unifiedServer: import('http').Server | null = null;

  /**
   * 处理请求（带认证）
   */
  async function handleRequest(req: HttpRequest): Promise<HttpResponse> {
    // CORS 预检
    if (req.method === 'OPTIONS') {
      return addCorsHeaders({
        status: 204,
        headers: {},
      }, config);
    }

    // 认证
    let auth: AuthContext | ExtendedAuthContext | undefined;
    if (authMiddleware) {
      auth = await authMiddleware.authenticate(req);
      (req as AuthenticatedRequest).auth = auth;
    }

    // 认证路由（登录/登出等）- 这些路由不需要权限检查
    if (authRouter) {
      const authResponse = await authRouter.handle(req);
      if (authResponse) {
        return addCorsHeaders(authResponse, config);
      }
    }

    // Gateway Key 路由（需要 admin 权限，但 router 内部会检查）
    if (gatewayKeyRouter) {
      const gatewayResponse = await gatewayKeyRouter.handle(req);
      if (gatewayResponse) {
        return addCorsHeaders(gatewayResponse, config);
      }
    }

    // 权限检查（如果启用了认证）
    if (authMiddleware && auth) {
      const { allowed, reason } = checkRoutePermission(req.method, req.path, auth);
      if (!allowed) {
        return errorResponse(auth.authenticated ? 403 : 401, reason || 'Permission denied', config);
      }
    }

    // 内部路由
    const internalResponse = await internalRouter.handle(req);
    if (internalResponse) {
      return addCorsHeaders(internalResponse, config);
    }

    // API 路由
    const apiResponse = await apiRouter.handle(req);
    return addCorsHeaders(apiResponse, config);
  }

  /**
   * 创建请求处理器
   */
  function createRequestHandler(router: 'api' | 'internal' | 'unified') {
    return async (nodeReq: import('http').IncomingMessage, nodeRes: import('http').ServerResponse) => {
      try {
        // 解析请求
        const chunks: Buffer[] = [];
        for await (const chunk of nodeReq) {
          chunks.push(chunk);
        }
        const bodyStr = Buffer.concat(chunks).toString();

        const url = new URL(nodeReq.url ?? '/', `http://${nodeReq.headers.host}`);
        
        let body: unknown;
        if (bodyStr) {
          try {
            body = JSON.parse(bodyStr);
          } catch {
            // 非 JSON body，保持 undefined
          }
        }

        const req: HttpRequest = {
          method: nodeReq.method ?? 'GET',
          path: url.pathname,
          headers: Object.fromEntries(
            Object.entries(nodeReq.headers).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])
          ),
          body,
          query: Object.fromEntries(url.searchParams),
        };

        // 路由处理
        let response: HttpResponse;
        if (router === 'api') {
          // 仅 API 路由，但仍需认证
          if (authMiddleware) {
            const auth = await authMiddleware.authenticate(req);
            (req as AuthenticatedRequest).auth = auth;
            
            const { allowed, reason } = checkRoutePermission(req.method, req.path, auth);
            if (!allowed) {
              response = errorResponse(auth.authenticated ? 403 : 401, reason || 'Permission denied', config);
            } else {
              response = await apiRouter.handle(req);
              response = addCorsHeaders(response, config);
            }
          } else {
            response = await apiRouter.handle(req);
            response = addCorsHeaders(response, config);
          }
        } else if (router === 'internal') {
          // 仅内部路由
          if (authMiddleware) {
            const auth = await authMiddleware.authenticate(req);
            (req as AuthenticatedRequest).auth = auth;
          }
          
          // 先检查认证路由
          if (authRouter) {
            const authResponse = await authRouter.handle(req);
            if (authResponse) {
              response = addCorsHeaders(authResponse, config);
            } else {
              const internalResponse = await internalRouter.handle(req);
              response = internalResponse 
                ? addCorsHeaders(internalResponse, config)
                : errorResponse(404, 'Not found', config);
            }
          } else {
            const internalResponse = await internalRouter.handle(req);
            response = internalResponse 
              ? addCorsHeaders(internalResponse, config)
              : errorResponse(404, 'Not found', config);
          }
        } else {
          // 统一处理
          response = await handleRequest(req);
        }

        // 发送响应
        nodeRes.writeHead(response.status, response.headers);

        if (response.stream) {
          // 流式响应
          for await (const chunk of response.stream) {
            nodeRes.write(chunk);
          }
          nodeRes.end();
        } else if (response.body) {
          nodeRes.end(JSON.stringify(response.body));
        } else {
          nodeRes.end();
        }
      } catch (error) {
        console.error('Server error:', error);
        const errResponse = errorResponse(500, 'Internal server error', config);
        nodeRes.writeHead(errResponse.status, errResponse.headers);
        nodeRes.end(JSON.stringify(errResponse.body));
      }
    };
  }

  return {
    async start() {
      // 动态导入 http 模块
      httpModule = await import('http');

      if (serverConfig.apiPort && serverConfig.internalPort) {
        // 分离模式：API 和内部服务使用不同端口
        apiServer = httpModule.createServer(createRequestHandler('api'));
        internalServer = httpModule.createServer(createRequestHandler('internal'));

        await Promise.all([
          new Promise<void>((resolve) => {
            apiServer!.listen(serverConfig.apiPort, serverConfig.host, () => {
              console.log(`API server listening on ${serverConfig.host}:${serverConfig.apiPort}`);
              resolve();
            });
          }),
          new Promise<void>((resolve) => {
            internalServer!.listen(serverConfig.internalPort, serverConfig.host, () => {
              console.log(`Internal server listening on ${serverConfig.host}:${serverConfig.internalPort}`);
              resolve();
            });
          }),
        ]);
      } else {
        // 统一模式：所有请求使用同一端口
        unifiedServer = httpModule.createServer(createRequestHandler('unified'));

        await new Promise<void>((resolve) => {
          unifiedServer!.listen(serverConfig.port, serverConfig.host, () => {
            console.log(`Server listening on ${serverConfig.host}:${serverConfig.port}`);
            resolve();
          });
        });
      }
    },

    async stop() {
      const closePromises: Promise<void>[] = [];

      if (apiServer) {
        closePromises.push(new Promise((resolve) => apiServer!.close(() => resolve())));
      }
      if (internalServer) {
        closePromises.push(new Promise((resolve) => internalServer!.close(() => resolve())));
      }
      if (unifiedServer) {
        closePromises.push(new Promise((resolve) => unifiedServer!.close(() => resolve())));
      }

      await Promise.all(closePromises);
    },

    handleRequest,

    getPorts() {
      return {
        api: serverConfig.apiPort,
        internal: serverConfig.internalPort,
        unified: serverConfig.apiPort || serverConfig.internalPort ? undefined : serverConfig.port,
      };
    },
  };
}

export { ApiRouter, InternalRouter };
export type { ApiRouterConfig, InternalRouterConfig, HttpRequest, HttpResponse };
