'use client'

import React, { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, m, useAnimation } from 'framer-motion'
import { cn } from '@/lib/utils'

// â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// 2 lines Ã— 16px line-height (--line-height-caption)
const MAX_HEIGHT = 32
const MIN_HEIGHT = 16

// â”€â”€ Shadow tokens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Drop shadow is 0px 1px 2px - shallower than the chat-input family (0px 2px 2.8px)
const SHADOW_DEFAULT = '0px 1px 2px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-800-10)'
const SHADOW_HOVER   = '0px 1px 2px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-800-10), 0px 0px 0px 3px var(--neutral-100-60)'
const SHADOW_FOCUS   = '0px 1px 2px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--focus-ring)'

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface PinCommentFieldProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'children'> {
  /** Stretch to fill parent width instead of fixed 292px */
  fluid?: boolean
  /** Accessible label for the textarea - required when no visible <label> is present */
  'aria-label'?: string
  /** Content rendered at the right end inside the field container (e.g. a save button). */
  rightSlot?: React.ReactNode
}

// â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function PinCommentField({
      ref: forwardedRef,
      fluid           = false,
      className,
      style,
      placeholder     = 'Type your comment here...',
      defaultValue,
      rightSlot,
      onChange:     externalChange,
      onKeyDown:    externalKeyDown,
      onFocus:      externalFocus,
      onBlur:       externalBlur,
      onMouseEnter: externalEnter,
      onMouseLeave: externalLeave,
      ...props
    }: PinCommentFieldProps & { ref?: React.Ref<HTMLTextAreaElement> }) {
    const [isHovered, setIsHovered] = useState(false)
    const [isFocused, setIsFocused] = useState(false)

    // Internal value - we own this to enforce the 2-line limit.
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

    // â”€â”€ Height measurement helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€ Initial height (corrects for defaultValue) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    useLayoutEffect(() => {
      const ta = internalRef.current
      if (!ta) return
      setTaHeight(Math.min(measureHeight(ta), MAX_HEIGHT))
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // â”€â”€ Auto-grow + 2-line enforcement â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const ta = internalRef.current
      if (!ta) return

      const naturalHeight = measureHeight(ta)

      if (naturalHeight <= MAX_HEIGHT) {
        setTaHeight(naturalHeight)
        setValue(e.target.value)
        externalChange?.(e)
      } else {
        // Reject - restore previous valid value and shake.
        ta.value = value
        shakeControls.start({
          x: [0, -3, 3, -2, 2, -1, 1, 0],
          transition: { duration: 0.25, ease: 'easeInOut' },
        })
      }
    }

    // Block Enter - second line comes from word wrap only.
    // Also blur to signal "done editing" so the comment is saved.
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        ;(e.target as HTMLTextAreaElement).blur()
      }
      externalKeyDown?.(e)
    }

    return (
      <m.div
        animate={shakeControls}
        className={cn(className)}
        style={{
          backgroundColor: 'var(--neutral-white)',
          borderRadius:    '6px',
          padding:         '6px',
          width:           fluid ? '100%' : '292px',
          boxShadow:       shadow,
          overflow:        'clip',
          transition:      'box-shadow 150ms',
          display:         'flex',
          alignItems:      'flex-end',
          gap:             '4px',
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
        {/* Textarea area — grows to fill available width */}
        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          <AnimatePresence initial={false}>
            {!value && !isFocused && placeholder && (
              <m.span
                key="placeholder"
                aria-hidden
                initial={{ opacity: 0, filter: 'blur(2px)' }}
                animate={{ opacity: 1, filter: 'blur(0px)', transition: { duration: 0.2 } }}
                exit={{ opacity: 0, filter: 'blur(2px)', transition: { duration: 0.15 } }}
                style={{
                  position:      'absolute',
                  top:           0,
                  left:          0,
                  right:         0,
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
              </m.span>
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
        </div>

        {/* Right-side slot — e.g. save button */}
        {rightSlot && (
          <div style={{ flexShrink: 0 }}>
            {rightSlot}
          </div>
        )}
      </m.div>
    )
}

PinCommentField.displayName = 'PinCommentField'
export default PinCommentField
