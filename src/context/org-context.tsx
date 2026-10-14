'use client'

import React, { createContext, useCallback, useContext, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/context/auth-context'
import type { Plan } from '@/lib/api/plan'
import { resolveRole, type Member } from '@/lib/roles'
import { resolveOrgRole } from '@/lib/org/role'
import {
  deriveOrg,
  orgInfoQuery,
  orgMembersQuery,
  orgMembershipQuery,
  orgPlanQuery,
  readCachedOrgId,
  refreshOrgMembers,
} from '@/lib/org/org-queries'
import type {
  WorkspaceOrg,
  OrgMember,
  OrgRole,
} from '@/types/teams'

interface OrgContextValue {
  orgId: string | null
  /** Null until the org record or plan has loaded, and for users with no org. */
  org: WorkspaceOrg | null
  members: OrgMember[]
  membersLoading: boolean
  /** The org's billing state. Every plan, cycle, and credit figure renders from here. */
  plan: Plan | null
  /** Raw API role: 'admin' | 'member'. Use this for billing/org-management gates —
   *  any admin has full billing authority, there's no separate owner tier. */
  orgRole: OrgRole
  /** Same value as `orgRole` today — kept as a separate field for consumers that
   *  were written against the old owner+admin fold. Use for general access checks. */
  currentUserRole: 'admin' | 'member'
  /**
   * Resolved capability ladder for the current user (mirrors the backend's
   * services/organizations/roles.py: Member -> Admin, no separate Owner tier).
   * Prefer `caps.canPublishToTeam(teamId)` / `caps.canEditProject(teamId)` etc.
   * over ad-hoc role string comparisons. Resolved from `orgRole`; the admin
   * gate needs no per-team grants. For a plain member, per-resource backend
   * flags (project.canEdit, chat.canEdit) remain authoritative for
   * project-scoped checks.
   */
  caps: Member
  /** Refetch the plan and member list (an invalidation; safe to call often). */
  refreshMembers: () => void
  /**
   * True once both the org id AND (if in an org) the current user's role have
   * resolved. Consumers that route based on role (e.g. the settings home
   * redirect) should wait for this so they don't act on the default 'member'.
   */
  orgReady: boolean
  /**
   * True when the org was found (orgId is set) but the getOrg() role fetch
   * failed (network error, 5xx, etc.). In this state orgRole is stuck at the
   * default 'member' even though the user may actually be an admin. Billing
   * gates should treat this as "role unknown" and fall back to optimistic access.
   */
  roleError: boolean
  /**
   * True when the org role was explicitly returned by the API (non-null).
   * False when my_role came back null — the orgRole fallback may not reflect
   * the actual role. Billing gates should treat false as "role unknown" and
   * allow access (the backend enforces real permissions on every action).
   */
  orgRoleResolved: boolean
  /**
   * True once the org plan fetch has completed (success or error). Guards the
   * billing page's liveReady gate so a failed plan fetch doesn't block rendering.
   */
  orgPlanSettled: boolean
}

const OrgContext = createContext<OrgContextValue | null>(null)

const NO_MEMBERS: OrgMember[] = []

// Server state is React Query (lib/org/org-queries.ts). The provider only
// derives the role/ready flags its 35 consumers already rely on.
export function OrgProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const userId = user ? String(user.id) : ''

  // Resolve the active org id. Prefer `org_id` from the profile, but /users/me
  // doesn't always include it — so when it's missing, discover the user's org
  // via the list endpoint, starting from the id resolved last time.
  const needsLookup = !!user && !user.orgId
  const cachedOrgId = useMemo(() => (needsLookup ? readCachedOrgId(userId) : null), [needsLookup, userId])
  const membershipQ = useQuery(orgMembershipQuery(userId, needsLookup))
  const orgId: string | null = user?.orgId
    ?? (membershipQ.isSuccess ? membershipQ.data : cachedOrgId)
    ?? null
  const orgIdResolved = !!user && (!!user.orgId || !!cachedOrgId || !membershipQ.isPending)

  // Org record (name + my role). Retries once on a transient failure (query
  // policy), so a network blip doesn't leave a real admin stuck at 'member'.
  const infoQ = useQuery(orgInfoQuery(orgId))
  const planQ = useQuery(orgPlanQuery(orgId))
  const membersQ = useQuery(orgMembersQuery(qc, orgId))

  const info = infoQ.data
  // Only the backend's my_role makes someone an admin; a null role (or no org)
  // stays an unresolved 'member' (see lib/org/role.ts).
  const { role: orgRole, resolved: orgRoleResolved } = info ? resolveOrgRole(info.role) : { role: 'member' as OrgRole, resolved: false }
  const roleResolved = !orgId ? orgIdResolved : !infoQ.isPending
  const roleError = !!orgId && infoQ.isError && !info

  const plan = planQ.data ?? null
  const org = useMemo(() => deriveOrg(orgId, info, plan), [orgId, info, plan])

  // Resolved capability ladder. The admin gate is role-only; a plain
  // member's per-team editor grants aren't loaded here (project-scoped checks
  // fall back to backend per-resource flags), so grants stay empty.
  // Keyed by the backend's user id (Auth0 sub), the same id grants and
  // ownerUserId use — not the email.
  const caps = useMemo<Member>(
    () => resolveRole(orgRole, { userId: user?.auth0Id ?? '' }),
    [orgRole, user?.auth0Id],
  )

  const refreshMembers = useCallback(() => refreshOrgMembers(qc, orgId), [qc, orgId])

  const value = useMemo<OrgContextValue>(() => ({
    orgId,
    org,
    members: membersQ.data ?? NO_MEMBERS,
    membersLoading: membersQ.isFetching,
    plan,
    orgRole,
    currentUserRole: orgRole === 'admin' ? 'admin' : 'member',
    caps,
    refreshMembers,
    orgReady: orgIdResolved && roleResolved,
    roleError,
    orgRoleResolved: !!orgId && orgRoleResolved,
    orgPlanSettled: !orgId || !planQ.isPending,
  }), [orgId, org, membersQ.data, membersQ.isFetching, plan, orgRole, caps, refreshMembers, orgIdResolved, roleResolved, roleError, orgRoleResolved, planQ.isPending])

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>
}

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error('useOrg must be used within OrgProvider')
  return ctx
}
