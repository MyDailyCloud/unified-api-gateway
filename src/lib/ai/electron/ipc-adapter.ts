/**
 * Electron IPC AI 适配器
 * Electron IPC AI Adapter
 * 
 * 用于在 Electron 应用中安全地处理 AI 请求
 * 主进程存储 API Keys，渲染进程通过 IPC 调用
 */

import type { 
  ChatCompletionRequest, 
  ChatCompletionResponse, 
  StreamChunk,
  AIProvider,
  ProviderConfig,
  ModelInfo 
} from '../types';

// ==================== IPC 通道定义 ====================

export const AI_IPC_CHANNELS = {
  // 请求通道
  CHAT: 'ai:chat',
  CHAT_STREAM: 'ai:chat:stream',
  CHAT_STREAM_CHUNK: 'ai:chat:stream:chunk',
  CHAT_STREAM_END: 'ai:chat:stream:end',
  CHAT_STREAM_ERROR: 'ai:chat:stream:error',
  LIST_MODELS: 'ai:models:list',
  VALIDATE_KEY: 'ai:key:validate',
  
  // 配置通道
  REGISTER_PROVIDER: 'ai:provider:register',
  UNREGISTER_PROVIDER: 'ai:provider:unregister',
  GET_PROVIDERS: 'ai:providers:get',
  
  // 安全存储通道
  STORE_API_KEY: 'ai:key:store',
  GET_API_KEY: 'ai:key:get',
  DELETE_API_KEY: 'ai:key:delete',
  LIST_API_KEYS: 'ai:keys:list',
} as const;

// ==================== IPC 消息类型 ====================

export interface IPCChatRequest {
  request: ChatCompletionRequest;
  provider?: AIProvider;
}

export interface IPCChatResponse {
  success: boolean;
  data?: ChatCompletionResponse;
  error?: string;
}

export interface IPCStreamChunk {
  requestId: string;
  chunk: StreamChunk;
}

export interface IPCProviderConfig {
  provider: AIProvider;
  apiKey: string;
  baseURL?: string;
  defaultModel?: string;
}

export interface IPCKeyStorageRequest {
  provider: AIProvider;
  apiKey: string;
}

// ==================== 主进程 AI 桥接 ====================

/**
 * 主进程 AI 服务
 * 在 Electron 主进程中运行，管理 AI 客户端和安全存储
 */
export interface ElectronAIBridge {
  /**
   * 初始化桥接
   */
  initialize(): Promise<void>;

  /**
   * 注册提供商
   */
  registerProvider(config: ProviderConfig): Promise<void>;

  /**
   * 注销提供商
   */
  unregisterProvider(provider: AIProvider): Promise<void>;

  /**
   * 获取已注册的提供商
   */
  getProviders(): AIProvider[];

  /**
   * 发送聊天请求
   */
  chat(request: ChatCompletionRequest, provider?: AIProvider): Promise<ChatCompletionResponse>;

  /**
   * 发送流式聊天请求
   */
  chatStream(
    request: ChatCompletionRequest, 
    onChunk: (chunk: StreamChunk) => void,
    provider?: AIProvider
  ): Promise<void>;

  /**
   * 列出模型
   */
  listModels(provider?: AIProvider): Promise<ModelInfo[]>;

  /**
   * 验证 API Key
   */
  validateApiKey(provider: AIProvider): Promise<boolean>;

  /**
   * 安全存储 API Key
   */
  securelyStoreKey(provider: AIProvider, apiKey: string): Promise<void>;

  /**
   * 获取存储的 API Key
   */
  getStoredKey(provider: AIProvider): Promise<string | null>;

  /**
   * 删除存储的 API Key
   */
  deleteStoredKey(provider: AIProvider): Promise<void>;

  /**
   * 列出所有存储的 API Key 提供商
   */
  listStoredKeyProviders(): Promise<AIProvider[]>;
}

// ==================== 渲染进程 AI 客户端 ====================

