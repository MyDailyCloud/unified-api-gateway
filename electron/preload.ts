import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../src/lib/ai/transport/ipc/channels';

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  // AI Service Methods
  ai: {
    chatCompletion: (args: unknown) => 
      ipcRenderer.invoke(IPC_CHANNELS.AI.CHAT_COMPLETION, args),
    listModels: (args: unknown) => 
      ipcRenderer.invoke(IPC_CHANNELS.AI.LIST_MODELS, args),
  },

  // Internal Service Methods
  internal: {
    chat: (args: unknown) => 
      ipcRenderer.invoke(IPC_CHANNELS.INTERNAL.CHAT, args),
    listConversations: () => 
      ipcRenderer.invoke(IPC_CHANNELS.INTERNAL.LIST_CONVERSATIONS),
    getConversation: (args: unknown) => 
      ipcRenderer.invoke(IPC_CHANNELS.INTERNAL.GET_CONVERSATION, args),
    deleteConversation: (args: unknown) => 
      ipcRenderer.invoke(IPC_CHANNELS.INTERNAL.DELETE_CONVERSATION, args),
    listProviders: () => 
      ipcRenderer.invoke(IPC_CHANNELS.INTERNAL.LIST_PROVIDERS),
    getApiKeyStatus: (args: unknown) => 
      ipcRenderer.invoke(IPC_CHANNELS.INTERNAL.GET_API_KEY_STATUS, args),
    setApiKey: (args: unknown) => 
      ipcRenderer.invoke(IPC_CHANNELS.INTERNAL.SET_API_KEY, args),
    deleteApiKey: (args: unknown) => 
      ipcRenderer.invoke(IPC_CHANNELS.INTERNAL.DELETE_API_KEY, args),
    getStats: () => 
      ipcRenderer.invoke(IPC_CHANNELS.INTERNAL.GET_STATS),
  },

  // System Methods
  system: {
    health: () => 
      ipcRenderer.invoke(IPC_CHANNELS.SYSTEM.HEALTH),
    version: () => 
      ipcRenderer.invoke(IPC_CHANNELS.SYSTEM.VERSION),
  },

  // Platform info
  platform: process.platform,
  
  // IPC utilities
  ipc: {
    send: (channel: string, data: unknown) => {
      ipcRenderer.send(channel, data);
    },
    on: (channel: string, callback: (...args: unknown[]) => void) => {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    },
    once: (channel: string, callback: (...args: unknown[]) => void) => {
      ipcRenderer.once(channel, (_event, ...args) => callback(...args));
    },
    removeListener: (channel: string, callback: (...args: unknown[]) => void) => {
      ipcRenderer.removeListener(channel, callback);
    },
  },
});

// Notify that preload script has loaded
console.log('Preload script loaded');
