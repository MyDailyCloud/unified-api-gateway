/**
 * Ollama 适配器 - 本地推理引擎
 * Ollama Adapter - Local Inference Engine
 * 
 * 支持 OpenAI 兼容端点和原生 Ollama API
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
  AIError,
} from '../types';

// Ollama 特有类型
export interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    parent_model: string;
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  images?: string[];
  format?: 'json';
  options?: {
    num_ctx?: number;
    num_predict?: number;
    temperature?: number;
    top_p?: number;
    top_k?: number;
    repeat_penalty?: number;
    seed?: number;
    stop?: string[];
  };
  stream?: boolean;
  system?: string;
  template?: string;
  context?: number[];
  keep_alive?: string;
}

export interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface OllamaPullProgress {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
}

export class OllamaAdapter extends BaseAdapter {
  private nativeBaseURL: string;
  
  get provider(): AIProvider {
    return 'ollama' as AIProvider;
  }
  
  constructor(config: Omit<ProviderConfig, 'provider' | 'apiKey'> & { apiKey?: string }) {
    const baseURL = config.baseURL || 'http://localhost:11434';
    super({
      ...config,
      provider: 'ollama' as AIProvider,
      apiKey: config.apiKey || 'ollama', // Ollama 不需要 API Key
      baseURL: `${baseURL}/v1`, // OpenAI 兼容端点
    });
    this.nativeBaseURL = baseURL;
  }
  
  getCapabilities(): AdapterCapabilities {
    return {
      chat: true,
      streaming: true,
      embedding: true,
      imageGeneration: false,
      speech: false,
      transcription: false,
      vision: true,  // llava, bakllava 等模型支持
      tools: true,   // 部分模型支持
    };
  }
  
  protected buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...this.config.headers,
    };
  }
  
  // ==================== OpenAI 兼容端点 ====================
  
  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const url = `${this.config.baseURL}/chat/completions`;
    
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({ ...request, stream: false }),
    });
    
    return response.json();
  }
  
  async *chatStream(request: ChatCompletionRequest): AsyncIterable<StreamChunk> {
    const url = `${this.config.baseURL}/chat/completions`;
    
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({ ...request, stream: true }),
    });
    
    yield* this.parseSSEStream(response);
  }
  
  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    // 优先使用原生 Ollama 嵌入 API
    const url = `${this.nativeBaseURL}/api/embed`;
    
    const input = Array.isArray(request.input) ? request.input : [request.input];
    
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({
        model: request.model,
        input,
      }),
    });
    
    const data = await response.json();
    
    // 转换为 OpenAI 格式
    const embeddings = data.embeddings || [data.embedding];
    
    return {
      object: 'list',
      model: request.model,
      data: embeddings.map((embedding: number[], index: number) => ({
        object: 'embedding' as const,
        embedding,
        index,
      })),
      usage: {
        prompt_tokens: data.prompt_eval_count || 0,
        total_tokens: data.prompt_eval_count || 0,
      },
    };
  }
  
  async listModels(): Promise<ModelInfo[]> {
    const models = await this.listLocalModels();
    
    return models.map(model => ({
      id: model.name,
      name: model.name,
      provider: this.provider,
      contextLength: this.getContextLength(model.details?.parameter_size),
      supportsStreaming: true,
      supportsFunctions: this.supportsFunctions(model.name),
      supportsVision: this.supportsVision(model.name),
    }));
  }
  
  // ==================== 原生 Ollama API ====================
  
  /**
   * 列出本地已安装的模型
   */
  async listLocalModels(): Promise<OllamaModel[]> {
    const url = `${this.nativeBaseURL}/api/tags`;
    
    const response = await this.fetchWithRetry(url, {
      method: 'GET',
      headers: this.buildHeaders(),
    });
    
    const data = await response.json();
    return data.models || [];
  }
  
  /**
   * 拉取/下载模型
   */
  async pullModel(
    model: string, 
    onProgress?: (progress: OllamaPullProgress) => void
  ): Promise<void> {
    const url = `${this.nativeBaseURL}/api/pull`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({ name: model, stream: !!onProgress }),
    });
    
    if (!response.ok) {
      throw new AIError(
        `Failed to pull model: ${model}`,
        'PULL_FAILED',
        this.provider,
        response.status
      );
    }
    
    if (onProgress && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const lines = decoder.decode(value).split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const progress = JSON.parse(line) as OllamaPullProgress;
            onProgress(progress);
          } catch {
            // 忽略解析错误
          }
        }
      }
    }
  }
  
  /**
   * 显示模型详细信息
   */
  async showModelInfo(model: string): Promise<{
    modelfile: string;
    parameters: string;
    template: string;
    details: OllamaModel['details'];
  }> {
    const url = `${this.nativeBaseURL}/api/show`;
    
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({ name: model }),
    });
    
    return response.json();
  }
  
  /**
   * 删除模型
   */
  async deleteModel(model: string): Promise<void> {
    const url = `${this.nativeBaseURL}/api/delete`;
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.buildHeaders(),
      body: JSON.stringify({ name: model }),
    });
    
    if (!response.ok) {
      throw new AIError(
        `Failed to delete model: ${model}`,
        'DELETE_FAILED',
        this.provider,
        response.status
      );
    }
  }
  
  /**
   * 复制模型
   */
  async copyModel(source: string, destination: string): Promise<void> {
    const url = `${this.nativeBaseURL}/api/copy`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({ source, destination }),
    });
    
    if (!response.ok) {
      throw new AIError(
        `Failed to copy model from ${source} to ${destination}`,
        'COPY_FAILED',
        this.provider,
        response.status
      );
    }
  }
  
  /**
   * 创建自定义模型 (Modelfile)
   */
  async createModel(
    name: string, 
    modelfile: string,
    onProgress?: (progress: { status: string }) => void
  ): Promise<void> {
    const url = `${this.nativeBaseURL}/api/create`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({ name, modelfile, stream: !!onProgress }),
    });
    
    if (!response.ok) {
      throw new AIError(
        `Failed to create model: ${name}`,
        'CREATE_FAILED',
        this.provider,
        response.status
      );
    }
    
    if (onProgress && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const lines = decoder.decode(value).split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const progress = JSON.parse(line);
            onProgress(progress);
          } catch {
            // 忽略解析错误
          }
        }
      }
    }
  }
  
  /**
   * 原生生成 API (非 Chat 格式)
   */
  async generateNative(request: OllamaGenerateRequest): Promise<OllamaGenerateResponse> {
    const url = `${this.nativeBaseURL}/api/generate`;
    
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({ ...request, stream: false }),
    });
    
    return response.json();
  }
  
  /**
   * 原生流式生成
   */
  async *generateNativeStream(
    request: OllamaGenerateRequest
  ): AsyncIterable<OllamaGenerateResponse> {
    const url = `${this.nativeBaseURL}/api/generate`;
    
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({ ...request, stream: true }),
    });
    
    const reader = response.body?.getReader();
    if (!reader) throw new AIError('No response body', 'NO_BODY', this.provider);
    
    const decoder = new TextDecoder();
    let buffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          yield JSON.parse(line);
        } catch {
          // 忽略解析错误
        }
      }
    }
    
    reader.releaseLock();
  }
  
  /**
   * 检查服务是否运行
   */
  async isRunning(): Promise<boolean> {
    try {
      const response = await fetch(`${this.nativeBaseURL}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
  
  /**
   * 获取服务版本
   */
  async getVersion(): Promise<string> {
    try {
      const response = await fetch(`${this.nativeBaseURL}/api/version`);
      const data = await response.json();
      return data.version;
    } catch {
      return 'unknown';
    }
  }
  
  // ==================== 辅助方法 ====================
  
  private getContextLength(parameterSize?: string): number {
    if (!parameterSize) return 4096;
    
    const size = parameterSize.toLowerCase();
    if (size.includes('70b') || size.includes('72b')) return 131072;
    if (size.includes('34b') || size.includes('32b')) return 32768;
    if (size.includes('13b') || size.includes('14b')) return 16384;
    if (size.includes('7b') || size.includes('8b')) return 8192;
    return 4096;
  }
  
  private supportsFunctions(model: string): boolean {
    const functionsModels = ['llama3', 'mistral', 'qwen2', 'deepseek'];
    return functionsModels.some(m => model.toLowerCase().includes(m));
  }
  
  private supportsVision(model: string): boolean {
    const visionModels = ['llava', 'bakllava', 'moondream', 'llama3.2-vision'];
    return visionModels.some(m => model.toLowerCase().includes(m));
  }
}
