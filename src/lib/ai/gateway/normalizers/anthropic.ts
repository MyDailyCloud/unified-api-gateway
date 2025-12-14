/**
 * Anthropic Format Normalizer
 * Anthropic Claude 格式转换器
 */

import type {
  RequestNormalizer,
  UnifiedRequest,
  UnifiedResponse,
  UnifiedStreamChunk,
  AnthropicRequest,
  AnthropicResponse,
  AnthropicStreamEvent,
  AnthropicMessage,
  AnthropicContentBlock,
  AnthropicSystemBlock,
} from '../types';
import type { Message, MessageContent } from '../../types';

/**
 * Extract system message from unified messages
 */
function extractSystem(messages: Message[]): { system?: string; filtered: Message[] } {
  const systemMessages = messages.filter(m => m.role === 'system');
  const filtered = messages.filter(m => m.role !== 'system');
  
  if (systemMessages.length === 0) {
    return { filtered };
  }
  
  const system = systemMessages
    .map(m => typeof m.content === 'string' ? m.content : m.content.map(c => c.type === 'text' ? c.text : '').join(''))
    .join('\n\n');
  
  return { system, filtered };
}

/**
 * Convert unified message to Anthropic format
 */
function toAnthropicMessage(msg: Message): AnthropicMessage {
  const content: AnthropicContentBlock[] = [];
  
  if (typeof msg.content === 'string') {
    content.push({ type: 'text', text: msg.content });
  } else if (Array.isArray(msg.content)) {
    for (const part of msg.content) {
      if (part.type === 'text') {
        content.push({ type: 'text', text: part.text });
      } else if (part.type === 'image_url') {
        // Convert image URL to base64 if needed
        const url = part.image_url.url;
        if (url.startsWith('data:')) {
          const [header, data] = url.split(',');
          const mediaType = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
          content.push({
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data },
          });
        } else {
          // For URLs, we'd need to fetch and convert - for now use text description
          content.push({ type: 'text', text: `[Image: ${url}]` });
        }
      }
    }
  }
  
  // Handle tool calls
  if (msg.tool_calls) {
    for (const tc of msg.tool_calls) {
      content.push({
        type: 'tool_use',
        id: tc.id,
        name: tc.function.name,
        input: JSON.parse(tc.function.arguments || '{}'),
      });
    }
  }
  
  // Handle tool results
  if (msg.role === 'tool' && msg.tool_call_id) {
    return {
      role: 'user',
      content: [{
        type: 'tool_result',
        tool_use_id: msg.tool_call_id,
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
      }],
    };
  }
  
  return {
    role: msg.role === 'assistant' ? 'assistant' : 'user',
    content,
  };
}

/**
 * Convert Anthropic message to unified format
 */
function fromAnthropicMessage(msg: AnthropicMessage): Message {
  const content: { type: 'text'; text: string }[] = [];
  const toolCalls: Message['tool_calls'] = [];
  
  if (typeof msg.content === 'string') {
    content.push({ type: 'text', text: msg.content });
  } else if (Array.isArray(msg.content)) {
    for (const block of msg.content) {
      if (block.type === 'text' && block.text) {
        content.push({ type: 'text', text: block.text });
      } else if (block.type === 'tool_use' && block.id && block.name) {
        toolCalls.push({
          id: block.id,
          type: 'function',
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input || {}),
          },
        });
      }
    }
  }
  
  const message: Message = {
    role: msg.role === 'assistant' ? 'assistant' : 'user',
    content: content.length === 1 ? content[0].text : content,
  };
  
  if (toolCalls.length > 0) {
    message.tool_calls = toolCalls;
  }
  
  return message;
}

export const anthropicNormalizer: RequestNormalizer<AnthropicRequest, AnthropicResponse, AnthropicStreamEvent> = {
  format: 'anthropic',
  
  normalize(request: AnthropicRequest): UnifiedRequest {
    // Extract system from Anthropic format
    let systemContent = '';
    if (typeof request.system === 'string') {
      systemContent = request.system;
    } else if (Array.isArray(request.system)) {
      systemContent = request.system.map(b => b.text).join('\n\n');
    }
    
    const messages: Message[] = [];
    
    if (systemContent) {
      messages.push({ role: 'system', content: systemContent });
    }
    
    for (const msg of request.messages) {
      messages.push(fromAnthropicMessage(msg));
    }
    
    // Convert tool choice
    let toolChoice: UnifiedRequest['tool_choice'];
    if (request.tool_choice) {
      if (request.tool_choice.type === 'auto') {
        toolChoice = 'auto';
      } else if (request.tool_choice.type === 'any') {
        toolChoice = 'required';
      } else if (request.tool_choice.type === 'tool' && request.tool_choice.name) {
        toolChoice = { type: 'function', function: { name: request.tool_choice.name } };
      }
    }
    
    return {
      model: request.model,
      messages,
      max_tokens: request.max_tokens,
      temperature: request.temperature,
      top_p: request.top_p,
      top_k: request.top_k,
      stop: request.stop_sequences,
      stream: request.stream,
      user: request.metadata?.user_id,
      tools: request.tools?.map(t => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      })),
      tool_choice: toolChoice,
    };
  },
  
  denormalize(response: UnifiedResponse): AnthropicResponse {
    const content: AnthropicContentBlock[] = [];
    const choice = response.choices[0];
    
    if (choice.message.content) {
      content.push({ type: 'text', text: choice.message.content });
    }
    
    if (choice.message.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        content.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments || '{}'),
        });
      }
    }
    
    // Map finish reason
    let stopReason: AnthropicResponse['stop_reason'] = 'end_turn';
    if (choice.finish_reason === 'length') {
      stopReason = 'max_tokens';
    } else if (choice.finish_reason === 'tool_calls') {
      stopReason = 'tool_use';
    }
    
    return {
      id: response.id,
      type: 'message',
      role: 'assistant',
      content,
      model: response.model,
      stop_reason: stopReason,
      usage: {
        input_tokens: response.usage.prompt_tokens,
        output_tokens: response.usage.completion_tokens,
      },
    };
  },
  
  denormalizeStream(chunk: UnifiedStreamChunk): AnthropicStreamEvent {
    const choice = chunk.choices[0];
    
    if (choice.delta.content) {
      return {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: choice.delta.content },
      };
    }
    
    if (choice.finish_reason) {
      return { type: 'message_stop' };
    }
    
    return { type: 'ping' };
  },
  
  validate(request: unknown): request is AnthropicRequest {
    if (!request || typeof request !== 'object') return false;
    const r = request as Record<string, unknown>;
    return typeof r.model === 'string' && Array.isArray(r.messages) && typeof r.max_tokens === 'number';
  },
};

export default anthropicNormalizer;
