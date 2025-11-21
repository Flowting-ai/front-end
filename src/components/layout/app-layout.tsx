
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { LeftSidebar } from './left-sidebar';
import { RightSidebar, Pin } from './right-sidebar';
import { ChatInterface } from '@/components/chat/chat-interface';
import { type Message } from '@/components/chat/chat-message';
import { extractThinkingContent } from '@/lib/thinking';
import { AppLayoutContext } from '@/context/app-layout-context';

import { Logo } from '../icons/logo';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, UserCircle, ChevronDown } from 'lucide-react';
import { AIModel } from '@/types/ai-model';

export interface ChatBoard {
  id: string;
  name: string;
  time: string;
  isStarred: boolean;
}

// Backend-like message structure
interface BackendMessage {
  id?: string | number;
  prompt?: string | null;
  response?: string | null;
  pin?: {
    id?: string | number;
    content: string;
  } | null;
}

const mockChatBoards: ChatBoard[] = [
  { id: 'chat-1', name: 'Introduction to AI', time: '2024-05-29T10:00:00Z', isStarred: true },
  { id: 'chat-2', name: 'React Best Practices', time: '2024-05-28T14:30:00Z', isStarred: false },
  { id: 'chat-3', name: 'Data Structures in Python', time: '2024-05-27T11:00:00Z', isStarred: true },
];

const mockPins: Pin[] = [
  { id: 'pin-1', messageId: 'msg-1', text: 'This is a pinned message.', tags: ['important', 'todo'], notes: 'Remember to review this.', chatId: 'chat-1', time: new Date() },
];

const mockChatHistory: BackendMessage[] = [
  { id: 'msg-1', prompt: 'What is AI?', response: 'Artificial intelligence is intelligence demonstrated by machines, in contrast to the natural intelligence displayed by humans and animals.' },
];

const InitialScreen = ({ onPromptSubmit }: { onPromptSubmit: (prompt: string) => void }) => {
  const [prompt, setPrompt] = useState('');
  const { user } = useAuth();

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onPromptSubmit(prompt.trim());
      setPrompt('');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-white">
        <div className="flex flex-col items-center text-center">
            <Logo className="w-16 h-16 mb-6" />
            <h1 style={{ fontSize: '28px', color: '#1E1E1E' }} className="font-bold mb-2">
                What would you like to explore today, {user?.email || 'User'}?
            </h1>
            <p style={{ fontSize: '14px', color: '#333333' }} className="mb-8">
                Your intelligent assistant for reports, automation, and creative workflows.
            </p>
        </div>
        <div 
          className="relative rounded-xl border bg-card text-card-foreground shadow"
          style={{ width: '615px', height: '90px' }}
        >
            <form onSubmit={handleFormSubmit}>
                <Input
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Type your prompt here....."
                    className="w-full h-full text-base pl-14 pr-4 py-4 border-none focus-visible:ring-0"
                />
                 <Button 
                    type="submit" 
                    size="icon" 
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full"
                    style={{width: '36px', height: '36px', backgroundColor: '#F0F0F0'}}
                    variant="ghost"
                  >
                    <Plus className="h-5 w-5 text-gray-500" />
                </Button>
            </form>
            <div className="absolute bottom-3 right-3">
                <Button variant="secondary" className="flex items-center" style={{width: '170px', height: '32px'}}>
                    <UserCircle className="mr-2" style={{width: '20px', height: '20px'}}/>
                    <span>Choose persona</span>
                    <ChevronDown className="ml-auto h-4 w-4"/>
                </Button>
            </div>
        </div>
    </div>
  );
};


