'use client'

import React, { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { FloatingMenuContext } from '@/components/FloatingMenuItem'

// ── Shadow tokens ─────────────────────────────────────────────────────────────

const SHADOW_OUTER = 'var(--shadow-floating-menu-outer)'
const SHADOW_INNER = 'var(--shadow-floating-menu-inner)'

// ── Roving focus ──────────────────────────────────────────────────────────────
// WAI-ARIA toolbar pattern: one tab stop for the whole toolbar; Arrow keys move
// between items (vertical menu, but Left/Right also work), Home/End jump.

const ITEM_SELECTOR = 'button:not([disabled]), a[href], [role="button"]:not([aria-disabled="true"]), [role="menuitem"]:not([aria-disabled="true"])'

function getItems(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(ITEM_SELECTOR))
}

function syncTabStops(root: HTMLElement, active: HTMLElement | null) {
  const items = getItems(root)
  if (items.length === 0) return
  const current = active && items.includes(active) ? active : items.find((el) => el.tabIndex === 0) ?? items[0]
  for (const el of items) el.tabIndex = el === current ? 0 : -1
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FloatingMenuProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * When `true`, all child `FloatingMenuItem`s show their labels beside the icon.
   * When `false` (default), only icons are shown.
   * The menu also auto-expands after 1 s of hover, or immediately on keyboard focus.
   */
  opened?: boolean
  /**
   * Accessible name for the toolbar - required for screen readers.
   * Describe the set of actions, e.g. "Chat actions" or "Document tools".
   */
  'aria-label'?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FloatingMenu(
  {
    ref,
    opened = false,
    children,
    className,
    style,
    onMouseEnter: externalMouseEnter,
    onMouseLeave: externalMouseLeave,
    onFocus:      externalFocus,
    onBlur:       externalBlur,
    onKeyDown:    externalKeyDown,
    ...props
  }: FloatingMenuProps & { ref?: React.Ref<HTMLDivElement> },
) {
    const [autoExpanded, setAutoExpanded] = useState(false)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const itemsRef = useRef<HTMLDivElement | null>(null)

    // Keep exactly one item in the tab order (re-synced when children change).
    useEffect(() => {
      const root = itemsRef.current
      if (!root) return
      syncTabStops(root, null)
      const mo = new MutationObserver(() => syncTabStops(root, null))
      mo.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'aria-disabled'] })
      return () => mo.disconnect()
    }, [])

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      externalKeyDown?.(e)
      if (e.defaultPrevented) return
      const root = itemsRef.current
      if (!root) return
      const items = getItems(root)
      if (items.length === 0) return
      const idx = items.indexOf(document.activeElement as HTMLElement)
      let next = -1
      switch (e.key) {
        case 'ArrowDown':
        case 'ArrowRight': next = idx < 0 ? 0 : (idx + 1) % items.length; break
        case 'ArrowUp':
        case 'ArrowLeft':  next = idx < 0 ? items.length - 1 : (idx - 1 + items.length) % items.length; break
        case 'Home':       next = 0; break
        case 'End':        next = items.length - 1; break
        default: return
      }
      e.preventDefault()
      syncTabStops(root, items[next])
      items[next].focus()
    }

    // Effective expanded state - explicit prop OR hover/focus-triggered auto-expand.
    const expanded = opened || autoExpanded

    // Clean up any pending timer on unmount.
    useEffect(() => {
      return () => {
        if (timerRef.current !== null) clearTimeout(timerRef.current)
      }
    }, [])

    const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
      if (timerRef.current === null) {
        timerRef.current = setTimeout(() => setAutoExpanded(true), 2000)
      }
      externalMouseEnter?.(e)
    }

    const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      setAutoExpanded(false)
      externalMouseLeave?.(e)
    }

    // Keyboard users: expand immediately when any item receives focus.
    const handleMenuFocus = (e: React.FocusEvent<HTMLDivElement>) => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      setAutoExpanded(true)
      // Remember the focused item as the toolbar's tab stop (covers mouse/programmatic focus).
      if (itemsRef.current && e.target instanceof HTMLElement && itemsRef.current.contains(e.target)) {
        syncTabStops(itemsRef.current, e.target)
      }
      externalFocus?.(e)
    }

    // Collapse when focus leaves the menu entirely (not just moving between items).
    const handleMenuBlur = (e: React.FocusEvent<HTMLDivElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
        setAutoExpanded(false)
      }
      externalBlur?.(e)
    }

    return (
      <FloatingMenuContext.Provider value={{ opened: expanded }}>
        <div
          ref={ref}
          role="toolbar"
          aria-orientation="vertical"
          className={cn(className)}
          style={{
            position:      'relative',
            display:       'inline-flex',
            flexDirection: 'column',
            gap:           '4px',
            paddingTop:    '4px',
            paddingRight:  '4px',
            paddingBottom: '6px',
            paddingLeft:   '4px',
            borderRadius:  '12px',
            overflow:      'clip',
            boxShadow:     SHADOW_OUTER,
            ...style,
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onFocus={handleMenuFocus}
          onBlur={handleMenuBlur}
          onKeyDown={handleKeyDown}
          {...props}
        >

          {/* ── White background - clips to rounded corners via parent overflow: hidden ── */}
          <div
            aria-hidden
            style={{
              position:        'absolute',
              inset:           0,
              backgroundColor: 'var(--popover-bg)',
              pointerEvents:   'none',
            }}
          />

          {/* ── Items - rendered above the white background ── */}
          <div
            ref={itemsRef}
            style={{
              position:      'relative',
              display:       'flex',
              flexDirection: 'column',
              gap:           '4px',
            }}
          >
            {children}
          </div>

          {/* ── Inner shadow overlay - renders above all content ── */}
          <div
            aria-hidden
            style={{
              position:      'absolute',
              inset:         0,
              borderRadius:  'inherit',
              boxShadow:     SHADOW_INNER,
              pointerEvents: 'none',
            }}
          />

        </div>
      </FloatingMenuContext.Provider>
    )
}

FloatingMenu.displayName = 'FloatingMenu'
export default FloatingMenu
