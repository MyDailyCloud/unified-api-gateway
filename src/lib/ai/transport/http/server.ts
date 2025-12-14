/**
 * HTTP 服务器 - 统一入口
 * HTTP Server - Unified Entry Point
 */

import type { AICore } from '../../core';
import { ApiRouter, type ApiRouterConfig, type HttpRequest, type HttpResponse } from './api-router';
import { InternalRouter, type InternalRouterConfig } from './internal-router';

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
 * 创建 HTTP 服务器
 */
export function createHttpServer(core: AICore, config: HttpServerConfig = {}): HttpServerInstance {
  const apiRouter = new ApiRouter(core.ai, config.api);
  const internalRouter = new InternalRouter(core.internal, config.internal);
  
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
   * 处理请求
   */
  async function handleRequest(req: HttpRequest): Promise<HttpResponse> {
    // 先尝试内部路由
    const internalResponse = await internalRouter.handle(req);
    if (internalResponse) {
      return internalResponse;
    }

    // 再尝试 API 路由
    return apiRouter.handle(req);
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
        
        const req: HttpRequest = {
          method: nodeReq.method ?? 'GET',
          path: url.pathname,
          headers: Object.fromEntries(
            Object.entries(nodeReq.headers).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])
          ),
          body: bodyStr ? JSON.parse(bodyStr) : undefined,
          query: Object.fromEntries(url.searchParams),
        };

        // 路由处理
        let response: HttpResponse;
        if (router === 'api') {
          response = await apiRouter.handle(req);
        } else if (router === 'internal') {
          const internalResponse = await internalRouter.handle(req);
          response = internalResponse ?? { status: 404, headers: {}, body: { error: 'Not found' } };
        } else {
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
        nodeRes.writeHead(500, { 'Content-Type': 'application/json' });
        nodeRes.end(JSON.stringify({ error: 'Internal server error' }));
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
