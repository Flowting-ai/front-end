import { useChatUiStore } from '@/lib/chat/chat-ui-store'

// Which agent is attached to the current chat (the chip in the composer). The Agents panel renders in
// the app shell, outside the chat page's tree, so the page publishes the attached agent here — the
// panel reads it to offer "Replace agent" instead of "Use agent" while a chip is already active.
// Backed by the chat UI store (lib/chat/chat-ui-store.ts).

export function publishActiveChatAgent(id: string | null): void {
  useChatUiStore.getState().setActiveAgent(id)
}

export function useActiveChatAgentId(): string | null {
  return useChatUiStore((state) => state.activeAgentId)
}
