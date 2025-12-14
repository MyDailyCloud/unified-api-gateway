/**
 * 智谱 GLM 适配器
 * Zhipu GLM Adapter
 */

import { OpenAIAdapter } from './openai-adapter';
import { AIProvider, ProviderConfig, ModelInfo } from '../types';

export class GLMAdapter extends OpenAIAdapter {
  get provider(): AIProvider {
    return 'glm';
  }
  
  constructor(config: Omit<ProviderConfig, 'provider'>) {
    super({
      ...config,
      baseURL: config.baseURL || 'https://open.bigmodel.cn/api/paas/v4',
    });
    (this.config as ProviderConfig).provider = 'glm';
  }
  
  protected buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
      ...this.config.headers,
    };
  }
  
  async listModels(): Promise<ModelInfo[]> {
    return [
      {
        id: 'glm-4-plus',
        name: 'GLM-4 Plus',
        provider: this.provider,
        contextLength: 128000,
        supportsStreaming: true,
        supportsFunctions: true,
        supportsVision: false,
      },
      {
        id: 'glm-4',
        name: 'GLM-4',
        provider: this.provider,
        contextLength: 128000,
        supportsStreaming: true,
        supportsFunctions: true,
        supportsVision: false,
      },
      {
        id: 'glm-4v',
        name: 'GLM-4V (Vision)',
        provider: this.provider,
        contextLength: 2048,
        supportsStreaming: true,
        supportsFunctions: false,
        supportsVision: true,
      },
      {
        id: 'glm-4-flash',
        name: 'GLM-4 Flash',
        provider: this.provider,
        contextLength: 128000,
        supportsStreaming: true,
        supportsFunctions: true,
        supportsVision: false,
      },
      {
        id: 'glm-4-long',
        name: 'GLM-4 Long',
        provider: this.provider,
        contextLength: 1000000,
        supportsStreaming: true,
        supportsFunctions: false,
        supportsVision: false,
      },
    ];
  }
}
