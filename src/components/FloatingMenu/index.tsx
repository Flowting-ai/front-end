'use client'

import React, { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { FloatingMenuContext } from '@/components/FloatingMenuItem'

// ── Shadow tokens ─────────────────────────────────────────────────────────────

const SHADOW_OUTER = 'var(--shadow-floating-menu-outer)'
const SHADOW_INNER = 'var(--shadow-floating-menu-inner)'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FloatingMenuProps extends React.HTMLAttributes<HTMLDivElement> {
  opened?: boolean
  'aria-label'?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export const FloatingMenu = React.forwardRef<HTMLDivElement, FloatingMenuProps>(
  function FloatingMenu(
    {
      opened = false,
      children,
      className,
      style,
      onMouseEnter: externalMouseEnter,
      onMouseLeave: externalMouseLeave,
      onFocus:      externalFocus,
      onBlur:       externalBlur,
      ...props
    },
    ref,
  ) {
    const [autoExpanded, setAutoExpanded] = useState(false)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const expanded = opened || autoExpanded

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

    const handleFocus = (e: React.FocusEvent<HTMLDivElement>) => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      setAutoExpanded(true)
      externalFocus?.(e)
    }

    const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
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
            gap:           '2px',
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
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        >
          {/* ── White background — clips to rounded corners ── */}
          <div
            aria-hidden
            style={{
              position:        'absolute',
              inset:           0,
              backgroundColor: 'var(--neutral-white)',
              pointerEvents:   'none',
            }}
          />

          {/* ── Items ── */}
          <div
            style={{
              position:      'relative',
              display:       'flex',
              flexDirection: 'column',
              gap:           '2px',
            }}
          >
            {children}
          </div>

          {/* ── Inner shadow overlay ── */}
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
  },
)

FloatingMenu.displayName = 'FloatingMenu'
export default FloatingMenu
