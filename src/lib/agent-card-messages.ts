/**
 * The thread rows for an agent just created from chat: the request, and the
 * agent's card. They live only in the browser — the backend never sees them.
 */

import type { SelectedPersonaInfo } from '@/lib/chat-personas'
import type { UIMessage } from '@/types/chat'

export function buildAgentCardMessages(args: {
  persona:   SelectedPersonaInfo
  published: boolean
  /** What the user typed to ask for the agent. */
  message:   string
  chatId?:   string
  now?:      Date
}): UIMessage[] {
  const { persona, published, message, chatId = '', now = new Date() } = args
  const created_at = now.toISOString()
  return [
    { id: `local-request-${persona.id}`, role: 'user', content: message, created_at, chat_id: chatId, localOnly: true },
    {
      id: `local-agent-${persona.id}`, role: 'assistant', content: '', created_at, chat_id: chatId, localOnly: true,
      agentCard: { persona, published },
    },
  ]
}

/** Appends `injected` to `prev`, skipping any row already there (so it is safe to run twice). */
export function mergeInjectedMessages(prev: UIMessage[], injected: readonly UIMessage[]): UIMessage[] {
  const known = new Set(prev.map(message => message.id))
  const fresh = injected.filter(message => !known.has(message.id))
  return fresh.length === 0 ? prev : [...prev, ...fresh]
}
