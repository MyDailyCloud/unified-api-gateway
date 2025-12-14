/**
 * Electron Main Process Example
 * Electron 主进程示例 - 展示如何在 Electron 主进程中集成 AI SDK
 * 
 * 使用方法：
 * 1. 复制此文件到你的 Electron 项目的主进程目录
 * 2. 安装依赖: npm install electron electron-store keytar
 * 3. 在你的 main.ts 中导入并使用
 * 
 * 注意: 这是示例代码，需要在 Electron 项目中使用
 * 直接在 Vite/React 项目中会有类型错误，这是正常的
 */

// ============================================
// 类型定义 (用于示例展示)
// ============================================

// Electron 模块类型 (实际使用时从 'electron' 导入)
interface IpcMain {
  handle(channel: string, listener: (event: unknown, ...args: unknown[]) => unknown): void;
  removeHandler(channel: string): void;
}

interface BrowserWindow {
  loadURL(url: string): Promise<void>;
  loadFile(path: string): Promise<void>;
  webContents: { openDevTools(): void };
  on(event: string, listener: () => void): void;
}

interface App {
  whenReady(): Promise<void>;
  on(event: string, listener: () => void): void;
  quit(): void;
  getVersion(): string;
}

// ============================================
// 示例代码 - 复制到你的 Electron 项目使用
// ============================================

/*
// ============================================
// 完整示例代码 - 可直接复制使用
// ============================================

import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import Store from 'electron-store';

// 导入 AI SDK Electron 模块
import {
  createMainBridge,
  createElectronStoreStorage,
  // createKeytarStorage, // 如需系统级安全存储
  type MainBridgeConfig,
} from '@ai-sdk/electron';

// ============================================
// 1. 配置安全存储
// ============================================

// 方式 A: 使用 electron-store (简单，数据存储在用户目录)
const store = new Store({
  name: 'ai-sdk-config',
  encryptionKey: 'your-encryption-key', // 可选：加密存储
});

const secureStorage = createElectronStoreStorage(store);

// 方式 B: 使用 keytar (更安全，使用系统密钥链)
// import keytar from 'keytar';
// const secureStorage = createKeytarStorage(keytar, 'your-app-name');

// ============================================
// 2. 创建 AI Bridge
// ============================================

const bridgeConfig: MainBridgeConfig = {
  secureStorage,
  defaultProvider: 'openai',
};

const aiBridge = createMainBridge(bridgeConfig);

// ============================================
// 3. 预注册提供商 (可选)
// ============================================

async function loadStoredProviders() {
  try {
    await aiBridge.loadProvidersFromStorage([
      { provider: 'openai', defaultModel: 'gpt-4' },
      { provider: 'anthropic', defaultModel: 'claude-3-opus-20240229' },
      { provider: 'ollama', baseUrl: 'http://localhost:11434' },
    ]);
    console.log('Loaded stored providers');
  } catch (error) {
    console.log('No stored providers found');
  }
}

// ============================================
// 4. 创建窗口
// ============================================

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ============================================
// 5. 应用生命周期
// ============================================

app.whenReady().then(async () => {
  aiBridge.initialize(ipcMain);
  console.log('AI Bridge initialized');

  await loadStoredProviders();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  aiBridge.destroy(ipcMain);
});

// ============================================
// 6. 额外的 IPC 处理器示例
// ============================================

ipcMain.handle('app:getInfo', () => ({
  version: app.getVersion(),
  platform: process.platform,
  arch: process.arch,
}));

ipcMain.handle('app:openExternal', async (_event, url: string) => {
  await shell.openExternal(url);
});

*/

// ============================================
// 导出类型供文档使用
// ============================================

export interface MainProcessExample {
  description: string;
}

export const example: MainProcessExample = {
  description: 'Copy the commented code above to your Electron main process file',
};
