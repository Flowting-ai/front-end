import { queryOptions, type QueryClient } from '@tanstack/react-query'
import {
  fetchDashboard,
  listReceived,
  listShares,
  type PersonaShare,
  type ShareDashboardResponse,
} from '@/lib/api/persona-shares'
import { bustPersonasCache } from '@/lib/api/persona-cache'
import { queryKeys } from '@/lib/query-keys'
import { STALE_REALTIME_MS } from '@/lib/query-policy'

/**
 * React Query for agent shares (Super Links and email invites). One
 * `persona-shares` list feeds the share modal, the published page, the agents
 * panel badges and the agents page filter, instead of four separate fetches.
 * Writes go through `rememberShare` / `forgetShare`, which update the list and
 * refetch the dashboard.
 */

export const personaSharesQuery = (enabled = true) =>
  queryOptions({ queryKey: queryKeys.shares.persona(), queryFn: listShares, enabled })

/** Usage numbers change as recipients chat, so the dashboard is always refetched on view. */
export const shareDashboardQuery = (days: 7 | 30 | 90, enabled = true) =>
  queryOptions({
    queryKey: queryKeys.shares.dashboard(days),
    queryFn: () => fetchDashboard(days),
    staleTime: STALE_REALTIME_MS,
    enabled,
  })

export const receivedSharesQuery = (enabled = true) =>
  queryOptions({ queryKey: queryKeys.shares.received(), queryFn: listReceived, staleTime: STALE_REALTIME_MS, enabled })

// ── Selectors ────────────────────────────────────────────────────────────────

/** The active link share for an agent (shares are repo-scoped, not per version). */
export function activeLinkFor(shares: PersonaShare[] | undefined, repoId: string): PersonaShare | null {
  return shares?.find(s => s.persona_repo_id === repoId && s.share_type === 'link' && s.is_active) ?? null
}

/** Active email invites for an agent. */
export function activeInvitesFor(shares: PersonaShare[] | undefined, repoId: string): PersonaShare[] {
  return shares?.filter(s => s.persona_repo_id === repoId && s.share_type === 'email' && s.is_active) ?? []
}

/** Repo ids that currently have an active Super Link. */
export function activeLinkRepoIds(shares: PersonaShare[] | undefined): Set<string> {
  return new Set((shares ?? []).filter(s => s.is_active && s.share_type === 'link').map(s => s.persona_repo_id))
}

// ── Cache writes ─────────────────────────────────────────────────────────────

function refreshDashboards(qc: QueryClient) {
  void qc.invalidateQueries({ predicate: q => q.queryKey[0] === 'shares' && q.queryKey[1] === 'dashboard' })
}

/** After createShare: add it to the list and refetch dashboards. */
export function rememberShare(qc: QueryClient, share: PersonaShare): void {
  qc.setQueryData<PersonaShare[]>(queryKeys.shares.persona(), prev => [...(prev ?? []).filter(s => s.id !== share.id), share])
  refreshDashboards(qc)
}

/** After revokeShare: drop it from the list and from cached dashboards. */
export function forgetShare(qc: QueryClient, id: string): void {
  qc.setQueryData<PersonaShare[]>(queryKeys.shares.persona(), prev => prev?.filter(s => s.id !== id))
  qc.setQueriesData<ShareDashboardResponse>(
    { predicate: q => q.queryKey[0] === 'shares' && q.queryKey[1] === 'dashboard' },
    prev => (prev ? { ...prev, links: prev.links.filter(s => s.id !== id) } : prev),
  )
  refreshDashboards(qc)
}

/** After accepting a share: the agent joins the viewer's agents list and "Shared with me". */
export function afterShareAccepted(qc: QueryClient): void {
  bustPersonasCache()
  void qc.invalidateQueries({ queryKey: queryKeys.shares.received() })
}
