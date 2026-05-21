'use client'

import React, { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { FloatingMenuContext } from '@/components/FloatingMenuItem'

// ── Shadow tokens ─────────────────────────────────────────────────────────────

const SHADOW_OUTER = 'var(--shadow-floating-menu-outer)'
const SHADOW_INNER = 'var(--shadow-floating-menu-inner)'

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
    ...props
  }: FloatingMenuProps & { ref?: React.Ref<HTMLDivElement> },
) {
    const [autoExpanded, setAutoExpanded] = useState(false)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
          {...props}
        >

          {/* ── White background - clips to rounded corners via parent overflow: hidden ── */}
          <div
            aria-hidden
            style={{
              position:        'absolute',
              inset:           0,
              backgroundColor: 'var(--neutral-white)',
              pointerEvents:   'none',
            }}
          />

          {/* ── Items - rendered above the white background ── */}
          <div
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
