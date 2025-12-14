/**
 * OpenAI 适配器 - 全模态支持
 * OpenAI Adapter - Full Multimodal Support
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
  SpeechRequest,
  SpeechResponse,
  TranscriptionRequest,
  TranscriptionResponse,
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
  
  // ==================== 能力声明 ====================
  
  getCapabilities(): AdapterCapabilities {
    return {
      chat: true,
      streaming: true,
      embedding: true,
      imageGeneration: true,
      speech: true,
      transcription: true,
      vision: true,
      tools: true,
    };
  }
  
  protected buildHeaders(): Record<string, string> {
    return {
      ...super.buildHeaders(),
      'Authorization': `Bearer ${this.config.apiKey}`,
    };
  }
  
  // ==================== 文本生成 ====================
  
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
  
  // ==================== 文本嵌入 ====================
  
  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const url = `${this.config.baseURL}/embeddings`;
    
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({
        model: request.model,
        input: request.input,
        dimensions: request.dimensions,
        encoding_format: request.encoding_format || 'float',
        user: request.user,
      }),
    });
    
    return response.json();
  }
  
  // ==================== 图像生成 ====================
  
  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const url = `${this.config.baseURL}/images/generations`;
    
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({
        model: request.model || 'dall-e-3',
        prompt: request.prompt,
        n: request.n || 1,
        size: request.size || '1024x1024',
        quality: request.quality || 'standard',
        style: request.style,
        response_format: request.response_format || 'url',
        user: request.user,
      }),
    });
    
    return response.json();
  }
  
  // ==================== 语音合成 ====================
  
  async speak(request: SpeechRequest): Promise<SpeechResponse> {
    const url = `${this.config.baseURL}/audio/speech`;
    
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({
        model: request.model || 'tts-1',
        input: request.input,
        voice: request.voice,
        response_format: request.response_format || 'mp3',
        speed: request.speed || 1.0,
      }),
    });
    
    const audio = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'audio/mpeg';
    
    return { audio, contentType };
  }
  
  // ==================== 语音识别 ====================
  
  async transcribe(request: TranscriptionRequest): Promise<TranscriptionResponse> {
    const url = `${this.config.baseURL}/audio/transcriptions`;
    
    const formData = new FormData();
    formData.append('model', request.model || 'whisper-1');
    
    // 处理文件
    if (request.file instanceof Blob) {
      formData.append('file', request.file, 'audio.webm');
    } else if (request.file instanceof ArrayBuffer) {
      formData.append('file', new Blob([request.file]), 'audio.webm');
    } else {
      formData.append('file', request.file);
    }
    
    if (request.language) {
      formData.append('language', request.language);
    }
    if (request.prompt) {
      formData.append('prompt', request.prompt);
    }
    if (request.response_format) {
      formData.append('response_format', request.response_format);
    }
    if (request.temperature !== undefined) {
      formData.append('temperature', request.temperature.toString());
    }
    if (request.timestamp_granularities) {
      for (const granularity of request.timestamp_granularities) {
        formData.append('timestamp_granularities[]', granularity);
      }
    }
    
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: formData,
    });
    
    return response.json();
  }
  
  // ==================== 模型列表 ====================
  
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
      supportsVision: this.supportsVision(model.id),
    }));
  }
  
  // ==================== 辅助方法 ====================
  
  private normalizeRequest(request: ChatCompletionRequest): Record<string, unknown> {
    const { max_tokens, temperature, ...rest } = request;
    const isNewModel = this.isNewModel(request.model);
    
    const normalized: Record<string, unknown> = { ...rest };
    
    if (max_tokens !== undefined) {
      if (isNewModel) {
        normalized.max_completion_tokens = max_tokens;
      } else {
        normalized.max_tokens = max_tokens;
      }
    }
    
    if (temperature !== undefined && !isNewModel) {
      normalized.temperature = temperature;
    }
    
    return normalized;
  }
  
  private isNewModel(model: string): boolean {
    const newModelPatterns = ['gpt-5', 'gpt-4.1', 'o3', 'o4'];
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
  
  private supportsVision(model: string): boolean {
    return model.includes('gpt-4o') || model.includes('gpt-5') || model.includes('gpt-4-vision');
  }
}
