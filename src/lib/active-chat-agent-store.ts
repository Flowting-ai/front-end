import { useSyncExternalStore } from 'react'

// Which agent is attached to the current chat (the chip in the composer). The Agents panel renders in
// the app shell, outside the chat page's tree, so the page publishes the attached agent here — the
// panel reads it to offer "Replace agent" instead of "Use agent" while a chip is already active.

let activeAgentId: string | null = null
const listeners = new Set<() => void>()

export function publishActiveChatAgent(id: string | null): void {
  if (activeAgentId === id) return
  activeAgentId = id
  listeners.forEach(listener => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useActiveChatAgentId(): string | null {
  return useSyncExternalStore(subscribe, () => activeAgentId, () => null)
}
