'use client'

import React, { useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Button } from '@/components/Button'
import { Checkbox } from '@/components/Checkbox'
import { springs } from '@/lib/springs'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScheduleDeleteModalProps {
  isOpen:       boolean
  scheduleName: string
  onConfirm:    (clearHistory: boolean) => void
  onClose:      () => void
}

// ── ScheduleDeleteModal ───────────────────────────────────────────────────────

export function ScheduleDeleteModal({
  isOpen,
  scheduleName,
  onConfirm,
  onClose,
}: ScheduleDeleteModalProps) {
  const [clearHistory, setClearHistory] = useState(false)

  const handleConfirm = () => {
    onConfirm(clearHistory)
    setClearHistory(false)
  }

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
              This will permanently remove the schedule. Past run history will be preserved.
            </p>

            {/* Clear history checkbox */}
            {/* eslint-disable-next-line react-doctor/label-has-associated-control -- label wraps Checkbox (custom component); association via nesting is valid */}
            <label style={{
              display:    'flex',
              alignItems: 'center',
              gap:        8,
              cursor:     'pointer',
            }}>
              <Checkbox
                checked={clearHistory}
                onCheckedChange={v => setClearHistory(Boolean(v))}
                aria-label="Also clear run history"
              />
              <span style={{
                fontFamily: 'var(--font-body)',
                fontSize:   'var(--font-size-body)',
                lineHeight: 'var(--line-height-body)',
                color:      'var(--neutral-700)',
              }}>
                Also clear run history
              </span>
            </label>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <button
                type="button"
                onClick={handleConfirm}
                style={{
                  fontFamily:      'var(--font-body)',
                  fontSize:        'var(--font-size-body)',
                  fontWeight:      'var(--font-weight-medium)',
                  lineHeight:      'var(--line-height-body)',
                  color:           'var(--color-tag-Red-text, #c0392b)',
                  backgroundColor: 'transparent',
                  border:          '1px solid var(--color-tag-Red-bg, #fde8e8)',
                  borderRadius:    8,
                  padding:         '6px 14px',
                  cursor:          'pointer',
                  transition:      'background-color 0.12s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-tag-Red-bg, #fde8e8)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                Delete schedule
              </button>
            </div>

          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  )
}

ScheduleDeleteModal.displayName = 'ScheduleDeleteModal'
