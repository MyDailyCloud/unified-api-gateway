import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { createElectronApp, createElectronStoreSecureStorage } from '../src/lib/ai/app/electron';

let mainWindow: BrowserWindow | null = null;
let electronApp: Awaited<ReturnType<typeof createElectronApp>> | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

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
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  // Initialize AI SDK Electron App
  try {
    const secureStorage = createElectronStoreSecureStorage('ai-sdk-keys');
    
    electronApp = await createElectronApp({
      ipcMain,
      secureStorage,
      userDataPath: app.getPath('userData'),
    });

    await electronApp.initialize();
    console.log('AI SDK Electron App initialized');
  } catch (error) {
    console.error('Failed to initialize AI SDK:', error);
  }

  // Load the app
  if (isDev) {
    // In development, load from Vite dev server
    await mainWindow.loadURL('http://localhost:8080');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files
    await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', async () => {
  if (electronApp) {
    await electronApp.destroy();
  }
  
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
  app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    event.preventDefault();
    callback(true);
  });
}
