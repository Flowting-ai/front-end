import { queryOptions, type QueryClient } from '@tanstack/react-query'
import { getOrg, listAudit, listMembers, listOrganizations } from '@/lib/api/organization'
import { Plan } from '@/lib/api/plan'
import { queryKeys } from '@/lib/query-keys'
import { orgIdCacheKey } from '@/lib/storage-keys'
import type { WorkspaceOrg } from '@/types/teams'

/**
 * React Query for the workspace: which org the viewer is in, the org record
 * (name, my role), the plan (credit pool) and the member list. Used by
 * context/org-context.tsx. Logout clears all of it (clearUserScopedCache).
 */

export type OrgInfo = Awaited<ReturnType<typeof getOrg>>

/** Last org id resolved for this user, so a reload doesn't wait on GET /organizations. */
export function readCachedOrgId(userId: string): string | null {
  // No user id yet: never read (or write) a key shared by every account.
  if (!userId) return null
  try { return localStorage.getItem(orgIdCacheKey(userId)) } catch { return null }
}

function writeCachedOrgId(userId: string, id: string | null) {
  if (!userId) return
  try {
    if (id) localStorage.setItem(orgIdCacheKey(userId), id)
    else localStorage.removeItem(orgIdCacheKey(userId))
  } catch { /* storage unavailable */ }
}

/** GET /organizations → the first org's id (multi-org selection is a backend question). */
export const orgMembershipQuery = (userId: string, enabled: boolean) =>
  queryOptions({
    queryKey: queryKeys.orgs.membership(userId),
    queryFn: async () => {
      const id = (await listOrganizations())[0]?.id ?? null
      writeCachedOrgId(userId, id)
      return id
    },
    enabled,
  })

export const orgInfoQuery = (orgId: string | null) =>
  queryOptions({
    queryKey: queryKeys.orgs.info(orgId ?? ''),
    queryFn: () => getOrg(orgId!),
    enabled: !!orgId,
  })

export const orgPlanQuery = (orgId: string | null) =>
  queryOptions({
    queryKey: queryKeys.orgs.plan(orgId ?? ''),
    queryFn: () => Plan.fetch(orgId!),
    enabled: !!orgId,
  })

/**
 * Members come from /members so roles are accurate; if that fails, the members
 * bundled in the plan response are the fallback.
 */
export const orgMembersQuery = (qc: QueryClient, orgId: string | null) =>
  queryOptions({
    queryKey: queryKeys.orgs.members(orgId ?? ''),
    queryFn: async () => {
      try {
        return await listMembers(orgId!)
      } catch (err) {
        const plan = await qc.fetchQuery(orgPlanQuery(orgId)).catch(() => null)
        if (plan) return plan.members
        throw err
      }
    },
    enabled: !!orgId,
  })

/** The latest 100 audit entries (paging needs backend cursors — see the audit's gaps). */
export const orgAuditQuery = (orgId: string | null) =>
  queryOptions({
    queryKey: queryKeys.orgs.audit(orgId ?? ''),
    queryFn: () => listAudit(orgId!, { limit: 100 }),
    enabled: !!orgId,
  })

/**
 * Publish a renamed/re-logoed workspace to everything showing it — the sidebar's
 * account row, the org badge, the "Manage <org>" items. The new values are written
 * into the cache first so the change lands in the same frame as the toast, then the
 * query is invalidated to reconcile with whatever the server actually stored.
 */
export function updateCachedOrgInfo(
  qc: QueryClient,
  orgId: string | null,
  patch: { name?: string; logoUrl?: string | null },
): void {
  if (!orgId) return
  const key = queryKeys.orgs.info(orgId)
  qc.setQueryData(key, (prev: OrgInfo | undefined) => prev ? { ...prev, ...patch } : prev)
  void qc.invalidateQueries({ queryKey: key })
}

/** Refetch the plan and members after a change (invite, removal, cap, plan change). */
export function refreshOrgMembers(qc: QueryClient, orgId: string | null): void {
  if (!orgId) return
  void qc.invalidateQueries({ queryKey: queryKeys.orgs.plan(orgId) })
  void qc.invalidateQueries({ queryKey: queryKeys.orgs.members(orgId) })
}

/**
 * The org view model, or null until something about it has loaded (no fake
 * name/plan defaults). The plan's type wins over the org record's.
 */
export function deriveOrg(orgId: string | null, info: OrgInfo | undefined, plan: Plan | null | undefined): WorkspaceOrg | null {
  if (!orgId || (!info && !plan)) return null
  return {
    id: orgId,
    name: info?.name ?? '',
    plan: plan?.planType ?? info?.planType ?? 'teams',
  }
}
