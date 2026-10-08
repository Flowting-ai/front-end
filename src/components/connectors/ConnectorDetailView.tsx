'use client'

// Connector detail view — S19. Ported from the story's ConnectorDetail +
// AccountGroups/AccountPanel, wired to UnifiedAccount data.
//
// The story's EndpointRow (a copyable "MCP endpoint" URL) is deliberately
// NOT ported — there is no backend field for it (Gap #1 in
// docs v1.5/connectors-v1.5-migration-plan.md). Fabricating a URL would be
// worse than omitting the row.

import { Tooltip } from '@/components/Tooltip'
import React from 'react'
import { useOrg } from '@/context/org-context'
import { connectionAddedBy } from '@/lib/connector-owner'
import { ArrowLeftOneIcon, DeleteTwoIcon, PlusSignIcon } from '@strange-huge/icons'
import { AccountRow, AccountRowHeader } from '@/components/AccountRow'
import { Button } from '@/components/Button'
import { ConnectorGlyph } from '@/components/ConnectorGlyph'
import { ConnectorCatalog, ConnectorConnection } from '@/lib/api/connectors'
import { isApiProviderConnector } from '@/lib/connectorProvider'
import { ConnectorsShell } from './ConnectionsView'
import styles from './ConnectorDetailView.module.css'

function formatConnectedOn(iso: string): string | undefined {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? undefined
    : date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}
// Accounts are grouped, not one flat list: anything needing attention floats
// to the top with a subtle tint and Reconnect as its action, then the healthy
// accounts split by visibility. Empty groups render nothing. Ported from the
// story's Figma-sourced AccountGroups (163:22383).
//
// A person may own several accounts per app. Every live one is usable.
function AccountGroups({ accounts, tools, open, reconnect, addedBy }: { accounts: ConnectorConnection[]; tools: ConnectorCatalog['tools']; open: (account: ConnectorConnection) => void; reconnect: (account: ConnectorConnection) => void; addedBy: (account: ConnectorConnection) => string }) {
  const attention = accounts.filter(a => a.needsReconnect)
  const healthy = accounts.filter(a => !a.needsReconnect)
  const shared = healthy.filter(a => a.shared)
  const priv = healthy.filter(a => !a.shared)
  return (
    <div>
      <AccountPanel accounts={attention} tools={tools} tone="attention" open={open} reconnect={reconnect} addedBy={addedBy} />
      <AccountPanel accounts={shared} tools={tools} tone="default" open={open} reconnect={reconnect} addedBy={addedBy} />
      <AccountPanel accounts={priv} tools={tools} tone="default" open={open} reconnect={reconnect} addedBy={addedBy} />
    </div>
  )
}

function AccountPanel({ accounts, tools, tone, open, reconnect, addedBy }: { accounts: ConnectorConnection[]; tools: ConnectorCatalog['tools']; tone: 'attention' | 'default'; open: (account: ConnectorConnection) => void; reconnect: (account: ConnectorConnection) => void; addedBy: (account: ConnectorConnection) => string }) {
  if (accounts.length === 0) return null
  const attention = tone === 'attention'
  return (
    <div className={styles.accountGroup} data-attention={attention || undefined}>
      {accounts.map((item, index) => (
        <React.Fragment key={item.id}>
          {index > 0 && <div className={styles.divider} />}
          <AccountRow
            name={item.nickname}
            addedBy={addedBy(item)}
            canManage={item.canManage}
            email={item.email}
            visibility={item.visibility}
            state={item.connectionState}
            permission={item.permissionSummary(tools)}
            connectedOn={formatConnectedOn(item.createdAt)}
            onManage={() => open(item)}
            onReconnect={() => reconnect(item)}
          />
        </React.Fragment>
      ))}
    </div>
  )
}

export function ConnectorDetailView({
  catalog, back, addAccount, openAccount, reconnectAccount, deleteApi,
}: {
  catalog: ConnectorCatalog
  back: () => void
  addAccount: () => void
  openAccount: (account: ConnectorConnection) => void
  reconnectAccount: (account: ConnectorConnection) => void
  deleteApi: () => void
}) {
  const { members } = useOrg()
  const addedBy = (account: ConnectorConnection) => connectionAddedBy(account, members)

  // Only its owner links a custom API, so whoever reaches it with no account
  // of their own, or with one they own, is the owner. Everyone else holds a
  // shared account they do not own.
  const ownsApi = isApiProviderConnector(catalog.provider)
    && (catalog.connections.length === 0 || catalog.ownedConnections.length > 0)
  return (
    <ConnectorsShell maxWidth={960}>
      <div className={styles.back}>
        <Button variant="ghost" size="sm" leftIcon={<ArrowLeftOneIcon size={16} />} onClick={back}>Connections</Button>
      </div>
      <header className={styles.header}>
        <div className={styles.identity}>
          <ConnectorGlyph slug={catalog.slug} name={catalog.name} logoUrl={catalog.logoUrl} size={40} />
          <h1 className={styles.title}>{catalog.name}</h1>
        </div>
        <div className={styles.actions}>
          {ownsApi && (
            <Button variant="outline" size="sm" leftIcon={<DeleteTwoIcon size={16} />} onClick={deleteApi}>Delete API</Button>
          )}
          <Button variant="outline" size="sm" leftIcon={<PlusSignIcon size={16} />} onClick={addAccount}>Add account</Button>
        </div>
        {catalog.description && <Tooltip content={catalog.description} maxWidth={280}><p className={styles.description}>{catalog.description}</p></Tooltip>}
      </header>
      <section className={styles.accounts} aria-labelledby="connector-accounts-heading">
        <div className={styles.sectionHeader}>
          <h2 id="connector-accounts-heading" className={styles.sectionTitle}>Accounts</h2>
          <span className={styles.count}>{catalog.connections.length}</span>
          {catalog.connections.length > 0 && (
            <span className={styles.breakdown}>{catalog.sharedConnections.length} shared · {catalog.privateConnections.length} private</span>
          )}
          <p className={styles.hint}>Manage access and permissions for your connected accounts.</p>
        </div>
        {catalog.connections.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>No accounts connected yet</p>
            <p className={styles.hint}>Add an account to start using {catalog.name}.</p>
          </div>
        ) : (
          <div className={styles.list}>
            <AccountRowHeader />
            <AccountGroups accounts={catalog.connections} tools={catalog.tools} open={openAccount} reconnect={reconnectAccount} addedBy={addedBy} />
          </div>
        )}
      </section>
    </ConnectorsShell>
  )
}
