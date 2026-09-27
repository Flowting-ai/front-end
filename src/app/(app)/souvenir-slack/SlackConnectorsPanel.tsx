'use client'

import { useEffect, useState } from 'react'
import { PlusSignIcon } from '@strange-huge/icons'
import { toast } from 'sonner'
import { Button } from '@/components/Button'
import { ConnectorGlyph } from '@/components/ConnectorGlyph'
import { PermissionsTab } from '@/components/connectors/AccountDetailView'
import {
  getConnector,
  initiateLink,
  listConnectors,
  listLinkedConnectors,
  pollConnectorUntilActive,
  type ConnectorCatalog,
  type ConnectorConnection,
} from '@/lib/api/connectors'
import {
  lendSlackConnector,
  listSlackConnectors,
  removeSlackConnector,
  type SlackScopeConnector,
} from '@/lib/api/slack'
import type { Connector } from '@/lib/connector'
import styles from './slack-config.module.css'

type AddMode = 'closed' | 'menu' | 'existing' | 'new'

function ConnectorLabel({ connector, detail }: { connector: Connector; detail?: string }) {
  return (
    <span className={styles.listRowMain}>
      <span className={styles.connectorIcon}>
        <ConnectorGlyph slug={connector.slug} name={connector.name} logoUrl={connector.logo} size={18} />
      </span>
      <span style={{ minWidth: 0 }}>
        <span className={styles.listPrimary} style={{ display: 'block' }}>{connector.name}</span>
        {detail && <span className={styles.listSecondary} style={{ display: 'block' }}>{detail}</span>}
      </span>
    </span>
  )
}

function AccountPermissions({ entry }: { entry: SlackScopeConnector }) {
  const [loaded, setLoaded] = useState<{ account: ConnectorConnection; catalog: ConnectorCatalog } | null>(null)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let cancelled = false
    getConnector(entry.connector.slug)
      .then(catalog => {
        const account = catalog.connections.find(c => c.id === entry.accountId)
        if (!cancelled && account) setLoaded({ account, catalog })
      })
      .catch(err => toast.error(err instanceof Error ? err.message : 'Failed to load permissions'))
    return () => { cancelled = true }
  }, [entry.connector.slug, entry.accountId, refresh])

  if (!loaded) return <div className="kaya-skeleton" style={{ width: '100%', height: 120, borderRadius: 8 }} />
  return (
    <PermissionsTab
      key={refresh}
      account={loaded.account}
      catalog={loaded.catalog}
      onChanged={() => setRefresh(count => count + 1)}
    />
  )
}

