'use client'

import { useOpenChatPanel } from '@/hooks/use-open-chat-panel'

/**
 * Opens the chat panel on its Agents tab (switching to it if the panel is already open). Used by the
 * agent chip's arrow, so the chip leads straight to the agent list.
 */
export function useOpenAgentsPanel({ inProject = false }: { inProject?: boolean } = {}) {
  const { open } = useOpenChatPanel({ inProject })
  return () => open('agents')
}
