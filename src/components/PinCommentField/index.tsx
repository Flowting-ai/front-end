'use client'

import React, { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useAnimation } from 'framer-motion'
import { cn } from '@/lib/utils'

// ── Constants ─────────────────────────────────────────────────────────────────

// 2 lines × 16px line-height (--line-height-caption)
const MAX_HEIGHT = 32
const MIN_HEIGHT = 16

// ── Shadow tokens ──────────────────────────────────────────────────────────────

// Drop shadow is 0px 1px 2px — shallower than the chat-input family (0px 2px 2.8px)
const SHADOW_DEFAULT = '0px 1px 2px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-800-10)'
const SHADOW_HOVER   = '0px 1px 2px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-800-10), 0px 0px 0px 3px var(--neutral-100-60)'
const SHADOW_FOCUS   = '0px 1px 2px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--focus-ring)'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PinCommentFieldProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'children'> {
  /** Stretch to fill parent width instead of fixed 292px */
  fluid?: boolean
  /** Accessible label for the textarea — required when no visible <label> is present */
  'aria-label'?: string
}

// ── Component ──────────────────────────────────────────────────────────────────

export const PinCommentField = React.forwardRef<HTMLTextAreaElement, PinCommentFieldProps>(
  function PinCommentField(
    {
      fluid           = false,
      className,
      style,
      placeholder     = 'Type your comment here...',
      defaultValue,
      onChange:     externalChange,
      onKeyDown:    externalKeyDown,
      onFocus:      externalFocus,
      onBlur:       externalBlur,
      onMouseEnter: externalEnter,
      onMouseLeave: externalLeave,
      ...props
    },
    forwardedRef,
  ) {
    const [isHovered, setIsHovered] = useState(false)
    const [isFocused, setIsFocused] = useState(false)

    // Internal value — we own this to enforce the 2-line limit.
    const [value,    setValue]    = useState((defaultValue as string) ?? '')
    // Height is React state so it survives re-renders without being reset by
    // the style prop. Starts at 1 line; useLayoutEffect corrects for defaultValue.
    const [taHeight, setTaHeight] = useState(MIN_HEIGHT)

    const shakeControls = useAnimation()

    // Internal ref for scrollHeight measurement; merged with forwarded ref.
    const internalRef = useRef<HTMLTextAreaElement>(null)
    const setRef = useCallback(
      (el: HTMLTextAreaElement | null) => {
        internalRef.current = el
        if (typeof forwardedRef === 'function') forwardedRef(el)
        else if (forwardedRef) forwardedRef.current = el
      },
      [forwardedRef],
    )

    const shadow = isFocused ? SHADOW_FOCUS : isHovered ? SHADOW_HOVER : SHADOW_DEFAULT

    // ── Height measurement helper ──────────────────────────────────────────────
    // scrollHeight reports full content height even through overflow:hidden, so
    // we never touch overflowY. We save/restore the inline height so there is
    // no flash between our cleanup and React's next render commit.
    const measureHeight = (ta: HTMLTextAreaElement): number => {
      // rows={1} ensures 'auto' resolves to 1-row baseline (not the UA default
      // of 2 rows), so scrollHeight correctly returns MIN_HEIGHT for empty and
      // MAX_HEIGHT for 2-line content. Save/restore prevents a render flash.
      const prev = ta.style.height
      ta.style.height = 'auto'
      const h = ta.scrollHeight
      ta.style.height = prev
      return h
    }

    // ── Initial height (corrects for defaultValue) ─────────────────────────────
    useLayoutEffect(() => {
      const ta = internalRef.current
      if (!ta) return
      setTaHeight(Math.min(measureHeight(ta), MAX_HEIGHT))
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Auto-grow + 2-line enforcement ─────────────────────────────────────────
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const ta = internalRef.current
      if (!ta) return

      const naturalHeight = measureHeight(ta)

      if (naturalHeight <= MAX_HEIGHT) {
        setTaHeight(naturalHeight)
        setValue(e.target.value)
        externalChange?.(e)
      } else {
        // Reject — restore previous valid value and shake.
        ta.value = value
        shakeControls.start({
          x: [0, -3, 3, -2, 2, -1, 1, 0],
          transition: { duration: 0.25, ease: 'easeInOut' },
        })
      }
    }

    // Block Enter — second line comes from word wrap only.
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter') e.preventDefault()
      externalKeyDown?.(e)
    }

    return (
      <motion.div
        animate={shakeControls}
        className={cn(className)}
        style={{
          position:        'relative',  // anchors the placeholder overlay
          backgroundColor: 'var(--neutral-white)',
          borderRadius:    '6px',
          padding:         '6px',
          width:           fluid ? '100%' : '292px',
          boxShadow:       shadow,
          overflow:        'clip',
          transition:      'box-shadow 150ms',
          ...style,
        }}
        onMouseEnter={(e) => {
          setIsHovered(true)
          externalEnter?.(e as unknown as React.MouseEvent<HTMLTextAreaElement>)
        }}
        onMouseLeave={(e) => {
          setIsHovered(false)
          externalLeave?.(e as unknown as React.MouseEvent<HTMLTextAreaElement>)
        }}
      >
        <AnimatePresence initial={false}>
          {!value && placeholder && (
            <motion.span
              key="placeholder"
              aria-hidden
              initial={{ opacity: 0, filter: 'blur(2px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)', transition: { duration: 0.2 } }}
              exit={{ opacity: 0, filter: 'blur(2px)', transition: { duration: 0.15 } }}
              style={{
                position:      'absolute',
                top:           6,
                left:          6,
                right:         6,
                pointerEvents: 'none',
                fontFamily:    'var(--font-body)',
                fontWeight:    'var(--font-weight-medium)',
                fontSize:      'var(--font-size-caption)',
                lineHeight:    'var(--line-height-caption)',
                color:         'var(--color-text-placeholder)',
                whiteSpace:    'nowrap',
                overflow:      'hidden',
              }}
            >
              {placeholder}
            </motion.span>
          )}
        </AnimatePresence>

        <textarea
          ref={setRef}
          value={value}
          className="kds-pin-comment-field"
          style={{
            display:    'block',
            width:      '100%',
            height:     taHeight,
            resize:     'none',
            border:     'none',
            outline:    'none',
            background: 'transparent',
            padding:    0,
            margin:     0,
            fontFamily: 'var(--font-body)',
            fontWeight: 'var(--font-weight-medium)',
            fontSize:   'var(--font-size-caption)',
            lineHeight: 'var(--line-height-caption)',
            color:      'var(--neutral-900)',
            overflowY:  'hidden',
          }}
          rows={1}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={(e) => { setIsFocused(true);  externalFocus?.(e) }}
          onBlur={(e)  => { setIsFocused(false); externalBlur?.(e) }}
          {...props}
        />
      </motion.div>
    )
  },
)

PinCommentField.displayName = 'PinCommentField'
export default PinCommentField
