# 统一 AI SDK / Unified AI SDK

一个支持多 AI 平台的统一适配器架构，可自适应各个 API 端点。

## 架构设计

```
┌──────────────────────────────────────────────────────────────┐
│                      应用层 (Application)                      │
│   React Components / Hooks (useAI, useChat)                  │
├──────────────────────────────────────────────────────────────┤
│                      客户端层 (Client)                         │
│   AIClient - 统一入口，提供商管理，回退机制                      │
├──────────────────────────────────────────────────────────────┤
│                      适配器层 (Adapters)                       │
│  ┌─────────┬─────────┬─────────┬─────────┬─────────┐        │
│  │ OpenAI  │Anthropic│Cerebras │   GLM   │  Groq   │        │
│  ├─────────┼─────────┼─────────┼─────────┼─────────┤        │
│  │DeepSeek │Moonshot │  Qwen   │ Custom  │  ...    │        │
│  └─────────┴─────────┴─────────┴─────────┴─────────┘        │
├──────────────────────────────────────────────────────────────┤
│                      基础适配器 (BaseAdapter)                  │
│   通用功能：重试、错误处理、SSE解析、请求规范化                   │
├──────────────────────────────────────────────────────────────┤
│                      类型层 (Types)                           │
│   统一类型定义：Message, Request, Response, Error             │
└──────────────────────────────────────────────────────────────┘
```

## 快速开始

### 1. 注册提供商

```typescript
import { AIClient } from '@/lib/ai';

const client = new AIClient();

// 注册 OpenAI
client.registerProvider({
  provider: 'openai',
  apiKey: 'sk-xxx',
});

// 注册 Anthropic
client.registerProvider({
  provider: 'anthropic',
  apiKey: 'sk-ant-xxx',
});

// 注册 Cerebras
client.registerProvider({
  provider: 'cerebras',
  apiKey: 'csk-xxx',
});

// 注册智谱 GLM
client.registerProvider({
  provider: 'glm',
  apiKey: 'xxx.xxx',
});
```

### 2. 发送请求

```typescript
// 非流式
const response = await client.chat({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Hello!' }],
}, 'openai');

// 流式
for await (const chunk of client.chatStream({
  model: 'claude-sonnet-4-5',
  messages: [{ role: 'user', content: 'Tell me a story' }],
}, 'anthropic')) {
  console.log(chunk.choices[0]?.delta?.content);
}
```

### 3. 带回退的请求

```typescript
const response = await client.chatWithFallback(
  { model: 'auto', messages: [...] },
  ['openai', 'anthropic', 'glm'] // 按顺序尝试
);
```

### 4. React Hooks

```tsx
import { useChat } from '@/lib/ai';

function ChatComponent() {
  const { messages, send, isLoading } = useChat({
    provider: 'openai',
    systemPrompt: 'You are a helpful assistant.',
  });

  return (
    <div>
      {messages.map((m, i) => (
        <div key={i}>{m.role}: {m.content}</div>
      ))}
      <button onClick={() => send('Hello!')}>Send</button>
    </div>
  );
}
```

## 支持的提供商

| 提供商 | API 兼容性 | 特点 |
|--------|-----------|------|
| OpenAI | 原生 | GPT-4, GPT-5, O3/O4 |
| Anthropic | 转换 | Claude 3.5/4 系列 |
| Cerebras | OpenAI 兼容 | 超快推理 |
| GLM | OpenAI 兼容 | 智谱 AI |
| Groq | OpenAI 兼容 | 高速 Llama |
| DeepSeek | OpenAI 兼容 | DeepSeek 系列 |
| Moonshot | OpenAI 兼容 | Kimi |
| Qwen | OpenAI 兼容 | 通义千问 |
| Custom | 可配置 | 任意兼容 API |

## 自定义适配器

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

## 错误处理

```typescript
import { AIError, RateLimitError, AuthenticationError } from '@/lib/ai';

try {
  await client.chat(request);
} catch (error) {
  if (error instanceof RateLimitError) {
    // 处理速率限制
  } else if (error instanceof AuthenticationError) {
    // 处理认证错误
  } else if (error instanceof AIError) {
    console.log(error.code, error.provider, error.statusCode);
  }
}
```

## Electron 集成

此架构完全兼容 Electron 应用：

```typescript
// main process
import { AIClient } from '@/lib/ai';

const client = new AIClient();
// 从安全存储加载 API keys
const keys = await loadAPIKeys();
keys.forEach(k => client.registerProvider(k));

// renderer process (通过 IPC)
const response = await window.electron.ai.chat(request);
```
