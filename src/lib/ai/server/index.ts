/**
 * AI SDK HTTP Server
 * Node.js HTTP 服务器实现 - 提供 OpenAI 兼容的 API 端点
 * 支持高并发、速率限制、对话管理
 */

import { AIClient } from '../client';
import { loadConfig, validateConfig, type ServerConfig, type ProviderConfigEntry } from './config';
import type { ChatCompletionRequest, StreamChunk, AIProvider } from '../types';
import { ProviderRateLimiter, RATE_LIMIT_PRESETS } from '../queue';
import { createStorage, type UnifiedStorage } from '../storage';
import { ConversationManager, MessageManager, createConversationManager, createMessageManager } from '../models';

export { loadConfig, validateConfig, generateExampleConfig } from './config';
export type { ServerConfig, ProviderConfigEntry } from './config';

// 导出认证模块
export * from './auth';
export { initServer, cleanupServer } from './init';
export type { ServerInitConfig, ServerInitResult } from './init';

// ==================== 扩展服务器配置 ====================

export interface ExtendedServerConfig extends ServerConfig {
  /** 启用并发控制 */
  enableRateLimiting?: boolean;
  /** 启用对话持久化 */
  enablePersistence?: boolean;
  /** 数据库路径 */
  dbPath?: string;
  /** API 认证密钥（可选） */
  apiKey?: string;
}

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

// ==================== 服务器统计 ====================

interface ServerStats {
  uptime: number;
  startedAt: number;
  requests: {
    total: number;
    chat: number;
    stream: number;
    conversations: number;
  };
}

/**
 * 创建 HTTP 服务器
 * Create HTTP server with OpenAI-compatible endpoints
 */
export async function createServer(configOrPath?: ExtendedServerConfig | string): Promise<ServerInstance> {
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
    // 应用预设配置
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
  const stats: ServerStats = {
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
              features: {
                rateLimiting: config.enableRateLimiting,
                persistence: config.enablePersistence,
              },
            }));
            return;
          }

          // 服务器统计
          if (url.pathname === '/v1/stats') {
            const queueStats = rateLimiter?.getAllStats() || {};
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              uptime: Date.now() - stats.startedAt,
              requests: stats.requests,
              queues: queueStats,
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
              
              // 使用速率限制器
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

          // ==================== 对话管理 API ====================

          // 列出对话
          if (url.pathname === '/v1/conversations' && req.method === 'GET') {
            stats.requests.conversations++;
            if (!conversationManager) {
              res.writeHead(501, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Persistence not enabled' }));
              return;
            }
            
            const conversations = await conversationManager.list();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ data: conversations }));
            return;
          }

          // 创建对话
          if (url.pathname === '/v1/conversations' && req.method === 'POST') {
            stats.requests.conversations++;
            if (!conversationManager) {
              res.writeHead(501, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Persistence not enabled' }));
              return;
            }
            
            const body = await readBody(req);
            const data = JSON.parse(body);
            const conversation = await conversationManager.create(data);
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(conversation));
            return;
          }

          // 获取/更新/删除单个对话
          const convMatch = url.pathname.match(/^\/v1\/conversations\/([^/]+)$/);
          if (convMatch) {
            stats.requests.conversations++;
            const convId = convMatch[1];
            
            if (!conversationManager) {
              res.writeHead(501, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Persistence not enabled' }));
              return;
            }

            if (req.method === 'GET') {
              const conversation = await conversationManager.get(convId);
              if (!conversation) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Conversation not found' }));
                return;
              }
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(conversation));
              return;
            }

            if (req.method === 'PUT') {
              const body = await readBody(req);
              const data = JSON.parse(body);
              const updated = await conversationManager.update(convId, data);
              if (!updated) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Conversation not found' }));
                return;
              }
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(updated));
              return;
            }

            if (req.method === 'DELETE') {
              const deleted = await conversationManager.delete(convId);
              if (messageManager) {
                await messageManager.deleteByConversation(convId);
              }
              res.writeHead(deleted ? 204 : 404);
              res.end();
              return;
            }
          }

          // 对话消息管理
          const msgMatch = url.pathname.match(/^\/v1\/conversations\/([^/]+)\/messages$/);
          if (msgMatch && messageManager) {
            const convId = msgMatch[1];
            
            if (req.method === 'GET') {
              const messages = await messageManager.getByConversation(convId);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ data: messages }));
              return;
            }

            if (req.method === 'POST') {
              const body = await readBody(req);
              const data = JSON.parse(body);
              const message = await messageManager.add({ ...data, conversationId: convId });
              res.writeHead(201, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(message));
              return;
            }
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
          console.log(`\n🚀 AI SDK Server running at http://${config.host}:${config.port}`);
          console.log(`   Providers: ${client.getProviders().join(', ') || 'none'}`);
          console.log(`   Rate Limiting: ${config.enableRateLimiting ? 'enabled' : 'disabled'}`);
          console.log(`   Persistence: ${config.enablePersistence ? 'enabled' : 'disabled'}`);
          console.log(`\n   Endpoints:`);
          console.log(`   - GET  /health                    Health check`);
          console.log(`   - GET  /v1/stats                  Server statistics`);
          console.log(`   - GET  /v1/models                 List models`);
          console.log(`   - POST /v1/chat/completions       Chat completions`);
          if (config.enablePersistence) {
            console.log(`   - GET  /v1/conversations          List conversations`);
            console.log(`   - POST /v1/conversations          Create conversation`);
            console.log(`   - GET  /v1/conversations/:id      Get conversation`);
            console.log(`   - PUT  /v1/conversations/:id      Update conversation`);
            console.log(`   - DELETE /v1/conversations/:id    Delete conversation`);
            console.log(`   - GET  /v1/conversations/:id/messages  Get messages`);
            console.log(`   - POST /v1/conversations/:id/messages  Add message`);
          }
          console.log('');
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

// 辅助函数
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
 * 快速启动服务器
 * Quick start server with auto-loaded config
 */
export async function startServer(configOrPath?: ExtendedServerConfig | string): Promise<ServerInstance> {
  const server = await createServer(configOrPath);
  await server.start();
  return server;
}
