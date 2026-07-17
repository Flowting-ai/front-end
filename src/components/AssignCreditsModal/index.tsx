'use client'

import React, { useEffect, useEffectEvent, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMounted } from '@/hooks/use-mounted'
import { AnimatePresence, m } from 'framer-motion'
import { CancelOneIcon, InformationCircleIcon } from '@strange-huge/icons'
import { IconButton } from '@/components/IconButton'
import { Button } from '@/components/Button'
import { formatCredits } from '@/lib/format-credits'

// ── Shared input style ────────────────────────────────────────────────────────

const INPUT_BASE: React.CSSProperties = {
  fontFamily:   'var(--font-body)',
  fontWeight:   'var(--font-weight-regular)',
  fontSize:     '14px',
  lineHeight:   '22px',
  color:        '#1a1714',
  background:   'var(--neutral-white)',
  border:       '1px solid var(--neutral-200)',
  borderRadius: '10px',
  boxShadow:    '0px 1px 1.5px 0px rgba(82,75,71,0.12)',
  outline:      'none',
  width:        '100%',
  padding:      '9px 12px',
  boxSizing:    'border-box',
}

const LABEL_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontWeight: 'var(--font-weight-medium)',
  fontSize:   '14px',
  lineHeight: '22px',
  color:      'var(--neutral-700)',
  display:    'block',
  margin:     0,
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AssignCreditsModalProps {
  open:       boolean
  memberName: string
  /** Current cap — undefined means no cap set yet. */
  currentCap?: number
  /** Org-wide credits left this billing period. Omit to skip the warning. */
  poolRemaining?: number
  onAssign: (amount: number) => void | Promise<void>
  onClose:  () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AssignCreditsModal({
  open, memberName, currentCap, poolRemaining, onAssign, onClose,
}: AssignCreditsModalProps) {
  const [draft,  setDraft]  = useState('')
  const [saving, setSaving] = useState(false)
  const mounted = useMounted()

  // Reset to a blank draft every time the modal opens for a (possibly new) member.
  useEffect(() => {
    if (open) setDraft('')
  }, [open])

  const closeOnEscape = useEffectEvent(onClose)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeOnEscape() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const hasExistingCap = currentCap != null
  const amount = parseInt(draft, 10)
  const canSubmit = draft.trim() !== '' && !isNaN(amount) && amount > 0
  const exceedsPool = poolRemaining != null && canSubmit && amount > poolRemaining

  async function handleSubmit() {
    if (!canSubmit || saving) return
    setSaving(true)
    try {
      await onAssign(amount)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <m.div
          key="assign-credits-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
          style={{
            position:        'fixed',
            inset:           0,
            zIndex:          21,
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            backgroundColor: 'rgba(26,23,20,0.4)',
            backdropFilter:  'blur(2px)',
          }}
        >
          <m.div
            key="assign-credits-modal"
            role="dialog"
            aria-modal="true"
            aria-label={hasExistingCap ? 'Add credits' : 'Set credit cap'}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1,    y: 0 }}
            exit={{    opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32, mass: 0.8 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background:    'var(--neutral-white)',
              borderRadius:  '20px',
              boxShadow:     '0px 8px 32px 0px rgba(26,23,20,0.24), 0px 0px 0px 1px rgba(59,54,50,0.12)',
              width:         '420px',
              maxWidth:      'calc(100vw - 32px)',
              display:       'flex',
              flexDirection: 'column',
              gap:           '16px',
              padding:       '20px',
            }}
          >
            {/* ── Header ── */}
            <div
              style={{
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'space-between',
                gap:            10,
                flexShrink:     0,
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-title)',
                  fontWeight: 'var(--font-weight-regular)',
                  fontSize:   '20px',
                  lineHeight: '28px',
                  color:      '#1a1714',
                  margin:     0,
                }}
              >
                {hasExistingCap ? 'Add credits' : 'Set credit cap'}
              </p>
              <IconButton variant="ghost" size="xs" icon={<CancelOneIcon />} aria-label="Close" onClick={onClose} />
            </div>

            {/* ── Body — bordered content shell, matching InviteModal/ManageRoleModal ── */}
            <div
              style={{
                display:       'flex',
                flexDirection: 'column',
                gap:           '16px',
                padding:       '16px',
                border:        '1px solid var(--neutral-200)',
                borderRadius:  14,
                flexShrink:    0,
              }}
            >
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-500)', margin: 0 }}>
                {hasExistingCap
                  ? <>Adds to <strong style={{ color: 'var(--neutral-700)' }}>{memberName}</strong>&rsquo;s current cap of {formatCredits(currentCap)} credits.</>
                  : <>Sets a new monthly credit cap for <strong style={{ color: 'var(--neutral-700)' }}>{memberName}</strong>.</>}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <label htmlFor="assign-credits-amount" style={LABEL_STYLE}>
                    {hasExistingCap ? 'Credits to add' : 'Monthly cap'}
                  </label>
                  {poolRemaining != null && (
                    <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-500)' }}>
                      {formatCredits(poolRemaining)} left in pool
                    </span>
                  )}
                </div>
                <input
                  id="assign-credits-amount"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={draft}
                  placeholder="e.g. 5000"
                  autoFocus
                  disabled={saving}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleSubmit() } }}
                  style={INPUT_BASE}
                />
                {exceedsPool && (
                  <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--color-tag-Red-text)', margin: 0 }}>
                    Exceeds the org&rsquo;s remaining pool ({formatCredits(poolRemaining)} left this period).
                  </p>
                )}
              </div>

              {/* This modal only ever adds — there's no way here to lower or
                  clear an existing cap, so make that explicit up front. */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', backgroundColor: 'var(--neutral-100)', borderRadius: 10 }}>
                <InformationCircleIcon size={16} color="var(--neutral-500)" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '18px', color: 'var(--neutral-700)', margin: 0 }}>
                  Only additions are possible here — this can&rsquo;t lower or remove an existing cap.
                </p>
              </div>
            </div>

            {/* ── Footer ── */}
            <div
              style={{
                display:        'flex',
                justifyContent: 'flex-end',
                alignItems:     'center',
                gap:            '8px',
                flexShrink:     0,
              }}
            >
              <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button variant="default" onClick={() => { void handleSubmit() }} disabled={!canSubmit} loading={saving}>
                {hasExistingCap ? 'Add credits' : 'Set cap'}
              </Button>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

export default AssignCreditsModal
