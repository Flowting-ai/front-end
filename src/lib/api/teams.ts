'use client'

import { apiFetch, apiFetchJson } from './client'
import {
  ORG_TEAMS_ENDPOINT,
  ORG_TEAM_ENDPOINT,
  ORG_TEAM_EDITORS_ENDPOINT,
  ORG_TEAM_EDITOR_ENDPOINT,
  ORG_TEAM_INVITES_ENDPOINT,
  TEAM_INVITE_PREVIEW_ENDPOINT,
  TEAM_INVITE_ACCEPT_ENDPOINT,
} from '@/lib/config'
import type { Team, TeamEditor, TeamInvite } from '@/types/teams'

// ── Backend shapes (snake_case) ───────────────────────────────────────────────

interface TeamResponse {
  id: string
  organization_id: string
  name: string
  description: string
  tags: string[]
  archived: boolean
  created_at: string
  updated_at: string
}

interface PersonResponse {
  user_id: string
  name?: string | null
  email?: string | null
}

interface InviteResponse {
  id: string
  team_id: string
  recipient_emails?: string[] | null
  expires_at: string
  invite_url: string
}

// ── Normalizers ───────────────────────────────────────────────────────────────

function normalizeTeam(t: TeamResponse): Team {
  return {
    id: t.id,
    organizationId: t.organization_id,
    name: t.name,
    description: t.description,
    tags: t.tags ?? [],
    archived: t.archived,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  }
}

function normalizeEditor(p: PersonResponse): TeamEditor {
  return {
    userId: p.user_id,
    name: p.name ?? null,
    email: p.email ?? null,
  }
}

function normalizeInvite(i: InviteResponse): TeamInvite {
  return {
    id: i.id,
    teamId: i.team_id,
    recipientEmails: i.recipient_emails ?? [],
    expiresAt: i.expires_at,
    inviteUrl: i.invite_url,
  }
}

// ── Per-org cache ─────────────────────────────────────────────────────────────

const _cache = new Map<string, { teams: Team[]; at: number }>()
const CACHE_TTL = 30_000

export function bustTeamsCache(orgId?: string): void {
  if (orgId) _cache.delete(orgId)
  else _cache.clear()
}

// ── API functions ─────────────────────────────────────────────────────────────

export async function fetchTeams(orgId: string): Promise<Team[]> {
  const now = Date.now()
  const cached = _cache.get(orgId)
  if (cached && now - cached.at < CACHE_TTL) return cached.teams

  const list = await apiFetchJson<TeamResponse[]>(ORG_TEAMS_ENDPOINT(orgId))
  const teams = list.map(normalizeTeam)
  _cache.set(orgId, { teams, at: Date.now() })
  return teams
}

export async function getTeam(orgId: string, teamId: string): Promise<Team> {
  const data = await apiFetchJson<TeamResponse>(ORG_TEAM_ENDPOINT(orgId, teamId))
  return normalizeTeam(data)
}

export async function createTeam(orgId: string, name: string, description = ''): Promise<Team> {
  const data = await apiFetchJson<TeamResponse>(ORG_TEAMS_ENDPOINT(orgId), {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  })
  bustTeamsCache(orgId)
  return normalizeTeam(data)
}

export async function updateTeam(
  orgId: string,
  teamId: string,
  params: { name?: string; description?: string; archived?: boolean },
): Promise<Team> {
  const data = await apiFetchJson<TeamResponse>(ORG_TEAM_ENDPOINT(orgId, teamId), {
    method: 'PATCH',
    body: JSON.stringify(params),
  })
  bustTeamsCache(orgId)
  return normalizeTeam(data)
}

export async function archiveTeam(orgId: string, teamId: string): Promise<Team> {
  return updateTeam(orgId, teamId, { archived: true })
}

export async function deleteTeam(orgId: string, teamId: string): Promise<void> {
  await apiFetch(ORG_TEAM_ENDPOINT(orgId, teamId), { method: 'DELETE' })
  bustTeamsCache(orgId)
}

export async function listTeamEditors(orgId: string, teamId: string): Promise<TeamEditor[]> {
  const list = await apiFetchJson<PersonResponse[]>(ORG_TEAM_EDITORS_ENDPOINT(orgId, teamId))
  return list.map(normalizeEditor)
}

export async function removeTeamEditor(orgId: string, teamId: string, memberId: string): Promise<void> {
  await apiFetch(ORG_TEAM_EDITOR_ENDPOINT(orgId, teamId, memberId), { method: 'DELETE' })
}

export async function inviteTeamMembers(orgId: string, teamId: string, emails: string[]): Promise<TeamInvite> {
  const data = await apiFetchJson<InviteResponse>(ORG_TEAM_INVITES_ENDPOINT(orgId, teamId), {
    method: 'POST',
    body: JSON.stringify({ emails }),
  })
  return normalizeInvite(data)
}

// ── Team invite preview / accept ──────────────────────────────────────────────

interface InvitePreviewResponse {
  invite_id: string
  team_id:   string
  team_name: string
  invited_by_name: string
  expires_at: string
}

export interface TeamInvitePreview {
  inviteId:      string
  teamId:        string
  teamName:      string
  invitedByName: string
  expiresAt:     string
}

export async function getTeamInvitePreview(inviteId: string): Promise<TeamInvitePreview> {
  const data = await apiFetchJson<InvitePreviewResponse>(TEAM_INVITE_PREVIEW_ENDPOINT(inviteId))
  return {
    inviteId:      data.invite_id,
    teamId:        data.team_id,
    teamName:      data.team_name,
    invitedByName: data.invited_by_name,
    expiresAt:     data.expires_at,
  }
}

export async function acceptTeamInvite(inviteId: string): Promise<Team> {
  const data = await apiFetchJson<TeamResponse>(TEAM_INVITE_ACCEPT_ENDPOINT(inviteId), {
    method: 'POST',
  })
  return normalizeTeam(data)
}
