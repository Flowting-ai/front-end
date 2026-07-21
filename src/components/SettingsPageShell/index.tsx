import React from 'react'
import { Button } from '@/components/Button'
import { ArrowLeftOneIcon } from '@strange-huge/icons'

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
        paddingTop: 64,
        paddingBottom: 48,
      }}
    >
      {/* Horizontal padding lives here, not on the scrolling element above —
          keeps the scrollbar flush with the container's edge. */}
      <div
        style={{
          flex: '1 0 0',
          minWidth: 0,
          maxWidth: maxWidth + 48,
          padding: '0 24px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <header style={{ paddingLeft: 4, marginBottom: 4 }}>
          {backLabel && onBack && (
            <div style={{ marginBottom: 8 }}>
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<ArrowLeftOneIcon size={16} animated />}
                onClick={onBack}
              >
                {backLabel}
              </Button>
            </div>
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
