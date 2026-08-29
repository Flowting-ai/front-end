'use client'

// "Add custom connector" — no backend support at all today (Gap #1 category;
// see docs v1.5/connectors-v1.5-migration-plan.md). The story itself only
// ships a placeholder box for this flow, so this stays a placeholder too
// rather than fabricating a working custom-connector creation flow.

import React from 'react'
import { Button } from '@/components/Button'

const SPACE = { md: 8, lg: 12, xl: 16, xxl: 24 } as const
const heading: React.CSSProperties = { margin: 0, color: 'var(--neutral-900)', fontFamily: 'var(--font-title)', fontSize: 22, fontWeight: 400, lineHeight: 1.2 }
const panel: React.CSSProperties = { borderRadius: 12, background: 'var(--neutral-white)', boxShadow: '0 0 0 1px var(--neutral-100)' }

export function CustomConnectorModal({ cancel }: { cancel: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'grid', placeItems: 'center', padding: SPACE.xxl, background: 'rgba(30,28,27,.58)' }} onClick={cancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add custom connector"
        onClick={e => e.stopPropagation()}
        style={{ ...panel, width: '100%', maxWidth: 520, padding: SPACE.xxl, boxShadow: '0 24px 72px rgba(30,28,27,.28)' }}
      >
        <h2 style={heading}>Add a custom connector</h2>
        <div style={{ minHeight: 148, display: 'grid', placeItems: 'center', marginTop: SPACE.xl, border: '1px dashed var(--neutral-300)', borderRadius: 12, color: 'var(--neutral-500)', textAlign: 'center', padding: SPACE.lg }}>
          Custom connectors aren&apos;t supported by the backend yet (see the migration doc&apos;s Gap #1).
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: SPACE.xl }}>
          <Button variant="ghost" size="sm" onClick={cancel}>Close</Button>
        </div>
      </div>
    </div>
  )
}
