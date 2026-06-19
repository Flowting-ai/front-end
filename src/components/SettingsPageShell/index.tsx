import React from 'react'

interface SettingsPageShellProps {
  title: string
  description: string
  children: React.ReactNode
  backLabel?: string
  onBack?: () => void
  maxWidth?: number
}

export function SettingsPageShell({
  title,
  description,
  children,
  backLabel,
  onBack,
  maxWidth = 1114,
}: SettingsPageShellProps) {
  return (
    <div
      className="kaya-scrollbar"
      style={{
        flex: '1 0 0',
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '64px 24px 48px',
      }}
    >
      <div
        style={{
          flex: '1 0 0',
          minWidth: 0,
          maxWidth,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <header style={{ paddingLeft: 4, marginBottom: 4 }}>
          {backLabel && onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: 0,
                marginBottom: 4,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize: 11,
                lineHeight: '16px',
                color: 'var(--neutral-500)',
              }}
            >
              &larr; {backLabel}
            </button>
          )}
          <h1
            style={{
              fontFamily: 'var(--font-title)',
              fontWeight: 400,
              fontSize: 24,
              lineHeight: '32px',
              color: 'var(--neutral-900)',
              margin: 0,
            }}
          >
            {title}
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              fontSize: 14,
              lineHeight: '22px',
              color: 'var(--neutral-500)',
              margin: 0,
            }}
          >
            {description}
          </p>
        </header>

        {children}
      </div>
    </div>
  )
}
