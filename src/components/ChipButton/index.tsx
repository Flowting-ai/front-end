'use client'

import React from 'react'
import { m } from 'framer-motion'

// ── ChipButton ────────────────────────────────────────────────────────────────
// Atom. The interactive action button used inside Chip (cancel / change / expand).
//
// Hover styles live in semantic.css (.kds-chip-button) - CSS :hover is used
// because React's synthetic onMouseEnter doesn't fire on elements that mount
// under an already-hovering cursor (which happens every time Chip transitions
// to its active state).
//
// Color comes from the parent Chip via CSS custom-property cascade:
//   --chip-text                 → icon + ring color
//   --chip-button-inner-shadow  → inset depth/highlight shadow
// - no per-ChipButton color prop is needed.

export interface ChipButtonProps {
  icon: React.ReactNode
  'aria-label': string
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  /**
   * When true, wraps the icon in a 180° rotation that fires on hover of this
   * button (not the parent chip). Snap-back to 0° on hover-out is instant.
   */
  spinOnHover?: boolean
  /**
   * `'28px'` - standard (default), 28×28 box: padding 4px, radius 8px, 20×20 icon
   * `'16px'` - compact for Small chips, 16×16 box: padding 1px, radius 4px, 14×14 icon
   *
   * Variant names reflect the rendered container size (Figma 908:454).
   */
  size?: '28px' | '16px'
  /**
   * Disabled state - sets the native `disabled` attribute, suppresses pointer
   * events, drops the whileTap scale animation, and switches the cursor to
   * `not-allowed`. Visual dimming (opacity 0.7) lives on the parent `Chip`'s
   * `disabled` state, not here - the button is always rendered at full
   * opacity inside the dimmed chip so its silhouette stays legible.
   */
  disabled?: boolean
}

export function ChipButton({
  icon,
  'aria-label': ariaLabel,
  onClick,
  spinOnHover = false,
  size = '28px',
  disabled = false,
}: ChipButtonProps) {
  const isSmall = size === '16px'
  return (
    <m.button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.9 }}
      transition={{ duration: 0.1, ease: 'easeOut' }}
      className="kds-chip-button"
      style={{
        position:       'relative',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        isSmall ? '1px' : '4px',
        borderRadius:   isSmall ? '4px' : '8px',
        // Small variant has an explicit 16×16 box (Figma 908:454). The 28px
        // variant sizes to its 20×20 icon + 4px padding.
        ...(isSmall && { width: 16, height: 16 }),
        flexShrink:     0,
        border:         'none',
        cursor:         disabled ? 'not-allowed' : 'pointer',
        color:          'var(--chip-text)',
      }}
    >
      {spinOnHover
        ? <span className="kds-chip-button-spin" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</span>
        : icon
      }
      <div
        aria-hidden
        className="kds-chip-button-shadow"
        style={{
          position:      'absolute',
          inset:         0,
          pointerEvents: 'none',
          borderRadius:  'inherit',
          boxShadow:     'var(--chip-button-inner-shadow)',
        }}
      />
    </m.button>
  )
}

ChipButton.displayName = 'ChipButton'

export default ChipButton
