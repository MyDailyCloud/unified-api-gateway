/**
 * AI SDK Server Module
 * 
 * 重构说明：
 * - 保留配置加载和验证工具
 * - 保留认证模块导出
 * - 废弃直接的 createServer()，改用 app/node.ts 的 startNodeServer()
 * 
 * 推荐使用方式：
 * ```typescript
 * import { startNodeServer } from './app/node';
 * const app = await startNodeServer({ ... });
 * ```
 */

// ==================== 配置工具 ====================
export { 
  loadConfig, 
  validateConfig, 
  generateExampleConfig,
  type ServerConfig, 
  type ProviderConfigEntry,
} from './config';

// ==================== 认证模块 ====================
export * from './auth';
export { initServer, cleanupServer } from './init';
export type { ServerInitConfig, ServerInitResult } from './init';

// ==================== 请求日志 ====================
export { 
  RequestLogger,
  type RequestLogEntry,
  type LogFilter,
} from './request-logger';

// ==================== 速率限制 ====================
export {
  RateLimiter,
  type RateLimitConfig,
  type RateLimitResult,
} from './rate-limiter';

// ==================== 兼容性导出（已废弃） ====================

import { AIClient } from '../client';
import { loadConfig, validateConfig, type ServerConfig, type ProviderConfigEntry } from './config';
import type { ChatCompletionRequest, StreamChunk, AIProvider } from '../types';
import { ProviderRateLimiter, RATE_LIMIT_PRESETS } from '../queue';
import { createStorage, type UnifiedStorage } from '../storage';
import { ConversationManager, MessageManager, createConversationManager, createMessageManager } from '../models';

/**
 * @deprecated 请使用 app/node.ts 中的 startNodeServer()
 * @see startNodeServer
 */
export interface ExtendedServerConfig extends ServerConfig {
  enableRateLimiting?: boolean;
  enablePersistence?: boolean;
  dbPath?: string;
  apiKey?: string;
}

/**
 * @deprecated 请使用 app/node.ts 中的 NodeAppInstance
 * @see NodeAppInstance
 */
export interface ServerInstance {
  start(): Promise<void>;
  stop(): Promise<void>;
  getClient(): AIClient;
  getConfig(): ServerConfig;
  getRateLimiter(): ProviderRateLimiter | null;
  getStorage(): UnifiedStorage | null;
  getConversationManager(): ConversationManager | null;
  getMessageManager(): MessageManager | null;
}

/**
 * @deprecated 请使用 app/node.ts 中的 startNodeServer()
 * 
 * 此函数保留仅为向后兼容，新代码应使用：
 * ```typescript
 * import { startNodeServer } from './app/node';
 * const app = await startNodeServer({ ... });
 * ```
 */
