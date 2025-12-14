/**
 * Electron 主进程 AI 桥接实现
 * Electron Main Process AI Bridge Implementation
 */

import { AIClient, AIClientConfig } from '../client';
import type {
  AIProvider,
  ChatCompletionRequest,
  ChatCompletionResponse,
  StreamChunk,
  ModelInfo,
  ProviderConfig,
} from '../types';
import { AI_IPC_CHANNELS } from './ipc-adapter';

// ==================== 安全存储接口 ====================

export interface SecureStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<boolean>;
  list(): Promise<string[]>;
}

// ==================== 内存存储实现 ====================

export class MemorySecureStorage implements SecureStorage {
  private storage = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.storage.get(key) || null;
  }

  async set(key: string, value: string): Promise<void> {
    this.storage.set(key, value);
  }

  async delete(key: string): Promise<boolean> {
    return this.storage.delete(key);
  }

  async list(): Promise<string[]> {
    return Array.from(this.storage.keys());
  }
}

// ==================== 主桥接实现 ====================

export interface MainBridgeConfig extends AIClientConfig {
  secureStorage?: SecureStorage;
}

export class ElectronMainBridge {
  private client: AIClient;
  private storage: SecureStorage;
  private streamCallbacks = new Map<string, (chunk: StreamChunk) => void>();

  constructor(config?: MainBridgeConfig) {
    this.client = new AIClient(config);
    this.storage = config?.secureStorage || new MemorySecureStorage();
  }

  /**
   * 初始化桥接 - 在 Electron 主进程中调用
   */
  initialize(ipcMain: ElectronIpcMain): void {
    // 聊天完成
    ipcMain.handle(AI_IPC_CHANNELS.CHAT, async (_event, payload) => {
      try {
        const { request, provider } = payload;
        const response = await this.client.chat(request, provider);
        return { success: true, data: response };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    // 流式聊天
    ipcMain.handle(AI_IPC_CHANNELS.CHAT_STREAM, async (event, payload) => {
      const { request, provider, streamId } = payload;
      
      try {
        for await (const chunk of this.client.chatStream(request, provider)) {
          event.sender.send(AI_IPC_CHANNELS.CHAT_STREAM_CHUNK, { streamId, chunk });
        }
        event.sender.send(AI_IPC_CHANNELS.CHAT_STREAM_END, { streamId });
        return { success: true };
      } catch (error) {
        event.sender.send(AI_IPC_CHANNELS.CHAT_STREAM_ERROR, { 
          streamId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    // 列出模型
    ipcMain.handle(AI_IPC_CHANNELS.LIST_MODELS, async (_event, payload) => {
      const { provider } = payload || {};
      return this.client.listModels(provider);
    });

    // 验证 API Key
    ipcMain.handle(AI_IPC_CHANNELS.VALIDATE_KEY, async (_event, payload) => {
      const { provider } = payload;
      return this.client.validateProvider(provider);
    });

    // 注册提供商
    ipcMain.handle(AI_IPC_CHANNELS.REGISTER_PROVIDER, async (_event, config) => {
      this.client.registerProvider(config);
      return { success: true };
    });

    // 注销提供商
    ipcMain.handle(AI_IPC_CHANNELS.UNREGISTER_PROVIDER, async (_event, payload) => {
      const { provider } = payload;
      this.client.unregisterProvider(provider);
      return { success: true };
    });

    // 获取提供商
    ipcMain.handle(AI_IPC_CHANNELS.GET_PROVIDERS, async () => {
      return this.client.getProviders();
    });

    // 安全存储 API Key
    ipcMain.handle(AI_IPC_CHANNELS.STORE_API_KEY, async (_event, payload) => {
      const { provider, apiKey } = payload;
      await this.storage.set(`api_key_${provider}`, apiKey);
      return { success: true };
    });

    // 删除 API Key
    ipcMain.handle(AI_IPC_CHANNELS.DELETE_API_KEY, async (_event, payload) => {
      const { provider } = payload;
      await this.storage.delete(`api_key_${provider}`);
      return { success: true };
    });

    // 列出存储的 API Key 提供商
    ipcMain.handle(AI_IPC_CHANNELS.LIST_API_KEYS, async () => {
      const keys = await this.storage.list();
      return keys
        .filter(k => k.startsWith('api_key_'))
        .map(k => k.replace('api_key_', '') as AIProvider);
    });
  }

  /**
   * 获取 AI 客户端实例
   */
  getClient(): AIClient {
    return this.client;
  }

  /**
   * 获取存储实例
   */
  getStorage(): SecureStorage {
    return this.storage;
  }

  /**
   * 从存储加载并注册提供商
   */
  async loadProvidersFromStorage(
    providerConfigs: Omit<ProviderConfig, 'apiKey'>[]
  ): Promise<void> {
    for (const config of providerConfigs) {
      const apiKey = await this.storage.get(`api_key_${config.provider}`);
      if (apiKey) {
        this.client.registerProvider({ ...config, apiKey });
      }
    }
  }

  /**
   * 销毁桥接
   */
  destroy(ipcMain: ElectronIpcMain): void {
    const channels = Object.values(AI_IPC_CHANNELS);
    for (const channel of channels) {
      ipcMain.removeHandler(channel);
    }
  }
}

// ==================== Electron IPC 主进程类型 ====================

export interface ElectronIpcMain {
  handle(channel: string, listener: (event: ElectronIpcMainEvent, ...args: any[]) => Promise<any> | any): void;
  removeHandler(channel: string): void;
}

export interface ElectronIpcMainEvent {
  sender: {
    send(channel: string, ...args: any[]): void;
  };
}

// ==================== 工厂函数 ====================

export function createMainBridge(config?: MainBridgeConfig): ElectronMainBridge {
  return new ElectronMainBridge(config);
}

/**
 * 创建基于 electron-store 的安全存储
 * 注意：需要在 Electron 环境中使用，并安装 electron-store
 */
export function createElectronStoreStorage(store: any): SecureStorage {
  return {
    async get(key: string) {
      return store.get(key) || null;
    },
    async set(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
      return true;
    },
    async list() {
      return Object.keys(store.store || {});
    },
  };
}

/**
 * 创建基于 keytar 的安全存储（使用系统密钥链）
 * 注意：需要在 Electron 环境中使用，并安装 keytar
 */
export function createKeytarStorage(keytar: any, service: string): SecureStorage {
  return {
    async get(key: string) {
      return keytar.getPassword(service, key);
    },
    async set(key: string, value: string) {
      await keytar.setPassword(service, key, value);
    },
    async delete(key: string) {
      return keytar.deletePassword(service, key);
    },
    async list() {
      const credentials = await keytar.findCredentials(service);
      return credentials.map((c: any) => c.account);
    },
  };
}
