'use client'

import React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpTwoIcon, CancelOneIcon, CheckmarkCircleTwoIcon, PlusSignIcon, TickTwoIcon } from '@strange-huge/icons'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/Tooltip'
import { Spinner } from '@/components/Spinner'

// Every Button / IconButton, styled after the shadcnspace button set:
//   12 Default ........ black; 09 Outline With Icon / 13–15 sizes share the same base (no hover lift)
//   13 / 14 / 15 ...... xs (24px, 12px text) · sm (32px) · md (36px, default) · lg (40px), shadcn padding
//   10 Save ........... drawn as the dark default button (save actions read as the primary action)
//   11 Cancel ......... red with a cross, white text
//   23 Permissions .... Approve (green tint, the tick bounces on hover) / Reject (red, the cross shakes)
//   22 Loading ........ our circular loader replaces the left icon; the label stays and the button disables
//   04 Heartbeat ...... `attention`: a pulsing ring for approvals / pending work that needs a look
//   03 Shine Hover .... `shine`: a light sweep across the button on hover (also the chat input submit)
//   02 Shiny Text ..... `shiny` (IconButton): a highlight that keeps sweeping over the icon
//   30 Multi-State .... `sendState`: idle → loading → success swap with the label and icon animating
// Ghost / secondary keep our design-system look on the same code path. Every button sets its label in
// Google Sans, and icons are sized to the button: 12 / 14 / 16 / 18px for xs / sm / md / lg
// (IconButton: 14 / 18 / 20px for xs / sm / md).

// ── Shared pieces ─────────────────────────────────────────────────────────────

const BASE =
  'group/button relative inline-flex shrink-0 items-center justify-center whitespace-nowrap select-none ' +
  'border border-transparent [font-family:var(--font-title)] font-[var(--font-weight-medium)] ' +
  'text-[length:var(--font-size-body)] leading-[var(--line-height-body)] ' +
  'transition-[background-color,border-color,box-shadow,filter,translate,scale,opacity] duration-200 ' +
  'cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[var(--focus-ring)] ' +
  'active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 ' +
  // Disabled: no hover wash, lift or press (pointer events stay on so the not-allowed cursor shows).
  'disabled:hover:[background-image:none] disabled:data-[active=true]:[background-image:none] disabled:hover:[filter:none] disabled:active:scale-100 disabled:hover:scale-100 ' +
  'aria-busy:cursor-progress [&_svg]:pointer-events-none [&_svg]:shrink-0'

// A flat hover colour layered over the base fill (so a translucent token still shows it). Set `[--hv:<token>]` per variant.
const HOVER_LAYER =
  'hover:[background-image:linear-gradient(var(--hv),var(--hv))] data-[active=true]:[background-image:linear-gradient(var(--hv),var(--hv))]'


// Solid colour buttons (danger / save / cancel / reject): white text, a slightly darker fill on hover.
// Class names are written out in full — Tailwind only generates classes it can read in the source.
const SOLID = '[box-shadow:0_1px_2px_rgba(0,0,0,0.12)]'
// The dark default button: a flat fill with the same small shadow as the solid buttons (no 3D bevel,
// ring or hover lift), so it sits at the same visual weight and size as danger / cancel.
const PRIMARY_FLAT = cn(
  SOLID,
  'bg-[var(--button-default-bg-to)] disabled:bg-[var(--button-default-bg-disabled-to)]',
  'text-[var(--button-default-text)] disabled:text-[var(--button-default-text-disabled)]',
  HOVER_LAYER,
  '[--hv:var(--button-primary-bg-hover)]',
)
// Red reads the danger text tokens (white by default), so a caller can invert it to red-on-white.
const RED = cn(SOLID, 'text-[var(--button-danger-text)] disabled:text-[var(--button-danger-text-disabled)]', 'bg-[var(--button-danger-bg)] hover:bg-[var(--button-danger-bg-hover)] data-[active=true]:bg-[var(--button-danger-bg-hover)] disabled:hover:bg-[var(--button-danger-bg)]')

