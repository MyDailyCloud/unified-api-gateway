/**
 * AI SDK HTTP Server
 * Node.js HTTP 服务器实现 - 提供 OpenAI 兼容的 API 端点
 */

import { AIClient } from '../client';
import { loadConfig, validateConfig, type ServerConfig, type ProviderConfigEntry } from './config';
import type { ChatCompletionRequest, StreamChunk, AIProvider } from '../types';

export { loadConfig, validateConfig, generateExampleConfig } from './config';
export type { ServerConfig, ProviderConfigEntry } from './config';

export interface ServerInstance {
  start(): Promise<void>;
  stop(): Promise<void>;
  getClient(): AIClient;
  getConfig(): ServerConfig;
}

/**
 * 创建 HTTP 服务器
 * Create HTTP server with OpenAI-compatible endpoints
 */
export async function createServer(configOrPath?: ServerConfig | string): Promise<ServerInstance> {
  // 加载配置
  const config = typeof configOrPath === 'string' || configOrPath === undefined
    ? await loadConfig(typeof configOrPath === 'string' ? configOrPath : undefined)
    : configOrPath;

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

  let server: ReturnType<typeof import('http').createServer> | null = null;

  return {
    async start() {
      const http = await import('http');
      
      server = http.createServer(async (req, res) => {
        // CORS 处理
        if (config.cors?.enabled) {
          const origin = config.cors.origins?.includes('*') ? '*' : config.cors.origins?.join(', ') || '*';
          res.setHeader('Access-Control-Allow-Origin', origin);
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        }

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
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
            
            // 从请求中获取 provider 或使用默认
            const provider = request.provider;
            
            log(config, 'info', `Chat request: model=${request.model}, stream=${request.stream}, provider=${provider || 'default'}`);

            if (request.stream) {
              // SSE 流式响应
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
              // 非流式响应
              const response = await client.chat(request, provider);
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
          console.log(`\n🚀 AI SDK Server running at http://${config.host}:${config.port}`);
          console.log(`   Providers: ${client.getProviders().join(', ') || 'none'}`);
          console.log(`\n   Endpoints:`);
          console.log(`   - GET  /health              Health check`);
          console.log(`   - GET  /v1/models           List models`);
          console.log(`   - POST /v1/chat/completions Chat completions (OpenAI compatible)`);
          console.log('');
          resolve();
        });
      });
    },

    async stop() {
      if (server) {
        return new Promise((resolve) => {
          server!.close(() => {
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
export async function startServer(configOrPath?: ServerConfig | string): Promise<ServerInstance> {
  const server = await createServer(configOrPath);
  await server.start();
  return server;
}
