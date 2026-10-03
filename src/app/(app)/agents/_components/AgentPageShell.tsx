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

/**
 * Title row, with the page's primary actions (Back / Save …) pinned to the top right.
 * Only the buttons are sticky: they ride along as the card scrolls while the title scrolls
 * away normally. A sticky element can only stick inside a tall parent, so they live in a
 * zero-height bar placed first in the page column (the full-height parent) rather than in
 * the short title row.
 */
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
    <>
      {actions && (
        <div
          style={{
            position: 'sticky', top: 16, zIndex: 20, height: 0, width: '100%',
            display: 'flex', justifyContent: 'flex-end', pointerEvents: 'none',
          }}
        >
          <div
            style={{
              pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 8, padding: 4, borderRadius: 14,
              backgroundColor: 'color-mix(in srgb, var(--neutral-50) 88%, transparent)',
              backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            }}
          >
            {actions}
          </div>
        </div>
      )}
      <div
        style={{
          display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0,
          width: '100%', marginBottom: 28, flexShrink: 0,
          // Leave the top-right corner free for the sticky buttons.
          paddingRight: actions ? 'min(340px, 45%)' : 0, boxSizing: 'border-box',
        }}
      >
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
    </>
  )
}
