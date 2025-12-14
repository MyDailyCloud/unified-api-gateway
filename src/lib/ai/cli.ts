#!/usr/bin/env node
/**
 * AI SDK CLI
 * 命令行工具 - 快速启动 AI 服务器
 */

import { startServer, generateExampleConfig } from './server';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'serve':
    case 'start':
    case undefined:
      await runServer(args.slice(1));
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
  let port: number | undefined;
  let configPath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-p' || arg === '--port') {
      port = parseInt(args[++i], 10);
    } else if (arg === '-c' || arg === '--config') {
      configPath = args[++i];
    }
  }

  console.log('🤖 AI SDK Server');
  console.log('================\n');

  try {
    const server = await startServer(configPath);
    
    // 如果指定了端口，更新配置
    if (port) {
      console.log(`Note: Port override not implemented in this version, using config port.`);
    }

    // 优雅关闭
    const shutdown = async () => {
      console.log('\n\nShutting down...');
      await server.stop();
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
  -c, --config    Config file path (default: .ai-sdk.json)

Environment Variables:
  OPENAI_API_KEY      OpenAI API key
  ANTHROPIC_API_KEY   Anthropic API key
  GOOGLE_API_KEY      Google AI API key
  DEEPSEEK_API_KEY    DeepSeek API key
  GROQ_API_KEY        Groq API key
  OLLAMA_HOST         Ollama server URL (default: http://localhost:11434)
  AI_SDK_PORT         Server port override
  AI_SDK_HOST         Server host override

Examples:
  # Start server with auto-detected API keys
  export OPENAI_API_KEY=sk-...
  npx ai-sdk serve

  # Use config file
  npx ai-sdk serve -c ./my-config.json

  # Create config file
  npx ai-sdk init

API Endpoints:
  GET  /health               Health check
  GET  /v1/models            List available models
  POST /v1/chat/completions  Chat completions (OpenAI compatible)

Documentation: https://github.com/your-org/ai-sdk
`);
}

// 运行 CLI
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
