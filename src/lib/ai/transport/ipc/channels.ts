/**
 * IPC 通道定义
 * IPC Channel Definitions
 */

import type { AIProvider } from '../../types';
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  InternalChatRequest,
  InternalChatResponse,
  ProviderInfo,
  StatsResponse,
} from '../../core/types';

// ==================== 通道名称 ====================

export const IPC_CHANNELS = {
  // AI 服务（对外 API 兼容）
  AI: {
    CHAT_COMPLETION: 'ai:chat-completion',
    STREAM_CHAT_COMPLETION: 'ai:stream-chat-completion',
    LIST_MODELS: 'ai:list-models',
  },
  
  // 内部服务
  INTERNAL: {
    CHAT: 'internal:chat',
    STREAM_CHAT: 'internal:stream-chat',
    LIST_CONVERSATIONS: 'internal:list-conversations',
    GET_CONVERSATION: 'internal:get-conversation',
    DELETE_CONVERSATION: 'internal:delete-conversation',
    GET_MESSAGES: 'internal:get-messages',
    LIST_PROVIDERS: 'internal:list-providers',
    SET_API_KEY: 'internal:set-api-key',
    DELETE_API_KEY: 'internal:delete-api-key',
    GET_STATS: 'internal:get-stats',
  },
  
  // 系统
  SYSTEM: {
    HEALTH: 'system:health',
    VERSION: 'system:version',
  },
} as const;

// ==================== 请求/响应类型 ====================

// AI 服务
export interface AIChatCompletionArgs {
  request: ChatCompletionRequest;
}

export interface AIChatCompletionResult {
  response?: ChatCompletionResponse;
  error?: string;
}

export interface AIStreamChunk {
  content?: string;
  done?: boolean;
  error?: string;
}

export interface AIListModelsResult {
  models?: Array<{ id: string; owned_by: string }>;
  error?: string;
}

// 内部服务
export interface InternalChatArgs {
  request: InternalChatRequest;
}

export interface InternalChatResult {
  response?: InternalChatResponse;
  error?: string;
}

export interface ListConversationsArgs {
  limit?: number;
  offset?: number;
}

export interface ListConversationsResult {
  conversations?: Array<{ id: string; title: string; updatedAt: number }>;
  error?: string;
}

export interface GetConversationArgs {
  id: string;
}

export interface GetConversationResult {
  messages?: Array<{ role: string; content: string; createdAt: number }>;
  error?: string;
}

export interface DeleteConversationArgs {
  id: string;
}

export interface DeleteConversationResult {
  success?: boolean;
  error?: string;
}

export interface ListProvidersResult {
  providers?: ProviderInfo[];
  error?: string;
}

export interface SetApiKeyArgs {
  provider: AIProvider;
  apiKey: string;
}

export interface SetApiKeyResult {
  success?: boolean;
  error?: string;
}

export interface DeleteApiKeyArgs {
  provider: AIProvider;
}

export interface DeleteApiKeyResult {
  success?: boolean;
  error?: string;
}

export interface GetStatsResult {
  stats?: StatsResponse;
  error?: string;
}

// 系统
export interface HealthResult {
  status: 'ok' | 'error';
  uptime?: number;
  error?: string;
}

export interface VersionResult {
  version: string;
  platform: string;
}

// ==================== 类型映射 ====================

export interface IPCRequestMap {
  // AI
  [IPC_CHANNELS.AI.CHAT_COMPLETION]: AIChatCompletionArgs;
  [IPC_CHANNELS.AI.STREAM_CHAT_COMPLETION]: AIChatCompletionArgs;
  [IPC_CHANNELS.AI.LIST_MODELS]: void;
  
  // Internal
  [IPC_CHANNELS.INTERNAL.CHAT]: InternalChatArgs;
  [IPC_CHANNELS.INTERNAL.STREAM_CHAT]: InternalChatArgs;
  [IPC_CHANNELS.INTERNAL.LIST_CONVERSATIONS]: ListConversationsArgs;
  [IPC_CHANNELS.INTERNAL.GET_CONVERSATION]: GetConversationArgs;
  [IPC_CHANNELS.INTERNAL.DELETE_CONVERSATION]: DeleteConversationArgs;
  [IPC_CHANNELS.INTERNAL.GET_MESSAGES]: GetConversationArgs;
  [IPC_CHANNELS.INTERNAL.LIST_PROVIDERS]: void;
  [IPC_CHANNELS.INTERNAL.SET_API_KEY]: SetApiKeyArgs;
  [IPC_CHANNELS.INTERNAL.DELETE_API_KEY]: DeleteApiKeyArgs;
  [IPC_CHANNELS.INTERNAL.GET_STATS]: void;
  
  // System
  [IPC_CHANNELS.SYSTEM.HEALTH]: void;
  [IPC_CHANNELS.SYSTEM.VERSION]: void;
}

export interface IPCResponseMap {
  // AI
  [IPC_CHANNELS.AI.CHAT_COMPLETION]: AIChatCompletionResult;
  [IPC_CHANNELS.AI.STREAM_CHAT_COMPLETION]: AIStreamChunk;
  [IPC_CHANNELS.AI.LIST_MODELS]: AIListModelsResult;
  
  // Internal
  [IPC_CHANNELS.INTERNAL.CHAT]: InternalChatResult;
  [IPC_CHANNELS.INTERNAL.STREAM_CHAT]: AIStreamChunk;
  [IPC_CHANNELS.INTERNAL.LIST_CONVERSATIONS]: ListConversationsResult;
  [IPC_CHANNELS.INTERNAL.GET_CONVERSATION]: GetConversationResult;
  [IPC_CHANNELS.INTERNAL.DELETE_CONVERSATION]: DeleteConversationResult;
  [IPC_CHANNELS.INTERNAL.GET_MESSAGES]: GetConversationResult;
  [IPC_CHANNELS.INTERNAL.LIST_PROVIDERS]: ListProvidersResult;
  [IPC_CHANNELS.INTERNAL.SET_API_KEY]: SetApiKeyResult;
  [IPC_CHANNELS.INTERNAL.DELETE_API_KEY]: DeleteApiKeyResult;
  [IPC_CHANNELS.INTERNAL.GET_STATS]: GetStatsResult;
  
  // System
  [IPC_CHANNELS.SYSTEM.HEALTH]: HealthResult;
  [IPC_CHANNELS.SYSTEM.VERSION]: VersionResult;
}
