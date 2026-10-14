'use client'

// Cancel dialog, usage row, permission toggle and invoice table. Part of plans-and-billing/page.tsx.

import React from 'react'
import { Button } from '@/components/ui/button'
import { Invoice } from '@/lib/api/stripe'
import {
  fmtNum,
  SHADOW_TILE,
  SHADOW_MODAL,
  fmtUsd,
  fmtDate,
  Badge,
} from './billing-primitives'

// ── Shared cancel-subscription confirmation ──────────────────────────────────
// Decomposition pass: OrgBillingView and PersonalBillingView below each carry
// their own giant-component/high-complexity flag (this file's two flagged
// regions) precisely because each hand-rolls the same ~35-line cancel dialog
// inline, differing only in which date it displays and which local
// state/handler it closes over. Genuinely self-contained (no dependency on
// either view's other internals beyond these explicit props) — a clean
// extraction, not one that just relocates coupling elsewhere.
export function CancelSubscriptionDialog({
  open,
  periodEndLabel,
  isCanceling,
  onKeep,
  onConfirmCancel,
}: {
  open:            boolean
  periodEndLabel:  string
  isCanceling:     boolean
  onKeep:          () => void
  onConfirmCancel: () => void
}) {
  if (!open) return null
  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- backdrop click-to-dismiss; the real dialog control is the "Keep plan" button below
    <div
      onClick={() => { if (!isCanceling) onKeep() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9998, background: 'var(--overlay-bg)',
        backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- stops the backdrop's dismiss-click from firing when interacting with the card itself */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--neutral-white)', borderRadius: 16, padding: 24, width: 400, maxWidth: 'calc(100vw - 32px)',
          boxShadow: SHADOW_MODAL, display: 'flex', flexDirection: 'column', gap: 20,
        }}
      >
        <div>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 16, lineHeight: '24px', color: 'var(--neutral-900)', margin: 0 }}>
            Cancel subscription?
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: '8px 0 0' }}>
            Your plan stays active until <strong style={{ color: 'var(--neutral-900)' }}>{periodEndLabel}</strong>. After that you lose access to paid features.
          </p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="secondary" disabled={isCanceling} onClick={onKeep}>
            Keep plan
          </Button>
          <Button variant="danger" loading={isCanceling} onClick={onConfirmCancel}>
            Yes, cancel
          </Button>
        </div>
      </div>
    </div>
  )
}


export function PersonalUsageRow({ label, used, total }: { label: string; used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.max(0, (used / total) * 100)) : 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, width: '100%' }}>
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0, flex: '1 0 0', minWidth: 0 }}>
          {label}
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0, whiteSpace: 'nowrap' }}>
          {fmtNum(used)} / {fmtNum(total)}
        </p>
      </div>
      <div style={{ position: 'relative', height: 4, borderRadius: 2, background: 'var(--neutral-100)', width: '100%' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: 4, borderRadius: 2, background: 'var(--neutral-900)', width: `${pct}%`, transition: 'width 0.3s ease' }} />
      </div>
    </div>
  )
}


export function PermToggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      style={{
        position:   'relative',
        width:      34,
        height:     20,
        borderRadius: 20,
        border:     'none',
        padding:    0,
        cursor:     'pointer',
        flexShrink: 0,
        background: checked ? 'var(--blue-400, #6e98cb)' : 'var(--neutral-100, #F5F5F5)',
        boxShadow:  checked
          ? '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--blue-700-70)'
          : '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(212, 212, 212,0.4)',
        transition: 'background 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      <span style={{
        position:     'absolute',
        top:          2,
        left:         checked ? 16 : 2,
        width:        16,
        height:       16,
        borderRadius: '50%',
        background:   'var(--neutral-white)',
        boxShadow:    checked
          ? '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--blue-700-40), inset 0px -1px 0px 0px var(--blue-800-15)'
          : '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(212, 212, 212,0.4), inset 0px -1px 0px 0px rgba(106,98,93,0.05)',
        transition:   'left 0.15s ease',
      }} />
    </button>
  )
}

// ── Invoice table ─────────────────────────────────────────────────────────────

export function InvoiceTable({ invoices, loading }: { invoices: Invoice[]; loading: boolean }) {
  const cellHead: React.CSSProperties = { flex: '1 0 0', minWidth: 0, fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)' }
  const cellBody: React.CSSProperties = { flex: '1 0 0', minWidth: 0, fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)' }

  return (
    <div role="table" aria-label="Invoice history" aria-busy={loading} style={{
      background:   'var(--neutral-white)',
      borderRadius: 8,
      padding:      12,
      boxShadow:    SHADOW_TILE,
    }}>
      <div role="row" style={{ display: 'flex', gap: 24, padding: '0 12px 12px', borderBottom: '1px solid var(--neutral-100)' }}>
        <span role="columnheader" style={cellHead}>Date</span>
        <span role="columnheader" style={cellHead}>Amount</span>
        <span role="columnheader" style={cellHead}>Status</span>
        <span role="columnheader" style={{ width: 200, textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)' }}>Actions</span>
      </div>

      {loading ? (
        <p role="status" style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-500)', textAlign: 'center', padding: 24, margin: 0 }}>Loading invoices…</p>
      ) : invoices.length === 0 ? (
        <p role="status" style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-500)', textAlign: 'center', padding: 24, margin: 0 }}>No invoices yet.</p>
      ) : (
        invoices.map((inv, i) => (
          <div role="row" key={`${inv.status}-${inv.created}-${inv.displayAmount}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 24, padding: 12, borderBottom: i < invoices.length - 1 ? '1px solid var(--neutral-100)' : undefined }}>
            <span role="cell" style={cellBody}>{fmtDate(inv.created)}</span>
            <span role="cell" style={cellBody}>{fmtUsd(inv.displayAmount)}</span>
            <div role="cell" style={{ flex: '1 0 0', minWidth: 0 }}>
              <Badge
                label={inv.statusLabel}
                tone={inv.isUpcoming ? 'neutral' : inv.isPaid ? 'green' : 'red'}
              />
            </div>
            <div role="cell" style={{ width: 200, display: 'flex', justifyContent: 'center' }}>
              {inv.viewUrl ? (
                <a
                  href={inv.viewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-700)', textDecoration: 'underline' }}
                >
                  View
                </a>
              ) : (
                <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: 'var(--neutral-400)' }}>{inv.isUpcoming ? '—' : 'View'}</span>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
