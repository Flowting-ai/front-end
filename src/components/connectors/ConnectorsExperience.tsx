'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useOrg } from '@/context/org-context'
import {
  ConnectorCatalog,
  ConnectorConnection,
  deleteCustomApi,
  unlinkAccount,
} from '@/lib/api/connectors'
import { connectorDetailQuery, linkedConnectorsQuery, mergeCatalog } from '@/lib/connectors/connector-queries'
import { queryKeys } from '@/lib/query-keys'
import type { ConnectorPick } from '@/lib/api/recommendations'
import type { SetupFlowResult } from '@/lib/useConnectorSetupFlow'
import { ConnectionsView } from './ConnectionsView'
import { ConnectorDetailView } from './ConnectorDetailView'
import { AccountDetailView, CustomApiModal, RemoveModal, SetupModal } from './lazy'
import { ConfirmModal } from '@/components/ConfirmModal'
import { BlockErrorBoundary } from '@/components/chat/BlockErrorBoundary'

type View = 'connections' | 'connector' | 'account'

export function ConnectorsExperience({ initialSearch = '' }: { initialSearch?: string }) {
  const { orgId, orgReady } = useOrg()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  // Linked connectors are server state (React Query: refetched after every
  // connector change via bustConnectorCatalogCache, and on window focus, which
  // picks up a connect finished in another tab). `extras` holds catalogue rows
  // the user browsed or picked that aren't linked yet.
  const linkedQ = useQuery(linkedConnectorsQuery())
  const [extras, setExtras] = useState<Map<string, ConnectorCatalog>>(() => new Map())
  const catalog = useMemo(() => mergeCatalog(linkedQ.data, extras.values()), [linkedQ.data, extras])
  const loading = linkedQ.isPending
  const [view, setView] = useState<View>('connections')
  const [activeSlug, setActiveSlug] = useState<string | null>(null)
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null)

  const [setupOpen, setSetupOpen] = useState(false)
  const [setupMode, setSetupMode] = useState<'connect' | 'reconnect'>('connect')
  const [setupAccount, setSetupAccount] = useState<ConnectorConnection | undefined>(undefined)

  // `?add=api` is the link the model hands out for adding a custom API.
  const [customApiOpen, setCustomApiOpen] = useState(() => searchParams.get('add') === 'api')
  const [deleteApiOpen, setDeleteApiOpen] = useState(false)

  const [removeAccount, setRemoveAccount] = useState<ConnectorConnection | null>(null)
  const [removeBusy, setRemoveBusy] = useState(false)
  // Slug whose catalog card is mid-fetch (selectFromCatalog's cold-start
  // path) — lets the card show a spinner instead of staying clickable while
  // it silently loads connector details before the setup modal opens.
  const [pendingSlug, setPendingSlug] = useState<string | null>(null)

  useEffect(() => {
    if (!linkedQ.isError) return
    toast.error(linkedQ.error instanceof Error ? linkedQ.error.message : 'Failed to load connectors')
  }, [linkedQ.isError, linkedQ.error, linkedQ.errorUpdatedAt])

  const mergeRows = useCallback((rows: ConnectorCatalog[]) => {
    setExtras(prev => {
      const next = new Map(prev)
      for (const row of rows) next.set(row.slug, row)
      return next
    })
  }, [])

  /** Refetch the linked list now (after a change); resolves to the fresh rows, or null on failure. */
  const fetchAll = useCallback(async () => {
    try {
      const rows = await queryClient.fetchQuery({ ...linkedConnectorsQuery(), staleTime: 0 })
      // Linked rows are the truth again; drop picked copies that may be stale.
      setExtras(new Map())
      return rows
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load connectors')
      return null
    }
  }, [queryClient])

  // The list endpoint omits each connector's tools and each account's per-tool
  // permissions (only GET /connectors/{slug} has them), so the open connector
  // reads its detail query and falls back to the list row while it loads or
  // if it fails.
  const detailQ = useQuery({ ...connectorDetailQuery(activeSlug ?? ''), enabled: !!activeSlug })
  const listRow = catalog.find(row => row.slug === activeSlug) ?? null
  const active = (detailQ.data?.slug === activeSlug ? detailQ.data : undefined) ?? listRow
  const activeAccount = active?.connections.find(row => row.id === activeAccountId) ?? null

  const loadDetail = useCallback((slug: string) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.connectors.detail(slug) })
  }, [queryClient])

  const openConnectorDetail = useCallback((row: ConnectorCatalog) => {
    setActiveSlug(row.slug)
    setView('connector')
  }, [])

  const selectFromCatalog = useCallback((row: ConnectorCatalog | ConnectorPick) => {
    if ('connections' in row) mergeRows([row])
    if ('connections' in row && row.connections.length > 0) {
      openConnectorDetail(row)
      return
    }
    setActiveSlug(row.slug)
    setPendingSlug(row.slug)
    void queryClient.fetchQuery(connectorDetailQuery(row.slug))
      .then(detail => {
        mergeRows([detail])
        setSetupMode('connect')
        setSetupAccount(undefined)
        setSetupOpen(true)
      })
      .catch(() => {
        if (!('connections' in row)) {
          toast.error(`Couldn't load ${row.name}. Please try again.`)
          return
        }
        setSetupMode('connect')
        setSetupAccount(undefined)
        setSetupOpen(true)
      })
      .finally(() => setPendingSlug(null))
  }, [mergeRows, openConnectorDetail, queryClient])

  // `?connector=<slug>` is the link Slack's Connect buttons and the model open:
  // land on that app, not the whole catalog.
  const linkedSlug = searchParams.get('connector')
  useEffect(() => {
    if (!linkedSlug || !orgReady) return
    let cancelled = false
    void queryClient.fetchQuery(connectorDetailQuery(linkedSlug))
      .then(entry => { if (!cancelled) selectFromCatalog(entry) })
      .catch(() => { if (!cancelled) toast.error(`Couldn't find the ${linkedSlug} connector`) })
    return () => { cancelled = true }
  }, [linkedSlug, orgReady, selectFromCatalog, queryClient])

  // The modal linked its token already: land on the new API's page.
  const customApiCreated = useCallback((entry: ConnectorCatalog) => {
    setCustomApiOpen(false)
    toast.success(`${entry.name} connected`)
    void fetchAll().then(rows => {
      const row = rows?.find(candidate => candidate.slug === entry.slug)
      if (row) openConnectorDetail(row)
    })
  }, [fetchAll, openConnectorDetail])

  const addAccount = useCallback(() => {
    setSetupMode('connect')
    setSetupAccount(undefined)
    setSetupOpen(true)
  }, [])

  const openAccount = useCallback((account: ConnectorConnection) => {
    setActiveAccountId(account.id)
    setView('account')
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

  // Was a useEffect bailing the view back to 'connections' whenever the
  // active connector/account it needs has gone missing (e.g. removed
  // elsewhere, or a stale slug after a refetch) — a pure "does the current
  // view still make sense given the data we have" check with no external
  // system to subscribe to, so it converts cleanly to React's documented
  // "adjust state during render" pattern instead of an effect. Self-
  // terminating: backToConnections() sets view to 'connections', which makes
  // `invalidView` false on the very next evaluation.
  const accountMissing = view !== 'connector' && !activeAccount
  const invalidView = !loading && view !== 'connections' && (!active || accountMissing)
  if (invalidView) backToConnections()

  const handleSetupConnected = useCallback((_result: SetupFlowResult) => {
    setSetupOpen(false)
    void fetchAll()
  }, [fetchAll])

  // Throws on failure so ConfirmModal stays open and toasts the error.
  const confirmDeleteApi = useCallback(async () => {
    if (!active) return
    await deleteCustomApi(active.slug)
    toast.success(`${active.name} deleted`)
    backToConnections()
    void fetchAll()
  }, [active, backToConnections, fetchAll])

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
    return <ConnectionsView catalog={[]} loading select={() => {}} addCustomApi={() => {}} />
  }

  return (
    <>
      {view === 'connections' && (
        <ConnectionsView catalog={catalog} loading={loading} select={selectFromCatalog} addCustomApi={() => setCustomApiOpen(true)} pendingSlug={pendingSlug} initialSearch={initialSearch} onRows={mergeRows} />
      )}

      {(view === 'connector' || view === 'account') && active && (
        // A render error in one panel shows a notice instead of blanking the page.
        <BlockErrorBoundary label="connector" resetKey={active.slug}>
        <ConnectorDetailView
          catalog={active}
          back={backToConnections}
          addAccount={addAccount}
          openAccount={openAccount}
          reconnectAccount={reconnectAccount}
          deleteApi={() => setDeleteApiOpen(true)}
        />
        </BlockErrorBoundary>
      )}

      {view === 'account' && active && activeAccount && (
        <BlockErrorBoundary label="account" resetKey={activeAccount.id}>
        <AccountDetailView
          account={activeAccount}
          catalog={active}
          close={backToConnector}
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
        </BlockErrorBoundary>
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

      {deleteApiOpen && active && (
        <ConfirmModal
          title={`Delete ${active.name}?`}
          description={
            active.connections.length > 0
              ? 'Its accounts go with it, shared ones included, along with any agents or automations that call it.'
              : 'Souvenir stops calling this API.'
          }
          confirmLabel="Delete"
          onConfirm={confirmDeleteApi}
          onClose={() => setDeleteApiOpen(false)}
        />
      )}

      {customApiOpen && (
        <CustomApiModal cancel={() => setCustomApiOpen(false)} onCreated={customApiCreated} />
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
