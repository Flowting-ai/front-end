import React from 'react'

// ── Table-style settings row — Figma "table/base" rows (18:27521/18:27530) ───
export function SettingsRow({
  title,
  subtitle,
  divider,
  children,
}: {
  title: string
  subtitle: string
  divider?: boolean
  children: React.ReactNode
}) {
  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      justifyContent: 'space-between',
      padding:      '12px 24px',
      borderBottom: divider ? '1px solid var(--neutral-100)' : undefined,
    }}>
      <div>
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
          {title}
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-500)', margin: 0 }}>
          {subtitle}
        </p>
      </div>
      {children}
    </div>
  )
}

// ── Section card wrapper ──────────────────────────────────────────────────────

export function SettingsCard({
  children,
  danger,
}: {
  children: React.ReactNode
  danger?: boolean
}) {
  return (
    <div
      style={{
        border:        `1px solid ${danger ? 'var(--red-400)' : 'var(--border-default)'}`,
        borderRadius:  16,
        boxShadow:     '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
        display:       'flex',
        flexDirection: 'column',
        overflow:      'hidden',
        paddingTop:    12,
        paddingBottom: 12,
      }}
    >
      {children}
    </div>
  )
}

// ── Divider inside a card ─────────────────────────────────────────────────────

export function CardSection({
  children,
  divider,
  padTop = 12,
  padBottom = 24,
}: {
  children: React.ReactNode
  divider?: boolean
  padTop?: number
  padBottom?: number
}) {
  return (
    <div
      style={{
        display:         'flex',
        flexDirection:   'column',
        padding:         `${padTop}px 24px ${padBottom}px`,
        borderBottom:    divider ? '1px solid var(--neutral-100)' : undefined,
      }}
    >
      {children}
    </div>
  )
}
