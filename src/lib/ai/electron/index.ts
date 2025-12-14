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
