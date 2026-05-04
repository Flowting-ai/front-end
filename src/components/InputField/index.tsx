'use client'

import React, { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Field } from '@base-ui/react/field'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface InputFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'size'> {
  /** Label rendered above the input — rendered as <label> for accessibility */
  label?: string
  /**
   * Show/hide the label slot (Figma: `label1`).
   * Defaults to true — only needed if you want to conditionally hide the label
   * without removing the prop entirely.
   */
  showLabel?: boolean
  /**
   * Helper text rendered below the input.
   * Turns red when `error` is true.
   * Always linked to the input via `aria-describedby`.
   */
  subtitle?: string
  /**
   * Show/hide the subtitle slot (Figma: `subtitle1`).
   * Defaults to true.
   */
  showSubtitle?: boolean
  /** Leading icon slot — recommend 16×16 */
  leftIcon?: ReactNode
  /** Trailing icon slot — recommend 16×16 */
  rightIcon?: ReactNode
  /**
   * Error state — red ring + red label + red subtitle.
   * Sets `aria-invalid` on the input automatically via Base UI Field.
   */
  error?: boolean
  /** Size variant — medium (default) or small. Affects padding, border-radius, and typography. */
  size?: 'medium' | 'small'
  /** Controlled value */
  value?: string
  /** Value change handler */
  onChange?: (value: string) => void
  /** Stretch to fill parent width instead of fixed 327px */
  fluid?: boolean
  className?: string
}

// ── Shadows ────────────────────────────────────────────────────────────────────

const BASE_SHADOW = '0px 1px 1.5px 0px var(--neutral-700-12)'

// ── Component ──────────────────────────────────────────────────────────────────

