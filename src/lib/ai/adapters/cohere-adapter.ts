/**
 * Cohere 适配器
 * Cohere Adapter - Command R, Embed v4, and Rerank v4 models
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
  AdapterCapabilities,
  EmbeddingRequest,
  EmbeddingResponse,
  RerankRequest,
  RerankResponse,
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

// Cohere v2 Embed request format
interface CohereEmbedRequest {
  model: string;
  texts?: string[];
  images?: string[];
  input_type: 'search_document' | 'search_query' | 'classification' | 'clustering';
  embedding_types?: ('float' | 'int8' | 'uint8' | 'binary' | 'ubinary')[];
  truncate?: 'NONE' | 'START' | 'END';
}

export class CohereAdapter extends BaseAdapter {
  get provider(): AIProvider {
    return 'cohere';
  }

  constructor(config: Omit<ProviderConfig, 'provider'>) {
    super({
      ...config,
      provider: 'cohere',
      baseURL: config.baseURL || 'https://api.cohere.com',
    });
  }

  getCapabilities(): AdapterCapabilities {
    return {
      chat: true,
      streaming: true,
      embedding: true,
      rerank: true,
      vision: false,
      tools: true,
      imageGeneration: false,
      speech: false,
      transcription: false,
    };
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
    const url = `${this.config.baseURL}/v1/chat`;
    
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
    const url = `${this.config.baseURL}/v1/chat`;
    
    const body = this.convertToCohereFormat({ ...request, stream: true });
    
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
    });

    yield* this.parseCohereStream(response, request.model);
  }

  // 📊 嵌入能力 - embed-v4.0 (支持多模态)
  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const url = `${this.config.baseURL}/v2/embed`;
    
    const cohereRequest: CohereEmbedRequest = {
      model: request.model || 'embed-v4.0',
      input_type: (request as any).input_type || 'search_document',
    };
    
    // 处理文本输入
    if (request.input) {
      cohereRequest.texts = Array.isArray(request.input) ? request.input : [request.input];
    }
    
    // 处理图像输入 (Cohere embed-v4 支持)
    if ((request as any).images) {
      cohereRequest.images = (request as any).images;
    }
    
    // 嵌入类型
    if ((request as any).embedding_types) {
      cohereRequest.embedding_types = (request as any).embedding_types;
    }
    
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(cohereRequest),
    });

    const data = await response.json();
    
    // 转换为标准格式
    const embeddings = data.embeddings?.float || data.embeddings || [];
    
    return {
      object: 'list',
      model: cohereRequest.model,
      data: embeddings.map((embedding: number[], index: number) => ({
        object: 'embedding' as const,
        embedding,
        index,
      })),
      usage: {
        prompt_tokens: data.meta?.billed_units?.input_tokens || 0,
        total_tokens: data.meta?.billed_units?.input_tokens || 0,
      },
    };
  }

  // 🔄 重排序能力 - rerank-v4.0-pro
  async rerank(request: RerankRequest): Promise<RerankResponse> {
    const url = `${this.config.baseURL}/v2/rerank`;
    
    // 标准化文档格式
    const documents = request.documents.map(doc => 
      typeof doc === 'string' ? doc : doc.text
    );
    
    const body = {
      model: request.model || 'rerank-v4.0-pro',
      query: request.query,
      documents,
      top_n: request.top_n,
      max_tokens_per_doc: request.max_tokens_per_doc,
      return_documents: request.return_documents ?? true,
    };
    
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
    });

    const data = await response.json();
    
    return {
      id: data.id || `cohere-rerank-${Date.now()}`,
      results: (data.results || []).map((result: any) => ({
        index: result.index,
        relevance_score: result.relevance_score,
        document: result.document ? { text: result.document.text || result.document } : undefined,
      })),
      meta: data.meta,
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    // Cohere doesn't have a public list models endpoint
    // Return known models including new embed and rerank
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
      {
        id: 'embed-v4.0',
        name: 'Embed v4.0 (Multimodal)',
        provider: 'cohere',
        contextLength: 512,
        supportsVision: true, // 支持图像嵌入
        supportsStreaming: false,
        supportsFunctions: false,
      },
      {
        id: 'embed-english-v3.0',
        name: 'Embed English v3.0',
        provider: 'cohere',
        contextLength: 512,
        supportsVision: false,
        supportsStreaming: false,
        supportsFunctions: false,
      },
      {
        id: 'embed-multilingual-v3.0',
        name: 'Embed Multilingual v3.0',
        provider: 'cohere',
        contextLength: 512,
        supportsVision: false,
        supportsStreaming: false,
        supportsFunctions: false,
      },
      {
        id: 'rerank-v4.0-pro',
        name: 'Rerank v4.0 Pro',
        provider: 'cohere',
        contextLength: 4096,
        supportsVision: false,
        supportsStreaming: false,
        supportsFunctions: false,
      },
      {
        id: 'rerank-v3.5',
        name: 'Rerank v3.5',
        provider: 'cohere',
        contextLength: 4096,
        supportsVision: false,
        supportsStreaming: false,
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
