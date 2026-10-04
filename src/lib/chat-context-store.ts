import { useSyncExternalStore } from 'react'
import type { UIMessage } from '@/types/chat'

// The Context panel renders in the app shell (next to the floating toolbar), outside the
// chat page's own React tree, so it can't read the chat's messages directly. ChatInterface
// publishes them here instead — the same cross-tree handoff the Agents panel uses with
// AGENT_SELECT_EVENT, but as a store because this is state, not a one-off event.

export interface ChatContextSnapshot {
  chatId: string | undefined
  messages: UIMessage[]
}

const EMPTY: ChatContextSnapshot = { chatId: undefined, messages: [] }

let snapshot: ChatContextSnapshot = EMPTY
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach(listener => listener())
}

export function publishChatContext(next: ChatContextSnapshot): void {
  snapshot = next
  emit()
}

/** Clears the snapshot, but only if it is still the one `chatId` published — a newer chat's data must survive an older one unmounting. */
export function clearChatContext(chatId: string | undefined): void {
  if (snapshot.chatId !== chatId) return
  snapshot = EMPTY
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useChatContext(): ChatContextSnapshot {
  return useSyncExternalStore(subscribe, () => snapshot, () => EMPTY)
}
