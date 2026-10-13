'use client'

import React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { CancelOneIcon } from '@strange-huge/icons'
import { cn } from '@/lib/utils'
import styles from './dialog.module.css'

// shadcn-shaped Dialog on Radix (focus trap, Escape, focus return, aria wiring), restyled with this
// app's tokens so it matches ConfirmModal's surface (white card, 16px radius, same shadow, same overlay).
// There was no shared dialog primitive before; ConfirmModal stays for plain confirm/cancel prompts.

const SHADOW_MODAL = '0px 19px 32px 0px rgba(18,12,8,0.15), 0px 2px 2.8px 0px rgba(130,122,116,0.1)'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

const WIDTHS = { sm: 400, md: 520, lg: 680 } as const

export interface DialogContentProps extends Omit<React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>, 'title'> {
  /** sm = confirm prompts, md = forms and sharing, lg = the file picker. */
  size?: keyof typeof WIDTHS
  /** Hide the corner close button (the footer offers Cancel/Done instead). */
  hideClose?: boolean
}

export function DialogContent({ size = 'md', hideClose = false, className, style, children, ...props }: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={styles.overlay}
        style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'var(--overlay-bg)', backdropFilter: 'blur(2px)' }}
      />
      <DialogPrimitive.Content
        className={cn(styles.content, className)}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 9999,
          width: WIDTHS[size],
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100dvh - 32px)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--neutral-white)',
          borderRadius: 16,
          boxShadow: SHADOW_MODAL,
          outline: 'none',
          overflow: 'hidden',
          ...style,
        }}
        {...props}
      >
        {children}
        {!hideClose && (
          <DialogPrimitive.Close
            aria-label="Close"
            style={{
              position: 'absolute', top: 14, right: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, border: 'none', background: 'transparent', borderRadius: 8, cursor: 'pointer',
              color: 'var(--neutral-500)',
            }}
          >
            <CancelOneIcon size={14} />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export function DialogHeader({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '24px 24px 0', paddingRight: 56 }} {...props}>
      {children}
    </div>
  )
}

export function DialogTitle({ children, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      style={{ margin: 0, fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 16, lineHeight: '24px', color: 'var(--neutral-900)' }}
      {...props}
    >
      {children}
    </DialogPrimitive.Title>
  )
}

export function DialogDescription({ children, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      style={{ margin: 0, fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)' }}
      {...props}
    >
      {children}
    </DialogPrimitive.Description>
  )
}

export function DialogBody({ children, className, style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={className} style={{ padding: '16px 24px', overflowY: 'auto', minHeight: 0, ...style }} {...props}>
      {children}
    </div>
  )
}

export function DialogFooter({ children, className, style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={className}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '0 24px 24px', ...style }}
      {...props}
    >
      {children}
    </div>
  )
}
