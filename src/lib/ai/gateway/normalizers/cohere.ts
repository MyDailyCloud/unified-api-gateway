/**
 * Cohere Format Normalizer
 * Cohere 格式转换器
 */

import type {
  RequestNormalizer,
  UnifiedRequest,
  UnifiedResponse,
  UnifiedStreamChunk,
  CohereRequest,
  CohereResponse,
  CohereStreamEvent,
  CohereChatMessage,
} from '../types';
import type { Message, MessageContent } from '../../types';

/**
 * Convert unified messages to Cohere chat history
 */
function toCohereHistory(messages: Message[]): { preamble?: string; history: CohereChatMessage[]; lastMessage: string } {
  const history: CohereChatMessage[] = [];
  let preamble: string | undefined;
  let lastMessage = '';
  
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const content = typeof msg.content === 'string' 
      ? msg.content 
      : msg.content.filter(c => c.type === 'text').map(c => (c as { text: string }).text).join('\n');
    
    if (msg.role === 'system') {
      preamble = preamble ? `${preamble}\n\n${content}` : content;
    } else if (i === messages.length - 1 && msg.role === 'user') {
      // Last user message goes to 'message' field
      lastMessage = content;
    } else {
      let role: CohereChatMessage['role'];
      if (msg.role === 'user') role = 'USER';
      else if (msg.role === 'assistant') role = 'CHATBOT';
      else if (msg.role === 'tool') role = 'TOOL';
      else role = 'USER';
      
      const historyMsg: CohereChatMessage = { role, message: content };
      
      if (msg.tool_calls) {
        historyMsg.tool_calls = msg.tool_calls.map(tc => ({
          name: tc.function.name,
          parameters: JSON.parse(tc.function.arguments || '{}'),
        }));
      }
      
      history.push(historyMsg);
    }
  }
  
  return { preamble, history, lastMessage };
}

/**
 * Convert Cohere history to unified messages
 */
function fromCohereHistory(
  preamble: string | undefined,
  history: CohereChatMessage[],
  lastMessage: string
): Message[] {
  const messages: Message[] = [];
  
  if (preamble) {
    messages.push({ role: 'system', content: preamble });
  }
  
  for (const msg of history) {
    let role: Message['role'];
    if (msg.role === 'USER') role = 'user';
    else if (msg.role === 'CHATBOT') role = 'assistant';
    else if (msg.role === 'TOOL') role = 'tool';
    else if (msg.role === 'SYSTEM') role = 'system';
    else role = 'user';
    
    const message: Message = { role, content: msg.message };
    
    if (msg.tool_calls) {
      message.tool_calls = msg.tool_calls.map((tc, idx) => ({
        id: `call_${idx}`,
        type: 'function' as const,
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.parameters),
        },
      }));
    }
    
    messages.push(message);
  }
  
  if (lastMessage) {
    messages.push({ role: 'user', content: lastMessage });
  }
  
  return messages;
}

export const cohereNormalizer: RequestNormalizer<CohereRequest, CohereResponse, CohereStreamEvent> = {
  format: 'cohere',
  
  normalize(request: CohereRequest): UnifiedRequest {
    const messages = fromCohereHistory(
      request.preamble,
      request.chat_history || [],
      request.message
    );
    
    return {
      model: request.model,
      messages,
      max_tokens: request.max_tokens,
      temperature: request.temperature,
      top_p: request.p,
      top_k: request.k,
      stop: request.stop_sequences,
      stream: request.stream,
      tools: request.tools?.map(t => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameter_definitions ? {
            type: 'object',
            properties: Object.fromEntries(
              Object.entries(t.parameter_definitions).map(([key, def]) => [
                key,
                { type: def.type, description: def.description },
              ])
            ),
            required: Object.entries(t.parameter_definitions)
              .filter(([_, def]) => def.required)
              .map(([key]) => key),
          } : undefined,
        },
      })),
    };
  },
  
  denormalize(response: UnifiedResponse): CohereResponse {
    const choice = response.choices[0];
    
    // Map finish reason
    let finishReason: CohereResponse['finish_reason'] = 'COMPLETE';
    if (choice.finish_reason === 'length') {
      finishReason = 'MAX_TOKENS';
    } else if (choice.finish_reason === 'content_filter') {
      finishReason = 'ERROR_TOXIC';
    }
    
    const result: CohereResponse = {
      response_id: response.id,
      text: choice.message.content || '',
      finish_reason: finishReason,
      meta: {
        tokens: {
          input_tokens: response.usage.prompt_tokens,
          output_tokens: response.usage.completion_tokens,
        },
      },
    };
    
    if (choice.message.tool_calls) {
      result.tool_calls = choice.message.tool_calls.map(tc => ({
        name: tc.function.name,
        parameters: JSON.parse(tc.function.arguments || '{}'),
      }));
    }
    
    return result;
  },
  
  denormalizeStream(chunk: UnifiedStreamChunk): CohereStreamEvent {
    const choice = chunk.choices[0];
    
    if (choice.delta.content) {
      return {
        event_type: 'text-generation',
        text: choice.delta.content,
      };
    }
    
    if (choice.finish_reason) {
      return {
        event_type: 'stream-end',
        is_finished: true,
        finish_reason: choice.finish_reason === 'stop' ? 'COMPLETE' : 'MAX_TOKENS',
      };
    }
    
    return { event_type: 'stream-start' };
  },
  
  validate(request: unknown): request is CohereRequest {
    if (!request || typeof request !== 'object') return false;
    const r = request as Record<string, unknown>;
    return typeof r.model === 'string' && typeof r.message === 'string';
  },
};

export default cohereNormalizer;
