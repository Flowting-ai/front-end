
'use client';
import type { ReactNode } from "react";
import React, { useState, createContext, useEffect } from "react";
import { LeftSidebar } from "./left-sidebar";
import { RightSidebar, type Pin } from "./right-sidebar";
import { ChatListSidebar, type ChatBoard } from "./chat-list-sidebar";
import { Topbar } from "./top-bar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "../ui/sheet";
import { Button } from "../ui/button";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message } from "../chat/chat-message";
import { useRouter, usePathname } from "next/navigation";

interface AppLayoutProps {
  children: React.ReactElement;
}

const initialChatBoards: ChatBoard[] = [
    { id: 1, name: "Product Analysis Q4", time: "2m", isStarred: true, pinCount: 0 },
    { id: 2, name: "Competitive Landscape", time: "1 Day", isStarred: false, pinCount: 0 },
    { id: 3, name: "Marketing Campaign Ideas", time: "1 month", isStarred: false, pinCount: 0 },
];

type ChatHistory = {
  [key: number]: Message[];
}

const initialChatHistory: ChatHistory = {
    1: [],
    2: [],
    3: [],
}

interface AppLayoutContextType {
    chatBoards: ChatBoard[];
    setChatBoards: React.Dispatch<React.SetStateAction<ChatBoard[]>>;
    activeChatId: number | null;
    setActiveChatId: (id: number) => void;
    pins: Pin[];
    onPinMessage?: (pin: Pin) => void;
    onUnpinMessage?: (pinId: string) => void;
    handleAddChat: () => void;
}

export const AppLayoutContext = createContext<AppLayoutContextType | null>(null);

