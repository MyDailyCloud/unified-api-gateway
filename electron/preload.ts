import { contextBridge, ipcRenderer } from 'electron';

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
  
  // IPC communication
  ipc: {
    send: (channel: string, ...args: any[]) => {
      ipcRenderer.send(channel, ...args);
    },
    invoke: (channel: string, ...args: any[]) => {
      return ipcRenderer.invoke(channel, ...args);
    },
    on: (channel: string, callback: (...args: any[]) => void) => {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    },
    once: (channel: string, callback: (...args: any[]) => void) => {
      ipcRenderer.once(channel, (_event, ...args) => callback(...args));
    },
    removeListener: (channel: string, callback: (...args: any[]) => void) => {
      ipcRenderer.removeListener(channel, callback);
    },
    removeAllListeners: (channel: string) => {
      ipcRenderer.removeAllListeners(channel);
    },
  },
});

// Type declarations for the exposed API
declare global {
  interface Window {
    electron: {
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
    };
  }
}

// Notify that preload script has loaded
console.log('Preload script loaded');
