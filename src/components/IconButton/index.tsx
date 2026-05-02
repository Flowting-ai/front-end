'use client'

import React, { useRef, useId, useState } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { PlusSignIcon } from '@strange-huge/icons'
import { useCorrosion } from '@/lib/useCorrosion'
import { useSquircle } from '@/lib/useSquircle'

// ── Shadows — all reference semantic CSS variables ────────────────────────────

const SHADOW_OUTER                    = 'var(--shadow-button-default-outer)'
const SHADOW_INNER                    = 'var(--shadow-button-default-inner)'
const SHADOW_INNER_DISABLED           = 'var(--shadow-button-default-inner-disabled)'
const SHADOW_ICON_EMBOSS              = 'var(--shadow-button-default-icon-emboss)'
const SHADOW_ICON_EMBOSS_DISABLED     = 'var(--shadow-button-default-icon-emboss-disabled)'
const SHADOW_SUBTLE_OUTER_HOVER       = 'var(--shadow-button-subtle-outer-hover)'
const SHADOW_SUBTLE_INNER_HOVER       = 'var(--shadow-button-subtle-inner-hover)'
const SHADOW_SECONDARY_OUTER          = 'var(--shadow-button-secondary-outer)'
const SHADOW_SECONDARY_OUTER_HOVER    = 'var(--shadow-button-secondary-outer-hover)'
const SHADOW_SECONDARY_INNER          = 'var(--shadow-button-secondary-inner)'
const SHADOW_SECONDARY_INNER_HOVER    = 'var(--shadow-button-secondary-inner-hover)'

const HOVER_GLOW_GRADIENT = 'linear-gradient(180deg, rgb(221,221,221) 0%, rgb(143,116,39) 21.635%, rgb(104,61,27) 36.058%, rgb(39,13,42) 63.462%, rgb(11,53,127) 82.212%, rgb(13,110,178) 97.115%)'

// ── Types ─────────────────────────────────────────────────────────────────────

export type IconButtonVariant = 'default' | 'ghost' | 'outline' | 'ghost-2' | 'secondary'
export type IconButtonSize = 'md' | 'sm' | 'xs' // md = 36px, sm = 32px, xs = 24px

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant
  size?: IconButtonSize
  asChild?: boolean
  icon?: React.ReactNode
  /** Show a loading spinner in place of the icon. Disables the button and sets aria-busy. */
  loading?: boolean
}

// ── Loading spinner ───────────────────────────────────────────────────────────