export const InputField = React.forwardRef<HTMLInputElement, InputFieldProps>(
  function InputField(
    {
      label,
      showLabel    = true,
      subtitle,
      showSubtitle = true,
      leftIcon,
      rightIcon,
      error        = false,
      size         = 'medium',
      value,
      onChange,
      fluid        = false,
      disabled     = false,
      className,
      onFocus:      externalFocus,
      onBlur:       externalBlur,
      onMouseEnter: externalEnter,
      onMouseLeave: externalLeave,
      placeholder,
      ...inputProps
    },
    ref,
  ) {
    const [isFocused,        setIsFocused]        = useState(false)
    const [isHovered,        setIsHovered]        = useState(false)
    const [internalHasValue, setInternalHasValue] = useState(false)

    const hasValue = typeof value === 'string' ? value.length > 0 : internalHasValue

    // ── Shadow matrix (matches Figma state × state) ───────────────────────────
    let containerShadow: string
    if (error) {
      // Error — red ring, regardless of focus/hover
      containerShadow = `${BASE_SHADOW}, 0px 0px 0px 1px var(--red-500)`
    } else if (hasValue && !isFocused) {
      // Filled — thicker neutral ring at rest
      containerShadow = `${BASE_SHADOW}, 0px 0px 0px 1px var(--neutral-100)`
    } else if (isHovered && !isFocused) {
      // Hover — slightly darker ring
      containerShadow = `${BASE_SHADOW}, 0px 0px 0px 1px var(--neutral-200)`
    } else {
      // Default / focused (focus ring is via outline, not shadow)
      containerShadow = `${BASE_SHADOW}, 0px 0px 0px 1px var(--neutral-100)`
    }

    // ── Label / subtitle / icon colour ───────────────────────────────────────
    const labelColor = disabled
      ? 'var(--text-field-label-disabled)'
      : error
        ? 'var(--text-field-label-error)'
        : 'var(--text-field-label)'

    const iconColor = disabled
      ? 'var(--text-field-label-disabled)'
      : error
        ? 'var(--text-field-label-error)'
        : 'var(--text-field-icon)'

    const inputColor = disabled
      ? 'var(--text-field-label-disabled)'
      : 'var(--text-field-text)'

    const isSmall = size === 'small'

    const sharedTextStyle: React.CSSProperties = {
      fontFamily: 'var(--font-body)',
      fontWeight: 'var(--font-weight-regular)',
      fontSize:   isSmall ? 'var(--font-size-caption)' : 'var(--font-size-body)',
      lineHeight: isSmall ? 'var(--line-height-caption)' : 'var(--line-height-body)',
      margin:     0,
    }

    return (
      <Field.Root
        invalid={error}
        disabled={disabled}
        className={cn(className)}
        style={{
          display:       'flex',
          flexDirection: 'column',
          gap:           '4px',
          width:         fluid ? '100%' : '327px',
        }}
      >
        {/* ── Label ── */}
        {label && (
          <Field.Label
            style={
              showLabel
                ? { ...sharedTextStyle, color: labelColor }
                : {
                    position:   'absolute',
                    width:      1,
                    height:     1,
                    padding:    0,
                    margin:     -1,
                    overflow:   'hidden',
                    clip:       'rect(0,0,0,0)',
                    whiteSpace: 'nowrap',
                    border:     0,
                  }
            }
          >
            {label}
          </Field.Label>
        )}

        {/* ── Input container ── */}
        <div
          style={{
            position:        'relative',
            display:         'flex',
            alignItems:      'center',
            gap:             '2px',
            backgroundColor: 'var(--text-field-bg)',
            padding:         isSmall ? '7px' : '7px 10px',
            borderRadius:    isSmall ? '8px' : '10px',
            overflow:        'hidden',
            boxShadow:       containerShadow,
            // Focus ring: 2px blue outline offset 3px — radius auto-inherits from
            // border-radius (10px + 3px offset = 13px, matching Figma exactly)
            outlineStyle:    'solid',
            outlineWidth:    '2px',
            outlineOffset:   '3px',
            outlineColor:    isFocused && !error ? 'var(--focus-ring)' : 'transparent',
            transition:      'box-shadow 150ms, outline-color 150ms',
            cursor:          disabled ? 'not-allowed' : 'text',
          }}
          onMouseEnter={(e) => {
            setIsHovered(true)
            externalEnter?.(e as unknown as React.MouseEvent<HTMLInputElement>)
          }}
          onMouseLeave={(e) => {
            setIsHovered(false)
            externalLeave?.(e as unknown as React.MouseEvent<HTMLInputElement>)
          }}
        >
          {/* Left icon */}
          {leftIcon && (
            <span
              aria-hidden
              style={{
                display:    'inline-flex',
                flexShrink: 0,
                color:      iconColor,
                lineHeight: 0,
              }}
            >
              {leftIcon}
            </span>
          )}

          {/* Native input via Base UI Field.Control */}
          <div style={{ position: 'relative', flex: 1, padding: '0 2px', display: 'flex', alignItems: 'center', minWidth: 0 }}>
            <AnimatePresence initial={false}>
              {!hasValue && placeholder && (
                <motion.span
                  key="placeholder"
                  aria-hidden
                  initial={{ opacity: 0, filter: 'blur(2px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)', transition: { duration: 0.2 } }}
                  exit={{ opacity: 0, filter: 'blur(2px)', transition: { duration: 0.15 } }}
                  style={{
                    position:      'absolute',
                    inset:         0,
                    display:       'flex',
                    alignItems:    'center',
                    pointerEvents: 'none',
                    fontFamily:    'var(--font-body)',
                    fontWeight:    'var(--font-weight-regular)',
                    fontSize:      isSmall ? 'var(--font-size-caption)' : 'var(--font-size-body)',
                    lineHeight:    isSmall ? 'var(--line-height-caption)' : 'var(--line-height-body)',
                    color:         disabled ? 'var(--text-field-label-disabled)' : 'var(--text-field-placeholder)',
                    whiteSpace:    'nowrap',
                    overflow:      'hidden',
                  }}
                >
                  {placeholder}
                </motion.span>
              )}
            </AnimatePresence>
            <Field.Control
              render={
                <input
                  ref={ref}
                  className="kds-input-field-input"
                  value={value}
                  onChange={(e) => {
                    if (value === undefined) setInternalHasValue(e.target.value.length > 0)
                    onChange?.(e.target.value)
                  }}
                  onFocus={(e) => { setIsFocused(true); externalFocus?.(e) }}
                  onBlur={(e)  => { setIsFocused(false); externalBlur?.(e) }}
                  style={{
                    flex:       1,
                    minWidth:   0,
                    background: 'transparent',
                    border:     'none',
                    outline:    'none',
                    padding:    0,
                    fontFamily: 'var(--font-body)',
                    fontWeight: 'var(--font-weight-regular)',
                    fontSize:   isSmall ? 'var(--font-size-caption)' : 'var(--font-size-body)',
                    lineHeight: isSmall ? 'var(--line-height-caption)' : 'var(--line-height-body)',
                    color:      inputColor,
                    width:      '100%',
                  }}
                  {...inputProps}
                />
              }
            />
          </div>

          {/* Right icon */}
          {rightIcon && (
            <span
              aria-hidden
              style={{
                display:    'inline-flex',
                flexShrink: 0,
                color:      iconColor,
                lineHeight: 0,
              }}
            >
              {rightIcon}
            </span>
          )}
        </div>

        {/* ── Subtitle / helper text ── */}
        {showSubtitle && subtitle && (
          <Field.Description style={{ ...sharedTextStyle, color: labelColor }}>
            {subtitle}
          </Field.Description>
        )}
      </Field.Root>
    )
  },
)

InputField.displayName = 'InputField'

export default InputField