export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false);
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState(true);
  
  const [chatBoards, setChatBoards] = useState<ChatBoard[]>(mockChatBoards);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  
  const [pins, setPins] = useState<Pin[]>(mockPins);
  const [chatHistory, setChatHistory] = useState<Record<string, BackendMessage[]>>({ 'chat-1': mockChatHistory });

  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renamingText, setRenamingText] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(null);

  const { user } = useAuth();

  const handleAddChat = (prompt?: string) => {
    const newChatId = `chat-${Date.now()}`;
    const newChatBoard: ChatBoard = {
      id: newChatId,
      name: prompt ? prompt.substring(0, 25) : 'New Chat',
      time: new Date().toISOString(),
      isStarred: false
    };
    setChatBoards([newChatBoard, ...chatBoards]);
    setActiveChatId(newChatId);
    setChatHistory(prev => ({ ...prev, [newChatId]: prompt ? [{ prompt, response: '' }] : [] }));
    return newChatId;
  };

  const handlePromptSubmit = (prompt: string) => {
    let currentChatId = activeChatId;
    if (!currentChatId) {
      currentChatId = handleAddChat(prompt);
    } else {
       setChatHistory(prev => ({ ...prev, [currentChatId as string]: [...(prev[currentChatId as string] || []), { prompt, response: '' }] }));
    }
  };

  const handleDeleteClick = (board: ChatBoard) => {
    if (window.confirm(`Are you sure you want to delete "${board.name}"?`)) {
      setChatBoards(boards => boards.filter(b => b.id !== board.id));
      if (activeChatId === board.id) {
        setActiveChatId(null);
      }
    }
  };

  const processChatHistory = useCallback((history: BackendMessage[] = []): Message[] => {
    return history.flatMap((entry) => {
      const messages: Message[] = [];
      const baseId = entry.id || Math.random();
      if (entry.prompt) {
        messages.push({ id: `${baseId}-prompt`, sender: 'user', content: entry.prompt, chatMessageId: String(entry.id) });
      }
      if (entry.response) {
        const sanitized = extractThinkingContent(entry.response);
        messages.push({ id: `${baseId}-response`, sender: 'ai', content: sanitized.visibleText, thinkingContent: sanitized.thinkingText, chatMessageId: String(entry.id) });
      }
      return messages;
    });
  }, []);

  const activeChatHistory = activeChatId ? chatHistory[activeChatId] || [] : [];
  const displayedMessages = processChatHistory(activeChatHistory);

  const setMessagesForChat = (messages: Message[] | ((prev: Message[]) => Message[]), chatIdOverride?: string) => {
    const targetChatId = chatIdOverride || activeChatId;
    if (!targetChatId) return;

    // This is a simplified conversion. A real implementation would be more complex.
    const newBackendMessages = (typeof messages === 'function' 
        ? messages(processChatHistory(chatHistory[targetChatId] || [])) 
        : messages
    ).map(m => ({ 
        id: m.chatMessageId, 
        prompt: m.sender === 'user' ? m.content : undefined, 
        response: m.sender === 'ai' ? m.content : undefined 
    }));

    setChatHistory(prev => ({...prev, [targetChatId]: newBackendMessages as BackendMessage[]}));
  };

  const layoutContextValue = {
    pins,
    chatBoards,
    setChatBoards,
    activeChatId,
    setActiveChatId,
    selectedModel
  };

  return (
    <AppLayoutContext.Provider value={layoutContextValue}>
        <div className="flex h-screen bg-background">
          <LeftSidebar
            isCollapsed={isLeftSidebarCollapsed}
            onToggle={() => setIsLeftSidebarCollapsed(!isLeftSidebarCollapsed)}
            chatBoards={chatBoards}
            setChatBoards={setChatBoards}
            activeChatId={activeChatId}
            setActiveChatId={setActiveChatId}
            onAddChat={() => handleAddChat()}
            renamingChatId={renamingChatId}
            setRenamingChatId={setRenamingChatId}
            renamingText={renamingText}
            setRenamingText={setRenamingText}
            renameInputRef={renameInputRef}
            handleDeleteClick={handleDeleteClick}
          />
          <main className="flex-1 flex flex-col transition-all duration-300 ease-in-out">
            {activeChatId ? (
              <ChatInterface
                messages={displayedMessages}
                setMessages={setMessagesForChat}
                selectedModel={selectedModel}
                onPinMessage={pin => setPins(prev => [...prev, pin])}
                onUnpinMessage={messageId => setPins(prev => prev.filter(p => p.messageId !== messageId))}
              />
            ) : (
              <InitialScreen onPromptSubmit={handlePromptSubmit} />
            )}
          </main>
          <RightSidebar
            isCollapsed={isRightSidebarCollapsed}
            onToggle={() => setIsRightSidebarCollapsed(!isRightSidebarCollapsed)}
            pins={pins}
            onPinUpdate={setPins}
            className={!activeChatId ? 'hidden' : ''}
          />
        </div>
    </AppLayoutContext.Provider>
  );
}
