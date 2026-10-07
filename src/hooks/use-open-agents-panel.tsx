'use client'

import React from 'react'
import { AgentsPanelContent } from '@/components/AgentsPanel'
import { useProjectPanel } from '@/context/project-panel-context'
import { useHighlight } from '@/context/highlight-context'
import { usePinboard } from '@/context/pinboard-context'

export const AGENTS_PANEL_TITLE = 'Agents'

/**
 * Opens the Agents side panel (the same one the floating toolbar and the composer's "+" menu open),
 * closing Pinboard / Highlights first since only one side panel shows at a time. A no-op when it is
 * already showing. Used by the agent chip's arrow, so the chip leads straight into the panel.
 */
export function useOpenAgentsPanel({ inProject = false }: { inProject?: boolean } = {}) {
  const { panel, setPanel } = useProjectPanel()
  const { close: closeHighlight } = useHighlight()
  const { close: closePinboard } = usePinboard()
  return () => {
    if (panel?.title === AGENTS_PANEL_TITLE) return
    closePinboard()
    closeHighlight()
    setPanel({
      title:       AGENTS_PANEL_TITLE,
      content:     <AgentsPanelContent inProject={inProject} />,
      onClose:     () => setPanel(null),
      sidePadding: 8,
    })
  }
}
