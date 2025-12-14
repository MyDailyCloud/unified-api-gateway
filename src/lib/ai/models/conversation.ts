/**
 * 对话数据模型
 * Conversation Data Model
 */

import type { AIProvider } from '../types';
import type { UnifiedStorage } from '../storage/types';
import type { Message } from './message';

// ==================== 对话类型定义 ====================

export interface Conversation {
  id: string;
  title: string;
  model: string;
  provider: AIProvider;
  createdAt: number;
  updatedAt: number;
  folderId?: string;
  tags?: string[];
  parameters?: ConversationParameters;
  systemPrompt?: string;
  pinned?: boolean;
  archived?: boolean;
}

export interface ConversationParameters {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[];
}

export interface ConversationFolder {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  parentId?: string;
}

// ==================== 对话存储键 ====================

const CONVERSATION_PREFIX = 'conv:';
const FOLDER_PREFIX = 'folder:';

// ==================== 对话管理器 ====================

export class ConversationManager {
  constructor(private storage: UnifiedStorage) {}

  /**
   * 创建新对话
   */
  async create(data: Omit<Conversation, 'id' | 'createdAt' | 'updatedAt'>): Promise<Conversation> {
    const now = Date.now();
    const conversation: Conversation = {
      id: generateConversationId(),
      createdAt: now,
      updatedAt: now,
      ...data,
    };
    
    await this.storage.set(`${CONVERSATION_PREFIX}${conversation.id}`, conversation);
    return conversation;
  }

  /**
   * 获取对话
   */
  async get(id: string): Promise<Conversation | null> {
    return this.storage.get<Conversation>(`${CONVERSATION_PREFIX}${id}`);
  }

  /**
   * 更新对话
   */
  async update(id: string, data: Partial<Conversation>): Promise<Conversation | null> {
    const existing = await this.get(id);
    if (!existing) return null;
    
    const updated: Conversation = {
      ...existing,
      ...data,
      id: existing.id, // 确保 ID 不变
      createdAt: existing.createdAt, // 确保创建时间不变
      updatedAt: Date.now(),
    };
    
    await this.storage.set(`${CONVERSATION_PREFIX}${id}`, updated);
    return updated;
  }

  /**
   * 删除对话
   */
  async delete(id: string): Promise<boolean> {
    return this.storage.delete(`${CONVERSATION_PREFIX}${id}`);
  }

  /**
   * 列出所有对话
   */
  async list(options?: {
    folderId?: string;
    archived?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Conversation[]> {
    const all = await this.storage.list<Conversation>(CONVERSATION_PREFIX);
    
    let filtered = all;
    
    if (options?.folderId !== undefined) {
      filtered = filtered.filter(c => c.folderId === options.folderId);
    }
    
    if (options?.archived !== undefined) {
      filtered = filtered.filter(c => c.archived === options.archived);
    }
    
    // 按更新时间排序
    filtered.sort((a, b) => b.updatedAt - a.updatedAt);
    
    // 分页
    if (options?.offset) {
      filtered = filtered.slice(options.offset);
    }
    if (options?.limit) {
      filtered = filtered.slice(0, options.limit);
    }
    
    return filtered;
  }

  /**
   * 搜索对话
   */
  async search(query: string): Promise<Conversation[]> {
    const all = await this.storage.list<Conversation>(CONVERSATION_PREFIX);
    const lowerQuery = query.toLowerCase();
    
    return all.filter(c => 
      c.title.toLowerCase().includes(lowerQuery) ||
      c.tags?.some(t => t.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * 更新标题（自动生成）
   */
  async updateTitle(id: string, firstMessage: string): Promise<Conversation | null> {
    // 简单的标题生成：取前 50 个字符
    const title = firstMessage.slice(0, 50) + (firstMessage.length > 50 ? '...' : '');
    return this.update(id, { title });
  }

  /**
   * 固定/取消固定对话
   */
  async togglePin(id: string): Promise<Conversation | null> {
    const existing = await this.get(id);
    if (!existing) return null;
    return this.update(id, { pinned: !existing.pinned });
  }

  /**
   * 归档/取消归档对话
   */
  async toggleArchive(id: string): Promise<Conversation | null> {
    const existing = await this.get(id);
    if (!existing) return null;
    return this.update(id, { archived: !existing.archived });
  }
}

// ==================== 文件夹管理器 ====================

export class FolderManager {
  constructor(private storage: UnifiedStorage) {}

  async create(data: Omit<ConversationFolder, 'id' | 'createdAt' | 'updatedAt'>): Promise<ConversationFolder> {
    const now = Date.now();
    const folder: ConversationFolder = {
      id: generateFolderId(),
      createdAt: now,
      updatedAt: now,
      ...data,
    };
    
    await this.storage.set(`${FOLDER_PREFIX}${folder.id}`, folder);
    return folder;
  }

  async get(id: string): Promise<ConversationFolder | null> {
    return this.storage.get<ConversationFolder>(`${FOLDER_PREFIX}${id}`);
  }

  async update(id: string, data: Partial<ConversationFolder>): Promise<ConversationFolder | null> {
    const existing = await this.get(id);
    if (!existing) return null;
    
    const updated: ConversationFolder = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: Date.now(),
    };
    
    await this.storage.set(`${FOLDER_PREFIX}${id}`, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.storage.delete(`${FOLDER_PREFIX}${id}`);
  }

  async list(): Promise<ConversationFolder[]> {
    const all = await this.storage.list<ConversationFolder>(FOLDER_PREFIX);
    return all.sort((a, b) => a.name.localeCompare(b.name));
  }
}

// ==================== 工具函数 ====================

function generateConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function generateFolderId(): string {
  return `folder_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * 创建对话管理器
 */
export function createConversationManager(storage: UnifiedStorage): ConversationManager {
  return new ConversationManager(storage);
}

/**
 * 创建文件夹管理器
 */
export function createFolderManager(storage: UnifiedStorage): FolderManager {
  return new FolderManager(storage);
}
