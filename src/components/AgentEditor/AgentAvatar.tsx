'use client'

import React, { useState } from 'react'
import {
  AnimatedPersonaAvatar,
  defaultAvatarChoice,
  getAvatarChoice,
  type AvatarChoice,
} from '@/components/PersonaCard/AnimatedPersonaAvatar'
import { useStoredAvatarChoice } from '@/lib/avatar-choice'

// The agent's avatar as the cards draw it: the live animated avatar, circular on white,
// inside a halo of its own colour (40%). Used wherever the editor shows the avatar, so it
// matches the agent cards. Plays its hover animation when the pointer is over it.

const HALO = 6

export function AgentAvatar({
  name,
  seed,
  repoId,
  choice: choiceProp,
  size = 64,
}: {
  name:    string
  /** Stable id for the colour fallback; defaults to the name. */
  seed?:   string
  /** The agent's repo id — looks up the avatar the user picked for it. */
  repoId?: string
  /** Forces a specific avatar (e.g. while creating, before there is a repo id). */
  choice?: AvatarChoice | null
  size?:   number
}) {
  const stored = useStoredAvatarChoice(repoId)
  const config = getAvatarChoice(choiceProp ?? stored ?? defaultAvatarChoice(name || 'agent', seed || repoId || name || 'agent'))
  const [hovered, setHovered] = useState(false)
  const [bounceKey, setBounceKey] = useState(0)

  return (
    <div
      aria-hidden
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => setBounceKey(n => n + 1)}
      style={{ position: 'relative', width: size, height: size, margin: HALO, flexShrink: 0, cursor: 'pointer' }}
    >
      <div
        style={{
          position:        'absolute',
          inset:           -HALO,
          borderRadius:    '50%',
          backgroundColor: `color-mix(in srgb, ${config.colors[0]} 40%, transparent)`,
          transform:       hovered ? 'scale(1.08)' : 'scale(1)',
          transition:      'transform 300ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />
      <div style={{ position: 'relative', borderRadius: '50%', backgroundColor: 'var(--static-white)' }}>
        <AnimatedPersonaAvatar
          size={size}
          radius="50%"
          theme={config.theme}
          colors={config.colors}
          seed={seed || repoId || name || 'agent'}
          hovered={hovered}
          bounceKey={bounceKey}
        />
      </div>
    </div>
  )
}

export default AgentAvatar
