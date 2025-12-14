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
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface OllamaStreamChunk {
  model: string;
  created_at: string;
  message: {
    role: 'assistant';
    content: string;
  };
  done: boolean;
  total_duration?: number;
  eval_count?: number;
}

// ============================================================================
// Normalizer Implementation
// ============================================================================

export const ollamaNormalizer: RequestNormalizer<
  OllamaChatRequest,
  OllamaChatResponse,
  OllamaStreamChunk
> = {
  format: 'ollama',

  /**
   * Normalize Ollama request to unified format
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
   * Denormalize unified response to Ollama format
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
      prompt_eval_count: response.usage?.prompt_tokens,
      eval_count: response.usage?.completion_tokens,
    };
  },

  /**
   * Denormalize unified stream chunk to Ollama format
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
    };
  },

  /**
   * Parse Ollama request from HTTP body
   */
  parseRequest(body: unknown): OllamaChatRequest {
    return body as OllamaChatRequest;
  },

  /**
   * Validate Ollama request format
   */
  validate(request: unknown): request is OllamaChatRequest {
    if (typeof request !== 'object' || request === null) return false;
    const req = request as Record<string, unknown>;
    return (
      typeof req.model === 'string' &&
      Array.isArray(req.messages) &&
      req.messages.every(
        (msg: unknown) =>
          typeof msg === 'object' &&
          msg !== null &&
          typeof (msg as Record<string, unknown>).role === 'string' &&
          typeof (msg as Record<string, unknown>).content === 'string'
      )
    );
  },
};

export default ollamaNormalizer;
