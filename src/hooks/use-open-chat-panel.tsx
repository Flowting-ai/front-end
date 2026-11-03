'use client'

import React from 'react'
import { ContextPanelContent } from '@/components/ContextPanel'
import { useProjectPanel } from '@/context/project-panel-context'
import { useHighlight } from '@/context/highlight-context'
import { usePinboard } from '@/context/pinboard-context'
import { setChatPanelTab, type ChatPanelTab } from '@/lib/chat-panel-tab'
import { trackFeature } from '@/lib/analytics/events'

/** The chat's right-hand panel: Context · Browser · Agents in tabs at its top. */
export const CHAT_PANEL_TITLE = 'Details'

/**
 * Opens the chat panel on `tab` (or switches to it if the panel is already open), closing Pinboard /
 * Highlights first since only one side panel shows at a time. Without a tab, the panel keeps following
 * the agent (Browser while it drives one, else Context).
 */
export function useOpenChatPanel({ inProject = false, agentsDisabled = false }: { inProject?: boolean; agentsDisabled?: boolean } = {}) {
  const { panel, setPanel } = useProjectPanel()
  const { close: closeHighlight } = useHighlight()
  const { close: closePinboard } = usePinboard()
  const isOpen = panel?.title === CHAT_PANEL_TITLE

  const open = (tab?: ChatPanelTab) => {
    if (tab) setChatPanelTab(tab)
    if (isOpen) return
    closePinboard()
    closeHighlight()
    trackFeature('context_panel_opened')
    setPanel({
      title:       CHAT_PANEL_TITLE,
      content:     <ContextPanelContent inProject={inProject} agentsDisabled={agentsDisabled} />,
      onClose:     () => setPanel(null),
      sidePadding: 8,
    })
  }

  const close = () => { if (isOpen) setPanel(null) }

  return { isOpen, open, close, toggle: () => (isOpen ? close() : open()) }
}
