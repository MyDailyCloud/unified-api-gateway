/**
 * Mistral AI 适配器
 * Mistral AI Adapter - OpenAI-compatible API
 */

import { BaseAdapter } from './base-adapter';
import type {
  AIProvider,
  ChatCompletionRequest,
  ChatCompletionResponse,
  StreamChunk,
  ModelInfo,
  ProviderConfig,
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
      supportsVision: model.id.includes('vision') || model.id.includes('pixtral'),
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

    // Mistral-specific: safe_prompt for content moderation
    // normalized.safe_prompt = false;

    return normalized;
  }

  private getContextLength(model: string): number {
    if (model.includes('large')) return 128000;
    if (model.includes('medium')) return 32768;
    if (model.includes('small')) return 32768;
    if (model.includes('codestral')) return 32768;
    if (model.includes('pixtral')) return 128000;
    return 32768;
  }

  private getMaxOutputTokens(model: string): number {
    if (model.includes('large')) return 8192;
    if (model.includes('codestral')) return 16384;
    return 4096;
  }
}
