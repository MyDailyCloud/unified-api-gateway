/**
 * 通义千问 (Qwen) 适配器
 * Alibaba Qwen Adapter
 */

import { OpenAIAdapter } from './openai-adapter';
import { AIProvider, ProviderConfig, ModelInfo } from '../types';

export class QwenAdapter extends OpenAIAdapter {
  get provider(): AIProvider {
    return 'qwen';
  }
  
  constructor(config: Omit<ProviderConfig, 'provider'>) {
    super({
      ...config,
      baseURL: config.baseURL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    });
    (this.config as ProviderConfig).provider = 'qwen';
  }
  
  async listModels(): Promise<ModelInfo[]> {
    return [
      {
        id: 'qwen-max',
        name: 'Qwen Max',
        provider: this.provider,
        contextLength: 32000,
        supportsStreaming: true,
        supportsFunctions: true,
      },
      {
        id: 'qwen-plus',
        name: 'Qwen Plus',
        provider: this.provider,
        contextLength: 131072,
        supportsStreaming: true,
        supportsFunctions: true,
      },
      {
        id: 'qwen-turbo',
        name: 'Qwen Turbo',
        provider: this.provider,
        contextLength: 131072,
        supportsStreaming: true,
        supportsFunctions: true,
      },
      {
        id: 'qwen-long',
        name: 'Qwen Long',
        provider: this.provider,
        contextLength: 10000000,
        supportsStreaming: true,
        supportsFunctions: false,
      },
      {
        id: 'qwen-vl-max',
        name: 'Qwen VL Max (Vision)',
        provider: this.provider,
        contextLength: 32000,
        supportsStreaming: true,
        supportsFunctions: false,
        supportsVision: true,
      },
    ];
  }
}