function IconButtonSpinner({ color, size: px = 24 }: { color: string; size?: number }) {
  return (
    <motion.svg
      width={px}
      height={px}
      viewBox="0 0 20 20"
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
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.25" />
      <path d="M 10 3 A 7 7 0 0 1 17 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </motion.svg>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({
  variant = 'default',
  size = 'md',
  asChild = false,
  icon,
  loading = false,
  disabled = false,
  className,
  onMouseEnter: externalMouseEnter,
  onMouseLeave: externalMouseLeave,
  onFocus: externalFocus,
  onBlur: externalBlur,
  ...props
}, forwardedRef) {
  const Comp = asChild ? Slot : 'button'
  const isMd = size === 'md'
  const isXs = size === 'xs'
  const isDisabled = disabled || loading
  const isCorrosion  = variant === 'default'   && !isDisabled
  const isSubtle     = (variant === 'ghost' || variant === 'outline') && !isDisabled
  const isGhost2     = variant === 'ghost-2'   && !isDisabled
  const isSecondary  = variant === 'secondary'

  const iconSizePx = isXs ? 18 : 20
  const defaultIcon = isXs ? <PlusSignIcon size={18} /> : <PlusSignIcon size={20} />
  const resolvedIcon = icon ?? defaultIcon

  const [isHovered, setIsHovered] = useState(false)
  const [isFocused, setIsFocused] = useState(false)

  // ── Squircle corner smoothing ────────────────────────────────────────────────
  const cornerRadius = isMd ? 10 : isXs ? 6 : 8
  const { ref: squircleRef, clipPath, strokeClipPath } = useSquircle(cornerRadius, 0.6, 1)

  const mergedRef = (node: HTMLButtonElement | null) => {
    ;(squircleRef as React.MutableRefObject<HTMLButtonElement | null>).current = node
    if (typeof forwardedRef === 'function') forwardedRef(node)
    else if (forwardedRef) forwardedRef.current = node
  }

  // ── Corrosion effect ────────────────────────────────────────────────────────
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

  // ── Base ────────────────────────────────────────────────────────────────────
  const baseClasses = cn(
    'group relative flex items-center justify-center overflow-hidden',
    'select-none cursor-[inherit] focus:outline-none',
    isMd ? 'rounded-[10px]' : isXs ? 'rounded-[6px]' : 'rounded-[8px]',
    variant === 'default'
      ? isMd ? 'pt-[7px] pb-[9px] px-[8px]' : 'pt-[5px] pb-[7px] px-[6px]'
      : isXs ? 'p-[3px]'
      : isMd ? 'p-[8px]' : 'p-[6px]',
  )

  const variantClasses: Record<IconButtonVariant, string> = {
    default:    cn(isDisabled && 'opacity-70'),
    ghost:      cn(isDisabled && 'opacity-70'),
    outline:    cn(isDisabled && 'opacity-70'),
    'ghost-2':  cn(isDisabled && 'opacity-70'),
    secondary:  cn(isDisabled && 'opacity-70'),
  }

  // ── Icon color + filter ─────────────────────────────────────────────────────
  const iconColor: Record<IconButtonVariant, string> = {
    default:   isDisabled ? 'var(--icon-button-default-icon-disabled)'   : 'var(--icon-button-default-icon)',
    ghost:     isDisabled ? 'var(--icon-button-ghost-icon-disabled)'     : 'var(--icon-button-ghost-icon)',
    outline:   isDisabled ? 'var(--icon-button-outline-icon-disabled)'   : 'var(--icon-button-outline-icon)',
    'ghost-2': isDisabled ? 'var(--icon-button-ghost-2-icon-disabled)'   : 'var(--icon-button-ghost-2-icon)',
    secondary: isDisabled ? 'var(--icon-button-secondary-icon-disabled)' : 'var(--icon-button-secondary-icon)',
  }

  const spinnerColor: Record<IconButtonVariant, string> = {
    default:   'var(--icon-button-default-icon)',
    ghost:     'var(--icon-button-ghost-icon)',
    outline:   'var(--icon-button-outline-icon)',
    'ghost-2': 'var(--icon-button-ghost-2-icon)',
    secondary: 'var(--icon-button-secondary-icon)',
  }

  const subtleBgHover: Record<IconButtonVariant, string> = {
    default:   '',
    ghost:     'var(--icon-button-ghost-bg-hover)',
    outline:   'var(--icon-button-outline-bg-hover)',
    'ghost-2': 'var(--icon-button-ghost-2-bg-hover)',
    secondary: 'var(--icon-button-secondary-bg-hover)',
  }

  const iconFilter = variant === 'default'
    ? isDisabled ? SHADOW_ICON_EMBOSS_DISABLED : SHADOW_ICON_EMBOSS
    : undefined

  // ── Background + squircle clip ───────────────────────────────────────────────
  const bgStyle: React.CSSProperties = {
    ...(clipPath && !isSecondary ? { clipPath } : {}),
    ...(variant === 'default'
      ? {
          backgroundImage: isDisabled
            ? isMd
              ? `linear-gradient(180deg, var(--icon-button-default-bg-disabled-from) 0%, var(--icon-button-default-bg-disabled-to) 100%)`
              : undefined
            : `linear-gradient(180deg, var(--icon-button-default-bg-from) 0%, var(--icon-button-default-bg-to) 100%)`,
          backgroundColor: isDisabled && !isMd ? 'var(--icon-button-default-bg-disabled-to)' : undefined,
        }
      : {}),
    ...(isSecondary ? {
      backgroundColor: 'var(--neutral-white)',
      boxShadow:       isHovered && !isDisabled ? SHADOW_SECONDARY_OUTER_HOVER : SHADOW_SECONDARY_OUTER,
      transition:      'box-shadow 150ms',
    } : {}),
  }

  // ── Stroke ───────────────────────────────────────────────────────────────────
  const defaultStrokeColor = variant === 'default'
    ? (isDisabled ? 'var(--icon-button-default-border-disabled)' : 'var(--icon-button-default-border)')
    : null
  const outlineStrokeColor = variant === 'outline'
    ? (isDisabled ? 'var(--icon-button-outline-border-disabled)' : 'var(--icon-button-outline-border)')
    : null

  const wrapperFilter = variant === 'default'
    ? SHADOW_OUTER
    : isSubtle && isHovered
      ? SHADOW_SUBTLE_OUTER_HOVER
      : undefined

  return (
    <motion.span
      tabIndex={-1}
      whileTap={isDisabled ? undefined : { scale: 0.96 }}
      transition={{ duration: 0.1, ease: 'easeOut' }}
      style={{
        position: 'relative',
        display: 'inline-flex',
        verticalAlign: 'top',
        filter: wrapperFilter,
        borderRadius: isMd ? '10px' : isXs ? '6px' : '8px',
        outlineStyle: 'solid',
        outlineWidth: '2px',
        outlineOffset: '3px',
        outlineColor: isFocused ? 'var(--focus-ring)' : 'transparent',
        transition: 'filter 200ms, outline-color 150ms',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
      }}
    >
      {defaultStrokeColor && strokeClipPath && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: -1,
            clipPath: strokeClipPath,
            backgroundColor: defaultStrokeColor,
            pointerEvents: 'none',
          }}
        />
      )}

      {isSubtle && strokeClipPath && clipPath && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: -1,
            clipPath: strokeClipPath,
            backgroundColor: isHovered ? 'var(--icon-button-subtle-border-hover)' : 'transparent',
            pointerEvents: 'none',
            transition: 'background-color 200ms',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 1,
              clipPath: clipPath,
              backgroundColor: isHovered ? 'var(--neutral-50)' : 'transparent',
              transition: 'background-color 200ms',
            }}
          />
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
        <svg
          aria-hidden
          style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}
        >
          <defs>
            <filter id={filterId} x="-35%" y="-35%" width="170%" height="170%" colorInterpolationFilters="sRGB">
              <feTurbulence type="fractalNoise" baseFrequency="0.035 0.06" numOctaves={3} result="noise">
                <animate
                  attributeName="baseFrequency"
                  values="0.03 0.055;0.05 0.04;0.035 0.07;0.025 0.05;0.03 0.055"
                  dur="3.5s"
                  repeatCount="indefinite"
                />
              </feTurbulence>
              <feDisplacementMap in="SourceGraphic" in2="noise" scale={12} xChannelSelector="R" yChannelSelector="G" />
            </filter>
            <filter id={blurId} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation={8} />
            </filter>
            <mask id={maskId} maskUnits="userSpaceOnUse" x="-200" y="-200" width="600" height="600">
              <circle
                ref={circleRef}
                cx="0" cy="0" r="0"
                fill="white"
                filter={`url(#${blurId})`}
                visibility="hidden"
              />
            </mask>
          </defs>
        </svg>
      )}

      {isCorrosion && (
        <div
          aria-hidden
          style={{ position: 'absolute', inset: 0, zIndex: 0, filter: `url(#${filterId})` }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              WebkitMask: `url(#${maskId})`,
              mask: `url(#${maskId})`,
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: '-0.73px',
                borderRadius: isMd ? '10.73px' : '8.73px',
                filter: 'blur(7.273px)',
                backgroundImage: HOVER_GLOW_GRADIENT,
              }}
            />
          </div>
        </div>
      )}

      {variant === 'default' && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none rounded-[inherit]"
          style={{ boxShadow: isDisabled ? SHADOW_INNER_DISABLED : SHADOW_INNER }}
        />
      )}

      {outlineStrokeColor && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none rounded-[inherit]"
          style={{
            boxShadow: `inset 0 0 0 1px ${outlineStrokeColor}`,
            opacity: isHovered ? 0 : 1,
            transition: 'opacity 200ms',
          }}
        />
      )}

      {isSubtle && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none rounded-[inherit]"
          style={{
            backgroundColor: isHovered ? subtleBgHover[variant as 'ghost' | 'outline'] : 'transparent',
            transition: 'background-color 200ms',
          }}
        />
      )}

      {isGhost2 && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none rounded-[inherit]"
          style={{
            backgroundColor: isHovered ? subtleBgHover['ghost-2'] : 'transparent',
            transition: 'background-color 200ms',
          }}
        />
      )}

      {isSecondary && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none rounded-[inherit]"
          style={{
            backgroundColor: isHovered && !isDisabled ? subtleBgHover['secondary'] : 'transparent',
            transition: 'background-color 200ms',
          }}
        />
      )}

      <div
        className="relative shrink-0 flex items-center justify-center"
        style={{
          width: iconSizePx,
          height: iconSizePx,
          color: iconColor[variant],
          filter: loading ? undefined : iconFilter,
          pointerEvents: 'none',
        }}
      >
        {loading ? <IconButtonSpinner color={spinnerColor[variant]} size={iconSizePx} /> : resolvedIcon}
      </div>

      {isSubtle && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none rounded-[inherit]"
          style={{
            boxShadow: isHovered ? SHADOW_SUBTLE_INNER_HOVER : undefined,
            transition: 'box-shadow 200ms',
          }}
        />
      )}

      {isSecondary && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none rounded-[inherit]"
          style={{
            boxShadow: isHovered && !isDisabled ? SHADOW_SECONDARY_INNER_HOVER : SHADOW_SECONDARY_INNER,
            transition: 'box-shadow 150ms',
          }}
        />
      )}

    </Comp>
    </motion.span>
  )
})

IconButton.displayName = 'IconButton'

export default IconButton
