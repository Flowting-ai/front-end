'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { useOrg } from '@/context/org-context'
import {
  ConnectorCatalog,
  ConnectorConnection,
  deleteCustomApi,
  getConnector,
  listLinkedConnectors,
  unlinkAccount,
} from '@/lib/api/connectors'
import type { SetupFlowResult } from '@/lib/useConnectorSetupFlow'
import { ConnectionsView } from './ConnectionsView'
import { ConnectorDetailView } from './ConnectorDetailView'
import { AccountDetailView } from './AccountDetailView'
import { SetupModal } from './SetupModal'
import { CustomApiModal } from './CustomApiModal'
import { ConfirmModal } from '@/components/ConfirmModal'
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

  // `?add=api` is the link the model hands out for adding a custom API.
  const [customApiOpen, setCustomApiOpen] = useState(() => searchParams.get('add') === 'api')
  const [deleteApiOpen, setDeleteApiOpen] = useState(false)

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

  // Was `useEffect(() => { void fetchAll() }, [fetchAll])` — fetchAll's own
  // first statement (setLoading(true)) runs synchronously the instant it's
  // called, which is exactly what react-hooks/set-state-in-effect flags when
  // that call sits directly in an effect body. `loading` already starts
  // `true` via its own useState initializer, so the mount fetch never
  // actually needed to set it again — only needs to flip it back to `false`
  // once the request settles, which is the documented "setState inside an
  // async callback" shape the rule allows. Inlined here (rather than reusing
  // fetchAll, which the linter still flags by tracing into its body
  // regardless of a boolean flag) so this effect's own reachable synchronous
  // code contains no setState at all. fetchAll itself is unchanged and still
  // used as-is by confirmRemove/handleSetupConnected below, both called from
  // event handlers, not an effect, so the rule doesn't apply there.
  useEffect(() => {
    let cancelled = false
    void listLinkedConnectors()
      .then(rows => { if (!cancelled) setCatalog(rows) })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load connectors')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

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

  // `?connector=<slug>` is the link Slack's Connect buttons and the model open:
  // land on that app, not the whole catalog.
  const linkedSlug = searchParams.get('connector')
  useEffect(() => {
    if (!linkedSlug || !orgReady) return
    let cancelled = false
    void getConnector(linkedSlug)
      .then(entry => { if (!cancelled) selectFromCatalog(entry) })
      .catch(() => { if (!cancelled) toast.error(`Couldn't find the ${linkedSlug} connector`) })
    return () => { cancelled = true }
  }, [linkedSlug, orgReady, selectFromCatalog])

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

      {view === 'connector' && active && (
        <ConnectorDetailView
          catalog={active}
          back={backToConnections}
          addAccount={addAccount}
          openAccount={openAccount}
          reconnectAccount={reconnectAccount}
          deleteApi={() => setDeleteApiOpen(true)}
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
