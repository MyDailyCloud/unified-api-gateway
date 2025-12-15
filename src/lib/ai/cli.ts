#!/usr/bin/env node
/**
 * AI SDK CLI
 * 命令行工具 - 快速启动 AI 服务器
 * 
 * 重构后统一使用 startNodeServer() 作为唯一入口
 */

import { startNodeServer, type NodeAppInstance } from './app/node';
import { generateExampleConfig, loadConfig } from './server/config';
import type { AIProvider } from './types';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'serve':
    case 'start':
    case undefined:
      await runServer(args.slice(command ? 1 : 0));
      break;
      
    case 'init':
      await initConfig();
      break;
      
    case 'help':
    case '--help':
    case '-h':
      printHelp();
      break;
      
    case 'version':
    case '--version':
    case '-v':
      console.log('AI SDK v1.0.0');
      break;
      
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

async function runServer(args: string[]) {
  // 解析参数
  let port = 3000;
  let host = '0.0.0.0';
  let configPath: string | undefined;
  let silent = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-p' || arg === '--port') {
      port = parseInt(args[++i], 10);
    } else if (arg === '-h' || arg === '--host') {
      host = args[++i];
    } else if (arg === '-c' || arg === '--config') {
      configPath = args[++i];
    } else if (arg === '-s' || arg === '--silent') {
      silent = true;
    }
  }

  // 环境变量覆盖
  if (process.env.AI_SDK_PORT) {
    port = parseInt(process.env.AI_SDK_PORT, 10);
  }
  if (process.env.AI_SDK_HOST) {
    host = process.env.AI_SDK_HOST;
  }

  if (!silent) {
    console.log('🤖 AI SDK Server');
    console.log('================\n');
  }

  try {
    // 加载配置文件（如果存在）
    const fileConfig = await loadConfig(configPath);
    
    // 构建 providers 配置
    const providers: Array<{ provider: AIProvider; apiKey: string; baseURL?: string }> = [];
    
    for (const p of fileConfig.providers) {
      providers.push({
        provider: p.provider,
        apiKey: p.apiKey,
        baseURL: p.baseUrl,
      });
    }

    // 使用统一的 startNodeServer
    const app: NodeAppInstance = await startNodeServer({
      http: {
        port: fileConfig.port || port,
        host: fileConfig.host || host,
      },
      providers,
      silent,
      mode: 'full',
    });

    // 如果有生成的密码，显示它
    const generatedPassword = app.getGeneratedPassword();
    if (generatedPassword && !silent) {
      console.log(`\n🔑 Generated Admin Password: ${generatedPassword}`);
      console.log('   Please save this password securely. It will not be shown again.\n');
    }

    // 优雅关闭
    const shutdown = async () => {
      if (!silent) {
        console.log('\n\nShutting down...');
      }
      await app.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

async function initConfig() {
  const fs = await import('fs').then(m => m.promises);
  const configPath = '.ai-sdk.json';
  
  try {
    await fs.access(configPath);
    console.log(`Config file already exists: ${configPath}`);
    console.log('Delete it first if you want to regenerate.');
    return;
  } catch {
    // File doesn't exist, create it
  }

  const config = generateExampleConfig();
  await fs.writeFile(configPath, config);
  console.log(`Created config file: ${configPath}`);
  console.log('\nNext steps:');
  console.log('1. Edit .ai-sdk.json to configure your providers');
  console.log('2. Set API keys as environment variables:');
  console.log('   export OPENAI_API_KEY=sk-...');
  console.log('3. Run: npx ai-sdk serve');
}

function printHelp() {
  console.log(`
AI SDK - Unified AI Provider Gateway

Usage:
  npx ai-sdk [command] [options]

Commands:
  serve, start    Start the HTTP server (default)
  init            Create a sample config file
  help            Show this help message
  version         Show version

Options:
  -p, --port      Server port (default: 3000)
  -h, --host      Server host (default: 0.0.0.0)
  -c, --config    Config file path (default: .ai-sdk.json)
  -s, --silent    Silent mode (minimal output)

Environment Variables:
  OPENAI_API_KEY      OpenAI API key
  ANTHROPIC_API_KEY   Anthropic API key
  GOOGLE_API_KEY      Google AI API key
  DEEPSEEK_API_KEY    DeepSeek API key
  GROQ_API_KEY        Groq API key
  CEREBRAS_API_KEY    Cerebras API key
  OLLAMA_HOST         Ollama server URL (default: http://localhost:11434)
  AI_SDK_PORT         Server port override
  AI_SDK_HOST         Server host override

Examples:
  # Start server with auto-detected API keys
  export OPENAI_API_KEY=sk-...
  npx ai-sdk serve

  # Specify port and host
  npx ai-sdk serve -p 8080 -h 127.0.0.1

  # Use config file
  npx ai-sdk serve -c ./my-config.json

  # Create config file
  npx ai-sdk init

API Endpoints (when running):
  GET  /health               Health check
  GET  /v1/models            List available models
  POST /v1/chat/completions  Chat completions (OpenAI compatible)
  
Auth Endpoints (Node.js mode):
  POST /internal/auth/login           Admin login
  POST /internal/auth/logout          Logout
  POST /internal/auth/change-password Change password
  GET  /internal/auth/me              Get current user
  
Gateway Key Management:
  GET    /internal/gateway-keys       List all keys
  POST   /internal/gateway-keys       Create new key
  DELETE /internal/gateway-keys/:id   Revoke key

Documentation: https://github.com/your-org/ai-sdk
`);
}

// 运行 CLI
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
