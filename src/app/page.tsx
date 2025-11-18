'use client';

import { ChatInterface } from "@/components/chat/chat-interface";
import { Button } from "@/components/ui/button";
import { Pin } from "lucide-react";
import { useState, type Dispatch, type SetStateAction } from "react";
import AppLayout from "@/components/layout/app-layout";
import { ModelSelector } from "@/components/chat/model-selector";
import { TokenTracker } from "@/components/chat/token-tracker";
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
}

function ChatPageContent({
  isRightSidebarVisible,
  setIsRightSidebarVisible,
  onPinMessage,
  onUnpinMessage,
  messages,
  setMessages,
}: ChatPageProps) {
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(null);

  return (
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-4 p-4 border-b bg-card/90 backdrop-blur-sm shrink-0 min-h-[68px] shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
            <div className="flex flex-1 flex-wrap items-center gap-4 min-w-[220px]">
                <ModelSelector
                  selectedModel={selectedModel}
                  onModelSelect={setSelectedModel}
                />
                <div className="hidden md:flex flex-1 min-w-[240px] max-w-2xl">
                    <TokenTracker />
                </div>
            </div>
            <div className="flex items-center gap-4 ml-auto">
                {setIsRightSidebarVisible && isRightSidebarVisible === false && (
                    <Button variant="outline" onClick={() => setIsRightSidebarVisible(true)}>
                        <Pin className="mr-2 h-4 w-4" />
                        Show Pinboard
                    </Button>
                )}
            </div>
        </header>
        <div className="border-b bg-white/70 backdrop-blur-sm px-4 py-2 flex flex-wrap gap-2 items-center">
            {[
              { label: "Persona", value: "Tutor" },
              { label: "Tone", value: "Friendly" },
              { label: "Intensity", value: "Medium" },
            ].map((meta) => (
              <div
                key={meta.label}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200/60 bg-slate-50/80 px-3 py-1 text-xs font-medium text-slate-600 shadow-[0_4px_12px_rgba(15,23,42,0.04)]"
              >
                <span className="text-[11px] uppercase tracking-wide text-slate-400">
                  {meta.label}
                </span>
                <span className="text-slate-700">{meta.value}</span>
              </div>
            ))}
        </div>
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
