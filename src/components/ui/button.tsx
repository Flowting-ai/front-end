'use client'

import React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { PlusSignIcon } from '@strange-huge/icons'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/Tooltip'
import { Button as LegacyButton, type ButtonProps as LegacyButtonProps } from '@/components/Button'
import { IconButton as LegacyIconButton, type IconButtonProps as LegacyIconButtonProps } from '@/components/IconButton'

// Flat (2D) shadcn-style PRIMARY button: rounded-lg, solid fill with the secondary button's shadow, no gradient. Pure CSS.
// Only the primary ("default" variant: black in light mode, light in dark mode) uses it. Every other
// variant (ghost, outline, secondary, danger) still renders the legacy `@/components/Button` /
// `@/components/IconButton`, so existing call sites keep one import path and behave as before.

// ── Shared pieces ─────────────────────────────────────────────────────────────

const BASE =
  'group/button relative inline-flex shrink-0 items-center justify-center whitespace-nowrap select-none ' +
  'rounded-lg border border-transparent font-[family-name:var(--font-body)] font-[var(--font-weight-medium)] ' +
  'text-[length:var(--font-size-body)] leading-[var(--line-height-body)] ' +
  'transition-[background-color,border-color,transform,opacity] duration-150 ' +
  'cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[var(--focus-ring)] ' +
  'active:scale-[0.98] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-70 ' +
  'aria-busy:cursor-progress [&_svg]:pointer-events-none [&_svg]:shrink-0'

// A flat hover colour layered over the base fill (so a translucent token still shows it). Set `[--hv:<token>]` per variant.
const HOVER_LAYER =
  'hover:[background-image:linear-gradient(var(--hv),var(--hv))] data-[active=true]:[background-image:linear-gradient(var(--hv),var(--hv))]'

const PRIMARY_FLAT =
  'bg-[var(--button-default-bg-to)] hover:bg-[var(--button-default-bg-from)] data-[active=true]:bg-[var(--button-default-bg-from)] ' +
  'disabled:bg-[var(--button-default-bg-disabled-to)] ' +
  'text-[var(--button-default-text)] disabled:text-[var(--button-default-text-disabled)] ' +
  // Same outer shadow as the secondary button (no inner highlight).
  'shadow-[var(--shadow-button-secondary-outer)] ' +
  'hover:shadow-[var(--shadow-button-secondary-outer-hover)] ' +
  'data-[active=true]:shadow-[var(--shadow-button-secondary-outer-hover)]'

export const buttonVariants = cva(BASE, {
  variants: {
    variant: {
      default: PRIMARY_FLAT,
      ghost: cn(
        'bg-[var(--field-surface)] text-[var(--button-ghost-text)] disabled:text-[var(--button-ghost-text-disabled)]',
        HOVER_LAYER,
        '[--hv:var(--button-ghost-bg-hover)]',
        'hover:border-[var(--button-subtle-border-hover)] data-[active=true]:border-[var(--button-subtle-border-hover)]',
      ),
      outline: cn(
        'bg-[var(--field-surface)] border-[var(--button-outline-border)] disabled:border-[var(--button-outline-border-disabled)]',
        'text-[var(--button-outline-text)] disabled:text-[var(--button-outline-text-disabled)]',
        HOVER_LAYER,
        '[--hv:var(--button-outline-bg-hover)]',
        'hover:border-[var(--button-subtle-border-hover)] data-[active=true]:border-[var(--button-subtle-border-hover)]',
      ),
      secondary: cn(
        'bg-[var(--button-secondary-bg)] border-[var(--button-outline-border)] text-[var(--button-secondary-text)] disabled:text-[var(--button-secondary-text-disabled)]',
        HOVER_LAYER,
        '[--hv:var(--button-secondary-bg-hover)]',
      ),
      danger: cn(
        'bg-[var(--button-danger-bg)] text-[var(--button-danger-text)] disabled:text-[var(--button-danger-text-disabled)]',
        'hover:bg-[var(--button-danger-bg-hover)]',
        'data-[active=true]:bg-[var(--button-danger-bg-hover)]',
      ),
      // New (not in the legacy Button): text-only action.
      link: 'text-[var(--button-ghost-text)] underline-offset-4 hover:underline rounded-none',
    },
    size: {
      // Minimum heights match the legacy Button (md = 36px, sm = 32px = padding + 22px line height).
      md: 'min-h-9 gap-0.5 px-2.5',
      sm: 'min-h-8 gap-0.5 px-2',
      // New sizes.
      xs: 'min-h-6 gap-0.5 px-1.5 text-xs',
      lg: 'min-h-10 gap-1 px-3',
    },
  },
  defaultVariants: { variant: 'default', size: 'md' },
})

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden className="animate-spin">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.25" />
      <path d="M 8 2.5 A 5.5 5.5 0 0 1 13.5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function MaybeTip({ title, children }: { title?: string; children: React.ReactElement }) {
  return title ? <Tooltip content={title}>{children}</Tooltip> : children
}

// ── Button ────────────────────────────────────────────────────────────────────

interface FlatButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default'
  size?: 'md' | 'sm' | 'xs' | 'lg'
  asChild?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  /** Size (px) of the leftIcon/rightIcon slot. Defaults to 16. */
  iconSize?: number
  /** Round avatar-style image shown in place of the left icon. */
  image?: string
  /** Shows a spinner, disables the button and sets aria-busy. */
  loading?: boolean
  /** Fill the container width. */
  fluid?: boolean
  /** Forces the hover look. Use for toggle buttons to show the selected state. */
  active?: boolean
}

