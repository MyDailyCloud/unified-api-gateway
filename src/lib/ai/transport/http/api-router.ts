/**
 * 对外 API 路由 - OpenAI 兼容
 * External API Router - OpenAI Compatible
 */

import type { AIService } from '../../core/ai-service';
import type { ChatCompletionRequest, ChatCompletionChunk } from '../../core/types';

export interface ApiRouterConfig {
  /** 启用 API Key 认证 */
  enableAuth?: boolean;
  /** API Key 验证函数 */
  validateApiKey?: (apiKey: string) => Promise<boolean>;
  /** CORS 源 */
  corsOrigin?: string | string[];
}

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
  stream?: AsyncIterable<string>;
}

type RouteHandler = (req: HttpRequest) => Promise<HttpResponse>;

export class ApiRouter {
  private aiService: AIService;
  private config: ApiRouterConfig;
  private routes: Map<string, Map<string, RouteHandler>> = new Map();

  constructor(aiService: AIService, config: ApiRouterConfig = {}) {
    this.aiService = aiService;
    this.config = {
      enableAuth: false,
      corsOrigin: '*',
      ...config,
    };
    
    this.setupRoutes();
  }

  private setupRoutes() {
    // POST /v1/chat/completions
    this.addRoute('POST', '/v1/chat/completions', this.handleChatCompletions.bind(this));
    
    // GET /v1/models
    this.addRoute('GET', '/v1/models', this.handleListModels.bind(this));
    
    // GET /health
    this.addRoute('GET', '/health', this.handleHealth.bind(this));
    
    // OPTIONS (CORS)
    this.addRoute('OPTIONS', '*', this.handleOptions.bind(this));
  }

  private addRoute(method: string, path: string, handler: RouteHandler) {
    if (!this.routes.has(path)) {
      this.routes.set(path, new Map());
    }
    this.routes.get(path)!.set(method, handler);
  }

  /**
   * 处理请求
   */
  async handle(req: HttpRequest): Promise<HttpResponse> {
    // CORS 预检
    if (req.method === 'OPTIONS') {
      return this.handleOptions(req);
    }

    // API Key 认证
    if (this.config.enableAuth) {
      const authResult = await this.authenticate(req);
      if (authResult) return authResult;
    }

    // 路由匹配
    const pathRoutes = this.routes.get(req.path);
    if (pathRoutes) {
      const handler = pathRoutes.get(req.method);
      if (handler) {
        try {
          const response = await handler(req);
          return this.addCorsHeaders(response);
        } catch (error) {
          return this.errorResponse(500, error instanceof Error ? error.message : 'Internal server error');
        }
      }
    }

    return this.errorResponse(404, 'Not found');
  }

  /**
   * 认证检查
   */
  private async authenticate(req: HttpRequest): Promise<HttpResponse | null> {
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      return this.errorResponse(401, 'Missing or invalid Authorization header');
    }

    const apiKey = authHeader.substring(7);
    if (this.config.validateApiKey) {
      const isValid = await this.config.validateApiKey(apiKey);
      if (!isValid) {
        return this.errorResponse(401, 'Invalid API key');
      }
    }

    return null;
  }

  /**
   * 处理聊天补全
   */
  private async handleChatCompletions(req: HttpRequest): Promise<HttpResponse> {
    const body = req.body as ChatCompletionRequest;
    
    if (!body.messages || !Array.isArray(body.messages)) {
      return this.errorResponse(400, 'messages is required and must be an array');
    }

    // 流式响应
    if (body.stream) {
      return this.handleStreamingChat(body);
    }

    // 非流式响应
    const response = await this.aiService.chatCompletion(body);
    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: response,
    };
  }

  /**
   * 处理流式聊天
   */
  private async handleStreamingChat(body: ChatCompletionRequest): Promise<HttpResponse> {
    const chunks: ChatCompletionChunk[] = [];
    
    // 创建异步生成器
    async function* streamGenerator(aiService: AIService, request: ChatCompletionRequest) {
      const chunkQueue: ChatCompletionChunk[] = [];
      let resolveNext: ((value: ChatCompletionChunk | null) => void) | null = null;
      let done = false;

      const promise = aiService.streamChatCompletion(request, (chunk) => {
        if (resolveNext) {
          resolveNext(chunk);
          resolveNext = null;
        } else {
          chunkQueue.push(chunk);
        }
      }).then(() => {
        done = true;
        if (resolveNext) {
          resolveNext(null);
        }
      });

      while (true) {
        let chunk: ChatCompletionChunk | null;
        if (chunkQueue.length > 0) {
          chunk = chunkQueue.shift()!;
        } else if (done) {
          break;
        } else {
          chunk = await new Promise<ChatCompletionChunk | null>((resolve) => {
            resolveNext = resolve;
          });
        }

        if (chunk === null) break;
        yield `data: ${JSON.stringify(chunk)}\n\n`;
      }

      yield 'data: [DONE]\n\n';
      await promise;
    }

    return {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
      stream: streamGenerator(this.aiService, body),
    };
  }

  /**
   * 处理模型列表
   */
  private async handleListModels(req: HttpRequest): Promise<HttpResponse> {
    const models = await this.aiService.listModels();
    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: models,
    };
  }

  /**
   * 健康检查
   */
  private async handleHealth(req: HttpRequest): Promise<HttpResponse> {
    const stats = this.aiService.getStats();
    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        status: 'ok',
        uptime: stats.uptime,
        requests: stats.requests,
      },
    };
  }

  /**
   * CORS 预检
   */
  private async handleOptions(req: HttpRequest): Promise<HttpResponse> {
    return {
      status: 204,
      headers: this.getCorsHeaders(),
    };
  }

  /**
   * 获取 CORS 头
   */
  private getCorsHeaders(): Record<string, string> {
    const origin = Array.isArray(this.config.corsOrigin)
      ? this.config.corsOrigin.join(', ')
      : this.config.corsOrigin ?? '*';
    
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };
  }

  /**
   * 添加 CORS 头
   */
  private addCorsHeaders(response: HttpResponse): HttpResponse {
    return {
      ...response,
      headers: {
        ...response.headers,
        ...this.getCorsHeaders(),
      },
    };
  }

  /**
   * 错误响应
   */
  private errorResponse(status: number, message: string): HttpResponse {
    return this.addCorsHeaders({
      status,
      headers: { 'Content-Type': 'application/json' },
      body: {
        error: {
          message,
          type: status === 401 ? 'authentication_error' : 
                status === 400 ? 'invalid_request_error' : 
                status === 404 ? 'not_found_error' : 'api_error',
          code: status,
        },
      },
    });
  }
}

export function createApiRouter(aiService: AIService, config?: ApiRouterConfig): ApiRouter {
  return new ApiRouter(aiService, config);
}
