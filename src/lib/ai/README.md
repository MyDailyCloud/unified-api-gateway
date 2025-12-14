# 统一 AI SDK / Unified AI SDK

一个支持多 AI 平台的统一适配器架构，可自适应各个 API 端点。

## 分层架构设计 / Layered Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        应用层 (Application Layer)                          │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐              │
│  │  React Hooks   │  │   Components   │  │ Error Boundary │              │
│  │ useAI / useChat│  │   ChatUI etc   │  │ AIErrorBoundary│              │
│  └────────────────┘  └────────────────┘  └────────────────┘              │
│                                                                          │
│  职责: UI 交互、状态管理、错误处理、用户体验                                  │
├──────────────────────────────────────────────────────────────────────────┤
│                        客户端层 (Client Layer)                             │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                           AIClient                                 │  │
│  │                                                                    │  │
│  │  • 提供商注册/管理 (Provider Registration)                          │  │
│  │  • 统一入口 (Unified Entry)                                         │  │
│  │  • 回退机制 (Fallback Mechanism)                                    │  │
│  │  • 模型路由 (Model Routing)                                         │  │
│  │  • 负载均衡 (Load Balancing)                                        │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  职责: 请求调度、提供商选择、故障转移、统一接口                               │
├──────────────────────────────────────────────────────────────────────────┤
│                        工厂层 (Factory Layer)                              │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │              Provider Factory & Registry                           │  │
│  │                                                                    │  │
│  │  createOpenAI()    createAnthropic()    createGoogle()             │  │
│  │  createCerebras()  createGLM()          createGroq()               │  │
│  │  createDeepSeek()  createMoonshot()     createQwen()               │  │
│  │                                                                    │  │
│  │  createProviderRegistry() - 统一注册表管理                           │  │
│  │  createModelRouter() - 智能模型路由                                  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  职责: 提供商实例化、配置管理、模型识别                                       │
├──────────────────────────────────────────────────────────────────────────┤
│                        适配器层 (Adapter Layer)                            │
│  ┌─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐          │
│  │ OpenAI  │Anthropic│ Google  │  Azure  │   AWS   │Cerebras │          │
│  ├─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤          │
│  │   GLM   │  Groq   │DeepSeek │Moonshot │  Qwen   │ MiniMax │          │
│  ├─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤          │
│  │Baichuan │ Cohere  │ Mistral │ Ollama  │  VLLM   │ Custom  │          │
│  └─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘          │
│                                                                          │
│  职责: API 格式转换、请求/响应适配、流式处理                                  │
├──────────────────────────────────────────────────────────────────────────┤
│                      基础适配器 (Base Adapter)                             │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                        BaseAdapter                                 │  │
│  │                                                                    │  │
│  │  • 重试逻辑 (Retry Logic with Exponential Backoff)                  │  │
│  │  • SSE 解析 (Server-Sent Events Parsing)                           │  │
│  │  • 错误处理 (Error Handling & Classification)                       │  │
│  │  • 超时管理 (Timeout Management)                                    │  │
│  │  • 请求规范化 (Request Normalization)                               │  │
│  │  • 响应标准化 (Response Standardization)                            │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  职责: 通用功能抽象、代码复用、稳定性保障                                     │
├──────────────────────────────────────────────────────────────────────────┤
│                        类型层 (Type Layer)                                │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                     TypeScript Definitions                         │  │
│  │                                                                    │  │
│  │  Message    Request    Response    Error    ModelInfo              │  │
│  │  Choice     Usage      Delta       Tool     FunctionCall           │  │
│  │  Provider   Adapter    Config      Stream   Chunk                  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  职责: 类型安全、接口定义、文档生成                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## 支持的提供商 / Supported Providers

### 国际提供商 (International Providers)

| 提供商 | 类型 | API 端点 | 默认模型 | 特点 |
|--------|------|----------|----------|------|
| **OpenAI** | 原生 | `api.openai.com` | gpt-4o | GPT-4/5, O3/O4, Whisper, DALL-E, 多模态 |
| **Anthropic** | 转换 | `api.anthropic.com` | claude-sonnet-4-5 | Claude 系列, 200K 上下文, 强推理 |
| **Google** | OpenAI兼容 | `generativelanguage.googleapis.com` | gemini-2.5-pro | Gemini 系列, 多模态, 1M 上下文 |
| **Azure OpenAI** | OpenAI兼容 | `{resource}.openai.azure.com` | - | 企业级, 合规, 私有部署 |
| **AWS Bedrock** | 转换 | `bedrock-runtime.{region}.amazonaws.com` | - | 多模型网关, Claude/Llama |
| **Cerebras** | OpenAI兼容 | `api.cerebras.ai` | llama3.1-70b | 超快推理 (2000+ tok/s) |
| **Groq** | OpenAI兼容 | `api.groq.com` | llama-3.3-70b-versatile | 高速推理, Llama/Mixtral |
| **Cohere** | OpenAI兼容 | `api.cohere.ai` | command-r-plus | RAG优化, 企业搜索 |
| **Mistral** | OpenAI兼容 | `api.mistral.ai` | mistral-large | 欧洲合规, 多语言 |

