/**
 * Azure OpenAI 适配器
 * Azure OpenAI Adapter - Compatible with Azure's deployment-based API
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

export interface AzureProviderConfig extends Omit<ProviderConfig, 'provider'> {
  deploymentId: string;
  apiVersion?: string;
  resourceName?: string;
}

export class AzureAdapter extends BaseAdapter {
  private deploymentId: string;
  private apiVersion: string;
  private resourceName?: string;

  get provider(): AIProvider {
    return 'azure';
  }

  constructor(config: AzureProviderConfig) {
    const resourceName = config.resourceName;
    const baseURL = config.baseURL || 
      (resourceName ? `https://${resourceName}.openai.azure.com` : undefined);

    super({
      ...config,
      provider: 'azure',
      baseURL,
    });

    this.deploymentId = config.deploymentId;
    this.apiVersion = config.apiVersion || '2024-02-01';
    this.resourceName = config.resourceName;
  }

  protected buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'api-key': this.config.apiKey,
      ...this.config.headers,
    };
  }

  private getEndpointUrl(stream = false): string {
    const endpoint = `${this.config.baseURL}/openai/deployments/${this.deploymentId}/chat/completions`;
    return `${endpoint}?api-version=${this.apiVersion}`;
  }

  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const url = this.getEndpointUrl();
    
    const body = this.normalizeRequest(request);
    
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
    });

    return response.json();
  }

  async *chatStream(request: ChatCompletionRequest): AsyncIterable<StreamChunk> {
    const url = this.getEndpointUrl(true);
    
    const body = this.normalizeRequest({ ...request, stream: true });
    
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
    });

    yield* this.parseSSEStream(response);
  }

  async listModels(): Promise<ModelInfo[]> {
    // Azure doesn't have a list models endpoint like OpenAI
    // Return the deployment as the available model
    return [{
      id: this.deploymentId,
      name: this.deploymentId,
      provider: 'azure',
      contextLength: 128000,
      maxOutputTokens: 4096,
      supportsVision: true,
      supportsStreaming: true,
      supportsFunctions: true,
    }];
  }

  private normalizeRequest(request: ChatCompletionRequest): Record<string, unknown> {
    const { model, ...rest } = request;
    
    // Azure uses deployment ID instead of model name
    return {
      ...rest,
      // Optionally pass model for tracking purposes
      ...(model && model !== this.deploymentId ? { model } : {}),
    };
  }

  /**
   * 获取部署配置
   */
  getDeploymentInfo(): { deploymentId: string; apiVersion: string; resourceName?: string } {
    return {
      deploymentId: this.deploymentId,
      apiVersion: this.apiVersion,
      resourceName: this.resourceName,
    };
  }

  /**
   * 更新部署 ID
   */
  setDeploymentId(deploymentId: string): void {
    this.deploymentId = deploymentId;
  }

  /**
   * 更新 API 版本
   */
  setApiVersion(apiVersion: string): void {
    this.apiVersion = apiVersion;
  }
}
