/**
 * Cohere 适配器
 * Cohere Adapter - Command R and Embed models
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
} from '../types';

interface CohereMessage {
  role: 'USER' | 'CHATBOT' | 'SYSTEM';
  message: string;
}

interface CohereChatRequest {
  model: string;
  message: string;
  chat_history?: CohereMessage[];
  preamble?: string;
  temperature?: number;
  max_tokens?: number;
  p?: number;
  stop_sequences?: string[];
  stream?: boolean;
}

export class CohereAdapter extends BaseAdapter {
  get provider(): AIProvider {
    return 'cohere';
  }

  constructor(config: Omit<ProviderConfig, 'provider'>) {
    super({
      ...config,
      provider: 'cohere',
      baseURL: config.baseURL || 'https://api.cohere.ai/v1',
    });
  }

  protected buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
      'X-Client-Name': 'ai-sdk',
      ...this.config.headers,
    };
  }

  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const url = `${this.config.baseURL}/chat`;
    
    const body = this.convertToCohereFormat(request);
    
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return this.convertFromCohereFormat(data, request.model);
  }

  async *chatStream(request: ChatCompletionRequest): AsyncIterable<StreamChunk> {
    const url = `${this.config.baseURL}/chat`;
    
    const body = this.convertToCohereFormat({ ...request, stream: true });
    
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
    });

    yield* this.parseCohereStream(response, request.model);
  }

  async listModels(): Promise<ModelInfo[]> {
    // Cohere doesn't have a public list models endpoint
    // Return known models
    return [
      {
        id: 'command-r-plus',
        name: 'Command R+',
        provider: 'cohere',
        contextLength: 128000,
        maxOutputTokens: 4096,
        supportsVision: false,
        supportsStreaming: true,
        supportsFunctions: true,
      },
      {
        id: 'command-r',
        name: 'Command R',
        provider: 'cohere',
        contextLength: 128000,
        maxOutputTokens: 4096,
        supportsVision: false,
        supportsStreaming: true,
        supportsFunctions: true,
      },
      {
        id: 'command',
        name: 'Command',
        provider: 'cohere',
        contextLength: 4096,
        maxOutputTokens: 4096,
        supportsVision: false,
        supportsStreaming: true,
        supportsFunctions: false,
      },
      {
        id: 'command-light',
        name: 'Command Light',
        provider: 'cohere',
        contextLength: 4096,
        maxOutputTokens: 4096,
        supportsVision: false,
        supportsStreaming: true,
        supportsFunctions: false,
      },
    ];
  }

  private convertToCohereFormat(request: ChatCompletionRequest): CohereChatRequest {
    const messages = request.messages;
    const chatHistory: CohereMessage[] = [];
    let preamble: string | undefined;
    let lastUserMessage = '';

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const content = typeof msg.content === 'string' 
        ? msg.content 
        : msg.content.filter(p => p.type === 'text').map(p => (p as any).text).join('\n');

      if (msg.role === 'system') {
        preamble = content;
      } else if (msg.role === 'user') {
        if (i === messages.length - 1) {
          lastUserMessage = content;
        } else {
          chatHistory.push({ role: 'USER', message: content });
        }
      } else if (msg.role === 'assistant') {
        chatHistory.push({ role: 'CHATBOT', message: content });
      }
    }

    const cohereRequest: CohereChatRequest = {
      model: request.model || this.config.defaultModel || 'command-r',
      message: lastUserMessage,
    };

    if (chatHistory.length > 0) cohereRequest.chat_history = chatHistory;
    if (preamble) cohereRequest.preamble = preamble;
    if (request.temperature !== undefined) cohereRequest.temperature = request.temperature;
    if (request.max_tokens !== undefined) cohereRequest.max_tokens = request.max_tokens;
    if (request.top_p !== undefined) cohereRequest.p = request.top_p;
    if (request.stop) {
      cohereRequest.stop_sequences = Array.isArray(request.stop) ? request.stop : [request.stop];
    }
    if (request.stream !== undefined) cohereRequest.stream = request.stream;

    return cohereRequest;
  }

  private convertFromCohereFormat(data: any, model: string): ChatCompletionResponse {
    return {
      id: data.generation_id || `cohere-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: data.text || '',
        },
        finish_reason: this.mapFinishReason(data.finish_reason),
      }],
      usage: data.meta?.tokens ? {
        prompt_tokens: data.meta.tokens.input_tokens || 0,
        completion_tokens: data.meta.tokens.output_tokens || 0,
        total_tokens: (data.meta.tokens.input_tokens || 0) + (data.meta.tokens.output_tokens || 0),
      } : undefined,
    };
  }

  private async *parseCohereStream(response: Response, model: string): AsyncIterable<StreamChunk> {
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
          if (!line.trim()) continue;

          try {
            const data = JSON.parse(line);
            
            if (data.event_type === 'text-generation') {
              yield {
                id: `cohere-${Date.now()}`,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model,
                choices: [{
                  index: 0,
                  delta: { content: data.text || '' },
                  finish_reason: null,
                }],
              };
            } else if (data.event_type === 'stream-end') {
              yield {
                id: `cohere-${Date.now()}`,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model,
                choices: [{
                  index: 0,
                  delta: {},
                  finish_reason: this.mapFinishReason(data.finish_reason),
                }],
              };
            }
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
      case 'COMPLETE': return 'stop';
      case 'MAX_TOKENS': return 'length';
      default: return null;
    }
  }
}