### 国内提供商 (Chinese Providers)

| 提供商 | 类型 | API 端点 | 默认模型 | 特点 |
|--------|------|----------|----------|------|
| **智谱 GLM** | OpenAI兼容 | `open.bigmodel.cn` | glm-4-plus | 中文优化, 多模态, CodeGeeX |
| **DeepSeek** | OpenAI兼容 | `api.deepseek.com` | deepseek-chat | 代码专家, 推理增强, 低成本 |
| **月之暗面 Moonshot** | OpenAI兼容 | `api.moonshot.cn` | moonshot-v1-128k | Kimi, 128K 超长上下文 |
| **通义千问 Qwen** | OpenAI兼容 | `dashscope.aliyuncs.com` | qwen-max | 阿里云, 多模态, Agent |
| **MiniMax** | OpenAI兼容 | `api.minimax.chat` | abab6.5s-chat | 语音合成, 虚拟人 |
| **百川 Baichuan** | OpenAI兼容 | `api.baichuan-ai.com` | Baichuan4 | 中文大模型, 搜索增强 |

### 本地/自部署 (Local/Self-hosted)

| 提供商 | 类型 | API 端点 | 特点 |
|--------|------|----------|------|
| **Ollama** | OpenAI兼容 | `localhost:11434` | 本地运行, 隐私安全 |
| **vLLM** | OpenAI兼容 | 自定义 | 高性能推理服务器 |
| **LocalAI** | OpenAI兼容 | 自定义 | 开源本地 AI |
| **Custom** | 可配置 | 自定义 | 任意兼容 API |

## 多模态能力矩阵 / Multimodal Capability Matrix

以下表格展示了各提供商支持的多模态能力：

| 提供商 | 对话 | 流式 | 文本嵌入 | 图像嵌入 | 视觉理解 | 语音转录 | 语音合成 | 图像生成 | 工具调用 | 重排序 |
|--------|:----:|:----:|:--------:|:--------:|:--------:|:--------:|:--------:|:--------:|:--------:|:------:|
| **OpenAI** | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Anthropic** | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Google** | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |
| **Azure OpenAI** | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Mistral** | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Cohere** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Groq** | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Cerebras** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **GLM** | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |
| **DeepSeek** | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Moonshot** | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Qwen** | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |

### 能力说明 / Capability Notes

- **文本嵌入 (Text Embedding)**: 将文本转换为向量表示，用于语义搜索、聚类等
- **图像嵌入 (Image Embedding)**: 将图像转换为向量，仅 Cohere embed-v4 支持多模态嵌入
- **视觉理解 (Vision)**: 分析和理解图像内容的能力
- **语音转录 (Transcription)**: 将音频转换为文本 (STT)
- **语音合成 (Speech)**: 将文本转换为音频 (TTS)
- **图像生成 (Image Generation)**: 根据文本描述生成图像
- **重排序 (Rerank)**: 根据查询重新排序文档相关性，仅 Cohere 支持

### 推荐模型 / Recommended Models

| 能力 | 推荐提供商 | 推荐模型 | 备注 |
|------|------------|----------|------|
| 文本嵌入 | OpenAI | `text-embedding-3-small` | 性价比最高 |
| 文本嵌入 | Mistral | `mistral-embed` | 欧洲合规 |
| 多模态嵌入 | Cohere | `embed-v4.0` | 支持文本+图像 |
| 语音转录 | OpenAI | `whisper-1` | 多语言支持最好 |
| 语音转录 | Mistral | `voxtral-mini-transcribe` | 低延迟 |
| 语音合成 | OpenAI | `tts-1-hd` | 最自然音质 |
| 图像生成 | OpenAI | `dall-e-3` | 最高质量 |
| 重排序 | Cohere | `rerank-v4.0-pro` | 唯一选择 |

## 快速开始 / Quick Start

### 1. 基础使用

```typescript
import { AIClient } from '@/lib/ai';

const client = new AIClient();

// 注册提供商
client.registerProvider({
  provider: 'openai',
  apiKey: 'sk-xxx',
});

// 发送请求
const response = await client.chat({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

### 2. 工厂函数模式 (推荐)

```typescript
import { 
  createOpenAI, 
  createAnthropic, 
  createProviderRegistry 
} from '@/lib/ai';

// 创建提供商
const openai = createOpenAI({ apiKey: 'sk-xxx' });
const anthropic = createAnthropic({ apiKey: 'sk-ant-xxx' });

// 创建注册表
const registry = createProviderRegistry({
  providers: { openai, anthropic },
  defaultProvider: 'openai',
});

