/**
 * Universal AI Gateway
 * 统一 AI 网关核心类
 */

import type {
  GatewayConfig,
  BackendConfig,
  RequestFormat,
  ResponseFormat,
  RequestNormalizer,
  UnifiedRequest,
  UnifiedResponse,
  UnifiedStreamChunk,
  GatewayMiddleware,
  MiddlewareContext,
  RequestHandler,
  CorsConfig,
} from './types';
import { GatewayRouter } from './router';
import { getNormalizer, normalizers } from './normalizers';
import { AIClient } from '../client';
import type { ChatCompletionRequest, ChatCompletionResponse, StreamChunk, ProviderConfig } from '../types';

export class AIGateway {
  private client: AIClient;
  private router: GatewayRouter;
  private normalizers: Map<RequestFormat, RequestNormalizer> = new Map();
  private middleware: GatewayMiddleware[] = [];
  private modelAliases: Map<string, string> = new Map();
  private corsConfig: CorsConfig;
  private logging: boolean;
  
  constructor(private config: GatewayConfig) {
    this.client = new AIClient();
    this.router = new GatewayRouter(config.routing);
    this.corsConfig = config.cors || { origins: ['*'] };
    this.logging = config.logging ?? false;
    
    this.initializeBackends(config.backends);
    this.initializeNormalizers();
    this.initializeAliases(config.modelAliases);
    
    if (config.middleware) {
      this.middleware = config.middleware;
    }
  }
  
  /**
   * Initialize backend providers
   */
  private initializeBackends(backends: BackendConfig[]): void {
    for (const backend of backends) {
      const providerConfig: ProviderConfig = {
        provider: backend.provider,
        apiKey: backend.apiKey || '',
        baseURL: backend.baseURL,
      };
      
      this.client.registerProvider(providerConfig);
    }
    
    this.router.setBackends(backends);
  }
  
  /**
   * Initialize format normalizers
   */
  private initializeNormalizers(): void {
    for (const [format, normalizer] of Object.entries(normalizers)) {
      this.normalizers.set(format as RequestFormat, normalizer);
    }
  }
  
  /**
   * Initialize model aliases
   */
  private initializeAliases(aliases?: Record<string, string>): void {
    if (aliases) {
      for (const [alias, target] of Object.entries(aliases)) {
        this.modelAliases.set(alias, target);
      }
    }
  }
  
  /**
   * Add middleware
   */
  use(middleware: GatewayMiddleware): this {
    this.middleware.push(middleware);
    return this;
  }
  
  /**
   * Handle non-streaming request
   */
  async handleRequest(
    request: unknown,
    format: RequestFormat,
    responseFormat?: ResponseFormat
  ): Promise<unknown> {
    const startTime = Date.now();
    const outFormat = responseFormat || format;
    
    const context: MiddlewareContext = {
      requestFormat: format,
      responseFormat: outFormat,
      startTime,
    };
    
    try {
      // 1. Run onRequest middleware
      let processedRequest = request;
      for (const mw of this.middleware) {
        if (mw.onRequest) {
          processedRequest = await mw.onRequest(processedRequest, format);
        }
      }
      
      // 2. Normalize request
      const normalizer = this.getNormalizer(format);
      let unified = normalizer.normalize(processedRequest);
      
      // 3. Apply model alias
      unified.model = this.resolveModelAlias(unified.model);
      
      // 4. Run onUnifiedRequest middleware
      for (const mw of this.middleware) {
        if (mw.onUnifiedRequest) {
          unified = await mw.onUnifiedRequest(unified);
        }
      }
      
      // 5. Route to backend
      const backend = this.router.selectBackend(unified);
      context.backend = backend;
      
      if (this.logging) {
        console.log(`[AIGateway] Routing to ${backend.name} (${backend.provider})`);
      }
      
      // 6. Execute request
      const chatRequest = this.toChatRequest(unified);
      const response = await this.client.chat(chatRequest, backend.provider);
      
      // 7. Report latency
      this.router.reportLatency(backend.name, Date.now() - startTime);
      
      // 8. Convert to unified response
      let unifiedResponse = this.toUnifiedResponse(response, unified.model);
      
      // 9. Run onUnifiedResponse middleware
      for (const mw of this.middleware) {
        if (mw.onUnifiedResponse) {
          unifiedResponse = await mw.onUnifiedResponse(unifiedResponse);
        }
      }
      
      // 10. Denormalize to output format
      const outputNormalizer = this.getNormalizer(outFormat);
      let output = outputNormalizer.denormalize(unifiedResponse);
      
      // 11. Run onResponse middleware
      for (const mw of this.middleware) {
        if (mw.onResponse) {
          output = await mw.onResponse(output, outFormat);
        }
      }
      
      return output;
    } catch (error) {
      // Report failure
      if (context.backend) {
        this.router.reportFailure(context.backend.name, error as Error);
      }
      
      // Run onError middleware
      for (const mw of this.middleware) {
        if (mw.onError) {
          await mw.onError(error as Error, context);
        }
      }
      
      // Retry with fallback if configured
      if (this.config.routing?.autoFailover && this.config.routing.fallbackOrder) {
        return this.handleWithFallback(request, format, responseFormat, context);
      }
      
      throw error;
    }
  }
  
