'use client'

import React from 'react'

// One empty row for every sidebar section (Projects, Recents, a project's chats, an agent's chats).
// Before this, each site inlined its own copy with different padding (8px 6px / 0 8px / 4px 6px) and
// --neutral-400 text, which fails AA on the sidebar surface (2.84:1 light, 3.55:1 dark; 12px needs
// 4.5:1). This is one geometry, --neutral-600 (5.62:1 / 7.88:1), and an optional action so the row
// offers a way forward instead of being a dead end.

const rowStyle: React.CSSProperties = {
  display:       'flex',
  flexDirection: 'column',
  alignItems:    'flex-start',
  gap:           2,
  minHeight:     32,
  justifyContent: 'center',
  padding:       '4px 8px',
}

const textStyle: React.CSSProperties = {
  margin:     0,
  fontFamily: 'var(--font-body)',
  fontSize:   'var(--font-size-caption)',
  lineHeight: 'var(--line-height-caption)',
  color:      'var(--neutral-600)',
}

export function SidebarEmptyState({ label, actionLabel, onAction }: {
  label: string
  /** Shown as a quiet link under the label. Omit for a message-only row. */
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div style={rowStyle}>
      <p style={textStyle}>{label}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onAction() }}
          className="hover:underline"
          style={{
            margin: 0,
            padding: 0,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--font-size-caption)',
            lineHeight: 'var(--line-height-caption)',
            fontWeight: 'var(--font-weight-medium)',
            color: 'var(--neutral-800)',
            textAlign: 'left',
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
