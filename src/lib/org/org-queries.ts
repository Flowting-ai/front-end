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
  try { return localStorage.getItem(orgIdCacheKey(userId)) } catch { return null }
}

function writeCachedOrgId(userId: string, id: string | null) {
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
