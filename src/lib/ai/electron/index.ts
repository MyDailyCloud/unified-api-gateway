/**
 * Electron AI 模块导出
 * Electron AI Module Exports
 */

export {
  AI_IPC_CHANNELS,
  ElectronAIClient,
  isElectronRenderer,
  getElectronAIClient,
  createElectronAIClient,
  type ElectronAIBridge,
  type ElectronIpcRenderer,
  type IPCChatRequest,
  type IPCChatResponse,
  type IPCStreamChunk,
  type IPCProviderConfig,
  type IPCKeyStorageRequest,
} from './ipc-adapter';

export {
  initPreloadAI,
  type PreloadAIAPI,
} from './preload';

export {
  ElectronMainBridge,
  MemorySecureStorage,
  createMainBridge,
  createElectronStoreStorage,
  createKeytarStorage,
  type SecureStorage,
  type MainBridgeConfig,
  type ElectronIpcMain,
  type ElectronIpcMainEvent,
} from './main-bridge';

// 示例代码
export {
  mainExample,
  preloadExample,
  exampleDescription,
  type MainProcessExample,
  type PreloadExample,
} from './example';