export const buttonVariants = cva(BASE, {
  variants: {
    variant: {
      default: PRIMARY_FLAT,
      ghost: cn(
        'bg-[var(--field-surface)] text-[var(--button-ghost-text)] disabled:text-[var(--button-ghost-text-disabled)]',
        HOVER_LAYER,
        '[--hv:var(--button-ghost-bg-hover)]',
        'hover:border-[var(--button-subtle-border-hover)] data-[active=true]:border-[var(--button-subtle-border-hover)]',
        'disabled:hover:border-transparent',
      ),
      outline: cn(
        'bg-[var(--field-surface)] border-[var(--button-outline-border)] disabled:border-[var(--button-outline-border-disabled)]',
        'text-[var(--button-outline-text)] disabled:text-[var(--button-outline-text-disabled)]',
        HOVER_LAYER,
        '[--hv:var(--button-outline-bg-hover)]',
        'hover:border-[var(--button-subtle-border-hover)] data-[active=true]:border-[var(--button-subtle-border-hover)]',
        'disabled:hover:border-[var(--button-outline-border-disabled)]',
      ),
      // One crisp 1px edge, no drop shadow: the old near-white inner ring plus a soft 3px shadow
      // read as a double border.
      secondary: cn(
        'bg-[var(--button-secondary-bg)] text-[var(--button-secondary-text)] disabled:text-[var(--button-secondary-text-disabled)]',
        HOVER_LAYER,
        '[--hv:var(--button-secondary-bg-hover)]',
        'border-[var(--button-outline-border)] disabled:border-[var(--button-outline-border-disabled)]',
        'hover:border-[var(--button-subtle-border-hover)] data-[active=true]:border-[var(--button-subtle-border-hover)] disabled:hover:border-[var(--button-outline-border-disabled)]',
      ),
      danger: RED,
      save:   PRIMARY_FLAT,
      cancel: RED,
      reject: cn(RED, 'kaya-btn-perm hover:scale-[1.02]'),
      approve: cn(
        'bg-[var(--button-approve-bg)] text-[var(--button-approve-text)]',
        'hover:bg-[var(--button-approve-bg-hover)] data-[active=true]:bg-[var(--button-approve-bg-hover)] disabled:hover:bg-[var(--button-approve-bg)]',
        'kaya-btn-perm hover:scale-[1.02]',
      ),
      // Text-only action.
      link: 'text-[var(--button-ghost-text)] underline-offset-4 hover:underline !rounded-none',
    },
    size: {
      // Heights as before (xs 24 · sm 32 · md 36 · lg 40); side padding is shadcn's (8 · 12 · 16 · 24)
      // counting the label's own 2px.
      md: 'min-h-9 gap-1 rounded-[10px] px-3.5',
      sm: 'min-h-8 gap-1 rounded-[8px] px-2.5',
      xs: 'min-h-6 gap-0.5 rounded-[6px] px-1.5 text-xs leading-4',
      lg: 'min-h-10 gap-1.5 rounded-[10px] px-[22px]',
    },
  },
  defaultVariants: { variant: 'default', size: 'md' },
})

const ICON_PX: Record<ButtonSize, number> = { xs: 12, sm: 14, md: 16, lg: 18 }

// The icon each special variant brings when the caller passes none.
const VARIANT_ICON: Partial<Record<string, (size: number) => React.ReactNode>> = {
  cancel:  s => <CancelOneIcon size={s} />,
  approve: s => <span className="kaya-btn-approve-icon flex"><CheckmarkCircleTwoIcon size={s} /></span>,
  reject:  s => <span className="kaya-btn-reject-icon flex"><CancelOneIcon size={s} /></span>,
}

// ── Spinner ───────────────────────────────────────────────────────────────────


function MaybeTip({ title, children }: { title?: string; children: React.ReactElement }) {
  return title ? <Tooltip content={title}>{children}</Tooltip> : children
}

// ── Button ────────────────────────────────────────────────────────────────────

