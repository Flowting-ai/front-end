'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

// Shared confirm/cancel prompt on the Radix dialog shell (focus trap, Escape,
// focus return, portal to body). Announced as an alertdialog since most callers
// are destructive/leave flows.

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
    <Dialog open onOpenChange={(next) => { if (!next && !submitting) onClose() }}>
      <DialogContent
        size="sm"
        hideClose
        role="alertdialog"
        aria-modal="true"
        onEscapeKeyDown={(e) => { if (submitting) e.preventDefault() }}
        onInteractOutside={(e) => { if (submitting) e.preventDefault() }}
        style={{ padding: 24, gap: 20 }}
      >
        <div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: '8px 0 0' }}>
            {description}
          </DialogDescription>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="secondary" disabled={submitting} onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'default'} loading={submitting} onClick={() => { void handleConfirm() }}>
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ConfirmModal
