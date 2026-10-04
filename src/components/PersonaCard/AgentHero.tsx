'use client'

import React from 'react'
import { useStoredAvatarChoice } from '@/lib/avatar-choice'
import { AnimatedPersonaAvatar, defaultAvatarChoice, getAvatarChoice } from './AnimatedPersonaAvatar'

// The banner every agent card opens with (the layout of a Grok Bot template card): the agent's
// own colour as a soft glow over a deeper base, with its live avatar centred on it. Shared by the
// agents grid, the agents panel and the "agent created" card so one agent looks the same everywhere.

// Fine film grain: fractal noise, desaturated, as a tiling SVG. Blended over the gradient
// (soft-light) it breaks up the colour banding and gives the banner its textured, printed look.
const NOISE =
  "url(\"data:image/svg+xml;utf8," +
  "<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'>" +
  "<filter id='n' x='0' y='0' width='100%' height='100%'>" +
  "<feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/>" +
  "<feColorMatrix type='saturate' values='0'/></filter>" +
  "<rect width='100%' height='100%' filter='url(%23n)'/></svg>\")"

/** The banner's background for an agent's colour: a light glow top-left and a dark pool bottom-right over a deep base, with film grain on top. Spread into a style object. */
export function agentHeroStyle(color: string): React.CSSProperties {
  return {
    backgroundColor:     `color-mix(in srgb, ${color} 64%, black)`,
    backgroundImage: [
      NOISE,
      `radial-gradient(120% 150% at 12% 0%, color-mix(in srgb, ${color} 72%, white) 0%, transparent 58%)`,
      `radial-gradient(110% 130% at 100% 100%, color-mix(in srgb, ${color} 60%, black) 0%, transparent 62%)`,
    ].join(', '),
    backgroundBlendMode: 'soft-light, normal, normal',
  }
}

export interface AgentHeroProps {
  /** Agent name — picks the avatar when none was chosen. */
  name:       string
  /** The agent's repo id: finds the avatar the user picked, and seeds the default. */
  agentId:    string
  height?:    number
  /** Fixed width; omit to fill the card. */
  width?:     number
  avatarSize?: number
  /** Corner radius, to match the card it sits in. Top corners only unless `rounded`. */
  radius?:    number
  /** Round all four corners (a free-standing tile) instead of just the top two. */
  rounded?:   boolean
  /** Plays the avatar's hover animation. */
  hovered?:   boolean
  bounceKey?: number
  /** Freezes the avatar (paused agents). */
  inert?:     boolean
  /** Dims the banner (paused / draft agents). */
  opacity?:   number
  /** Corner controls, drawn over the banner. */
  children?:  React.ReactNode
}

export function AgentHero({
  name,
  agentId,
  height = 104,
  width,
  avatarSize = 64,
  radius = 20,
  rounded = false,
  hovered = false,
  bounceKey = 0,
  inert = false,
  opacity = 1,
  children,
}: AgentHeroProps) {
  const stored = useStoredAvatarChoice(agentId)
  const avatar = getAvatarChoice(stored ?? defaultAvatarChoice(name, agentId))

  return (
    <div style={{ position: 'relative', height, width, flexShrink: 0 }}>
      <div
        style={{
          position:     'absolute',
          inset:        0,
          borderRadius: rounded ? radius : `${radius}px ${radius}px 0 0`,
          ...agentHeroStyle(avatar.colors[0]),
          opacity,
          transition:   'opacity 0.2s ease',
        }}
      />
      <div
        style={{
          position:        'absolute',
          left:            '50%',
          top:             '50%',
          transform:       'translate(-50%, -50%)',
          borderRadius:    '50%',
          backgroundColor: 'var(--static-white)',
          opacity:         inert ? 0.7 : 1,
        }}
      >
        <AnimatedPersonaAvatar
          size={avatarSize}
          radius="50%"
          theme={avatar.theme}
          colors={avatar.colors}
          seed={agentId}
          hovered={hovered}
          bounceKey={bounceKey}
          inert={inert}
        />
      </div>
      {children}
    </div>
  )
}