/**
 * 渲染进程 AI 客户端
 * 通过 IPC 与主进程通信
 */
export class ElectronAIClient {
  private ipcRenderer: ElectronIpcRenderer;

  constructor(ipcRenderer: ElectronIpcRenderer) {
    this.ipcRenderer = ipcRenderer;
  }

  /**
   * 发送聊天请求
   */
  async chat(request: ChatCompletionRequest, provider?: AIProvider): Promise<ChatCompletionResponse> {
    const response = await this.ipcRenderer.invoke(AI_IPC_CHANNELS.CHAT, {
      request,
      provider,
    } as IPCChatRequest) as IPCChatResponse;

    if (!response.success) {
      throw new Error(response.error || 'Unknown error');
    }

    return response.data!;
  }

  /**
   * 发送流式聊天请求
   */
  async *chatStream(
    request: ChatCompletionRequest, 
    provider?: AIProvider
  ): AsyncIterable<StreamChunk> {
    const requestId = `stream_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // 创建一个 Promise 来处理流结束或错误
    let resolveStream: () => void;
    let rejectStream: (error: Error) => void;
    const streamComplete = new Promise<void>((resolve, reject) => {
      resolveStream = resolve;
      rejectStream = reject;
    });

    // 用于存储接收到的 chunks
    const chunks: StreamChunk[] = [];
    let chunkIndex = 0;

    // 监听 chunk 事件
    const chunkHandler = (_event: unknown, ...args: unknown[]) => {
      const data = args[0] as IPCStreamChunk;
      if (data && data.requestId === requestId) {
        chunks.push(data.chunk);
      }
    };

    // 监听结束事件
    const endHandler = (_event: unknown, ...args: unknown[]) => {
      const data = args[0] as { requestId: string };
      if (data && data.requestId === requestId) {
        resolveStream();
      }
    };

    // 监听错误事件
    const errorHandler = (_event: unknown, ...args: unknown[]) => {
      const data = args[0] as { requestId: string; error: string };
      if (data && data.requestId === requestId) {
        rejectStream(new Error(data.error));
      }
    };

    this.ipcRenderer.on(AI_IPC_CHANNELS.CHAT_STREAM_CHUNK, chunkHandler);
    this.ipcRenderer.on(AI_IPC_CHANNELS.CHAT_STREAM_END, endHandler);
    this.ipcRenderer.on(AI_IPC_CHANNELS.CHAT_STREAM_ERROR, errorHandler);

    try {
      // 开始流式请求
      this.ipcRenderer.send(AI_IPC_CHANNELS.CHAT_STREAM, {
        requestId,
        request,
        provider,
      });

      // 轮询并 yield chunks
      while (true) {
        // 检查是否有新的 chunks
        while (chunkIndex < chunks.length) {
          yield chunks[chunkIndex++];
        }

        // 检查流是否完成
        const raceResult = await Promise.race([
          streamComplete.then(() => 'complete' as const),
          new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 10)),
        ]);

        if (raceResult === 'complete') {
          // 输出剩余的 chunks
          while (chunkIndex < chunks.length) {
            yield chunks[chunkIndex++];
          }
          break;
        }
      }
    } finally {
      // 清理监听器
      this.ipcRenderer.removeListener(AI_IPC_CHANNELS.CHAT_STREAM_CHUNK, chunkHandler);
      this.ipcRenderer.removeListener(AI_IPC_CHANNELS.CHAT_STREAM_END, endHandler);
      this.ipcRenderer.removeListener(AI_IPC_CHANNELS.CHAT_STREAM_ERROR, errorHandler);
    }
  }

  /**
   * 列出模型
   */
  async listModels(provider?: AIProvider): Promise<ModelInfo[]> {
    return this.ipcRenderer.invoke(AI_IPC_CHANNELS.LIST_MODELS, { provider }) as Promise<ModelInfo[]>;
  }

  /**
   * 验证 API Key
   */
  async validateApiKey(provider: AIProvider): Promise<boolean> {
    return this.ipcRenderer.invoke(AI_IPC_CHANNELS.VALIDATE_KEY, { provider }) as Promise<boolean>;
  }

  /**
   * 注册提供商
   */
  async registerProvider(config: IPCProviderConfig): Promise<void> {
    await this.ipcRenderer.invoke(AI_IPC_CHANNELS.REGISTER_PROVIDER, config);
  }

  /**
   * 注销提供商
   */
  async unregisterProvider(provider: AIProvider): Promise<void> {
    await this.ipcRenderer.invoke(AI_IPC_CHANNELS.UNREGISTER_PROVIDER, { provider });
  }

  /**
   * 获取已注册的提供商
   */
  async getProviders(): Promise<AIProvider[]> {
    return this.ipcRenderer.invoke(AI_IPC_CHANNELS.GET_PROVIDERS) as Promise<AIProvider[]>;
  }

  /**
   * 安全存储 API Key
   */
  async storeApiKey(provider: AIProvider, apiKey: string): Promise<void> {
    await this.ipcRenderer.invoke(AI_IPC_CHANNELS.STORE_API_KEY, { provider, apiKey });
  }

  /**
   * 删除存储的 API Key
   */
  async deleteApiKey(provider: AIProvider): Promise<void> {
    await this.ipcRenderer.invoke(AI_IPC_CHANNELS.DELETE_API_KEY, { provider });
  }

  /**
   * 列出所有存储的 API Key 提供商
   */
  async listStoredKeyProviders(): Promise<AIProvider[]> {
    return this.ipcRenderer.invoke(AI_IPC_CHANNELS.LIST_API_KEYS) as Promise<AIProvider[]>;
  }
}

// ==================== 类型定义 ====================

/**
 * Electron IPC Renderer 接口
 * 用于类型安全的 IPC 调用
 */
export interface ElectronIpcRenderer {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  send(channel: string, ...args: unknown[]): void;
  on(channel: string, listener: (...args: unknown[]) => void): void;
  removeListener(channel: string, listener: (...args: unknown[]) => void): void;
}

// ==================== Window 类型扩展 ====================
// Note: The global Window.electron interface is defined in electron/env.d.ts
// This declaration is commented out to avoid conflicts
/*
declare global {
  interface Window {
    electron?: {
      ai: ElectronAIClient;
      ipcRenderer: ElectronIpcRenderer;
    };
  }
}
*/

// ==================== 类型扩展 ====================

declare global {
  interface Window {
    electron?: {
      app: {
        getVersion: () => Promise<string>;
        getPlatform: () => Promise<string>;
        getPath: (name: string) => Promise<string>;
      };
      platform: NodeJS.Platform;
      ipc: {
        send: (channel: string, ...args: any[]) => void;
        invoke: (channel: string, ...args: any[]) => Promise<any>;
        on: (channel: string, callback: (...args: any[]) => void) => void;
        once: (channel: string, callback: (...args: any[]) => void) => void;
        removeListener: (channel: string, callback: (...args: any[]) => void) => void;
        removeAllListeners: (channel: string) => void;
      };
      ai?: any;
      ipcRenderer?: any;
    };
  }
}

// ==================== 工具函数 ====================

/**
 * 检查是否在 Electron 渲染进程中
 */
export function isElectronRenderer(): boolean {
  return typeof window !== 'undefined' && !!window.electron;
}

/**
 * 获取 Electron AI 客户端
 */
export function getElectronAIClient(): ElectronAIClient | null {
  if (isElectronRenderer() && window.electron && window.electron.ai) {
    return window.electron.ai as ElectronAIClient;
  }
  return null;
}

/**
 * 创建 Electron AI 客户端
 */
export function createElectronAIClient(ipcRenderer: ElectronIpcRenderer): ElectronAIClient {
  return new ElectronAIClient(ipcRenderer);
}
