/**
 * Moonshot (Kimi) 适配器
 * Moonshot Adapter
 */

import { OpenAIAdapter } from './openai-adapter';
import { AIProvider, ProviderConfig, ModelInfo } from '../types';

export class MoonshotAdapter extends OpenAIAdapter {
  get provider(): AIProvider {
    return 'moonshot';
  }
  
  constructor(config: Omit<ProviderConfig, 'provider'>) {
    super({
      ...config,
      baseURL: config.baseURL || 'https://api.moonshot.cn/v1',
    });
    (this.config as ProviderConfig).provider = 'moonshot';
  }
  
  async listModels(): Promise<ModelInfo[]> {
    return [
      {
        id: 'moonshot-v1-8k',
        name: 'Moonshot V1 8K',
        provider: this.provider,
        contextLength: 8000,
        supportsStreaming: true,
        supportsFunctions: true,
      },
      {
        id: 'moonshot-v1-32k',
        name: 'Moonshot V1 32K',
        provider: this.provider,
        contextLength: 32000,
        supportsStreaming: true,
        supportsFunctions: true,
      },
      {
        id: 'moonshot-v1-128k',
        name: 'Moonshot V1 128K',
        provider: this.provider,
        contextLength: 128000,
        supportsStreaming: true,
        supportsFunctions: true,
      },
    ];
  }
}
