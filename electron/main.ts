import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';
import { createElectronApp, createElectronStoreSecureStorage } from '../src/lib/ai/app/electron';

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

async function initApp() {
  // Initialize AI Backend
  try {
    // Dynamic import for ESM-only electron-store
    const { default: Store } = await import('electron-store');
    const store = new Store({
      name: 'ai-gateway-config',
    });
    const secureStorage = createElectronStoreSecureStorage(store);

    const aiApp = await createElectronApp({
      userDataPath: app.getPath('userData'),
      secureStorage,
    });
    
    // Initialize IPC handlers
    aiApp.initialize(ipcMain);
    
    // Load stored API keys and providers
    await aiApp.loadApiKeysFromSecureStorage();
    
    console.log('AI Backend initialized successfully');
  } catch (error) {
    console.error('Failed to initialize AI Backend:', error);
  }

  createWindow();
}

async function createWindow() {
  mainWindow = new BrowserWindow({
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
    show: true,
    backgroundColor: '#1a1a2e',
  });

  // Load the app
  if (isDev) {
    // In development, load from Vite dev server
    await mainWindow.loadURL('http://localhost:8080');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files
    // Note: When running from dist-electron/electron/main.js, the renderer is at ../../dist/index.html
    await mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// IPC Handlers
ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

ipcMain.handle('app:getPlatform', () => {
  return process.platform;
});

ipcMain.handle('app:getPath', (_, name: string) => {
  return app.getPath(name as any);
});

app.whenReady().then(initApp);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle certificate errors in development
if (isDev) {
  app.on('certificate-error', (event, _webContents, _url, _error, _certificate, callback) => {
    event.preventDefault();
    callback(true);
  });
}

// Security: Prevent new window creation
app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url);
    if (parsedUrl.origin !== 'http://localhost:8080' && !url.startsWith('file://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
});
