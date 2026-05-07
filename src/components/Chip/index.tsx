'use client'

import React, { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { LogoIcon, CancelOneIcon, ExchangeOneIcon, ArrowDownOneIcon } from '@strange-huge/icons'
import { cn } from '@/lib/utils'
import { ChipButton } from '@/components/ChipButton'

// Re-export for back-compat — original public path was `@/components/Chip`.
// New canonical path is `@/components/ChipButton`.
export { ChipButton } from '@/components/ChipButton'
export type { ChipButtonProps } from '@/components/ChipButton'

// ── Animation constants (KDS in-place swap pattern) ────────────────────────────
const SPRING       = { type: 'spring', stiffness: 500, damping: 30 } as const
const SWAP_INITIAL = { scale: 0.75, opacity: 0, filter: 'blur(4px)' }
const SWAP_ANIMATE = { scale: 1,    opacity: 1, filter: 'blur(0px)' }
const SWAP_EXIT    = { scale: 0.75, opacity: 0, filter: 'blur(4px)' }
const SWAP_INSTANT = { scale: 1,    opacity: 1, filter: 'blur(0px)' }

// ── Color system ───────────────────────────────────────────────────────────────

export type ChipColor = 'Blue' | 'Red' | 'Green' | 'Yellow' | 'Purple' | 'Brown' | 'Neutral'

interface ChipColorTokens {
  bg:           string  // chip background
  text:         string  // all text + icon color
  shadow:       string  // outer drop shadow + ring
  innerShadow:  string  // inset depth/highlight on chip
  buttonShadow: string  // inset shadow on ChipButton hover
}

// Chip / Badge / PinCategory all share a 7-color palette. Tokens live in
// aliases.css under `--color-tag-{Color}-{prop}`. Chip's Green uses the lighter
// `bg-soft` tint; every other colour uses `bg`.
const COLOR_CONFIG: Record<ChipColor, ChipColorTokens> = (
  ['Blue', 'Red', 'Green', 'Yellow', 'Purple', 'Brown', 'Neutral'] as const
).reduce((acc, color) => {
  const bgVar = color === 'Green' ? `--color-tag-Green-bg-soft` : `--color-tag-${color}-bg`
  acc[color] = {
    bg:           `var(${bgVar})`,
    text:         `var(--color-tag-${color}-text)`,
    shadow:       `var(--color-tag-${color}-shadow)`,
    innerShadow:  `var(--color-tag-${color}-inner-shadow)`,
    buttonShadow: `var(--color-tag-${color}-button-shadow)`,
  }
  return acc
}, {} as Record<ChipColor, ChipColorTokens>)

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ChipProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Label text shown in the centre of the chip */
  label?: string
  /**
   * Custom left icon — Medium only.
   * Shown at rest when no `personaImage` is provided. Defaults to `<LogoIcon />`.
   * Ignored for Small chips (always renders `CancelOneIcon`).
   */
  icon?: React.ReactNode
  /**
   * Avatar image URL — Medium only.
   * Renders as a 24×24px image instead of the icon. Treated as decorative (`alt=""`).
   * Ignored for Small chips.
   */
  personaImage?: string
  /**
   * Called when the × (remove) button is clicked.
   * Medium: fires on hover; Small: fires on direct click of the always-visible × button.
   */
  onRemove?: React.MouseEventHandler<HTMLButtonElement>
  /**
   * Called when the ↺ (change) button is clicked on hover — Medium only.
   * If omitted, the right slot is not rendered.
   * Ignored for Small chips.
   */
  onChange?: React.MouseEventHandler<HTMLButtonElement>
  /**
   * Called when the right ChipButton is clicked — **Small only.**
   * If omitted, the right ChipButton is not rendered. Ignored for Medium chips.
   */
  onExpand?: React.MouseEventHandler<HTMLButtonElement>
  /**
   * Override the icon shown in the left ChipButton — **Small only.**
   * Defaults to `<CancelOneIcon size={14} />`. Render at 14×14 with
   * `color="var(--chip-text)"` so it follows the chip's color variant.
   */
  leftIcon?: React.ReactNode
  /**
   * Override the icon shown in the right ChipButton — **Small only.**
   * Defaults to `<ArrowDownOneIcon size={14} />` (chevron-down). Only renders
   * when `onExpand` is provided. Render at 14×14 with `color="var(--chip-text)"`.
   */
  rightIcon?: React.ReactNode
  /** Aria-label for the left ChipButton — **Small only.** Defaults to `"Remove"`. */
  leftLabel?: string
  /** Aria-label for the right ChipButton — **Small only.** Defaults to `"Open menu"`. */
  rightLabel?: string
  /**
   * Color variant — **Small chips only.**
   * Sets background, text color, ring shadow, and inner shadow from `COLOR_CONFIG`.
   * Medium chips are always Blue (controlled by `--chip-*` tokens in semantic.css).
   * Defaults to `'Blue'`.
   */
  color?: ChipColor
  /**
   * `'Medium'` — full-size animated chip; hover swaps left icon → × remove button (default)
   * `'Small'` — compact colored tag; always shows × as a `ChipButton`; no hover animation
   */
  size?: 'Medium' | 'Small'
}

