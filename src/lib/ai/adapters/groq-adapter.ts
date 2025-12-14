/**
 * Groq 适配器
 * Groq Adapter - Fast LLM inference
 */

import { OpenAIAdapter } from './openai-adapter';
import { AIProvider, ProviderConfig, ModelInfo } from '../types';

export class GroqAdapter extends OpenAIAdapter {
  get provider(): AIProvider {
    return 'groq';
  }
  
  constructor(config: Omit<ProviderConfig, 'provider'>) {
    super({
      ...config,
      baseURL: config.baseURL || 'https://api.groq.com/openai/v1',
    });
    (this.config as ProviderConfig).provider = 'groq';
  }
  
  async listModels(): Promise<ModelInfo[]> {
    return [
      {
        id: 'llama-3.3-70b-versatile',
        name: 'Llama 3.3 70B Versatile',
        provider: this.provider,
        contextLength: 128000,
        supportsStreaming: true,
        supportsFunctions: true,
      },
      {
        id: 'llama-3.1-8b-instant',
        name: 'Llama 3.1 8B Instant',
        provider: this.provider,
        contextLength: 128000,
        supportsStreaming: true,
        supportsFunctions: true,
      },
      {
        id: 'mixtral-8x7b-32768',
        name: 'Mixtral 8x7B',
        provider: this.provider,
        contextLength: 32768,
        supportsStreaming: true,
        supportsFunctions: true,
      },
      {
        id: 'gemma2-9b-it',
        name: 'Gemma 2 9B',
        provider: this.provider,
        contextLength: 8192,
        supportsStreaming: true,
        supportsFunctions: false,
      },
    ];
  }
}
