/// <reference types="vite/client" />

interface ElectronAPI {
  ai: {
    chatCompletion: (args: unknown) => Promise<unknown>;
    listModels: (args: unknown) => Promise<unknown>;
  };
  internal: {
    chat: (args: unknown) => Promise<unknown>;
    listConversations: () => Promise<unknown>;
    getConversation: (args: unknown) => Promise<unknown>;
    deleteConversation: (args: unknown) => Promise<unknown>;
    listProviders: () => Promise<unknown>;
    getApiKeyStatus: (args: unknown) => Promise<unknown>;
    setApiKey: (args: unknown) => Promise<unknown>;
    deleteApiKey: (args: unknown) => Promise<unknown>;
    getStats: () => Promise<unknown>;
  };
  system: {
    health: () => Promise<unknown>;
    version: () => Promise<unknown>;
  };
  platform: NodeJS.Platform;
  ipc: {
    send: (channel: string, data: unknown) => void;
    on: (channel: string, callback: (...args: unknown[]) => void) => void;
    once: (channel: string, callback: (...args: unknown[]) => void) => void;
    removeListener: (channel: string, callback: (...args: unknown[]) => void) => void;
  };
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export {};
