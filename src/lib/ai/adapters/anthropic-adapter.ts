/**
 * Anthropic Claude 适配器
 * Anthropic Claude Adapter
 */

import { BaseAdapter } from './base-adapter';
import {
  AIProvider,
  ChatCompletionRequest,
  ChatCompletionResponse,
  StreamChunk,
  ProviderConfig,
  ModelInfo,
  Message,
} from '../types';

export class AnthropicAdapter extends BaseAdapter {
  get provider(): AIProvider {
    return 'anthropic';
  }
  
  constructor(config: Omit<ProviderConfig, 'provider'>) {
    super({
      ...config,
      provider: 'anthropic',
      baseURL: config.baseURL || 'https://api.anthropic.com',
    });
  }
  
  protected buildHeaders(): Record<string, string> {
    return {
      ...super.buildHeaders(),
      'x-api-key': this.config.apiKey,
      'anthropic-version': '2023-06-01',
    };
  }
  
  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const url = `${this.config.baseURL}/v1/messages`;
    const body = this.convertToAnthropicFormat(request);
    
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
    });
    
    const data = await response.json();
    return this.convertToOpenAIFormat(data, request.model);
  }
  
  async *chatStream(request: ChatCompletionRequest): AsyncIterable<StreamChunk> {
    const url = `${this.config.baseURL}/v1/messages`;
    const body = this.convertToAnthropicFormat(request);
    
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({ ...body, stream: true }),
    });
    
    yield* this.parseAnthropicStream(response);
  }
  
  async listModels(): Promise<ModelInfo[]> {
    // Anthropic 没有 list models API，返回已知模型
    return [
      {
        id: 'claude-sonnet-4-5',
        name: 'Claude Sonnet 4.5',
        provider: this.provider,
        contextLength: 200000,
        maxOutputTokens: 8192,
        supportsStreaming: true,
        supportsFunctions: true,
        supportsVision: true,
      },
      {
        id: 'claude-opus-4-1-20250805',
        name: 'Claude Opus 4.1',
        provider: this.provider,
        contextLength: 200000,
        maxOutputTokens: 8192,
        supportsStreaming: true,
        supportsFunctions: true,
        supportsVision: true,
      },
      {
        id: 'claude-sonnet-4-20250514',
        name: 'Claude Sonnet 4',
        provider: this.provider,
        contextLength: 200000,
        maxOutputTokens: 8192,
        supportsStreaming: true,
        supportsFunctions: true,
        supportsVision: true,
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        provider: this.provider,
        contextLength: 200000,
        maxOutputTokens: 8192,
        supportsStreaming: true,
        supportsFunctions: true,
        supportsVision: true,
      },
    ];
  }
  
  // 转换为 Anthropic 格式
  private convertToAnthropicFormat(request: ChatCompletionRequest): Record<string, unknown> {
    const { messages, max_tokens, tools, tool_choice, ...rest } = request;
    
    // 提取 system 消息
    const systemMessages = messages.filter(m => m.role === 'system');
    const otherMessages = messages.filter(m => m.role !== 'system');
    
    const body: Record<string, unknown> = {
      model: request.model,
      max_tokens: max_tokens || 4096,
      messages: otherMessages.map(m => this.convertMessage(m)),
    };
    
    if (systemMessages.length > 0) {
      body.system = systemMessages.map(m => m.content).join('\n');
    }
    
    if (rest.temperature !== undefined) {
      body.temperature = rest.temperature;
    }
    
    if (rest.top_p !== undefined) {
      body.top_p = rest.top_p;
    }
    
    if (rest.stop) {
      body.stop_sequences = Array.isArray(rest.stop) ? rest.stop : [rest.stop];
    }
    
    // 转换工具
    if (tools) {
      body.tools = tools.map(tool => ({
        name: tool.function.name,
        description: tool.function.description,
        input_schema: tool.function.parameters,
      }));
    }
    
    if (tool_choice) {
      if (tool_choice === 'auto') {
        body.tool_choice = { type: 'auto' };
      } else if (tool_choice === 'none') {
        body.tool_choice = { type: 'none' };
      } else if (typeof tool_choice === 'object') {
        body.tool_choice = { type: 'tool', name: tool_choice.function.name };
      }
    }
    
    return body;
  }
  
  private convertMessage(message: Message): Record<string, unknown> {
    if (message.tool_calls) {
      return {
        role: 'assistant',
        content: message.tool_calls.map(tc => ({
          type: 'tool_use',
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments),
        })),
      };
    }
    
    if (message.role === 'tool') {
      return {
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: message.tool_call_id,
          content: message.content,
        }],
      };
    }
    
    return {
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: message.content,
    };
  }
  
  // 转换为 OpenAI 格式
  private convertToOpenAIFormat(data: any, model: string): ChatCompletionResponse {
    const content = data.content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('');
    
    const toolCalls = data.content
      .filter((c: any) => c.type === 'tool_use')
      .map((c: any) => ({
        id: c.id,
        type: 'function' as const,
        function: {
          name: c.name,
          arguments: JSON.stringify(c.input),
        },
      }));
    
    return {
      id: data.id,
      object: 'chat.completion',
      created: Date.now(),
      model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content,
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        },
        finish_reason: data.stop_reason === 'end_turn' ? 'stop' : data.stop_reason,
      }],
      usage: {
        prompt_tokens: data.usage?.input_tokens || 0,
        completion_tokens: data.usage?.output_tokens || 0,
        total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      },
    };
  }
  
  // 解析 Anthropic 流
  private async *parseAnthropicStream(response: Response): AsyncIterable<StreamChunk> {
    const reader = response.body?.getReader();
    if (!reader) return;
    
    const decoder = new TextDecoder();
    let buffer = '';
    let messageId = '';
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          
          try {
            const event = JSON.parse(line.slice(6));
            
            if (event.type === 'message_start') {
              messageId = event.message.id;
            } else if (event.type === 'content_block_delta') {
              if (event.delta.type === 'text_delta') {
                yield {
                  id: messageId,
                  object: 'chat.completion.chunk',
                  created: Date.now(),
                  model: '',
                  choices: [{
                    index: 0,
                    delta: { content: event.delta.text },
                    finish_reason: null,
                  }],
                };
              }
            } else if (event.type === 'message_stop') {
              yield {
                id: messageId,
                object: 'chat.completion.chunk',
                created: Date.now(),
                model: '',
                choices: [{
                  index: 0,
                  delta: {},
                  finish_reason: 'stop',
                }],
              };
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
