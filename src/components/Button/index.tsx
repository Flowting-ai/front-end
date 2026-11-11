'use client'

import React, { useRef, useId, useState } from 'react'
import { cva } from 'class-variance-authority'
import { Slot } from '@radix-ui/react-slot'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useCorrosion } from '@/lib/useCorrosion'
import { useSquircle } from '@/lib/useSquircle'
import { Tooltip } from '@/components/Tooltip'

// ── Shadows ────────────────────────────────────────────────────────────────────

const SHADOW_OUTER                    = 'var(--shadow-button-default-outer)'
const SHADOW_INNER                = 'var(--shadow-button-default-inner)'
const SHADOW_INNER_DISABLED       = 'var(--shadow-button-default-inner-disabled)'
const SHADOW_ICON_EMBOSS          = 'var(--shadow-button-default-icon-emboss)'
const SHADOW_ICON_EMBOSS_DISABLED = 'var(--shadow-button-default-icon-emboss-disabled)'
const SHADOW_TEXT                 = 'var(--shadow-button-default-text)'
const SHADOW_TEXT_DISABLED        = 'var(--shadow-button-default-text-disabled)'

// Theme token: black/yellow/blue tints in light, pink tints in dark.
const HOVER_GLOW_GRADIENT = 'var(--button-default-hover-glow)'

// ── Variants (cva) ──────────────────────────────────────────────────────────────
// Hover visuals are pure CSS: the outer wrapper is the `group/kbtn`, and each layer
// reacts with `group-hover/kbtn:` classes instead of a JS isHovered state. Class
// strings stay literal so Tailwind can see them.

const buttonVariants = cva(
  'group relative flex items-center justify-center gap-[2px] overflow-hidden select-none cursor-[inherit] focus:outline-none',
  {
    variants: {
      variant:  { default: '', ghost: '', outline: '', secondary: '', danger: '' },
      size:     { md: 'rounded-[10px] pt-[6px] pb-[8px] px-[10px]', sm: 'rounded-[8px]' },
      disabled: { true: 'opacity-70', false: '' },
      fluid:    { true: 'w-full', false: '' },
    },
    compoundVariants: [
      { size: 'sm', variant: 'default', className: 'pt-[4px] pb-[6px] px-[8px]' },
      { size: 'sm', variant: ['ghost', 'outline', 'secondary', 'danger'], className: 'py-[5px] px-[8px]' },
      // Secondary: white fill + box-shadow (no squircle clip); hover deepens the shadow.
      { variant: 'secondary', disabled: false, className: '[box-shadow:var(--shadow-button-secondary-outer)] group-hover/kbtn:[box-shadow:var(--shadow-button-secondary-outer-hover)]' },
      { variant: 'secondary', disabled: true,  className: '[box-shadow:var(--shadow-button-secondary-outer)]' },
      // Danger: flat squircle with a solid red fill; hover only changes the colour.
      { variant: 'danger', disabled: false, className: '[background-color:var(--button-danger-bg)] group-hover/kbtn:[background-color:var(--button-danger-bg-hover)]' },
      { variant: 'danger', disabled: true,  className: '[background-color:var(--button-danger-bg)]' },
    ],
  },
)

// Outer wrapper filter for ghost/outline/secondary: subtle lift on hover, or always when `active`.
const wrapperVariants = cva('group/kbtn', {
  variants: {
    lift: {
      none:   '',
      hover:  'hover:[filter:var(--shadow-button-subtle-outer-hover)]',
      always: '[filter:var(--shadow-button-subtle-outer-hover)]',
    },
  },
  defaultVariants: { lift: 'none' },
})

// ── Types ─────────────────────────────────────────────────────────────────────

export type ButtonVariant = 'default' | 'ghost' | 'outline' | 'secondary' | 'danger'
export type ButtonSize = 'md' | 'sm'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  asChild?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  /** Size (px) of the leftIcon/rightIcon slot. Defaults to 16 — only override
   *  when the passed icon itself is rendered at a larger size, otherwise it
   *  gets clipped by the slot's overflow-hidden. */
  iconSize?: number
  image?: string
  loading?: boolean
  fluid?: boolean
  /** Forces the hover visual state. Use for toggle buttons to show the selected state. */
  active?: boolean
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

