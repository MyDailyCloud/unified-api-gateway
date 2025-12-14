/**
 * Ollama Normalizer
 * Ollama 格式转换器
 * 
 * Ollama 使用自己的 API 格式:
 * - /api/chat - 对话 API
 * - /api/generate - 生成 API
 */

import type { 
  RequestNormalizer, 
  UnifiedRequest, 
  UnifiedResponse, 
  UnifiedStreamChunk 
} from '../types';

// ============================================================================
// Ollama Types
// ============================================================================

export interface OllamaChatRequest {
  model: string;
  messages: OllamaMessage[];
  stream?: boolean;
  format?: 'json';
  options?: OllamaOptions;
  keep_alive?: string | number;
}

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[]; // Base64 encoded images
}

export interface OllamaOptions {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  num_predict?: number; // max_tokens
  num_ctx?: number; // context length
  stop?: string[];
  seed?: number;
  repeat_penalty?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
}

export interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: 'assistant';
    content: string;
    thinking?: string; // For reasoning models
    tool_calls?: OllamaToolCall[];
  };
  done: boolean;
  done_reason?: 'stop' | 'length' | 'load';
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface OllamaToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export interface OllamaStreamChunk {
  model: string;
  created_at: string;
  message: {
    role: 'assistant';
    content: string;
    thinking?: string;
  };
  done: boolean;
  done_reason?: string;
  total_duration?: number;
  eval_count?: number;
}

// Generate API types (for /api/generate endpoint)
export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  system?: string;
  stream?: boolean;
  format?: 'json';
  options?: OllamaOptions;
  context?: number[]; // Conversation context from previous response
  keep_alive?: string | number;
}

export interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  thinking?: string;
  done: boolean;
  done_reason?: string;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface OllamaGenerateStreamChunk {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  done_reason?: string;
  context?: number[];
  total_duration?: number;
  eval_count?: number;
}

// Union types for request detection
export type OllamaRequest = OllamaChatRequest | OllamaGenerateRequest;
export type OllamaResponse = OllamaChatResponse | OllamaGenerateResponse;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Detect if request is a generate request (has prompt) vs chat request (has messages)
 */
function isGenerateRequest(request: unknown): request is OllamaGenerateRequest {
  if (typeof request !== 'object' || request === null) return false;
  const req = request as Record<string, unknown>;
  return typeof req.prompt === 'string' && !Array.isArray(req.messages);
}

/**
 * Detect if request is a chat request
 */
function isChatRequest(request: unknown): request is OllamaChatRequest {
  if (typeof request !== 'object' || request === null) return false;
  const req = request as Record<string, unknown>;
  return Array.isArray(req.messages);
}

// ============================================================================
// Chat Normalizer (/api/chat)
// ============================================================================

export const ollamaNormalizer: RequestNormalizer<
  OllamaChatRequest,
  OllamaChatResponse,
  OllamaStreamChunk
> = {
  format: 'ollama',

  /**
   * Normalize Ollama chat request to unified format
   */
  normalize(request: OllamaChatRequest): UnifiedRequest {
    return {
      model: request.model,
      messages: request.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        // Handle images for vision models
        ...(msg.images && msg.images.length > 0 && {
          content: [
            { type: 'text' as const, text: msg.content },
            ...msg.images.map((img) => ({
              type: 'image_url' as const,
              image_url: { url: `data:image/png;base64,${img}` },
            })),
          ],
        }),
      })),
      max_tokens: request.options?.num_predict,
      temperature: request.options?.temperature,
      top_p: request.options?.top_p,
      top_k: request.options?.top_k,
      stop: request.options?.stop,
      stream: request.stream,
      seed: request.options?.seed,
      presence_penalty: request.options?.presence_penalty,
      frequency_penalty: request.options?.frequency_penalty,
      response_format: request.format === 'json' ? { type: 'json_object' } : undefined,
    };
  },

  /**
   * Denormalize unified response to Ollama chat format
   */
  denormalize(response: UnifiedResponse): OllamaChatResponse {
    const choice = response.choices[0];
    
    return {
      model: response.model,
      created_at: new Date(response.created * 1000).toISOString(),
      message: {
        role: 'assistant',
        content: choice?.message?.content || '',
      },
      done: true,
      done_reason: choice?.finish_reason === 'length' ? 'length' : 'stop',
      prompt_eval_count: response.usage?.prompt_tokens,
      eval_count: response.usage?.completion_tokens,
    };
  },

  /**
   * Denormalize unified stream chunk to Ollama chat format
   */
  denormalizeStream(chunk: UnifiedStreamChunk): OllamaStreamChunk {
    const choice = chunk.choices[0];
    const isDone = choice?.finish_reason !== null;
    
    return {
      model: chunk.model,
      created_at: new Date(chunk.created * 1000).toISOString(),
      message: {
        role: 'assistant',
        content: choice?.delta?.content || '',
      },
      done: isDone,
      done_reason: isDone ? (choice?.finish_reason || 'stop') : undefined,
    };
  },

  parseRequest(body: unknown): OllamaChatRequest {
    return body as OllamaChatRequest;
  },

  validate(request: unknown): request is OllamaChatRequest {
    return isChatRequest(request);
  },
};

