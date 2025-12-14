/**
 * 运行时模式检测
 * Runtime Mode Detection
 */

import type { RuntimeMode } from './types';

/**
 * 检测当前运行时模式
 */
export function detectRuntimeMode(): RuntimeMode {
  // 检查 Electron 环境
  if (typeof process !== 'undefined') {
    // @ts-ignore - Electron 特定属性
    if (process.versions?.electron) {
      return 'electron';
    }
    
    // 检查环境变量
    if (process.env?.ELECTRON_RUN_AS_NODE) {
      return 'electron';
    }
  }

  // 检查 window.electron（预加载脚本注入）
  if (typeof window !== 'undefined' && 'electron' in window) {
    return 'electron';
  }

  // 默认为 Node.js 模式
  return 'node';
}

/**
 * 是否为 Electron 模式
 */
export function isElectronMode(): boolean {
  return detectRuntimeMode() === 'electron';
}

/**
 * 是否为 Node.js 模式
 */
export function isNodeMode(): boolean {
  return detectRuntimeMode() === 'node';
}

/**
 * 获取运行时描述
 */
export function getRuntimeDescription(): string {
  const mode = detectRuntimeMode();
  return mode === 'electron' 
    ? 'Electron Desktop App (No login required)'
    : 'Node.js Server (Admin login required)';
}