// ── Component ──────────────────────────────────────────────────────────────────

export const Chip = React.forwardRef<HTMLDivElement, ChipProps>(
  function Chip(
    {
      label = 'Souvenir',
      icon,
      personaImage,
      onRemove,
      onChange,
      onExpand,
      leftIcon,
      rightIcon,
      leftLabel  = 'Remove',
      rightLabel = 'Open menu',
      color     = 'Blue',
      size      = 'Medium',
      className,
      onMouseEnter: externalMouseEnter,
      onMouseLeave: externalMouseLeave,
      ...props
    },
    ref,
  ) {
    const cfg          = COLOR_CONFIG[color]
    const [isActive, setIsActive] = useState(false)
    const reduceMotion = useReducedMotion()

    const initial = reduceMotion ? SWAP_INSTANT : SWAP_INITIAL
    const exit    = reduceMotion ? SWAP_INSTANT : SWAP_EXIT

    // ── Small chip ─────────────────────────────────────────────────────────────
    if (size === 'Small') {
      return (
        <div
          ref={ref}
          role="group"
          aria-label={label}
          className={cn(className)}
          style={{
            // Cascade color tokens to all children
            '--chip-text':                cfg.text,
            '--chip-button-inner-shadow': cfg.buttonShadow,

            position:        'relative',
            display:         'inline-flex',
            alignItems:      'center',
            padding:         '2px',
            borderRadius:    '6px',
            // backgroundColor goes on the element itself — avoids z-index stacking
            // issue where an absolute overlay div would render above inline children
            backgroundColor: cfg.bg,
            boxShadow:       cfg.shadow,
          } as React.CSSProperties}
          {...props}
        >
          {/* Left ChipButton — always rendered; icon is swappable via `leftIcon`. */}
          <ChipButton
            size="16px"
            icon={leftIcon ?? <CancelOneIcon size={14} color={cfg.text} />}
            aria-label={leftLabel}
            onClick={onRemove}
          />

          {/* Label */}
          <span
            style={{
              padding:    '0 2px',
              fontFamily: 'var(--font-body)',
              fontWeight: 'var(--font-weight-medium)',
              fontSize:   'var(--font-size-caption)',
              lineHeight: 'var(--line-height-caption)',
              color:      cfg.text,
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </span>

          {/* Right ChipButton — rendered when `onExpand` is provided; icon is
              swappable via `rightIcon` (defaults to chevron-down per Figma 1023:597). */}
          {onExpand && (
            <ChipButton
              size="16px"
              icon={rightIcon ?? <ArrowDownOneIcon size={14} color={cfg.text} />}
              aria-label={rightLabel}
              onClick={onExpand}
            />
          )}

          {/* Inner depth/highlight shadow — rendered last so it sits above content */}
          <div
            aria-hidden
            style={{
              position:      'absolute',
              inset:         0,
              pointerEvents: 'none',
              borderRadius:  'inherit',
              boxShadow:     cfg.innerShadow,
            }}
          />
        </div>
      )
    }

    // ── Medium chip ────────────────────────────────────────────────────────────
    return (
      <div
        ref={ref}
        role="group"
        aria-label={label}
        tabIndex={0}
        className={cn('kds-chip', className)}
        onMouseEnter={(e) => { setIsActive(true); externalMouseEnter?.(e) }}
        onMouseLeave={(e) => { setIsActive(false); externalMouseLeave?.(e) }}
        onFocus={() => setIsActive(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsActive(false)
          }
        }}
        style={{
          position:        'relative',
          display:         'inline-flex',
          alignItems:      'center',
          borderRadius:    '10px',
          paddingTop:    (!onChange || isActive || !!personaImage) ? '4px' : '2px',
          paddingBottom: (!onChange || isActive || !!personaImage) ? '4px' : '2px',
          paddingLeft:   (!onChange || isActive || !!personaImage) ? '4px' : '2px',
          paddingRight:  (!onChange || isActive || !!personaImage) ? '4px' : '2px',
          gap:             '2px',
          backgroundColor: isActive ? 'var(--chip-bg)' : 'transparent',
          boxShadow:       isActive ? 'var(--chip-shadow)' : 'none',
          transition:      'background-color 150ms, box-shadow 150ms',
          color:           'var(--chip-text)',
          cursor:          'pointer',
        } as React.CSSProperties}
        {...props}
      >

        {/* ── Left: icon/image at rest ↔ remove button on active ── */}
        <AnimatePresence mode="popLayout" initial={false}>
          {isActive ? (
            <motion.span
              key="remove"
              initial={initial}
              animate={SWAP_ANIMATE}
              exit={exit}
              transition={SPRING}
              style={{ display: 'flex' }}
            >
              <ChipButton
                icon={<CancelOneIcon size={20} color="var(--chip-text)" />}
                aria-label="Remove"
                onClick={onRemove}
              />
            </motion.span>
          ) : (
            <motion.span
              key="left-icon"
              initial={initial}
              animate={SWAP_ANIMATE}
              exit={exit}
              transition={SPRING}
              style={{
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                overflow:       'hidden',
                padding:        personaImage ? '2px' : !onChange ? '4px' : '6px',
                borderRadius:   '8px',
                flexShrink:     0,
              }}
            >
              {personaImage
                ? <img src={personaImage} alt="" style={{ width: 24, height: 24, borderRadius: '6px', display: 'block' }} />
                : (icon ?? <LogoIcon size={20} color="var(--chip-text)" />)
              }
            </motion.span>
          )}
        </AnimatePresence>

        {/* ── Label ── */}
        <div style={{
          paddingLeft:  (isActive || !onChange || !!personaImage) ? '2px' : 0,
          paddingRight: (isActive || !onChange || !!personaImage) ? '2px' : 0,
          flexShrink: 0,
        }}>
          <span style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 'var(--font-weight-medium)',
            fontSize:   'var(--font-size-body)',
            lineHeight: 'var(--line-height-body)',
            color:      'var(--chip-text)',
            whiteSpace: 'nowrap',
          }}>
            {label}
          </span>
        </div>

        {/* ── Right: only rendered when onChange is provided ── */}
        {onChange && (isActive ? (
          <ChipButton
            icon={<ExchangeOneIcon size={20} color="var(--chip-text)" />}
            aria-label="Change"
            spinOnHover
            onClick={onChange}
          />
        ) : (
          <span
            aria-hidden
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              overflow:       'hidden',
              padding:        personaImage ? '4px' : '6px',
              borderRadius:   '8px',
              flexShrink:     0,
            }}
          >
            <ExchangeOneIcon size={20} color="var(--chip-text)" />
          </span>
        ))}

        {/* ── Inner shadow overlay — active only ── */}
        {isActive && (
          <div
            aria-hidden
            style={{
              position:      'absolute',
              inset:         0,
              pointerEvents: 'none',
              borderRadius:  'inherit',
              boxShadow:     'var(--chip-inner-shadow)',
            }}
          />
        )}

      </div>
    )
  },
)

Chip.displayName = 'Chip'
export default Chip
