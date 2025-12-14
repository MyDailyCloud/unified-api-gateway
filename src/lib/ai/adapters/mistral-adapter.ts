/**
 * Mistral AI 适配器
 * Mistral AI Adapter - OpenAI-compatible API with Embedding and Transcription
 */

import { BaseAdapter } from './base-adapter';
import type {
  AIProvider,
  ChatCompletionRequest,
  ChatCompletionResponse,
  StreamChunk,
  ModelInfo,
  ProviderConfig,
  AdapterCapabilities,
  EmbeddingRequest,
  EmbeddingResponse,
  TranscriptionRequest,
  TranscriptionResponse,
} from '../types';

export class MistralAdapter extends BaseAdapter {
  get provider(): AIProvider {
    return 'mistral';
  }

  constructor(config: Omit<ProviderConfig, 'provider'>) {
    super({
      ...config,
      provider: 'mistral',
      baseURL: config.baseURL || 'https://api.mistral.ai/v1',
    });
  }

  getCapabilities(): AdapterCapabilities {
    return {
      chat: true,
      streaming: true,
      embedding: true,
      transcription: true,
      vision: true,
      tools: true,
      imageGeneration: false,
      speech: false,
    };
  }

  protected buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
      ...this.config.headers,
    };
  }

  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const url = `${this.config.baseURL}/chat/completions`;
    
    const body = this.normalizeRequest(request);
    
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
    });

    return response.json();
  }

  async *chatStream(request: ChatCompletionRequest): AsyncIterable<StreamChunk> {
    const url = `${this.config.baseURL}/chat/completions`;
    
    const body = this.normalizeRequest({ ...request, stream: true });
    
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
    });

    yield* this.parseSSEStream(response);
  }

  // 📊 嵌入能力 - mistral-embed
  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const url = `${this.config.baseURL}/embeddings`;
    
    const body = {
      model: request.model || 'mistral-embed',
      input: Array.isArray(request.input) ? request.input : [request.input],
      encoding_format: request.encoding_format || 'float',
    };
    
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
    });

    return response.json();
  }

  // 🎤 语音转录能力 - Voxtral
  async transcribe(request: TranscriptionRequest): Promise<TranscriptionResponse> {
    const url = `${this.config.baseURL}/audio/transcriptions`;
    
    const formData = new FormData();
    formData.append('model', request.model || 'voxtral-mini-transcribe');
    
    // 处理文件输入
    if (request.file instanceof Blob) {
      formData.append('file', request.file, 'audio.wav');
    } else if (request.file instanceof ArrayBuffer) {
      formData.append('file', new Blob([request.file]), 'audio.wav');
    } else {
      formData.append('file', request.file);
    }
    
    if (request.language) formData.append('language', request.language);
    if (request.prompt) formData.append('prompt', request.prompt);
    if (request.response_format) formData.append('response_format', request.response_format);
    if (request.temperature !== undefined) formData.append('temperature', String(request.temperature));
    
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        ...this.config.headers,
      },
      body: formData,
    });

    const data = await response.json();
    
    return {
      text: data.text || '',
      language: data.language,
      duration: data.duration,
      words: data.words,
      segments: data.segments,
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    const url = `${this.config.baseURL}/models`;
    
    const response = await this.fetchWithRetry(url, {
      method: 'GET',
      headers: this.buildHeaders(),
    });

    const data = await response.json();
    
    return (data.data || []).map((model: any) => ({
      id: model.id,
      name: model.id,
      provider: 'mistral' as AIProvider,
      contextLength: this.getContextLength(model.id),
      maxOutputTokens: this.getMaxOutputTokens(model.id),
      supportsVision: model.id.includes('vision') || model.id.includes('pixtral') || model.id.includes('large'),
      supportsStreaming: true,
      supportsFunctions: true,
    }));
  }

  private normalizeRequest(request: ChatCompletionRequest): Record<string, unknown> {
    const normalized: Record<string, unknown> = {
      model: request.model || this.config.defaultModel || 'mistral-small-latest',
      messages: request.messages,
    };

    if (request.temperature !== undefined) normalized.temperature = request.temperature;
    if (request.max_tokens !== undefined) normalized.max_tokens = request.max_tokens;
    if (request.top_p !== undefined) normalized.top_p = request.top_p;
    if (request.stream !== undefined) normalized.stream = request.stream;
    if (request.stop !== undefined) normalized.stop = request.stop;
    if (request.tools !== undefined) normalized.tools = request.tools;
    if (request.tool_choice !== undefined) normalized.tool_choice = request.tool_choice;

    return normalized;
  }

  private getContextLength(model: string): number {
    if (model.includes('large')) return 128000;
    if (model.includes('medium')) return 32768;
    if (model.includes('small')) return 32768;
    if (model.includes('codestral')) return 32768;
    if (model.includes('pixtral')) return 128000;
    if (model.includes('voxtral')) return 0; // Audio model
    return 32768;
  }

  private getMaxOutputTokens(model: string): number {
    if (model.includes('large')) return 8192;
    if (model.includes('codestral')) return 16384;
    return 4096;
  }
}