export function SlackConnectorsPanel({ orgId, channelId }: { orgId: string; channelId: string | null }) {
  const [entries, setEntries] = useState<SlackScopeConnector[] | null>(null)
  const [openPermissions, setOpenPermissions] = useState<string | null>(null)
  const [mode, setMode] = useState<AddMode>('closed')
  const [mine, setMine] = useState<{ account: ConnectorConnection; connector: Connector }[]>([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ConnectorCatalog[]>([])
  const [connecting, setConnecting] = useState<string | null>(null)

  useEffect(() => {
    listSlackConnectors(orgId, channelId)
      .then(setEntries)
      .catch(err => toast.error(err instanceof Error ? err.message : 'Failed to load connectors'))
  }, [orgId, channelId])

  useEffect(() => {
    if (mode !== 'existing') return
    listLinkedConnectors()
      .then(catalog => setMine(catalog.flatMap(entry => entry.ownedConnections
        .filter(c => c.connected)
        .map(account => ({ account, connector: entry.identity })))))
      .catch(err => toast.error(err instanceof Error ? err.message : 'Failed to load your connections'))
  }, [mode])

  useEffect(() => {
    if (mode !== 'new') return
    const timer = setTimeout(() => {
      listConnectors({ q: query || undefined, limit: 20 })
        .then(page => setResults(page.connectors))
        .catch(err => toast.error(err instanceof Error ? err.message : 'Failed to search connectors'))
    }, 250)
    return () => clearTimeout(timer)
  }, [mode, query])

  const lend = async (accountId: string) => {
    try {
      const entry = await lendSlackConnector(orgId, { accountId, channelId })
      setEntries(prev => [...(prev ?? []), entry])
      setMode('closed')
      toast.success('Connector added')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add connector')
    }
  }

  const connectNew = async (catalog: ConnectorCatalog) => {
    setConnecting(catalog.slug)
    try {
      const known = catalog.ownedConnections.map(c => c.id)
      const link = await initiateLink(catalog.slug)
      if (link.redirectUrl) window.open(link.redirectUrl, '_blank', 'noopener')
      const settled = await pollConnectorUntilActive(catalog.slug, { target: { known } })
      const created = settled.ownedConnections.find(c => c.connected && !known.includes(c.id))
      if (created) await lend(created.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The connection did not finish')
    } finally {
      setConnecting(null)
    }
  }

  const remove = async (entry: SlackScopeConnector) => {
    try {
      await removeSlackConnector(orgId, entry.id)
      setEntries(prev => (prev ?? []).filter(e => e.id !== entry.id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove connector')
    }
  }

  if (entries === null) return <div className={`kaya-skeleton ${styles.skeleton}`} />

  const lentHere = new Set(entries.filter(e => !e.inherited).map(e => e.accountId))
  const available = mine.filter(({ account }) => !lentHere.has(account.id))

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionCopy}>
          <h3 className={styles.sectionTitle}>Connectors</h3>
          <p className={styles.sectionDescription}>
            {channelId
              ? 'Accounts Souvenir can use in this channel, including any inherited from workspace defaults.'
              : 'Accounts Souvenir can use across Slack. Each one keeps the permissions of the person who connected it.'}
          </p>
        </div>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            className={styles.iconButton}
            type="button"
            aria-label="Add connector"
            title="Add connector"
            onClick={() => setMode(mode === 'closed' ? 'menu' : 'closed')}
          >
            <PlusSignIcon size={15} />
          </button>
          {mode === 'menu' && (
            <div className={styles.menu} role="menu">
              <Button variant="ghost" size="sm" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => setMode('existing')}>
                Use one of your connections
              </Button>
              <Button variant="ghost" size="sm" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => setMode('new')}>
                Create a new connection
              </Button>
            </div>
          )}
        </div>
      </div>

      {mode === 'existing' && (
        <div className={styles.inlinePanel}>
          <p className={styles.inlinePanelHeader}>Your connections</p>
          <p className={styles.inlinePanelHelp}>Only accounts you connected can be added here.</p>
          <div className={styles.list}>
            {available.length === 0
              ? <p className={styles.empty}>No other connections are available.</p>
              : available.map(({ account, connector }) => (
                <div key={account.id} className={styles.listRow}>
                  <ConnectorLabel connector={connector} detail={account.accountIdentifier ?? account.nickname} />
                  <Button variant="outline" size="sm" onClick={() => void lend(account.id)}>Add</Button>
                </div>
              ))}
          </div>
          <div className={styles.actions}><Button variant="ghost" size="sm" onClick={() => setMode('closed')}>Cancel</Button></div>
        </div>
      )}

      {mode === 'new' && (
        <div className={styles.inlinePanel}>
          <p className={styles.inlinePanelHeader}>Connect a new account</p>
          <p className={styles.inlinePanelHelp}>Search the connector catalog, then finish authorization in the new tab.</p>
          <input className={styles.field} type="search" aria-label="Search connectors" placeholder="Search apps" value={query} onChange={event => setQuery(event.target.value)} />
          <div className={styles.list}>
            {results.map(catalog => (
              <div key={catalog.slug} className={styles.listRow}>
                <ConnectorLabel connector={catalog.identity} />
                <Button variant="outline" size="sm" loading={connecting === catalog.slug} disabled={connecting !== null} onClick={() => void connectNew(catalog)}>
                  Connect
                </Button>
              </div>
            ))}
          </div>
          <div className={styles.actions}><Button variant="ghost" size="sm" onClick={() => setMode('closed')}>Cancel</Button></div>
        </div>
      )}

      {entries.length === 0 ? (
        <p className={styles.empty}>No connectors added yet.</p>
      ) : (
        <div className={styles.list}>
          {entries.map(entry => (
            <div key={entry.id}>
              <div className={styles.listRow}>
                <ConnectorLabel connector={entry.connector} detail={`${entry.accountLabel} · connected by ${entry.owned ? 'you' : entry.ownerName}`} />
                <span className={styles.rowActions}>
                  {entry.inherited && <span className={styles.inherited}>Inherited</span>}
                  {entry.owned ? (
                    <Button variant="outline" size="sm" onClick={() => setOpenPermissions(openPermissions === entry.id ? null : entry.id)}>
                      Permissions
                    </Button>
                  ) : (
                    <span className={styles.muted} title="Only the person who connected it can change permissions">Managed by {entry.ownerName}</span>
                  )}
                  {!entry.inherited && <Button variant="ghost" size="sm" onClick={() => void remove(entry)}>Remove</Button>}
                </span>
              </div>
              {openPermissions === entry.id && entry.owned && (
                <div className={styles.inlinePanel}><AccountPermissions entry={entry} /></div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
