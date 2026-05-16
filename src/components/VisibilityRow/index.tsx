'use client'

import React, { useState } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { ArrowUpRightOneIcon } from '@strange-huge/icons'
import { cn } from '@/lib/utils'

// ── Shadows ───────────────────────────────────────────────────────────────────

// All states use box-shadow rings only (no CSS border) so layout never shifts
// on selection. The selected ring is included in SHADOW_SELECTED.
const SHADOW_SELECTED   = '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-800)'
const SHADOW_DESELECTED = '0px 0px 0px 1px var(--neutral-white)'
const SHADOW_LOCKED     = '0px 0px 0px 1px var(--neutral-200)'
const SHADOW_CHIP_OUTER = '0px 1px 1.5px 0px rgba(2,15,24,0.2), 0px 0px 0px 1px rgba(13,110,178,0.5)'
const SHADOW_CHIP_INNER = 'inset 0px 1px 0px 0px rgba(231,244,253,0.7), inset 0px -1px 0px 0px rgba(13,110,178,0.1)'

// ── Upgrade chip ──────────────────────────────────────────────────────────────

function UpgradeChip({
  label,
  onClick,
}: {
  label: string
  onClick?: React.MouseEventHandler
}) {
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick, 'aria-label': `Upgrade to ${label}` } : {})}
      style={{
        position:       'relative',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        2,
        borderRadius:   6,
        flexShrink:     0,
        cursor:         onClick ? 'pointer' : 'default',
        boxShadow:      SHADOW_CHIP_OUTER,
        overflow:       'hidden',
        // reset button defaults
        border:         'none',
        background:     'none',
        font:           'inherit',
      }}
    >
      {/* Blue background */}
      <div
        aria-hidden
        style={{
          position:        'absolute',
          inset:           0,
          borderRadius:    6,
          backgroundColor: 'var(--blue-100)',
          pointerEvents:   'none',
        }}
      />

      {/* Label */}
      <div
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          paddingLeft:    2,
          paddingRight:   2,
          position:       'relative',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-caption)',
            fontWeight: 500,
            lineHeight: 'var(--line-height-caption)',
            color:      'var(--blue-700)',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
      </div>

      {/* Arrow icon */}
      <div
        aria-hidden
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          overflow:       'hidden',
          padding:        1,
          borderRadius:   4,
          flexShrink:     0,
          width:          14,
          height:         14,
          position:       'relative',
          lineHeight:     0,
        }}
      >
        <ArrowUpRightOneIcon size={8} color="var(--blue-700)" />
      </div>

      {/* Inner glow overlay */}
      <div
        aria-hidden
        style={{
          position:      'absolute',
          inset:         0,
          borderRadius:  'inherit',
          pointerEvents: 'none',
          boxShadow:     SHADOW_CHIP_INNER,
        }}
      />
    </Tag>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VisibilityRowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Option label — e.g. "Private", "Team", "Community" */
  label?: string
  /** Subtitle description below the label */
  description?: string
  /** Whether this option is currently selected */
  selected?: boolean
  /**
   * Dims the row and shows an upgrade badge — option requires a higher plan.
   * A locked row cannot be selected.
   */
  locked?: boolean
  /** Text inside the upgrade badge. Defaults to "Team plan". */
  lockedBadgeLabel?: string
  /** Fires when the upgrade badge is clicked. */
  onUpgrade?: () => void
  /** Disables all interaction. */
  disabled?: boolean
  asChild?: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export const VisibilityRow = React.forwardRef<HTMLDivElement, VisibilityRowProps>(
  function VisibilityRow(
    {
      label             = '',
      description       = '',
      selected          = false,
      locked            = false,
      lockedBadgeLabel  = 'Team plan',
      onUpgrade,
      disabled          = false,
      asChild           = false,
      className,
      style,
      onClick,
      onKeyDown,
      ...props
    },
    ref,
  ) {
    const Comp = (asChild ? Slot : 'div') as React.ElementType
    const [focused, setFocused] = useState(false)

    const interactive = !locked && !disabled

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (interactive && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>)
      }
      onKeyDown?.(e)
    }

    const labelColor = locked ? 'var(--neutral-400)' : 'var(--neutral-800)'
    const descColor  = locked ? 'var(--neutral-500)' : 'var(--neutral-600)'

    const boxShadow = selected
      ? SHADOW_SELECTED
      : locked
        ? SHADOW_LOCKED
        : SHADOW_DESELECTED

    return (
      <Comp
        ref={ref}
        role="radio"
        aria-checked={selected}
        aria-disabled={locked || disabled || undefined}
        tabIndex={interactive ? 0 : -1}
        className={cn(className)}
        onClick={interactive ? onClick : undefined}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          position:        'relative',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          overflow:        'hidden',
          padding:         '14px 16px',
          borderRadius:    12,
          width:           '100%',
          boxSizing:       'border-box' as const,
          backgroundColor: selected || locked ? 'var(--neutral-50)' : 'var(--neutral-white)',
          boxShadow:       focused && interactive
            ? `0px 0px 0px 2px var(--blue-400), ${boxShadow}`
            : boxShadow,
          cursor:          locked ? 'default' : interactive ? 'pointer' : undefined,
          opacity:         disabled ? 0.5 : 1,
          pointerEvents:   disabled ? 'none' : undefined,
          outline:         'none',
          ...style,
        }}
        {...props}
      >
        {/* Text column */}
        <div
          style={{
            display:        'flex',
            flex:           '1 0 0',
            flexDirection:  'column',
            alignItems:     'flex-start',
            justifyContent: 'center',
            minWidth:       0,
            gap:            2,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize:   'var(--font-size-body-lg)',
              fontWeight: 500,
              lineHeight: 'var(--line-height-body-lg)',
              color:      labelColor,
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </span>
          {description && (
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize:   'var(--font-size-caption)',
                fontWeight: 500,
                lineHeight: 'var(--line-height-caption)',
                color:      descColor,
              }}
            >
              {description}
            </span>
          )}
        </div>

        {/* Locked upgrade chip */}
        {locked && (
          <UpgradeChip
            label={lockedBadgeLabel}
            onClick={onUpgrade ? (e) => { e.stopPropagation(); onUpgrade() } : undefined}
          />
        )}
      </Comp>
    )
  },
)

VisibilityRow.displayName = 'VisibilityRow'
export default VisibilityRow
