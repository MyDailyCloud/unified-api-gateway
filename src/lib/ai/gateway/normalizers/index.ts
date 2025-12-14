/**
 * Gateway Normalizers Export
 * 网关格式转换器导出
 */

export { openaiNormalizer, default as OpenAINormalizer } from './openai';
export { anthropicNormalizer, default as AnthropicNormalizer } from './anthropic';
export { googleNormalizer, default as GoogleNormalizer } from './google';
export { cohereNormalizer, default as CohereNormalizer } from './cohere';

import { openaiNormalizer } from './openai';
import { anthropicNormalizer } from './anthropic';
import { googleNormalizer } from './google';
import { cohereNormalizer } from './cohere';
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
    case 'mistral':
      // Mistral uses OpenAI-compatible format
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
  mistral: openaiNormalizer, // Mistral is OpenAI-compatible
};
