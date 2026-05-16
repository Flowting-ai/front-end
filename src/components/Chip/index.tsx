'use client'

import React, { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { LogoIcon, CancelOneIcon, ExchangeOneIcon, ArrowDownOneIcon } from '@strange-huge/icons'
import { cn } from '@/lib/utils'
import { ChipButton } from '@/components/ChipButton'

// Re-export for back-compat - original public path was `@/components/Chip`.
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
   * Custom left icon - Medium only.
   * Shown at rest when no `personaImage` is provided. Defaults to `<LogoIcon />`.
   * Ignored for Small chips (always renders `CancelOneIcon`).
   */
  icon?: React.ReactNode
  /**
   * Avatar image URL - Medium only.
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
   * Called when the ↺ (change) button is clicked on hover - Medium only.
   * If omitted, the right slot is not rendered.
   * Ignored for Small chips.
   */
  onChange?: React.MouseEventHandler<HTMLButtonElement>
  /**
   * Called when the right ChipButton (chevron-down) is clicked.
   *  - **Small chips** - chevron renders only when `onExpand` is provided.
   *  - **Medium chips** - when `onExpand` is provided, an always-visible
   *    chevron-down `ChipButton` renders in the right slot signalling
   *    "click to open picker". Used by `ChatInput`'s persona / style auto-
   *    chips. Mutually exclusive with `onChange` (the spinning ↺ change
   *    button); pass one or the other, not both.
   */
  onExpand?: React.MouseEventHandler<HTMLButtonElement>
  /**
   * Override the icon shown in the left ChipButton - **Small only.**
   * Defaults to `<CancelOneIcon size={14} />`. Render at 14×14 with
   * `color="var(--chip-text)"` so it follows the chip's color variant.
   */
  leftIcon?: React.ReactNode
  /**
   * Override the icon shown in the right ChipButton - **Small only.**
   * Defaults to `<ArrowDownOneIcon size={14} />` (chevron-down). Only renders
   * when `onExpand` is provided. Render at 14×14 with `color="var(--chip-text)"`.
   */
  rightIcon?: React.ReactNode
  /** Aria-label for the left ChipButton - **Small only.** Defaults to `"Remove"`. */
  leftLabel?: string
  /** Aria-label for the right ChipButton - **Small only.** Defaults to `"Open menu"`. */
  rightLabel?: string
  /**
   * Color variant - **Small chips only.**
   * Sets background, text color, ring shadow, and inner shadow from `COLOR_CONFIG`.
   * Medium chips are always Blue (controlled by `--chip-*` tokens in semantic.css).
   * Defaults to `'Blue'`.
   */
  color?: ChipColor
  /**
   * `'Medium'` - full-size animated chip; hover swaps left icon → × remove button (default)
   * `'Small'` - compact colored tag; always shows × as a `ChipButton`; no hover animation
   */
  size?: 'Medium' | 'Small'
  /**
   * Disabled state - applies opacity 0.7 to the chip, switches the cursor
   * to `not-allowed`, suppresses pointer events on the inner ChipButtons,
   * and freezes the Medium variant's hover-driven icon swap (chip stays at
   * its rest visual). Use to communicate "this chip can't be acted on
   * right now" - e.g. an Add-tag chip when the per-pin tag cap is reached.
   */
  disabled?: boolean
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
      disabled  = false,
      className,
      style: styleOverride,
      onMouseEnter: externalMouseEnter,
      onMouseLeave: externalMouseLeave,
      ...props
    },
    ref,
  ) {
    const cfg          = COLOR_CONFIG[color]
    const [isActive, setIsActive] = useState(false)
    // Disabled freezes the Medium chip's hover-driven icon swap at rest,
    // ignores all click handlers (onRemove / onChange / onExpand), and
    // blocks the inner ChipButtons. Visual dimming (0.7 opacity) +
    // `cursor: not-allowed` are applied on the outer wrapper below.
    const handleRemove = disabled ? undefined : onRemove
    const handleChange = disabled ? undefined : onChange
    const handleExpand = disabled ? undefined : onExpand
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
          aria-disabled={disabled || undefined}
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
            // backgroundColor goes on the element itself - avoids z-index stacking
            // issue where an absolute overlay div would render above inline children
            backgroundColor: cfg.bg,
            boxShadow:       cfg.shadow,
            opacity:         disabled ? 0.7 : 1,
            cursor:          disabled ? 'not-allowed' : undefined,
            // Consumer overrides last so a `style` prop can tweak cursor /
            // margin / etc. without obliterating the chip's display / padding
            // / background / shadow contract. Pre-fix, `{...props}` came
            // after `style={…}` and a single `style={{ cursor: 'pointer' }}`
            // from the consumer wiped every inline style, leaving the chip
            // unstyled (no pill, vertical-stacked children).
            ...styleOverride,
          } as React.CSSProperties}
          {...props}
        >
          {/* Left ChipButton - rendered when `onRemove` or a custom
              `leftIcon` is provided. Omitting both yields a label-only Small
              chip (used for the "Clear all" filter affordance and any other
              static-pill case where the entire chip body is the click
              target). The right ChipButton already follows this rule via
              `onExpand`. */}
          {(onRemove !== undefined || leftIcon !== undefined) && (
            <ChipButton
              size="16px"
              icon={leftIcon ?? <CancelOneIcon size={14} color={cfg.text} />}
              aria-label={leftLabel}
              onClick={(e) => { e.stopPropagation(); handleRemove?.(e) }}
              disabled={disabled}
            />
          )}

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

          {/* Right ChipButton - rendered when `onExpand` is provided; icon is
              swappable via `rightIcon` (defaults to chevron-down per Figma 1023:597). */}
          {onExpand && (
            <ChipButton
              size="16px"
              icon={rightIcon ?? <ArrowDownOneIcon size={14} color={cfg.text} />}
              aria-label={rightLabel}
              onClick={handleExpand}
              disabled={disabled}
            />
          )}

          {/* Inner depth/highlight shadow - rendered last so it sits above content */}
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
    // `disabled` freezes the hover-driven icon swap at rest (`effectiveActive`
    // forced false) and ignores focus, so neither hover nor Tab can flip the
    // chip into its remove state. The wrapper dims to opacity 0.7 and the
    // cursor switches to `not-allowed`.
    const effectiveActive = disabled ? false : isActive
    return (
      <div
        ref={ref}
        role="group"
        aria-label={label}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : 0}
        className={cn('kds-chip', className)}
        onMouseEnter={(e) => { if (!disabled) setIsActive(true); externalMouseEnter?.(e) }}
        onMouseLeave={(e) => { if (!disabled) setIsActive(false); externalMouseLeave?.(e) }}
        onFocus={() => { if (!disabled) setIsActive(true) }}
        onBlur={(e) => {
          if (!disabled && !e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsActive(false)
          }
        }}
        style={{
          position:        'relative',
          display:         'inline-flex',
          alignItems:      'center',
          borderRadius:    '10px',
          // Outer padding stays constant at 4 px so hovering NEVER changes the
          // chip's outer footprint - surrounding chips don't reflow, and the
          // hover state is communicated purely by the inner icon swap.
          // Pre-fix the chip toggled outer padding 2 → 4 on hover and the
          // left slot toggled 32 → 28; the two transitions ran on different
          // timings (CSS vs framer popLayout) which produced a visible
          // shrink/flicker every hover.
          padding:         '4px',
          gap:             '2px',
          // Card-like surface is **always visible** in the Medium variant -
          // structural change in Figma 925:830. Pre-revision the bg / shadow
          // only painted on hover/active; the chip now reads as a solid
          // affordance at rest with the bg/shadow lifting it off the canvas.
          backgroundColor: 'var(--chip-bg)',
          boxShadow:       'var(--chip-shadow)',
          color:           'var(--chip-text)',
          cursor:          disabled ? 'not-allowed' : 'pointer',
          opacity:         disabled ? 0.7 : 1,
          // Consumer overrides last - see Small-variant note above.
          ...styleOverride,
        } as React.CSSProperties}
        {...props}
      >

        {/* ── Left slot - fixed 28×28 wrapper, content swaps via in-place pattern ── */}
        {/* The wrapper's geometry is locked across rest/hover so the chip's
            outer footprint never changes during the swap. Total chip height
            is 4 (outer) + 28 (wrapper) + 4 (outer) = **36 px**, matching
            both Figma 925:830 ("36 Hug") and the surrounding footer
            controls (IconButton size="md" = 8+20+8 = 36 px) so adding /
            removing chips never reflows the chat-input row.

            Inner content centres at all states:
              • Rest icon (20×20)        → 4 px ring
              • Persona image (24×24)    → 2 px ring
              • Active ChipButton (28×28) → flush
            Visual continuity through the swap comes from the in-place
            scale+opacity+blur pattern, not a layout tween. */}
        <span
          style={{
            display:        'inline-flex',
            alignItems:     'center',
            justifyContent: 'center',
            width:          28,
            height:         28,
            flexShrink:     0,
            borderRadius:   8,
          }}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {effectiveActive ? (
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
                  // Stop bubbling so a chip wrapped in a `Dropdown.Float`
                  // (e.g. the auto-chips ChatInput renders for active state)
                  // doesn't toggle the picker open when the user is just
                  // dismissing the chip via ×.
                  onClick={(e) => { e.stopPropagation(); handleRemove?.(e) }}
                  disabled={disabled}
                />
              </motion.span>
            ) : (
              <motion.span
                key="left-icon"
                initial={initial}
                animate={SWAP_ANIMATE}
                exit={exit}
                transition={SPRING}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {personaImage
                  ? <img src={personaImage} alt="" style={{ width: 24, height: 24, borderRadius: '6px', display: 'block' }} />
                  : (icon ?? <LogoIcon size={20} color="var(--chip-text)" />)
                }
              </motion.span>
            )}
          </AnimatePresence>
        </span>

        {/* ── Label ── label padding is constant `0 2px` so the text never
            shifts horizontally between rest/hover. ── */}
        <div style={{ paddingLeft: '2px', paddingRight: '2px', flexShrink: 0 }}>
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

        {/* ── Right slot - fixed 28×28 wrapper. Two modes (mutually exclusive):
              • `onChange` → existing "spinning swap" pattern: at rest a
                decorative ExchangeOneIcon, on hover an active ChipButton
                with spinOnHover.
              • `onExpand` → always-visible ArrowDownOneIcon ChipButton
                (chevron-down) signalling "click to open picker". Used by
                ChatInput's persona / style auto-chips (Figma persona-chip
                frame). Click fires `onExpand`; the parent typically wraps
                the chip in a `Dropdown.Float` so body click ALSO opens
                the picker. ── */}
        {onExpand ? (
          <span
            style={{
              display:        'inline-flex',
              alignItems:     'center',
              justifyContent: 'center',
              width:          28,
              height:         28,
              flexShrink:     0,
              borderRadius:   8,
            }}
          >
            <ChipButton
              icon={<ArrowDownOneIcon size={20} color="var(--chip-text)" />}
              aria-label="Open picker"
              // Stop bubbling: when the chip is wrapped in `Dropdown.Float`
              // (the auto-chip pattern in ChatInput), the wrapping span
              // toggles the picker on click. The chevron's own onExpand
              // already toggles it - letting the click bubble would re-toggle
              // the picker closed/open and feel laggy.
              onClick={(e) => { e.stopPropagation(); handleExpand?.(e) }}
              disabled={disabled}
            />
          </span>
        ) : onChange && (
          <span
            style={{
              display:        'inline-flex',
              alignItems:     'center',
              justifyContent: 'center',
              width:          28,
              height:         28,
              flexShrink:     0,
              borderRadius:   8,
            }}
          >
            {effectiveActive ? (
              <ChipButton
                icon={<ExchangeOneIcon size={20} color="var(--chip-text)" />}
                aria-label="Change"
                spinOnHover
                onClick={handleChange}
                disabled={disabled}
              />
            ) : (
              <span aria-hidden style={{ display: 'flex' }}>
                <ExchangeOneIcon size={20} color="var(--chip-text)" />
              </span>
            )}
          </span>
        )}

        {/* ── Inner emboss - always visible per Figma 925:830 (was active-only
            in the previous Medium chip; the new design carries the bottom
            emboss at rest as well). ── */}
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

      </div>
    )
  },
)

Chip.displayName = 'Chip'
export default Chip
