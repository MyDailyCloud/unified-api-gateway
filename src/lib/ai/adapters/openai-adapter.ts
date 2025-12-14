/**
 * OpenAI 适配器
 * OpenAI Adapter - Compatible with OpenAI API format
 */

import { BaseAdapter } from './base-adapter';
import {
  AIProvider,
  ChatCompletionRequest,
  ChatCompletionResponse,
  StreamChunk,
  ProviderConfig,
  ModelInfo,
} from '../types';

export class OpenAIAdapter extends BaseAdapter {
  get provider(): AIProvider {
    return 'openai';
  }
  
  constructor(config: Omit<ProviderConfig, 'provider'>) {
    super({
      ...config,
      provider: 'openai',
      baseURL: config.baseURL || 'https://api.openai.com/v1',
    });
  }
  
  protected buildHeaders(): Record<string, string> {
    return {
      ...super.buildHeaders(),
      'Authorization': `Bearer ${this.config.apiKey}`,
    };
  }
  
  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const url = `${this.config.baseURL}/chat/completions`;
    
    // 处理新旧模型参数差异
    const body = this.normalizeRequest(request);
    
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({ ...body, stream: false }),
    });
    
    return response.json();
  }
  
  async *chatStream(request: ChatCompletionRequest): AsyncIterable<StreamChunk> {
    const url = `${this.config.baseURL}/chat/completions`;
    const body = this.normalizeRequest(request);
    
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({ ...body, stream: true }),
    });
    
    yield* this.parseSSEStream(response);
  }
  
  async listModels(): Promise<ModelInfo[]> {
    const url = `${this.config.baseURL}/models`;
    
    const response = await this.fetchWithRetry(url, {
      method: 'GET',
      headers: this.buildHeaders(),
    });
    
    const data = await response.json();
    
    return data.data.map((model: any) => ({
      id: model.id,
      name: model.id,
      provider: this.provider,
      contextLength: this.getContextLength(model.id),
      supportsStreaming: true,
      supportsFunctions: this.supportsFunctions(model.id),
    }));
  }
  
  // 规范化请求 - 处理新旧模型参数差异
  private normalizeRequest(request: ChatCompletionRequest): Record<string, unknown> {
    const { max_tokens, temperature, ...rest } = request;
    const isNewModel = this.isNewModel(request.model);
    
    const normalized: Record<string, unknown> = { ...rest };
    
    if (max_tokens !== undefined) {
      // GPT-5 及更新模型使用 max_completion_tokens
      if (isNewModel) {
        normalized.max_completion_tokens = max_tokens;
      } else {
        normalized.max_tokens = max_tokens;
      }
    }
    
    // GPT-5 及更新模型不支持 temperature
    if (temperature !== undefined && !isNewModel) {
      normalized.temperature = temperature;
    }
    
    return normalized;
  }
  
  private isNewModel(model: string): boolean {
    const newModelPatterns = [
      'gpt-5',
      'gpt-4.1',
      'o3',
      'o4',
    ];
    return newModelPatterns.some(pattern => model.includes(pattern));
  }
  
  private getContextLength(model: string): number {
    const contextMap: Record<string, number> = {
      'gpt-5': 200000,
      'gpt-4.1': 200000,
      'gpt-4o': 128000,
      'gpt-4o-mini': 128000,
      'gpt-4-turbo': 128000,
      'gpt-4': 8192,
      'gpt-3.5-turbo': 16385,
    };
    
    for (const [key, length] of Object.entries(contextMap)) {
      if (model.includes(key)) return length;
    }
    return 8192;
  }
  
  private supportsFunctions(model: string): boolean {
    return model.includes('gpt-4') || model.includes('gpt-5') || model.includes('gpt-3.5-turbo');
  }
}
