'use client'

// Top-level state machine for the new Connectors UI — the real-data
// equivalent of the story's `Experience` component. Mounted by both
// /connectors and /settings/connectors (see docs v1.5/connectors-v1.5-migration-plan.md
// §0 — this migration consolidates those two old pages into one).

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useOrg } from '@/context/org-context'
import { listConnectors, unlinkConnector, type ConnectorCatalogEntry } from '@/lib/api/connectors'
import { deleteOrgConnectorAccount, getConnectorUsedBy } from '@/lib/api/org-connectors'
import { summarizeCatalog, type UnifiedAccount, type UnifiedConnectorSummary } from '@/lib/connectorsUnified'
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
  const [entries, setEntries] = useState<ConnectorCatalogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('connections')
  const [activeSlug, setActiveSlug] = useState<string | null>(null)
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null)

  const [setupOpen, setSetupOpen] = useState(false)
  const [setupMode, setSetupMode] = useState<'connect' | 'reconnect'>('connect')
  const [setupAccount, setSetupAccount] = useState<UnifiedAccount | undefined>(undefined)

  const [customOpen, setCustomOpen] = useState(false)
  const [removeAccount, setRemoveAccount] = useState<UnifiedAccount | null>(null)
  const [removeMaybeInUse, setRemoveMaybeInUse] = useState(false)
  const [removeBusy, setRemoveBusy] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      setEntries(await listConnectors())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load connectors')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchAll() }, [fetchAll])

  const summaries = useMemo(() => summarizeCatalog(entries), [entries])
  const activeSummary = summaries.find(s => s.slug === activeSlug) ?? null
  const activeAccount = activeSummary?.accounts.find(a => a.id === activeAccountId) ?? null

  // The backend still gates every shared-account mutation (create/update/
  // delete) to org owners/admins (`require_organization_admin` in
  // services/organizations/router.py) — the newer Connectors v1 UX spec says
  // there should be no role differences at all, but the backend hasn't
  // caught up to that yet. Until it does, reflect the real capability rather
  // than showing an action that only 403s at the last step.
  const canManageShared = currentUserRole === 'admin'

  const openConnectorDetail = useCallback((summary: UnifiedConnectorSummary) => {
    setActiveSlug(summary.slug)
    setView('connector')
  }, [])

  const selectFromCatalog = useCallback((summary: UnifiedConnectorSummary) => {
    if (summary.accounts.length > 0) {
      openConnectorDetail(summary)
    } else {
      setActiveSlug(summary.slug)
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

  const openAccount = useCallback((account: UnifiedAccount) => {
    setActiveAccountId(account.id)
    setView('permissions')
  }, [])

  const reconnectAccount = useCallback((account: UnifiedAccount) => {
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

  const requestRemove = useCallback(async (account: UnifiedAccount) => {
    setRemoveAccount(account)
    setRemoveMaybeInUse(false)
    // Coarse org-level "is this connector referenced anywhere" check only —
    // see Gap #3. Best-effort; a failure here shouldn't block the confirm dialog.
    if (orgId) {
      try {
        const usedBy = await getConnectorUsedBy(orgId, account.connectorSlug)
        setRemoveMaybeInUse(usedBy.length > 0)
      } catch {
        // stay silent — the dialog still works without this signal
      }
    }
  }, [orgId])

  const confirmRemove = useCallback(async () => {
    if (!removeAccount) return
    if (removeAccount.visibility === 'shared' && !canManageShared) return
    setRemoveBusy(true)
    try {
      // Removal is a plain, one-shot call — no need for the full setup state
      // machine, so it's called directly here rather than routed through
      // useConnectorSetupFlow.
      if (removeAccount.visibility === 'shared') {
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
  }, [removeAccount, orgId, backToConnector, fetchAll])

  if (!orgReady) {
    return <ConnectionsView summaries={[]} loading select={() => {}} custom={() => {}} />
  }

  return (
    <>
      {view === 'connections' && (
        <ConnectionsView summaries={summaries} loading={loading} select={selectFromCatalog} custom={() => setCustomOpen(true)} initialSearch={initialSearch} />
      )}

      {view === 'connector' && activeSummary && (
        <ConnectorDetailView
          summary={activeSummary}
          back={backToConnections}
          addAccount={addAccount}
          openAccount={openAccount}
          reconnectAccount={reconnectAccount}
        />
      )}

      {(view === 'permissions' || view === 'access' || view === 'settings') && activeSummary && activeAccount && (
        <AccountDetailView
          account={activeAccount}
          summary={activeSummary}
          orgId={orgId}
          canManageShared={canManageShared}
          active={view}
          back={backToConnector}
          change={setView}
          onChanged={() => void fetchAll()}
          onRemove={() => void requestRemove(activeAccount)}
        />
      )}

      {setupOpen && activeSummary && (
        <SetupModal
          summary={activeSummary}
          orgId={orgId}
          canManageShared={canManageShared}
          mode={setupMode}
          initialAccount={setupAccount}
          cancel={() => setSetupOpen(false)}
          onConnected={handleSetupConnected}
        />
      )}

      {removeAccount && activeSummary && (
        <RemoveModal
          account={removeAccount}
          summary={activeSummary}
          maybeInUse={removeMaybeInUse}
          blockedReason={removeAccount.visibility === 'shared' && !canManageShared ? 'Only workspace admins can remove shared accounts.' : undefined}
          busy={removeBusy}
          cancel={() => setRemoveAccount(null)}
          confirm={() => void confirmRemove()}
        />
      )}

      {customOpen && <CustomConnectorModal cancel={() => setCustomOpen(false)} />}
    </>
  )
}
