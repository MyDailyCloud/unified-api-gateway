/**
 * Electron 应用启动器
 * Electron Application Launcher
 */

import { AICore, createAICore, type AICoreConfig } from '../core';
import { createIpcMainBridge, type IpcMainBridge, type IpcBridgeConfig } from '../transport';
import type { StorageConfig } from '../storage/types';
import type { AIProvider } from '../types';

// Electron 类型
interface ElectronIpcMain {
  handle(channel: string, listener: (event: any, ...args: any[]) => Promise<any> | any): void;
  removeHandler(channel: string): void;
}

interface SecureStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<boolean>;
  list(): Promise<string[]>;
}

export interface ElectronAppConfig {
  /** 核心配置 */
  core?: AICoreConfig;
  /** 存储配置 */
  storage?: Partial<StorageConfig>;
  /** IPC 配置 */
  ipc?: IpcBridgeConfig;
  /** 安全存储（用于 API Key） */
  secureStorage?: SecureStorage;
  /** 用户数据路径 */
  userDataPath?: string;
  /** 预配置的提供商 */
  providers?: Array<{
    provider: AIProvider;
    apiKey?: string; // 可选，也可以从 secureStorage 加载
  }>;
}

export interface ElectronAppInstance {
  /** AICore 实例 */
  core: AICore;
  /** IPC 桥接 */
  bridge: IpcMainBridge;
  /** 初始化（绑定 IPC 处理器） */
  initialize(ipcMain: ElectronIpcMain): void;
  /** 销毁 */
  destroy(ipcMain: ElectronIpcMain): Promise<void>;
  /** 从安全存储加载 API Keys */
  loadApiKeysFromSecureStorage(): Promise<void>;
}

/**
 * 创建 Electron 应用
 */
export async function createElectronApp(config: ElectronAppConfig = {}): Promise<ElectronAppInstance> {
  // 默认存储路径
  const storageConfig: Partial<StorageConfig> = {
    type: 'sqlite',
    dbPath: config.userDataPath 
      ? `${config.userDataPath}/ai-data.db`
      : './ai-data.db',
    ...config.storage,
  };

  // 创建核心
  const core = await createAICore({
    ...config.core,
    storage: storageConfig,
  });

  // 创建 IPC 桥接
  const bridge = createIpcMainBridge(core, config.ipc);

  // 安全存储引用
  const secureStorage = config.secureStorage;

  // 从安全存储加载 API Keys
  async function loadApiKeysFromSecureStorage() {
    if (!secureStorage) return;

    const { 
      createOpenAI, 
      createAnthropic, 
      createGoogle,
      createDeepSeek,
      createMoonshot,
      createQwen,
      createGroq,
      createGLM,
    } = await import('../factory');

    const keys = await secureStorage.list();
    
    for (const key of keys) {
      if (!key.startsWith('apikey:')) continue;
      
      const provider = key.replace('apikey:', '') as AIProvider;
      const apiKey = await secureStorage.get(key);
      
      if (!apiKey) continue;

      let adapter;
      switch (provider) {
        case 'openai':
          adapter = createOpenAI({ apiKey });
          break;
        case 'anthropic':
          adapter = createAnthropic({ apiKey });
          break;
        case 'google':
          adapter = createGoogle({ apiKey });
          break;
        case 'deepseek':
          adapter = createDeepSeek({ apiKey });
          break;
        case 'moonshot':
          adapter = createMoonshot({ apiKey });
          break;
        case 'qwen':
          adapter = createQwen({ apiKey });
          break;
        case 'groq':
          adapter = createGroq({ apiKey });
          break;
        case 'glm':
          adapter = createGLM({ apiKey });
          break;
        default:
          continue;
      }
      
      core.registerProviderWithAdapter(provider, adapter as any);
    }
  }

  // 注册预配置的提供商
  if (config.providers) {
    const { 
      createOpenAI, 
      createAnthropic, 
      createGoogle,
      createDeepSeek,
      createMoonshot,
      createQwen,
      createGroq,
      createGLM,
    } = await import('../factory');

    for (const { provider, apiKey } of config.providers) {
      // 如果没有提供 apiKey，尝试从安全存储获取
      let key = apiKey;
      if (!key && secureStorage) {
        key = await secureStorage.get(`apikey:${provider}`) ?? undefined;
      }
      
      if (!key) continue;

      let adapter;
      switch (provider) {
        case 'openai':
          adapter = createOpenAI({ apiKey: key });
          break;
        case 'anthropic':
          adapter = createAnthropic({ apiKey: key });
          break;
        case 'google':
          adapter = createGoogle({ apiKey: key });
          break;
        case 'deepseek':
          adapter = createDeepSeek({ apiKey: key });
          break;
        case 'moonshot':
          adapter = createMoonshot({ apiKey: key });
          break;
        case 'qwen':
          adapter = createQwen({ apiKey: key });
          break;
        case 'groq':
          adapter = createGroq({ apiKey: key });
          break;
        case 'glm':
          adapter = createGLM({ apiKey: key });
          break;
        default:
          continue;
      }
      
      core.registerProviderWithAdapter(provider, adapter as any);
    }
  }

  return {
    core,
    bridge,
    
    initialize(ipcMain: ElectronIpcMain) {
      bridge.initialize(ipcMain);
    },
    
    async destroy(ipcMain: ElectronIpcMain) {
      bridge.destroy(ipcMain);
      await core.close();
    },
    
    loadApiKeysFromSecureStorage,
  };
}

/**
 * 创建 Keytar 安全存储
 */
export function createKeytarSecureStorage(keytar: any, service: string): SecureStorage {
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
      return credentials.map((c: { account: string }) => c.account);
    },
  };
}

/**
 * 创建 electron-store 安全存储
 */
export function createElectronStoreSecureStorage(store: any): SecureStorage {
  return {
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async set(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      const has = store.has(key);
      store.delete(key);
      return has;
    },
    async list() {
      return Object.keys(store.store).filter(k => k.startsWith('apikey:'));
    },
  };
}