function MaybeTip({ title, children }: { title?: string; children: React.ReactElement }) {
  return title ? <Tooltip content={title}>{children}</Tooltip> : children
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Button({
  ref: forwardedRef,
  variant = 'default',
  size = 'md',
  asChild = false,
  leftIcon,
  rightIcon,
  iconSize = 16,
  image,
  loading = false,
  disabled = false,
  fluid = false,
  active = false,
  children = 'Button',
  className,
  style: callerStyle,
  onMouseEnter: externalMouseEnter,
  onMouseLeave: externalMouseLeave,
  onFocus: externalFocus,
  onBlur: externalBlur,
  title,
  ...props
}: ButtonProps & { ref?: React.Ref<HTMLButtonElement> }) {
  const Comp = asChild ? Slot : 'button'
  const isMd = size === 'md'
  const isDisabled = disabled || loading
  const isCorrosion = variant === 'default' && !isDisabled
  const isSubtle    = (variant === 'ghost' || variant === 'outline') && !isDisabled
  const isSecondary = variant === 'secondary'
  const isDanger    = variant === 'danger'

  const spinnerColor: Record<ButtonVariant, string> = {
    default:   'var(--neutral-50)',
    ghost:     'var(--button-ghost-text)',
    outline:   'var(--button-outline-text)',
    secondary: 'var(--button-secondary-text)',
    danger:    'var(--button-danger-text)',
  }

  const [isFocused, setIsFocused] = useState(false)
  const isActive = active && !isDisabled

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

  // Hover visuals are CSS (group-hover). JS mouse handlers remain only for the
  // default variant's corrosion glow, which follows the pointer position and so
  // genuinely needs the event coordinates.
  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isCorrosion) corrosionEnter(e)
    externalMouseEnter?.(e)
  }

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isCorrosion) corrosionLeave(e)
    externalMouseLeave?.(e)
  }

  const textColor: Record<ButtonVariant, string> = {
    default:   isDisabled ? 'var(--button-default-text-disabled)'   : 'var(--button-default-text)',
    ghost:     isDisabled ? 'var(--button-ghost-text-disabled)'     : 'var(--button-ghost-text)',
    outline:   isDisabled ? 'var(--button-outline-text-disabled)'   : 'var(--button-outline-text)',
    secondary: isDisabled ? 'var(--button-secondary-text-disabled)' : 'var(--button-secondary-text)',
    danger:    isDisabled ? 'var(--button-danger-text-disabled)'    : 'var(--button-danger-text)',
  }

  const textShadow = variant === 'default'
    ? isDisabled ? SHADOW_TEXT_DISABLED : SHADOW_TEXT
    : undefined

  const iconFilter = variant === 'default'
    ? isDisabled ? SHADOW_ICON_EMBOSS_DISABLED : SHADOW_ICON_EMBOSS
    : undefined

  // Secondary skips the squircle clip — white bg + box-shadow applied directly. Danger is clipped like ghost.
  const bgStyle: React.CSSProperties = {
    ...(clipPath && !isSecondary ? { clipPath } : {}),
    ...(variant === 'default'
      ? {
          // Tokens, not hex: these resolve to the same #524b47 / #26211e / #3b3632 in
          // light (the primary-surface aliases point at neutral-700/800/900), and let
          // the dark theme restyle the button instead of leaving a fixed gradient.
          backgroundImage: isDisabled
            ? isMd
              ? 'linear-gradient(180deg, var(--color-interactive-primary-surface-disabled-from) 0%, var(--color-interactive-primary-surface-disabled-to) 100%)'
              : undefined
            : 'linear-gradient(180deg, var(--color-interactive-primary-surface-from) 0%, var(--color-interactive-primary-surface-to) 100%)',
          backgroundColor: isDisabled && !isMd ? 'var(--color-interactive-primary-surface-disabled-to)' : undefined,
        }
      : {}),
    // Ghost / outline sit on a solid field-coloured fill (pure white in light mode), not the page.
    ...((variant === 'outline' || variant === 'ghost') ? { backgroundColor: 'var(--field-surface)' } : {}),
    // Secondary box-shadow and danger fill (with their hover states) come from buttonVariants.
    ...(isSecondary ? {
      backgroundColor: 'var(--button-secondary-bg)',
      transition:      'box-shadow 150ms',
    } : {}),
    ...(isDanger ? { transition: 'background-color 150ms' } : {}),
  }

  const defaultStrokeColor = variant === 'default'
    ? (isDisabled ? 'var(--button-default-border-disabled)' : 'var(--button-default-border)')
    : null
  const outlineStrokeColor = variant === 'outline'
    ? (isDisabled ? 'var(--button-outline-border-disabled)' : 'var(--button-outline-border)')
    : null

  const wrapperFilter = variant === 'default'
    ? SHADOW_OUTER
    // Danger: a slight static shadow (drop-shadow, since the squircle clip would cut off a box-shadow); unchanged on hover.
    : isDanger && !isDisabled
      ? 'drop-shadow(0px 1px 1px rgb(0 0 0 / 0.08)) drop-shadow(0px 1px 3px rgb(0 0 0 / 0.08))'
      : undefined
  // Ghost/outline/secondary lift comes from wrapperVariants (CSS hover, or forced by `active`).
  const lift = (isSubtle || isSecondary) ? (isActive ? 'always' : isDisabled ? 'none' : 'hover') : 'none'

  return (
    <motion.span
      tabIndex={-1}
      className={wrapperVariants({ lift })}
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
        ...callerStyle,
      }}
    >
      {defaultStrokeColor && strokeClipPath && (
        <div aria-hidden style={{ position: 'absolute', inset: -1, clipPath: strokeClipPath, backgroundColor: defaultStrokeColor, pointerEvents: 'none' }} />
      )}

      {isSubtle && strokeClipPath && clipPath && (
        <div aria-hidden className={isActive ? 'bg-[var(--button-subtle-border-hover)]' : 'bg-transparent group-hover/kbtn:bg-[var(--button-subtle-border-hover)]'} style={{ position: 'absolute', inset: -1, clipPath: strokeClipPath, pointerEvents: 'none', transition: 'background-color 200ms' }}>
          <div className={isActive ? 'bg-[var(--neutral-50)]' : 'bg-transparent group-hover/kbtn:bg-[var(--neutral-50)]'} style={{ position: 'absolute', inset: 1, clipPath: clipPath, transition: 'background-color 200ms' }} />
        </div>
      )}

      <MaybeTip title={title}>
      <Comp
        ref={mergedRef}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={cn(buttonVariants({ variant, size, disabled: isDisabled, fluid }), className)}
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
                <circle ref={circleRef} cx="0" cy="0" r="0" fill="var(--static-white)" filter={`url(#${blurId})`} visibility="hidden" />
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
          <div aria-hidden className={cn('absolute inset-0 pointer-events-none rounded-[inherit]', !isDisabled && 'group-hover/kbtn:opacity-0')} style={{ boxShadow: `inset 0 0 0 1px ${outlineStrokeColor}`, transition: 'opacity 200ms' }} />
        )}

        {isSubtle && (
          <div aria-hidden className={cn('absolute inset-0 pointer-events-none rounded-[inherit] bg-transparent', variant === 'ghost' ? 'group-hover/kbtn:bg-[var(--button-ghost-bg-hover)]' : 'group-hover/kbtn:bg-[var(--button-outline-bg-hover)]')} style={{ transition: 'background-color 200ms' }} />
        )}

        {isSecondary && (
          <div aria-hidden className={cn('absolute inset-0 pointer-events-none rounded-[inherit] bg-transparent', !isDisabled && 'group-hover/kbtn:bg-[var(--button-secondary-bg-hover)]')} style={{ transition: 'background-color 200ms' }} />
        )}

        {(image || leftIcon) && (
          <div className="relative shrink-0 flex items-center justify-center overflow-hidden" style={{ width: iconSize, height: iconSize, color: textColor[variant], filter: iconFilter, pointerEvents: 'none', opacity: loading ? 0 : 1 }}>
            {image
              ? <img alt="" src={image} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: '50%' }} />
              : leftIcon}
          </div>
        )}

        <span className="relative flex items-center justify-center px-[2px] shrink-0 whitespace-nowrap" style={{ fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-body)', lineHeight: 'var(--line-height-body)', color: textColor[variant], textShadow: textShadow, opacity: loading ? 0 : 1 }}>
          {children}
        </span>

        {rightIcon && (
          <div className="relative shrink-0 flex items-center justify-center" style={{ width: iconSize, height: iconSize, color: textColor[variant], filter: iconFilter, pointerEvents: 'none', opacity: loading ? 0 : 1 }}>
            {rightIcon}
          </div>
        )}

        {loading && (
          <div aria-hidden className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <ButtonSpinner color={spinnerColor[variant]} />
          </div>
        )}

        {isSubtle && (
          <div aria-hidden className="absolute inset-0 pointer-events-none rounded-[inherit] group-hover/kbtn:[box-shadow:var(--shadow-button-subtle-inner-hover)]" style={{ transition: 'box-shadow 200ms' }} />
        )}

        {isSecondary && (
          <div aria-hidden className={cn('absolute inset-0 pointer-events-none rounded-[inherit] [box-shadow:var(--shadow-button-secondary-inner)]', !isDisabled && 'group-hover/kbtn:[box-shadow:var(--shadow-button-secondary-inner-hover)]')} style={{ transition: 'box-shadow 150ms' }} />
        )}


      </Comp>
      </MaybeTip>
    </motion.span>
  )
}

Button.displayName = 'Button'

export default Button
