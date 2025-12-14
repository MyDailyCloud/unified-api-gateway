/// <reference types="node" />

declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    ELECTRON?: string;
  }
}

// Electron API exposed to renderer
interface ElectronAPI {
  app: {
    getVersion: () => Promise<string>;
    getPlatform: () => Promise<string>;
    getPath: (name: string) => Promise<string>;
  };
  platform: NodeJS.Platform;
  ipc: {
    send: (channel: string, ...args: unknown[]) => void;
    invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
    on: (channel: string, callback: (...args: unknown[]) => void) => void;
    once: (channel: string, callback: (...args: unknown[]) => void) => void;
    removeListener: (channel: string, callback: (...args: unknown[]) => void) => void;
    removeAllListeners: (channel: string) => void;
  };
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export {};
