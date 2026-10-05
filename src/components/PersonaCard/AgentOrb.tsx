'use client'

import React from 'react'
import { AnimatedPersonaAvatar, type AnimatedPersonaAvatarProps } from './AnimatedPersonaAvatar'

// The avatar in its lit glass sphere — backdrop, LED dot matrix, the animated humanoid,
// a pointer-following sheen and rim light, and a coloured halo (styles: .agent-orb in
// globals.css). On hover the orb swells slightly and a scanline "wakes" the screen once.

export interface AgentOrbProps extends Omit<AnimatedPersonaAvatarProps, 'radius' | 'colors'> {
  colors: [string, string]
  /** Increments once per hover-in; replays the wake sweep. */
  wakeKey?: number
}

export function AgentOrb({ colors, size = 110, hovered, wakeKey = 0, ...avatar }: AgentOrbProps) {
  return (
    <div
      className="agent-orb"
      data-hot={hovered || undefined}
      style={{ width: size, height: size, ['--c0' as string]: colors[0], ['--c1' as string]: colors[1] }}
    >
      <div className="agent-orb__dots" />
      <AnimatedPersonaAvatar {...avatar} size={size} radius="50%" colors={colors} hovered={hovered} backdrop="transparent" />
      <div className="agent-orb__sheen" />
      {hovered && <div key={wakeKey} className="agent-orb__wake" />}
    </div>
  )
}
