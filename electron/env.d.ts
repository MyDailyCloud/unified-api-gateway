/// <reference types="node" />

// ==================== IPC Message Types ====================

/** Chat message structure for IPC */
export interface IpcMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}

/** Chat completion response from IPC */
export interface IpcChatResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: IpcMessage;
    finish_reason: 'stop' | 'length' | 'tool_calls' | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/** Conversation structure for IPC */
export interface IpcConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

/** Health check result */
export interface IpcHealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  services: Record<string, {
    status: 'ok' | 'error';
    latency?: number;
    error?: string;
  }>;
}

/** Storage export data */
export interface IpcStorageExportData {
  version: string;
  exportedAt: number;
  conversations: IpcConversation[];
  settings: Record<string, unknown>;
}

// ==================== Electron API Interface ====================

declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    ELECTRON?: string;
  }
}

/** Electron API exposed to renderer */
interface ElectronAPI {
  app: {
    getVersion: () => Promise<string>;
    getPlatform: () => Promise<string>;
    getPath: (name: string) => Promise<string>;
  };
  platform: NodeJS.Platform;
  system: {
    getVersionInfo: () => Promise<{
      app: string;
      electron: string;
      chrome: string;
      node: string;
      platform: string;
      arch: string;
    }>;
    getHealthStatus: () => Promise<{
      initialized: boolean;
      storage: { type: string; storedKeys: number } | null;
      providers: string[];
    }>;
    healthCheck: () => Promise<IpcHealthCheckResult>;
  };
  apiKeys: {
    list: () => Promise<{ providers: Array<{ provider: string; hasKey: boolean; lastUpdated?: number }> }>;
    set: (provider: string, apiKey: string) => Promise<{ success: boolean; error?: string }>;
    delete: (provider: string) => Promise<{ success: boolean; error?: string }>;
    validate: (provider: string) => Promise<{ valid: boolean; error?: string }>;
    hasKey: (provider: string) => Promise<{ hasKey: boolean }>;
  };
  chat: {
    send: (params: { provider: string; model: string; messages: IpcMessage[]; conversationId?: string }) => Promise<IpcChatResponse>;
    stream: (params: { provider: string; model: string; messages: IpcMessage[]; conversationId?: string }) => Promise<string>;
    cancelStream: (streamId: string) => Promise<void>;
  };
  conversations: {
    list: () => Promise<{ conversations: IpcConversation[] }>;
    create: (title?: string) => Promise<{ id: string }>;
    delete: (id: string) => Promise<{ success: boolean }>;
    getMessages: (conversationId: string) => Promise<{ messages: IpcMessage[] }>;
  };
  storage: {
    getStats: () => Promise<{ conversations: number; messages: number; cacheSize: number }>;
    clearCache: () => Promise<{ success: boolean }>;
    exportData: () => Promise<{ data: IpcStorageExportData }>;
  };
  ipc: {
    send: (channel: string, ...args: unknown[]) => void;
    invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>;
    on: (channel: string, callback: (...args: unknown[]) => void) => void;
    once: (channel: string, callback: (...args: unknown[]) => void) => void;
    removeListener: (channel: string, callback: (...args: unknown[]) => void) => void;
    removeAllListeners: (channel: string) => void;
  };
  /** AI module - dynamically loaded */
  ai?: {
    chat: (request: unknown) => Promise<unknown>;
    stream: (request: unknown) => AsyncIterable<unknown>;
  };
  /** Raw IPC renderer - for advanced usage */
  ipcRenderer?: {
    send: (channel: string, ...args: unknown[]) => void;
    invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>;
    on: (channel: string, listener: (event: unknown, ...args: unknown[]) => void) => void;
  };
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export { };

