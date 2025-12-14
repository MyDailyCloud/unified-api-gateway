/**
 * 消息数据模型
 * Message Data Model
 */

import type { UnifiedStorage } from '../storage/types';
import type { MessageRole, ToolCall } from '../types';

// ==================== 消息类型定义 ====================

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  model?: string;
  tokenCount?: number;
  toolCalls?: ToolCall[];
  parentId?: string;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  /** 生成耗时（毫秒） */
  latency?: number;
  /** 提供商 */
  provider?: string;
  /** 是否编辑过 */
  edited?: boolean;
  /** 原始内容（编辑前） */
  originalContent?: string;
  /** 附件 */
  attachments?: MessageAttachment[];
}

export interface MessageAttachment {
  type: 'image' | 'file' | 'audio' | 'video';
  url: string;
  name?: string;
  mimeType?: string;
  size?: number;
}

// ==================== 消息存储键 ====================

const MESSAGE_PREFIX = 'msg:';
const MESSAGE_INDEX_PREFIX = 'msg_idx:';

// ==================== 消息管理器 ====================

export class MessageManager {
  constructor(private storage: UnifiedStorage) {}

  /**
   * 添加消息
   */
  async add(data: Omit<Message, 'id' | 'createdAt'>): Promise<Message> {
    const message: Message = {
      id: generateMessageId(),
      createdAt: Date.now(),
      ...data,
    };
    
    await this.storage.set(`${MESSAGE_PREFIX}${message.id}`, message);
    
    // 更新对话索引
    await this.addToIndex(message.conversationId, message.id);
    
    return message;
  }

  /**
   * 获取消息
   */
  async get(id: string): Promise<Message | null> {
    return this.storage.get<Message>(`${MESSAGE_PREFIX}${id}`);
  }

  /**
   * 更新消息
   */
  async update(id: string, data: Partial<Message>): Promise<Message | null> {
    const existing = await this.get(id);
    if (!existing) return null;
    
    const updated: Message = {
      ...existing,
      ...data,
      id: existing.id,
      conversationId: existing.conversationId,
      createdAt: existing.createdAt,
      metadata: {
        ...existing.metadata,
        ...data.metadata,
        edited: true,
        originalContent: existing.metadata?.originalContent || existing.content,
      },
    };
    
    await this.storage.set(`${MESSAGE_PREFIX}${id}`, updated);
    return updated;
  }

  /**
   * 删除消息
   */
  async delete(id: string): Promise<boolean> {
    const message = await this.get(id);
    if (!message) return false;
    
    await this.removeFromIndex(message.conversationId, id);
    return this.storage.delete(`${MESSAGE_PREFIX}${id}`);
  }

  /**
   * 获取对话的所有消息
   */
  async getByConversation(conversationId: string): Promise<Message[]> {
    const index = await this.getIndex(conversationId);
    if (!index || index.length === 0) return [];
    
    const messages = await this.storage.getMany<Message>(
      index.map(id => `${MESSAGE_PREFIX}${id}`)
    );
    
    return messages
      .filter((m): m is Message => m !== null)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  /**
   * 删除对话的所有消息
   */
  async deleteByConversation(conversationId: string): Promise<number> {
    const index = await this.getIndex(conversationId);
    if (!index || index.length === 0) return 0;
    
    const deleted = await this.storage.deleteMany(
      index.map(id => `${MESSAGE_PREFIX}${id}`)
    );
    
    await this.storage.delete(`${MESSAGE_INDEX_PREFIX}${conversationId}`);
    
    return deleted;
  }

  /**
   * 获取最后一条消息
   */
  async getLastMessage(conversationId: string): Promise<Message | null> {
    const messages = await this.getByConversation(conversationId);
    return messages[messages.length - 1] || null;
  }

  /**
   * 获取消息数量
   */
  async getCount(conversationId: string): Promise<number> {
    const index = await this.getIndex(conversationId);
    return index?.length || 0;
  }

  /**
   * 搜索消息
   */
  async search(conversationId: string, query: string): Promise<Message[]> {
    const messages = await this.getByConversation(conversationId);
    const lowerQuery = query.toLowerCase();
    
    return messages.filter(m => 
      m.content.toLowerCase().includes(lowerQuery)
    );
  }

  // ==================== 索引管理 ====================

  private async getIndex(conversationId: string): Promise<string[] | null> {
    return this.storage.get<string[]>(`${MESSAGE_INDEX_PREFIX}${conversationId}`);
  }

  private async addToIndex(conversationId: string, messageId: string): Promise<void> {
    const index = await this.getIndex(conversationId) || [];
    index.push(messageId);
    await this.storage.set(`${MESSAGE_INDEX_PREFIX}${conversationId}`, index);
  }

  private async removeFromIndex(conversationId: string, messageId: string): Promise<void> {
    const index = await this.getIndex(conversationId);
    if (!index) return;
    
    const newIndex = index.filter(id => id !== messageId);
    await this.storage.set(`${MESSAGE_INDEX_PREFIX}${conversationId}`, newIndex);
  }
}

// ==================== 工具函数 ====================

function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 创建消息管理器
 */
export function createMessageManager(storage: UnifiedStorage): MessageManager {
  return new MessageManager(storage);
}

/**
 * 计算消息的估算 token 数
 */
export function estimateTokenCount(content: string): number {
  // 简单估算：英文约 4 字符 = 1 token，中文约 1.5 字符 = 1 token
  const englishChars = content.replace(/[\u4e00-\u9fff]/g, '').length;
  const chineseChars = (content.match(/[\u4e00-\u9fff]/g) || []).length;
  
  return Math.ceil(englishChars / 4 + chineseChars / 1.5);
}
