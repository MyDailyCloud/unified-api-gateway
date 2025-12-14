/**
 * React Hook for AI Client
 * 统一 AI 调用 Hook
 */

import { useState, useCallback, useRef } from 'react';
import { AIClient, getAIClient } from '../client';
import {
  AIProvider,
  ChatCompletionRequest,
  ChatCompletionResponse,
  Message,
  AIError,
} from '../types';

export interface UseAIOptions {
  provider?: AIProvider;
  client?: AIClient;
  onError?: (error: AIError) => void;
}

export interface UseAIReturn {
  // 状态
  isLoading: boolean;
  error: AIError | null;
  response: ChatCompletionResponse | null;
  streamContent: string;
  
  // 方法
  chat: (request: ChatCompletionRequest) => Promise<ChatCompletionResponse>;
  chatStream: (request: ChatCompletionRequest) => Promise<void>;
  abort: () => void;
  reset: () => void;
}

export function useAI(options: UseAIOptions = {}): UseAIReturn {
  const { provider, client, onError } = options;
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AIError | null>(null);
  const [response, setResponse] = useState<ChatCompletionResponse | null>(null);
  const [streamContent, setStreamContent] = useState('');
  
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const getClient = useCallback(() => {
    return client || getAIClient();
  }, [client]);
  
  const handleError = useCallback((err: unknown) => {
    const aiError = err instanceof AIError
      ? err
      : new AIError(
          err instanceof Error ? err.message : 'Unknown error',
          'UNKNOWN',
          provider || 'custom'
        );
    
    setError(aiError);
    onError?.(aiError);
    return aiError;
  }, [provider, onError]);
  
  const chat = useCallback(async (request: ChatCompletionRequest) => {
    setIsLoading(true);
    setError(null);
    setResponse(null);
    
    try {
      const aiClient = getClient();
      const result = await aiClient.chat(request, provider);
      setResponse(result);
      return result;
    } catch (err) {
      throw handleError(err);
    } finally {
      setIsLoading(false);
    }
  }, [getClient, provider, handleError]);
  
  const chatStream = useCallback(async (request: ChatCompletionRequest) => {
    setIsLoading(true);
    setError(null);
    setStreamContent('');
    
    abortControllerRef.current = new AbortController();
    
    try {
      const aiClient = getClient();
      let content = '';
      
      for await (const chunk of aiClient.chatStream(request, provider)) {
        if (abortControllerRef.current?.signal.aborted) {
          break;
        }
        
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          content += delta;
          setStreamContent(content);
        }
      }
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [getClient, provider, handleError]);
  
  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
  }, []);
  
  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setResponse(null);
    setStreamContent('');
  }, []);
  
  return {
    isLoading,
    error,
    response,
    streamContent,
    chat,
    chatStream,
    abort,
    reset,
  };
}

/**
 * 简化的对话 Hook
 */
export interface UseChatOptions extends UseAIOptions {
  systemPrompt?: string;
  initialMessages?: Message[];
}

export interface UseChatReturn {
  messages: Message[];
  isLoading: boolean;
  error: AIError | null;
  send: (content: string) => Promise<void>;
  sendStream: (content: string) => Promise<void>;
  abort: () => void;
  reset: () => void;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const { systemPrompt, initialMessages = [], ...aiOptions } = options;
  
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const { isLoading, error, chat, chatStream, abort, reset: resetAI, streamContent } = useAI(aiOptions);
  
  const buildRequest = useCallback((userMessage: string): ChatCompletionRequest => {
    const allMessages: Message[] = [];
    
    if (systemPrompt) {
      allMessages.push({ role: 'system', content: systemPrompt });
    }
    
    allMessages.push(...messages);
    allMessages.push({ role: 'user', content: userMessage });
    
    return {
      model: 'gpt-4o-mini', // 默认模型，可通过 provider 配置覆盖
      messages: allMessages,
    };
  }, [systemPrompt, messages]);
  
  const send = useCallback(async (content: string) => {
    const userMessage: Message = { role: 'user', content };
    setMessages(prev => [...prev, userMessage]);
    
    try {
      const request = buildRequest(content);
      const response = await chat(request);
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: response.choices[0]?.message?.content || '',
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      // 错误已在 useAI 中处理
    }
  }, [buildRequest, chat]);
  
  const sendStream = useCallback(async (content: string) => {
    const userMessage: Message = { role: 'user', content };
    setMessages(prev => [...prev, userMessage]);
    
    // 添加空的助手消息，后续更新
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
    
    try {
      const request = buildRequest(content);
      await chatStream(request);
      
      // 流结束后更新最终内容
      setMessages(prev => {
        const newMessages = [...prev];
        const lastIndex = newMessages.length - 1;
        if (newMessages[lastIndex]?.role === 'assistant') {
          newMessages[lastIndex] = { role: 'assistant', content: streamContent };
        }
        return newMessages;
      });
    } catch (err) {
      // 错误已在 useAI 中处理
    }
  }, [buildRequest, chatStream, streamContent]);
  
  const reset = useCallback(() => {
    setMessages(initialMessages);
    resetAI();
  }, [initialMessages, resetAI]);
  
  // 实时更新流式内容
  if (isLoading && streamContent) {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === 'assistant' && lastMessage.content !== streamContent) {
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = { role: 'assistant', content: streamContent };
        return newMessages;
      });
    }
  }
  
  return {
    messages,
    isLoading,
    error,
    send,
    sendStream,
    abort,
    reset,
    setMessages,
  };
}