  /**
   * Handle streaming request
   */
  async *handleStreamRequest(
    request: unknown,
    format: RequestFormat,
    responseFormat?: ResponseFormat
  ): AsyncIterable<unknown> {
    const startTime = Date.now();
    const outFormat = responseFormat || format;
    
    const context: MiddlewareContext = {
      requestFormat: format,
      responseFormat: outFormat,
      startTime,
    };
    
    try {
      // 1. Normalize request
      const normalizer = this.getNormalizer(format);
      let unified = normalizer.normalize(request);
      unified.stream = true;
      
      // 2. Apply model alias
      unified.model = this.resolveModelAlias(unified.model);
      
      // 3. Run onUnifiedRequest middleware
      for (const mw of this.middleware) {
        if (mw.onUnifiedRequest) {
          unified = await mw.onUnifiedRequest(unified);
        }
      }
      
      // 4. Route to backend
      const backend = this.router.selectBackend(unified);
      context.backend = backend;
      
      if (this.logging) {
        console.log(`[AIGateway] Streaming from ${backend.name} (${backend.provider})`);
      }
      
      // 5. Execute streaming request
      const chatRequest = this.toChatRequest(unified);
      const outputNormalizer = this.getNormalizer(outFormat);
      
      for await (const chunk of this.client.chatStream(chatRequest, backend.provider)) {
        const unifiedChunk = this.toUnifiedStreamChunk(chunk, unified.model);
        yield outputNormalizer.denormalizeStream(unifiedChunk);
      }
      
      // 6. Report latency
      this.router.reportLatency(backend.name, Date.now() - startTime);
    } catch (error) {
      if (context.backend) {
        this.router.reportFailure(context.backend.name, error as Error);
      }
      
      for (const mw of this.middleware) {
        if (mw.onError) {
          await mw.onError(error as Error, context);
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Handle request with fallback chain
   */
  private async handleWithFallback(
    request: unknown,
    format: RequestFormat,
    responseFormat: ResponseFormat | undefined,
    context: MiddlewareContext
  ): Promise<unknown> {
    const fallbackOrder = this.config.routing?.fallbackOrder || [];
    const maxRetries = this.config.routing?.maxRetries || fallbackOrder.length;
    const retryDelay = this.config.routing?.retryDelay || 1000;
    
    for (let i = 0; i < Math.min(maxRetries, fallbackOrder.length); i++) {
      const backendName = fallbackOrder[i];
      
      // Skip already tried backend
      if (backendName === context.backend?.name) continue;
      
      // Skip unhealthy backends
      if (!this.router.isHealthy(backendName)) continue;
      
      try {
        if (this.logging) {
          console.log(`[AIGateway] Falling back to ${backendName}`);
        }
        
        // Wait before retry
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
        
        // Normalize and retry
        const normalizer = this.getNormalizer(format);
        const unified = normalizer.normalize(request);
        unified.model = this.resolveModelAlias(unified.model);
        
        const backend = this.config.backends.find(b => b.name === backendName);
        if (!backend) continue;
        
        const chatRequest = this.toChatRequest(unified);
        const response = await this.client.chat(chatRequest, backend.provider);
        
        const unifiedResponse = this.toUnifiedResponse(response, unified.model);
        const outputNormalizer = this.getNormalizer(responseFormat || format);
        
        return outputNormalizer.denormalize(unifiedResponse);
      } catch (error) {
        this.router.reportFailure(backendName, error as Error);
      }
    }
    
    throw new Error('All fallback backends failed');
  }
  
  /**
   * Create HTTP request handler for a specific format
   */
  createHandler(format: RequestFormat): RequestHandler {
    return async (req: Request): Promise<Response> => {
      // Handle CORS preflight
      if (req.method === 'OPTIONS') {
        return this.corsResponse();
      }
      
      try {
        const body = await req.json();
        const stream = body.stream ?? false;
        
        // Check for response format override
        const responseFormat = req.headers.get('X-Response-Format') as ResponseFormat | null;
        
        if (stream) {
          return this.handleStreamingResponse(body, format, responseFormat || undefined);
        } else {
          const response = await this.handleRequest(body, format, responseFormat || undefined);
          return new Response(JSON.stringify(response), {
            headers: {
              ...this.corsHeaders(),
              'Content-Type': 'application/json',
            },
          });
        }
      } catch (error) {
        console.error('[AIGateway] Error:', error);
        return new Response(
          JSON.stringify({ error: { message: (error as Error).message } }),
          {
            status: 500,
            headers: {
              ...this.corsHeaders(),
              'Content-Type': 'application/json',
            },
          }
        );
      }
    };
  }
  
  /**
   * Create unified handler that routes based on path
   */
  createUnifiedHandler(): RequestHandler {
    return async (req: Request): Promise<Response> => {
      const url = new URL(req.url);
      const path = url.pathname;
      
      // Determine format from path
      let format: RequestFormat = 'openai';
      
      if (path.includes('/openai/') || path.includes('/v1/chat/completions')) {
        format = 'openai';
      } else if (path.includes('/anthropic/') || path.includes('/messages')) {
        format = 'anthropic';
      } else if (path.includes('/google/') || path.includes('/gemini/')) {
        format = 'google';
      } else if (path.includes('/cohere/')) {
        format = 'cohere';
      }
      
      return this.createHandler(format)(req);
    };
  }
  
  /**
   * Handle streaming response
   */
  private async handleStreamingResponse(
    body: unknown,
    format: RequestFormat,
    responseFormat?: ResponseFormat
  ): Promise<Response> {
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      start: async (controller) => {
        try {
          for await (const chunk of this.handleStreamRequest(body, format, responseFormat)) {
            const data = `data: ${JSON.stringify(chunk)}\n\n`;
            controller.enqueue(encoder.encode(data));
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          const errorData = `data: ${JSON.stringify({ error: { message: (error as Error).message } })}\n\n`;
          controller.enqueue(encoder.encode(errorData));
          controller.close();
        }
      },
    });
    
    return new Response(stream, {
      headers: {
        ...this.corsHeaders(),
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }
  
  /**
   * CORS response
   */
  private corsResponse(): Response {
    return new Response(null, {
      status: 204,
      headers: this.corsHeaders(),
    });
  }
  
  /**
   * CORS headers
   */
  private corsHeaders(): Record<string, string> {
    return {
      'Access-Control-Allow-Origin': this.corsConfig.origins?.join(', ') || '*',
      'Access-Control-Allow-Methods': this.corsConfig.methods?.join(', ') || 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': this.corsConfig.headers?.join(', ') || 'Content-Type, Authorization, X-Response-Format',
      ...(this.corsConfig.credentials && { 'Access-Control-Allow-Credentials': 'true' }),
    };
  }
  
  // =========================================================================
  // Helper Methods
  // =========================================================================
  
  private getNormalizer(format: RequestFormat): RequestNormalizer {
    const normalizer = this.normalizers.get(format);
    if (!normalizer) {
      throw new Error(`Unknown format: ${format}`);
    }
    return normalizer;
  }
  
  private resolveModelAlias(model: string): string {
    return this.modelAliases.get(model) || model;
  }
  
  private toChatRequest(unified: UnifiedRequest): ChatCompletionRequest {
    return {
      model: unified.model,
      messages: unified.messages,
      max_tokens: unified.max_tokens,
      temperature: unified.temperature,
      top_p: unified.top_p,
      stop: unified.stop,
      stream: unified.stream,
      tools: unified.tools?.map(t => ({
        type: 'function' as const,
        function: {
          name: t.function.name,
          description: t.function.description || '',
          parameters: t.function.parameters || {},
        },
      })),
      tool_choice: unified.tool_choice === 'required' ? 'auto' : unified.tool_choice,
    };
  }
  
  private toUnifiedResponse(response: ChatCompletionResponse, model: string): UnifiedResponse {
    return {
      id: response.id,
      object: 'chat.completion',
      created: response.created,
      model: response.model || model,
      choices: response.choices.map((c, i) => ({
        index: i,
        message: {
          role: 'assistant' as const,
          content: typeof c.message.content === 'string' ? c.message.content : null,
          tool_calls: c.message.tool_calls,
        },
        finish_reason: (c.finish_reason || 'stop') as 'stop' | 'length' | 'tool_calls' | 'content_filter',
      })),
      usage: response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };
  }
  
  private toUnifiedStreamChunk(chunk: StreamChunk, model: string): UnifiedStreamChunk {
    return {
      id: chunk.id || `chunk_${Date.now()}`,
      object: 'chat.completion.chunk',
      created: chunk.created || Math.floor(Date.now() / 1000),
      model: chunk.model || model,
      choices: [{
        index: 0,
        delta: {
          role: chunk.choices[0]?.delta?.role as 'assistant' | undefined,
          content: chunk.choices[0]?.delta?.content,
          tool_calls: chunk.choices[0]?.delta?.tool_calls,
        },
        finish_reason: (chunk.choices[0]?.finish_reason || null) as 'stop' | 'length' | 'tool_calls' | 'content_filter' | null,
      }],
    };
  }
  
  // =========================================================================
  // Public Accessors
  // =========================================================================
  
  /**
   * Get router statistics
   */
  getStats() {
    return this.router.getStats();
  }
  
  /**
   * Get client instance
   */
  getClient(): AIClient {
    return this.client;
  }
  
  /**
   * Get router instance
   */
  getRouter(): GatewayRouter {
    return this.router;
  }
  
  /**
   * Add model alias
   */
  addAlias(alias: string, target: string): this {
    this.modelAliases.set(alias, target);
    return this;
  }
}

/**
 * Create AI Gateway
 */
export function createAIGateway(config: GatewayConfig): AIGateway {
  return new AIGateway(config);
}

export default AIGateway;
