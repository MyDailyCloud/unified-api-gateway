/**
 * 核心层类型定义
 * Core Layer Type Definitions
 */

import type { AIProvider, ChatCompletionRequest as BaseChatRequest, ChatCompletionResponse as BaseChatResponse } from '../types';
import type { UnifiedStorage, StorageConfig } from '../storage/types';

// ==================== 核心配置 ====================

export interface AICoreConfig {
  /** 存储配置 */
  storage?: Partial<StorageConfig>;
  /** 加密密钥（用于 API Key 加密） */
  encryptionKey?: string;
  /** 启用速率限制 */
  enableRateLimiting?: boolean;
  /** 启用请求日志 */
  enableLogging?: boolean;
  /** 调试模式 */
  debug?: boolean;
}

// ==================== AI 服务类型（对外 API） ====================

export interface AIServiceConfig {
  /** 默认模型 */
  defaultModel?: string;
  /** 默认提供商 */
  defaultProvider?: AIProvider;
  /** 最大 tokens */
  maxTokens?: number;
  /** 请求超时（毫秒） */
  timeout?: number;
  /** 启用流式响应 */
  enableStreaming?: boolean;
}

export interface OpenAIChatCompletionRequest {
  model?: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
}

export interface OpenAIChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: 'stop' | 'length' | 'content_filter' | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenAIChatCompletionChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: 'assistant';
      content?: string;
    };
    finish_reason: 'stop' | 'length' | 'content_filter' | null;
  }>;
}

export interface ModelInfo {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
  permission?: Array<Record<string, unknown>>;
}

export interface ModelsResponse {
  object: 'list';
  data: ModelInfo[];
}

// ==================== 内部服务类型（UI 使用） ====================

export interface InternalServiceConfig {
  /** 启用对话持久化 */
  enablePersistence?: boolean;
  /** 最大对话数 */
  maxConversations?: number;
  /** 最大消息数（每对话） */
  maxMessagesPerConversation?: number;
}

export interface InternalChatRequest {
  conversationId?: string;
  message: string;
  model?: string;
  provider?: AIProvider;
  systemPrompt?: string;
  stream?: boolean;
}

export interface InternalChatResponse {
  conversationId: string;
  messageId: string;
  content: string;
  model: string;
  provider: AIProvider;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ProviderInfo {
  provider: AIProvider;
  name: string;
  hasApiKey: boolean;
  models: string[];
  status: 'active' | 'inactive' | 'error';
}

export interface StatsResponse {
  uptime: number;
  requests: {
    total: number;
    success: number;
    failed: number;
  };
  queue: {
    pending: number;
    processing: number;
  };
  storage: {
    conversations: number;
    messages: number;
  };
}

// ==================== 事件类型 ====================

export type CoreEventType = 
  | 'request:start'
  | 'request:end'
  | 'request:error'
  | 'stream:start'
  | 'stream:chunk'
  | 'stream:end'
  | 'conversation:created'
  | 'conversation:updated'
  | 'message:added';

export interface CoreEvent<T = unknown> {
  type: CoreEventType;
  timestamp: number;
  data: T;
}

export type CoreEventListener<T = unknown> = (event: CoreEvent<T>) => void;

// ==================== 服务接口 ====================

export interface IAIService {
  /** 聊天补全 */
  chatCompletion(request: OpenAIChatCompletionRequest): Promise<OpenAIChatCompletionResponse>;
  /** 流式聊天补全 */
  streamChatCompletion(request: OpenAIChatCompletionRequest, onChunk: (chunk: OpenAIChatCompletionChunk) => void): Promise<void>;
  /** 获取模型列表 */
  listModels(): Promise<ModelsResponse>;
}

export interface IInternalService {
  /** 内部聊天 */
  chat(request: InternalChatRequest): Promise<InternalChatResponse>;
  /** 流式聊天 */
  streamChat(request: InternalChatRequest, onChunk: (content: string) => void): Promise<InternalChatResponse>;
  /** 获取对话列表 */
  listConversations(options?: { limit?: number; offset?: number }): Promise<Array<{ id: string; title: string; updatedAt: number }>>;
  /** 获取对话消息 */
  getConversationMessages(conversationId: string): Promise<Array<{ role: string; content: string; createdAt: number }>>;
  /** 删除对话 */
  deleteConversation(conversationId: string): Promise<boolean>;
  /** 获取提供商列表 */
  listProviders(): Promise<ProviderInfo[]>;
  /** 设置 API Key */
  setApiKey(provider: AIProvider, apiKey: string): Promise<void>;
  /** 删除 API Key */
  deleteApiKey(provider: AIProvider): Promise<boolean>;
  /** 获取统计信息 */
  getStats(): Promise<StatsResponse>;
}

// 重导出为兼容名称
export type ChatCompletionRequest = OpenAIChatCompletionRequest;
export type ChatCompletionResponse = OpenAIChatCompletionResponse;
export type ChatCompletionChunk = OpenAIChatCompletionChunk;
