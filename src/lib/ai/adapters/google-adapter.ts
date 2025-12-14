/**
 * Google Gemini 适配器
 * Google Gemini Adapter - Supports multimodal inputs
 */

import { BaseAdapter } from './base-adapter';
import type {
  AIProvider,
  ChatCompletionRequest,
  ChatCompletionResponse,
  StreamChunk,
  ModelInfo,
  ProviderConfig,
  Message,
  ContentPart,
} from '../types';

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
  fileData?: {
    mimeType: string;
    fileUri: string;
  };
}

interface GeminiRequest {
  contents: GeminiContent[];
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    stopSequences?: string[];
  };
  systemInstruction?: {
    parts: { text: string }[];
  };
}

export class GoogleAdapter extends BaseAdapter {
  get provider(): AIProvider {
    return 'google';
  }

  constructor(config: Omit<ProviderConfig, 'provider'>) {
    super({
      ...config,
      provider: 'google',
      baseURL: config.baseURL || 'https://generativelanguage.googleapis.com/v1beta',
    });
  }

  protected buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...this.config.headers,
    };
  }

  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const geminiRequest = this.convertToGeminiFormat(request);
    const model = request.model || this.config.defaultModel || 'gemini-1.5-flash';
    
    const url = `${this.config.baseURL}/models/${model}:generateContent?key=${this.config.apiKey}`;
    
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(geminiRequest),
    });

    const data = await response.json();
    return this.convertFromGeminiFormat(data, request.model);
  }

  async *chatStream(request: ChatCompletionRequest): AsyncIterable<StreamChunk> {
    const geminiRequest = this.convertToGeminiFormat(request);
    const model = request.model || this.config.defaultModel || 'gemini-1.5-flash';
    
    const url = `${this.config.baseURL}/models/${model}:streamGenerateContent?key=${this.config.apiKey}&alt=sse`;
    
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(geminiRequest),
    });

    yield* this.parseGeminiStream(response);
  }

  async listModels(): Promise<ModelInfo[]> {
    const url = `${this.config.baseURL}/models?key=${this.config.apiKey}`;
    
    const response = await this.fetchWithRetry(url, {
      method: 'GET',
      headers: this.buildHeaders(),
    });

    const data = await response.json();
    
    return (data.models || [])
      .filter((m: any) => m.name.includes('gemini'))
      .map((model: any) => ({
        id: model.name.replace('models/', ''),
        name: model.displayName || model.name,
        provider: 'google' as AIProvider,
        contextLength: model.inputTokenLimit || 32768,
        maxOutputTokens: model.outputTokenLimit || 8192,
        supportsVision: model.supportedGenerationMethods?.includes('generateContent'),
        supportsStreaming: true,
        supportsFunctions: true,
      }));
  }

  private convertToGeminiFormat(request: ChatCompletionRequest): GeminiRequest {
    const contents: GeminiContent[] = [];
    let systemInstruction: { parts: { text: string }[] } | undefined;

    for (const message of request.messages) {
      if (message.role === 'system') {
        const text = typeof message.content === 'string' 
          ? message.content 
          : message.content.filter(p => p.type === 'text').map(p => (p as any).text).join('\n');
        systemInstruction = { parts: [{ text }] };
        continue;
      }

      const role = message.role === 'assistant' ? 'model' : 'user';
      const parts = this.convertContentToParts(message);
      
      contents.push({ role, parts });
    }

    const geminiRequest: GeminiRequest = { contents };

    if (systemInstruction) {
      geminiRequest.systemInstruction = systemInstruction;
    }

    if (request.temperature !== undefined || request.max_tokens !== undefined || request.top_p !== undefined) {
      geminiRequest.generationConfig = {};
      if (request.temperature !== undefined) geminiRequest.generationConfig.temperature = request.temperature;
      if (request.max_tokens !== undefined) geminiRequest.generationConfig.maxOutputTokens = request.max_tokens;
      if (request.top_p !== undefined) geminiRequest.generationConfig.topP = request.top_p;
      if (request.stop) {
        geminiRequest.generationConfig.stopSequences = Array.isArray(request.stop) ? request.stop : [request.stop];
      }
    }

    return geminiRequest;
  }

  private convertContentToParts(message: Message): GeminiPart[] {
    const parts: GeminiPart[] = [];

    if (typeof message.content === 'string') {
      parts.push({ text: message.content });
    } else {
      for (const part of message.content as ContentPart[]) {
        switch (part.type) {
          case 'text':
            parts.push({ text: part.text });
            break;
          case 'image_url':
            if (part.image_url.url.startsWith('data:')) {
              const [meta, data] = part.image_url.url.split(',');
              const mimeType = meta.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
              parts.push({ inlineData: { mimeType, data } });
            } else {
              parts.push({ fileData: { mimeType: 'image/jpeg', fileUri: part.image_url.url } });
            }
            break;
          case 'audio':
            parts.push({ inlineData: { mimeType: `audio/${part.audio.format}`, data: part.audio.data } });
            break;
          case 'video':
            parts.push({ fileData: { mimeType: 'video/mp4', fileUri: part.video.url } });
            break;
        }
      }
    }

    return parts;
  }

  private convertFromGeminiFormat(data: any, model: string): ChatCompletionResponse {
    const candidate = data.candidates?.[0];
    const content = candidate?.content?.parts?.map((p: any) => p.text).join('') || '';

    return {
      id: `gemini-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content,
        },
        finish_reason: this.mapFinishReason(candidate?.finishReason),
      }],
      usage: data.usageMetadata ? {
        prompt_tokens: data.usageMetadata.promptTokenCount || 0,
        completion_tokens: data.usageMetadata.candidatesTokenCount || 0,
        total_tokens: data.usageMetadata.totalTokenCount || 0,
      } : undefined,
    };
  }

  private async *parseGeminiStream(response: Response): AsyncIterable<StreamChunk> {
    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || line.startsWith(':')) continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') return;

          try {
            const data = JSON.parse(jsonStr);
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            
            yield {
              id: `gemini-${Date.now()}`,
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: 'gemini',
              choices: [{
                index: 0,
                delta: { content: text },
                finish_reason: this.mapFinishReason(data.candidates?.[0]?.finishReason),
              }],
            };
          } catch {
            // Skip invalid JSON
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private mapFinishReason(reason?: string): 'stop' | 'length' | null {
    switch (reason) {
      case 'STOP': return 'stop';
      case 'MAX_TOKENS': return 'length';
      default: return null;
    }
  }
}
