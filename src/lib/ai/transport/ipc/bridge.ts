/**
 * IPC 桥接 - Electron 主进程
 * IPC Bridge - Electron Main Process
 */

import type { AICore } from '../../core';
import type { AIProvider } from '../../types';
import {
  IPC_CHANNELS,
  type AIChatCompletionArgs,
  type InternalChatArgs,
  type ListConversationsArgs,
  type GetConversationArgs,
  type DeleteConversationArgs,
  type SetApiKeyArgs,
  type DeleteApiKeyArgs,
} from './channels';

// Electron IPC 类型
interface ElectronIpcMain {
  handle(channel: string, listener: (event: any, ...args: any[]) => Promise<any> | any): void;
  removeHandler(channel: string): void;
}

interface ElectronIpcRenderer {
  invoke(channel: string, ...args: any[]): Promise<any>;
  on(channel: string, listener: (event: any, ...args: any[]) => void): void;
  removeAllListeners(channel: string): void;
}

export interface IpcBridgeConfig {
  /** 启用详细日志 */
  debug?: boolean;
}

/**
 * IPC 桥接 - 主进程端
 */
export class IpcMainBridge {
  private core: AICore;
  private config: IpcBridgeConfig;
  private registeredHandlers: string[] = [];

  constructor(core: AICore, config: IpcBridgeConfig = {}) {
    this.core = core;
    this.config = config;
  }

  /**
   * 初始化 IPC 处理器
   */
  initialize(ipcMain: ElectronIpcMain) {
    // AI 服务
    this.registerHandler(ipcMain, IPC_CHANNELS.AI.CHAT_COMPLETION, this.handleChatCompletion.bind(this));
    this.registerHandler(ipcMain, IPC_CHANNELS.AI.LIST_MODELS, this.handleListModels.bind(this));

    // 内部服务
    this.registerHandler(ipcMain, IPC_CHANNELS.INTERNAL.CHAT, this.handleInternalChat.bind(this));
    this.registerHandler(ipcMain, IPC_CHANNELS.INTERNAL.LIST_CONVERSATIONS, this.handleListConversations.bind(this));
    this.registerHandler(ipcMain, IPC_CHANNELS.INTERNAL.GET_CONVERSATION, this.handleGetConversation.bind(this));
    this.registerHandler(ipcMain, IPC_CHANNELS.INTERNAL.DELETE_CONVERSATION, this.handleDeleteConversation.bind(this));
    this.registerHandler(ipcMain, IPC_CHANNELS.INTERNAL.GET_MESSAGES, this.handleGetMessages.bind(this));
    this.registerHandler(ipcMain, IPC_CHANNELS.INTERNAL.LIST_PROVIDERS, this.handleListProviders.bind(this));
    this.registerHandler(ipcMain, IPC_CHANNELS.INTERNAL.SET_API_KEY, this.handleSetApiKey.bind(this));
    this.registerHandler(ipcMain, IPC_CHANNELS.INTERNAL.DELETE_API_KEY, this.handleDeleteApiKey.bind(this));
    this.registerHandler(ipcMain, IPC_CHANNELS.INTERNAL.GET_STATS, this.handleGetStats.bind(this));

    // 系统
    this.registerHandler(ipcMain, IPC_CHANNELS.SYSTEM.HEALTH, this.handleHealth.bind(this));
    this.registerHandler(ipcMain, IPC_CHANNELS.SYSTEM.VERSION, this.handleVersion.bind(this));

    if (this.config.debug) {
      console.log('[IpcMainBridge] Initialized with handlers:', this.registeredHandlers);
    }
  }

  /**
   * 销毁 IPC 处理器
   */
  destroy(ipcMain: ElectronIpcMain) {
    for (const channel of this.registeredHandlers) {
      ipcMain.removeHandler(channel);
    }
    this.registeredHandlers = [];
  }

