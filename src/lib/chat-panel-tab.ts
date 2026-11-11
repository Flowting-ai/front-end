import { useSyncExternalStore } from 'react'

// Which tab the chat's right-hand panel (Context · Browser · Agents) shows. Kept outside React so
// anything that opens the panel — the top-right toggle, the agent chip, the composer's "+" menu, the
// browser status chip — can also pick its tab, even while the panel is already open.
// `null` means "not chosen yet": the panel follows the agent (Browser while it drives one, else Context).

export type ChatPanelTab = 'context' | 'browser' | 'agents'

let current: ChatPanelTab | null = null
const listeners = new Set<() => void>()

export function setChatPanelTab(tab: ChatPanelTab | null) {
  if (tab === current) return
  current = tab
  listeners.forEach(listener => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useChatPanelTab(): ChatPanelTab | null {
  return useSyncExternalStore(subscribe, () => current, () => null)
}
