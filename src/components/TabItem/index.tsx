'use client'

import React, { useState } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TabItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Whether this tab is currently selected */
  selected?: boolean
  /** Size variant - medium (default) or small */
  size?: 'medium' | 'small'
  /** Optional icon - rendered at 16×16 to the left of the label */
  icon?: React.ReactNode
  /** Render as child element via Radix Slot */
  asChild?: boolean
  /**
   * When true, suppresses the background/shadow selected treatment.
   * Use when a parent (e.g. TabsList) renders the selected pill itself.
   */
  disableSelectedStyle?: boolean
  /** Injected by Radix Tabs - 'active' when this tab is selected */
  'data-state'?: string
  /** When true, the item grows to fill its flex parent equally (fluid TabsList) */
  fluid?: boolean
  /**
   * Collapse mode (icon-rail tab strip): the label is hidden unless this item
   * is selected, so only the active tab shows icon + label and the rest are
   * icon-only. Driven by `collapse` on TabsList via context. The label fades in
   * on activation; the label is always in the DOM (measurable + accessible).
   */
  collapse?: boolean
  /**
   * Collapse mode only — the reserved width (px) for the active label slot,
   * measured by TabsList as the widest label across all tabs. Pinning the active
   * slot to this constant keeps the active tab (and the whole strip) a fixed
   * width regardless of which tab is selected, so the strip footprint never
   * shifts on switch. `null` falls back to the label's natural width.
   */
  reservedLabelWidth?: number | null
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TabItem(
  {
    ref,
    selected = false,
    size = 'medium',
    icon,
    children,
    disabled,
    asChild = false,
    disableSelectedStyle = false,
    fluid = false,
    collapse = false,
    reservedLabelWidth = null,
    className,
    'data-state': dataState,
    ...props
  }: TabItemProps & { ref?: React.Ref<HTMLButtonElement> },
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
          justifyContent: fluid ? 'center' : undefined,
          flex:           fluid ? '1 0 0' : undefined,
          gap:            isSmall ? '2px' : '4px',
          padding:        isSmall ? '7px' : '7px 8px',
          borderRadius:   isSmall ? '8px' : '10px',
          // ── Background / shadow - suppressed when parent handles the pill ──
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
        {children != null && children !== '' && (
          collapse ? (
            // Collapse mode: the label is ALWAYS in the DOM (measurable by TabsList +
            // accessible to AT). Selected → a reserved-width slot (widest label across
            // tabs) so the active tab is a constant width and the strip never reflows;
            // non-selected → width 0 (icon-only). Fade is opacity-only.
            <span
              data-tab-collapse-label
              style={{
                display:        'inline-flex',
                justifyContent: 'center',
                overflow:       'hidden',
                flexShrink:     0,
                width:          isSelected ? (reservedLabelWidth ?? 'auto') : 0,
                opacity:        isSelected ? 1 : 0,
                transition:     'opacity 200ms ease',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 'var(--font-weight-medium)',
                  fontSize:   isSmall ? 'var(--font-size-caption)' : 'var(--font-size-body)',
                  lineHeight: isSmall ? 'var(--line-height-caption)' : 'var(--line-height-body)',
                  color:      textColor,
                  whiteSpace: 'nowrap',
                  padding:    '0 2px',
                  // Slides in with the pill; clipped by the slot when inactive.
                  transform:  isSelected ? 'translateX(0)' : 'translateX(-4px)',
                  transition: 'color 150ms, transform 200ms ease',
                }}
              >
                {children}
              </span>
            </span>
          ) : (
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
          )
        )}
      </Comp>
    )
}

TabItem.displayName = 'TabItem'
export default TabItem