// 获取模型
const gpt4 = registry.languageModel('openai/gpt-4o');
const claude = registry.languageModel('anthropic/claude-sonnet-4-5');
```

### 3. 流式请求

```typescript
for await (const chunk of client.chatStream({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Write a story' }],
}, 'openai')) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}
```

### 4. 带回退的请求

```typescript
const response = await client.chatWithFallback(
  { model: 'auto', messages: [...] },
  ['openai', 'anthropic', 'glm'] // 按顺序尝试
);
```

### 5. React Hooks

```tsx
import { useChat } from '@/lib/ai';

function ChatComponent() {
  const { messages, send, isLoading, error } = useChat({
    provider: 'openai',
    systemPrompt: 'You are a helpful assistant.',
  });

  return (
    <div>
      {messages.map((m, i) => (
        <div key={i}>{m.role}: {m.content}</div>
      ))}
      <button onClick={() => send('Hello!')} disabled={isLoading}>
        Send
      </button>
    </div>
  );
}
```

### 6. 错误边界

```tsx
import { ErrorBoundary, AIErrorBoundary } from '@/components';

function App() {
  return (
    <ErrorBoundary>
      <AIErrorBoundary onRetry={() => refetch()}>
        <ChatComponent />
      </AIErrorBoundary>
    </ErrorBoundary>
  );
}
```

## 错误处理 / Error Handling

```typescript
import { 
  AIError, 
  RateLimitError, 
  AuthenticationError,
  NetworkError,
  APIError 
} from '@/lib/ai';

try {
  await client.chat(request);
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log(`Rate limited. Retry after ${error.retryAfter}s`);
  } else if (error instanceof AuthenticationError) {
    console.log('Invalid API key');
  } else if (error instanceof NetworkError) {
    console.log('Network error:', error.message);
  } else if (error instanceof AIError) {
    console.log(error.code, error.provider, error.statusCode);
  }
}
```

## 自定义适配器 / Custom Adapter

```typescript
import { CustomAdapter } from '@/lib/ai';

client.registerProvider({
  provider: 'custom',
  apiKey: 'xxx',
  baseURL: 'https://your-api.com/v1',
  models: [
    { id: 'model-1', name: 'Model 1', provider: 'custom', contextLength: 8192 },
  ],
});
```

## Node.js 独立启动 / Node.js Standalone Server

SDK 提供独立的 HTTP 服务器，可以直接在 Node.js 环境中启动，提供 OpenAI 兼容的 API 端点。

### 快速启动 / Quick Start

```bash
# 方式 1: 设置环境变量后启动
export OPENAI_API_KEY=sk-xxx
export ANTHROPIC_API_KEY=sk-ant-xxx
npx ts-node src/lib/ai/cli.ts serve

# 方式 2: 使用配置文件
npx ts-node src/lib/ai/cli.ts init  # 生成配置文件
# 编辑 .ai-sdk.json
npx ts-node src/lib/ai/cli.ts serve
```

### 配置文件格式 / Config File Format

创建 `.ai-sdk.json` 文件：

```json
{
  "port": 3000,
  "host": "0.0.0.0",
  "providers": [
    { "provider": "openai", "apiKey": "env:OPENAI_API_KEY" },
    { "provider": "anthropic", "apiKey": "env:ANTHROPIC_API_KEY" },
    { "provider": "ollama", "apiKey": "", "baseUrl": "http://localhost:11434" }
  ],
  "cors": {
    "enabled": true,
    "origins": ["*"]
  },
  "logging": {
    "enabled": true,
    "level": "info"
  }
}
```

### 支持的环境变量 / Environment Variables

| 环境变量 | 说明 |
|----------|------|
| `OPENAI_API_KEY` | OpenAI API Key |
| `ANTHROPIC_API_KEY` | Anthropic API Key |
| `GOOGLE_API_KEY` | Google AI API Key |
| `DEEPSEEK_API_KEY` | DeepSeek API Key |
| `GROQ_API_KEY` | Groq API Key |
| `MISTRAL_API_KEY` | Mistral API Key |
| `COHERE_API_KEY` | Cohere API Key |
| `TOGETHER_API_KEY` | Together AI API Key |
| `OPENROUTER_API_KEY` | OpenRouter API Key |
| `QWEN_API_KEY` | 通义千问 API Key |
| `MOONSHOT_API_KEY` | 月之暗面 API Key |
| `GLM_API_KEY` | 智谱 GLM API Key |
| `CEREBRAS_API_KEY` | Cerebras API Key |
| `OLLAMA_HOST` | Ollama 服务器地址 |
| `AI_SDK_PORT` | 服务器端口覆盖 |
| `AI_SDK_HOST` | 服务器主机覆盖 |

### 在代码中使用 / Programmatic Usage

```typescript
import { createServer, startServer } from '@/lib/ai';

// 方式 1: 快速启动
const server = await startServer();
// 服务器运行在 http://localhost:3000

// 方式 2: 自定义配置
const server = await createServer({
  port: 8080,
  providers: [
    { provider: 'openai', apiKey: process.env.OPENAI_API_KEY! },
    { provider: 'ollama', apiKey: '', baseUrl: 'http://localhost:11434' },
  ],
});
await server.start();

