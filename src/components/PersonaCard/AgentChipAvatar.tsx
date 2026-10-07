'use client'

import React from 'react'
import { useStoredAvatarChoice } from '@/lib/avatar-choice'
import { AnimatedPersonaAvatar, defaultAvatarChoice, getAvatarChoice } from './AnimatedPersonaAvatar'

/**
 * The agent's own animated avatar at chip size. It resolves the avatar exactly the way the
 * /agents cards and the Agents panel do (the choice stored for the agent, else the default for
 * its name), so a chip can never show a different avatar than the list it was picked from.
 */
export function AgentChipAvatar({ agentId, name, size = 24 }: { agentId: string; name: string; size?: number }) {
  const stored = useStoredAvatarChoice(agentId)
  const avatar = getAvatarChoice(stored ?? defaultAvatarChoice(name, agentId))
  return (
    <AnimatedPersonaAvatar
      theme={avatar.theme}
      seed={agentId}
      colors={avatar.colors}
      hovered={false}
      size={size}
      radius={6}
      eyes
    />
  )
}

export default AgentChipAvatar
