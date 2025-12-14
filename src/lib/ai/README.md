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

## Electron 集成 / Electron Integration

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

```typescript
import type { Message, ContentPart } from '@/lib/ai';

// 发送包含图片的消息
const message: Message = {
  role: 'user',
  content: [
    { type: 'text', text: 'What is in this image?' },
    { 
      type: 'image_url', 
      image_url: { 
        url: 'data:image/png;base64,...',
        detail: 'high' 
      } 
    },
  ],
};
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
