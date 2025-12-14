/**
 * 应用启动器导出
 * Application Launcher Exports
 */

// Node.js 应用
export {
  createNodeApp,
  startNodeServer,
  type NodeAppConfig,
  type NodeAppInstance,
} from './node';

// Electron 应用
export {
  createElectronApp,
  createKeytarSecureStorage,
  createElectronStoreSecureStorage,
  type ElectronAppConfig,
  type ElectronAppInstance,
} from './electron';

// 重导出核心和传输层
export { createAICore, AICore } from '../core';
export { createHttpServer, createIpcMainBridge, createIpcRendererBridge } from '../transport';
