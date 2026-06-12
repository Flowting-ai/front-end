'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from '@/context/auth-context'
import { fetchTeams, bustTeamsCache } from '@/lib/api/teams'
import { getOrg } from '@/lib/api/organization'
import type {
  WorkspaceOrg,
  OrgMember,
  Team,
  ActivityEntry,
} from '@/types/teams'

interface OrgContextValue {
  orgId: string | null
  org: WorkspaceOrg
  members: OrgMember[]
  currentUserRole: 'admin' | 'editor' | 'member'
  teams: Team[]
  teamsLoading: boolean
  refreshTeams: () => void
  activeTeamId: string | null
  setActiveTeamId: (id: string | null) => void
  activeProjectId: string | null
  setActiveProjectId: (id: string | null) => void
  activity: ActivityEntry[]
}

const OrgContext = createContext<OrgContextValue | null>(null)

// Mock data for non-teams fields (not yet API-connected)
const MOCK_ORG: WorkspaceOrg = {
  id: 'org_01',
  name: 'Acme Inc',
  domain: 'acmeinc.com',
  plan: 'teams',
  monthlyPrice: 125,
  billingCycle: 'monthly',
  creditPool: {
    total: 60_000,
    used: 41_200,
    remaining: 18_800,
    percentUsed: 68.7,
  },
  tokenStatus: 'normal',
  hitlThreshold: 'tier_3_plus',
}

const MOCK_MEMBERS: OrgMember[] = [
  {
    id: 'usr_01',
    name: 'Chai Landge',
    email: 'chai@acmeinc.com',
    role: 'admin',
    inviteStatus: 'signed_up',
    teamMemberships: [],
    creditUsed: 12_400,
    joinedAt: '2026-01-15',
  },
  {
    id: 'usr_02',
    name: 'Alex Rivera',
    email: 'alex@acmeinc.com',
    role: 'editor',
    inviteStatus: 'signed_up',
    teamMemberships: [],
    creditUsed: 18_300,
    creditCap: 25_000,
    joinedAt: '2026-01-20',
  },
  {
    id: 'usr_03',
    name: 'Jordan Kim',
    email: 'jordan@acmeinc.com',
    role: 'member',
    inviteStatus: 'signed_up',
    teamMemberships: [],
    creditUsed: 6_100,
    joinedAt: '2026-02-01',
  },
  {
    id: 'usr_04',
    name: 'Sam Patel',
    email: 'sam@acmeinc.com',
    role: 'member',
    inviteStatus: 'invite_sent',
    teamMemberships: [],
    creditUsed: 4_400,
  },
]

const MOCK_ACTIVITY: ActivityEntry[] = [
  { id: 'act_01', timestamp: '2026-05-29T09:12:00Z', memberId: 'usr_01', memberName: 'Chai Landge',  actionType: 'connector_connected',    detail: 'Connected GitHub workspace connector' },
  { id: 'act_02', timestamp: '2026-05-29T08:45:00Z', memberId: 'usr_02', memberName: 'Alex Rivera',  actionType: 'persona_published',       detail: 'Published "Brand Voice" to Marketing team' },
  { id: 'act_03', timestamp: '2026-05-28T17:30:00Z', memberId: 'usr_01', memberName: 'Chai Landge',  actionType: 'member_invited',          detail: 'Invited sam@acmeinc.com as Member' },
  { id: 'act_04', timestamp: '2026-05-28T15:10:00Z', memberId: 'usr_02', memberName: 'Alex Rivera',  actionType: 'automation_run',          detail: 'Brain run: Weekly content brief' },
  { id: 'act_05', timestamp: '2026-05-27T11:00:00Z', memberId: 'usr_01', memberName: 'Chai Landge',  actionType: 'settings_changed',        detail: 'Updated HITL threshold to Tier 3+' },
]

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const orgId = user?.orgId ?? null

  const [orgName, setOrgName] = useState(MOCK_ORG.name)
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'editor' | 'member'>('admin')

  const [teams, setTeams] = useState<Team[]>([])
  const [teamsLoading, setTeamsLoading] = useState(false)
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    if (!orgId) return
    getOrg(orgId)
      .then(data => {
        setOrgName(data.name)
        setCurrentUserRole(
          data.role === 'owner' || data.role === 'admin' ? 'admin' : 'member',
        )
      })
      .catch(console.error)
  }, [orgId])

  useEffect(() => {
    if (!orgId) return
    setTeamsLoading(true)
    fetchTeams(orgId)
      .then(setTeams)
      .catch(console.error)
      .finally(() => setTeamsLoading(false))
  }, [orgId, refreshToken])

  function refreshTeams() {
    if (orgId) bustTeamsCache(orgId)
    setRefreshToken(t => t + 1)
  }

  return (
    <OrgContext.Provider value={{
      orgId,
      org: { ...MOCK_ORG, name: orgName },
      members: MOCK_MEMBERS,
      currentUserRole,
      teams,
      teamsLoading,
      refreshTeams,
      activeTeamId,
      setActiveTeamId,
      activeProjectId,
      setActiveProjectId,
      activity: MOCK_ACTIVITY,
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
