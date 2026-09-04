'use client'

import React, { useState } from 'react'
import { Button } from '@/components/Button'
import { toast } from 'sonner'

// Mirrors the hand-rolled `showCancelDialog` pattern in
// settings/(shell)/plans-and-billing/page.tsx — this codebase has no shared
// Modal/Dialog primitive, every confirm dialog is its own overlay. Pulled out
// as a real shared component here since multiple new "leave" flows need the
// exact same simple confirm/cancel shape.
const SHADOW_MODAL = '0px 19px 32px 0px rgba(18,12,8,0.15), 0px 2px 2.8px 0px rgba(130,122,116,0.1)'

export interface ConfirmModalProps {
  title: string
  description: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** @default true — most callers of this component are destructive/leave flows. */
  danger?: boolean
  /** Throw (or reject) to keep the modal open and show the error as a toast. */
  onConfirm: () => Promise<void>
  onClose: () => void
}

export function ConfirmModal({
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = true,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const [submitting, setSubmitting] = useState(false)

  const handleConfirm = async () => {
    setSubmitting(true)
    try {
      await onConfirm()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      onClick={() => { if (!submitting) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.28)',
        backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--neutral-white, #fff)', borderRadius: 16, padding: 24, width: 400, maxWidth: 'calc(100vw - 32px)',
          boxShadow: SHADOW_MODAL, display: 'flex', flexDirection: 'column', gap: 20,
        }}
      >
        <div>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 16, lineHeight: '24px', color: 'var(--neutral-900)', margin: 0 }}>
            {title}
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: '8px 0 0' }}>
            {description}
          </p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="secondary" disabled={submitting} onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'default'} loading={submitting} onClick={() => { void handleConfirm() }}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmModal
