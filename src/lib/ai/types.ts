/**
 * 统一AI API类型定义
 * Universal AI API Type Definitions
 */

// ==================== 多模态内容类型 ====================

export type ContentPartType = 'text' | 'image_url' | 'audio' | 'video' | 'file';

export interface TextContentPart {
  type: 'text';
  text: string;
}

export interface ImageContentPart {
  type: 'image_url';
  image_url: {
    url: string;
    detail?: 'auto' | 'low' | 'high';
  };
}

export interface AudioContentPart {
  type: 'audio';
  audio: {
    data: string;
    format: 'wav' | 'mp3' | 'ogg' | 'flac' | 'webm';
  };
}

export interface VideoContentPart {
  type: 'video';
  video: {
    url: string;
    duration?: number;
  };
}

export interface FileContentPart {
  type: 'file';
  file: {
    url: string;
    mimeType: string;
    name?: string;
  };
}

export type ContentPart = 
  | TextContentPart 
  | ImageContentPart 
  | AudioContentPart 
  | VideoContentPart 
  | FileContentPart;

export type MessageContent = string | ContentPart[];

// ==================== 基础消息类型 ====================

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface Message {
  role: MessageRole;
  content: MessageContent;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

// ==================== 请求/响应类型 ====================

export interface ChatCompletionRequest {
  model: string;
  messages: Message[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  tools?: Tool[];
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  stop?: string | string[];
  presence_penalty?: number;
  frequency_penalty?: number;
}

export interface ChatCompletionChoice {
  index: number;
  message: Message;
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ==================== 流式响应类型 ====================

export interface StreamDelta {
  role?: MessageRole;
  content?: string;
  tool_calls?: Partial<ToolCall>[];
}

export interface StreamChoice {
  index: number;
  delta: StreamDelta;
  finish_reason: string | null;
}

export interface StreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: StreamChoice[];
}

// ==================== 提供商配置 ====================

export type AIProvider = 
  | 'openai'
  | 'anthropic'
  | 'cerebras'
  | 'glm'
  | 'groq'
  | 'deepseek'
  | 'moonshot'
  | 'qwen'
  | 'minimax'
  | 'google'
  | 'azure'
  | 'mistral'
  | 'cohere'
  | 'custom';

export interface ProviderConfig {
  provider: AIProvider;
  apiKey: string;
  baseURL?: string;
  defaultModel?: string;
  headers?: Record<string, string>;
  timeout?: number;
  maxRetries?: number;
}

// ==================== 模型信息 ====================

export interface ModelInfo {
  id: string;
  name: string;
  provider: AIProvider;
  contextLength: number;
  maxOutputTokens?: number;
  supportsFunctions?: boolean;
  supportsVision?: boolean;
  supportsStreaming?: boolean;
  pricing?: {
    inputPer1kTokens: number;
    outputPer1kTokens: number;
  };
}

// ==================== 适配器接口 ====================

export interface AIAdapter {
  provider: AIProvider;
  
  // 核心方法
  chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
  chatStream(request: ChatCompletionRequest): AsyncIterable<StreamChunk>;
  
  // 工具方法
  listModels(): Promise<ModelInfo[]>;
  validateApiKey(): Promise<boolean>;
  
  // 配置
  getConfig(): ProviderConfig;
  updateConfig(config: Partial<ProviderConfig>): void;
}

// ==================== 错误类型 ====================

export class AIError extends Error {
  constructor(
    message: string,
    public code: string,
    public provider: AIProvider,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AIError';
  }
}

export class RateLimitError extends AIError {
  public retryAfter?: number;
  
  constructor(provider: AIProvider, retryAfter?: number) {
    super(
      `Rate limit exceeded for ${provider}`,
      'RATE_LIMIT_EXCEEDED',
      provider,
      429,
      { retryAfter }
    );
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class AuthenticationError extends AIError {
  constructor(provider: AIProvider) {
    super(
      `Authentication failed for ${provider}`,
      'AUTHENTICATION_FAILED',
      provider,
      401
    );
    this.name = 'AuthenticationError';
  }
}

export class NetworkError extends AIError {
  constructor(provider: AIProvider, message?: string) {
    super(
      message || `Network error for ${provider}`,
      'NETWORK_ERROR',
      provider,
      0
    );
    this.name = 'NetworkError';
  }
}

export class APIError extends AIError {
  constructor(provider: AIProvider, message: string, statusCode?: number) {
    super(
      message,
      'API_ERROR',
      provider,
      statusCode
    );
    this.name = 'APIError';
  }
}

export class ModelNotFoundError extends AIError {
  constructor(provider: AIProvider, model: string) {
    super(
      `Model ${model} not found for ${provider}`,
      'MODEL_NOT_FOUND',
      provider,
      404,
      { model }
    );
    this.name = 'ModelNotFoundError';
  }
}
