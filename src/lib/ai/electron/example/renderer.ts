/**
 * Electron Renderer Process Example
 * Electron 渲染进程示例 - 展示如何在渲染进程中使用 AI API
 * 
 * 注意：这个文件展示的是使用方法的示例代码
 * 实际使用时需要在正确配置的 Electron 环境中运行
 */

import type { AIProvider, ChatCompletionResponse } from '../../types';

// ============================================
// 类型声明 (在实际项目中放到 global.d.ts)
// ============================================

interface PreloadAIAPI {
  chat(request: { messages: Array<{ role: string; content: string }>; model?: string }): Promise<ChatCompletionResponse>;
  chatStream(request: { messages: Array<{ role: string; content: string }>; model?: string }): Promise<void>;
  onStreamChunk(callback: (chunk: { choices: Array<{ delta: { content?: string } }> }) => void): () => void;
  registerProvider(config: { provider: AIProvider; apiKey: string }): Promise<void>;
  storeApiKey(provider: string, apiKey: string): Promise<void>;
  validateApiKey(provider: AIProvider): Promise<boolean>;
  listModels(provider?: AIProvider): Promise<Array<{ id: string }>>;
}

declare global {
  interface Window {
    ai: PreloadAIAPI;
    app: {
      getInfo: () => Promise<{ version: string; platform: string; arch: string }>;
      openExternal: (url: string) => Promise<void>;
      platform: string;
    };
  }
}

// ============================================
// 1. 基础用法示例
// ============================================

/**
 * 非流式聊天
 */
export async function chat(message: string): Promise<string> {
  const response = await window.ai.chat({
    messages: [{ role: 'user', content: message }],
    model: 'gpt-4',
  });
  
  const content = response.choices[0].message.content;
  return typeof content === 'string' ? content : JSON.stringify(content);
}

/**
 * 流式聊天
 */
export async function chatStream(
  message: string,
  onChunk: (text: string) => void
): Promise<void> {
  let fullText = '';
  
  // 注册流式回调
  const unsubscribe = window.ai.onStreamChunk((chunk) => {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      fullText += content;
      onChunk(fullText);
    }
  });

  try {
    await window.ai.chatStream({
      messages: [{ role: 'user', content: message }],
      model: 'gpt-4',
    });
  } finally {
    unsubscribe();
  }
}

/**
 * 多轮对话
 */
export async function multiTurnChat(
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  newMessage: string
): Promise<string> {
  const messages = [
    ...history,
    { role: 'user' as const, content: newMessage },
  ];

  const response = await window.ai.chat({
    messages,
    model: 'gpt-4',
  });

  const content = response.choices[0].message.content;
  return typeof content === 'string' ? content : JSON.stringify(content);
}

// ============================================
// 2. 提供商管理示例
// ============================================

/**
 * 注册新的 AI 提供商
 */
export async function registerProvider(
  provider: AIProvider,
  apiKey: string
): Promise<void> {
  await window.ai.registerProvider({
    provider,
    apiKey,
  });
  console.log(`Provider ${provider} registered`);
}

/**
 * 安全存储 API Key
 */
export async function storeApiKey(
  provider: string,
  apiKey: string
): Promise<void> {
  await window.ai.storeApiKey(provider, apiKey);
  console.log(`API key for ${provider} stored securely`);
}

/**
 * 验证 API Key
 */
export async function validateApiKey(provider: AIProvider): Promise<boolean> {
  const isValid = await window.ai.validateApiKey(provider);
  console.log(`API key for ${provider} is ${isValid ? 'valid' : 'invalid'}`);
  return isValid;
}

/**
 * 获取可用模型列表
 */
export async function getModels(provider?: AIProvider): Promise<string[]> {
  const models = await window.ai.listModels(provider);
  return models.map(m => m.id);
}

// ============================================
// 3. React Hook 封装示例
// ============================================

/*
// useAI.ts - 自定义 React Hook

import { useState, useCallback, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function useAI(model = 'gpt-4') {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const sendMessage = useCallback(async (content: string, stream = false) => {
    const userMessage: Message = { role: 'user', content };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      if (stream) {
        let assistantContent = '';
        
        const unsubscribe = window.ai.onStreamChunk((chunk) => {
          const deltaContent = chunk.choices[0]?.delta?.content;
          if (deltaContent) {
            assistantContent += deltaContent;
            setMessages(prev => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === 'assistant') {
                last.content = assistantContent;
              } else {
                updated.push({ role: 'assistant', content: assistantContent });
              }
              return [...updated];
            });
          }
        });

        await window.ai.chatStream({
          messages: [...messages, userMessage],
          model,
        });

        unsubscribe();
      } else {
        const response = await window.ai.chat({
          messages: [...messages, userMessage],
          model,
        });

        const responseContent = response.choices[0].message.content;
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: typeof responseContent === 'string' ? responseContent : JSON.stringify(responseContent),
        }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [messages, model]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
  };
}
*/

// ============================================
// 导出示例说明
// ============================================

export const exampleDescription = `
This file contains example code for using the AI SDK in an Electron renderer process.

To use in your project:
1. Copy the relevant functions to your renderer code
2. Ensure the preload script is properly configured
3. Use the window.ai API to interact with AI providers

For React applications, consider creating a custom hook similar to the useAI example shown in the comments.
`;
