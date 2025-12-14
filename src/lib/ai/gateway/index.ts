/**
 * Universal AI Gateway Exports
 * 统一 AI 网关导出
 */

// Core Gateway
export { AIGateway, createAIGateway } from './gateway';

// Router
export { GatewayRouter, createGatewayRouter } from './router';

// Handlers
export {
  createEndpointHandlers,
  createRequestRouter,
  createHealthHandler,
  createModelsHandler,
  createGatewayServer,
  type EndpointConfig,
} from './handlers';

// Normalizers
export {
  openaiNormalizer,
  anthropicNormalizer,
  googleNormalizer,
  cohereNormalizer,
  getNormalizer,
  normalizers,
} from './normalizers';

// Types
export type {
  // Format types
  RequestFormat,
  ResponseFormat,
  
  // Unified internal format
  UnifiedRequest,
  UnifiedResponse,
  UnifiedChoice,
  UnifiedTool,
  UnifiedToolCall,
  UnifiedStreamChunk,
  
  // Configuration
  GatewayConfig,
  BackendConfig,
  RoutingConfig,
  CorsConfig,
  
  // Normalizer interface
  RequestNormalizer,
  
  // Router interface
  GatewayRouter as IGatewayRouter,
  RouterStats,
  
  // Middleware
  GatewayMiddleware,
  MiddlewareContext,
  
  // HTTP types
  GatewayRequest,
  GatewayResponse,
  RequestHandler,
  
  // Provider-specific types
  OpenAIRequest,
  OpenAIResponse,
  OpenAIMessage,
  OpenAITool,
  OpenAIToolCall,
  OpenAIContentPart,
  
  AnthropicRequest,
  AnthropicResponse,
  AnthropicMessage,
  AnthropicContentBlock,
  AnthropicTool,
  AnthropicStreamEvent,
  AnthropicSystemBlock,
  
  GoogleRequest,
  GoogleResponse,
  GoogleContent,
  GooglePart,
  GoogleGenerationConfig,
  GoogleTool,
  GoogleSafetySetting,
  
  CohereRequest,
  CohereResponse,
  CohereChatMessage,
  CohereTool,
  CohereToolCall,
  CohereToolResult,
  CohereStreamEvent,
} from './types';