// 获取 AI Client 实例
const client = server.getClient();
const response = await client.chat({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }],
});

// 停止服务器
await server.stop();
```

### API 端点 / API Endpoints

服务器启动后提供以下端点：

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查，返回提供商列表 |
| `/v1/models` | GET | 列出所有可用模型 |
| `/v1/chat/completions` | POST | Chat Completions (OpenAI 兼容) |

### 请求示例 / Request Examples

```bash
# 健康检查
curl http://localhost:3000/health

# 列出模型
curl http://localhost:3000/v1/models

# Chat Completions (非流式)
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'

# Chat Completions (流式)
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Tell me a story"}],
    "stream": true
  }'

# 指定提供商
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5",
    "messages": [{"role": "user", "content": "Hello!"}],
    "provider": "anthropic"
  }'
```

---

## Electron 完整集成 / Electron Complete Integration

SDK 提供完整的 Electron 集成方案，包括主进程、Preload 脚本和渲染进程的完整示例。

### 安装依赖 / Install Dependencies

```bash
npm install electron electron-store --save-dev
# 可选: 使用系统密钥链存储
npm install keytar --save-dev
```

### 目录结构 / Directory Structure

```
your-electron-app/
├── src/
│   ├── main/
│   │   └── main.ts          # 主进程
│   ├── preload/
│   │   └── preload.ts       # Preload 脚本
│   ├── renderer/
│   │   └── App.tsx          # 渲染进程 React 组件
│   └── global.d.ts          # 类型声明
└── package.json
```

### 1. 主进程配置 / Main Process Setup

```typescript
// src/main/main.ts
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import Store from 'electron-store';
import {
  createMainBridge,
  createElectronStoreStorage,
  // createKeytarStorage, // 如需系统级安全存储
  type MainBridgeConfig,
} from '@ai-sdk/electron';

// 1. 配置安全存储
const store = new Store({
  name: 'ai-sdk-config',
  encryptionKey: 'your-encryption-key', // 可选：加密存储
});
const secureStorage = createElectronStoreStorage(store);

// 可选: 使用 keytar (系统密钥链，更安全)
// import keytar from 'keytar';
// const secureStorage = createKeytarStorage(keytar, 'your-app-name');

// 2. 创建 AI Bridge
const bridgeConfig: MainBridgeConfig = {
  secureStorage,
  defaultProvider: 'openai',
};
const aiBridge = createMainBridge(bridgeConfig);

// 3. 预加载提供商
async function loadStoredProviders() {
  try {
    await aiBridge.loadProvidersFromStorage([
      { provider: 'openai', defaultModel: 'gpt-4' },
      { provider: 'anthropic', defaultModel: 'claude-3-opus-20240229' },
      { provider: 'ollama', baseUrl: 'http://localhost:11434' },
    ]);
    console.log('Loaded stored providers');
  } catch (error) {
    console.log('No stored providers found');
  }
}

// 4. 创建窗口
let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

// 5. 应用生命周期
app.whenReady().then(async () => {
  aiBridge.initialize(ipcMain);
  await loadStoredProviders();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  aiBridge.destroy(ipcMain);
});

// 6. 额外 IPC 处理器
ipcMain.handle('app:getInfo', () => ({
  version: app.getVersion(),
  platform: process.platform,
  arch: process.arch,
}));

ipcMain.handle('app:openExternal', async (_event, url: string) => {
  await shell.openExternal(url);
});
```

### 2. Preload 脚本 / Preload Script

```typescript
// src/preload/preload.ts
import { contextBridge, ipcRenderer } from 'electron';
import { initPreloadAI, type PreloadAIAPI } from '@ai-sdk/electron';

// 初始化 AI API
const aiAPI: PreloadAIAPI = initPreloadAI(ipcRenderer);

// 暴露给渲染进程
contextBridge.exposeInMainWorld('ai', aiAPI);

contextBridge.exposeInMainWorld('app', {
  getInfo: () => ipcRenderer.invoke('app:getInfo'),
  openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),
  platform: process.platform,
});
```

### 3. 类型声明 / Type Declarations

```typescript
// src/global.d.ts
import type { PreloadAIAPI } from '@ai-sdk/electron';

declare global {
  interface Window {
    ai: PreloadAIAPI;
    app: {
      getInfo: () => Promise<{
        version: string;
        platform: string;
        arch: string;
      }>;
      openExternal: (url: string) => Promise<void>;
      platform: string;
    };
  }
}

