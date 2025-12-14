/**
 * 传输层导出
 * Transport Layer Exports
 */

// HTTP 传输
export {
  createHttpServer,
  createApiRouter,
  createInternalRouter,
  ApiRouter,
  InternalRouter,
  type HttpServerConfig,
  type HttpServerInstance,
  type ApiRouterConfig,
  type InternalRouterConfig,
  type HttpRequest,
  type HttpResponse,
} from './http/server';

// 重导出路由器类型
export type { ApiRouterConfig as ExternalApiRouterConfig } from './http/api-router';
export type { InternalRouterConfig as InternalApiRouterConfig } from './http/internal-router';

// IPC 传输
export {
  IpcMainBridge,
  IpcRendererBridge,
  createIpcMainBridge,
  createIpcRendererBridge,
  type IpcBridgeConfig,
} from './ipc/bridge';

export {
  IPC_CHANNELS,
  type IPCRequestMap,
  type IPCResponseMap,
  type AIChatCompletionArgs,
  type AIChatCompletionResult,
  type AIStreamChunk,
  type AIListModelsResult,
  type InternalChatArgs,
  type InternalChatResult,
  type ListConversationsArgs,
  type ListConversationsResult,
  type GetConversationArgs,
  type GetConversationResult,
  type DeleteConversationArgs,
  type DeleteConversationResult,
  type ListProvidersResult,
  type SetApiKeyArgs,
  type SetApiKeyResult,
  type DeleteApiKeyArgs,
  type DeleteApiKeyResult,
  type GetStatsResult,
  type HealthResult,
  type VersionResult,
} from './ipc/channels';
