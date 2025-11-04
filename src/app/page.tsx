
"use client";

import { useState } from 'react';
import { ChatInterface } from "@/components/chat/chat-interface";
import { Topbar } from "@/components/layout/top-bar";
import { RightSidebar } from "@/components/layout/right-sidebar";
import AppLayout from "@/components/layout/app-layout";
import { LeftSidebar } from "@/components/layout/left-sidebar";
import { Button } from '@/components/ui/button';
import { Pin } from 'lucide-react';

export default function Home() {
  const [isRightSidebarVisible, setIsRightSidebarVisible] = useState(true);

  return (
    <AppLayout
      leftSidebar={<LeftSidebar />}
      rightSidebar={
        <RightSidebar
          isVisible={isRightSidebarVisible}
          onClose={() => setIsRightSidebarVisible(false)}
        />
      }
    >
      <div className="flex flex-col h-full flex-1">
        <Topbar>
            {!isRightSidebarVisible && (
                 <Button variant="outline" onClick={() => setIsRightSidebarVisible(true)}>
                    <Pin className="mr-2 h-4 w-4" />
                    Show Pinboard
                </Button>
            )}
        </Topbar>
        <ChatInterface />
      </div>
    </AppLayout>
  );
}
