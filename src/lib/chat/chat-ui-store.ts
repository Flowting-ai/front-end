import { create } from 'zustand'
import type { UIMessage } from '@/types/chat'

// Chat UI state shared across React trees. The Context and Agents panels render in the app shell,
// outside the chat page's tree, so the page publishes here and the panels read with selectors.
// Server data (chat list, messages from the API) stays in React Query; this holds only what the
// open chat screen knows right now. lib/chat-context-store.ts and lib/active-chat-agent-store.ts
// are the stable entry points over it.

export interface ChatContextSnapshot {
  chatId: string | undefined
  messages: UIMessage[]
}

export const EMPTY_CHAT_CONTEXT: ChatContextSnapshot = { chatId: undefined, messages: [] }

interface ChatUiState {
  /** The open chat's id and messages, for the Context panel and the browser session. */
  context: ChatContextSnapshot
  /** The agent attached to the open chat (the composer chip), for the Agents panel. */
  activeAgentId: string | null
  publishContext: (next: ChatContextSnapshot) => void
  /** Clears the context only if `chatId` still owns it: a newer chat must survive an older one unmounting. */
  clearContext: (chatId: string | undefined) => void
  setActiveAgent: (id: string | null) => void
}

export const useChatUiStore = create<ChatUiState>()((set, get) => ({
  context: EMPTY_CHAT_CONTEXT,
  activeAgentId: null,
  publishContext: (next) => set({ context: next }),
  clearContext: (chatId) => {
    if (get().context.chatId === chatId) set({ context: EMPTY_CHAT_CONTEXT })
  },
  setActiveAgent: (id) => {
    if (get().activeAgentId !== id) set({ activeAgentId: id })
  },
}))
