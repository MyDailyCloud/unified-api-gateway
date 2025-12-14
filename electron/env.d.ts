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
    send: (channel: string, ...args: any[]) => void;
    invoke: (channel: string, ...args: any[]) => Promise<any>;
    on: (channel: string, callback: (...args: any[]) => void) => void;
    once: (channel: string, callback: (...args: any[]) => void) => void;
    removeListener: (channel: string, callback: (...args: any[]) => void) => void;
    removeAllListeners: (channel: string) => void;
  };
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export {};
