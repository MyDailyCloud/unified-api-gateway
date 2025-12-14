/**
 * 自定义适配器
 * Custom Adapter - For any OpenAI-compatible API
 */

import { OpenAIAdapter } from './openai-adapter';
import { AIProvider, ProviderConfig, ModelInfo, ChatCompletionRequest } from '../types';

export interface CustomAdapterConfig extends ProviderConfig {
  models?: ModelInfo[];
  requestTransformer?: (request: ChatCompletionRequest) => Record<string, unknown>;
  responseTransformer?: (response: any) => any;
}

export class CustomAdapter extends OpenAIAdapter {
  private customModels?: ModelInfo[];
  private requestTransformer?: (request: ChatCompletionRequest) => Record<string, unknown>;
  private responseTransformer?: (response: any) => any;
  
  get provider(): AIProvider {
    return 'custom';
  }
  
  constructor(config: CustomAdapterConfig) {
    super({
      ...config,
      baseURL: config.baseURL || '',
    });
    (this.config as ProviderConfig).provider = 'custom';
    this.customModels = config.models;
    this.requestTransformer = config.requestTransformer;
    this.responseTransformer = config.responseTransformer;
  }
  
  async listModels(): Promise<ModelInfo[]> {
    if (this.customModels) {
      return this.customModels;
    }
    
    try {
      return await super.listModels();
    } catch {
      return [];
    }
  }
}
