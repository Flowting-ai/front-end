
'use client';
import type { ReactNode } from "react";
import React, { useState, createContext, useContext, useEffect } from "react";
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

interface AppLayoutProps {
  children: ReactNode;
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
    onPinMessage?: (pin: Pin) => void;
}

export const AppLayoutContext = createContext<AppLayoutContextType | null>(null);

function PageContentWrapper({ children, ...props }: AppLayoutProps & { onPinMessage?: (pin: Pin) => void, onUnpinMessage?: (messageId: string) => void, messages?: Message[], setMessages?: (messages: Message[]) => void }) {
    if (React.isValidElement(children)) {
        // Filter out props that are not meant for the DOM element
        const { onPinMessage, onUnpinMessage, messages, setMessages, ...rest } = props;

        const childProps = {
            ...rest,
            ...(typeof children.type !== 'string' ? { onPinMessage, onUnpinMessage, messages, setMessages } : {})
        };
        
        return React.cloneElement(children, childProps);
    }
    return <>{children}</>;
}


export default function AppLayout({ children }: AppLayoutProps) {
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false);
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [pins, setPins] = useState<Pin[]>([]);
  const [chatBoards, setChatBoards] = useState(initialChatBoards);
  const [activeChatId, setActiveChatId] = useState<number>(1);
  const [chatHistory, setChatHistory] = useState<ChatHistory>(initialChatHistory);
  const isMobile = useIsMobile();

  const setMessagesForActiveChat = (messages: Message[]) => {
    if (activeChatId) {
      setChatHistory(prev => ({ ...prev, [activeChatId]: messages }));
    }
  };
  
  const handlePinMessage = (pin: Pin) => {
    setPins(prev => {
        const existingPinIndex = prev.findIndex(p => p.id === pin.id);
        if (existingPinIndex > -1) {
            // Unpin
            const newPins = prev.filter(p => p.id !== pin.id);
            const updatedChatBoards = chatBoards.map(board => 
                board.name === pin.chat ? { ...board, pinCount: Math.max(0, (board.pinCount || 0) - 1) } : board
            );
            setChatBoards(updatedChatBoards);
            return newPins;
        } else {
            // Pin
            const updatedPins = [pin, ...prev];
            const updatedChatBoards = chatBoards.map(board => 
                board.name === pin.chat ? { ...board, pinCount: (board.pinCount || 0) + 1 } : board
            );
            setChatBoards(updatedChatBoards);
            return updatedPins;
        }
    });
  };

  const handleUnpinMessage = (messageId: string) => {
    const pinToUnpin = pins.find(p => p.id === messageId);
    setPins(prev => prev.filter(p => p.id !== messageId));
    if (pinToUnpin) {
        const updatedChatBoards = chatBoards.map(board => 
            board.name === pinToUnpin.chat ? { ...board, pinCount: Math.max(0, (board.pinCount || 0) - 1) } : board
        );
        setChatBoards(updatedChatBoards);
    }
  };
  
  const contextValue = {
    chatBoards,
    setChatBoards,
    activeChatId,
    setActiveChatId: (id: number) => setActiveChatId(id),
  };

  const pageContentProps = {
    onPinMessage: handlePinMessage,
    onUnpinMessage: handleUnpinMessage,
    messages: chatHistory[activeChatId] || [],
    setMessages: setMessagesForActiveChat
  };

  if (isMobile) {
    return (
        <AppLayoutContext.Provider value={contextValue}>
            <div className="flex flex-col h-screen bg-card w-full">
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
                            />
                            <ChatListSidebar 
                                chatBoards={chatBoards}
                                setChatBoards={setChatBoards}
                                activeChatId={activeChatId}
                                setActiveChatId={setActiveChatId}
                                setChatHistory={setChatHistory}
                            />
                        </SheetContent>
                    </Sheet>
                </Topbar>
                 <main className="flex-1 flex flex-col min-w-0">
                    <PageContentWrapper {...pageContentProps}>
                        {children}
                    </PageContentWrapper>
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
          />
          <ChatListSidebar 
              chatBoards={chatBoards}
              setChatBoards={setChatBoards}
              activeChatId={activeChatId}
              setActiveChatId={setActiveChatId}
              setChatHistory={setChatHistory}
          />
          <main className="flex-1 flex flex-col min-w-0">
              <PageContentWrapper {...pageContentProps}>
                  {children}
              </PageContentWrapper>
          </main>
          <RightSidebar
              isCollapsed={isRightSidebarCollapsed}
              onToggle={() => setIsRightSidebarCollapsed(!isRightSidebarCollapsed)}
              pins={pins}
              setPins={setPins}
          />
        </div>
      </div>
    </AppLayoutContext.Provider>
  );
}
