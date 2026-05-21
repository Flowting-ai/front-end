'use client'

import React, { useCallback, useRef, useState } from 'react'
import { Field } from '@base-ui/react/field'
import { AnimatePresence, animate, m } from 'framer-motion'
import { ViewIcon } from '@strange-huge/icons'
import { IconButton } from '@/components/IconButton'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PasswordInputFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> {
  /** Label rendered above the input */
  label?: string
  /**
   * Show/hide the label slot. Defaults to true.
   */
  showLabel?: boolean
  /** Helper text rendered below the input. Turns red when `error` is true. */
  subtitle?: string
  /** Show/hide the subtitle slot. Defaults to true. */
  showSubtitle?: boolean
  /** Error state - red ring + red label + red subtitle. */
  error?: boolean
  /** Controlled value */
  value?: string
  /** Value change handler */
  onChange?: (value: string) => void
  /** Stretch to fill parent width instead of fixed 327px */
  fluid?: boolean
  className?: string
}

// ── Shadows ───────────────────────────────────────────────────────────────────

const BASE_SHADOW = '0px 1px 1.5px 0px var(--neutral-700-12)'

// ── Component ─────────────────────────────────────────────────────────────────

export function PasswordInputField({
    ref,
    label,
    showLabel    = true,
    subtitle,
    showSubtitle = true,
    error        = false,
    value,
    onChange,
    fluid        = false,
    disabled     = false,
    className,
    onFocus:      externalFocus,
    onBlur:       externalBlur,
    onMouseEnter: externalEnter,
    onMouseLeave: externalLeave,
    ...inputProps
  }: PasswordInputFieldProps & { ref?: React.Ref<HTMLInputElement> }) {
    const [isFocused,        setIsFocused]        = useState(false)
    const [isHovered,        setIsHovered]        = useState(false)
    const [showPassword,     setShowPassword]     = useState(false)
    // Tracks whether the input has content in uncontrolled mode (no value prop).
    const [internalHasValue, setInternalHasValue] = useState(false)
    const contentRef = useRef<HTMLDivElement>(null)

    // Controlled: read from prop. Uncontrolled: track via onChange.
    const hasValue = typeof value === 'string' ? value.length > 0 : internalHasValue
    // Eye button: only visible when there is a value - no toggle on empty input
    const showEye  = hasValue && !disabled

    // Fade+blur out → switch type → fade+blur in
    const togglePassword = useCallback(async () => {
      const el = contentRef.current
      if (el) {
        await animate(el, { opacity: 0, filter: 'blur(4px)' }, { duration: 0.08 })
        setShowPassword(v => !v)
        animate(el, { opacity: 1, filter: 'blur(0px)' }, { duration: 0.18, ease: 'easeOut' })
      } else {
        setShowPassword(v => !v)
      }
    }, [])

    // ── Shadow matrix (matches Figma state × state) ───────────────────────────
    let containerShadow: string
    if (error) {
      containerShadow = `${BASE_SHADOW}, 0px 0px 0px 1px var(--red-500)`
    } else if (hasValue && !isFocused) {
      containerShadow = `${BASE_SHADOW}, 0px 0px 0px 1px var(--neutral-100)`
    } else if (isHovered && !isFocused) {
      containerShadow = `${BASE_SHADOW}, 0px 0px 0px 1px var(--neutral-200)`
    } else {
      containerShadow = `${BASE_SHADOW}, 0px 0px 0px 1px var(--neutral-100)`
    }

    const labelColor = disabled
      ? 'var(--text-field-label-disabled)'
      : error
        ? 'var(--text-field-label-error)'
        : 'var(--text-field-label)'

    const inputColor = disabled
      ? 'var(--text-field-label-disabled)'
      : 'var(--text-field-text)'

    const sharedTextStyle: React.CSSProperties = {
      fontFamily: 'var(--font-body)',
      fontWeight: 'var(--font-weight-regular)',
      fontSize:   'var(--font-size-body)',
      lineHeight: 'var(--line-height-body)',
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
            height:          '36px',
            paddingTop:      '2px',
            paddingBottom:   '2px',
            paddingLeft:     '10px',
            paddingRight:    '2px',
            borderRadius:    '10px',
            overflow:        'hidden',
            boxShadow:       containerShadow,
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
          {/* Input - ref'd for the toggle animation */}
          <div ref={contentRef} style={{ position: 'relative', flex: 1, padding: '0 2px', display: 'flex', alignItems: 'center', minWidth: 0 }}>
            <AnimatePresence initial={false}>
              {!hasValue && (
                <m.span
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
                    fontSize:      'var(--font-size-body)',
                    lineHeight:    'var(--line-height-body)',
                    color:         disabled ? 'var(--text-field-label-disabled)' : 'var(--text-field-placeholder)',
                    whiteSpace:    'nowrap',
                    overflow:      'hidden',
                  }}
                >
                  Enter your password
                </m.span>
              )}
            </AnimatePresence>
            <Field.Control
              render={
                <input
                  ref={ref}
                  className="kds-input-field-input"
                  type={showPassword ? 'text' : 'password'}
                  value={value}
                  onChange={(e) => {
                    setInternalHasValue(e.target.value.length > 0)
                    onChange?.(e.target.value)
                  }}
                  onFocus={(e) => { setIsFocused(true); externalFocus?.(e) }}
                  onBlur={(e)  => { setIsFocused(false); externalBlur?.(e) }}
                  {...inputProps}
                  style={{
                    flex:         1,
                    minWidth:     0,
                    background:   'transparent',
                    border:       'none',
                    // eslint-disable-next-line react-doctor/no-outline-none -- browser outline suppressed; :focus-visible handled by container or global styles
                    outline:      'none',
                    padding:      0,
                    fontFamily:   'var(--font-body)',
                    fontWeight:   'var(--font-weight-regular)',
                    // Larger font-size when hiding password so dots are prominent.
                    // Only applies when there is a value - never touches placeholder text.
                    fontSize:      (!showPassword && hasValue) ? '16px' : 'var(--font-size-body)',
                    letterSpacing: (!showPassword && hasValue) ? '1px'  : 'normal',
                    lineHeight:   'var(--line-height-body)',
                    color:        inputColor,
                    width:        '100%',
                  }}
                />
              }
            />
          </div>

          {/* ── Eye toggle button ── */}
          {showEye && (
            <IconButton
              variant="ghost-2"
              size="sm"
              type="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onMouseDown={(e) => e.preventDefault()}
              onClick={togglePassword}
              icon={<ViewIcon size={20} variant={showPassword ? 'visible' : 'hidden'} />}
            />
          )}
        </div>

        {/* ── Subtitle ── */}
        {showSubtitle && subtitle && (
          <Field.Description style={{ ...sharedTextStyle, color: labelColor }}>
            {subtitle}
          </Field.Description>
        )}
      </Field.Root>
    )
}

PasswordInputField.displayName = 'PasswordInputField'

export default PasswordInputField
