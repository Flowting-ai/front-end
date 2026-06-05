'use client'

import React, { createContext, useContext, useState } from 'react'
import type {
  WorkspaceOrg,
  OrgMember,
  Team,
  ActivityEntry,
} from '@/types/teams'

interface OrgContextValue {
  org: WorkspaceOrg
  members: OrgMember[]
  currentUserRole: 'admin' | 'editor' | 'member'
  teams: Team[]
  activeTeamId: string | null
  setActiveTeamId: (id: string | null) => void
  activeProjectId: string | null
  setActiveProjectId: (id: string | null) => void
  activity: ActivityEntry[]
}

const OrgContext = createContext<OrgContextValue | null>(null)

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
    teamMemberships: [
      { teamId: 'team_01', teamName: 'Marketing', isTeamOwner: false },
      { teamId: 'team_03', teamName: 'Design', isTeamOwner: true },
    ],
    creditUsed: 12_400,
    joinedAt: '2026-01-15',
  },
  {
    id: 'usr_02',
    name: 'Alex Rivera',
    email: 'alex@acmeinc.com',
    role: 'editor',
    inviteStatus: 'signed_up',
    teamMemberships: [
      { teamId: 'team_01', teamName: 'Marketing', isTeamOwner: true },
    ],
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
    teamMemberships: [
      { teamId: 'team_02', teamName: 'Engineering', isTeamOwner: false },
    ],
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

const MOCK_TEAMS: Team[] = [
  {
    id: 'team_01',
    name: 'Marketing',
    description: 'Brand, content, and campaigns',
    status: 'active',
    memberCount: 2,
    owners: [{ id: 'usr_02', name: 'Alex Rivera' }],
    projects: [
      { id: 'proj_01', teamId: 'team_01', name: 'Q3 Campaign' },
      { id: 'proj_02', teamId: 'team_01', name: 'Brand Refresh', slackChannelMapping: '#brand-refresh' },
    ],
    creditUsed: 24_800,
    createdAt: '2026-01-20',
  },
  {
    id: 'team_02',
    name: 'Engineering',
    description: 'Product and infrastructure',
    status: 'active',
    memberCount: 3,
    owners: [{ id: 'usr_03', name: 'Jordan Kim' }],
    projects: [
      { id: 'proj_03', teamId: 'team_02', name: 'Backend API' },
    ],
    creditUsed: 12_600,
    createdAt: '2026-01-20',
  },
  {
    id: 'team_03',
    name: 'Design',
    description: 'UX and visual design',
    status: 'active',
    memberCount: 1,
    owners: [{ id: 'usr_01', name: 'Chai Landge' }],
    projects: [],
    creditUsed: 3_800,
    createdAt: '2026-02-10',
  },
]

const MOCK_ACTIVITY: ActivityEntry[] = [
  { id: 'act_01', timestamp: '2026-05-29T09:12:00Z', memberId: 'usr_01', memberName: 'Chai Landge',  actionType: 'connector_connected',    detail: 'Connected GitHub workspace connector' },
  { id: 'act_02', timestamp: '2026-05-29T08:45:00Z', memberId: 'usr_02', memberName: 'Alex Rivera',  actionType: 'persona_published',       detail: 'Published "Brand Voice" to Marketing team' },
  { id: 'act_03', timestamp: '2026-05-28T17:30:00Z', memberId: 'usr_01', memberName: 'Chai Landge',  actionType: 'member_invited',          detail: 'Invited sam@acmeinc.com as Member' },
  { id: 'act_04', timestamp: '2026-05-28T15:10:00Z', memberId: 'usr_02', memberName: 'Alex Rivera',  actionType: 'automation_run',          detail: 'Brain run: Weekly content brief' },
  { id: 'act_05', timestamp: '2026-05-27T11:00:00Z', memberId: 'usr_01', memberName: 'Chai Landge',  actionType: 'settings_changed',        detail: 'Updated HITL threshold to Tier 3+' },
  { id: 'act_06', timestamp: '2026-05-27T10:45:00Z', memberId: 'usr_03', memberName: 'Jordan Kim',   actionType: 'connector_connected',     detail: 'Connected Linear personal connector' },
  { id: 'act_07', timestamp: '2026-05-26T16:20:00Z', memberId: 'usr_01', memberName: 'Chai Landge',  actionType: 'team_created',            detail: 'Created team "Design"' },
  { id: 'act_08', timestamp: '2026-05-26T14:00:00Z', memberId: 'usr_02', memberName: 'Alex Rivera',  actionType: 'role_changed',            detail: 'Jordan Kim changed from Member to Member' },
  { id: 'act_09', timestamp: '2026-05-25T09:30:00Z', memberId: 'usr_01', memberName: 'Chai Landge',  actionType: 'connector_disconnected',  detail: 'Disconnected Salesforce connector' },
  { id: 'act_10', timestamp: '2026-05-24T13:15:00Z', memberId: 'usr_02', memberName: 'Alex Rivera',  actionType: 'automation_run',          detail: 'Brain run: Competitor analysis' },
  { id: 'act_11', timestamp: '2026-05-23T10:00:00Z', memberId: 'usr_01', memberName: 'Chai Landge',  actionType: 'member_removed',          detail: 'Removed former contractor from workspace' },
  { id: 'act_12', timestamp: '2026-05-22T15:45:00Z', memberId: 'usr_01', memberName: 'Chai Landge',  actionType: 'team_archived',           detail: 'Archived team "Temp Project"' },
]

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const [activeTeamId, setActiveTeamId] = useState<string | null>('team_01')
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)

  return (
    <OrgContext.Provider value={{
      org: MOCK_ORG,
      members: MOCK_MEMBERS,
      currentUserRole: 'admin',
      teams: MOCK_TEAMS,
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
