/**
 * Together AI 适配器
 * Together AI Adapter
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
  EmbeddingRequest,
  EmbeddingResponse,
  ImageGenerationRequest,
  ImageGenerationResponse,
} from '../types';

export class TogetherAdapter extends BaseAdapter {
  get provider(): AIProvider {
    return 'together' as AIProvider;
  }
  
  constructor(config: Omit<ProviderConfig, 'provider'>) {
    super({ ...config, provider: 'together' as AIProvider, baseURL: config.baseURL || 'https://api.together.xyz/v1' });
  }
  
  getCapabilities(): AdapterCapabilities {
    return { chat: true, streaming: true, embedding: true, imageGeneration: true, speech: false, transcription: false, vision: true, tools: true };
  }
  
  protected buildHeaders(): Record<string, string> {
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.config.apiKey}`, ...this.config.headers };
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
  
  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const response = await this.fetchWithRetry(`${this.config.baseURL}/embeddings`, {
      method: 'POST', headers: this.buildHeaders(), body: JSON.stringify({ model: request.model || 'togethercomputer/m2-bert-80M-8k-retrieval', input: request.input }),
    });
    return response.json();
  }
  
  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const body: Record<string, unknown> = { model: request.model || 'black-forest-labs/FLUX.1-schnell-Free', prompt: request.prompt, n: request.n || 1 };
    if (request.size) { const [w, h] = request.size.split('x').map(Number); body.width = w; body.height = h; }
    const response = await this.fetchWithRetry(`${this.config.baseURL}/images/generations`, {
      method: 'POST', headers: this.buildHeaders(), body: JSON.stringify(body),
    });
    return response.json();
  }
  
  async listModels(): Promise<ModelInfo[]> {
    const response = await this.fetchWithRetry(`${this.config.baseURL}/models`, { method: 'GET', headers: this.buildHeaders() });
    const data = await response.json();
    return (data.data || data || []).filter((m: any) => ['chat', 'language', 'code'].includes(m.type)).map((m: any) => ({
      id: m.id, name: m.display_name || m.id, provider: this.provider, contextLength: m.context_length || 4096, supportsStreaming: true, supportsFunctions: true, supportsVision: m.id.toLowerCase().includes('llava'),
    }));
  }
}
