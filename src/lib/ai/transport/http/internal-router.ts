/**
 * 内部 API 路由 - UI 使用
 * Internal API Router - For UI Usage
 */

import type { InternalService } from '../../core/internal-service';
import type { AIProvider } from '../../types';
import type { InternalChatRequest } from '../../core/types';
import type { HttpRequest, HttpResponse } from './api-router';

export interface InternalRouterConfig {
  /** 前缀路径 */
  prefix?: string;
  /** 启用认证 */
  enableAuth?: boolean;
  /** 认证验证函数 */
  validateAuth?: (req: HttpRequest) => Promise<boolean>;
}

type RouteHandler = (req: HttpRequest, params: Record<string, string>) => Promise<HttpResponse>;

interface Route {
  pattern: RegExp;
  paramNames: string[];
  handlers: Map<string, RouteHandler>;
}

export class InternalRouter {
  private internalService: InternalService;
  private config: InternalRouterConfig;
  private routes: Route[] = [];
  private prefix: string;

  constructor(internalService: InternalService, config: InternalRouterConfig = {}) {
    this.internalService = internalService;
    this.config = {
      prefix: '/internal',
      enableAuth: false,
      ...config,
    };
    this.prefix = this.config.prefix!;
    
    this.setupRoutes();
  }

  private setupRoutes() {
    // 聊天
    this.addRoute('POST', '/chat', this.handleChat.bind(this));
    this.addRoute('POST', '/chat/stream', this.handleStreamChat.bind(this));
    
    // 对话管理
    this.addRoute('GET', '/conversations', this.handleListConversations.bind(this));
    this.addRoute('GET', '/conversations/:id', this.handleGetConversation.bind(this));
    this.addRoute('DELETE', '/conversations/:id', this.handleDeleteConversation.bind(this));
    this.addRoute('GET', '/conversations/:id/messages', this.handleGetMessages.bind(this));
    
    // 提供商管理
    this.addRoute('GET', '/providers', this.handleListProviders.bind(this));
    this.addRoute('POST', '/providers/:provider/key', this.handleSetApiKey.bind(this));
    this.addRoute('DELETE', '/providers/:provider/key', this.handleDeleteApiKey.bind(this));
    
    // 统计
    this.addRoute('GET', '/stats', this.handleGetStats.bind(this));
  }

  private addRoute(method: string, path: string, handler: RouteHandler) {
    const fullPath = this.prefix + path;
    
    // 解析路径参数
    const paramNames: string[] = [];
    const patternStr = fullPath.replace(/:([^/]+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });
    
    const pattern = new RegExp(`^${patternStr}$`);
    
    // 查找已存在的路由
    let route = this.routes.find(r => r.pattern.source === pattern.source);
    if (!route) {
      route = { pattern, paramNames, handlers: new Map() };
      this.routes.push(route);
    }
    
    route.handlers.set(method, handler);
  }

  /**
   * 处理请求
   */
  async handle(req: HttpRequest): Promise<HttpResponse | null> {
    // 检查路径是否以前缀开头
    if (!req.path.startsWith(this.prefix)) {
      return null; // 不匹配，交给其他路由处理
    }

    // 认证检查
    if (this.config.enableAuth && this.config.validateAuth) {
      const isValid = await this.config.validateAuth(req);
      if (!isValid) {
        return this.errorResponse(401, 'Unauthorized');
      }
    }

    // 路由匹配
    for (const route of this.routes) {
      const match = req.path.match(route.pattern);
      if (match) {
        const handler = route.handlers.get(req.method);
        if (handler) {
          // 提取参数
          const params: Record<string, string> = {};
          route.paramNames.forEach((name, index) => {
            params[name] = match[index + 1];
          });
          
          try {
            return await handler(req, params);
          } catch (error) {
            console.error('Internal router error:', error);
            return this.errorResponse(500, error instanceof Error ? error.message : 'Internal error');
          }
        }
        return this.errorResponse(405, 'Method not allowed');
      }
    }

    return this.errorResponse(404, 'Not found');
  }

