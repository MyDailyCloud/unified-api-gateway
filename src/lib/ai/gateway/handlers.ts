/**
 * Gateway HTTP Handlers
 * 网关 HTTP 请求处理器
 */

import type { AIGateway } from './gateway';
import type { RequestFormat, ResponseFormat, RequestHandler, GatewayConfig } from './types';
import { createAIGateway } from './gateway';

/**
 * Endpoint configuration
 */
export interface EndpointConfig {
  /** Base path for endpoints */
  basePath?: string;
  
  /** Enable specific format endpoints */
  formats?: RequestFormat[];
  
  /** Custom path mappings */
  pathMappings?: Record<string, RequestFormat>;
}

/**
 * Default path mappings
 */
const DEFAULT_PATH_MAPPINGS: Record<string, RequestFormat> = {
  '/v1/chat/completions': 'openai',
  '/v1/openai/chat/completions': 'openai',
  '/v1/anthropic/messages': 'anthropic',
  '/v1/google/generateContent': 'google',
  '/v1/cohere/chat': 'cohere',
  '/openai/v1/chat/completions': 'openai',
  '/anthropic/v1/messages': 'anthropic',
  '/google/v1/generateContent': 'google',
  '/cohere/v1/chat': 'cohere',
};

/**
 * Create endpoint handlers for all supported formats
 */
export function createEndpointHandlers(
  gateway: AIGateway,
  config?: EndpointConfig
): Record<string, RequestHandler> {
  const basePath = config?.basePath || '';
  const formats = config?.formats || ['openai', 'anthropic', 'google', 'cohere'];
  const handlers: Record<string, RequestHandler> = {};
  
  for (const format of formats) {
    const paths = getPathsForFormat(format, basePath);
    const handler = gateway.createHandler(format);
    
    for (const path of paths) {
      handlers[path] = handler;
    }
  }
  
  // Add custom path mappings
  if (config?.pathMappings) {
    for (const [path, format] of Object.entries(config.pathMappings)) {
      handlers[`${basePath}${path}`] = gateway.createHandler(format);
    }
  }
  
  return handlers;
}

/**
 * Get paths for a format
 */
function getPathsForFormat(format: RequestFormat, basePath: string): string[] {
  const paths: string[] = [];
  
  switch (format) {
    case 'openai':
      paths.push(
        `${basePath}/v1/chat/completions`,
        `${basePath}/v1/openai/chat/completions`,
        `${basePath}/openai/v1/chat/completions`
      );
      break;
    case 'anthropic':
      paths.push(
        `${basePath}/v1/anthropic/messages`,
        `${basePath}/anthropic/v1/messages`,
        `${basePath}/v1/messages`
      );
      break;
    case 'google':
      paths.push(
        `${basePath}/v1/google/generateContent`,
        `${basePath}/google/v1/generateContent`,
        `${basePath}/v1/generateContent`
      );
      break;
    case 'cohere':
      paths.push(
        `${basePath}/v1/cohere/chat`,
        `${basePath}/cohere/v1/chat`
      );
      break;
  }
  
  return paths;
}

/**
 * Create a unified request router
 */
export function createRequestRouter(
  gateway: AIGateway,
  config?: EndpointConfig
): RequestHandler {
  const pathMappings = {
    ...DEFAULT_PATH_MAPPINGS,
    ...config?.pathMappings,
  };
  
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const path = url.pathname;
    
    // Check for CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Response-Format',
        },
      });
    }
    
    // Find matching format
    let format: RequestFormat | undefined;
    
    // Check exact match
    if (pathMappings[path]) {
      format = pathMappings[path];
    } else {
      // Check partial match
      for (const [mappedPath, mappedFormat] of Object.entries(pathMappings)) {
        if (path.endsWith(mappedPath) || path.includes(mappedPath)) {
          format = mappedFormat;
          break;
        }
      }
    }
    
    // Default to OpenAI format
    if (!format) {
      format = 'openai';
    }
    
    return gateway.createHandler(format)(req);
  };
}

/**
 * Create health check handler
 */
export function createHealthHandler(gateway: AIGateway): RequestHandler {
  return async (_req: Request): Promise<Response> => {
    const stats = gateway.getStats();
    const healthy = stats.backends.some(b => b.healthy);
    
    return new Response(
      JSON.stringify({
        status: healthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        backends: stats.backends.map(b => ({
          name: b.name,
          healthy: b.healthy,
          avgLatency: Math.round(b.avgLatency),
          requestCount: b.requestCount,
          errorCount: b.errorCount,
        })),
        totals: {
          requests: stats.totalRequests,
          errors: stats.totalErrors,
          errorRate: stats.totalRequests > 0 
            ? (stats.totalErrors / stats.totalRequests * 100).toFixed(2) + '%'
            : '0%',
        },
      }),
      {
        status: healthy ? 200 : 503,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  };
}

/**
 * Create models listing handler
 */
export function createModelsHandler(gateway: AIGateway): RequestHandler {
  return async (_req: Request): Promise<Response> => {
    try {
      const models = await gateway.getClient().listAllModels();
      
      // Format as OpenAI-compatible response
      return new Response(
        JSON.stringify({
          object: 'list',
          data: models.map(m => ({
            id: m.id,
            object: 'model',
            created: Math.floor(Date.now() / 1000),
            owned_by: m.provider || 'unknown',
            permission: [],
            root: m.id,
            parent: null,
          })),
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ error: { message: (error as Error).message } }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }
  };
}

/**
 * Create complete gateway server handler
 */
export function createGatewayServer(config: GatewayConfig): RequestHandler {
  const gateway = createAIGateway(config);
  const router = createRequestRouter(gateway);
  const healthHandler = createHealthHandler(gateway);
  const modelsHandler = createModelsHandler(gateway);
  
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const path = url.pathname;
    
    // Health check
    if (path === '/health' || path === '/v1/health') {
      return healthHandler(req);
    }
    
    // Models listing
    if (path === '/v1/models' || path === '/models') {
      return modelsHandler(req);
    }
    
    // Route to appropriate handler
    return router(req);
  };
}

export default createGatewayServer;
