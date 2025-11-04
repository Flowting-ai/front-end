
'use client';

import { ChatInterface } from "@/components/chat/chat-interface";
import { Topbar } from "@/components/layout/top-bar";
import { Button } from '@/components/ui/button';
import { Pin } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import AppLayout from '@/components/layout/app-layout';

interface HomeProps {
    isRightSidebarVisible?: boolean;
    setIsRightSidebarVisible?: Dispatch<SetStateAction<boolean>>;
}

function HomePageContent({ isRightSidebarVisible, setIsRightSidebarVisible }: HomeProps) {

  return (
      <div className="flex flex-col flex-1 h-full">
        <Topbar>
            {setIsRightSidebarVisible && isRightSidebarVisible === false && (
                 <Button variant="outline" onClick={() => setIsRightSidebarVisible(true)}>
                    <Pin className="mr-2 h-4 w-4" />
                    Show Pinboard
                </Button>
            )}
        </Topbar>
        <ChatInterface />
      </div>
  );
}

export default function Home() {
    return (
        <AppLayout>
            <HomePageContent />
        </AppLayout>
    )
}