export {};
```

### 4. 渲染进程使用 / Renderer Process Usage

```typescript
// src/renderer/App.tsx
import { useState, useCallback } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // 方式 1: 非流式请求
      const response = await window.ai.chat({
        messages: [...messages, userMessage],
        model: 'gpt-4',
      });

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.choices[0].message.content as string,
      }]);

      // 方式 2: 流式请求
      // let assistantContent = '';
      // const unsubscribe = window.ai.onStreamChunk((chunk) => {
      //   const delta = chunk.choices[0]?.delta?.content;
      //   if (delta) {
      //     assistantContent += delta;
      //     setMessages(prev => {
      //       const updated = [...prev];
      //       const last = updated[updated.length - 1];
      //       if (last?.role === 'assistant') {
      //         last.content = assistantContent;
      //       } else {
      //         updated.push({ role: 'assistant', content: assistantContent });
      //       }
      //       return [...updated];
      //     });
      //   }
      // });
      // await window.ai.chatStream({ messages: [...messages, userMessage], model: 'gpt-4' });
      // unsubscribe();

    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [input, messages, isLoading]);

  return (
    <div className="app">
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <strong>{msg.role}:</strong> {msg.content}
          </div>
        ))}
      </div>
      <div className="input-area">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
          disabled={isLoading}
        />
        <button onClick={sendMessage} disabled={isLoading || !input.trim()}>
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}

export default App;
```

### 5. API Key 管理 / API Key Management

```typescript
// 在渲染进程中管理 API Keys

// 存储 API Key
await window.ai.storeApiKey('openai', 'sk-xxx');

// 注册提供商
await window.ai.registerProvider({
  provider: 'openai',
  apiKey: 'sk-xxx',
});

// 验证 API Key
const isValid = await window.ai.validateApiKey('openai');

// 获取模型列表
const models = await window.ai.listModels('openai');
```

### 6. 自定义 React Hook

```typescript
// src/renderer/hooks/useAI.ts
import { useState, useCallback, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function useAI(model = 'gpt-4') {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const sendMessage = useCallback(async (content: string, stream = false) => {
    const userMessage: Message = { role: 'user', content };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      if (stream) {
        let assistantContent = '';
        const unsubscribe = window.ai.onStreamChunk((chunk) => {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            assistantContent += delta;
            setMessages(prev => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === 'assistant') {
                return prev.map((m, i) => 
                  i === prev.length - 1 ? { ...m, content: assistantContent } : m
                );
              }
              return [...prev, { role: 'assistant', content: assistantContent }];
            });
          }
        });

        await window.ai.chatStream({ messages: [...messages, userMessage], model });
        unsubscribe();
      } else {
        const response = await window.ai.chat({
          messages: [...messages, userMessage],
          model,
        });
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: response.choices[0].message.content as string,
        }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [messages, model]);

  const clearMessages = useCallback(() => setMessages([]), []);

  return { messages, isLoading, error, sendMessage, clearMessages };
}
```

---

## 简单 Electron 集成 / Simple Electron Integration

如果只需要基本功能，可以使用简化版本：

```typescript
// main process
import { AIClient } from '@/lib/ai';

const client = new AIClient();
const keys = await loadAPIKeys(); // 从安全存储加载
keys.forEach(k => client.registerProvider(k));

// renderer process (通过 IPC)
const response = await window.electron.ai.chat(request);
```

## 模型路由 / Model Routing

```typescript
import { createModelRouter } from '@/lib/ai';

const router = createModelRouter();

router.route('gpt-4o');           // { provider: 'openai', model: 'gpt-4o' }
router.route('claude-sonnet-4-5'); // { provider: 'anthropic', model: 'claude-sonnet-4-5' }
router.route('glm-4-plus');       // { provider: 'glm', model: 'glm-4-plus' }
router.route('deepseek-chat');    // { provider: 'deepseek', model: 'deepseek-chat' }
```

## 架构特点 / Architecture Features

- **统一接口**: 所有提供商使用相同的 API 调用方式
- **类型安全**: 完整的 TypeScript 类型定义
- **流式支持**: 原生支持 SSE 流式响应
- **自动重试**: 内置指数退避重试机制
- **错误分类**: 精确的错误类型识别
- **回退机制**: 多提供商自动故障转移
- **工厂模式**: 类似 Vercel AI SDK 的工厂函数
- **可扩展**: 易于添加新的提供商适配器

## 高级功能 / Advanced Features

### 多模态支持 / Multimodal Support

SDK 支持丰富的多模态能力，包括文本嵌入、图像嵌入、视觉理解、语音转录、语音合成、图像生成和重排序。

#### 查询提供商能力 / Check Provider Capabilities

```typescript
import { AIClient } from '@/lib/ai';

const client = new AIClient();
client.registerProvider({ provider: 'openai', apiKey: 'sk-xxx' });

// 获取能力信息
const caps = client.getCapabilities('openai');
console.log(caps);
// {
//   chat: true,
//   streaming: true,
//   embedding: true,
//   vision: true,
//   transcription: true,
//   speech: true,
//   imageGeneration: true,
//   tools: true,
//   rerank: false,
//   ocr: false,
// }

