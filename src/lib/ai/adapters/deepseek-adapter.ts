/**
 * DeepSeek 适配器
 * DeepSeek Adapter
 */

import { OpenAIAdapter } from './openai-adapter';
import { AIProvider, ProviderConfig, ModelInfo } from '../types';

export class DeepSeekAdapter extends OpenAIAdapter {
  get provider(): AIProvider {
    return 'deepseek';
  }
  
  constructor(config: Omit<ProviderConfig, 'provider'>) {
    super({
      ...config,
      baseURL: config.baseURL || 'https://api.deepseek.com/v1',
    });
    (this.config as ProviderConfig).provider = 'deepseek';
  }
  
  async listModels(): Promise<ModelInfo[]> {
    return [
      {
        id: 'deepseek-chat',
        name: 'DeepSeek Chat',
        provider: this.provider,
        contextLength: 64000,
        supportsStreaming: true,
        supportsFunctions: true,
      },
      {
        id: 'deepseek-coder',
        name: 'DeepSeek Coder',
        provider: this.provider,
        contextLength: 64000,
        supportsStreaming: true,
        supportsFunctions: true,
      },
      {
        id: 'deepseek-reasoner',
        name: 'DeepSeek Reasoner',
        provider: this.provider,
        contextLength: 64000,
        supportsStreaming: true,
        supportsFunctions: false,
      },
    ];
  }
}
