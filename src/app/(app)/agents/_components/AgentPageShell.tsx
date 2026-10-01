'use client'

import React from 'react'

/**
 * The rounded, scrolling card every agent create/edit screen sits in — same
 * frame the old wizard used, minus the step tracker (there are no steps now).
 */
export function AgentPageShell({
  children,
  maxWidth = 1040,
}: {
  children: React.ReactNode
  /** Width cap of the content column. */
  maxWidth?: number
}) {
  return (
    <div
      className="kaya-scrollbar"
      style={{
        background:     'var(--color-surface-container)',
        border:         '1px solid var(--neutral-200)',
        borderRadius:   22,
        flex:           '1 0 0',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        paddingTop:     32,
        paddingBottom:  32,
        minHeight:      0,
        overflowY:      'auto',
      }}
    >
      {/* Horizontal padding lives on this inner wrapper, not the scrolling
          element above — keeps the scrollbar flush with the card's border. */}
      <div
        style={{
          width: '100%', maxWidth: maxWidth + 96, boxSizing: 'border-box',
          paddingLeft: 48, paddingRight: 48,
          display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '1 0 auto',
        }}
      >
        {children}
      </div>
    </div>
  )
}

/** Title row with the page's primary actions on the right. */
export function AgentPageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
        width: '100%', marginBottom: 28, flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <h1
          style={{
            margin: 0, fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)',
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{actions}</div>}
    </div>
  )
}
