# AI SDK 架构文档

## 统一启动架构

重构后的 AI SDK 提供两个主要启动入口：

```
┌─────────────────────────────────────────────────────────────┐
│                        启动入口                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────────┐         ┌─────────────────┐           │
│   │   CLI (Node)    │         │   Electron      │           │
│   │   cli.ts        │         │   main.ts       │           │
│   └────────┬────────┘         └────────┬────────┘           │
│            │                           │                     │
│            ▼                           ▼                     │
│   ┌─────────────────┐         ┌─────────────────┐           │
│   │ startNodeServer │         │createElectronApp│           │
│   │  (app/node.ts)  │         │ (app/electron.ts)│          │
│   └────────┬────────┘         └────────┬────────┘           │
│            │                           │                     │
│            └───────────┬───────────────┘                     │
│                        ▼                                     │
│            ┌─────────────────────────┐                       │
│            │      createAICore()     │                       │
│            │      (core/index.ts)    │                       │
│            └───────────┬─────────────┘                       │
│                        │                                     │
│            ┌───────────┴───────────┐                         │
│            ▼                       ▼                         │
│   ┌─────────────────┐     ┌─────────────────┐               │
│   │createHttpServer │     │createIpcMainBridge│             │
│   │(transport/http) │     │ (transport/ipc)  │              │
│   └─────────────────┘     └─────────────────┘               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 启动方式

### 1. Node.js 服务器

**推荐方式：**
```typescript
import { startNodeServer } from './app/node';

const app = await startNodeServer({
  http: { port: 3000, host: '0.0.0.0' },
  providers: [
    { provider: 'openai', apiKey: process.env.OPENAI_API_KEY! },
  ],
  mode: 'full', // 'api-only' | 'internal-only' | 'full'
});

// 优雅关闭
process.on('SIGINT', () => app.stop());
```

**CLI 方式：**
```bash
# 使用环境变量
export OPENAI_API_KEY=sk-...
npx ai-sdk serve

# 指定端口
npx ai-sdk serve -p 8080

# 使用配置文件
npx ai-sdk serve -c ./config.json
```

### 2. Electron 应用

```typescript
import { createElectronApp, createElectronStoreSecureStorage } from './app/electron';
import Store from 'electron-store';

const store = new Store({ name: 'ai-keys', encryptionKey: '...' });

const app = await createElectronApp({
  secureStorage: createElectronStoreSecureStorage(store),
  providers: [
    { provider: 'openai', apiKey: 'from-secure-storage' },
  ],
});

await app.init();
```

## 模块结构

```
src/lib/ai/
├── app/                    # 应用启动器（统一入口）
│   ├── index.ts           # 导出
│   ├── node.ts            # Node.js 启动器 (startNodeServer)
│   └── electron.ts        # Electron 启动器 (createElectronApp)
│
├── core/                   # 核心层
│   ├── index.ts           # AICore 类
│   ├── ai-service.ts      # AI 服务（OpenAI 兼容 API）
│   ├── internal-service.ts # 内部服务
│   └── types.ts           # 类型定义
│
├── transport/              # 传输层
│   ├── http/              # HTTP 服务器
│   │   ├── server.ts      # createHttpServer
│   │   ├── api-router.ts  # API 路由
│   │   └── internal-router.ts
│   └── ipc/               # Electron IPC
│       ├── bridge.ts
│       └── channels.ts
│
├── server/                 # 服务器工具（配置、认证）
│   ├── index.ts           # 导出（含废弃的 createServer）
│   ├── config.ts          # 配置加载
│   ├── init.ts            # 认证初始化
│   ├── auth/              # 认证模块
│   ├── rate-limiter.ts    # 速率限制
│   └── request-logger.ts  # 请求日志
│
├── adapters/               # 提供商适配器
├── factory.ts              # 工厂函数 (createOpenAI, etc.)
├── client.ts               # AIClient
├── enhanced-client.ts      # EnhancedAIClient（含中间件）
├── middleware.ts           # 中间件系统
├── cache.ts                # 缓存
├── queue.ts                # 请求队列
├── cost-tracker.ts         # 成本追踪
├── diagnostics.ts          # 诊断工具
└── cli.ts                  # CLI 入口
```

## 废弃说明

以下函数已废弃，请迁移到新 API：

| 废弃 | 替代 | 说明 |
|------|------|------|
| `createServer()` | `startNodeServer()` | 统一使用 app/node.ts |
| `startServer()` | `startNodeServer()` | 同上 |

废弃的函数仍然可用，但会打印警告信息，并将在未来版本移除。

## 功能对比

| 功能 | 旧 createServer | 新 startNodeServer |
|------|-----------------|-------------------|
| 基础 HTTP 服务 | ✅ | ✅ |
| 提供商注册 | ✅ | ✅ |
| 速率限制 | ✅ | ✅ |
| 认证系统 | ❌ | ✅ |
| Gateway Key 管理 | ❌ | ✅ |
| 内部 API | ❌ | ✅ |
| 对话持久化 | ✅ | ✅（通过 storage 配置）|
