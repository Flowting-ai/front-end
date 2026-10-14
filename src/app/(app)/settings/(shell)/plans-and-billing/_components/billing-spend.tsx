'use client'

// Spend-limit card, its modal and the small input and modal shells they use. Part of plans-and-billing/page.tsx.

import React, { useId, useState } from 'react'
import { toast } from 'sonner'
import { CancelOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/ui/button'
import {
  SHADOW_MODAL,
  SHADOW_INPUT,
  fmtUsd,
  Badge,
  SectionCard,
} from './billing-primitives'
import { PermToggle } from './billing-widgets'

export function ModalShell({
  title,
  subtitle,
  maxWidth,
  onClose,
  children,
  footer,
  footerNote,
}: {
  title:       string
  subtitle:    string
  maxWidth:    number
  onClose:     () => void
  children:    React.ReactNode
  footer:      React.ReactNode
  footerNote:  string
}) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'var(--overlay-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div style={{ background: 'var(--neutral-50)', borderRadius: 20, padding: 8, boxShadow: SHADOW_MODAL, width: '100%', maxWidth, maxHeight: 'calc(100dvh - 48px)', overflow: 'auto' }} className="kaya-scrollbar">
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Header */}
          <div style={{ borderBottom: '1px solid var(--neutral-100)', padding: '0 12px 24px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <p style={{ flex: '1 0 0', fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>{title}</p>
            <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, display: 'flex', color: 'var(--neutral-700)' }}>
              <CancelOneIcon size={20} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Subtitle */}
            <div style={{ padding: '0 12px 24px' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>{subtitle}</p>
            </div>
            {children}
            {/* Footer */}
            <div style={{ padding: '24px 0 12px', display: 'flex', flexDirection: 'column', gap: 9 }}>
              {footer}
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>{footerNote}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function InputField({
  label,
  value,
  onChange,
  prefix,
  placeholder,
}: {
  label:        string
  value:        string
  onChange:     (v: string) => void
  prefix?:      string
  placeholder?: string
}) {
  // `label` was a plain <p>, visually adjacent to the <input> but never
  // programmatically associated with it (control-has-associated-label) —
  // `htmlFor` doesn't apply to a non-<label> element, so the fix is an
  // id/aria-labelledby pairing instead, with zero visual change.
  const labelId = useId()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
      <p id={labelId} style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-700)', margin: 0 }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--field-surface)', borderRadius: 10, padding: '7px 10px', boxShadow: SHADOW_INPUT }}>
        {prefix && <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-600)', padding: '0 2px' }}>{prefix}</span>}
        <input
          aria-labelledby={labelId}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ flex: '1 0 0', minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', padding: '0 2px' }}
        />
      </div>
    </div>
  )
}

// Enterprise spending budgets include markup; null means unlimited.

export function SpendLimitCard({
  overageCapUsd,
  overage,
  overageUsedPct,
  isAdmin,
  onEdit,
  onRequest,
}: {
  overageCapUsd:  number | null
  overage:        number
  overageUsedPct: number
  isAdmin:        boolean
  onEdit:         () => void
  onRequest:      () => void
}) {
  const unlimited = overageCapUsd == null
  return (
    <SectionCard
      title="Monthly spending budget"
      subtitle="A monthly spending budget before tax. New work pauses at the limit; work in progress may finish."
      action={
        isAdmin
          ? <Button variant="secondary" onClick={onEdit}>Edit limit</Button>
          : <Button variant="secondary" onClick={onRequest}>Request change</Button>
      }
    >
      {unlimited ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: '1 0 0', minWidth: 0 }}>
            <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
              Unlimited
            </p>
          </div>
          <Badge label="No cap" tone="neutral" />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
            <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
              {fmtUsd(overageCapUsd ?? 0)}
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
              USD / month budget
            </p>
          </div>
          <div style={{ position: 'relative', height: 4, borderRadius: 2, background: 'var(--neutral-100)', width: '100%' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, height: 4, borderRadius: 2, background: overageUsedPct >= 100 ? 'var(--red-700)' : 'var(--neutral-900)', width: `${overageUsedPct}%`, transition: 'width 0.3s ease' }} />
          </div>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
            {fmtUsd(overage)} of {fmtUsd(overageCapUsd ?? 0)} used · {Math.round(overageUsedPct)}% of budget
          </p>
        </div>
      )}
    </SectionCard>
  )
}

export function SpendCapModal({
  currentCapUsd,
  saving,
  onSave,
  onClose,
}: {
  currentCapUsd: number | null
  saving:        boolean
  onSave:        (valueUsd: number | null) => void
  onClose:       () => void
}) {
  const [unlimited, setUnlimited] = useState(currentCapUsd == null)
  const [value,     setValue]     = useState(
    currentCapUsd != null ? String(currentCapUsd) : '',
  )

  const parsedUsd = parseFloat(value)
  const valid  = unlimited || (Number.isFinite(parsedUsd) && parsedUsd >= 0)

  const handleSave = () => {
    if (!valid) { toast.error('Enter a valid amount.'); return }
    onSave(unlimited ? null : parsedUsd)
  }

  return (
    <ModalShell
      title="Monthly spending budget"
      subtitle="Set a monthly budget in USD, including the usage markup and excluding tax."
      maxWidth={560}
      onClose={onClose}
      footer={
        <Button variant="default" fluid onClick={handleSave} loading={saving} disabled={!valid}>
          Save limit
        </Button>
      }
      footerNote="New work pauses when the budget is reached. Work already running can finish and is billed."
    >
      <div style={{ border: '1px solid var(--border-default)', borderRadius: 16, padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: '1 0 0', minWidth: 0 }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
              No limit
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
              Allow unlimited usage at 1.15 × service cost.
            </p>
          </div>
          <PermToggle checked={unlimited} onChange={() => setUnlimited(u => !u)} />
        </div>
        {!unlimited && (
          <InputField label="Monthly budget (USD)" value={value} onChange={setValue} placeholder="e.g. 500" />
        )}
      </div>
    </ModalShell>
  )
}

