'use client';

import { ChatInterface } from "@/components/chat/chat-interface";
import { Button } from '@/components/ui/button';
import { Pin } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import AppLayout from '@/components/layout/app-layout';
import { ModelSelector } from "@/components/chat/model-selector";
import { TokenTracker } from "@/components/chat/token-tracker";
import type { Pin as PinType } from "@/components/layout/right-sidebar";
import type { Message } from "@/components/chat/chat-message";

interface ChatPageProps {
    isRightSidebarVisible?: boolean;
    setIsRightSidebarVisible?: Dispatch<SetStateAction<boolean>>;
    onPinMessage?: (pin: PinType) => void;
    onUnpinMessage?: (pinId: string) => void;
    messages?: Message[];
    setMessages?: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
}

function ChatPageContent({ isRightSidebarVisible, setIsRightSidebarVisible, onPinMessage, onUnpinMessage, messages, setMessages }: ChatPageProps) {

  return (
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        <header className="flex items-center justify-between p-2 border-b h-[60px] bg-card shrink-0">
            <div className="flex items-center gap-4">
                <ModelSelector />
                <div className="w-full max-w-sm hidden md:block">
                    <TokenTracker />
                </div>
            </div>
            <div className="flex items-center gap-4">
                {setIsRightSidebarVisible && isRightSidebarVisible === false && (
                    <Button variant="outline" onClick={() => setIsRightSidebarVisible(true)}>
                        <Pin className="mr-2 h-4 w-4" />
                        Show Pinboard
                    </Button>
                )}
            </div>
        </header>
        <ChatInterface onPinMessage={onPinMessage} onUnpinMessage={onUnpinMessage} messages={messages} setMessages={setMessages} />
      </div>
  );
}

export default function ChatPage() {
    return (
        <AppLayout>
            <ChatPageContent />
        </AppLayout>
    )
}