export type ButtonVariant = 'default' | 'ghost' | 'outline' | 'secondary' | 'danger' | 'save' | 'cancel' | 'approve' | 'reject' | 'link'
export type ButtonSize = 'md' | 'sm' | 'xs' | 'lg'
/** Button 30 - Multi-State Send. */
export type SendState = 'idle' | 'loading' | 'success'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  asChild?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  /** Size (px) of the leftIcon/rightIcon slot. Defaults by size: 12 / 14 / 16 / 18 for xs / sm / md / lg. */
  iconSize?: number
  /** Round avatar-style image shown in place of the left icon. */
  image?: string
  /** Button 22: our circular loader replaces the left icon, the label stays, and the button disables. */
  loading?: boolean
  /** Fill the container width. */
  fluid?: boolean
  /** Forces the hover look. Use for toggle buttons to show the selected state. */
  active?: boolean
  /** Button 04 - Heartbeat: a pulsing ring, for approvals or pending work that needs attention. */
  attention?: boolean
  /** Button 03 - Shine Hover: a light sweep across the button on hover. */
  shine?: boolean
  /**
   * Button 30 - Multi-State Send: drives idle → loading → success. While not idle the button is
   * disabled; the label becomes `loadingLabel` / `successLabel` and the icon a loader / tick.
   */
  sendState?: SendState
  loadingLabel?: React.ReactNode
  successLabel?: React.ReactNode
}

