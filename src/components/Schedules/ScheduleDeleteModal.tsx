'use client'

import React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScheduleDeleteModalProps {
  isOpen:       boolean
  scheduleName: string
  onConfirm:    () => void
  onClose:      () => void
  /** True while the delete request is in flight — keeps the modal open with
   *  a spinner on "Delete schedule" instead of it vanishing mid-request. */
  deleting?:    boolean
}

// ── ScheduleDeleteModal ───────────────────────────────────────────────────────

export function ScheduleDeleteModal({
  isOpen,
  scheduleName,
  onConfirm,
  onClose,
  deleting = false,
}: ScheduleDeleteModalProps) {
  // Radix shell: focus stays inside; Esc / overlay click close it unless a delete is in flight.
  return (
    <Dialog open={isOpen} onOpenChange={(next) => { if (!next && !deleting) onClose() }}>
      <DialogContent
        hideClose
        role="alertdialog"
        aria-modal="true"
        aria-busy={deleting}
        onEscapeKeyDown={(e) => { if (deleting) e.preventDefault() }}
        onInteractOutside={(e) => { if (deleting) e.preventDefault() }}
        style={{
          padding:   28,
          width:     440,
          maxWidth:  'calc(100vw - 48px)',
          gap:       16,
          boxShadow: '0 8px 40px color-mix(in srgb, var(--static-black) 12%, transparent)',
        }}
      >
        {/* Header */}
        <DialogPrimitive.Title asChild>
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-body-lg)',
            fontWeight: 'var(--font-weight-semibold)',
            lineHeight: 'var(--line-height-body-lg)',
            color:      'var(--neutral-900)',
          }}>
            Delete &quot;{scheduleName}&quot;?
          </span>
        </DialogPrimitive.Title>

        {/* Body */}
        <DialogPrimitive.Description asChild>
          <p style={{
            margin:     0,
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-body)',
            lineHeight: 'var(--line-height-body)',
            color:      'var(--neutral-600)',
          }}>
            This will permanently remove the schedule and all its run history.
          </p>
        </DialogPrimitive.Description>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" loading={deleting} disabled={deleting} onClick={onConfirm}>
            Delete schedule
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

ScheduleDeleteModal.displayName = 'ScheduleDeleteModal'
