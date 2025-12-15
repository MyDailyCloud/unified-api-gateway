import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Loader2, MessageSquare, StopCircle } from 'lucide-react';
import { ModelSelector } from '@/components/chat/ModelSelector';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { useToast } from '@/hooks/use-toast';
import { AppShell } from '@/components/layout/AppShell';
import { ChatSidebar } from '@/components/layout/AppSidebar';
import { Toolbar } from '@/components/layout/Toolbar';
import { useApp } from '@/context/AppContext';

const electron = window.electron as any;

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
  isStreaming?: boolean;
}

interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export default function ChatView() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [selectedModel, setSelectedModel] = useState('gpt-4');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { setCurrentModule, registerNewChatHandler } = useApp();

  const createNewConversation = useCallback(async () => {
    if (!electron?.conversations) {
      const id = crypto.randomUUID();
      setConversations(prev => [{ id, title: 'New Chat', createdAt: new Date(), updatedAt: new Date() }, ...prev]);
      setCurrentConversation(id);
      setMessages([]);
      return;
    }
    try {
      const result = await electron.conversations.create();
      await loadConversations();
      setCurrentConversation(result.id);
      setMessages([]);
    } catch (e) { toast({ title: 'Error', description: 'Failed to create conversation', variant: 'destructive' }); }
  }, [toast]);

  useEffect(() => { 
    setCurrentModule('chat');
    loadConversations();
    registerNewChatHandler(createNewConversation);
  }, [setCurrentModule, registerNewChatHandler, createNewConversation]);
  
  useEffect(() => { 
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); 
  }, [messages]);

  const loadConversations = async () => {
    if (!electron?.conversations) return;
    try {
      const result = await electron.conversations.list();
      setConversations(result.conversations || []);
    } catch (e) { console.error('Failed to load conversations:', e); }
  };

  const loadMessages = async (conversationId: string) => {
    if (!electron?.conversations) return;
    try {
      const result = await electron.conversations.getMessages(conversationId);
      setMessages(result.messages || []);
    } catch (e) { console.error('Failed to load messages:', e); }
  };


  const selectConversation = (id: string) => { 
    setCurrentConversation(id); 
    loadMessages(id); 
  };

  const deleteConversation = async (id: string) => {
    if (!electron?.conversations) {
      setConversations(prev => prev.filter(c => c.id !== id));
      if (currentConversation === id) { setCurrentConversation(null); setMessages([]); }
      return;
    }
    try {
      await electron.conversations.delete(id);
      await loadConversations();
      if (currentConversation === id) { setCurrentConversation(null); setMessages([]); }
    } catch (e) { toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' }); }
  };

  const cancelStream = useCallback(async () => {
    if (streamId && electron?.chat?.cancelStream) {
      try {
        await electron.chat.cancelStream(streamId);
      } catch (e) { console.error('Failed to cancel stream:', e); }
    }
    setIsStreaming(false);
    setStreamId(null);
    setIsLoading(false);
  }, [streamId]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage: Message = { id: crypto.randomUUID(), role: 'user', content: input.trim(), createdAt: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const assistantMessageId = crypto.randomUUID();

    try {
      const chatMessages = [...messages, userMessage].map(m => ({ role: m.role, content: m.content }));

      if (electron?.chat?.stream) {
        setIsStreaming(true);
        setMessages(prev => [...prev, { 
          id: assistantMessageId, 
          role: 'assistant', 
          content: '', 
          createdAt: new Date(),
          isStreaming: true 
        }]);

        const result = await electron.chat.stream({
          provider: selectedProvider, 
          model: selectedModel,
          messages: chatMessages,
          conversationId: currentConversation || undefined,
        });

        setStreamId(result.streamId);

        if (electron?.ipc?.on) {
          const chunkHandler = (chunk: { content?: string }) => {
            if (chunk.content) {
              setMessages(prev => prev.map(m => 
                m.id === assistantMessageId 
                  ? { ...m, content: m.content + chunk.content }
                  : m
              ));
            }
          };

          const endHandler = () => {
            setMessages(prev => prev.map(m => 
              m.id === assistantMessageId 
                ? { ...m, isStreaming: false }
                : m
            ));
            setIsStreaming(false);
            setStreamId(null);
            setIsLoading(false);
            electron.ipc.removeListener(`chat:chunk:${result.streamId}`, chunkHandler);
            electron.ipc.removeListener(`chat:end:${result.streamId}`, endHandler);
          };

          electron.ipc.on(`chat:chunk:${result.streamId}`, chunkHandler);
          electron.ipc.on(`chat:end:${result.streamId}`, endHandler);
        }
      } else if (electron?.chat?.send) {
        const response = await electron.chat.send({
          provider: selectedProvider, 
          model: selectedModel,
          messages: chatMessages,
          conversationId: currentConversation || undefined,
        });
        setMessages(prev => [...prev, { 
          id: assistantMessageId, 
          role: 'assistant', 
          content: response.content || response.message || 'No response', 
          createdAt: new Date() 
        }]);
        setIsLoading(false);
      } else {
        await new Promise(r => setTimeout(r, 500));
        setMessages(prev => [...prev, { 
          id: assistantMessageId, 
          role: 'assistant', 
          content: '', 
          createdAt: new Date(),
          isStreaming: true 
        }]);

        const mockResponse = `This is a simulated streaming response. Run in Electron with API keys configured for real AI responses.\n\nYou said: "${userMessage.content}"`;
        const words = mockResponse.split(' ');
        
        for (let i = 0; i < words.length; i++) {
          await new Promise(r => setTimeout(r, 50));
          const word = words[i] + (i < words.length - 1 ? ' ' : '');
          setMessages(prev => prev.map(m => 
            m.id === assistantMessageId 
              ? { ...m, content: m.content + word }
              : m
          ));
        }

        setMessages(prev => prev.map(m => 
          m.id === assistantMessageId 
            ? { ...m, isStreaming: false }
            : m
        ));
        setIsLoading(false);
      }
    } catch (e: any) { 
      toast({ title: 'Error', description: e.message || 'Failed to send', variant: 'destructive' }); 
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { 
    if (e.key === 'Enter' && !e.shiftKey) { 
      e.preventDefault(); 
      sendMessage(); 
    } 
  };

  return (
    <AppShell
      sidebar={
        <ChatSidebar
          conversations={conversations}
          currentConversationId={currentConversation}
          onSelectConversation={selectConversation}
          onDeleteConversation={deleteConversation}
          onNewConversation={createNewConversation}
        />
      }
    >
      <Toolbar title="Chat">
        <ModelSelector 
          provider={selectedProvider} 
          model={selectedModel} 
          onProviderChange={setSelectedProvider} 
          onModelChange={setSelectedModel} 
        />
      </Toolbar>

      <ScrollArea ref={scrollRef} className="flex-1">
        <div className="p-4">
          {messages.length === 0 ? (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
              <p>Start a new conversation</p>
            </div>
          ) : (
            <div className="space-y-4 max-w-3xl mx-auto">
              {messages.map(m => <ChatMessage key={m.id} message={m} />)}
              {isLoading && !isStreaming && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Thinking...</span>
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-border p-4 bg-background">
        <div className="max-w-3xl mx-auto flex gap-2">
          <Textarea 
            value={input} 
            onChange={e => setInput(e.target.value)} 
            onKeyDown={handleKeyDown} 
            placeholder="Type a message..." 
            className="min-h-[60px] resize-none" 
            disabled={isLoading} 
          />
          {isStreaming ? (
            <Button onClick={cancelStream} size="icon" variant="destructive" className="h-[60px] w-[60px]">
              <StopCircle className="h-5 w-5" />
            </Button>
          ) : (
            <Button onClick={sendMessage} disabled={!input.trim() || isLoading} size="icon" className="h-[60px] w-[60px]">
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  );
}
