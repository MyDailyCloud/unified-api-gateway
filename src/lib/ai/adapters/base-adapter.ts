/**
 * 基础适配器抽象类
 * Base Adapter Abstract Class
 */

import {
  AIAdapter,
  AIProvider,
  ChatCompletionRequest,
  ChatCompletionResponse,
  StreamChunk,
  ProviderConfig,
  ModelInfo,
  AIError,
  AuthenticationError,
  RateLimitError,
} from '../types';

export abstract class BaseAdapter implements AIAdapter {
  protected config: ProviderConfig;
  
  constructor(config: ProviderConfig) {
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      ...config,
    };
  }
  
  abstract get provider(): AIProvider;
  
  // 抽象方法 - 子类必须实现
  abstract chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
  abstract chatStream(request: ChatCompletionRequest): AsyncIterable<StreamChunk>;
  abstract listModels(): Promise<ModelInfo[]>;
  
  // 通用方法
  getConfig(): ProviderConfig {
    return { ...this.config };
  }
  
  updateConfig(config: Partial<ProviderConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  async validateApiKey(): Promise<boolean> {
    try {
      await this.listModels();
      return true;
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return false;
      }
      throw error;
    }
  }
  
  // 辅助方法
  protected buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...this.config.headers,
    };
  }
  
  protected async fetchWithRetry(
    url: string,
    options: RequestInit,
    retries = this.config.maxRetries || 3
  ): Promise<Response> {
    let lastError: Error | null = null;
    
    for (let i = 0; i <= retries; i++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.config.timeout || 30000
        );
        
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          return response;
        }
        
        // 处理错误响应
        const error = await this.handleErrorResponse(response);
        
        // 如果是速率限制，等待后重试
        if (response.status === 429 && i < retries) {
          const retryAfter = parseInt(response.headers.get('retry-after') || '1', 10);
          await this.sleep(retryAfter * 1000);
          continue;
        }
        
        throw error;
      } catch (error) {
        lastError = error as Error;
        
        if (error instanceof AIError) {
          throw error;
        }
        
        // 网络错误时重试
        if (i < retries) {
          await this.sleep(Math.pow(2, i) * 1000);
          continue;
        }
      }
    }
    
    throw lastError || new AIError(
      'Request failed after retries',
      'REQUEST_FAILED',
      this.provider
    );
  }
  
  protected async handleErrorResponse(response: Response): Promise<AIError> {
    let errorData: any;
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: await response.text() };
    }
    
    const message = errorData.error?.message || errorData.message || 'Unknown error';
    
    switch (response.status) {
      case 401:
        return new AuthenticationError(this.provider);
      case 429:
        return new RateLimitError(this.provider);
      default:
        return new AIError(
          message,
          errorData.error?.code || 'API_ERROR',
          this.provider,
          response.status,
          errorData
        );
    }
  }
  
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // SSE 流解析器
  protected async *parseSSEStream(
    response: Response
  ): AsyncIterable<StreamChunk> {
    const reader = response.body?.getReader();
    if (!reader) throw new AIError('No response body', 'NO_BODY', this.provider);
    
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
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;
          if (!trimmed.startsWith('data: ')) continue;
          
          const data = trimmed.slice(6).trim();
          if (data === '[DONE]') return;
          
          try {
            const chunk = JSON.parse(data);
            yield this.normalizeStreamChunk(chunk);
          } catch {
            // 忽略解析错误的行
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
  
  // 规范化流块 - 子类可覆盖
  protected normalizeStreamChunk(chunk: any): StreamChunk {
    return chunk;
  }
}
