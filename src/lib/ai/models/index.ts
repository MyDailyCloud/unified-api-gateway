/**
 * 数据模型模块
 * Data Models Module
 */

// 对话模型
export type {
  Conversation,
  ConversationParameters,
  ConversationWithMessages,
  ConversationFolder,
} from './conversation';

export {
  ConversationManager,
  FolderManager,
  createConversationManager,
  createFolderManager,
} from './conversation';

// 消息模型
export type {
  Message,
  MessageMetadata,
  MessageAttachment,
} from './message';

export {
  MessageManager,
  createMessageManager,
  estimateTokenCount,
} from './message';

// API Key 模型
export type {
  StoredApiKey,
  ApiKeyInput,
} from './api-key';

export {
  ApiKeyManager,
  createApiKeyManager,
  generateEncryptionKey,
} from './api-key';