export default function AppLayout({ children }: AppLayoutProps) {
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(true);
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [pins, setPins] = useState<Pin[]>([]);
  const [chatBoards, setChatBoards_] = useState<ChatBoard[]>(initialChatBoards);
  const [activeChatId, setActiveChatId] = useState<number>(1);
  const [chatHistory, setChatHistory] = useState<ChatHistory>(initialChatHistory);

  const isMobile = useIsMobile();
  const router = useRouter();
  const pathname = usePathname();

  const setChatBoards = (boards: ChatBoard[] | ((prev: ChatBoard[]) => ChatBoard[])) => {
    setChatBoards_(prevBoards => {
        const newBoards = typeof boards === 'function' ? boards(prevBoards) : boards;
        const updatedBoards = newBoards.map(board => {
            const boardPins = pins.filter(p => p.chatId === board.id.toString());
            return { ...board, pinCount: boardPins.length };
        });
        return updatedBoards;
    });
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    if (!isLoggedIn && !pathname.startsWith('/auth')) {
        router.replace('/auth/login');
    }
  }, [pathname, router]);

  // Load state from localStorage on initial mount
  useEffect(() => {
    try {
      const savedChatBoards = localStorage.getItem('chatBoards');
      const savedChatHistory = localStorage.getItem('chatHistory');
      const savedPins = localStorage.getItem('pins');
      const savedActiveChatId = localStorage.getItem('activeChatId');

      if (savedChatBoards) setChatBoards(JSON.parse(savedChatBoards));
      if (savedChatHistory) setChatHistory(JSON.parse(savedChatHistory));
      if (savedPins) setPins(JSON.parse(savedPins).map((p: Pin) => ({...p, time: new Date(p.time)})) ); // Re-hydrate dates
      if (savedActiveChatId) setActiveChatId(JSON.parse(savedActiveChatId));

    } catch (error) {
      console.error("Failed to load state from localStorage", error);
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    try {
        localStorage.setItem('chatBoards', JSON.stringify(chatBoards));
        localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
        localStorage.setItem('pins', JSON.stringify(pins));
        if (activeChatId) {
            localStorage.setItem('activeChatId', JSON.stringify(activeChatId));
        }
    } catch (error) {
        console.error("Failed to save state to localStorage", error);
    }
  }, [chatBoards, chatHistory, pins, activeChatId]);


  const setMessagesForActiveChat = (messages: Message[] | ((prev: Message[]) => Message[])) => {
    if (activeChatId) {
      setChatHistory(prev => ({ ...prev, [activeChatId]: typeof messages === 'function' ? messages(prev[activeChatId] || []) : messages }));
    }
  };
  
  const handlePinMessage = (pin: Pin) => {
    let isAlreadyPinned = false;
    setPins(prevPins => {
        isAlreadyPinned = prevPins.some(p => p.id === pin.id);
        if (isAlreadyPinned) return prevPins;
        return [pin, ...prevPins];
    });

    if (!isAlreadyPinned) {
        setChatBoards(prevBoards => prevBoards.map(board => {
            if (board.id.toString() === pin.chatId) {
                return { ...board, pinCount: (board.pinCount || 0) + 1 };
            }
            return board;
        }));
    }
  };

  const handleUnpinMessage = (messageId: string) => {
    const pinToUnpin = pins.find(p => p.id === messageId);
    if (!pinToUnpin) return;

    setPins(prev => prev.filter(p => p.id !== messageId));

    setChatBoards(prevBoards => prevBoards.map(board => {
        if (board.id.toString() === pinToUnpin.chatId) {
            return { ...board, pinCount: Math.max(0, (board.pinCount || 0) - 1) };
        }
        return board;
    }));
  };

  const handleAddChat = () => {
    const newChatId = Date.now();
    const newChat: ChatBoard = {
        id: newChatId,
        name: "New Chat",
        time: "1m",
        isStarred: false,
        pinCount: 0
    };
    setChatBoards(prev => [newChat, ...prev]);
    setChatHistory(prev => ({...prev, [newChatId]: []}));
    setActiveChatId(newChat.id);
  };
  
  const contextValue: AppLayoutContextType = {
    chatBoards,
    setChatBoards,
    activeChatId,
    setActiveChatId: (id: number) => setActiveChatId(id),
    pins,
    onPinMessage: handlePinMessage,
    onUnpinMessage: handleUnpinMessage,
    handleAddChat,
  };

  const pageContentProps = {
    onPinMessage: handlePinMessage,
    onUnpinMessage: handleUnpinMessage,
    messages: (activeChatId && chatHistory[activeChatId]) || [],
    setMessages: setMessagesForActiveChat
  };
  
  const pageContent = React.cloneElement(children, pageContentProps);

  if (isMobile) {
    return (
        <AppLayoutContext.Provider value={contextValue}>
            <div className="flex flex-col h-screen bg-background w-full">
                <Topbar>
                    <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <Menu className="h-5 w-5" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="p-0 flex gap-0 w-[80vw]">
                             <LeftSidebar 
                                isCollapsed={false}
                                onToggle={() => {}}
                                onAddChat={handleAddChat}
                            />
                            <ChatListSidebar 
                                chatBoards={chatBoards}
                                setChatBoards={setChatBoards}
                                activeChatId={activeChatId}
                                setActiveChatId={setActiveChatId}
                                onAddChat={handleAddChat}
                            />
                        </SheetContent>
                    </Sheet>
                </Topbar>
                 <main className="flex-1 flex flex-col min-w-0">
                    {pageContent}
                </main>
            </div>
        </AppLayoutContext.Provider>
    )
  }

  return (
    <AppLayoutContext.Provider value={contextValue}>
      <div className="flex flex-col h-screen bg-background w-full">
        <Topbar />
        <div className="flex flex-1 overflow-hidden">
          <LeftSidebar 
              isCollapsed={isLeftSidebarCollapsed}
              onToggle={() => setIsLeftSidebarCollapsed(!isLeftSidebarCollapsed)}
              onAddChat={handleAddChat}
          />
          <ChatListSidebar 
              chatBoards={chatBoards}
              setChatBoards={setChatBoards}
              activeChatId={activeChatId}
              setActiveChatId={setActiveChatId}
              onAddChat={handleAddChat}
          />
          <main className="flex-1 flex flex-col min-w-0">
              {pageContent}
          </main>
          <RightSidebar
              isCollapsed={isRightSidebarCollapsed}
              onToggle={() => setIsRightSidebarCollapsed(!isRightSidebarCollapsed)}
              pins={pins}
              setPins={setPins}
              chatBoards={chatBoards}
          />
        </div>
      </div>
    </AppLayoutContext.Provider>
  );
}
