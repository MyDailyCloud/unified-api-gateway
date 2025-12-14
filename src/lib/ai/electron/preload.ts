/**
 * Electron Preload Script for AI SDK
 * 
 * 此脚本在 Electron 的 preload 环境中运行
 * 通过 contextBridge 安全地暴露 AI API 给渲染进程
 */

// ==================== 类型导入 ====================

import type { 
  ChatCompletionRequest, 
  StreamChunk,
  AIProvider,
  ModelInfo 
} from '../types';
import { AI_IPC_CHANNELS, type IPCProviderConfig } from './ipc-adapter';

// ==================== Preload API 定义 ====================

/**
 * 暴露给渲染进程的 AI API
 */
export interface PreloadAIAPI {
  /**
   * 发送聊天请求
   */
  chat(request: ChatCompletionRequest, provider?: AIProvider): Promise<unknown>;

  /**
   * 发送流式聊天请求
   * @returns 请求 ID，用于接收流式响应
   */
  chatStream(request: ChatCompletionRequest, provider?: AIProvider): string;

  /**
   * 监听流式响应
   */
  onStreamChunk(callback: (chunk: StreamChunk) => void): () => void;

  /**
   * 监听流式结束
   */
  onStreamEnd(callback: (requestId: string) => void): () => void;

  /**
   * 监听流式错误
   */
  onStreamError(callback: (requestId: string, error: string) => void): () => void;

  /**
   * 列出模型
   */
  listModels(provider?: AIProvider): Promise<ModelInfo[]>;

  /**
   * 验证 API Key
   */
  validateApiKey(provider: AIProvider): Promise<boolean>;

  /**
   * 注册提供商
   */
  registerProvider(config: IPCProviderConfig): Promise<void>;

  /**
   * 注销提供商
   */
  unregisterProvider(provider: AIProvider): Promise<void>;

  /**
   * 获取已注册的提供商
   */
  getProviders(): Promise<AIProvider[]>;

  /**
   * 安全存储 API Key
   */
  storeApiKey(provider: AIProvider, apiKey: string): Promise<void>;

  /**
   * 删除存储的 API Key
   */
  deleteApiKey(provider: AIProvider): Promise<void>;

  /**
   * 列出所有存储的 API Key 提供商
   */
  listStoredKeyProviders(): Promise<AIProvider[]>;
}

// ==================== Preload 初始化函数 ====================

/**
 * 初始化 Preload AI API
 * 
 * 在 Electron 的 preload 脚本中调用此函数：
 * 
 * ```typescript
 * // preload.ts
 * import { contextBridge } from 'electron';
 * import { initPreloadAI } from '@/lib/ai/electron/preload';
 * 
 * const aiAPI = initPreloadAI(ipcRenderer);
 * contextBridge.exposeInMainWorld('electron', {
 *   ai: aiAPI,
 * });
 * ```
 */
