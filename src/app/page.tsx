'use client';

import { ChatInterface } from "@/components/chat/chat-interface";
import { Button } from "@/components/ui/button";
import { Pin } from "lucide-react";
import { useState, type Dispatch, type SetStateAction } from "react";
import AppLayout from "@/components/layout/app-layout";
import type { Pin as PinType } from "@/components/layout/right-sidebar";
import type { Message } from "@/components/chat/chat-message";
import type { AIModel } from "@/types/ai-model";

interface ChatPageProps {
    isRightSidebarVisible?: boolean;
    setIsRightSidebarVisible?: Dispatch<SetStateAction<boolean>>;
    onPinMessage?: (pin: PinType) => void;
    onUnpinMessage?: (pinId: string) => void;
    messages?: Message[];
    setMessages?: (
      messages: Message[] | ((prev: Message[]) => Message[]),
      chatIdOverride?: string
    ) => void;
    selectedModel?: AIModel | null;
}

function ChatPageContent({
  isRightSidebarVisible,
  setIsRightSidebarVisible,
  onPinMessage,
  onUnpinMessage,
  messages,
  setMessages,
  selectedModel,
}: ChatPageProps) {

  return (
      <div className="flex flex-col flex-1 min-h-0 h-full overflow-hidden">
        <ChatInterface
          onPinMessage={onPinMessage}
          onUnpinMessage={onUnpinMessage}
          messages={messages}
          setMessages={setMessages}
          selectedModel={selectedModel}
        />
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
