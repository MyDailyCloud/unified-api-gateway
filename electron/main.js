"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
let mainWindow = null;
const isDev = process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged;
async function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
        show: false,
        backgroundColor: '#1a1a2e',
    });
    // Load the app
    if (isDev) {
        // In development, load from Vite dev server
        await mainWindow.loadURL('http://localhost:8080');
        mainWindow.webContents.openDevTools();
    }
    else {
        // In production, load the built files
        await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
    // Handle external links
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        electron_1.shell.openExternal(url);
        return { action: 'deny' };
    });
}
// IPC Handlers
electron_1.ipcMain.handle('app:getVersion', () => {
    return electron_1.app.getVersion();
});
electron_1.ipcMain.handle('app:getPlatform', () => {
    return process.platform;
});
electron_1.ipcMain.handle('app:getPath', (_, name) => {
    return electron_1.app.getPath(name);
});
electron_1.app.whenReady().then(createWindow);
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
// Handle certificate errors in development
if (isDev) {
    electron_1.app.on('certificate-error', (event, _webContents, _url, _error, _certificate, callback) => {
        event.preventDefault();
        callback(true);
    });
}
// Security: Prevent new window creation
electron_1.app.on('web-contents-created', (_, contents) => {
    contents.on('will-navigate', (event, url) => {
        const parsedUrl = new URL(url);
        if (parsedUrl.origin !== 'http://localhost:8080' && !url.startsWith('file://')) {
            event.preventDefault();
            electron_1.shell.openExternal(url);
        }
    });
});
//# sourceMappingURL=main.js.map