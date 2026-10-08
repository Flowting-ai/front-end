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
  /** `circle` (default glass sphere) or `rounded` (a rounded square, for compact cards). */
  shape?: 'circle' | 'rounded'
  /** Width in px of the tinted ring around the orb (default 5). */
  ringWidth?: number
}

export function AgentOrb({ colors, size = 110, hovered, wakeKey = 0, shape = 'circle', ringWidth, ...avatar }: AgentOrbProps) {
  const radius = shape === 'rounded' ? '24%' : '50%'
  return (
    <div
      className="agent-orb"
      data-hot={hovered || undefined}
      style={{ width: size, height: size, ['--c0' as string]: colors[0], ['--c1' as string]: colors[1], ['--orb-radius' as string]: radius, ...(ringWidth != null ? { ['--orb-ring' as string]: `${ringWidth}px` } : null) }}
    >
      <div className="agent-orb__dots" />
      {/* Glass sheen sits behind the avatar so the head and body stay fully opaque. */}
      <div className="agent-orb__sheen" />
      {/* Positioned + z-indexed: absolutely-positioned layers otherwise paint over a static avatar. */}
      <div style={{ position: 'relative', zIndex: 1, width: size, height: size }}>
        <AnimatedPersonaAvatar {...avatar} size={size} radius={radius} colors={colors} hovered={hovered} backdrop="transparent" />
      </div>
      {hovered && <div key={wakeKey} className="agent-orb__wake" style={{ zIndex: 2 }} />}
    </div>
  )
}