// 条件使用
if (caps.embedding) {
  const embedding = await client.embed({ model: 'text-embedding-3-small', input: 'Hello' }, 'openai');
}
```

#### 文本嵌入 / Text Embedding

```typescript
// OpenAI 嵌入
const openaiEmbed = await client.embed({
  model: 'text-embedding-3-small',
  input: 'Hello world',
  dimensions: 512,  // 可选: 指定输出维度
}, 'openai');

console.log(openaiEmbed.data[0].embedding); // number[]

// Mistral 嵌入
const mistralEmbed = await client.embed({
  model: 'mistral-embed',
  input: ['Text 1', 'Text 2'],  // 支持批量
}, 'mistral');

// Cohere 嵌入 (带 input_type)
const cohereEmbed = await client.embed({
  model: 'embed-v4.0',
  input: 'Search query',
  input_type: 'search_query',  // search_document | search_query | classification | clustering
  embedding_types: ['float', 'int8'],  // 可选: 多种编码格式
}, 'cohere');
```

#### 多模态嵌入 / Multimodal Embedding (Cohere)

Cohere embed-v4.0 支持同时嵌入文本和图像：

```typescript
// 纯图像嵌入
const imageEmbed = await client.embed({
  model: 'embed-v4.0',
  input_type: 'search_document',
  images: ['data:image/png;base64,...'],  // Base64 编码的图像
}, 'cohere');

// 混合文本+图像嵌入
const multimodalEmbed = await client.embed({
  model: 'embed-v4.0',
  input_type: 'search_document',
  inputs: [
    {
      content: [
        { type: 'text', text: 'A beautiful sunset over the ocean' },
        { type: 'image_url', image_url: 'data:image/png;base64,...' },
      ],
    },
    {
      content: [
        { type: 'text', text: 'Mountain landscape' },
        { type: 'image_url', image_url: 'https://example.com/mountain.jpg' },
      ],
    },
  ],
}, 'cohere');
```

#### 视觉理解 / Vision

```typescript
import type { Message } from '@/lib/ai';

// 发送包含图片的消息
const message: Message = {
  role: 'user',
  content: [
    { type: 'text', text: 'What is in this image?' },
    { 
      type: 'image_url', 
      image_url: { 
        url: 'data:image/png;base64,...',  // 或 https://... URL
        detail: 'high',  // auto | low | high
      } 
    },
  ],
};

const response = await client.chat({
  model: 'gpt-4o',  // 或 claude-sonnet-4-5, gemini-2.5-pro 等
  messages: [message],
}, 'openai');
```

#### 语音转录 / Transcription (STT)

```typescript
// OpenAI Whisper
const openaiTranscript = await client.transcribe({
  model: 'whisper-1',
  file: audioBlob,  // File | Blob
  language: 'en',   // 可选: 指定语言
  response_format: 'json',  // json | text | srt | verbose_json | vtt
  timestamp_granularities: ['word', 'segment'],  // 可选: 时间戳粒度
}, 'openai');

console.log(openaiTranscript.text);

// Mistral Voxtral
const mistralTranscript = await client.transcribe({
  model: 'voxtral-mini-transcribe',  // 或 voxtral-small
  file: audioBlob,
  language: 'auto',  // 自动检测语言
}, 'mistral');

// Groq Whisper (超快速)
const groqTranscript = await client.transcribe({
  model: 'whisper-large-v3',
  file: audioBlob,
}, 'groq');
```

#### 语音合成 / Speech Synthesis (TTS)

```typescript
const speech = await client.speak({
  model: 'tts-1-hd',  // tts-1 | tts-1-hd
  input: 'Hello, this is a test of text to speech.',
  voice: 'alloy',  // alloy | echo | fable | onyx | nova | shimmer
  response_format: 'mp3',  // mp3 | opus | aac | flac | wav | pcm
  speed: 1.0,  // 0.25 - 4.0
}, 'openai');

// 播放音频
const audioBlob = new Blob([speech.audio], { type: speech.contentType });
const audioUrl = URL.createObjectURL(audioBlob);
const audio = new Audio(audioUrl);
audio.play();

// 下载音频
const a = document.createElement('a');
a.href = audioUrl;
a.download = 'speech.mp3';
a.click();
```

#### 图像生成 / Image Generation

```typescript
// OpenAI DALL-E 3
const dalleImage = await client.generateImage({
  model: 'dall-e-3',
  prompt: 'A beautiful sunset over mountains, oil painting style',
  size: '1024x1024',  // 1024x1024 | 1792x1024 | 1024x1792
  quality: 'hd',  // standard | hd
  style: 'vivid',  // vivid | natural
  n: 1,
}, 'openai');

console.log(dalleImage.data[0].url);  // 图像 URL
console.log(dalleImage.data[0].revised_prompt);  // DALL-E 修改后的提示词

// Google Gemini
const geminiImage = await client.generateImage({
  model: 'gemini-2.0-flash-exp',
  prompt: 'Abstract art in vibrant colors',
}, 'google');

