/**
 * Cerebras 适配器
 * Cerebras Adapter - Ultra-fast inference
 */

import { OpenAIAdapter } from './openai-adapter';
import { AIProvider, ProviderConfig, ModelInfo } from '../types';

export class CerebrasAdapter extends OpenAIAdapter {
  get provider(): AIProvider {
    return 'cerebras';
  }
  
  constructor(config: Omit<ProviderConfig, 'provider'>) {
    super({
      ...config,
      baseURL: config.baseURL || 'https://api.cerebras.ai/v1',
    });
    (this.config as ProviderConfig).provider = 'cerebras';
  }
  
  async listModels(): Promise<ModelInfo[]> {
    // Cerebras 快速推理模型
    return [
      {
        id: 'llama-3.3-70b',
        name: 'Llama 3.3 70B',
        provider: this.provider,
        contextLength: 8192,
        supportsStreaming: true,
        supportsFunctions: true,
      },
      {
        id: 'llama-3.1-8b',
        name: 'Llama 3.1 8B',
        provider: this.provider,
        contextLength: 8192,
        supportsStreaming: true,
        supportsFunctions: true,
      },
      {
        id: 'qwen-3-32b',
        name: 'Qwen 3 32B',
        provider: this.provider,
        contextLength: 32768,
        supportsStreaming: true,
        supportsFunctions: true,
      },
    ];
  }
}
