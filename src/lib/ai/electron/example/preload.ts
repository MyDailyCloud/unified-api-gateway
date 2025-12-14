/**
 * Electron Preload Script Example
 * Electron Preload 脚本示例 - 安全地暴露 AI API 给渲染进程
 * 
 * 使用方法：
 * 1. 复制此文件到你的 Electron 项目
 * 2. 在 BrowserWindow 的 webPreferences 中配置 preload 路径
 * 3. 确保 contextIsolation: true 和 nodeIntegration: false
 * 
 * 注意: 这是示例代码，需要在 Electron 项目中使用
 */

// ============================================
// 示例代码 - 复制到你的 Electron 项目使用
// ============================================

/*
import { contextBridge, ipcRenderer } from 'electron';
import { initPreloadAI, type PreloadAIAPI } from '@ai-sdk/electron';

// ============================================
// 1. 初始化 AI API
// ============================================

const aiAPI: PreloadAIAPI = initPreloadAI(ipcRenderer);

// ============================================
// 2. 暴露给渲染进程
// ============================================

// 暴露 AI API
contextBridge.exposeInMainWorld('ai', aiAPI);

// 暴露应用 API (可选)
contextBridge.exposeInMainWorld('app', {
  getInfo: () => ipcRenderer.invoke('app:getInfo'),
  openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),
  platform: process.platform,
});
*/

// ============================================
// TypeScript 类型声明 (创建 global.d.ts)
// ============================================

/*
// global.d.ts - 放到你的项目根目录

import type { PreloadAIAPI } from '@ai-sdk/electron';

declare global {
  interface Window {
    ai: PreloadAIAPI;
    app: {
      getInfo: () => Promise<{
        version: string;
        platform: string;
        arch: string;
      }>;
      openExternal: (url: string) => Promise<void>;
      platform: string;
    };
  }
}

export {};
*/

// ============================================
// React 使用示例
// ============================================

/*
// 在 React 组件中使用

import { useState } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function ChatComponent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;
    
    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // 非流式请求
      const response = await window.ai.chat({
        messages: [...messages, userMessage],
        model: 'gpt-4',
      });
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.choices[0].message.content as string,
      }]);
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={msg.role}>
            {msg.content}
          </div>
        ))}
      </div>
      <input 
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
        disabled={isLoading}
      />
      <button onClick={sendMessage} disabled={isLoading}>
        {isLoading ? 'Sending...' : 'Send'}
      </button>
    </div>
  );
}
*/

// ============================================
// 导出类型供文档使用
// ============================================

export interface PreloadExample {
  description: string;
}

export const example: PreloadExample = {
  description: 'Copy the commented code above to your Electron preload script',
};
