'use client'

// Remove confirmation — S15 (with dependencies) / S16 (simple). Ported from
// the story's Remove modal. The story's "Used by 3 agents · 2 automations"
// copy is intentionally NOT reproduced — the backend's used-by endpoint only
// returns a coarse org-level yes/no (Gap #3 in
// docs v1.5/connectors-v1.5-migration-plan.md), so this shows a generic
// warning instead of fabricating counts.

import React from 'react'
import { ConnectorGlyph } from '@/components/ConnectorGlyph'
import { Button } from '@/components/Button'
import { ConnectorCatalog, ConnectorConnection } from '@/lib/api/connectors'

const SPACE = { xs: 4, sm: 6, md: 8, lg: 12, xl: 16, xxl: 24 } as const
const heading: React.CSSProperties = { margin: 0, color: 'var(--neutral-900)', fontFamily: 'var(--font-title)', fontSize: 22, fontWeight: 400, lineHeight: 1.2 }
const muted: React.CSSProperties = { margin: 0, color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-body)', lineHeight: 'var(--line-height-body)' }
const panel: React.CSSProperties = { borderRadius: 12, background: 'var(--neutral-white)', boxShadow: '0 0 0 1px var(--neutral-100)' }

export function RemoveModal({
  account, catalog, maybeInUse, blockedReason, busy, cancel, confirm,
}: {
  account: ConnectorConnection
  catalog: ConnectorCatalog
  /** Coarse org-level "something references this connector" signal (Gap #3) — not a real count. */
  maybeInUse: boolean
  /** Set when the viewer isn't allowed to remove this account (e.g. a
   *  non-admin on a shared account) — disables Remove and explains why. */
  blockedReason?: string
  busy: boolean
  cancel: () => void
  confirm: () => void
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'grid', placeItems: 'center', padding: SPACE.xxl, background: 'rgba(30,28,27,.58)' }} onClick={cancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Remove ${account.nickname} (${account.email})?`}
        onClick={e => e.stopPropagation()}
        style={{ ...panel, width: '100%', maxWidth: 480, padding: SPACE.xxl, boxShadow: '0 24px 72px rgba(30,28,27,.28)' }}
      >
        <div style={{ width: 44, height: 44, display: 'grid', placeItems: 'center', borderRadius: 11, background: 'var(--neutral-white)', boxShadow: '0 0 0 1px var(--neutral-100)', marginBottom: SPACE.xl }}>
          <ConnectorGlyph slug={catalog.slug} name={catalog.name} logoUrl={catalog.logoUrl} size={30} />
        </div>
        <h2 style={heading}>Remove account?</h2>
        <p style={{ ...muted, marginTop: SPACE.sm }}>
          <strong style={{ color: 'var(--neutral-800)', fontWeight: 500 }}>{account.nickname}</strong>
          {account.email ? ` · ${account.email}` : ''}
        </p>
        {maybeInUse && (
          <div style={{ ...panel, padding: SPACE.lg, marginTop: SPACE.xl }}>
            <strong style={{ fontWeight: 500 }}>This account may be in use</strong>
            <p style={{ ...muted, marginTop: SPACE.xs }}>Removing it could affect agents or automations that reference it. We can&apos;t show exactly which ones yet.</p>
          </div>
        )}
        {blockedReason && (
          <div style={{ ...panel, padding: SPACE.lg, marginTop: SPACE.xl, background: 'var(--yellow-50)' }}>
            <p style={{ ...muted, margin: 0 }}>{blockedReason}</p>
          </div>
        )}
        <p style={{ ...muted, marginTop: SPACE.lg }}>Other {catalog.name} accounts stay connected.</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: SPACE.md, marginTop: SPACE.xxl }}>
          <Button variant="ghost" size="sm" onClick={cancel} disabled={busy}>Keep account</Button>
          <Button variant="danger" size="sm" onClick={confirm} loading={busy} disabled={Boolean(blockedReason)}>Remove</Button>
        </div>
      </div>
    </div>
  )
}
