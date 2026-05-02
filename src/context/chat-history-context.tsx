"use client";

import { createContext, useContext } from "react";
import {
  useChatHistory as useChatHistoryHook,
  type UseChatHistoryResult,
} from "@/hooks/use-chat-history";

const ChatHistoryContext = createContext<UseChatHistoryResult | null>(null);

export function ChatHistoryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const chatHistory = useChatHistoryHook();
  return (
    <ChatHistoryContext.Provider value={chatHistory}>
      {children}
    </ChatHistoryContext.Provider>
  );
}

export function useChatHistoryContext(): UseChatHistoryResult {
  const ctx = useContext(ChatHistoryContext);
  if (!ctx) {
    throw new Error(
      "useChatHistoryContext must be used within ChatHistoryProvider",
    );
  }
  return ctx;
}