function FlatButton({
  ref,
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
  type,
  title,
  className,
  children,
  ...props
}: FlatButtonProps & { ref?: React.Ref<HTMLButtonElement> }) {
  const Comp = asChild ? Slot : 'button'
  const hide = loading ? 'opacity-0' : undefined

  // With asChild the caller's element is the button, so only its children are decorated when it is a single element.
  const content = (
    <>
      {(image || leftIcon) && (
        <span className={cn('relative flex shrink-0 items-center justify-center', hide)} style={{ width: iconSize, height: iconSize }}>
          {image ? <img alt="" src={image} className="size-full rounded-full object-cover" /> : leftIcon}
        </span>
      )}
      {children != null && <span className={cn('px-0.5', hide)}>{children}</span>}
      {rightIcon && (
        <span className={cn('relative flex shrink-0 items-center justify-center', hide)} style={{ width: iconSize, height: iconSize }}>
          {rightIcon}
        </span>
      )}
      {loading && (
        <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Spinner />
        </span>
      )}
    </>
  )

  return (
    <MaybeTip title={title}>
      <Comp
        ref={ref}
        data-slot="button"
        data-active={active || undefined}
        type={asChild ? type : (type ?? 'button')}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(buttonVariants({ variant, size }), fluid && 'w-full flex-1', className)}
        {...props}
      >
        {asChild ? children : content}
      </Comp>
    </MaybeTip>
  )
}

// ── IconButton ────────────────────────────────────────────────────────────────

/** An icon-only button has no visible label, so an accessible name is mandatory. */
type IconButtonAccessibleName =
  | { 'aria-label': string; 'aria-labelledby'?: string }
  | { 'aria-label'?: string; 'aria-labelledby': string }

type FlatIconButtonProps =
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'aria-labelledby'>
  & IconButtonAccessibleName
  & {
    variant?: 'default'
    size?: 'md' | 'sm' | 'xs'
    asChild?: boolean
    icon?: React.ReactNode
    /** Show a spinner in place of the icon. Disables the button and sets aria-busy. */
    loading?: boolean
    /** Forces the hover look (toggle/selected state). */
    active?: boolean
  }

const iconButtonVariants = cva(BASE + ' p-0', {
  variants: {
    variant: {
      default: PRIMARY_FLAT,
      ghost: cn(
        'bg-[var(--field-surface)] text-[var(--icon-button-ghost-icon)] disabled:text-[var(--icon-button-ghost-icon-disabled)]',
        HOVER_LAYER, '[--hv:var(--icon-button-ghost-bg-hover)]',
      ),
      'ghost-2': cn(
        'bg-transparent text-[var(--icon-button-ghost-2-icon)] disabled:text-[var(--icon-button-ghost-2-icon-disabled)]',
        HOVER_LAYER, '[--hv:var(--icon-button-ghost-2-bg-hover)]',
      ),
      outline: cn(
        'bg-[var(--field-surface)] border-[var(--icon-button-outline-border)] disabled:border-[var(--icon-button-outline-border-disabled)]',
        'text-[var(--icon-button-outline-icon)] disabled:text-[var(--icon-button-outline-icon-disabled)]',
        HOVER_LAYER, '[--hv:var(--icon-button-outline-bg-hover)]',
      ),
      secondary: cn(
        'bg-[var(--icon-button-secondary-bg)] border-[var(--icon-button-outline-border)] text-[var(--icon-button-secondary-icon)] disabled:text-[var(--icon-button-secondary-icon-disabled)]',
        HOVER_LAYER, '[--hv:var(--icon-button-secondary-bg-hover)]',
      ),
    },
    size: {
      md: 'size-9',
      sm: 'size-8',
      xs: 'size-6 rounded-md',
    },
  },
  defaultVariants: { variant: 'default', size: 'md' },
})

function FlatIconButton({
  ref,
  variant = 'default',
  size = 'md',
  asChild = false,
  icon,
  loading = false,
  disabled = false,
  active = false,
  type,
  title,
  className,
  ...props
}: FlatIconButtonProps & { ref?: React.Ref<HTMLButtonElement> }) {
  const Comp = asChild ? Slot : 'button'
  const px = size === 'xs' ? 18 : 20
  const resolvedIcon = icon ?? <PlusSignIcon size={px} />

  return (
    <MaybeTip title={title}>
      <Comp
        ref={ref}
        data-slot="icon-button"
        data-active={active || undefined}
        type={asChild ? type : (type ?? 'button')}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(iconButtonVariants({ variant, size }), className)}
        {...props}
      >
        {loading ? (
          <Spinner size={px} />
        ) : (
          <span className="flex items-center justify-center" style={{ width: px, height: px }}>{resolvedIcon}</span>
        )}
      </Comp>
    </MaybeTip>
  )
}

export type { ButtonVariant, ButtonSize } from '@/components/Button'
export type { IconButtonVariant, IconButtonSize } from '@/components/IconButton'
export type ButtonProps = LegacyButtonProps
export type IconButtonProps = LegacyIconButtonProps

export function Button({ ref, ...props }: ButtonProps & { ref?: React.Ref<HTMLButtonElement> }) {
  if (props.variant === undefined || props.variant === 'default') {
    return <FlatButton ref={ref} {...(props as FlatButtonProps)} />
  }
  return <LegacyButton ref={ref} {...props} />
}

export function IconButton({ ref, ...props }: IconButtonProps & { ref?: React.Ref<HTMLButtonElement> }) {
  if (props.variant === undefined || props.variant === 'default') {
    return <FlatIconButton ref={ref} {...(props as FlatIconButtonProps)} />
  }
  return <LegacyIconButton ref={ref} {...props} />
}