export function initPreloadAI(ipcRenderer: {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  send: (channel: string, ...args: unknown[]) => void;
  on: (channel: string, listener: (event: unknown, ...args: unknown[]) => void) => void;
  removeListener: (channel: string, listener: (...args: unknown[]) => void) => void;
}): PreloadAIAPI {
  // 用于生成流请求 ID
  const generateRequestId = () => `stream_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  return {
    // 聊天请求
    chat: (request: ChatCompletionRequest, provider?: AIProvider) => {
      return ipcRenderer.invoke(AI_IPC_CHANNELS.CHAT, { request, provider });
    },

    // 流式聊天请求
    chatStream: (request: ChatCompletionRequest, provider?: AIProvider) => {
      const requestId = generateRequestId();
      ipcRenderer.send(AI_IPC_CHANNELS.CHAT_STREAM, { requestId, request, provider });
      return requestId;
    },

    // 监听流式响应
    onStreamChunk: (callback: (chunk: StreamChunk) => void) => {
      const handler = (_event: unknown, ...args: unknown[]) => {
        const data = args[0] as { chunk: StreamChunk };
        if (data && data.chunk) {
          callback(data.chunk);
        }
      };
      ipcRenderer.on(AI_IPC_CHANNELS.CHAT_STREAM_CHUNK, handler);
      return () => ipcRenderer.removeListener(AI_IPC_CHANNELS.CHAT_STREAM_CHUNK, handler);
    },

    // 监听流式结束
    onStreamEnd: (callback: (requestId: string) => void) => {
      const handler = (_event: unknown, ...args: unknown[]) => {
        const data = args[0] as { requestId: string };
        if (data && data.requestId) {
          callback(data.requestId);
        }
      };
      ipcRenderer.on(AI_IPC_CHANNELS.CHAT_STREAM_END, handler);
      return () => ipcRenderer.removeListener(AI_IPC_CHANNELS.CHAT_STREAM_END, handler);
    },

    // 监听流式错误
    onStreamError: (callback: (requestId: string, error: string) => void) => {
      const handler = (_event: unknown, ...args: unknown[]) => {
        const data = args[0] as { requestId: string; error: string };
        if (data && data.requestId) {
          callback(data.requestId, data.error);
        }
      };
      ipcRenderer.on(AI_IPC_CHANNELS.CHAT_STREAM_ERROR, handler);
      return () => ipcRenderer.removeListener(AI_IPC_CHANNELS.CHAT_STREAM_ERROR, handler);
    },

    // 列出模型
    listModels: (provider?: AIProvider) => {
      return ipcRenderer.invoke(AI_IPC_CHANNELS.LIST_MODELS, { provider }) as Promise<ModelInfo[]>;
    },

    // 验证 API Key
    validateApiKey: (provider: AIProvider) => {
      return ipcRenderer.invoke(AI_IPC_CHANNELS.VALIDATE_KEY, { provider }) as Promise<boolean>;
    },

    // 注册提供商
    registerProvider: (config: IPCProviderConfig) => {
      return ipcRenderer.invoke(AI_IPC_CHANNELS.REGISTER_PROVIDER, config) as Promise<void>;
    },

    // 注销提供商
    unregisterProvider: (provider: AIProvider) => {
      return ipcRenderer.invoke(AI_IPC_CHANNELS.UNREGISTER_PROVIDER, { provider }) as Promise<void>;
    },

    // 获取已注册的提供商
    getProviders: () => {
      return ipcRenderer.invoke(AI_IPC_CHANNELS.GET_PROVIDERS) as Promise<AIProvider[]>;
    },

    // 安全存储 API Key
    storeApiKey: (provider: AIProvider, apiKey: string) => {
      return ipcRenderer.invoke(AI_IPC_CHANNELS.STORE_API_KEY, { provider, apiKey }) as Promise<void>;
    },

    // 删除存储的 API Key
    deleteApiKey: (provider: AIProvider) => {
      return ipcRenderer.invoke(AI_IPC_CHANNELS.DELETE_API_KEY, { provider }) as Promise<void>;
    },

    // 列出所有存储的 API Key 提供商
    listStoredKeyProviders: () => {
      return ipcRenderer.invoke(AI_IPC_CHANNELS.LIST_API_KEYS) as Promise<AIProvider[]>;
    },
  };
}

// ==================== 使用示例 ====================

/**
 * 示例: 在渲染进程中使用 AI API
 * 
 * ```typescript
 * // renderer.ts
 * async function chat() {
 *   const response = await window.electron?.ai.chat({
 *     model: 'gpt-4o',
 *     messages: [{ role: 'user', content: 'Hello!' }],
 *   }, 'openai');
 *   
 *   console.log(response);
 * }
 * 
 * // 流式请求
 * function streamChat() {
 *   const requestId = window.electron?.ai.chatStream({
 *     model: 'gpt-4o',
 *     messages: [{ role: 'user', content: 'Tell me a story' }],
 *   }, 'openai');
 * 
 *   const unsubChunk = window.electron?.ai.onStreamChunk((chunk) => {
 *     console.log(chunk.choices[0]?.delta?.content);
 *   });
 * 
 *   const unsubEnd = window.electron?.ai.onStreamEnd((id) => {
 *     if (id === requestId) {
 *       console.log('Stream ended');
 *       unsubChunk?.();
 *       unsubEnd?.();
 *     }
 *   });
 * }
 * ```
 */
