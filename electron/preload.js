"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Expose protected methods to the renderer process
electron_1.contextBridge.exposeInMainWorld('electron', {
    // Application info
    app: {
        getVersion: () => electron_1.ipcRenderer.invoke('app:getVersion'),
        getPlatform: () => electron_1.ipcRenderer.invoke('app:getPlatform'),
        getPath: (name) => electron_1.ipcRenderer.invoke('app:getPath', name),
    },
    // Platform info
    platform: process.platform,
    // IPC communication
    ipc: {
        send: (channel, ...args) => {
            electron_1.ipcRenderer.send(channel, ...args);
        },
        invoke: (channel, ...args) => {
            return electron_1.ipcRenderer.invoke(channel, ...args);
        },
        on: (channel, callback) => {
            electron_1.ipcRenderer.on(channel, (_event, ...args) => callback(...args));
        },
        once: (channel, callback) => {
            electron_1.ipcRenderer.once(channel, (_event, ...args) => callback(...args));
        },
        removeListener: (channel, callback) => {
            electron_1.ipcRenderer.removeListener(channel, callback);
        },
        removeAllListeners: (channel) => {
            electron_1.ipcRenderer.removeAllListeners(channel);
        },
    },
});
// Type declarations for the exposed API
// See electron/env.d.ts for the Window interface definition
// Notify that preload script has loaded
console.log('Preload script loaded');
//# sourceMappingURL=preload.js.map