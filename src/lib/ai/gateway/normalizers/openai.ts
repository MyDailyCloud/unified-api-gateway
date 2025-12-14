/**
 * OpenAI Format Normalizer
 * OpenAI 格式转换器
 */

import type {
  RequestNormalizer,
  UnifiedRequest,
  UnifiedResponse,
  UnifiedStreamChunk,
  OpenAIRequest,
  OpenAIResponse,
  OpenAIMessage,
  OpenAIContentPart,
} from '../types';
import type { Message, MessageContent } from '../../types';

/**
 * Convert OpenAI message to unified format
 */
function normalizeMessage(msg: OpenAIMessage): Message {
  let content: MessageContent;
  
  if (typeof msg.content === 'string') {
    content = msg.content;
  } else if (Array.isArray(msg.content)) {
    content = msg.content.map((part: OpenAIContentPart) => {
      if (part.type === 'text') {
        return { type: 'text' as const, text: part.text || '' };
      }
      if (part.type === 'image_url') {
        return {
          type: 'image_url' as const,
          image_url: { url: part.image_url?.url || '' },
        };
      }
      return { type: 'text' as const, text: '' };
    });
  } else {
    content = '';
  }
  
  const message: Message = {
    role: msg.role as Message['role'],
    content,
  };
  
  if (msg.name) {
    message.name = msg.name;
  }
  
  if (msg.tool_calls) {
    message.tool_calls = msg.tool_calls.map(tc => ({
      id: tc.id,
      type: 'function' as const,
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments,
      },
    }));
  }
  
  if (msg.tool_call_id) {
    message.tool_call_id = msg.tool_call_id;
  }
  
  return message;
}

/**
 * Convert unified message to OpenAI format
 */
function denormalizeMessage(msg: Message): OpenAIMessage {
  let content: string | OpenAIContentPart[];
  
  if (typeof msg.content === 'string') {
    content = msg.content;
  } else if (Array.isArray(msg.content)) {
    content = msg.content.map((part): OpenAIContentPart => {
      if (part.type === 'text') {
        return { type: 'text', text: part.text };
      }
      if (part.type === 'image_url') {
        return {
          type: 'image_url',
          image_url: {
            url: part.image_url.url,
            detail: part.image_url.detail as 'auto' | 'low' | 'high',
          },
        };
      }
      return { type: 'text', text: '' };
    });
  } else {
    content = '';
  }
  
  const message: OpenAIMessage = {
    role: msg.role,
    content,
  };
  
  if (msg.name) {
    message.name = msg.name;
  }
  
  if (msg.tool_calls) {
    message.tool_calls = msg.tool_calls;
  }
  
  if (msg.tool_call_id) {
    message.tool_call_id = msg.tool_call_id;
  }
  
  return message;
}

export const openaiNormalizer: RequestNormalizer<OpenAIRequest, OpenAIResponse, unknown> = {
  format: 'openai',
  
  normalize(request: OpenAIRequest): UnifiedRequest {
    return {
      model: request.model,
      messages: request.messages.map(normalizeMessage),
      max_tokens: request.max_tokens,
      temperature: request.temperature,
      top_p: request.top_p,
      stop: request.stop,
      stream: request.stream,
      presence_penalty: request.presence_penalty,
      frequency_penalty: request.frequency_penalty,
      user: request.user,
      seed: request.seed,
      response_format: request.response_format,
      tools: request.tools?.map(t => ({
        type: 'function' as const,
        function: {
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters,
        },
      })),
      tool_choice: request.tool_choice,
    };
  },
  
  denormalize(response: UnifiedResponse): OpenAIResponse {
    return {
      id: response.id,
      object: 'chat.completion',
      created: response.created,
      model: response.model,
      choices: response.choices.map(choice => ({
        index: choice.index,
        message: {
          role: 'assistant',
          content: choice.message.content,
          tool_calls: choice.message.tool_calls?.map(tc => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          })),
        },
        finish_reason: choice.finish_reason as 'stop' | 'length' | 'tool_calls' | 'content_filter',
      })),
      usage: {
        prompt_tokens: response.usage.prompt_tokens,
        completion_tokens: response.usage.completion_tokens,
        total_tokens: response.usage.total_tokens,
      },
    };
  },
  
  denormalizeStream(chunk: UnifiedStreamChunk): unknown {
    return {
      id: chunk.id,
      object: 'chat.completion.chunk',
      created: chunk.created,
      model: chunk.model,
      choices: chunk.choices.map(choice => ({
        index: choice.index,
        delta: {
          role: choice.delta.role,
          content: choice.delta.content,
          tool_calls: choice.delta.tool_calls,
        },
        finish_reason: choice.finish_reason,
      })),
    };
  },
  
  validate(request: unknown): request is OpenAIRequest {
    if (!request || typeof request !== 'object') return false;
    const r = request as Record<string, unknown>;
    return typeof r.model === 'string' && Array.isArray(r.messages);
  },
};

export default openaiNormalizer;
