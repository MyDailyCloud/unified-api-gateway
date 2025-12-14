/**
 * OpenRouter 适配器
 * OpenRouter Adapter
 * 
 * 统一 API 网关，支持多种 AI 模型
 */

import { OpenAIAdapter } from './openai-adapter';
import {
  AIProvider,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ProviderConfig,
  ModelInfo,
  AdapterCapabilities,
} from '../types';

// OpenRouter 模型信息
export interface OpenRouterModel {
  id: string;
  name: string;
  description: string;
  pricing: {
    prompt: string;  // 价格字符串，如 "0.00001"
    completion: string;
    request?: string;
    image?: string;
  };
  context_length: number;
  architecture: {
    modality: string;
    tokenizer: string;
    instruct_type: string | null;
  };
  top_provider: {
    context_length: number;
    max_completion_tokens: number | null;
    is_moderated: boolean;
  };
  per_request_limits: {
    prompt_tokens: string;
    completion_tokens: string;
  } | null;
}

export interface OpenRouterGenerationStats {
  data: Array<{
    id: string;
    model: string;
    created_at: string;
    tokens_prompt: number;
    tokens_completion: number;
    total_cost: number;
    cache_discount: number;
    origin?: string;
    latency?: number;
  }>;
}

export interface OpenRouterConfig extends Omit<ProviderConfig, 'provider'> {
  siteUrl?: string;
  siteName?: string;
}

export class OpenRouterAdapter extends OpenAIAdapter {
  private siteUrl?: string;
  private siteName?: string;
  
  get provider(): AIProvider {
    return 'openrouter' as AIProvider;
  }
  
  constructor(config: OpenRouterConfig) {
    super({
      ...config,
      baseURL: config.baseURL || 'https://openrouter.ai/api/v1',
    });
    this.siteUrl = config.siteUrl;
    this.siteName = config.siteName;
    (this.config as ProviderConfig).provider = 'openrouter' as AIProvider;
  }
  
  getCapabilities(): AdapterCapabilities {
    return {
      chat: true,
      streaming: true,
      embedding: false,  // OpenRouter 不支持嵌入
      imageGeneration: true,  // 部分模型支持
      speech: false,
      transcription: false,
      vision: true,
      tools: true,
    };
  }
  
  protected buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      ...super.buildHeaders(),
    };
    
    // OpenRouter 特有 headers
    if (this.siteUrl) {
      headers['HTTP-Referer'] = this.siteUrl;
    }
    if (this.siteName) {
      headers['X-Title'] = this.siteName;
    }
    
    return headers;
  }
  
  // ==================== Chat (带扩展参数) ====================
  
  async chat(request: ChatCompletionRequest & {
    route?: 'fallback' | string;
    transforms?: string[];
    models?: string[];
    provider?: {
      order?: string[];
      require_parameters?: boolean;
      data_collection?: 'deny' | 'allow';
      allow_fallbacks?: boolean;
      quantizations?: string[];
    };
  }): Promise<ChatCompletionResponse> {
    return super.chat(request);
  }
  
  // ==================== OpenRouter 特有 API ====================
  
  /**
   * 获取所有可用模型
   */
  async listAvailableModels(): Promise<OpenRouterModel[]> {
    const url = 'https://openrouter.ai/api/v1/models';
    
    const response = await this.fetchWithRetry(url, {
      method: 'GET',
      headers: this.buildHeaders(),
    });
    
    const data = await response.json();
    return data.data || [];
  }
  
  /**
   * 获取模型列表 (转换为标准格式)
   */
  async listModels(): Promise<ModelInfo[]> {
    const models = await this.listAvailableModels();
    
    return models.map(model => ({
      id: model.id,
      name: model.name,
      provider: this.provider,
      contextLength: model.context_length,
      supportsStreaming: true,
      supportsFunctions: this.checkFunctionsSupport(model.id),
      supportsVision: this.checkVisionSupport(model),
      pricing: {
        inputPer1kTokens: parseFloat(model.pricing.prompt) * 1000,
        outputPer1kTokens: parseFloat(model.pricing.completion) * 1000,
      },
    }));
  }
  
  /**
   * 获取生成统计信息
   */
  async getGenerationStats(): Promise<OpenRouterGenerationStats> {
    const url = 'https://openrouter.ai/api/v1/auth/key';
    
    const response = await this.fetchWithRetry(url, {
      method: 'GET',
      headers: this.buildHeaders(),
    });
    
    return response.json();
  }
  
  /**
   * 获取 API Key 信息
   */
  async getKeyInfo(): Promise<{
    data: {
      label: string;
      usage: number;
      limit: number | null;
      is_free_tier: boolean;
      rate_limit: {
        requests: number;
        interval: string;
      };
    };
  }> {
    const url = 'https://openrouter.ai/api/v1/auth/key';
    
    const response = await this.fetchWithRetry(url, {
      method: 'GET',
      headers: this.buildHeaders(),
    });
    
    return response.json();
  }
  
  /**
   * 获取特定模型的端点
   */
  async getModelEndpoints(modelId: string): Promise<Array<{
    provider: string;
    context_length: number;
    latency: number;
    is_available: boolean;
  }>> {
    const url = `https://openrouter.ai/api/v1/models/${encodeURIComponent(modelId)}/endpoints`;
    
    try {
      const response = await this.fetchWithRetry(url, {
        method: 'GET',
        headers: this.buildHeaders(),
      });
      
      const data = await response.json();
      return data.data || [];
    } catch {
      return [];
    }
  }
  
  // ==================== 辅助方法 ====================
  
  private checkFunctionsSupport(modelId: string): boolean {
    const lower = modelId.toLowerCase();
    // 大多数 GPT-4/Claude/Gemini 模型都支持函数调用
    const functionModels = ['gpt-4', 'gpt-3.5-turbo', 'claude', 'gemini', 'mistral', 'command'];
    return functionModels.some(m => lower.includes(m));
  }
  
  private checkVisionSupport(model: OpenRouterModel): boolean {
    // 检查模态或模型名称
    if (model.architecture.modality?.includes('image')) return true;
    
    const lower = model.id.toLowerCase();
    const visionModels = ['vision', 'gpt-4o', 'gemini-pro-vision', 'claude-3', 'llava'];
    return visionModels.some(m => lower.includes(m));
  }
}
