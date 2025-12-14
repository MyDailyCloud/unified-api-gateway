/**
 * Google Gemini Format Normalizer
 * Google Gemini 格式转换器
 */

import type {
  RequestNormalizer,
  UnifiedRequest,
  UnifiedResponse,
  UnifiedStreamChunk,
  GoogleRequest,
  GoogleResponse,
  GoogleContent,
  GooglePart,
} from '../types';
import type { Message, MessageContent } from '../../types';

/**
 * Convert unified message to Google format
 */
function toGoogleContent(msg: Message): GoogleContent | null {
  // Skip system messages - they go to systemInstruction
  if (msg.role === 'system') return null;
  
  const parts: GooglePart[] = [];
  
  if (typeof msg.content === 'string') {
    parts.push({ text: msg.content });
  } else if (Array.isArray(msg.content)) {
    for (const part of msg.content) {
      if (part.type === 'text') {
        parts.push({ text: part.text });
      } else if (part.type === 'image_url') {
        const url = part.image_url.url;
        if (url.startsWith('data:')) {
          const [header, data] = url.split(',');
          const mimeType = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
          parts.push({ inlineData: { mimeType, data } });
        }
      }
    }
  }
  
  // Handle tool calls
  if (msg.tool_calls) {
    for (const tc of msg.tool_calls) {
      parts.push({
        functionCall: {
          name: tc.function.name,
          args: JSON.parse(tc.function.arguments || '{}'),
        },
      });
    }
  }
  
  // Handle tool results
  if (msg.role === 'tool' && msg.name) {
    parts.push({
      functionResponse: {
        name: msg.name,
        response: typeof msg.content === 'string' ? { result: msg.content } : msg.content,
      },
    });
    return { role: 'user', parts };
  }
  
  return {
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts,
  };
}

/**
 * Convert Google content to unified message
 */
function fromGoogleContent(content: GoogleContent): Message {
  const msgContent: { type: 'text'; text: string }[] = [];
  const toolCalls: Message['tool_calls'] = [];
  
  for (const part of content.parts) {
    if (part.text) {
      msgContent.push({ type: 'text', text: part.text });
    }
    if (part.functionCall) {
      toolCalls.push({
        id: `call_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        type: 'function',
        function: {
          name: part.functionCall.name,
          arguments: JSON.stringify(part.functionCall.args || {}),
        },
      });
    }
  }
  
  const message: Message = {
    role: content.role === 'model' ? 'assistant' : 'user',
    content: msgContent.length === 1 ? msgContent[0].text : msgContent,
  };
  
  if (toolCalls.length > 0) {
    message.tool_calls = toolCalls;
  }
  
  return message;
}

export const googleNormalizer: RequestNormalizer<GoogleRequest, GoogleResponse, unknown> = {
  format: 'google',
  
  normalize(request: GoogleRequest): UnifiedRequest {
    const messages: Message[] = [];
    
    // Add system instruction as system message
    if (request.systemInstruction) {
      const systemText = request.systemInstruction.parts
        .filter(p => p.text)
        .map(p => p.text)
        .join('\n');
      if (systemText) {
        messages.push({ role: 'system', content: systemText });
      }
    }
    
    // Convert contents to messages
    for (const content of request.contents) {
      const msg = fromGoogleContent(content);
      messages.push(msg);
    }
    
    // Convert tool choice
    let toolChoice: UnifiedRequest['tool_choice'];
    if (request.toolConfig?.functionCallingConfig?.mode) {
      const mode = request.toolConfig.functionCallingConfig.mode;
      if (mode === 'AUTO') toolChoice = 'auto';
      else if (mode === 'ANY') toolChoice = 'required';
      else if (mode === 'NONE') toolChoice = 'none';
    }
    
    return {
      model: 'gemini-pro', // Model is usually in the URL path
      messages,
      max_tokens: request.generationConfig?.maxOutputTokens,
      temperature: request.generationConfig?.temperature,
      top_p: request.generationConfig?.topP,
      top_k: request.generationConfig?.topK,
      stop: request.generationConfig?.stopSequences,
      tools: request.tools?.flatMap(t => 
        t.functionDeclarations?.map(fd => ({
          type: 'function' as const,
          function: {
            name: fd.name,
            description: fd.description,
            parameters: fd.parameters,
          },
        })) || []
      ),
      tool_choice: toolChoice,
    };
  },
  
  denormalize(response: UnifiedResponse): GoogleResponse {
    const choice = response.choices[0];
    const parts: GooglePart[] = [];
    
    if (choice.message.content) {
      parts.push({ text: choice.message.content });
    }
    
    if (choice.message.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        parts.push({
          functionCall: {
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments || '{}'),
          },
        });
      }
    }
    
    // Map finish reason
    let finishReason: GoogleResponse['candidates'][0]['finishReason'] = 'STOP';
    if (choice.finish_reason === 'length') {
      finishReason = 'MAX_TOKENS';
    } else if (choice.finish_reason === 'content_filter') {
      finishReason = 'SAFETY';
    }
    
    return {
      candidates: [{
        content: { role: 'model', parts },
        finishReason,
      }],
      usageMetadata: {
        promptTokenCount: response.usage.prompt_tokens,
        candidatesTokenCount: response.usage.completion_tokens,
        totalTokenCount: response.usage.total_tokens,
      },
    };
  },
  
  denormalizeStream(chunk: UnifiedStreamChunk): unknown {
    const choice = chunk.choices[0];
    const parts: GooglePart[] = [];
    
    if (choice.delta.content) {
      parts.push({ text: choice.delta.content });
    }
    
    return {
      candidates: [{
        content: { role: 'model', parts },
        finishReason: choice.finish_reason ? 
          (choice.finish_reason === 'stop' ? 'STOP' : 'MAX_TOKENS') : undefined,
      }],
    };
  },
  
  validate(request: unknown): request is GoogleRequest {
    if (!request || typeof request !== 'object') return false;
    const r = request as Record<string, unknown>;
    return Array.isArray(r.contents);
  },
};

export default googleNormalizer;
