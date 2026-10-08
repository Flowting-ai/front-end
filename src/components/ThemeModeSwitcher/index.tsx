'use client'

import { Tooltip } from '@/components/Tooltip'
import React, { useRef } from 'react'
import { m, useReducedMotion } from 'framer-motion'
import { HugeiconsIcon } from '@hugeicons/react'
import Sun01Icon from '@hugeicons/core-free-icons/Sun01Icon'
import Moon01Icon from '@hugeicons/core-free-icons/Moon01Icon'
import ComputerIcon from '@hugeicons/core-free-icons/ComputerIcon'
import { useTheme } from '@/context/theme-context'
import { springs } from '@/lib/springs'
import type { ThemeMode } from '@/lib/theme'

// Light / Dark / System as a three-way slider: a thumb springs between the options and
// each icon reacts when it becomes active. Drives the same preference as Settings →
// Account → Screen mode (ThemeProvider), so the two always agree.

const OPTIONS: ReadonlyArray<{ value: ThemeMode; label: string; icon: typeof Sun01Icon }> = [
  { value: 'light',  label: 'Light',  icon: Sun01Icon },
  { value: 'dark',   label: 'Dark',   icon: Moon01Icon },
  { value: 'system', label: 'System', icon: ComputerIcon },
]
// Matches the plan chip beside it: 20px tall (2px padding + 16px buttons), 6px corners, 64px wide.
// `sm` is the compact account-menu control; `lg` is the larger one used in the settings header.
const SIZES = {
  sm: { padding: 2, width: 20, height: 16, icon: 12, track: 6, inner: 4 },
  lg: { padding: 3, width: 28, height: 24, icon: 16, track: 9, inner: 6 },
} as const

// What each icon does when its option is selected.
const ICON_ACTIVE: Record<ThemeMode, { rotate: number; scale: number }> = {
  light:  { rotate: 90,  scale: 1.1 },  // sun turns
  dark:   { rotate: -20, scale: 1.1 },  // moon tilts
  system: { rotate: 0,   scale: 1.1 },
}

export function ThemeModeSwitcher({ size = 'sm' }: { size?: keyof typeof SIZES } = {}) {
  const { padding: TRACK_PADDING, width: BUTTON_WIDTH, height: BUTTON_HEIGHT, icon: ICON_SIZE, track: TRACK_RADIUS, inner: INNER_RADIUS } = SIZES[size]
  const { enabled, mode, setMode, resolved } = useTheme()
  const isDark = resolved === 'dark'
  const reduceMotion = useReducedMotion()
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])

  // Theming flag off: the preference can't be applied, so don't offer it.
  if (!enabled) return null

  const activeIndex = Math.max(0, OPTIONS.findIndex(option => option.value === mode))
  const transition = reduceMotion ? { duration: 0 } : springs.fast

  const select = (index: number) => {
    const next = (index + OPTIONS.length) % OPTIONS.length
    setMode(OPTIONS[next].value)
    buttonRefs.current[next]?.focus()
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      select(activeIndex + 1)
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      select(activeIndex - 1)
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      onKeyDown={handleKeyDown}
      style={{
        position:        'relative',
        display:         'flex',
        flex:            'none',
        boxSizing:       'border-box',
        padding:         TRACK_PADDING,
        borderRadius:    TRACK_RADIUS,
        backgroundColor: 'var(--neutral-100)',
        boxShadow:       'inset 0px 0px 0px 1px var(--neutral-200)',
      }}
    >
      {/* Thumb: one button wide; x in % of its own width = whole steps. */}
      <m.div
        aria-hidden
        initial={false}
        animate={{ x: `${activeIndex * 100}%` }}
        transition={transition}
        style={{
          position:        'absolute',
          top:             TRACK_PADDING,
          bottom:          TRACK_PADDING,
          left:            TRACK_PADDING,
          width:           BUTTON_WIDTH,
          borderRadius:    INNER_RADIUS,
          // White in light mode (the shared segmented-control thumb is cream there); the usual raised grey in dark.
          backgroundColor: isDark ? 'var(--kaya-seg-thumb-bg)' : '#ffffff',
          boxShadow:       isDark
            ? '0px 1px 2px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-200)'
            : '0px 1px 2px 0px rgba(0, 0, 0, 0.25), 0px 0px 0px 1px rgba(0, 0, 0, 0.08)',
        }}
      />

      {OPTIONS.map((option, index) => {
        const active = index === activeIndex
        return (
          <Tooltip key={option.value} content={option.label}><button
            ref={node => { buttonRefs.current[index] = node }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.label}
            tabIndex={active ? 0 : -1}
            onClick={() => setMode(option.value)}
            style={{
              position:       'relative',
              zIndex:         1,
              flex:           'none',
              width:          BUTTON_WIDTH,
              display:        'inline-flex',
              alignItems:     'center',
              justifyContent: 'center',
              height:         BUTTON_HEIGHT,
              padding:        0,
              border:         'none',
              borderRadius:   INNER_RADIUS,
              background:     'transparent',
              cursor:         'pointer',
              // The active icon follows the thumb: dark on the white thumb (light), the normal text colour on the grey one (dark).
              color:          active ? (isDark ? 'var(--neutral-900)' : '#1c1c1c') : 'var(--neutral-500)',
              transition:     reduceMotion ? 'none' : 'color 180ms ease',
            }}
          >
            <m.span
              aria-hidden
              initial={false}
              animate={active ? ICON_ACTIVE[option.value] : { rotate: 0, scale: 1 }}
              transition={transition}
              style={{ display: 'inline-flex', lineHeight: 0 }}
            >
              <HugeiconsIcon icon={option.icon} size={ICON_SIZE} color="currentColor" strokeWidth={1.6} />
            </m.span>
          </button></Tooltip>
        )
      })}
    </div>
  )
}
