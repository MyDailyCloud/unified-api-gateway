import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';
import { createElectronApp, createElectronStoreSecureStorage } from '../src/lib/ai/app/electron';

let mainWindow: BrowserWindow | null = null;
let aiAppInstance: Awaited<ReturnType<typeof createElectronApp>> | null = null;
let backendInitialized = false;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const isHealthCheck = process.argv.includes('--health-check');

// Health check results interface
interface HealthCheckResult {
  status: 'ok' | 'error';
  checks: {
    electronReady: boolean;
    backendInit: boolean;
    ipcReady: boolean;
    storageReady: boolean;
    providerRegistration: boolean;
  };
  details: {
    storage?: {
      type: string;
      testPassed: boolean;
    };
    providers?: {
      count: number;
      registered: string[];
    };
  };
  uptime: number;
  memory: NodeJS.MemoryUsage;
  version: string;
  platform: NodeJS.Platform;
  node: string;
  electron: string;
  error?: string;
}

async function initBackend(): Promise<boolean> {
  try {
    // Dynamic import for ESM-only electron-store
    const { default: Store } = await import('electron-store');
    const store = new Store({
      name: 'ai-gateway-config',
    });
    const secureStorage = createElectronStoreSecureStorage(store);

    aiAppInstance = await createElectronApp({
      userDataPath: app.getPath('userData'),
      secureStorage,
    });
    
    // Initialize IPC handlers
    aiAppInstance.initialize(ipcMain);
    
    // Load stored API keys and providers
    await aiAppInstance.loadApiKeysFromSecureStorage();
    
    backendInitialized = true;
    console.log('AI Backend initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize AI Backend:', error);
    return false;
  }
}

async function runHealthCheck(): Promise<HealthCheckResult> {
  const result: HealthCheckResult = {
    status: 'error',
    checks: {
      electronReady: false,
      backendInit: false,
      ipcReady: false,
      storageReady: false,
      providerRegistration: false,
    },
    details: {},
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: app.getVersion(),
    platform: process.platform,
    node: process.version,
    electron: process.versions.electron,
  };

  try {
    // Check Electron ready
    result.checks.electronReady = app.isReady();
    
    // Initialize backend
    const backendSuccess = await initBackend();
    result.checks.backendInit = backendSuccess;
    
    // Check IPC is ready (backend registers handlers)
    result.checks.ipcReady = backendSuccess && aiAppInstance !== null;
    
    // Check storage functionality
    if (aiAppInstance) {
      try {
        // Test storage by attempting to list stored keys
        const storedProviders = await aiAppInstance.listStoredKeyProviders();
        result.checks.storageReady = true;
        result.details.storage = {
          type: 'sqlite',
          testPassed: true,
        };
      } catch (storageError) {
        result.checks.storageReady = false;
        result.details.storage = {
          type: 'sqlite',
          testPassed: false,
        };
      }
      
      // Check provider registration
      try {
        const providers = aiAppInstance.getProviders();
        result.checks.providerRegistration = providers.length > 0;
        result.details.providers = {
          count: providers.length,
          registered: providers.map(p => p.name),
        };
      } catch (providerError) {
        result.checks.providerRegistration = false;
        result.details.providers = {
          count: 0,
          registered: [],
        };
      }
    }
    
    // Cleanup
    if (aiAppInstance) {
      await aiAppInstance.destroy(ipcMain);
    }
    
    // Determine overall status
    const allPassed = Object.values(result.checks).every(v => v === true);
    result.status = allPassed ? 'ok' : 'error';
    
    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    return result;
  }
}

async function initApp() {
  await initBackend();
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

// Health check IPC handler
ipcMain.handle('system:health-check', async () => {
  const providers = aiAppInstance?.getProviders() || [];
  return {
    status: backendInitialized ? 'ok' : 'error',
    initialized: backendInitialized,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: app.getVersion(),
    platform: process.platform,
    node: process.version,
    electron: process.versions.electron,
    storage: {
      type: 'sqlite',
      ready: backendInitialized,
    },
    providers: {
      count: providers.length,
      registered: providers.map(p => p.name),
    },
  };
});

// Version info IPC handler
ipcMain.handle('system:getVersionInfo', () => {
  return {
    app: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
  };
});

// Health status IPC handler
ipcMain.handle('system:getHealthStatus', async () => {
  const providers = aiAppInstance?.getProviders() || [];
  let storedProviders: string[] = [];
  
  try {
    storedProviders = aiAppInstance ? await aiAppInstance.listStoredKeyProviders() : [];
  } catch {
    // Ignore errors
  }
  
  return {
    initialized: backendInitialized,
    storage: backendInitialized ? {
      type: 'sqlite',
      storedKeys: storedProviders.length,
    } : null,
    providers: providers.map(p => p.name),
  };
});

// Start app based on mode
if (isHealthCheck) {
  // Health check mode: run checks and exit
  app.whenReady().then(async () => {
    console.log('Running health check...');
    const result = await runHealthCheck();
    console.log('Health Check Results:', JSON.stringify(result, null, 2));
    
    if (result.status === 'ok') {
      console.log('✅ HEALTH_CHECK_PASSED');
      app.exit(0);
    } else {
      console.log('❌ HEALTH_CHECK_FAILED');
      app.exit(1);
    }
  });
} else {
  // Normal startup
  app.whenReady().then(initApp);
}

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
