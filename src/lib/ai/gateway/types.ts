/**
 * Universal AI Gateway Types
 * 统一 AI 网关类型定义
 */

import type { AIProvider, ChatCompletionRequest, ChatCompletionResponse, StreamChunk, Message } from '../types';

// ============================================================================
// Format Types
// ============================================================================

export type RequestFormat = 'openai' | 'anthropic' | 'google' | 'cohere' | 'mistral';
export type ResponseFormat = RequestFormat;

// ============================================================================
// Unified Internal Format (SDK Standard)
// ============================================================================

export interface UnifiedRequest {
  model: string;
  messages: Message[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop?: string | string[];
  stream?: boolean;
  tools?: UnifiedTool[];
  tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
  response_format?: { type: 'text' | 'json_object' };
  seed?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  user?: string;
  // Extended fields
  metadata?: Record<string, unknown>;
}

export interface UnifiedTool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

export interface UnifiedResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: UnifiedChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface UnifiedChoice {
  index: number;
  message: {
    role: 'assistant';
    content: string | null;
    tool_calls?: UnifiedToolCall[];
  };
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
}

export interface UnifiedToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface UnifiedStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    delta: {
      role?: 'assistant';
      content?: string;
      tool_calls?: Partial<UnifiedToolCall>[];
    };
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  }[];
}

// ============================================================================
// Gateway Configuration
// ============================================================================

export interface GatewayConfig {
  /** Backend provider configurations */
  backends: BackendConfig[];
  
  /** Routing strategy configuration */
  routing?: RoutingConfig;
  
  /** Default response format when not specified */
  defaultResponseFormat?: ResponseFormat;
  
  /** Model aliases for routing */
  modelAliases?: Record<string, string>;
  
  /** Middleware hooks */
  middleware?: GatewayMiddleware[];
  
  /** Enable request/response logging */
  logging?: boolean;
  
  /** CORS configuration */
  cors?: CorsConfig;
}

export interface BackendConfig {
  /** Unique backend name */
  name: string;
  
  /** AI provider type */
  provider: AIProvider;
  
  /** API key (optional, may use environment) */
  apiKey?: string;
  
  /** Base URL override */
  baseURL?: string;
  
  /** Priority for selection (lower = higher priority) */
  priority?: number;
  
  /** Load balancing weight */
  weight?: number;
  
  /** Supported model patterns (regex) */
  models?: string[];
  
  /** Cost per 1K tokens */
  costPer1kTokens?: {
    input: number;
    output: number;
  };
  
  /** Maximum requests per minute */
  rateLimit?: number;
  
  /** Health check endpoint */
  healthCheck?: string;
  
  /** Whether backend is enabled */
  enabled?: boolean;
}

export interface RoutingConfig {
  /** Routing strategy */
  strategy: 'model-match' | 'round-robin' | 'least-latency' | 'cost-optimized' | 'priority' | 'random';
  
  /** Fallback order when primary fails */
  fallbackOrder?: string[];
  
  /** Enable automatic failover */
  autoFailover?: boolean;
  
  /** Maximum retry attempts */
  maxRetries?: number;
  
  /** Retry delay in milliseconds */
  retryDelay?: number;
  
  /** Load balancing configuration */
  loadBalancing?: {
    enabled: boolean;
    healthCheckInterval?: number;
  };
}

export interface CorsConfig {
  origins?: string[];
  methods?: string[];
  headers?: string[];
  credentials?: boolean;
}

// ============================================================================
// Normalizer Interface
// ============================================================================

export interface RequestNormalizer<TRequest = unknown, TResponse = unknown, TStreamEvent = unknown> {
  /** Format identifier */
  format: RequestFormat;
  
  /** Convert provider-specific request to unified format */
  normalize(request: TRequest): UnifiedRequest;
  
  /** Convert unified response to provider-specific format */
  denormalize(response: UnifiedResponse): TResponse;
  
  /** Convert unified stream chunk to provider-specific event */
  denormalizeStream(chunk: UnifiedStreamChunk): TStreamEvent;
  
  /** Parse provider-specific request from HTTP body */
  parseRequest?(body: unknown): TRequest;
  
  /** Validate request format */
  validate?(request: unknown): request is TRequest;
}

// ============================================================================
// Router Interface
// ============================================================================

export interface GatewayRouter {
  /** Select optimal backend for request */
  selectBackend(request: UnifiedRequest): BackendConfig;
  
  /** Get all available backends */
  getAvailableBackends(): BackendConfig[];
  
  /** Report backend latency for adaptive routing */
  reportLatency(backendName: string, latencyMs: number): void;
  
  /** Report backend failure */
  reportFailure(backendName: string, error: Error): void;
  
  /** Check backend health */
  isHealthy(backendName: string): boolean;
  
  /** Get backend statistics */
  getStats(): RouterStats;
}

export interface RouterStats {
  backends: {
    name: string;
    healthy: boolean;
    avgLatency: number;
    requestCount: number;
    errorCount: number;
    lastError?: string;
    lastUsed?: number;
  }[];
  totalRequests: number;
  totalErrors: number;
}

// ============================================================================
// Middleware Interface
// ============================================================================

export interface GatewayMiddleware {
  name: string;
  
  /** Called before request normalization */
  onRequest?(request: unknown, format: RequestFormat): unknown | Promise<unknown>;
  
  /** Called after normalization, before routing */
  onUnifiedRequest?(request: UnifiedRequest): UnifiedRequest | Promise<UnifiedRequest>;
  