  private registerHandler(
    ipcMain: ElectronIpcMain,
    channel: string,
    handler: (args: any) => Promise<any>
  ) {
    ipcMain.handle(channel, async (event, args) => {
      try {
        if (this.config.debug) {
          console.log(`[IPC] ${channel}`, args);
        }
        return await handler(args);
      } catch (error) {
        console.error(`[IPC Error] ${channel}:`, error);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });
    this.registeredHandlers.push(channel);
  }

  // AI 服务处理器
  private async handleChatCompletion(args: AIChatCompletionArgs) {
    const response = await this.core.ai.chatCompletion(args.request);
    return { response };
  }

  private async handleListModels() {
    const result = await this.core.ai.listModels();
    return { models: result.data };
  }

  // 内部服务处理器
  private async handleInternalChat(args: InternalChatArgs) {
    const response = await this.core.internal.chat(args.request);
    return { response };
  }

  private async handleListConversations(args: ListConversationsArgs) {
    const conversations = await this.core.internal.listConversations(args);
    return { conversations };
  }

  private async handleGetConversation(args: GetConversationArgs) {
    const messages = await this.core.internal.getConversationMessages(args.id);
    return { messages };
  }

  private async handleDeleteConversation(args: DeleteConversationArgs) {
    const success = await this.core.internal.deleteConversation(args.id);
    return { success };
  }

  private async handleGetMessages(args: GetConversationArgs) {
    const messages = await this.core.internal.getConversationMessages(args.id);
    return { messages };
  }

  private async handleListProviders() {
    const providers = await this.core.internal.listProviders();
    return { providers };
  }

  private async handleSetApiKey(args: SetApiKeyArgs) {
    await this.core.internal.setApiKey(args.provider, args.apiKey);
    return { success: true };
  }

  private async handleDeleteApiKey(args: DeleteApiKeyArgs) {
    const success = await this.core.internal.deleteApiKey(args.provider);
    return { success };
  }

  private async handleGetStats() {
    const stats = await this.core.internal.getStats();
    return { stats };
  }

  // 系统处理器
  private async handleHealth() {
    return { status: 'ok', uptime: Date.now() };
  }

  private async handleVersion() {
    return { version: '1.0.0', platform: 'electron' };
  }
}

/**
 * IPC 桥接 - 渲染进程端
 */
export class IpcRendererBridge {
  private ipcRenderer: ElectronIpcRenderer;

  constructor(ipcRenderer: ElectronIpcRenderer) {
    this.ipcRenderer = ipcRenderer;
  }

  // AI 服务
  async chatCompletion(request: AIChatCompletionArgs['request']) {
    const result = await this.ipcRenderer.invoke(IPC_CHANNELS.AI.CHAT_COMPLETION, { request });
    if (result.error) throw new Error(result.error);
    return result.response;
  }

  async listModels() {
    const result = await this.ipcRenderer.invoke(IPC_CHANNELS.AI.LIST_MODELS);
    if (result.error) throw new Error(result.error);
    return result.models;
  }

  // 内部服务
  async chat(request: InternalChatArgs['request']) {
    const result = await this.ipcRenderer.invoke(IPC_CHANNELS.INTERNAL.CHAT, { request });
    if (result.error) throw new Error(result.error);
    return result.response;
  }

  async listConversations(options?: ListConversationsArgs) {
    const result = await this.ipcRenderer.invoke(IPC_CHANNELS.INTERNAL.LIST_CONVERSATIONS, options ?? {});
    if (result.error) throw new Error(result.error);
    return result.conversations;
  }

  async getConversation(id: string) {
    const result = await this.ipcRenderer.invoke(IPC_CHANNELS.INTERNAL.GET_CONVERSATION, { id });
    if (result.error) throw new Error(result.error);
    return result.messages;
  }

  async deleteConversation(id: string) {
    const result = await this.ipcRenderer.invoke(IPC_CHANNELS.INTERNAL.DELETE_CONVERSATION, { id });
    if (result.error) throw new Error(result.error);
    return result.success;
  }

  async listProviders() {
    const result = await this.ipcRenderer.invoke(IPC_CHANNELS.INTERNAL.LIST_PROVIDERS);
    if (result.error) throw new Error(result.error);
    return result.providers;
  }

  async setApiKey(provider: AIProvider, apiKey: string) {
    const result = await this.ipcRenderer.invoke(IPC_CHANNELS.INTERNAL.SET_API_KEY, { provider, apiKey });
    if (result.error) throw new Error(result.error);
    return result.success;
  }

  async deleteApiKey(provider: AIProvider) {
    const result = await this.ipcRenderer.invoke(IPC_CHANNELS.INTERNAL.DELETE_API_KEY, { provider });
    if (result.error) throw new Error(result.error);
    return result.success;
  }

  async getStats() {
    const result = await this.ipcRenderer.invoke(IPC_CHANNELS.INTERNAL.GET_STATS);
    if (result.error) throw new Error(result.error);
    return result.stats;
  }

  // 系统
  async health() {
    return this.ipcRenderer.invoke(IPC_CHANNELS.SYSTEM.HEALTH);
  }

  async version() {
    return this.ipcRenderer.invoke(IPC_CHANNELS.SYSTEM.VERSION);
  }
}

/**
 * 创建主进程桥接
 */
export function createIpcMainBridge(core: AICore, config?: IpcBridgeConfig): IpcMainBridge {
  return new IpcMainBridge(core, config);
}

/**
 * 创建渲染进程桥接
 */
export function createIpcRendererBridge(ipcRenderer: ElectronIpcRenderer): IpcRendererBridge {
  return new IpcRendererBridge(ipcRenderer);
}
