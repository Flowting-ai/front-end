
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

// This wrapper component consumes the props so they aren't passed to the DOM
function PageContentWrapper({ children, ...props }: AppLayoutProps & { isRightSidebarVisible?: boolean, setIsRightSidebarVisible?: React.Dispatch<React.SetStateAction<boolean>>, pins: Pin[]}) {
    // Clone the child and pass down the props it expects
    if (React.isValidElement(children)) {
        return React.cloneElement(children, props);
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
    setPins(prev => [pin, ...prev]);
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
                <PageContentWrapper pins={pins} onPinMessage={handlePinMessage}>
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
                pins={pins}
                onPinMessage={handlePinMessage}
            >
                {children}
            </PageContentWrapper>
        </main>
        <div className="relative">
            <Button variant="ghost" size="icon" onClick={() => setIsRightSidebarCollapsed(!isRightSidebarCollapsed)} className={cn("absolute top-1/2 -translate-y-1/2 bg-card border hover:bg-accent z-10 h-8 w-8 rounded-full transition-all", isRightSidebarCollapsed ? '-left-4' : '-left-4')}>
                <ChevronsLeft className={cn("h-4 w-4 transition-transform", isRightSidebarCollapsed ? "rotate-0" : "rotate-180")}/>
            </Button>
            <RightSidebar
                isCollapsed={isRightSidebarCollapsed}
                pins={pins}
            />
        </div>
      </div>
    </div>
  );
}
