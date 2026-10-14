"use client";

// Chat history is shared React Query state now (hooks/use-chat-history.ts), so
// it needs no provider: every caller subscribes to the same cached list. This
// name stays for the existing imports.
export { useChatHistory as useChatHistoryContext } from "@/hooks/use-chat-history";
