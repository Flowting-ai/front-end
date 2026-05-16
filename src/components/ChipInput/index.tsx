'use client'

import React, { useCallback, useRef, useState } from 'react'
import { AnimatePresence, motion, useAnimation } from 'framer-motion'
import { cn } from '@/lib/utils'

// ── Constants ─────────────────────────────────────────────────────────────────

// Figma 3118:32829 - chip input minimum width.
const MIN_WIDTH = 64

// Hard cap on tag length. Matches the in-Pin "Add tag" affordance - pin tags
// are short, identifying labels, not freeform notes. Past this, the input
// rejects the keystroke (restoring the previous value) and triggers the same
// shake animation `PinCommentField` uses when the 2-line cap is hit.
const MAX_LENGTH = 30

// ── Shadow tokens (mirrors PinCommentField) ───────────────────────────────────

const SHADOW_DEFAULT = '0px 1px 2px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-800-10)'
const SHADOW_HOVER   = '0px 1px 2px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-800-10), 0px 0px 0px 3px var(--neutral-100-60)'
const SHADOW_FOCUS   = '0px 1px 2px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--focus-ring)'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ChipInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Visible placeholder shown via the animated overlay. Defaults to "Add tag…". */
  placeholder?: string
  /** Accessible label - required when no visible <label> is paired with the input. */
  'aria-label'?: string
}

// ── Component ──────────────────────────────────────────────────────────────────
//
// A single-line input styled like the pin comment field: white pill with three
// shadow states (default / hover / focus) and a soft animated placeholder.
//
// Width behaviour: the wrapper is `display: inline-grid` and contains a hidden
// mirror <span> in the same grid cell as the <input>. The mirror's text sets
// the grid column width; the input fills the column. `min-width: 64px` on the
// wrapper enforces the floor. No JS measurement, so it stays correct across
// font loads, transforms, and reduced-motion.

export const ChipInput = React.forwardRef<HTMLInputElement, ChipInputProps>(
  function ChipInput(
    {
      placeholder      = 'Add tag…',
      defaultValue,
      value:            controlledValue,
      className,
      style,
      onChange:         externalChange,
      onFocus:          externalFocus,
      onBlur:           externalBlur,
      onMouseEnter:     externalEnter,
      onMouseLeave:     externalLeave,
      ...props
    },
    forwardedRef,
  ) {
    const [isHovered, setIsHovered] = useState(false)
    const [isFocused, setIsFocused] = useState(false)
    // Shake-on-cap animation - same controls API as `PinCommentField`'s
    // 2-line cap, applied here when the user types past `MAX_LENGTH`.
    const shakeControls = useAnimation()

    const isControlled = controlledValue !== undefined
    const [internalValue, setInternalValue] = useState<string>(
      (defaultValue as string) ?? '',
    )
    const value = isControlled ? String(controlledValue ?? '') : internalValue

    const inputRef = useRef<HTMLInputElement>(null)
    const setRef = useCallback(
      (el: HTMLInputElement | null) => {
        inputRef.current = el
        if (typeof forwardedRef === 'function') forwardedRef(el)
        else if (forwardedRef) forwardedRef.current = el
      },
      [forwardedRef],
    )

    const shadow = isFocused ? SHADOW_FOCUS : isHovered ? SHADOW_HOVER : SHADOW_DEFAULT

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value
      if (next.length > MAX_LENGTH) {
        // Reject - restore previous valid value and shake. Same x-keyframes /
        // duration / easing as PinCommentField so the gesture is consistent
        // across "you've hit a limit" feedback in the system.
        if (inputRef.current) inputRef.current.value = value
        shakeControls.start({
          x: [0, -3, 3, -2, 2, -1, 1, 0],
          transition: { duration: 0.25, ease: 'easeInOut' },
        })
        return
      }
      if (!isControlled) setInternalValue(next)
      externalChange?.(e)
    }

    // Click anywhere on the chip → focus the input. Without this, the padding
    // around the input is dead clickable area.
    const focusInput = () => inputRef.current?.focus()

    return (
      <motion.div
        animate={shakeControls}
        className={cn(className)}
        onMouseEnter={(e) => { setIsHovered(true);  externalEnter?.(e as unknown as React.MouseEvent<HTMLInputElement>) }}
        onMouseLeave={(e) => { setIsHovered(false); externalLeave?.(e as unknown as React.MouseEvent<HTMLInputElement>) }}
        onClick={focusInput}
        style={{
          position:        'relative',
          display:         'inline-grid',
          alignItems:      'center',
          minWidth:        MIN_WIDTH,
          padding:         '2px 4px',
          borderRadius:    '6px',
          backgroundColor: 'var(--neutral-white)',
          boxShadow:       shadow,
          overflow:        'clip',
          transition:      'box-shadow 150ms',
          cursor:          'text',
          ...style,
        }}
      >
        {/* Animated placeholder overlay - sits absolutely above the input row.
            Uses the same blur+opacity cross-fade as PinCommentField. */}
        <AnimatePresence initial={false}>
          {!value && placeholder && (
            <motion.span
              key="placeholder"
              aria-hidden
              initial={{ opacity: 0, filter: 'blur(2px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)', transition: { duration: 0.2 } }}
              exit={{    opacity: 0, filter: 'blur(2px)', transition: { duration: 0.15 } }}
              style={{
                position:      'absolute',
                top:           2,
                left:          4,
                right:         4,
                pointerEvents: 'none',
                fontFamily:    'var(--font-body)',
                fontWeight:    'var(--font-weight-medium)',
                fontSize:      'var(--font-size-caption)',
                lineHeight:    'var(--line-height-caption)',
                color:         'var(--color-text-placeholder)',
                whiteSpace:    'pre',
                overflow:      'hidden',
              }}
            >
              {placeholder}
            </motion.span>
          )}
        </AnimatePresence>

        {/* Hidden mirror - sets the grid column width to the typed value
            ONLY. The placeholder is decoration on top and never drives width:
            an empty chip stays clamped to `min-width: 64px` regardless of how
            long the placeholder text is, and grows past 64 px as the user
            types past that threshold. Zero-width space keeps the grid row
            from collapsing in height when value is empty. */}
        <span
          aria-hidden
          style={{
            gridArea:   '1 / 1',
            visibility: 'hidden',
            whiteSpace: 'pre',
            fontFamily: 'var(--font-body)',
            fontWeight: 'var(--font-weight-medium)',
            fontSize:   'var(--font-size-caption)',
            lineHeight: 'var(--line-height-caption)',
            pointerEvents: 'none',
          }}
        >
          {value || '​'}
        </span>

        <input
          ref={setRef}
          type="text"
          // size={1} drops the input's UA-default intrinsic width (~150 px)
          // so it stops contributing to grid track sizing. The mirror - and
          // the wrapper's `min-width: 64px` floor - solely drive the chip
          // width. Without this, the empty chip renders ~200 px wide.
          size={1}
          value={value}
          // Suppress the native placeholder - we render our own animated overlay.
          placeholder=""
          className="kds-chip-input"
          style={{
            gridArea:   '1 / 1',
            width:      '100%',
            minWidth:   0,
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
          }}
          onChange={handleChange}
          onFocus={(e) => { setIsFocused(true);  externalFocus?.(e) }}
          onBlur={(e)  => { setIsFocused(false); externalBlur?.(e) }}
          {...props}
        />
      </motion.div>
    )
  },
)

ChipInput.displayName = 'ChipInput'
export default ChipInput