  /**
   * 处理聊天
   */
  private async handleChat(req: HttpRequest, params: Record<string, string>): Promise<HttpResponse> {
    const body = req.body as InternalChatRequest;
    
    if (!body.message) {
      return this.errorResponse(400, 'message is required');
    }

    const response = await this.internalService.chat(body);
    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: response,
    };
  }

  /**
   * 处理流式聊天
   */
  private async handleStreamChat(req: HttpRequest, params: Record<string, string>): Promise<HttpResponse> {
    const body = req.body as InternalChatRequest;
    
    if (!body.message) {
      return this.errorResponse(400, 'message is required');
    }

    async function* streamGenerator(service: InternalService, request: InternalChatRequest) {
      const chunks: string[] = [];
      let resolveNext: ((value: string | null) => void) | null = null;
      let done = false;

      const promise = service.streamChat(request, (content) => {
        if (resolveNext) {
          resolveNext(content);
          resolveNext = null;
        } else {
          chunks.push(content);
        }
      }).then((result) => {
        done = true;
        if (resolveNext) {
          resolveNext(null);
        }
        return result;
      });

      while (true) {
        let content: string | null;
        if (chunks.length > 0) {
          content = chunks.shift()!;
        } else if (done) {
          break;
        } else {
          content = await new Promise<string | null>((resolve) => {
            resolveNext = resolve;
          });
        }

        if (content === null) break;
        yield `data: ${JSON.stringify({ content })}\n\n`;
      }

      const result = await promise;
      yield `data: ${JSON.stringify({ done: true, ...result })}\n\n`;
    }

    return {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
      stream: streamGenerator(this.internalService, body),
    };
  }

  /**
   * 获取对话列表
   */
  private async handleListConversations(req: HttpRequest, params: Record<string, string>): Promise<HttpResponse> {
    const limit = req.query?.limit ? parseInt(req.query.limit) : undefined;
    const offset = req.query?.offset ? parseInt(req.query.offset) : undefined;
    
    const conversations = await this.internalService.listConversations({ limit, offset });
    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { data: conversations },
    };
  }

  /**
   * 获取对话详情
   */
  private async handleGetConversation(req: HttpRequest, params: Record<string, string>): Promise<HttpResponse> {
    const messages = await this.internalService.getConversationMessages(params.id);
    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { id: params.id, messages },
    };
  }

  /**
   * 删除对话
   */
  private async handleDeleteConversation(req: HttpRequest, params: Record<string, string>): Promise<HttpResponse> {
    const success = await this.internalService.deleteConversation(params.id);
    return {
      status: success ? 200 : 404,
      headers: { 'Content-Type': 'application/json' },
      body: { success },
    };
  }

  /**
   * 获取对话消息
   */
  private async handleGetMessages(req: HttpRequest, params: Record<string, string>): Promise<HttpResponse> {
    const messages = await this.internalService.getConversationMessages(params.id);
    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { data: messages },
    };
  }

  /**
   * 获取提供商列表
   */
  private async handleListProviders(req: HttpRequest, params: Record<string, string>): Promise<HttpResponse> {
    const providers = await this.internalService.listProviders();
    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { data: providers },
    };
  }

  /**
   * 设置 API Key
   */
  private async handleSetApiKey(req: HttpRequest, params: Record<string, string>): Promise<HttpResponse> {
    const body = req.body as { apiKey: string };
    
    if (!body.apiKey) {
      return this.errorResponse(400, 'apiKey is required');
    }

    await this.internalService.setApiKey(params.provider as AIProvider, body.apiKey);
    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { success: true },
    };
  }

  /**
   * 删除 API Key
   */
  private async handleDeleteApiKey(req: HttpRequest, params: Record<string, string>): Promise<HttpResponse> {
    const success = await this.internalService.deleteApiKey(params.provider as AIProvider);
    return {
      status: success ? 200 : 404,
      headers: { 'Content-Type': 'application/json' },
      body: { success },
    };
  }

  /**
   * 获取统计信息
   */
  private async handleGetStats(req: HttpRequest, params: Record<string, string>): Promise<HttpResponse> {
    const stats = await this.internalService.getStats();
    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: stats,
    };
  }

  /**
   * 错误响应
   */
  private errorResponse(status: number, message: string): HttpResponse {
    return {
      status,
      headers: { 'Content-Type': 'application/json' },
      body: { error: { message, code: status } },
    };
  }
}

export function createInternalRouter(internalService: InternalService, config?: InternalRouterConfig): InternalRouter {
  return new InternalRouter(internalService, config);
}
