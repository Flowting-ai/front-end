'use client'

import React from 'react'

export interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  text?: string
  /** Actions under the text (at most one primary). */
  children?: React.ReactNode
}

/** Centred empty state: a small grey icon tile, one title line, one quiet line. Used for empty lists and search misses. */
export function EmptyState({ icon, title, text, children }: EmptyStateProps) {
  return (
    <div
      role="status"
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0,
        padding: '96px 24px', textAlign: 'center', flex: '1 0 auto',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: 14,
          background: 'var(--neutral-100)', color: 'var(--neutral-600)', marginBottom: 16,
        }}
      >
        {icon}
      </span>
      <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 18, lineHeight: '28px', color: 'var(--neutral-900)' }}>{title}</p>
      {text && <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-600)', maxWidth: 380, marginTop: 4 }}>{text}</p>}
      {children && <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>{children}</div>}
    </div>
  )
}
