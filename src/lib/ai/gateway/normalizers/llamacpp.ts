/**
 * llama.cpp Normalizer
 * llama.cpp 格式转换器
 * 
 * llama.cpp 使用原生 API:
 * - /completion - 原生补全 API
 * - /v1/chat/completions - OpenAI 兼容 API (可选)
 */

import type { 
  RequestNormalizer, 
  UnifiedRequest, 
  UnifiedResponse, 
  UnifiedStreamChunk 
} from '../types';

// ============================================================================
// llama.cpp Types
// ============================================================================

export interface LlamaCppRequest {
  prompt: string;
  n_predict?: number; // max_tokens
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop?: string[];
  stream?: boolean;
  seed?: number;
  repeat_penalty?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  // Grammar / JSON mode
  grammar?: string;
  json_schema?: Record<string, unknown>;
  // Sampling parameters
  mirostat?: number;
  mirostat_tau?: number;
  mirostat_eta?: number;
  // Cache control
  cache_prompt?: boolean;
  slot_id?: number;
}

export interface LlamaCppResponse {
  content: string;
  stop: boolean;
  generation_settings: {
    model?: string;
    n_predict?: number;
    temperature?: number;
    top_p?: number;
    top_k?: number;
    seed?: number;
  };
  model?: string;
  tokens_predicted?: number;
  tokens_evaluated?: number;
  truncated?: boolean;
  stopped_eos?: boolean;
  stopped_word?: boolean;
  stopped_limit?: boolean;
  timings?: {
    prompt_n?: number;
    prompt_ms?: number;
    prompt_per_token_ms?: number;
    predicted_n?: number;
    predicted_ms?: number;
    predicted_per_token_ms?: number;
  };
}

export interface LlamaCppStreamChunk {
  content: string;
  stop: boolean;
  tokens_predicted?: number;
}

// ============================================================================
// Normalizer Implementation
// ============================================================================

export const llamacppNormalizer: RequestNormalizer<
  LlamaCppRequest,
  LlamaCppResponse,
  LlamaCppStreamChunk
> = {
  format: 'llamacpp',

  /**
   * Normalize llama.cpp request to unified format
   * 
   * Note: llama.cpp uses prompt-based API, so we convert from messages format
   */
  normalize(request: LlamaCppRequest): UnifiedRequest {
    // llama.cpp uses raw prompt, we wrap it as a user message
    return {
      model: '', // llama.cpp doesn't require model in request
      messages: [{ role: 'user', content: request.prompt }],
      max_tokens: request.n_predict,
      temperature: request.temperature,
      top_p: request.top_p,
      top_k: request.top_k,
      stop: request.stop,
      stream: request.stream,
      seed: request.seed,
      presence_penalty: request.presence_penalty,
      frequency_penalty: request.frequency_penalty,
      response_format: request.json_schema ? { type: 'json_object' } : undefined,
    };
  },

  /**
   * Denormalize unified response to llama.cpp format
   */
  denormalize(response: UnifiedResponse): LlamaCppResponse {
    const choice = response.choices[0];
    const finishReason = choice?.finish_reason;
    
    return {
      content: choice?.message?.content || '',
      stop: finishReason === 'stop' || finishReason === 'length',
      model: response.model,
      generation_settings: {
        model: response.model,
      },
      tokens_predicted: response.usage?.completion_tokens,
      tokens_evaluated: response.usage?.prompt_tokens,
      stopped_eos: finishReason === 'stop',
      stopped_limit: finishReason === 'length',
      timings: {
        prompt_n: response.usage?.prompt_tokens,
        predicted_n: response.usage?.completion_tokens,
      },
    };
  },

  /**
   * Denormalize unified stream chunk to llama.cpp format
   */
  denormalizeStream(chunk: UnifiedStreamChunk): LlamaCppStreamChunk {
    const choice = chunk.choices[0];
    
    return {
      content: choice?.delta?.content || '',
      stop: choice?.finish_reason !== null,
    };
  },

  /**
   * Parse llama.cpp request from HTTP body
   */
  parseRequest(body: unknown): LlamaCppRequest {
    return body as LlamaCppRequest;
  },

  /**
   * Validate llama.cpp request format
   */
  validate(request: unknown): request is LlamaCppRequest {
    if (typeof request !== 'object' || request === null) return false;
    const req = request as Record<string, unknown>;
    return typeof req.prompt === 'string';
  },
};

export default llamacppNormalizer;
