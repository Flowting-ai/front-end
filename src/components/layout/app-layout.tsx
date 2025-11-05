
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

function PageContentWrapper({ children, ...props }: AppLayoutProps & { isRightSidebarVisible?: boolean, setIsRightSidebarVisible?: React.Dispatch<React.SetStateAction<boolean>>, onPinMessage?: (pin: Pin) => void, onUnpinMessage?: (messageId: string) => void }) {
    if (React.isValidElement(children)) {
        const { isRightSidebarVisible, setIsRightSidebarVisible, onPinMessage, onUnpinMessage, ...rest } = props;
        const childProps = {
            ...rest,
            isRightSidebarVisible,
            setIsRightSidebarVisible,
            onPinMessage,
            onUnpinMessage,
        };
        // @ts-ignore
        return React.cloneElement(children, childProps);
    }
    return <>{children}</>;
}


export default function AppLayout({ children }: AppLayoutProps) {
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false);
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [pins, setPins] = useState<Pin[]>([]);
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
                        <ChatListSidebar />
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
        <ChatListSidebar isLeftSidebarCollapsed={isLeftSidebarCollapsed} />
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
