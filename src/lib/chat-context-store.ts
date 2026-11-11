import type { UIMessage } from '@/types/chat'
import { useChatUiStore, type ChatContextSnapshot } from '@/lib/chat/chat-ui-store'

// The Context panel renders in the app shell (next to the floating toolbar), outside the
// chat page's own React tree, so it can't read the chat's messages directly. ChatInterface
// publishes them here instead — the same cross-tree handoff the Agents panel uses with
// AGENT_SELECT_EVENT, but as a store because this is state, not a one-off event. The state lives
// in the chat UI store (lib/chat/chat-ui-store.ts); turn timing stays here, as a clock, not state.

export type { ChatContextSnapshot }

// ── Turn timing ───────────────────────────────────────────────────────────────
// Messages carry no duration, so how long a turn ran is clocked here, where every
// publish passes through — whether or not the panel is open to watch. A turn starts at
// its loading message's (client-stamped) created_at and ends at the first publish that
// shows it no longer loading. Keyed by reactKey, which survives the temp → real id swap.

export interface TurnTiming {
  startedAt:   number
  /** Unset while the turn is still running. */
  finishedAt?: number
}

const turnTimings = new Map<string, TurnTiming>()

function clockTurns(messages: UIMessage[]): void {
  for (const message of messages) {
    if (message.role !== 'assistant' || !message.reactKey) continue
    const timing = turnTimings.get(message.reactKey)
    if (message.isLoading) {
      if (!timing) {
        const created = Date.parse(message.created_at)
        turnTimings.set(message.reactKey, { startedAt: Number.isNaN(created) ? Date.now() : created })
      }
    } else if (timing && timing.finishedAt === undefined) {
      timing.finishedAt = Date.now()
    }
  }
}

/** When this turn ran, if it ran in this tab. Turns loaded from history have no timing. */
export function turnTiming(message: UIMessage | undefined): TurnTiming | undefined {
  return message?.reactKey ? turnTimings.get(message.reactKey) : undefined
}

export function publishChatContext(next: ChatContextSnapshot): void {
  clockTurns(next.messages)
  useChatUiStore.getState().publishContext(next)
}

/** Clears the snapshot, but only if it is still the one `chatId` published — a newer chat's data must survive an older one unmounting. */
export function clearChatContext(chatId: string | undefined): void {
  useChatUiStore.getState().clearContext(chatId)
}

export function useChatContext(): ChatContextSnapshot {
  return useChatUiStore((state) => state.context)
}