// GLM CogView
const glmImage = await client.generateImage({
  model: 'cogview-3',
  prompt: '中国山水画风格的日落',
}, 'glm');
```

#### 重排序 / Rerank (Cohere Only)

重排序用于根据查询重新排序文档的相关性，常用于 RAG 系统：

```typescript
const reranked = await client.rerank({
  model: 'rerank-v4.0-pro',
  query: 'What is the capital of the United States?',
  documents: [
    'Washington D.C. is the capital of the United States.',
    'New York is the largest city in the United States.',
    'The White House is located in Washington D.C.',
    'Los Angeles is on the west coast.',
  ],
  top_n: 3,  // 返回前 N 个结果
  return_documents: true,  // 是否返回文档内容
}, 'cohere');

console.log(reranked.results);
// [
//   { index: 0, relevance_score: 0.98, document: 'Washington D.C. is...' },
//   { index: 2, relevance_score: 0.85, document: 'The White House...' },
//   { index: 1, relevance_score: 0.42, document: 'New York is...' },
// ]

// 在 RAG 中使用
const documents = await vectorSearch(query, 20);  // 先召回 20 个
const reranked = await client.rerank({
  model: 'rerank-v4.0-pro',
  query: query,
  documents: documents.map(d => d.content),
  top_n: 5,
}, 'cohere');
const topDocs = reranked.results.map(r => documents[r.index]);
```

### 类型参考 / Type Reference

```typescript
// 嵌入请求
interface EmbeddingRequest {
  model: string;
  input: string | string[];
  dimensions?: number;
  encoding_format?: 'float' | 'base64';
  // Cohere 专用
  input_type?: 'search_document' | 'search_query' | 'classification' | 'clustering';
  embedding_types?: ('float' | 'int8' | 'uint8' | 'binary' | 'ubinary')[];
  images?: string[];  // Base64 图像
  inputs?: Array<{
    content: Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: string }
    >;
  }>;
}

// 图像生成请求
interface ImageGenerationRequest {
  model: string;
  prompt: string;
  n?: number;
  size?: string;
  quality?: 'standard' | 'hd';
  style?: 'vivid' | 'natural';
  response_format?: 'url' | 'b64_json';
}

// 语音合成请求
interface SpeechRequest {
  model: string;
  input: string;
  voice: string;
  response_format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';
  speed?: number;
}

// 语音转录请求
interface TranscriptionRequest {
  model: string;
  file: File | Blob;
  language?: string;
  prompt?: string;
  response_format?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
  temperature?: number;
  timestamp_granularities?: ('word' | 'segment')[];
}

// 重排序请求 (Cohere)
interface RerankRequest {
  model: string;
  query: string;
  documents: string[];
  top_n?: number;
  max_tokens_per_doc?: number;
  return_documents?: boolean;
}

// 重排序响应
interface RerankResponse {
  id: string;
  results: Array<{
    index: number;
    relevance_score: number;
    document?: string;
  }>;
  meta?: {
    billed_units?: { search_units: number };
  };
}

// 适配器能力
interface AdapterCapabilities {
  chat: boolean;
  streaming: boolean;
  embedding?: boolean;
  vision?: boolean;
  transcription?: boolean;
  speech?: boolean;
  imageGeneration?: boolean;
  tools?: boolean;
  rerank?: boolean;
  ocr?: boolean;
}
```

### 中间件系统 / Middleware System

```typescript
import { 
  createMiddlewareManager, 
  createLoggingMiddleware,
  createPerformanceMiddleware 
} from '@/lib/ai';

const middleware = createMiddlewareManager();

// 添加日志中间件
middleware.use(createLoggingMiddleware({
  logRequest: true,
  logResponse: true,
  logErrors: true,
}));

// 添加性能监控
middleware.use(createPerformanceMiddleware({
  slowThreshold: 5000,
  onSlowRequest: (ctx) => console.warn(`Slow request: ${ctx.duration}ms`),
}));

// 自定义中间件
middleware.use({
  name: 'custom',
  onRequest: (request, context) => {
    console.log(`Request ID: ${context.requestId}`);
    return request;
  },
  onComplete: (context) => {
    console.log(`Completed in ${context.duration}ms`);
  },
});
```

### 响应缓存 / Response Caching

```typescript
import { createCache, defaultCacheKeyGenerator } from '@/lib/ai';

// 创建内存缓存
const cache = createCache({
  enabled: true,
  ttl: 5 * 60 * 1000, // 5分钟
  maxSize: 100,
  storage: 'memory',
});

// 检查缓存
const cacheKey = defaultCacheKeyGenerator(request);
const cached = await cache.get(cacheKey);
if (cached) {
  return cached;
}

// 存储响应
await cache.set(cacheKey, response);

// 查看统计
console.log(cache.getStats()); // { hits, misses, size, hitRate }
```

### 请求队列和速率限制 / Request Queue & Rate Limiting

```typescript
import { 
  createRequestQueue, 
  createProviderRateLimiter,
  RATE_LIMIT_PRESETS 
} from '@/lib/ai';

