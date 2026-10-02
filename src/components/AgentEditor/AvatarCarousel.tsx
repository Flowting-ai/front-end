'use client'

import React from 'react'
import { m } from 'framer-motion'
import { ArrowLeftOneIcon, ArrowRightOneIcon } from '@strange-huge/icons'
import { IconButton } from '@/components/IconButton'
import {
  AVATAR_CHOICES,
  AnimatedPersonaAvatar,
  type AvatarChoice,
} from '@/components/PersonaCard/AnimatedPersonaAvatar'

// ── Avatar carousel ───────────────────────────────────────────────────────────
// Pick an agent's avatar by cycling through the animated ones: three show at a time with
// the selected one in the middle, biggest and fully lit, its neighbours smaller and dimmed
// either side. Cycling slides every avatar one slot along a spring (the one leaving drifts
// out, the next drifts in), the new middle one scales up and plays its hover animation, and
// the halo behind it takes on its colour. Arrows, clicking a neighbour, or ←/→ all cycle.

const BIG = 92
const SMALL = 56
const SLOT = 104 // horizontal distance between slots
const N = AVATAR_CHOICES.length

/** Position of item `i` relative to the selected one, wrapped into [-N/2, N/2). */
function offsetOf(i: number, selected: number): number {
  const half = Math.floor(N / 2)
  return ((((i - selected) % N) + N + half) % N) - half
}

export function AvatarCarousel({
  value,
  onChange,
  disabled = false,
}: {
  value:     AvatarChoice
  onChange:  (choice: AvatarChoice) => void
  disabled?: boolean
}) {
  const selected = Math.max(0, AVATAR_CHOICES.findIndex(choice => choice.id === value))
  const config = AVATAR_CHOICES[selected]

  const go = (delta: number) => {
    if (disabled) return
    onChange(AVATAR_CHOICES[(selected + delta + N) % N].id)
  }

  return (
    <div
      role="group"
      aria-roledescription="carousel"
      aria-label="Choose an avatar"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return
        if (event.key === 'ArrowLeft')  { event.preventDefault(); go(-1) }
        if (event.key === 'ArrowRight') { event.preventDefault(); go(1) }
      }}
      // No focus ring on the carousel itself (arrow keys still work when it has focus).
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: '100%', borderRadius: 16, outline: 'none' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, width: '100%' }}>
        <IconButton variant="ghost" size="sm" icon={<ArrowLeftOneIcon size={18} />} aria-label="Previous avatar" disabled={disabled} onClick={() => go(-1)} />

        {/* Stage: avatars are absolutely placed by their slot and spring between slots. */}
        <div
          style={{
            position: 'relative', height: BIG + 28, width: SLOT * 2 + BIG,
            maxWidth: 'calc(100% - 88px)', overflow: 'hidden', flex: '0 1 auto',
          }}
        >
          {/* Halo behind the selected avatar — recolours as the selection changes. */}
          <m.div
            aria-hidden
            animate={{ backgroundColor: `color-mix(in srgb, ${config.colors[0]} 40%, transparent)` }}
            transition={{ duration: 0.35 }}
            style={{
              position: 'absolute', left: '50%', top: '50%', width: BIG + 28, height: BIG + 28,
              marginLeft: -(BIG + 28) / 2, marginTop: -(BIG + 28) / 2, borderRadius: '50%',
            }}
          />

          {AVATAR_CHOICES.map((choice, i) => {
            const offset = offsetOf(i, selected)
            // Only the middle three (plus the two just outside, parked invisible so they can
            // slide in) are mounted — every avatar runs its own animation loop.
            if (Math.abs(offset) > 2) return null
            const isMiddle = offset === 0
            const near = Math.abs(offset) <= 1
            return (
              <m.button
                key={choice.id}
                type="button"
                aria-label={isMiddle ? `${choice.label} (selected)` : `Choose ${choice.label}`}
                aria-current={isMiddle ? 'true' : undefined}
                tabIndex={-1}
                disabled={disabled || isMiddle}
                onClick={() => onChange(choice.id)}
                initial={{ x: offset * SLOT, scale: 0.4, opacity: 0 }}
                animate={{
                  x:       offset * SLOT,
                  scale:   isMiddle ? 1 : SMALL / BIG,
                  opacity: isMiddle ? 1 : near ? 0.6 : 0,
                }}
                whileHover={!isMiddle && near && !disabled ? { opacity: 0.95 } : undefined}
                transition={{ type: 'spring', stiffness: 360, damping: 30, mass: 0.9 }}
                style={{
                  position: 'absolute', top: '50%', left: '50%',
                  width: BIG, height: BIG, marginLeft: -BIG / 2, marginTop: -BIG / 2,
                  padding: 0, border: 'none', background: 'none', borderRadius: '50%',
                  cursor: isMiddle || disabled ? 'default' : 'pointer',
                  zIndex: isMiddle ? 2 : 1, pointerEvents: near ? 'auto' : 'none',
                }}
              >
                <div style={{ width: BIG, height: BIG, borderRadius: '50%', backgroundColor: 'var(--static-white)', overflow: 'hidden' }}>
                  <AnimatedPersonaAvatar
                    size={BIG}
                    radius="50%"
                    theme={choice.theme}
                    colors={choice.colors}
                    seed={choice.id}
                    hovered={isMiddle}
                    inert={!isMiddle}
                    // A fresh bounce each time this avatar becomes the selected one.
                    bounceKey={isMiddle ? selected + 1 : 0}
                  />
                </div>
              </m.button>
            )
          })}
        </div>

        <IconButton variant="ghost" size="sm" icon={<ArrowRightOneIcon size={18} />} aria-label="Next avatar" disabled={disabled} onClick={() => go(1)} />
      </div>

      {/* Name of the selected avatar + position dots */}
      <div aria-live="polite" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <m.span
          key={config.id}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          style={{ fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)', fontSize: 14, lineHeight: '20px', color: 'var(--neutral-800)' }}
        >
          {config.label}
        </m.span>
        <div style={{ display: 'flex', gap: 6 }}>
          {AVATAR_CHOICES.map((choice, i) => (
            <m.span
              key={choice.id}
              aria-hidden
              animate={{ width: i === selected ? 16 : 6, backgroundColor: i === selected ? 'var(--neutral-800)' : 'var(--neutral-300)' }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              style={{ height: 6, borderRadius: 3, display: 'block' }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default AvatarCarousel
