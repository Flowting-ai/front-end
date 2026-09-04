'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { useOrg } from '@/context/org-context'
import {
  ConnectorCatalog,
  ConnectorConnection,
  getConnector,
  listConnectors,
  unlinkConnector,
} from '@/lib/api/connectors'
import { deleteOrgConnectorAccount, getConnectorUsedBy } from '@/lib/api/org-connectors'
import type { SetupFlowResult } from '@/lib/useConnectorSetupFlow'
import { ConnectionsView } from './ConnectionsView'
import { ConnectorDetailView } from './ConnectorDetailView'
import { AccountDetailView } from './AccountDetailView'
import { SetupModal } from './SetupModal'
import { RemoveModal } from './RemoveModal'
import { CustomConnectorModal } from './CustomConnectorModal'

type View = 'connections' | 'connector' | 'permissions' | 'access' | 'settings'

export function ConnectorsExperience({ initialSearch = '' }: { initialSearch?: string }) {
  const { orgId, orgReady, currentUserRole } = useOrg()
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

  const [customOpen, setCustomOpen] = useState(false)
  const [removeAccount, setRemoveAccount] = useState<ConnectorConnection | null>(null)
  const [removeMaybeInUse, setRemoveMaybeInUse] = useState(false)
  const [removeBusy, setRemoveBusy] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      setCatalog(await listConnectors())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load connectors')
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
  const canManageShared = currentUserRole === 'admin'

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
    if (row.connections.length > 0) {
      openConnectorDetail(row)
    } else {
      setActiveSlug(row.slug)
      setSetupMode('connect')
      setSetupAccount(undefined)
      setSetupOpen(true)
    }
  }, [openConnectorDetail])

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

  const handleSetupConnected = useCallback((_result: SetupFlowResult) => {
    setSetupOpen(false)
    void fetchAll()
  }, [fetchAll])

  const requestRemove = useCallback(async (account: ConnectorConnection) => {
    setRemoveAccount(account)
    setRemoveMaybeInUse(false)
    if (orgId) {
      try {
        const usedBy = await getConnectorUsedBy(orgId, account.connectorSlug)
        setRemoveMaybeInUse(usedBy.length > 0)
      } catch {
        // dialog still works without this signal
      }
    }
  }, [orgId])

  const confirmRemove = useCallback(async () => {
    if (!removeAccount) return
    if (removeAccount.isShared && !canManageShared) return
    setRemoveBusy(true)
    try {
      if (removeAccount.isShared) {
        if (!orgId) throw new Error('No organization context.')
        await deleteOrgConnectorAccount(orgId, removeAccount.id)
      } else {
        await unlinkConnector(removeAccount.connectorSlug)
      }
      toast.success(`${removeAccount.nickname} removed`)
      setRemoveAccount(null)
      backToConnector()
      await fetchAll()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove account')
    } finally {
      setRemoveBusy(false)
    }
  }, [removeAccount, orgId, canManageShared, backToConnector, fetchAll])

  if (!orgReady) {
    return <ConnectionsView catalog={[]} loading select={() => {}} custom={() => {}} />
  }

  return (
    <>
      {view === 'connections' && (
        <ConnectionsView catalog={catalog} loading={loading} select={selectFromCatalog} custom={() => setCustomOpen(true)} initialSearch={initialSearch} />
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
          orgId={orgId}
          canManageShared={canManageShared}
          active={view}
          back={backToConnector}
          change={setView}
          onChanged={() => void fetchAll()}
          onRemove={() => void requestRemove(activeAccount)}
        />
      )}

      {setupOpen && active && (
        <SetupModal
          catalog={active}
          orgId={orgId}
          canManageShared={canManageShared}
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
          maybeInUse={removeMaybeInUse}
          blockedReason={removeAccount.isShared && !canManageShared ? 'Only workspace admins can remove shared accounts.' : undefined}
          busy={removeBusy}
          cancel={() => setRemoveAccount(null)}
          confirm={() => void confirmRemove()}
        />
      )}

      {customOpen && <CustomConnectorModal cancel={() => setCustomOpen(false)} />}
    </>
  )
}
