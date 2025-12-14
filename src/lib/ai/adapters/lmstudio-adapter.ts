/**
 * LM Studio 适配器
 * LM Studio Adapter
 */

import { BaseAdapter } from './base-adapter';
import {
  AIProvider,
  ChatCompletionRequest,
  ChatCompletionResponse,
  StreamChunk,
  ProviderConfig,
  ModelInfo,
  AdapterCapabilities,
} from '../types';

export class LMStudioAdapter extends BaseAdapter {
  get provider(): AIProvider {
    return 'lmstudio' as AIProvider;
  }
  
  constructor(config: Omit<ProviderConfig, 'provider' | 'apiKey'> & { apiKey?: string }) {
    super({
      ...config,
      provider: 'lmstudio' as AIProvider,
      apiKey: config.apiKey || 'lm-studio',
      baseURL: config.baseURL || 'http://localhost:1234/v1',
    });
  }
  
  getCapabilities(): AdapterCapabilities {
    return { chat: true, streaming: true, embedding: true, imageGeneration: false, speech: false, transcription: false, vision: true, tools: true };
  }
  
  protected buildHeaders(): Record<string, string> {
    return { 'Content-Type': 'application/json', ...this.config.headers };
  }
  
  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const response = await this.fetchWithRetry(`${this.config.baseURL}/chat/completions`, {
      method: 'POST', headers: this.buildHeaders(), body: JSON.stringify({ ...request, stream: false }),
    });
    return response.json();
  }
  
  async *chatStream(request: ChatCompletionRequest): AsyncIterable<StreamChunk> {
    const response = await this.fetchWithRetry(`${this.config.baseURL}/chat/completions`, {
      method: 'POST', headers: this.buildHeaders(), body: JSON.stringify({ ...request, stream: true }),
    });
    yield* this.parseSSEStream(response);
  }
  
  async listModels(): Promise<ModelInfo[]> {
    const response = await this.fetchWithRetry(`${this.config.baseURL}/models`, { method: 'GET', headers: this.buildHeaders() });
    const data = await response.json();
    return (data.data || []).map((m: any) => ({
      id: m.id, name: m.id, provider: this.provider, contextLength: 4096, supportsStreaming: true, supportsFunctions: true, supportsVision: m.id.toLowerCase().includes('llava'),
    }));
  }
  
  async isRunning(): Promise<boolean> {
    try { const r = await fetch(`${this.config.baseURL}/models`, { signal: AbortSignal.timeout(2000) }); return r.ok; } catch { return false; }
  }
}
