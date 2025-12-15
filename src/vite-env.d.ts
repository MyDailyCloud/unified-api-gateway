/// <reference types="vite/client" />

/* ElectronAPI types for Electron renderer process */

// Version info types
interface VersionInfo {
  app: string;
  electron: string;
  chrome: string;
  node: string;
  platform: string;
  arch: string;
}

// Health status types
interface HealthStatus {
  initialized: boolean;
  storage: {
    type: string;
    storedKeys: number;
  } | null;
  providers: string[];
}

// Full health check types
interface FullHealthCheck {
  status: 'ok' | 'error';
  initialized: boolean;
  uptime: number;
  memory: NodeJS.MemoryUsage;
  version: string;
  platform: string;
  node: string;
  electron: string;
  storage: {
    type: string;
    ready: boolean;
  };
  providers: {
    count: number;
    registered: string[];
  };
}

// Electron API type declaration for src/ files
interface ElectronAPI {
  app: {
    getVersion: () => Promise<string>;
    getPlatform: () => Promise<string>;
    getPath: (name: string) => Promise<string>;
  };
  platform: NodeJS.Platform;
  system: {
    getVersionInfo: () => Promise<VersionInfo>;
    getHealthStatus: () => Promise<HealthStatus>;
    healthCheck: () => Promise<FullHealthCheck>;
  };
  apiKeys: {
    list: () => Promise<{ providers: Array<{ provider: string; hasKey: boolean; lastUpdated?: number }> }>;
    set: (provider: string, apiKey: string) => Promise<{ success: boolean; error?: string }>;
    delete: (provider: string) => Promise<{ success: boolean; error?: string }>;
    validate: (provider: string) => Promise<{ valid: boolean; error?: string }>;
    hasKey: (provider: string) => Promise<{ hasKey: boolean }>;
  };
  chat: {
    send: (params: { provider: string; model: string; messages: any[]; conversationId?: string }) => Promise<any>;
    stream: (params: { provider: string; model: string; messages: any[]; conversationId?: string }) => Promise<string>;
    cancelStream: (streamId: string) => Promise<void>;
  };
  conversations: {
    list: () => Promise<{ conversations: any[] }>;
    create: (title?: string) => Promise<{ id: string }>;
    delete: (id: string) => Promise<{ success: boolean }>;
    getMessages: (conversationId: string) => Promise<{ messages: any[] }>;
  };
  storage: {
    getStats: () => Promise<{ conversations: number; messages: number; cacheSize: number }>;
    clearCache: () => Promise<{ success: boolean }>;
    exportData: () => Promise<{ data: any }>;
  };
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
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export {};