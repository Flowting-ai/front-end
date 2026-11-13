import React from 'react'
import { ConnectorLogo } from '@/components/ContextPanel/identity'
import type { Connector } from '@/lib/connector'

/**
 * How a card about a connected app opens: the app's logo, a title, and a line under it.
 * Every card that concerns one connector starts with this, so none can show up without the app's logo.
 */
export function ConnectorHeading({ connector, title, children }: {
  connector: Connector
  title:     React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <span style={{ flexShrink: 0, marginTop: 1 }}>
        <ConnectorLogo connector={connector} size={32} />
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: '1 0 0', minWidth: 0 }}>
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-body)',
          fontWeight: 'var(--font-weight-medium)',
          lineHeight: 'var(--line-height-body)',
          color:      'var(--neutral-800)',
        }}>
          {title}
        </span>
        {children && (
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-caption)',
            lineHeight: 'var(--line-height-caption)',
            color:      'var(--neutral-500)',
          }}>
            {children}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * The card that asks the person something about one connected app: connect it, or allow an action on it.
 * One shell, so the two look alike; the buttons go in as children.
 */
export function ConnectorPromptShell({ connector, title, caption, children }: {
  connector: Connector
  title:     React.ReactNode
  caption?:  React.ReactNode
  children:  React.ReactNode
}) {
  return (
    <div style={{
      display:         'flex',
      flexDirection:   'column',
      gap:             12,
      padding:         '16px',
      borderRadius:    16,
      border:          '1px solid var(--border-default)',
      backgroundColor: 'var(--color-surface-glass)',
      boxShadow:       'var(--shadow-card-default)',
      maxWidth:        480,
    }}>
      <ConnectorHeading connector={connector} title={title}>{caption}</ConnectorHeading>
      {children}
    </div>
  )
}
