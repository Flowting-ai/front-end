'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from '@/context/auth-context'
import { fetchTeams, bustTeamsCache } from '@/lib/api/teams'
import { getOrg, getOrgPlan } from '@/lib/api/organization'
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
  const orgId = user?.orgId ?? null

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
  useEffect(() => {
    if (!orgId) return
    getOrg(orgId)
      .then(data => {
        setOrgName(data.name)
        setOrgRole(data.role)
        setCurrentUserRole(
          data.role === 'owner' || data.role === 'admin' ? 'admin' : 'member',
        )
      })
      .catch(console.error)
  }, [orgId])

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
