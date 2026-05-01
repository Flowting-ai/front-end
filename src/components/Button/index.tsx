'use client'

import React, { useRef, useId, useState } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useCorrosion } from '@/lib/useCorrosion'
import { useSquircle } from '@/lib/useSquircle'

// ── Shadows ────────────────────────────────────────────────────────────────────

const SHADOW_OUTER                    = 'var(--shadow-button-default-outer)'
const SHADOW_SUBTLE_OUTER_HOVER       = 'var(--shadow-button-subtle-outer-hover)'
const SHADOW_SUBTLE_INNER_HOVER       = 'var(--shadow-button-subtle-inner-hover)'
const SHADOW_INNER                = 'var(--shadow-button-default-inner)'
const SHADOW_INNER_DISABLED       = 'var(--shadow-button-default-inner-disabled)'
const SHADOW_ICON_EMBOSS          = 'var(--shadow-button-default-icon-emboss)'
const SHADOW_ICON_EMBOSS_DISABLED = 'var(--shadow-button-default-icon-emboss-disabled)'
const SHADOW_TEXT                 = 'var(--shadow-button-default-text)'
const SHADOW_TEXT_DISABLED        = 'var(--shadow-button-default-text-disabled)'
const SHADOW_SECONDARY_OUTER       = 'var(--shadow-button-secondary-outer)'
const SHADOW_SECONDARY_OUTER_HOVER = 'var(--shadow-button-secondary-outer-hover)'
const SHADOW_SECONDARY_INNER       = 'var(--shadow-button-secondary-inner)'
const SHADOW_SECONDARY_INNER_HOVER = 'var(--shadow-button-secondary-inner-hover)'

const HOVER_GLOW_GRADIENT = 'linear-gradient(180deg, rgb(221,221,221) 0%, rgb(143,116,39) 21.635%, rgb(104,61,27) 36.058%, rgb(39,13,42) 63.462%, rgb(11,53,127) 82.212%, rgb(13,110,178) 97.115%)'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ButtonVariant = 'default' | 'ghost' | 'outline' | 'secondary'
export type ButtonSize = 'md' | 'sm'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  asChild?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  image?: string
  loading?: boolean
  fluid?: boolean
  children?: React.ReactNode
}

// ── Loading spinner ───────────────────────────────────────────────────────────

