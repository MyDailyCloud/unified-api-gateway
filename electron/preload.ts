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
// See electron/env.d.ts for the Window interface definition

// Notify that preload script has loaded
console.log('Preload script loaded');