  /** Called after response, before denormalization */
  onUnifiedResponse?(response: UnifiedResponse): UnifiedResponse | Promise<UnifiedResponse>;
  
  /** Called after denormalization */
  onResponse?(response: unknown, format: ResponseFormat): unknown | Promise<unknown>;
  
  /** Called on error */
  onError?(error: Error, context: MiddlewareContext): void | Promise<void>;
}

export interface MiddlewareContext {
  requestFormat: RequestFormat;
  responseFormat: ResponseFormat;
  backend?: BackendConfig;
  startTime: number;
}

// ============================================================================
// HTTP Handler Types
// ============================================================================

export interface GatewayRequest {
  method: string;
  url: string;
  headers: Headers;
  body: unknown;
  params?: Record<string, string>;
}

export interface GatewayResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown | ReadableStream;
}

export type RequestHandler = (req: Request) => Promise<Response>;

// ============================================================================
// Provider-Specific Types
// ============================================================================

// OpenAI Types
export interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  n?: number;
  stream?: boolean;
  stop?: string | string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  logit_bias?: Record<string, number>;
  user?: string;
  tools?: OpenAITool[];
  tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
  response_format?: { type: 'text' | 'json_object' };
  seed?: number;
}

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | OpenAIContentPart[];
  name?: string;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

export interface OpenAIContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string; detail?: 'auto' | 'low' | 'high' };
}

export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface OpenAIResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: 'assistant';
      content: string | null;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Anthropic Types
export interface AnthropicRequest {
  model: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  system?: string | AnthropicSystemBlock[];
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  stream?: boolean;
  tools?: AnthropicTool[];
  tool_choice?: { type: 'auto' | 'any' | 'tool'; name?: string };
  metadata?: { user_id?: string };
}

export interface AnthropicSystemBlock {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
}

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

export interface AnthropicContentBlock {
  type: 'text' | 'image' | 'tool_use' | 'tool_result';
  text?: string;
  source?: { type: 'base64'; media_type: string; data: string };
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: string | AnthropicContentBlock[];
  is_error?: boolean;
}

export interface AnthropicTool {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
}

export interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
  stop_sequence?: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface AnthropicStreamEvent {
  type: 'message_start' | 'content_block_start' | 'content_block_delta' | 'content_block_stop' | 'message_delta' | 'message_stop' | 'ping' | 'error';
  message?: Partial<AnthropicResponse>;
  index?: number;
  content_block?: AnthropicContentBlock;
  delta?: { type: 'text_delta'; text: string } | { type: 'input_json_delta'; partial_json: string };
  usage?: { output_tokens: number };
  error?: { type: string; message: string };
}

// Google Gemini Types
export interface GoogleRequest {
  contents: GoogleContent[];
  systemInstruction?: GoogleContent;
  generationConfig?: GoogleGenerationConfig;
  tools?: GoogleTool[];
  toolConfig?: { functionCallingConfig?: { mode: 'AUTO' | 'ANY' | 'NONE' } };
  safetySettings?: GoogleSafetySetting[];
}

export interface GoogleContent {
  role: 'user' | 'model';
  parts: GooglePart[];
}

export interface GooglePart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: unknown };
}

export interface GoogleGenerationConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
  responseMimeType?: string;
}

export interface GoogleTool {
  functionDeclarations?: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  }[];
}

export interface GoogleSafetySetting {
  category: string;
  threshold: string;
}

export interface GoogleResponse {
  candidates: {
    content: GoogleContent;
    finishReason: 'STOP' | 'MAX_TOKENS' | 'SAFETY' | 'RECITATION' | 'OTHER';
    safetyRatings?: { category: string; probability: string }[];
  }[];
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

// Cohere Types
export interface CohereRequest {
  model: string;
  message: string;
  chat_history?: CohereChatMessage[];
  preamble?: string;
  temperature?: number;
  max_tokens?: number;
  p?: number;
  k?: number;
  stop_sequences?: string[];
  stream?: boolean;
  tools?: CohereTool[];
  tool_results?: CohereToolResult[];
}

export interface CohereChatMessage {
  role: 'USER' | 'CHATBOT' | 'SYSTEM' | 'TOOL';
  message: string;
  tool_calls?: CohereToolCall[];
  tool_results?: CohereToolResult[];
}

export interface CohereTool {
  name: string;
  description?: string;
  parameter_definitions?: Record<string, {
    description?: string;
    type: string;
    required?: boolean;
  }>;
}

export interface CohereToolCall {
  name: string;
  parameters: Record<string, unknown>;
}

export interface CohereToolResult {
  call: CohereToolCall;
  outputs: unknown[];
}

export interface CohereResponse {
  response_id: string;
  text: string;
  generation_id?: string;
  chat_history?: CohereChatMessage[];
  finish_reason: 'COMPLETE' | 'MAX_TOKENS' | 'ERROR' | 'ERROR_TOXIC' | 'ERROR_LIMIT';
  meta?: {
    api_version?: { version: string };
    billed_units?: { input_tokens: number; output_tokens: number };
    tokens?: { input_tokens: number; output_tokens: number };
  };
  tool_calls?: CohereToolCall[];
}

export interface CohereStreamEvent {
  event_type: 'stream-start' | 'text-generation' | 'stream-end' | 'tool-calls-generation' | 'tool-calls-chunk';
  text?: string;
  response?: CohereResponse;
  is_finished?: boolean;
  finish_reason?: string;
  tool_calls?: CohereToolCall[];
}
