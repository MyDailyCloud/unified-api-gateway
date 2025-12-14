/**
 * llama.cpp Server 适配器
 * llama.cpp Server Adapter
 * 
 * 支持 OpenAI 兼容 API 和 llama.cpp 原生端点
 */

import { OpenAIAdapter } from './openai-adapter';
import {
  AIProvider,
  ChatCompletionRequest,
  ProviderConfig,
  ModelInfo,
  AdapterCapabilities,
  AIError,
} from '../types';

// llama.cpp 扩展请求参数
export interface LlamaCppChatRequest extends ChatCompletionRequest {
  // llama.cpp 特有采样参数
  top_k?: number;
  min_p?: number;
  tfs_z?: number;
  typical_p?: number;
  repeat_penalty?: number;
  repeat_last_n?: number;
  penalize_nl?: boolean;
  presence_penalty?: number;
  frequency_penalty?: number;
  mirostat?: 0 | 1 | 2;
  mirostat_tau?: number;
  mirostat_eta?: number;
  
  // 语法约束
  grammar?: string;  // GBNF 格式
  json_schema?: object;
  
  // 其他
  seed?: number;
  n_predict?: number;
  n_keep?: number;
  cache_prompt?: boolean;
  slot_id?: number;
}

export interface LlamaCppSlot {
  id: number;
  task_id: number;
  state: 'idle' | 'processing';
  prompt?: string;
  model?: string;
  n_ctx?: number;
  n_predict?: number;
  n_past?: number;
  truncated?: boolean;
}

export interface LlamaCppServerProps {
  n_ctx: number;
  n_predict: number;
  n_batch: number;
  n_threads: number;
  n_threads_batch: number;
  model: string;
  model_alias: string;
  n_gpu_layers: number;
  main_gpu: number;
  tensor_split: number[];
  grp_attn_n: number;
  grp_attn_w: number;
  total_slots: number;
  chat_template: string;
}

export interface LlamaCppHealth {
  status: 'ok' | 'loading model' | 'error' | 'no slot available';
  slots_idle: number;
  slots_processing: number;
}

export class LlamaCppAdapter extends OpenAIAdapter {
  private nativeBaseURL: string;
  
  get provider(): AIProvider {
    return 'llamacpp' as AIProvider;
  }
  
  constructor(config: Omit<ProviderConfig, 'provider' | 'apiKey'> & { apiKey?: string }) {
    const baseURL = config.baseURL || 'http://localhost:8080';
    super({
      ...config,
      apiKey: config.apiKey || 'EMPTY',
      baseURL: `${baseURL}/v1`,
    });
    this.nativeBaseURL = baseURL;
    (this.config as ProviderConfig).provider = 'llamacpp' as AIProvider;
  }
  
  getCapabilities(): AdapterCapabilities {
    return {
      chat: true,
      streaming: true,
      embedding: true,   // 需要启用 --embedding 参数
      imageGeneration: false,
      speech: false,
      transcription: false,
      vision: true,      // llava 模型支持
      tools: false,      // 有限支持
    };
  }
  
  // ==================== llama.cpp 原生 API ====================
  
  /**
   * 健康检查
   */
  async health(): Promise<LlamaCppHealth> {
    const url = `${this.nativeBaseURL}/health`;
    
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(2000),
      });
      
      if (!response.ok) {
        return { status: 'error', slots_idle: 0, slots_processing: 0 };
      }
      
      return response.json();
    } catch {
      return { status: 'error', slots_idle: 0, slots_processing: 0 };
    }
  }
  
  /**
   * 获取服务器属性
   */
  async getProps(): Promise<LlamaCppServerProps> {
    const url = `${this.nativeBaseURL}/props`;
    
    const response = await this.fetchWithRetry(url, {
      method: 'GET',
      headers: this.buildHeaders(),
    });
    
    return response.json();
  }
  
  /**
   * 获取并发槽位信息
   */
  async getSlots(): Promise<LlamaCppSlot[]> {
    const url = `${this.nativeBaseURL}/slots`;
    
    try {
      const response = await this.fetchWithRetry(url, {
        method: 'GET',
        headers: this.buildHeaders(),
      });
      
      return response.json();
    } catch {
      return [];
    }
  }
  
  /**
   * 原生 completion 端点
   */
  async completion(request: {
    prompt: string;
    n_predict?: number;
    temperature?: number;
    top_k?: number;
    top_p?: number;
    min_p?: number;
    tfs_z?: number;
    typical_p?: number;
    repeat_penalty?: number;
    repeat_last_n?: number;
    penalize_nl?: boolean;
    presence_penalty?: number;
    frequency_penalty?: number;
    mirostat?: 0 | 1 | 2;
    mirostat_tau?: number;
    mirostat_eta?: number;
    grammar?: string;
    json_schema?: object;
    seed?: number;
    stop?: string[];
    stream?: boolean;
    cache_prompt?: boolean;
    slot_id?: number;
    image_data?: Array<{ data: string; id: number }>;
  }): Promise<{
    content: string;
    stop: boolean;
    generation_settings: Record<string, unknown>;
    model: string;
    prompt: string;
    stopped_eos: boolean;
    stopped_limit: boolean;
    stopped_word: boolean;
    stopping_word: string;
    timings: {
      prompt_n: number;
      prompt_ms: number;
      prompt_per_token_ms: number;
      prompt_per_second: number;
      predicted_n: number;
      predicted_ms: number;
      predicted_per_token_ms: number;
      predicted_per_second: number;
    };
    tokens_cached: number;
    tokens_evaluated: number;
    tokens_predicted: number;
    truncated: boolean;
  }> {
    const url = `${this.nativeBaseURL}/completion`;
    
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({ ...request, stream: false }),
    });
    
    return response.json();
  }
  
  /**
   * 流式 completion
   */
  async *completionStream(request: Parameters<typeof this.completion>[0]): AsyncIterable<{
    content: string;
    stop: boolean;
  }> {
    const url = `${this.nativeBaseURL}/completion`;
    
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
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        
        const data = trimmed.slice(6);
        if (data === '[DONE]') return;
        
        try {
          yield JSON.parse(data);
        } catch {
          // 忽略解析错误
        }
      }
    }
    
    reader.releaseLock();
  }
  
  /**
   * tokenize 文本
   */
  async tokenize(text: string): Promise<{ tokens: number[] }> {
    const url = `${this.nativeBaseURL}/tokenize`;
    
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({ content: text }),
    });
    
    return response.json();
  }
  
  /**
   * detokenize
   */
  async detokenize(tokens: number[]): Promise<{ content: string }> {
    const url = `${this.nativeBaseURL}/detokenize`;
    
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({ tokens }),
    });
    
    return response.json();
  }
  
  // ==================== 模型列表 ====================
  
  async listModels(): Promise<ModelInfo[]> {
    try {
      const props = await this.getProps();
      
      return [{
        id: props.model_alias || props.model,
        name: props.model_alias || props.model,
        provider: this.provider,
        contextLength: props.n_ctx,
        supportsStreaming: true,
        supportsFunctions: false,
        supportsVision: this.isLlavaModel(props.model),
      }];
    } catch {
      // 回退到 OpenAI 兼容端点
      return super.listModels();
    }
  }
  
  /**
   * 检查服务是否运行
   */
  async isRunning(): Promise<boolean> {
    const health = await this.health();
    return health.status === 'ok';
  }
  
  // ==================== 辅助方法 ====================
  
  private isLlavaModel(model: string): boolean {
    return model.toLowerCase().includes('llava') || 
           model.toLowerCase().includes('vision');
  }
}
