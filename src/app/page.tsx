'use client';

import { ChatInterface } from "@/components/chat/chat-interface";
import { Button } from "@/components/ui/button";
import { Pin } from "lucide-react";
import { useState, useEffect, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/layout/app-layout";
import type { PinType } from "@/components/layout/right-sidebar";
import type { Message } from "@/components/chat/chat-message";
import type { AIModel } from "@/types/ai-model";
import { useAuth } from "@/context/auth-context";

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
      <div className="min-h-0 h-full flex-1 flex flex-col overflow-hidden">
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
    const { user, isHydrated } = useAuth();
    const router = useRouter();

    useEffect(() => {
        // Wait for auth state to hydrate before checking
        if (!isHydrated) return;
        
        // Redirect to login if no user is authenticated
        if (!user) {
            router.push('/auth/login');
        }
    }, [user, isHydrated, router]);

    // Don't render anything while checking auth or if not authenticated
    if (!isHydrated || !user) {
        return null;
    }

    return (
        <AppLayout>
            <ChatPageContent />
        </AppLayout>
    )
}
