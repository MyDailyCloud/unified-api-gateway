/**
 * Gateway Normalizers Export
 * 网关格式转换器导出
 */

export { openaiNormalizer, default as OpenAINormalizer } from './openai';
export { anthropicNormalizer, default as AnthropicNormalizer } from './anthropic';
export { googleNormalizer, default as GoogleNormalizer } from './google';
export { cohereNormalizer, default as CohereNormalizer } from './cohere';
export { ollamaNormalizer, default as OllamaNormalizer } from './ollama';
export { llamacppNormalizer, default as LlamaCppNormalizer } from './llamacpp';

import { openaiNormalizer } from './openai';
import { anthropicNormalizer } from './anthropic';
import { googleNormalizer } from './google';
import { cohereNormalizer } from './cohere';
import { ollamaNormalizer } from './ollama';
import { llamacppNormalizer } from './llamacpp';
import type { RequestNormalizer, RequestFormat } from '../types';

/**
 * Get normalizer by format
 */
export function getNormalizer(format: RequestFormat): RequestNormalizer {
  switch (format) {
    case 'openai':
      return openaiNormalizer;
    case 'anthropic':
      return anthropicNormalizer;
    case 'google':
      return googleNormalizer;
    case 'cohere':
      return cohereNormalizer;
    case 'ollama':
      return ollamaNormalizer;
    case 'llamacpp':
      return llamacppNormalizer;
    // OpenAI-compatible formats
    case 'mistral':
    case 'vllm':
    case 'lmstudio':
    case 'deepseek':
    case 'moonshot':
    case 'qwen':
    case 'glm':
    case 'groq':
    case 'together':
    case 'openrouter':
    case 'azure':
    case 'cerebras':
      return openaiNormalizer;
    default:
      return openaiNormalizer;
  }
}

/**
 * All available normalizers
 */
export const normalizers: Record<RequestFormat, RequestNormalizer> = {
  openai: openaiNormalizer,
  anthropic: anthropicNormalizer,
  google: googleNormalizer,
  cohere: cohereNormalizer,
  ollama: ollamaNormalizer,
  llamacpp: llamacppNormalizer,
  // OpenAI-compatible formats
  mistral: openaiNormalizer,
  vllm: openaiNormalizer,
  lmstudio: openaiNormalizer,
  deepseek: openaiNormalizer,
  moonshot: openaiNormalizer,
  qwen: openaiNormalizer,
  glm: openaiNormalizer,
  groq: openaiNormalizer,
  together: openaiNormalizer,
  openrouter: openaiNormalizer,
  azure: openaiNormalizer,
  cerebras: openaiNormalizer,
};
