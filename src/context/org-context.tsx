'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/context/auth-context'
import { fetchTeams, bustTeamsCache } from '@/lib/api/teams'
import { getOrg, getOrgPlan, listMembers, listOrganizations } from '@/lib/api/organization'
import { resolveRole, type Member } from '@/lib/roles'
import type {
  WorkspaceOrg,
  OrgMember,
  Team,
  OrgPlan,
  OrgRole,
} from '@/types/teams'

interface OrgContextValue {
  orgId: string | null
  org: WorkspaceOrg
  members: OrgMember[]
  membersLoading: boolean
  plan: OrgPlan | null
  /** Raw API role: 'owner' | 'admin' | 'member'. Use this for billing/ownership gates. */
  orgRole: OrgRole
  /** Legacy UI role: 'admin' (covers owner+admin) | 'member'. Use for general access checks. */
  currentUserRole: 'admin' | 'editor' | 'member'
  /**
   * Resolved capability ladder for the current user (mirrors the backend's
   * services/organizations/roles.py). Prefer `caps.canPublishToTeam(teamId)` /
   * `caps.canEditProject(teamId)` etc. over ad-hoc role string comparisons.
   * Resolved from `orgRole`; owner/admin gates need no per-team grants. For a
   * plain member, per-resource backend flags (project.canEdit, chat.canEdit)
   * remain authoritative for project-scoped checks.
   */
  caps: Member
  teams: Team[]
  teamsLoading: boolean
  refreshTeams: () => void
  removeTeam: (teamId: string) => void
  refreshMembers: () => void
  activeTeamId: string | null
  setActiveTeamId: (id: string | null) => void
  activeProjectId: string | null
  setActiveProjectId: (id: string | null) => void
  /**
   * True once both the org id AND (if in an org) the current user's role have
   * resolved. Consumers that route based on role (e.g. the settings home
   * redirect) should wait for this so they don't act on the default 'member'.
   */
  orgReady: boolean
  /**
   * True when the org was found (orgId is set) but the getOrg() role fetch
   * failed (network error, 5xx, etc.). In this state orgRole is stuck at the
   * default 'member' even though the user may be the owner. Billing gates
   * should treat this as "role unknown" and fall back to optimistic access.
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

const DEFAULT_ORG: WorkspaceOrg = {
  id: '',
  name: '',
  plan: 'teams',
  monthlyPrice: 0,
  billingCycle: 'monthly',
  creditPool: {
    total:      0,
    used:       0,
    remaining:  0,
    percentUsed: 0,
  },
  tokenStatus: 'normal',
  hitlThreshold: 'tier_3_plus',
}

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()

  // The account chose the Teams plan at onboarding (role_fit). This is the
  // authoritative "this is an organization owner" signal — independent of the
  // backend's per-org `my_role`, which can come back null/member and otherwise
  // mis-classify a team owner as an individual.
  const isTeamPlan = user?.roleFit === 'small_team' || user?.roleFit === 'large_team'

  // Resolve the active org id. Prefer `org_id` from the profile, but /users/me
  // doesn't always include it — so when it's missing, discover the user's org
  // via the list endpoint. This ensures team members (and freshly-created team
  // owners) get their Organization settings instead of an empty/hidden section.
  const [resolvedOrgId, setResolvedOrgId] = useState<string | null>(user?.orgId ?? null)
  const [orgIdResolved, setOrgIdResolved] = useState<boolean>(Boolean(user?.orgId))
  useEffect(() => {
    if (!user) return // wait for the authenticated profile before deciding
    if (user.orgId) {
      setResolvedOrgId(user.orgId)
      setOrgIdResolved(true)
      return
    }
    let mounted = true
    setOrgIdResolved(false)
    listOrganizations()
      .then(orgs => { if (mounted) setResolvedOrgId(orgs[0]?.id ?? null) })
      .catch(() => { if (mounted) setResolvedOrgId(null) })
      .finally(() => { if (mounted) setOrgIdResolved(true) })
    return () => { mounted = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- user object is intentionally excluded;
  // only re-run when user identity (id) or org membership (orgId) changes, not on every
  // refreshUser() call that returns a new object reference with the same data.
  }, [user?.id, user?.orgId])
  const orgId = resolvedOrgId

  const [orgName,          setOrgName]          = useState('')
  const [orgPlanType,      setOrgPlanType]      = useState<'teams' | 'enterprise'>('teams')
  const [orgRole,          setOrgRole]          = useState<OrgRole>('member')
  const [orgRoleResolved,  setOrgRoleResolved]  = useState(false)
  const [currentUserRole,  setCurrentUserRole]  = useState<'admin' | 'editor' | 'member'>('member')
  const [plan,             setPlan]             = useState<OrgPlan | null>(null)
  const [orgPlanSettled,   setOrgPlanSettled]   = useState(false)
  const [members,          setMembers]          = useState<OrgMember[]>([])
  const [membersLoading,   setMembersLoading]   = useState(false)
  const [planRefreshToken, setPlanRefreshToken] = useState(0)

  const [teams,        setTeams]        = useState<Team[]>([])
  const [teamsLoading, setTeamsLoading] = useState(false)
  // activeTeamId persists across reloads (per org) so the chosen team — and the
  // team-scoped views that key off it, like /agents — survive a refresh instead
  // of silently resetting to "all".
  const [activeTeamId, _setActiveTeamId] = useState<string | null>(null)
  const restoredOrgRef = useRef<string | null>(null)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [teamsRefreshToken, setTeamsRefreshToken] = useState(0)

  const activeTeamStorageKey = (oid: string) => `flowting:activeTeam:${oid}`

  const setActiveTeamId = useCallback((id: string | null) => {
    _setActiveTeamId(id)
    if (typeof window === 'undefined' || !orgId) return
    try {
      if (id) localStorage.setItem(activeTeamStorageKey(orgId), id)
      else localStorage.removeItem(activeTeamStorageKey(orgId))
    } catch { /* ignore quota / disabled storage */ }
  }, [orgId])

  // Restore the persisted team once per org. Runs before teams finish loading so
  // team-scoped pages render their correct content immediately on a fresh load.
  useEffect(() => {
    if (!orgId || typeof window === 'undefined') return
    if (restoredOrgRef.current === orgId) return
    restoredOrgRef.current = orgId
    try {
      const saved = localStorage.getItem(activeTeamStorageKey(orgId))
      if (saved) _setActiveTeamId(saved)
    } catch { /* ignore */ }
  }, [orgId])

  // Fetch org name + current user role
  const [roleResolved, setRoleResolved] = useState(false)
  const [roleError,    setRoleError]    = useState(false)
  useEffect(() => {
    if (!orgIdResolved) return // wait until we know whether there's an org
    if (!orgId) {
      // No resolved org yet. A team-plan owner is still an org admin (the org
      // entity may just not be linked on the profile); everyone else is a member.
      setOrgRole(isTeamPlan ? 'owner' : 'member')
      setOrgRoleResolved(isTeamPlan) // only "resolved" if we have a real signal
      setCurrentUserRole(isTeamPlan ? 'admin' : 'member')
      setRoleError(false)
      setRoleResolved(true)
      return
    }
    setRoleResolved(false)
    setRoleError(false)
    getOrg(orgId)
      .then(data => {
        setOrgName(data.name)
        setOrgPlanType(data.planType)
        // When my_role is null, identify the owner via owner_email / owner_user_id
        // before falling back to isTeamPlan. owner_email is the most reliable signal
        // and works for users who upgraded from an individual plan (roleFit ≠ team).
        let resolvedRole: OrgRole
        let roleDefinitive: boolean
        if (data.role !== null) {
          resolvedRole  = data.role
          roleDefinitive = true
        } else {
          const emailMatch  = !!(data.ownerEmail  && user?.email && data.ownerEmail  === user.email)
          const idMatch     = !!(data.ownerUserId && user?.id    && String(data.ownerUserId) === String(user.id))
          const isOwnerMatch = emailMatch || idMatch
          resolvedRole   = isOwnerMatch ? 'owner' : (isTeamPlan ? 'owner' : 'member')
          roleDefinitive = isOwnerMatch // isTeamPlan alone is a guess
        }
        setOrgRole(resolvedRole)
        setOrgRoleResolved(roleDefinitive)
        // isTeamPlan is a guess for when the backend role is unknown (roleDefinitive
        // false) — it must NOT override a definitive 'member' answer, or every real
        // non-owner team member whose own onboarding roleFit happened to be
        // small_team/large_team gets silently promoted to 'admin' (this broke the
        // clone-before-chat logic gated on currentUserRole !== 'admin' throughout
        // the app, since a definitively-confirmed member was treated as an admin).
        setCurrentUserRole(
          resolvedRole === 'owner' || resolvedRole === 'admin'
            ? 'admin'
            : roleDefinitive ? 'member' : (isTeamPlan ? 'admin' : 'member'),
        )
      })
      .catch(err => {
        console.error(err)
        setOrgRoleResolved(false)
        setRoleError(true) // role is unknown — orgRole stays at default 'member'
      })
      .finally(() => setRoleResolved(true))
  }, [orgId, orgIdResolved, isTeamPlan])

  // Fetch plan (credit pool) and the authoritative member list. Members come
  // from the dedicated /members endpoint so roles (owner/admin/member) are
  // accurate; the plan endpoint is used only for the credit pool. They're
  // fetched independently so a failure in one doesn't blank the other; the
  // plan's bundled members are a fallback if /members fails.
  useEffect(() => {
    if (!orgId) return
    setOrgPlanSettled(false)
    setMembersLoading(true)
    const planP = getOrgPlan(orgId).then(p => {
      setPlan(p)
      setOrgPlanType(p.planType)
    }).catch(console.error).finally(() => setOrgPlanSettled(true))
    const membersP = listMembers(orgId)
      .then(setMembers)
      .catch(async () => {
        // Fallback: reuse the members bundled in the plan response.
        const p = await getOrgPlan(orgId).catch(() => null)
        if (p) setMembers(p.members)
      })
    Promise.all([planP, membersP]).finally(() => setMembersLoading(false))
  }, [orgId, planRefreshToken])

  // Fetch teams
  useEffect(() => {
    if (!orgId) return
    setTeamsLoading(true)
    fetchTeams(orgId)
      .then(setTeams)
      .catch(console.error)
      .finally(() => setTeamsLoading(false))
  }, [orgId, teamsRefreshToken])

  // Drop a persisted team that no longer exists (deleted while away). 'personal'
  // is a valid sentinel, not a team id, so it's exempt.
  useEffect(() => {
    if (teamsLoading || !activeTeamId || activeTeamId === 'personal') return
    if (!teams.some(t => t.id === activeTeamId)) setActiveTeamId(null)
  }, [teams, teamsLoading, activeTeamId, setActiveTeamId])

  function refreshTeams() {
    if (orgId) bustTeamsCache(orgId)
    setTeamsRefreshToken(t => t + 1)
  }

  function removeTeam(teamId: string) {
    setTeams(prev => prev.filter(t => t.id !== teamId))
  }

  function refreshMembers() {
    setPlanRefreshToken(t => t + 1)
  }

  // Resolved capability ladder. owner/admin gates are role-only; a plain
  // member's per-team editor grants aren't loaded here (project-scoped checks
  // fall back to backend per-resource flags), so grants stay empty.
  const caps = useMemo<Member>(
    () => resolveRole(orgRole, { userId: user?.email ?? '' }),
    [orgRole, user?.email],
  )

  const creditPool = plan
    ? {
        total:      plan.totalCredits,
        used:       plan.used,
        remaining:  plan.remaining,
        percentUsed: plan.percentUsed,
      }
    : DEFAULT_ORG.creditPool

  const org: WorkspaceOrg = {
    ...DEFAULT_ORG,
    id:         orgId ?? '',
    name:       orgName,
    plan:       orgPlanType,
    creditPool,
  }

  return (
    <OrgContext.Provider value={{
      orgId,
      org,
      members,
      membersLoading,
      plan,
      orgRole,
      currentUserRole,
      caps,
      teams,
      teamsLoading,
      refreshTeams,
      removeTeam,
      refreshMembers,
      activeTeamId,
      setActiveTeamId,
      activeProjectId,
      setActiveProjectId,
      orgReady: orgIdResolved && roleResolved,
      roleError,
      orgRoleResolved,
      orgPlanSettled: !orgId || orgPlanSettled,
    }}>
      {children}
    </OrgContext.Provider>
  )
}

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error('useOrg must be used within OrgProvider')
  return ctx
}
