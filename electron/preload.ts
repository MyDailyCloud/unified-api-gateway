import { contextBridge, ipcRenderer } from 'electron';
import type { IpcMessage } from './env';

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electron', {
  // Application info
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
    getPath: (name: string) => ipcRenderer.invoke('app:getPath', name),
  },

  // Platform info
  platform: process.platform,

  // System info
  system: {
    getVersionInfo: () => ipcRenderer.invoke('system:getVersionInfo'),
    getHealthStatus: () => ipcRenderer.invoke('system:getHealthStatus'),
    healthCheck: () => ipcRenderer.invoke('system:health-check'),
  },

  // API Keys management
  apiKeys: {
    list: () => ipcRenderer.invoke('apiKeys:list'),
    set: (provider: string, apiKey: string) =>
      ipcRenderer.invoke('apiKeys:set', { provider, apiKey }),
    delete: (provider: string) =>
      ipcRenderer.invoke('apiKeys:delete', { provider }),
    validate: (provider: string) =>
      ipcRenderer.invoke('apiKeys:validate', { provider }),
    hasKey: (provider: string) =>
      ipcRenderer.invoke('apiKeys:get', { provider }),
  },

  // Chat with streaming support
  chat: {
    send: (params: { provider: string; model: string; messages: IpcMessage[]; conversationId?: string }) =>
      ipcRenderer.invoke('chat:send', params),
    stream: (params: { provider: string; model: string; messages: IpcMessage[]; conversationId?: string }) =>
      ipcRenderer.invoke('chat:stream', params),
    cancelStream: (streamId: string) =>
      ipcRenderer.invoke('chat:cancelStream', streamId),
  },

  // Conversations management
  conversations: {
    list: () => ipcRenderer.invoke('conversations:list'),
    create: (title?: string) => ipcRenderer.invoke('conversations:create', { title }),
    delete: (id: string) => ipcRenderer.invoke('conversations:delete', { id }),
    getMessages: (conversationId: string) => ipcRenderer.invoke('conversations:getMessages', { conversationId }),
  },

  // Storage management
  storage: {
    getStats: () => ipcRenderer.invoke('storage:getStats'),
    clearCache: () => ipcRenderer.invoke('storage:clearCache'),
    exportData: () => ipcRenderer.invoke('storage:exportData'),
  },

  // IPC communication
  ipc: {
    send: (channel: string, ...args: unknown[]) => {
      ipcRenderer.send(channel, ...args);
    },
    invoke: <T = unknown>(channel: string, ...args: unknown[]): Promise<T> => {
      return ipcRenderer.invoke(channel, ...args);
    },
    on: (channel: string, callback: (...args: unknown[]) => void) => {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    },
    once: (channel: string, callback: (...args: unknown[]) => void) => {
      ipcRenderer.once(channel, (_event, ...args) => callback(...args));
    },
    removeListener: (channel: string, callback: (...args: unknown[]) => void) => {
      ipcRenderer.removeListener(channel, callback as Parameters<typeof ipcRenderer.removeListener>[1]);
    },
    removeAllListeners: (channel: string) => {
      ipcRenderer.removeAllListeners(channel);
    },
  },
});

// Notify that preload script has loaded
console.log('Preload script loaded');