export function Button({
  ref,
  variant = 'default',
  size = 'md',
  asChild = false,
  leftIcon,
  rightIcon,
  iconSize,
  image,
  loading = false,
  disabled = false,
  fluid = false,
  active = false,
  attention = false,
  shine = false,
  sendState,
  loadingLabel = 'Sending…',
  successLabel = 'Sent',
  type,
  title,
  className,
  style,
  children,
  ...props
}: ButtonProps & { ref?: React.Ref<HTMLButtonElement> }) {
  const Comp = asChild ? Slot : 'button'
  const busy = loading || sendState === 'loading'
  const iconPx = iconSize ?? ICON_PX[size]
  const variantIcon = VARIANT_ICON[variant]?.(iconPx)
  const startIcon = image
    ? <img alt="" src={image} className="size-full rounded-full object-cover" />
    : leftIcon ?? variantIcon

  const slot = (node: React.ReactNode) => (
    // The icon fills its slot whatever size the caller drew it at.
    <span className="relative flex shrink-0 items-center justify-center [&_svg]:size-full" style={{ width: iconPx, height: iconPx }}>{node}</span>
  )

  const content = sendState ? (
    // Button 30: the label and icon swap per state.
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={sendState}
        initial={sendState === 'success' ? { opacity: 0, scale: 0.8 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={sendState === 'success' ? { opacity: 0, scale: 0.8 } : { opacity: 0, y: -8 }}
        transition={sendState === 'success' ? { type: 'spring', stiffness: 350, damping: 22 } : { duration: 0.2 }}
        className="flex items-center gap-1.5"
      >
        {slot(sendState === 'loading' ? <Spinner size={iconPx} /> : sendState === 'success' ? <TickTwoIcon size={iconPx} /> : (startIcon ?? <ArrowUpTwoIcon size={iconPx} />))}
        <span className="px-0.5">{sendState === 'loading' ? loadingLabel : sendState === 'success' ? successLabel : children}</span>
      </motion.span>
    </AnimatePresence>
  ) : (
    <>
      {(busy || startIcon) && slot(busy ? <Spinner size={iconPx} /> : startIcon)}
      {children != null && <span className="px-0.5">{children}</span>}
      {rightIcon && slot(rightIcon)}
    </>
  )

  return (
    <MaybeTip title={title}>
      <Comp
        ref={ref}
        data-slot="button"
        data-active={active || undefined}
        data-send-state={sendState}
        type={asChild ? type : (type ?? 'button')}
        disabled={disabled || busy || sendState === 'success'}
        aria-busy={busy || undefined}
        className={cn(
          buttonVariants({ variant, size }),
          fluid && 'w-full flex-1',
          attention && 'kaya-btn-heartbeat',
          shine && 'kaya-btn-shine overflow-hidden',
          sendState === 'success' && 'disabled:opacity-100',
          className,
        )}
        style={attention ? { ['--heartbeat-color' as string]: variant === 'default' ? 'var(--neutral-500)' : variant === 'approve' || variant === 'save' ? 'var(--button-save-bg)' : 'var(--button-danger-bg)', ...style } : style}
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

export type IconButtonProps =
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'aria-labelledby'>
  & IconButtonAccessibleName
  & {
    variant?: IconButtonVariant
    size?: IconButtonSize
    asChild?: boolean
    icon?: React.ReactNode
    /** Show a spinner in place of the icon. Disables the button and sets aria-busy. */
    loading?: boolean
    /** Forces the hover look (toggle/selected state). */
    active?: boolean
    /** Button 02 - Shiny Text: a highlight keeps sweeping over the icon. */
    shiny?: boolean
    /** Button 03 - Shine Hover: a light sweep across the button on hover (chat input submit). */
    shine?: boolean
    /** Button 04 - Heartbeat: a pulsing ring for something that needs attention. */
    attention?: boolean
    /** Size (px) of the icon box. Defaults by size: 14 / 18 / 20 for xs / sm / md. The button's own size is unchanged. */
    iconSize?: number
  }

const iconButtonVariants = cva(BASE + ' p-0', {
  variants: {
    variant: {
      default: PRIMARY_FLAT,
      // Icon-only ghost / outline sit on the page (transparent) until hovered, unlike the text ghost button.
      ghost: cn(
        'bg-transparent text-[var(--icon-button-ghost-icon)] disabled:text-[var(--icon-button-ghost-icon-disabled)]',
        HOVER_LAYER, '[--hv:var(--icon-button-ghost-bg-hover)]',
      ),
      'ghost-2': cn(
        'bg-transparent text-[var(--icon-button-ghost-2-icon)] disabled:text-[var(--icon-button-ghost-2-icon-disabled)]',
        HOVER_LAYER, '[--hv:var(--icon-button-ghost-2-bg-hover)]',
      ),
      outline: cn(
        'bg-transparent border-[var(--icon-button-outline-border)] disabled:border-[var(--icon-button-outline-border-disabled)]',
        'text-[var(--icon-button-outline-icon)] disabled:text-[var(--icon-button-outline-icon-disabled)]',
        HOVER_LAYER, '[--hv:var(--icon-button-outline-bg-hover)]',
      ),
      secondary: cn(
        'bg-[var(--icon-button-secondary-bg)] border-[var(--icon-button-outline-border)] text-[var(--icon-button-secondary-icon)] disabled:text-[var(--icon-button-secondary-icon-disabled)]',
        HOVER_LAYER, '[--hv:var(--icon-button-secondary-bg-hover)]',
      ),
    },
    size: {
      md: 'size-9 rounded-[10px]',
      sm: 'size-8 rounded-[8px]',
      xs: 'size-6 rounded-[6px]',
    },
  },
  defaultVariants: { variant: 'default', size: 'md' },
})

export function IconButton({
  ref,
  variant = 'default',
  size = 'md',
  asChild = false,
  icon,
  loading = false,
  disabled = false,
  active = false,
  shiny = false,
  shine = false,
  attention = false,
  iconSize,
  type,
  title,
  className,
  ...props
}: IconButtonProps & { ref?: React.Ref<HTMLButtonElement> }) {
  const Comp = asChild ? Slot : 'button'
  const px = iconSize ?? (size === 'xs' ? 14 : size === 'sm' ? 18 : 20)
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
        className={cn(iconButtonVariants({ variant, size }), shiny && 'kaya-btn-shiny overflow-hidden', shine && 'kaya-btn-shine overflow-hidden', attention && 'kaya-btn-heartbeat', className)}
        {...props}
      >
        {loading ? (
          <Spinner size={px} />
        ) : (
          <span className="flex items-center justify-center [&_svg]:size-full" style={{ width: px, height: px }}>{resolvedIcon}</span>
        )}
      </Comp>
    </MaybeTip>
  )
}

export type IconButtonVariant = 'default' | 'ghost' | 'outline' | 'ghost-2' | 'secondary'
export type IconButtonSize = 'md' | 'sm' | 'xs' // md = 36px, sm = 32px, xs = 24px
