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
const TRACK_PADDING = 2
const BUTTON_WIDTH = 20
const BUTTON_HEIGHT = 16

// What each icon does when its option is selected.
const ICON_ACTIVE: Record<ThemeMode, { rotate: number; scale: number }> = {
  light:  { rotate: 90,  scale: 1.1 },  // sun turns
  dark:   { rotate: -20, scale: 1.1 },  // moon tilts
  system: { rotate: 0,   scale: 1.1 },
}

export function ThemeModeSwitcher() {
  const { enabled, mode, setMode } = useTheme()
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
        borderRadius:    6,
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
          borderRadius:    4,
          backgroundColor: 'var(--kaya-seg-thumb-bg)',
          boxShadow:       '0px 1px 2px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-200)',
        }}
      />

      {OPTIONS.map((option, index) => {
        const active = index === activeIndex
        return (
          <Tooltip content={option.label}><button
            key={option.value}
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
              borderRadius:   4,
              background:     'transparent',
              cursor:         'pointer',
              color:          active ? 'var(--neutral-900)' : 'var(--neutral-500)',
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
              <HugeiconsIcon icon={option.icon} size={12} color="currentColor" strokeWidth={1.6} />
            </m.span>
          </button></Tooltip>
        )
      })}
    </div>
  )
}
