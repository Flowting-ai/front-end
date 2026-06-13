'use client'

import React from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Button } from '@/components/Button'
import { springs } from '@/lib/springs'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScheduleDeleteModalProps {
  isOpen:       boolean
  scheduleName: string
  onConfirm:    () => void
  onClose:      () => void
}

// ── ScheduleDeleteModal ───────────────────────────────────────────────────────

export function ScheduleDeleteModal({
  isOpen,
  scheduleName,
  onConfirm,
  onClose,
}: ScheduleDeleteModalProps) {

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <m.div
          key="schedule-delete-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={springs.fast}
          onClick={onClose}
          style={{
            position:        'fixed',
            inset:           0,
            backgroundColor: 'rgba(10, 10, 10, 0.4)',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            zIndex:          20,
            padding:         24,
          }}
        >
          <m.div
            key="schedule-delete-card"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1,    y: 0 }}
            exit={{    opacity: 0, scale: 0.96, y: 8 }}
            transition={springs.fast}
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--neutral-white)',
              borderRadius:    16,
              padding:         28,
              maxWidth:        440,
              width:           '100%',
              display:         'flex',
              flexDirection:   'column',
              gap:             16,
              boxShadow:       '0 8px 40px rgba(0,0,0,0.12)',
            }}
          >
            {/* Header */}
            <span style={{
              fontFamily: 'var(--font-body)',
              fontSize:   'var(--font-size-body-lg)',
              fontWeight: 'var(--font-weight-semibold)',
              lineHeight: 'var(--line-height-body-lg)',
              color:      'var(--neutral-900)',
            }}>
              Delete "{scheduleName}"?
            </span>

            {/* Body */}
            <p style={{
              margin:     0,
              fontFamily: 'var(--font-body)',
              fontSize:   'var(--font-size-body)',
              lineHeight: 'var(--line-height-body)',
              color:      'var(--neutral-600)',
            }}>
              This will permanently remove the schedule and all its run history.
            </p>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={onConfirm}>
                Delete schedule
              </Button>
            </div>

          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  )
}

ScheduleDeleteModal.displayName = 'ScheduleDeleteModal'
