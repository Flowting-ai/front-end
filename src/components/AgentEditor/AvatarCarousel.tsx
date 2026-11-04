'use client'

import React, { useRef, useState } from 'react'
import {
  AVATAR_CHOICES,
  AnimatedPersonaAvatar,
  type AvatarChoice,
} from '@/components/PersonaCard/AnimatedPersonaAvatar'

// ── Avatar picker ─────────────────────────────────────────────────────────────
// One big live preview of the selected avatar over a grid of every choice. Only the preview
// animates; the grid tiles are still frames (no animation loop each), so the picker stays cheap
// however many avatars there are. Click a tile, or move with the arrow keys / Home / End —
// the grid is a radio group with one tab stop.

const PREVIEW = 88
const TILE = 36
const COLS = 6

/** Hue (0–360) and saturation (0–1) of a #rrggbb colour. */
function hueSat(hex: string): [number, number] {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  if (d === 0) return [0, 0]
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [(h * 60 + 360) % 360, d / (1 - Math.abs(max + min - 1))]
}

// The grid runs round the colour wheel by each avatar's shadow colour, so similar colours sit
// together; the near-greys (slate, white) go last.
const CHOICES = [...AVATAR_CHOICES].sort((a, b) => {
  const [ha, sa] = hueSat(a.colors[1]), [hb, sb] = hueSat(b.colors[1])
  const greyA = sa < 0.2, greyB = sb < 0.2
  return greyA !== greyB ? (greyA ? 1 : -1) : ha - hb
})
const N = CHOICES.length

export function AvatarCarousel({
  value,
  onChange,
  disabled = false,
}: {
  value:     AvatarChoice
  onChange:  (choice: AvatarChoice) => void
  disabled?: boolean
}) {
  const selected = Math.max(0, CHOICES.findIndex(choice => choice.id === value))
  // Hovering a tile previews it in the big avatar; nothing changes until it's clicked.
  const [hovered, setHovered] = useState<number | null>(null)
  const config = CHOICES[hovered ?? selected]
  const previewing = hovered !== null && hovered !== selected
  const tiles = useRef<(HTMLButtonElement | null)[]>([])
  // A fresh hop on the preview each time the selection changes.
  const [bounce, setBounce] = useState(0)

  const pick = (i: number, focus = false) => {
    if (disabled) return
    const next = (i + N) % N
    if (next !== selected) { onChange(CHOICES[next].id); setBounce(b => b + 1) }
    if (focus) tiles.current[next]?.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -COLS, ArrowDown: COLS }
    let next: number | null = null
    if (event.key in step) next = selected + step[event.key]
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = N - 1
    if (next === null) return
    event.preventDefault()
    // Up/Down stop at the edges; Left/Right wrap.
    if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && (next < 0 || next >= N)) return
    pick(next, true)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%' }}>
      {/* Preview, on a halo that takes the avatar's colour. */}
      <div
        aria-hidden
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: PREVIEW + 24, height: PREVIEW + 24, borderRadius: '50%',
          backgroundColor: `color-mix(in srgb, ${config.colors[0]} 40%, transparent)`,
          transition: 'background-color 300ms ease',
        }}
      >
        <div style={{ width: PREVIEW, height: PREVIEW, borderRadius: '50%', backgroundColor: 'var(--static-white)', overflow: 'hidden' }}>
          <AnimatedPersonaAvatar
            size={PREVIEW}
            radius="50%"
            theme={config.theme}
            colors={config.colors}
            seed={config.id}
            hovered
            eyes
            bounceKey={bounce}
          />
        </div>
      </div>

      {/* Name of what's shown: the selection, or (muted, with a hint) the tile under the pointer. */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 36 }}>
        <span style={{ fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)', fontSize: 14, lineHeight: '20px', color: previewing ? 'var(--neutral-500)' : 'var(--neutral-800)' }}>
          {config.label}
        </span>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: '16px', color: 'var(--neutral-500)', visibility: previewing ? 'visible' : 'hidden' }}>
          Click to choose
        </span>
      </div>

      {/* The tiles sit on a soft tray so the grid reads as one control. */}
      <div
        role="radiogroup"
        aria-label="Choose an avatar"
        aria-disabled={disabled || undefined}
        onKeyDown={onKeyDown}
        onMouseLeave={() => setHovered(null)}
        style={{
          display: 'grid', gridTemplateColumns: `repeat(${COLS}, ${TILE}px)`, gap: 10, padding: 12,
          borderRadius: 16, backgroundColor: 'var(--neutral-50)', boxShadow: 'inset 0 0 0 1px var(--neutral-100)',
        }}
      >
        {CHOICES.map((choice, i) => {
          const isSelected = i === selected
          return (
            <button
              key={choice.id}
              ref={el => { tiles.current[i] = el }}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={choice.label}
              tabIndex={isSelected ? 0 : -1}
              disabled={disabled}
              onClick={() => pick(i)}
              onMouseEnter={() => { if (!disabled) setHovered(i) }}
              // Keyboard focus always sits on the selected tile, whose ring already marks it.
              className="outline-none enabled:hover:scale-110 enabled:active:scale-95"
              style={{
                position: 'relative', width: TILE, height: TILE, padding: 0, border: 'none', borderRadius: '50%',
                background: 'none',
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled && !isSelected ? 0.5 : 1,
                // The selected tile: a ring in its own colour, offset by a gap of the tray colour.
                boxShadow: isSelected
                  ? `0 0 0 2px var(--neutral-50), 0 0 0 4px ${choice.colors[1]}`
                  : '0 1px 2px rgba(0, 0, 0, 0.08), 0 0 0 1px var(--neutral-100)',
                transition: 'box-shadow 150ms ease, transform 150ms ease',
              }}
            >
              <span style={{ display: 'block', width: TILE, height: TILE, borderRadius: '50%', overflow: 'hidden', backgroundColor: 'var(--static-white)' }}>
                <AnimatedPersonaAvatar
                  size={TILE}
                  radius="50%"
                  theme={choice.theme}
                  colors={choice.colors}
                  seed={choice.id}
                  hovered={false}
                  eyes
                  still
                />
              </span>
              {/* Check badge on the selected tile. */}
              {isSelected && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute', right: -5, bottom: -5, width: 16, height: 16, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: choice.colors[1], color: '#fff', boxShadow: '0 0 0 2px var(--neutral-50)',
                  }}
                >
                  <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2.5 6.2l2.3 2.3 4.7-5" />
                  </svg>
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default AvatarCarousel
