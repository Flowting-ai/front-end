'use client'

import React from 'react'
import { ArrowRightOneIcon } from '@strange-huge/icons'
import { Chip } from '@/components/Chip'
import { AgentChipAvatar } from '@/components/PersonaCard/AgentChipAvatar'

/**
 * The composer chip for the agent attached to a chat. Its avatar is the agent's own animated one (the
 * same the /agents cards and the Agents panel resolve), and its right arrow leads straight into the
 * Agents panel (`onOpenPanel`) to replace the agent.
 */
export function AgentChip({
  agent,
  onRemove,
  onOpenPanel,
}: {
  agent: { id: string; name: string }
  onRemove: () => void
  onOpenPanel: () => void
}) {
  return (
    <Chip
      className="agent-chip"
      label={agent.name}
      personaAvatar={<AgentChipAvatar agentId={agent.id} name={agent.name} size={24} />}
      onRemove={onRemove}
      onExpand={onOpenPanel}
      rightIcon={<ArrowRightOneIcon size={20} color="var(--chip-text)" />}
      rightLabel="Open agents panel"
    />
  )
}

export default AgentChip
