'use client'

// Connector detail view — S19. Ported from the story's ConnectorDetail +
// AccountGroups/AccountPanel, wired to UnifiedAccount data.
//
// The story's EndpointRow (a copyable "MCP endpoint" URL) is deliberately
// NOT ported — there is no backend field for it (Gap #1 in
// docs v1.5/connectors-v1.5-migration-plan.md). Fabricating a URL would be
// worse than omitting the row.

import React from 'react'
import { ArrowLeftOneIcon, PlusSignIcon } from '@strange-huge/icons'
import { AccountRow } from '@/components/AccountRow'
import { Button } from '@/components/Button'
import { ConnectorGlyph } from '@/components/ConnectorGlyph'
import { ConnectorCatalog, ConnectorConnection } from '@/lib/api/connectors'
import { ConnectorsShell } from './ConnectionsView'

const SPACE = { xs: 4, sm: 6, md: 8, lg: 12, xl: 16, xxl: 24, section: 32 } as const
const heading: React.CSSProperties = { margin: 0, color: 'var(--neutral-900)', fontFamily: 'var(--font-title)', fontSize: 32, fontWeight: 400, lineHeight: 1.2 }
const muted: React.CSSProperties = { margin: 0, color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-body)', lineHeight: 'var(--line-height-body)' }
const panel: React.CSSProperties = { borderRadius: 12, background: 'var(--neutral-white)', boxShadow: '0 0 0 1px var(--neutral-100)' }

function Back({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: SPACE.xxl }}>
      <Button variant="ghost" size="sm" leftIcon={<ArrowLeftOneIcon size={16} />} onClick={onClick}>{children}</Button>
    </div>
  )
}

// Accounts are grouped, not one flat list: anything needing attention floats
// to its own tinted panel with Reconnect as its only action, then the healthy
// accounts split by visibility. Empty groups render nothing. Ported from the
// story's Figma-sourced AccountGroups (163:22383).
function AccountGroups({ accounts, permission, open, reconnect }: { accounts: ConnectorConnection[]; permission: ConnectorCatalog['permissionSummary']; open: (account: ConnectorConnection) => void; reconnect: (account: ConnectorConnection) => void }) {
  const attention = accounts.filter(a => a.needsReconnect)
  const healthy = accounts.filter(a => !a.needsReconnect)
  const shared = healthy.filter(a => a.isShared)
  const priv = healthy.filter(a => a.isPrivate)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
      <AccountPanel accounts={attention} permission={permission} tone="attention" open={open} reconnect={reconnect} />
      <AccountPanel accounts={shared} permission={permission} tone="default" open={open} reconnect={reconnect} />
      <AccountPanel accounts={priv} permission={permission} tone="default" open={open} reconnect={reconnect} />
    </div>
  )
}

function AccountPanel({ accounts, permission, tone, open, reconnect }: { accounts: ConnectorConnection[]; permission: ConnectorCatalog['permissionSummary']; tone: 'attention' | 'default'; open: (account: ConnectorConnection) => void; reconnect: (account: ConnectorConnection) => void }) {
  if (accounts.length === 0) return null
  const attention = tone === 'attention'
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      padding: `${SPACE.lg}px 0`, borderRadius: 16, overflow: 'hidden',
      background: attention ? 'var(--neutral-100)' : 'var(--neutral-50)',
      boxShadow: attention ? undefined : '0 0 0 1px var(--neutral-200)',
    }}>
      {accounts.map((item, index) => (
        <React.Fragment key={item.id}>
          {index > 0 && <div style={{ borderTop: '1px solid var(--neutral-200)' }} />}
          <AccountRow
            name={item.nickname}
            email={item.email}
            visibility={item.visibility}
            state={item.connectionState}
            permission={permission}
            onManage={() => open(item)}
            onReconnect={() => reconnect(item)}
          />
        </React.Fragment>
      ))}
    </div>
  )
}

export function ConnectorDetailView({
  catalog, back, addAccount, openAccount, reconnectAccount,
}: {
  catalog: ConnectorCatalog
  back: () => void
  addAccount: () => void
  openAccount: (account: ConnectorConnection) => void
  reconnectAccount: (account: ConnectorConnection) => void
}) {
  return (
    <ConnectorsShell>
      <Back onClick={back}>Connections</Back>
      <div style={{ ...panel, padding: 'clamp(20px, 4vw, 36px)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACE.xl, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.lg }}>
            <ConnectorGlyph slug={catalog.slug} name={catalog.name} logoUrl={catalog.logoUrl} size={44} />
            <div>
              <h1 style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-heading)', fontWeight: 'var(--font-weight-medium)', lineHeight: 'var(--line-height-heading)' }}>
                {catalog.name}
              </h1>
            </div>
          </div>
          <Button size="sm" leftIcon={<PlusSignIcon size={16} />} onClick={addAccount}>Add account</Button>
        </div>
        <p style={{ ...muted, margin: `${SPACE.xxl}px 0`, maxWidth: 680 }}>{catalog.description}</p>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: SPACE.lg, marginBottom: SPACE.lg }}>
          <h2 style={{ ...heading, fontSize: 18 }}>Accounts</h2>
          <span style={{ ...muted, fontSize: 'var(--font-size-caption)' }}>
            {catalog.connections.length} {catalog.connections.length === 1 ? 'account' : 'accounts'}
          </span>
        </div>
        {catalog.connections.length === 0 ? (
          <p style={{ ...muted, padding: SPACE.section, textAlign: 'center' }}>No accounts connected yet.</p>
        ) : (
          <AccountGroups accounts={catalog.connections} permission={catalog.permissionSummary} open={openAccount} reconnect={reconnectAccount} />
        )}
      </div>
    </ConnectorsShell>
  )
}
