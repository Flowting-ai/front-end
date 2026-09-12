'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { useOrg } from '@/context/org-context'
import {
  ConnectorCatalog,
  ConnectorConnection,
  getConnector,
  listLinkedConnectors,
  unlinkAccount,
} from '@/lib/api/connectors'
import type { SetupFlowResult } from '@/lib/useConnectorSetupFlow'
import { ConnectionsView } from './ConnectionsView'
import { ConnectorDetailView } from './ConnectorDetailView'
import { AccountDetailView } from './AccountDetailView'
import { SetupModal } from './SetupModal'
import { RemoveModal } from './RemoveModal'

type View = 'connections' | 'connector' | 'permissions' | 'access' | 'settings'

export function ConnectorsExperience({ initialSearch = '' }: { initialSearch?: string }) {
  const { orgId, orgReady } = useOrg()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [catalog, setCatalog] = useState<ConnectorCatalog[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('connections')
  const [activeSlug, setActiveSlug] = useState<string | null>(null)
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null)

  const [setupOpen, setSetupOpen] = useState(false)
  const [setupMode, setSetupMode] = useState<'connect' | 'reconnect'>('connect')
  const [setupAccount, setSetupAccount] = useState<ConnectorConnection | undefined>(undefined)

  const [removeAccount, setRemoveAccount] = useState<ConnectorConnection | null>(null)
  const [removeBusy, setRemoveBusy] = useState(false)
  // Slug whose catalog card is mid-fetch (selectFromCatalog's cold-start
  // path) — lets the card show a spinner instead of staying clickable while
  // it silently loads connector details before the setup modal opens.
  const [pendingSlug, setPendingSlug] = useState<string | null>(null)

  const mergeRows = useCallback((rows: ConnectorCatalog[]) => {
    setCatalog(prev => {
      const bySlug = new Map(prev.map(row => [row.slug, row]))
      for (const row of rows) bySlug.set(row.slug, row)
      return [...bySlug.values()]
    })
  }, [])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await listLinkedConnectors()
      setCatalog(rows)
      return rows
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load connectors')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchAll() }, [fetchAll])

  useEffect(() => {
    const isTabView = view === 'permissions' || view === 'access' || view === 'settings'
    const nextTab = isTabView ? view : null
    if (searchParams.get('tab') === nextTab) return
    const params = new URLSearchParams(searchParams.toString())
    if (nextTab) params.set('tab', nextTab)
    else params.delete('tab')
    const query = params.toString()
    router.replace(`${pathname}${query ? `?${query}` : ''}`, { scroll: false })
  }, [view, pathname, router, searchParams])

  const active = catalog.find(row => row.slug === activeSlug) ?? null
  const activeAccount = active?.connections.find(row => row.id === activeAccountId) ?? null

  const loadDetail = useCallback((slug: string) => {
    void getConnector(slug)
      .then(detail => {
        setCatalog(prev => prev.map(row => row.slug === detail.slug ? detail : row))
      })
      .catch(() => { /* list row stays usable without tools */ })
  }, [])

  const openConnectorDetail = useCallback((row: ConnectorCatalog) => {
    setActiveSlug(row.slug)
    setView('connector')
    loadDetail(row.slug)
  }, [loadDetail])

  const selectFromCatalog = useCallback((row: ConnectorCatalog) => {
    mergeRows([row])
    if (row.connections.length > 0) {
      openConnectorDetail(row)
      return
    }
    setActiveSlug(row.slug)
    setPendingSlug(row.slug)
    void getConnector(row.slug)
      .then(detail => {
        mergeRows([detail])
        setSetupMode('connect')
        setSetupAccount(undefined)
        setSetupOpen(true)
      })
      .catch(() => {
        setSetupMode('connect')
        setSetupAccount(undefined)
        setSetupOpen(true)
      })
      .finally(() => setPendingSlug(null))
  }, [mergeRows, openConnectorDetail])

  const addAccount = useCallback(() => {
    setSetupMode('connect')
    setSetupAccount(undefined)
    setSetupOpen(true)
  }, [])

  const openAccount = useCallback((account: ConnectorConnection) => {
    setActiveAccountId(account.id)
    setView('permissions')
  }, [])

  const reconnectAccount = useCallback((account: ConnectorConnection) => {
    setActiveAccountId(account.id)
    setSetupMode('reconnect')
    setSetupAccount(account)
    setSetupOpen(true)
  }, [])

  const backToConnections = useCallback(() => {
    setView('connections')
    setActiveSlug(null)
    setActiveAccountId(null)
  }, [])

  const backToConnector = useCallback(() => {
    setView('connector')
    setActiveAccountId(null)
  }, [])

  useEffect(() => {
    if (loading || view === 'connections') return
    const accountMissing = view !== 'connector' && !activeAccount
    if (!active || accountMissing) backToConnections()
  }, [loading, view, active, activeAccount, backToConnections])

  const handleSetupConnected = useCallback((_result: SetupFlowResult) => {
    setSetupOpen(false)
    void fetchAll()
  }, [fetchAll])

  const requestRemove = useCallback((account: ConnectorConnection) => {
    setRemoveAccount(account)
  }, [])

  const confirmRemove = useCallback(async () => {
    if (!removeAccount || !removeAccount.owned) return
    setRemoveBusy(true)
    try {
      // One id, whether it is shared or not — the row is the account.
      await unlinkAccount(removeAccount.id)
      toast.success(`${removeAccount.nickname} removed`)
      setRemoveAccount(null)
      const rows = await fetchAll()
      const slug = removeAccount.connectorSlug
      const stillLinked = rows?.some(row => row.slug === slug && row.connections.length > 0) ?? false
      if (stillLinked) backToConnector()
      else backToConnections()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove account')
    } finally {
      setRemoveBusy(false)
    }
  }, [removeAccount, backToConnector, backToConnections, fetchAll])

  if (!orgReady) {
    return <ConnectionsView catalog={[]} loading select={() => {}} />
  }

  return (
    <>
      {view === 'connections' && (
        <ConnectionsView catalog={catalog} loading={loading} select={selectFromCatalog} pendingSlug={pendingSlug} initialSearch={initialSearch} onRows={mergeRows} />
      )}

      {view === 'connector' && active && (
        <ConnectorDetailView
          catalog={active}
          back={backToConnections}
          addAccount={addAccount}
          openAccount={openAccount}
          reconnectAccount={reconnectAccount}
        />
      )}

      {(view === 'permissions' || view === 'access' || view === 'settings') && active && activeAccount && (
        <AccountDetailView
          account={activeAccount}
          catalog={active}
          active={view}
          back={backToConnector}
          change={setView}
          // Was `fetchAll()` — the list endpoint intentionally omits each
          // connector's tools and each account's per-tool permissions (backend:
          // page_user_connectors always calls withPermissions=False and never
          // passes catalog_tools; only GET /connectors/{slug} includes them).
          // Refreshing via the list after a permission/access/label edit wiped
          // that data back to empty, so permissionSummary() fell back to
          // 'custom' and a freshly re-opened Permissions tab re-fetched from
          // scratch — looking "wrong until reload". loadDetail hits the single-
          // connector detail endpoint instead, so tools/permissions stay
          // populated and in sync everywhere this connector is shown.
          onChanged={() => loadDetail(active.slug)}
          onRemove={() => requestRemove(activeAccount)}
        />
      )}

      {setupOpen && active && (
        <SetupModal
          catalog={active}
          orgId={orgId}
          mode={setupMode}
          initialAccount={setupAccount}
          cancel={() => setSetupOpen(false)}
          onConnected={handleSetupConnected}
        />
      )}

      {removeAccount && active && (
        <RemoveModal
          account={removeAccount}
          catalog={active}
          blockedReason={removeAccount.owned ? undefined : 'This account was shared with you. Only the person who connected it can remove it.'}
          busy={removeBusy}
          cancel={() => setRemoveAccount(null)}
          confirm={() => void confirmRemove()}
        />
      )}
    </>
  )
}
