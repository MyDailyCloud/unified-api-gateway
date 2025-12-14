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

// ==================== 嵌入类型 ====================

export interface EmbeddingRequest {
  model: string;
  input: string | string[];
  dimensions?: number;
  encoding_format?: 'float' | 'base64';
  user?: string;
}

export interface EmbeddingData {
  object: 'embedding';
  embedding: number[];
  index: number;
}

export interface EmbeddingResponse {
  object: 'list';
  model: string;
  data: EmbeddingData[];
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

// ==================== 图像生成类型 ====================

export type ImageSize = '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';
export type ImageQuality = 'standard' | 'hd' | 'low' | 'medium' | 'high';
export type ImageStyle = 'vivid' | 'natural';

export interface ImageGenerationRequest {
  model: string;
  prompt: string;
  n?: number;
  size?: ImageSize;
  quality?: ImageQuality;
  style?: ImageStyle;
  response_format?: 'url' | 'b64_json';
  user?: string;
}

export interface GeneratedImage {
  url?: string;
  b64_json?: string;
  revised_prompt?: string;
}

export interface ImageGenerationResponse {
  created: number;
  data: GeneratedImage[];
}

// ==================== 语音合成类型 ====================

export type SpeechVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' | string;
export type SpeechFormat = 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';

export interface SpeechRequest {
  model: string;
  input: string;
  voice: SpeechVoice;
  response_format?: SpeechFormat;
  speed?: number;
}

export interface SpeechResponse {
  audio: ArrayBuffer;
  contentType: string;
}

// ==================== 语音转文字类型 ====================

export type TranscriptionFormat = 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';

export interface TranscriptionRequest {
  model: string;
  file: Blob | ArrayBuffer | File;
  language?: string;
  prompt?: string;
  response_format?: TranscriptionFormat;
  temperature?: number;
  timestamp_granularities?: ('word' | 'segment')[];
}

export interface TranscriptionWord {
  word: string;
  start: number;
  end: number;
}

export interface TranscriptionSegment {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
}

export interface TranscriptionResponse {
  text: string;
  language?: string;
  duration?: number;
  words?: TranscriptionWord[];
  segments?: TranscriptionSegment[];
}

// ==================== 重排序类型 (Cohere) ====================

export interface RerankRequest {
  model: string;
  query: string;
  documents: string[] | Array<{ text: string }>;
  top_n?: number;
  max_tokens_per_doc?: number;
  return_documents?: boolean;
}

export interface RerankResult {
  index: number;
  relevance_score: number;
  document?: { text: string };
}

export interface RerankResponse {
  id: string;
  results: RerankResult[];
  meta?: {
    billed_units?: { search_units: number };
  };
}

// ==================== 适配器能力 ====================

export interface AdapterCapabilities {
  chat: boolean;
  streaming: boolean;
  embedding: boolean;
  imageGeneration: boolean;
  speech: boolean;
  transcription: boolean;
  vision: boolean;
  tools: boolean;
  rerank?: boolean;
  ocr?: boolean;
}

// ==================== 适配器接口 ====================

export interface AIAdapter {
  provider: AIProvider;
  
  // 核心方法 - 文本生成
  chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
  chatStream(request: ChatCompletionRequest): AsyncIterable<StreamChunk>;
  
  // 全模态方法 - 可选
  embed?(request: EmbeddingRequest): Promise<EmbeddingResponse>;
  generateImage?(request: ImageGenerationRequest): Promise<ImageGenerationResponse>;
  speak?(request: SpeechRequest): Promise<SpeechResponse>;
  transcribe?(request: TranscriptionRequest): Promise<TranscriptionResponse>;
  rerank?(request: RerankRequest): Promise<RerankResponse>;
  
  // 工具方法
  listModels(): Promise<ModelInfo[]>;
  validateApiKey(): Promise<boolean>;
  getCapabilities(): AdapterCapabilities;
  
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
