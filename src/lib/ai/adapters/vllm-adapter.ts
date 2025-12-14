/**
 * vLLM 适配器 - 高性能推理引擎
 * vLLM Adapter - High-Performance Inference Engine
 * 
 * 支持 OpenAI 兼容 API 和 vLLM 特有功能
 */

import { OpenAIAdapter } from './openai-adapter';
import {
  AIProvider,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ProviderConfig,
  ModelInfo,
  AdapterCapabilities,
  AIError,
} from '../types';

// vLLM 特有类型
export interface VLLMMetrics {
  // GPU 指标
  gpu_cache_usage_perc: number;
  cpu_cache_usage_perc: number;
  
  // 请求指标
  num_requests_running: number;
  num_requests_waiting: number;
  num_requests_swapped: number;
  
  // 吞吐量
  avg_prompt_throughput_toks_per_s: number;
  avg_generation_throughput_toks_per_s: number;
  
  // 延迟
  avg_time_to_first_token_ms?: number;
  avg_time_per_output_token_ms?: number;
}

export interface VLLMModelInfo {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  root: string;
  parent: string | null;
  max_model_len: number;
  permission: unknown[];
}

// vLLM 扩展的聊天请求参数
export interface VLLMChatRequest extends ChatCompletionRequest {
  // vLLM 特有采样参数
  best_of?: number;
  use_beam_search?: boolean;
  top_k?: number;
  min_p?: number;
  repetition_penalty?: number;
  length_penalty?: number;
  early_stopping?: boolean;
  
  // 结构化输出
  guided_json?: object;
  guided_regex?: string;
  guided_choice?: string[];
  guided_grammar?: string;
  guided_decoding_backend?: string;
  
  // 其他
  ignore_eos?: boolean;
  skip_special_tokens?: boolean;
  spaces_between_special_tokens?: boolean;
  truncate_prompt_tokens?: number;
  
  // LoRA
  lora_request?: {
    lora_name: string;
    lora_int_id?: number;
    lora_local_path?: string;
  };
}

export interface VLLMCompletionRequest {
  model: string;
  prompt: string | string[];
  suffix?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  n?: number;
  stream?: boolean;
  logprobs?: number;
  echo?: boolean;
  stop?: string | string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  best_of?: number;
  logit_bias?: Record<string, number>;
  user?: string;
  
  // vLLM 特有
  top_k?: number;
  min_p?: number;
  repetition_penalty?: number;
  length_penalty?: number;
  use_beam_search?: boolean;
  early_stopping?: boolean;
  guided_json?: object;
  guided_regex?: string;
  guided_choice?: string[];
}

export class VLLMAdapter extends OpenAIAdapter {
  get provider(): AIProvider {
    return 'vllm' as AIProvider;
  }
  
  constructor(config: Omit<ProviderConfig, 'provider' | 'apiKey'> & { apiKey?: string }) {
    super({
      ...config,
      apiKey: config.apiKey || 'EMPTY', // vLLM 默认不需要 API Key
      baseURL: config.baseURL || 'http://localhost:8000/v1',
    });
    // Override provider
    (this.config as ProviderConfig).provider = 'vllm' as AIProvider;
  }
  
  getCapabilities(): AdapterCapabilities {
    return {
      chat: true,
      streaming: true,
      embedding: true,  // 取决于加载的模型
      imageGeneration: false,
      speech: false,
      transcription: false,
      vision: true,     // 取决于加载的模型
      tools: true,      // 支持 function calling
    };
  }
  
  // ==================== 扩展 Chat ====================
  