// 创建请求队列
const queue = createRequestQueue({
  maxConcurrent: 5,
  rateLimit: { requests: 60, perMilliseconds: 60000 },
  timeout: 30000,
});

queue.setExecutor((request, provider) => client.chat(request, provider));
const response = await queue.enqueue(request, 'openai');

// 或使用提供商级别的限制器
const limiter = createProviderRateLimiter();
limiter.setProviderConfig('openai', RATE_LIMIT_PRESETS.openai);

const response = await limiter.request(
  request,
  'openai',
  (req, prov) => client.chat(req, prov)
);
```

### 成本追踪 / Cost Tracking

```typescript
import { createCostTracker, formatCost, formatTokens } from '@/lib/ai';

const tracker = createCostTracker({
  enabled: true,
  budgetWarning: 50, // $50 警告
  budgetLimit: 100,  // $100 限制
  onBudgetWarning: (current, limit) => {
    console.warn(`Budget warning: ${formatCost(current)} / ${formatCost(limit)}`);
  },
});

// 追踪响应
const record = tracker.track(response, 'openai');
console.log(`Cost: ${formatCost(record.cost)}`);

// 获取使用统计
const usage = tracker.getUsage('openai');
console.log(`Total tokens: ${formatTokens(usage.totalTokens.totalTokens)}`);
console.log(`Total cost: ${formatCost(usage.totalCost)}`);

// 生成账单报告
const report = tracker.getBilling(
  new Date('2024-01-01'),
  new Date('2024-01-31')
);
console.log(report.byProvider, report.dailyBreakdown);
```

### Electron IPC 集成 / Electron IPC Integration

```typescript
// ===== 主进程 (main.ts) =====
import { ipcMain } from 'electron';
import { AIClient, AI_IPC_CHANNELS } from '@/lib/ai';

const client = new AIClient();

// 从安全存储加载 API Keys
const keys = await safeStorage.loadKeys();
keys.forEach(k => client.registerProvider(k));

// 处理 IPC 请求
ipcMain.handle(AI_IPC_CHANNELS.CHAT, async (event, { request, provider }) => {
  try {
    const response = await client.chat(request, provider);
    return { success: true, data: response };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ===== Preload 脚本 (preload.ts) =====
import { contextBridge, ipcRenderer } from 'electron';
import { initPreloadAI } from '@/lib/ai/electron/preload';

const aiAPI = initPreloadAI(ipcRenderer);
contextBridge.exposeInMainWorld('electron', { ai: aiAPI });

// ===== 渲染进程 (renderer.ts) =====
// 发送请求
const response = await window.electron?.ai.chat({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }],
}, 'openai');

// 流式请求
const requestId = window.electron?.ai.chatStream({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Tell me a story' }],
}, 'openai');

window.electron?.ai.onStreamChunk((chunk) => {
  console.log(chunk.choices[0]?.delta?.content);
});
```

## 完整架构图 / Complete Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Electron 主进程 (Main Process)                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  安全存储 (Secure Storage) - API Keys 加密存储                          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                              ↓ IPC Bridge                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                           应用层 (Application Layer)                          │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                │
│  │  React Hooks   │  │   Components   │  │ Error Boundary │                │
│  │ useAI / useChat│  │   ChatUI etc   │  │ AIErrorBoundary│                │
│  └────────────────┘  └────────────────┘  └────────────────┘                │
├─────────────────────────────────────────────────────────────────────────────┤
│                           增强层 (Enhancement Layer)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Middleware │  │    Cache    │  │    Queue    │  │Cost Tracker │        │
│  │ 日志/监控   │  │  响应缓存   │  │  速率限制   │  │  成本追踪   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
├─────────────────────────────────────────────────────────────────────────────┤
│                           客户端层 (Client Layer)                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                           AIClient                                  │    │
│  │  • 提供商管理  • 统一入口  • 回退机制  • 模型路由  • 负载均衡        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────────────┤
│                           工厂层 (Factory Layer)                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  createOpenAI  createAnthropic  createGoogle  createAzureOpenAI     │    │
│  │  createCerebras  createGLM  createGroq  createDeepSeek ...          │    │
│  │  createProviderRegistry()  createModelRouter()                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────────────┤
│                           适配器层 (Adapter Layer)                            │
│  ┌─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐            │
│  │ OpenAI  │Anthropic│ Google  │  Azure  │   AWS   │Cerebras │            │
│  ├─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤            │
│  │   GLM   │  Groq   │DeepSeek │Moonshot │  Qwen   │ Custom  │            │
│  └─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘            │
├─────────────────────────────────────────────────────────────────────────────┤
│                         基础适配器 (Base Adapter)                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  重试逻辑  SSE解析  错误处理  超时管理  请求规范化  响应标准化        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────────────┤
│                           类型层 (Type Layer)                                │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Message  ContentPart  Request  Response  Error  ModelInfo  Usage   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```