function ButtonSpinner({ color }: { color: string }) {
  return (
    <motion.svg
      width={24}
      height={24}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      style={{ color, flexShrink: 0 }}
      animate={{ rotate: 360 }}
      transition={{
        duration: 1,
        ease: [0.25, 0.1, 0.25, 1],
        repeat: Infinity,
        repeatType: 'loop',
      }}
    >
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.25" />
      <path d="M 8 2.5 A 5.5 5.5 0 0 1 13.5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </motion.svg>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button({
  variant = 'default',
  size = 'md',
  asChild = false,
  leftIcon,
  rightIcon,
  image,
  loading = false,
  disabled = false,
  fluid = false,
  children = 'Button',
  className,
  onMouseEnter: externalMouseEnter,
  onMouseLeave: externalMouseLeave,
  onFocus: externalFocus,
  onBlur: externalBlur,
  ...props
}, forwardedRef) {
  const Comp = asChild ? Slot : 'button'
  const isMd = size === 'md'
  const isDisabled = disabled || loading
  const isCorrosion = variant === 'default' && !isDisabled
  const isSubtle    = (variant === 'ghost' || variant === 'outline') && !isDisabled
  const isSecondary = variant === 'secondary'

  const spinnerColor: Record<ButtonVariant, string> = {
    default:   'var(--neutral-50)',
    ghost:     'var(--button-ghost-text)',
    outline:   'var(--button-outline-text)',
    secondary: 'var(--button-secondary-text)',
  }

  const [isHovered, setIsHovered] = useState(false)
  const [isFocused, setIsFocused] = useState(false)

  const cornerRadius = isMd ? 10 : 8
  const { ref: squircleRef, clipPath, strokeClipPath } = useSquircle(cornerRadius, 0.6, 1)

  const mergedRef = (node: HTMLButtonElement | null) => {
    ;(squircleRef as React.MutableRefObject<HTMLButtonElement | null>).current = node
    if (typeof forwardedRef === 'function') forwardedRef(node)
    else if (forwardedRef) forwardedRef.current = node
  }

  const uid      = useId()
  const filterId = `kaya-corrosion-${uid}`
  const blurId   = `kaya-mask-blur-${uid}`
  const maskId   = `kaya-reveal-mask-${uid}`

  const circleRef = useRef<SVGCircleElement>(null)
  const { onMouseEnter: corrosionEnter, onMouseLeave: corrosionLeave } = useCorrosion(circleRef)

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    setIsHovered(true)
    if (isCorrosion) corrosionEnter(e)
    externalMouseEnter?.(e)
  }

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    setIsHovered(false)
    if (isCorrosion) corrosionLeave(e)
    externalMouseLeave?.(e)
  }

  const baseClasses = cn(
    'group relative flex items-center justify-center gap-[2px] overflow-hidden',
    'select-none cursor-[inherit] focus:outline-none',
    fluid && 'w-full',
    isMd ? 'rounded-[10px]' : 'rounded-[8px]',
    variant === 'default'
      ? isMd ? 'pt-[6px] pb-[8px] px-[10px]' : 'pt-[4px] pb-[6px] px-[8px]'
      : isMd ? 'pt-[6px] pb-[8px] px-[10px]' : 'py-[5px] px-[8px]',
  )

  const variantClasses: Record<ButtonVariant, string> = {
    default:   cn(isDisabled && 'opacity-70'),
    ghost:     cn(isDisabled && 'opacity-70'),
    outline:   cn(isDisabled && 'opacity-70'),
    secondary: cn(isDisabled && 'opacity-70'),
  }

  const textColor: Record<ButtonVariant, string> = {
    default:   isDisabled ? 'var(--button-default-text-disabled)'  : 'var(--button-default-text)',
    ghost:     isDisabled ? 'var(--button-ghost-text-disabled)'    : 'var(--button-ghost-text)',
    outline:   isDisabled ? 'var(--button-outline-text-disabled)'  : 'var(--button-outline-text)',
    secondary: isDisabled ? 'var(--button-secondary-text-disabled)' : 'var(--button-secondary-text)',
  }

  const textShadow = variant === 'default'
    ? isDisabled ? SHADOW_TEXT_DISABLED : SHADOW_TEXT
    : undefined

  const iconFilter = variant === 'default'
    ? isDisabled ? SHADOW_ICON_EMBOSS_DISABLED : SHADOW_ICON_EMBOSS
    : undefined

  const bgStyle: React.CSSProperties = {
    ...(clipPath && !isSecondary ? { clipPath } : {}),
    ...(variant === 'default'
      ? {
          backgroundImage: isDisabled
            ? isMd
              ? 'linear-gradient(180deg, #524b47 0%, #3b3632 100%)'
              : undefined
            : 'linear-gradient(180deg, #524b47 0%, #26211e 100%)',
          backgroundColor: isDisabled && !isMd ? '#3b3632' : undefined,
        }
      : {}),
    ...(isSecondary ? {
      backgroundColor: 'var(--button-secondary-bg)',
      boxShadow:       isHovered && !isDisabled ? SHADOW_SECONDARY_OUTER_HOVER : SHADOW_SECONDARY_OUTER,
      transition:      'box-shadow 150ms',
    } : {}),
  }

  const defaultStrokeColor = variant === 'default'
    ? (isDisabled ? 'var(--button-default-border-disabled)' : 'var(--button-default-border)')
    : null
  const outlineStrokeColor = variant === 'outline'
    ? (isDisabled ? 'var(--button-outline-border-disabled)' : 'var(--button-outline-border)')
    : null

  const wrapperFilter = variant === 'default'
    ? SHADOW_OUTER
    : isSubtle && isHovered
      ? SHADOW_SUBTLE_OUTER_HOVER
      : undefined

  return (
    <motion.span
      tabIndex={-1}
      whileTap={isDisabled ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.1, ease: 'easeOut' }}
      style={{
        position: 'relative',
        display: fluid ? 'flex' : 'inline-flex',
        width: fluid ? '100%' : undefined,
        flex: fluid ? '1 0 0' : undefined,
        verticalAlign: 'top',
        filter: wrapperFilter,
        borderRadius: isMd ? '10px' : '8px',
        outlineStyle: 'solid',
        outlineWidth: '2px',
        outlineOffset: '3px',
        outlineColor: isFocused ? 'var(--focus-ring)' : 'transparent',
        transition: 'filter 200ms, outline-color 150ms',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
      }}
    >
      {defaultStrokeColor && strokeClipPath && (
        <div aria-hidden style={{ position: 'absolute', inset: -1, clipPath: strokeClipPath, backgroundColor: defaultStrokeColor, pointerEvents: 'none' }} />
      )}

      {isSubtle && strokeClipPath && clipPath && (
        <div aria-hidden style={{ position: 'absolute', inset: -1, clipPath: strokeClipPath, backgroundColor: isHovered ? 'var(--button-subtle-border-hover)' : 'transparent', pointerEvents: 'none', transition: 'background-color 200ms' }}>
          <div style={{ position: 'absolute', inset: 1, clipPath: clipPath, backgroundColor: isHovered ? 'var(--neutral-50)' : 'transparent', transition: 'background-color 200ms' }} />
        </div>
      )}
    <Comp
      ref={mergedRef}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(baseClasses, variantClasses[variant], className)}
      style={{ ...bgStyle }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={(e) => {
        if (typeof e.target.matches === 'function' && e.target.matches(':focus-visible')) {
          setIsFocused(true)
        }
        externalFocus?.(e)
      }}
      onBlur={(e) => { setIsFocused(false); externalBlur?.(e) }}
      {...props}
    >
      {isCorrosion && (
        <svg aria-hidden style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <defs>
            <filter id={filterId} x="-35%" y="-35%" width="170%" height="170%" colorInterpolationFilters="sRGB">
              <feTurbulence type="fractalNoise" baseFrequency="0.035 0.06" numOctaves={3} result="noise">
                <animate attributeName="baseFrequency" values="0.03 0.055;0.05 0.04;0.035 0.07;0.025 0.05;0.03 0.055" dur="3.5s" repeatCount="indefinite" />
              </feTurbulence>
              <feDisplacementMap in="SourceGraphic" in2="noise" scale={12} xChannelSelector="R" yChannelSelector="G" />
            </filter>
            <filter id={blurId} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation={8} />
            </filter>
            <mask id={maskId} maskUnits="userSpaceOnUse" x="-200" y="-200" width="600" height="600">
              <circle ref={circleRef} cx="0" cy="0" r="0" fill="white" filter={`url(#${blurId})`} visibility="hidden" />
            </mask>
          </defs>
        </svg>
      )}

      {isCorrosion && (
        <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 0, filter: `url(#${filterId})` }}>
          <div style={{ position: 'absolute', inset: 0, WebkitMask: `url(#${maskId})`, mask: `url(#${maskId})` }}>
            <div style={{ position: 'absolute', inset: '-0.73px', borderRadius: isMd ? '10.73px' : '8.73px', filter: 'blur(7.273px)', backgroundImage: HOVER_GLOW_GRADIENT }} />
          </div>
        </div>
      )}

      {variant === 'default' && (
        <div aria-hidden className="absolute inset-0 pointer-events-none rounded-[inherit]" style={{ boxShadow: isDisabled ? SHADOW_INNER_DISABLED : SHADOW_INNER }} />
      )}

      {outlineStrokeColor && (
        <div aria-hidden className="absolute inset-0 pointer-events-none rounded-[inherit]" style={{ boxShadow: `inset 0 0 0 1px ${outlineStrokeColor}`, opacity: isHovered ? 0 : 1, transition: 'opacity 200ms' }} />
      )}

      {isSubtle && (
        <div aria-hidden className="absolute inset-0 pointer-events-none rounded-[inherit]" style={{ backgroundColor: isHovered ? variant === 'ghost' ? 'var(--button-ghost-bg-hover)' : 'var(--button-outline-bg-hover)' : 'transparent', transition: 'background-color 200ms' }} />
      )}

      {isSecondary && (
        <div aria-hidden className="absolute inset-0 pointer-events-none rounded-[inherit]" style={{ backgroundColor: isHovered && !isDisabled ? 'var(--button-secondary-bg-hover)' : 'transparent', transition: 'background-color 200ms' }} />
      )}

      {(image || leftIcon) && (
        <div className="relative shrink-0 size-[16px] flex items-center justify-center overflow-hidden" style={{ color: textColor[variant], filter: iconFilter, pointerEvents: 'none', opacity: loading ? 0 : 1 }}>
          {image
            ? <img alt="" src={image} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: '50%' }} />
            : leftIcon}
        </div>
      )}

      <span className="relative flex items-center justify-center px-[2px] shrink-0 whitespace-nowrap" style={{ fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-body)', lineHeight: 'var(--line-height-body)', color: textColor[variant], textShadow: textShadow, opacity: loading ? 0 : 1 }}>
        {children}
      </span>

      {rightIcon && (
        <div className="relative shrink-0 size-[16px] flex items-center justify-center" style={{ color: textColor[variant], filter: iconFilter, pointerEvents: 'none', opacity: loading ? 0 : 1 }}>
          {rightIcon}
        </div>
      )}

      {loading && (
        <div aria-hidden className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <ButtonSpinner color={spinnerColor[variant]} />
        </div>
      )}

      {isSubtle && (
        <div aria-hidden className="absolute inset-0 pointer-events-none rounded-[inherit]" style={{ boxShadow: isHovered ? SHADOW_SUBTLE_INNER_HOVER : undefined, transition: 'box-shadow 200ms' }} />
      )}

      {isSecondary && (
        <div aria-hidden className="absolute inset-0 pointer-events-none rounded-[inherit]" style={{ boxShadow: isHovered && !isDisabled ? SHADOW_SECONDARY_INNER_HOVER : SHADOW_SECONDARY_INNER, transition: 'box-shadow 150ms' }} />
      )}

    </Comp>
    </motion.span>
  )
})

Button.displayName = 'Button'

export default Button
