'use client'

import React, { createContext, use, useLayoutEffect, useRef, useState } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { m, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/Tooltip'

// ── FloatingMenu context ──────────────────────────────────────────────────────
// Provided by FloatingMenu; FloatingMenuItem reads `opened` from it so
// label visibility doesn't need to be wired to every item manually.

export interface FloatingMenuContextValue {
  opened: boolean
}

export const FloatingMenuContext = createContext<FloatingMenuContextValue>({ opened: false })
export const useFloatingMenuContext = () => use(FloatingMenuContext)

// ── Shadow tokens ─────────────────────────────────────────────────────────────

const SHADOW_OUTER = 'var(--shadow-floating-menu-item-outer)'
const SHADOW_INNER = 'var(--shadow-floating-menu-item-inner)'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FloatingMenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * 20×20 icon. Pass a `@strange-huge/icons` component at `size={20}`.
   */
  icon?: React.ReactNode
  /** Label shown beside the icon when expanded. */
  label?: string
  /**
   * Show the label inline.
   * When omitted, inherits from the parent `FloatingMenu`'s `opened` state via context.
   */
  showLabel?: boolean
  /**
   * Persistent active state - item remains highlighted even without hover.
   * Use when the action this item triggers is currently "on" (e.g. pin is engaged).
   * Visually identical to Hover but driven by prop, not pointer interaction.
   */
  active?: boolean
  /** Render as a child element (e.g. wrap a `<Link>`). */
  asChild?: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FloatingMenuItem(
  {
    ref,
    icon,
    label = 'Label',
    showLabel,
    active = false,
    disabled = false,
    asChild = false,
    className,
    style,
    onMouseEnter: externalMouseEnter,
    onMouseLeave: externalMouseLeave,
    ...props
  }: FloatingMenuItemProps & { ref?: React.Ref<HTMLButtonElement> },
) {
    const Comp = asChild ? Slot : 'button'
    const { opened } = useFloatingMenuContext()
    // Explicit prop wins; falls back to context value.
    const labelVisible = showLabel ?? opened

    const [isHovered, setIsHovered] = useState(false)
    // Active visual state: persistent `active` prop OR hovered - never when disabled.
    const isActive = (active || isHovered) && !disabled

    // ── Label width measurement ────────────────────────────────────────────────
    // A hidden span is always mounted so we can read the label's natural pixel
    // width before the animation fires. maxWidth uses this value instead of
    // 'auto', which lets Framer use WAAPI (numeric → numeric) rather than
    // JS-driven layout reads on every frame.
    const measureRef = useRef<HTMLSpanElement>(null)
    const [labelWidth, setLabelWidth] = useState(0)

    useLayoutEffect(() => {
      if (measureRef.current) {
        setLabelWidth(measureRef.current.scrollWidth)
      }
    }, [label])

    return (
      <Tooltip
        content={label}
        side="left"
        sideOffset={8}
        delayDuration={150}
        disabled={labelVisible}
      >
      <Comp
        ref={ref}
        type={asChild ? undefined : 'button'}
        disabled={disabled}
        aria-pressed={active}
        aria-label={label}
        className={cn('kaya-floating-menu-item', className)}
        style={{
          position:      'relative',
          display:       'flex',
          alignItems:    'center',
          borderRadius:  '8px',
          overflow:      'hidden',
          paddingTop:    0,
          paddingBottom: 0,
          paddingLeft:   0,
          paddingRight:  0,
          opacity:       disabled ? 0.7 : 1,
          cursor:        disabled ? 'default' : 'pointer',
          boxShadow:     isActive ? SHADOW_OUTER : undefined,
          transition:    'box-shadow 150ms',
          userSelect:    'none',
          background:    'none',
          border:        'none',
          textAlign:     'left',
          ...style,
        }}
        onMouseEnter={(e) => { setIsHovered(true); externalMouseEnter?.(e) }}
        onMouseLeave={(e) => { setIsHovered(false); externalMouseLeave?.(e) }}
        {...props}
      >

        {/* ── Hover / active background ── */}
        {isActive && (
          <div
            aria-hidden
            style={{
              position:        'absolute',
              inset:           0,
              backgroundColor: 'var(--floating-menu-item-hover-bg)',
              pointerEvents:   'none',
            }}
          />
        )}

        {/* ── Icon ── */}
        {icon !== undefined && (
          <div
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              padding:        '6px',
              flexShrink:     0,
              position:       'relative',
              pointerEvents:  'none',
              color:          'var(--floating-menu-item-label)',
              lineHeight:     0,
            }}
          >
            {icon}
          </div>
        )}

        {/* ── Hidden measurement span - always mounted, never visible ── */}
        <span
          ref={measureRef}
          aria-hidden
          style={{
            position:    'absolute',
            visibility:  'hidden',
            pointerEvents: 'none',
            whiteSpace:  'nowrap',
            fontFamily:  'var(--font-body)',
            fontWeight:  'var(--font-weight-medium)',
            fontSize:    'var(--font-size-body)',
            lineHeight:  'var(--line-height-body)',
            paddingRight: '6px',
          }}
        >
          {label}
        </span>

        {/* ── Label ── */}
        <AnimatePresence initial={false}>
          {labelVisible && (
            <m.span
              key="label"
              initial={{ opacity: 0, filter: 'blur(4px)', maxWidth: 0 }}
              animate={{
                opacity:  1,
                filter:   'blur(0px)',
                maxWidth: labelWidth,
                transition: {
                  opacity:  { delay: 0.07, duration: 0.12, ease: 'easeOut' },
                  filter:   { delay: 0.07, duration: 0.12, ease: 'easeOut' },
                  maxWidth: { type: 'spring', stiffness: 700, damping: 40, mass: 0.5 },
                },
              }}
              exit={{
                opacity:  0,
                filter:   'blur(4px)',
                maxWidth: 0,
                transition: {
                  opacity:  { duration: 0.15, ease: 'easeIn' },
                  filter:   { duration: 0.15, ease: 'easeIn' },
                  maxWidth: { duration: 0.18, ease: [0.895, 0.03, 0.685, 0.22] },
                },
              }}
              style={{
                fontFamily:  'var(--font-body)',
                fontWeight:  'var(--font-weight-medium)',
                fontSize:    'var(--font-size-body)',
                lineHeight:  'var(--line-height-body)',
                color:       'var(--floating-menu-item-label)',
                whiteSpace:  'nowrap',
                flexShrink:  0,
                position:    'relative',
                overflow:    'hidden',
                display:     'inline-block',
                paddingRight: '6px',
                boxSizing:   'border-box',
              }}
            >
              {label}
            </m.span>
          )}
        </AnimatePresence>

        {/* ── Inner shadow overlay - renders above content ── */}
        {isActive && (
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
        )}

      </Comp>
      </Tooltip>
    )
}

FloatingMenuItem.displayName = 'FloatingMenuItem'
export default FloatingMenuItem
