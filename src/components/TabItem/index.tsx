'use client'

import React, { useState } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { AnimatePresence, motion } from 'framer-motion'
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
  /**
   * A count shown after the label as a round badge (shadcnspace Tabs 08): dark on the active tab,
   * muted otherwise, and it pops when the number changes. Omit it (or pass undefined) for no badge.
   */
  count?: number | string
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
    count,
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
          // Tabs 08 spacing: 14px each side on medium (12 + the label's 2), 11 on small.
          gap:            isSmall ? '4px' : '6px',
          padding:        isSmall ? '7px 9px' : '7px 12px',
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

        {/* Count badge */}
        {count !== undefined && <TabCount count={count} active={isSelected} small={isSmall} />}
      </Comp>
    )
}

TabItem.displayName = 'TabItem'

// Count badges, sized to the tab's text line so they never change the tab's height: 20px with 12px
// numbers on medium tabs (22px line), 16px with 10px numbers on small tabs (16px line). Medium tabs use
// Tabs 08's colours (dark on the active tab, muted otherwise); small tabs use Tabs 04 - With Count's
// (dark on every tab). Both pop when the number changes and widen into a pill for 2+ digits.
function TabCount({ count, active, small }: { count: number | string; active: boolean; small: boolean }) {
  const size = small ? 16 : 20
  const dark = small || active
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={count}
        initial={{ opacity: 0, scale: 0.5, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.5, y: 6 }}
        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        style={{
          display:            'inline-flex',
          alignItems:         'center',
          justifyContent:     'center',
          flexShrink:         0,
          minWidth:           size,
          height:             size,
          padding:            small ? '0 4px' : '0 5px',
          boxSizing:          'border-box',
          borderRadius:       999,
          fontFamily:         'var(--font-body)',
          fontSize:           small ? 10 : 12,
          fontWeight:         small ? 500 : 600,
          lineHeight:         1,
          fontVariantNumeric: 'tabular-nums',
          backgroundColor:    dark ? 'var(--neutral-900)' : 'var(--neutral-200)',
          color:              dark ? 'var(--neutral-50)' : 'var(--neutral-600)',
          transition:         'background-color 150ms, color 150ms',
        }}
      >
        {count}
      </motion.span>
    </AnimatePresence>
  )
}
