'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from '@/context/auth-context'
import { fetchTeams, bustTeamsCache } from '@/lib/api/teams'
import { getOrg, getOrgPlan, listOrganizations } from '@/lib/api/organization'
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
  teams: Team[]
  teamsLoading: boolean
  refreshTeams: () => void
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
  }, [user])
  const orgId = resolvedOrgId

  const [orgName,          setOrgName]          = useState('')
  const [orgRole,          setOrgRole]          = useState<OrgRole>('member')
  const [currentUserRole,  setCurrentUserRole]  = useState<'admin' | 'editor' | 'member'>('member')
  const [plan,             setPlan]             = useState<OrgPlan | null>(null)
  const [members,          setMembers]          = useState<OrgMember[]>([])
  const [membersLoading,   setMembersLoading]   = useState(false)
  const [planRefreshToken, setPlanRefreshToken] = useState(0)

  const [teams,        setTeams]        = useState<Team[]>([])
  const [teamsLoading, setTeamsLoading] = useState(false)
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [teamsRefreshToken, setTeamsRefreshToken] = useState(0)

  // Fetch org name + current user role
  const [roleResolved, setRoleResolved] = useState(false)
  useEffect(() => {
    if (!orgIdResolved) return // wait until we know whether there's an org
    if (!orgId) {
      // No resolved org yet. A team-plan owner is still an org admin (the org
      // entity may just not be linked on the profile); everyone else is a member.
      setOrgRole(isTeamPlan ? 'owner' : 'member')
      setCurrentUserRole(isTeamPlan ? 'admin' : 'member')
      setRoleResolved(true)
      return
    }
    setRoleResolved(false)
    getOrg(orgId)
      .then(data => {
        setOrgName(data.name)
        setOrgRole(data.role)
        setCurrentUserRole(
          data.role === 'owner' || data.role === 'admin' || isTeamPlan ? 'admin' : 'member',
        )
      })
      .catch(console.error)
      .finally(() => setRoleResolved(true))
  }, [orgId, orgIdResolved, isTeamPlan])

  // Fetch plan + members (plan endpoint bundles members)
  useEffect(() => {
    if (!orgId) return
    setMembersLoading(true)
    getOrgPlan(orgId)
      .then(p => {
        setPlan(p)
        setMembers(p.members)
      })
      .catch(console.error)
      .finally(() => setMembersLoading(false))
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

  function refreshTeams() {
    if (orgId) bustTeamsCache(orgId)
    setTeamsRefreshToken(t => t + 1)
  }

  function refreshMembers() {
    setPlanRefreshToken(t => t + 1)
  }

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
      teams,
      teamsLoading,
      refreshTeams,
      refreshMembers,
      activeTeamId,
      setActiveTeamId,
      activeProjectId,
      setActiveProjectId,
      orgReady: orgIdResolved && roleResolved,
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
