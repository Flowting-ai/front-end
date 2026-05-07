'use client'

import React, { useState } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'

// ── Shadow tokens ──────────────────────────────────────────────────────────────

const SHADOW_ITEM_HOVER = 'var(--shadow-dropdown-item-hover)'
const SHADOW_ITEM_INNER = 'var(--shadow-item-inner)'

// ── Types ─────────────────────────────────────────────────────────────────────

export type DropdownMenuItemVariant = 'default' | 'header'

export interface DropdownMenuItemProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: DropdownMenuItemVariant
  /** Primary label text */
  label?: string
  /**
   * 16×16 icon on the left side of the label.
   * Pass a `@strange-huge/icons` component at `size={16}`.
   * Omit to render the label with no left indent.
   */
  icon?: React.ReactElement
  /**
   * 16×16 icon on the right side — shown only when provided.
   * Useful for trailing indicators: checkmarks, chevrons, badges.
   */
  rightIcon?: React.ReactElement
  /** Persistent selected visual state */
  selected?: boolean
  /**
   * When `true`, renders a 2px animated accent bar on the left edge of the item on hover/selected.
   * Use for long lists (>8 items) or command palettes where the eye needs a strong landing point.
   * @default false
   */
  accent?: boolean
  /** Stretch to full width instead of fixed 217px */
  fluid?: boolean
  /** Render as a child element — allows Radix DropdownMenu.Item composition */
  asChild?: boolean
}

// ── Shared text styles ────────────────────────────────────────────────────────

const bodyTextStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontWeight: 'var(--font-weight-medium)',
  fontSize:   'var(--font-size-body)',
  lineHeight: 'var(--line-height-body)',
  color:      'var(--dropdown-menu-item-text)',
  whiteSpace: 'nowrap',
}

const captionTextStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontWeight: 'var(--font-weight-medium)',
  fontSize:   'var(--font-size-caption)',
  lineHeight: 'var(--line-height-caption)',
  color:      'var(--dropdown-menu-item-muted)',
  whiteSpace: 'nowrap',
}

// ── Component ─────────────────────────────────────────────────────────────────

export const DropdownMenuItem = React.forwardRef<HTMLDivElement, DropdownMenuItemProps>(
  function DropdownMenuItem(
    {
      variant = 'default',
      label = 'Label',
      icon,
      rightIcon,
      selected = false,
      accent = false,
      fluid = false,
      asChild = false,
      className,
      style,
      onMouseEnter: externalMouseEnter,
      onMouseLeave: externalMouseLeave,
      onKeyDown: externalKeyDown,
      onClick,
      ...props
    },
    ref,
  ) {
    const [isHovered, setIsHovered] = useState(false)
    const isHeader = variant === 'header'
    const isActive = !isHeader && (isHovered || selected)

    const Comp = asChild ? Slot : 'div'

    return (
      <Comp
        ref={ref}
        role={isHeader ? undefined : 'menuitem'}
        tabIndex={isHeader ? undefined : 0}
        className={cn(!isHeader && 'kaya-dropdown-item', className)}
        style={{
          position:        'relative',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'space-between',
          overflow:        'hidden',
          borderRadius:    '10px',
          width:           fluid ? '100%' : '217px',
          paddingLeft:     '6px',
          paddingRight:    '6px',
          paddingTop:      isHeader ? '6px'  : '5px',
          paddingBottom:   isHeader ? '12px' : '5px',
          backgroundColor: isActive ? 'var(--dropdown-menu-item-hover-bg)' : 'transparent',
          boxShadow:       isActive ? SHADOW_ITEM_HOVER : undefined,
          cursor:          isHeader ? 'default' : 'pointer',
          transition:      'background-color 150ms, box-shadow 150ms',
          userSelect:      'none',
          ...style,
        }}
        onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => { setIsHovered(true);  externalMouseEnter?.(e) }}
        onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => { setIsHovered(false); externalMouseLeave?.(e) }}
        onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
          if (!isHeader && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>)
          }
          externalKeyDown?.(e)
        }}
        onClick={isHeader ? undefined : onClick}
        {...props}
      >

        {/* ── Default variant ── */}
        {!isHeader && (
          <>
            {/* Accent bar — 2px left edge indicator, scaleY animated */}
            <AnimatePresence initial={false}>
              {isActive && accent && (
                <motion.div
                  key="accent"
                  aria-hidden
                  initial={{ scaleY: 0, opacity: 0 }}
                  animate={{ scaleY: 1, opacity: 1 }}
                  exit={{    scaleY: 0, opacity: 0 }}
                  transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    position:        'absolute',
                    left:            0,
                    top:             '4px',
                    bottom:          '4px',
                    width:           '2px',
                    borderRadius:    '2px',
                    backgroundColor: 'var(--neutral-900)',
                    transformOrigin: 'center',
                    pointerEvents:   'none',
                  }}
                />
              )}
            </AnimatePresence>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              {icon && (
                <div style={{ width: '16px', height: '16px', flexShrink: 0, lineHeight: 0, color: 'var(--dropdown-menu-item-text)' }}>
                  {icon}
                </div>
              )}
              <p style={bodyTextStyle}>{label}</p>
            </div>

            {rightIcon && (
              <div style={{ width: '16px', height: '16px', flexShrink: 0, lineHeight: 0, color: 'var(--dropdown-menu-item-muted)' }}>
                {rightIcon}
              </div>
            )}

            {/* Inner depth shadow — hover + selected */}
            {isActive && (
              <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 'inherit', boxShadow: SHADOW_ITEM_INNER }} />
            )}
          </>
        )}

        {/* ── Header variant ── */}
        {isHeader && (
          <p style={captionTextStyle}>{label}</p>
        )}

      </Comp>
    )
  },
)

DropdownMenuItem.displayName = 'DropdownMenuItem'

export default DropdownMenuItem