export async function createServer(configOrPath?: ExtendedServerConfig | string): Promise<ServerInstance> {
  console.warn('[DEPRECATED] createServer() is deprecated. Use startNodeServer() from app/node.ts instead.');
  
  // 加载配置
  const baseConfig = typeof configOrPath === 'string' || configOrPath === undefined
    ? await loadConfig(typeof configOrPath === 'string' ? configOrPath : undefined)
    : configOrPath;

  const config: ExtendedServerConfig = {
    enableRateLimiting: true,
    enablePersistence: false,
    ...baseConfig,
  };

  // 验证配置
  const validation = validateConfig(config);
  if (!validation.valid) {
    console.error('Configuration errors:');
    validation.errors.forEach(e => console.error(`  - ${e}`));
    if (config.providers.length === 0) {
      console.log('\nHint: Set API keys via environment variables:');
      console.log('  export OPENAI_API_KEY=sk-...');
      console.log('  export ANTHROPIC_API_KEY=sk-ant-...');
    }
  }

  // 创建 AI Client
  const client = new AIClient();

  // 注册所有配置的提供商
  for (const providerConfig of config.providers) {
    try {
      client.registerProvider({
        provider: providerConfig.provider,
        apiKey: providerConfig.apiKey,
        baseURL: providerConfig.baseUrl,
        defaultModel: providerConfig.defaultModel,
      });
      log(config, 'info', `Registered provider: ${providerConfig.provider}`);
    } catch (error) {
      log(config, 'error', `Failed to register provider ${providerConfig.provider}: ${error}`);
    }
  }

  // 创建速率限制器
  let rateLimiter: ProviderRateLimiter | null = null;
  if (config.enableRateLimiting) {
    rateLimiter = new ProviderRateLimiter();
    for (const provider of client.getProviders()) {
      const preset = RATE_LIMIT_PRESETS[provider];
      if (preset) {
        rateLimiter.setProviderConfig(provider, preset);
      }
    }
    log(config, 'info', 'Rate limiting enabled');
  }

  // 创建存储和管理器
  let storage: UnifiedStorage | null = null;
  let conversationManager: ConversationManager | null = null;
  let messageManager: MessageManager | null = null;
  
  if (config.enablePersistence) {
    storage = await createStorage({ 
      type: 'sqlite', 
      dbPath: config.dbPath || './ai-server.db' 
    });
    conversationManager = createConversationManager(storage);
    messageManager = createMessageManager(storage);
    log(config, 'info', 'Persistence enabled');
  }

  let server: ReturnType<typeof import('http').createServer> | null = null;
  const stats = {
    uptime: 0,
    startedAt: 0,
    requests: { total: 0, chat: 0, stream: 0, conversations: 0 },
  };

  return {
    async start() {
      const http = await import('http');
      stats.startedAt = Date.now();
      
      server = http.createServer(async (req, res) => {
        stats.requests.total++;
        
        // CORS 处理
        if (config.cors?.enabled) {
          const origin = config.cors.origins?.includes('*') ? '*' : config.cors.origins?.join(', ') || '*';
          res.setHeader('Access-Control-Allow-Origin', origin);
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        }

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        // API 认证
        if (config.apiKey) {
          const authHeader = req.headers.authorization;
          const token = authHeader?.replace('Bearer ', '');
          if (token !== config.apiKey) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized' }));
            return;
          }
        }

        const url = new URL(req.url || '/', `http://${req.headers.host}`);
        
        try {
          // 健康检查
          if (url.pathname === '/health' || url.pathname === '/') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              status: 'ok',
              providers: client.getProviders(),
              timestamp: new Date().toISOString(),
              deprecated: true,
              message: 'This server implementation is deprecated. Use startNodeServer() instead.',
            }));
            return;
          }

          // 模型列表
          if (url.pathname === '/v1/models' || url.pathname === '/models') {
            const models = await client.listAllModels();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              object: 'list',
              data: models.map(m => ({
                id: m.id,
                object: 'model',
                created: Date.now(),
                owned_by: m.provider,
              })),
            }));
            return;
          }

          // Chat Completions 端点
          if ((url.pathname === '/v1/chat/completions' || url.pathname === '/chat/completions') && req.method === 'POST') {
            const body = await readBody(req);
            const request = JSON.parse(body) as ChatCompletionRequest & { provider?: AIProvider };
            
            const provider = request.provider;
            log(config, 'info', `Chat request: model=${request.model}, stream=${request.stream}, provider=${provider || 'default'}`);

            if (request.stream) {
              stats.requests.stream++;
              res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
              });

              try {
                const stream = await client.chatStream(request, provider);
                
                for await (const chunk of stream) {
                  const data = formatSSEChunk(chunk);
                  res.write(`data: ${JSON.stringify(data)}\n\n`);
                }
                
                res.write('data: [DONE]\n\n');
              } catch (error) {
                const errorData = { error: { message: String(error) } };
                res.write(`data: ${JSON.stringify(errorData)}\n\n`);
              }
              
              res.end();
            } else {
              stats.requests.chat++;
              
              let response;
              if (rateLimiter && provider) {
                response = await rateLimiter.request(
                  request,
                  provider,
                  (req, prov) => client.chat(req, prov)
                );
              } else {
                response = await client.chat(request, provider);
              }
              
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(response));
            }
            return;
          }

          // 404
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not Found', path: url.pathname }));
          
        } catch (error) {
          log(config, 'error', `Request error: ${error}`);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: String(error) } }));
        }
      });

      return new Promise((resolve) => {
        server!.listen(config.port, config.host, () => {
          console.log(`\n⚠️  [DEPRECATED] Using legacy createServer()`);
          console.log(`   Please migrate to startNodeServer() from app/node.ts\n`);
          console.log(`🚀 AI SDK Server running at http://${config.host}:${config.port}`);
          console.log(`   Providers: ${client.getProviders().join(', ') || 'none'}`);
          resolve();
        });
      });
    },

    async stop() {
      if (server) {
        return new Promise((resolve) => {
          server!.close(async () => {
            if (storage?.close) {
              await storage.close();
            }
            log(config, 'info', 'Server stopped');
            resolve();
          });
        });
      }
    },

    getClient() {
      return client;
    },

    getConfig() {
      return config;
    },

    getRateLimiter() {
      return rateLimiter;
    },

    getStorage() {
      return storage;
    },

    getConversationManager() {
      return conversationManager;
    },

    getMessageManager() {
      return messageManager;
    },
  };
}

// ==================== 辅助函数 ====================

function readBody(req: import('http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function formatSSEChunk(chunk: StreamChunk): object {
  return {
    id: chunk.id || `chatcmpl-${Date.now()}`,
    object: 'chat.completion.chunk',
    created: chunk.created || Math.floor(Date.now() / 1000),
    model: chunk.model || 'unknown',
    choices: chunk.choices.map((choice, index) => ({
      index,
      delta: {
        role: choice.delta.role,
        content: choice.delta.content,
      },
      finish_reason: choice.finish_reason || null,
    })),
  };
}

function log(config: ServerConfig, level: string, message: string) {
  if (!config.logging?.enabled) return;
  
  const levels = ['debug', 'info', 'warn', 'error'];
  const configLevel = config.logging.level || 'info';
  
  if (levels.indexOf(level) >= levels.indexOf(configLevel)) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
  }
}

/**
 * @deprecated 请使用 startNodeServer()
 */
export async function startServer(configPath?: string): Promise<ServerInstance> {
  console.warn('[DEPRECATED] startServer() is deprecated. Use startNodeServer() from app/node.ts instead.');
  const server = await createServer(configPath);
  await server.start();
  return server;
}
