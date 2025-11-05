
'use client';
import type { ReactNode } from "react";
import React, { useState } from "react";
import { LeftSidebar } from "./left-sidebar";
import { RightSidebar, type Pin } from "./right-sidebar";
import { ChatListSidebar } from "./chat-list-sidebar";
import { Topbar } from "./top-bar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "../ui/sheet";
import { Button } from "../ui/button";
import { ChevronsLeft, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
}

const initialChatBoards = [
    { id: 1, name: "Product Analysis Q4", time: "2m", isStarred: true, pinCount: 3 },
    { id: 2, name: "Competitive Landscape", time: "1 Day", isStarred: true, pinCount: 1 },
    { id: 3, name: "Marketing Campaign Ideas", time: "1 month", isStarred: true, pinCount: 5 },
];


function PageContentWrapper({ children, ...props }: AppLayoutProps & { isRightSidebarVisible?: boolean, setIsRightSidebarVisible?: React.Dispatch<React.SetStateAction<boolean>>, onPinMessage?: (pin: Pin) => void, onUnpinMessage?: (messageId: string) => void }) {
    if (React.isValidElement(children)) {
        // Filter out props that are not meant for the DOM element
        const { isRightSidebarVisible, setIsRightSidebarVisible, onPinMessage, onUnpinMessage, ...rest } = props;

        // Check if the child is a valid React component that accepts these props
        // This is a simplified check, for more complex scenarios you might need a more robust solution
        const childProps = {
            ...rest,
            ...(typeof children.type !== 'string' ? { isRightSidebarVisible, setIsRightSidebarVisible, onPinMessage, onUnpinMessage } : {})
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
  const [activeChatId, setActiveChatId] = useState(1);
  const isMobile = useIsMobile();

  const handlePinMessage = (pin: Pin) => {
    setPins(prev => [pin, ...prev.filter(p => p.id !== pin.id)]);
  };

  const handleUnpinMessage = (messageId: string) => {
    setPins(prev => prev.filter(p => p.id !== messageId));
  };
  
  if (isMobile) {
    return (
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
                        />
                    </SheetContent>
                </Sheet>
            </Topbar>
             <main className="flex-1 flex flex-col min-w-0">
                <PageContentWrapper onPinMessage={handlePinMessage} onUnpinMessage={handleUnpinMessage}>
                    {children}
                </PageContentWrapper>
            </main>
        </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-background w-full">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar 
            isCollapsed={isLeftSidebarCollapsed}
            onToggle={() => setIsLeftSidebarCollapsed(!isLeftSidebarCollapsed)}
        />
        <ChatListSidebar 
            isLeftSidebarCollapsed={isLeftSidebarCollapsed} 
            chatBoards={chatBoards}
            setChatBoards={setChatBoards}
            activeChatId={activeChatId}
            setActiveChatId={setActiveChatId}
        />
        <main className="flex-1 flex flex-col min-w-0">
            <PageContentWrapper 
                isRightSidebarVisible={!isRightSidebarCollapsed}
                setIsRightSidebarVisible={(visible: boolean) => setIsRightSidebarCollapsed(!visible)}
                onPinMessage={handlePinMessage}
                onUnpinMessage={handleUnpinMessage}
            >
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
  );
}