// ============================================================================
// Generate Normalizer (/api/generate)
// ============================================================================

export const ollamaGenerateNormalizer: RequestNormalizer<
  OllamaGenerateRequest,
  OllamaGenerateResponse,
  OllamaGenerateStreamChunk
> = {
  format: 'ollama-generate',

  /**
   * Normalize Ollama generate request to unified format
   * Converts prompt-based request to messages format
   */
  normalize(request: OllamaGenerateRequest): UnifiedRequest {
    const messages: UnifiedRequest['messages'] = [];
    
    // Add system message if present
    if (request.system) {
      messages.push({ role: 'system', content: request.system });
    }
    
    // Add prompt as user message
    messages.push({ role: 'user', content: request.prompt });
    
    return {
      model: request.model,
      messages,
      max_tokens: request.options?.num_predict,
      temperature: request.options?.temperature,
      top_p: request.options?.top_p,
      top_k: request.options?.top_k,
      stop: request.options?.stop,
      stream: request.stream,
      seed: request.options?.seed,
      presence_penalty: request.options?.presence_penalty,
      frequency_penalty: request.options?.frequency_penalty,
      response_format: request.format === 'json' ? { type: 'json_object' } : undefined,
    };
  },

  /**
   * Denormalize unified response to Ollama generate format
   */
  denormalize(response: UnifiedResponse): OllamaGenerateResponse {
    const choice = response.choices[0];
    
    return {
      model: response.model,
      created_at: new Date(response.created * 1000).toISOString(),
      response: choice?.message?.content || '',
      done: true,
      done_reason: choice?.finish_reason === 'length' ? 'length' : 'stop',
      prompt_eval_count: response.usage?.prompt_tokens,
      eval_count: response.usage?.completion_tokens,
    };
  },

  /**
   * Denormalize unified stream chunk to Ollama generate format
   */
  denormalizeStream(chunk: UnifiedStreamChunk): OllamaGenerateStreamChunk {
    const choice = chunk.choices[0];
    const isDone = choice?.finish_reason !== null;
    
    return {
      model: chunk.model,
      created_at: new Date(chunk.created * 1000).toISOString(),
      response: choice?.delta?.content || '',
      done: isDone,
      done_reason: isDone ? (choice?.finish_reason || 'stop') : undefined,
    };
  },

  parseRequest(body: unknown): OllamaGenerateRequest {
    return body as OllamaGenerateRequest;
  },

  validate(request: unknown): request is OllamaGenerateRequest {
    return isGenerateRequest(request);
  },
};

// ============================================================================
// Unified Ollama Normalizer (auto-detects chat vs generate)
// ============================================================================

/**
 * Auto-detect and normalize any Ollama request format
 */
export function normalizeOllamaRequest(request: OllamaRequest): UnifiedRequest {
  if (isGenerateRequest(request)) {
    return ollamaGenerateNormalizer.normalize(request);
  }
  return ollamaNormalizer.normalize(request);
}

/**
 * Validate any Ollama request format
 */
export function validateOllamaRequest(request: unknown): request is OllamaRequest {
  return isChatRequest(request) || isGenerateRequest(request);
}

export default ollamaNormalizer;