  async chat(request: VLLMChatRequest): Promise<ChatCompletionResponse> {
    const url = `${this.config.baseURL}/chat/completions`;
    
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({ ...request, stream: false }),
    });
    
    return response.json();
  }
  
  // ==================== Completions API ====================
  
  async complete(request: VLLMCompletionRequest): Promise<{
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
      text: string;
      index: number;
      logprobs: null | { tokens: string[]; token_logprobs: number[] };
      finish_reason: string;
    }>;
    usage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  }> {
    const url = `${this.config.baseURL}/completions`;
    
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({ ...request, stream: false }),
    });
    
    return response.json();
  }
  
  // ==================== vLLM 特有 API ====================
  
  /**
   * 获取服务器指标
   */
  async getMetrics(): Promise<VLLMMetrics> {
    // vLLM 的 metrics 端点返回 Prometheus 格式
    // 需要解析转换
    const baseURL = this.config.baseURL?.replace('/v1', '') || 'http://localhost:8000';
    const url = `${baseURL}/metrics`;
    
    try {
      const response = await fetch(url);
      const text = await response.text();
      return this.parsePrometheusMetrics(text);
    } catch (error) {
      throw new AIError(
        'Failed to get vLLM metrics',
        'METRICS_ERROR',
        this.provider
      );
    }
  }
  
  /**
   * 获取已加载的模型列表
   */
  async listLoadedModels(): Promise<VLLMModelInfo[]> {
    const url = `${this.config.baseURL}/models`;
    
    const response = await this.fetchWithRetry(url, {
      method: 'GET',
      headers: this.buildHeaders(),
    });
    
    const data = await response.json();
    return data.data || [];
  }
  
  /**
   * 获取模型信息
   */
  async getModelInfo(modelId?: string): Promise<VLLMModelInfo | null> {
    const models = await this.listLoadedModels();
    if (modelId) {
      return models.find(m => m.id === modelId) || null;
    }
    return models[0] || null;
  }
  
  /**
   * 健康检查
   */
  async health(): Promise<boolean> {
    const baseURL = this.config.baseURL?.replace('/v1', '') || 'http://localhost:8000';
    try {
      const response = await fetch(`${baseURL}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
  
  /**
   * 检查服务版本
   */
  async getVersion(): Promise<string> {
    const baseURL = this.config.baseURL?.replace('/v1', '') || 'http://localhost:8000';
    try {
      const response = await fetch(`${baseURL}/version`);
      const data = await response.json();
      return data.version || 'unknown';
    } catch {
      return 'unknown';
    }
  }
  
  // ==================== 模型列表 ====================
  
  async listModels(): Promise<ModelInfo[]> {
    const models = await this.listLoadedModels();
    
    return models.map(model => ({
      id: model.id,
      name: model.id,
      provider: this.provider,
      contextLength: model.max_model_len || 4096,
      supportsStreaming: true,
      supportsFunctions: true,
      supportsVision: this.isVisionModel(model.id),
    }));
  }
  
  // ==================== 辅助方法 ====================
  
  private parsePrometheusMetrics(text: string): VLLMMetrics {
    const metrics: Partial<VLLMMetrics> = {};
    const lines = text.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('#')) continue;
      
      const match = line.match(/^(\w+)(?:\{[^}]*\})?\s+([\d.]+)/);
      if (!match) continue;
      
      const [, name, value] = match;
      const numValue = parseFloat(value);
      
      switch (name) {
        case 'vllm:gpu_cache_usage_perc':
          metrics.gpu_cache_usage_perc = numValue;
          break;
        case 'vllm:cpu_cache_usage_perc':
          metrics.cpu_cache_usage_perc = numValue;
          break;
        case 'vllm:num_requests_running':
          metrics.num_requests_running = numValue;
          break;
        case 'vllm:num_requests_waiting':
          metrics.num_requests_waiting = numValue;
          break;
        case 'vllm:num_requests_swapped':
          metrics.num_requests_swapped = numValue;
          break;
        case 'vllm:avg_prompt_throughput_toks_per_s':
          metrics.avg_prompt_throughput_toks_per_s = numValue;
          break;
        case 'vllm:avg_generation_throughput_toks_per_s':
          metrics.avg_generation_throughput_toks_per_s = numValue;
          break;
        case 'vllm:e2e_request_latency_seconds':
          // 转换为毫秒
          break;
      }
    }
    
    return {
      gpu_cache_usage_perc: metrics.gpu_cache_usage_perc ?? 0,
      cpu_cache_usage_perc: metrics.cpu_cache_usage_perc ?? 0,
      num_requests_running: metrics.num_requests_running ?? 0,
      num_requests_waiting: metrics.num_requests_waiting ?? 0,
      num_requests_swapped: metrics.num_requests_swapped ?? 0,
      avg_prompt_throughput_toks_per_s: metrics.avg_prompt_throughput_toks_per_s ?? 0,
      avg_generation_throughput_toks_per_s: metrics.avg_generation_throughput_toks_per_s ?? 0,
    };
  }
  
  private isVisionModel(modelId: string): boolean {
    const visionPatterns = ['llava', 'qwen-vl', 'internvl', 'cogvlm', 'phi-3-vision'];
    return visionPatterns.some(p => modelId.toLowerCase().includes(p));
  }
}
