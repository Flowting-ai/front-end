'use client'

import React, { useState } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TabItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Whether this tab is currently selected */
  selected?: boolean
  /** Size variant — medium (default) or small */
  size?: 'medium' | 'small'
  /** Optional icon — rendered at 16×16 to the left of the label */
  icon?: React.ReactNode
  /** Render as child element via Radix Slot */
  asChild?: boolean
  /**
   * When true, suppresses the background/shadow selected treatment.
   * Use when a parent (e.g. TabsList) renders the selected pill itself.
   */
  disableSelectedStyle?: boolean
  /** Radix Tabs sets this to "active" on the selected tab */
  'data-state'?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export const TabItem = React.forwardRef<HTMLButtonElement, TabItemProps>(
  function TabItem(
    {
      selected = false,
      size = 'medium',
      icon,
      children,
      disabled,
      asChild = false,
      disableSelectedStyle = false,
      className,
      'data-state': dataState,
      ...props
    },
    ref,
  ) {
    const [hovered, setHovered] = useState(false)
    const Comp = asChild ? Slot : 'button'

    // Support both `selected` prop (standalone) and Radix's `data-state="active"` (Tabs integration)
    const isSelected  = (selected || dataState === 'active') && !disabled
    const isHovered   = hovered && !disabled && !isSelected
    const isDisabled  = disabled
    const isSmall     = size === 'small'

    // ── Text color ─────────────────────────────────────────────────────────────
    const textColor = isDisabled  ? 'var(--tab-item-text-disabled)'
                    : isSelected  ? 'var(--tab-item-text-selected)'
                    : isHovered   ? 'var(--tab-item-text-hover)'
                    :               'var(--tab-item-text-default)'

    return (
      <Comp
        ref={ref}
        disabled={disabled}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        // Only set aria-pressed in standalone mode; Radix sets aria-selected in Tabs context
        {...(dataState === undefined && { 'aria-pressed': selected })}
        data-state={dataState}
        className={cn('kds-tab-item', className)}
        style={{
          // ── Layout ──────────────────────────────────────────────────────────
          display:        'inline-flex',
          alignItems:     'center',
          gap:            isSmall ? '2px' : '4px',
          padding:        isSmall ? '7px' : '7px 8px',
          borderRadius:   isSmall ? '8px' : '10px',
          // ── Background / shadow — suppressed when parent handles the pill ──
          backgroundColor: !disableSelectedStyle && isSelected ? 'var(--tab-item-bg-selected)' : 'transparent',
          boxShadow:       !disableSelectedStyle && isSelected ? 'var(--shadow-tab-item-selected)' : 'none',
          // ── Reset button defaults ────────────────────────────────────────────
          border:         'none',
          cursor:         isDisabled ? 'not-allowed' : 'pointer',
          position:       'relative',
          transition:     'background-color 150ms, box-shadow 150ms',
        }}
        {...props}
      >
        {/* Inner bottom shadow overlay (selected only, standalone mode) */}
        {!disableSelectedStyle && isSelected && (
          <div
            aria-hidden
            style={{
              position:      'absolute',
              inset:         0,
              borderRadius:  'inherit',
              boxShadow:     'var(--shadow-tab-item-selected-inner)',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Icon slot */}
        {icon && (
          <span
            aria-hidden
            style={{
              display:    'inline-flex',
              flexShrink: 0,
              lineHeight: 0,
              color:      textColor,
              transition: 'color 150ms',
            }}
          >
            {icon}
          </span>
        )}

        {/* Label */}
        <span
          style={{
            position:   'relative',
            fontFamily: 'var(--font-body)',
            fontWeight: 'var(--font-weight-medium)',
            fontSize:   isSmall ? 'var(--font-size-caption)' : 'var(--font-size-body)',
            lineHeight: isSmall ? 'var(--line-height-caption)' : 'var(--line-height-body)',
            color:      textColor,
            whiteSpace: 'nowrap',
            flexShrink: 0,
            padding:    '0 2px',
            transition: 'color 150ms',
          }}
        >
          {children}
        </span>
      </Comp>
    )
  },
)

TabItem.displayName = 'TabItem'
export default TabItem
