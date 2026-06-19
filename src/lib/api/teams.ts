'use client'

import { apiFetch, apiFetchJson } from './client'
import {
  ORG_TEAMS_ENDPOINT,
  ORG_TEAM_ENDPOINT,
  ORG_TEAM_EDITORS_ENDPOINT,
  ORG_TEAM_EDITOR_ENDPOINT,
  ORG_TEAM_INVITES_ENDPOINT,
  ORG_TEAM_PROJECT_MEMBERS_ENDPOINT,
  ORG_TEAM_PROJECT_MEMBER_ENDPOINT,
  ORG_TEAM_CONNECTORS_ENDPOINT,
  ORG_TEAM_CONNECTOR_CATALOG_ENDPOINT,
  ORG_TEAM_CONNECTOR_ENDPOINT,
  ORG_TEAM_CONNECTIONS_ENDPOINT,
  ORG_TEAM_CONNECTION_ENDPOINT,
  TEAM_INVITE_PREVIEW_ENDPOINT,
  TEAM_INVITE_ACCEPT_ENDPOINT,
} from '@/lib/config'
import type { Team, TeamEditor, TeamInvite, WorkspaceRole } from '@/types/teams'
import type {
  ApiKeyField,
  ConnectorTool,
  ConnectorAccount,
  ConnectorCatalogEntry,
} from './connectors'

// ── Backend shapes (snake_case) ───────────────────────────────────────────────

interface TeamResponse {
  id: string
  organization_id: string
  name: string
  description: string
  tags: string[]
  archived: boolean
  can_edit: boolean
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
    canEdit: t.can_edit ?? false,
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

export async function addTeamEditor(orgId: string, teamId: string, userId: string): Promise<TeamEditor> {
  const data = await apiFetchJson<PersonResponse>(ORG_TEAM_EDITORS_ENDPOINT(orgId, teamId), {
    method: 'POST',
    body: JSON.stringify({ userId }),
  })
  return normalizeEditor(data)
}

export async function removeTeamEditor(orgId: string, teamId: string, memberId: string): Promise<void> {
  await apiFetch(ORG_TEAM_EDITOR_ENDPOINT(orgId, teamId, memberId), { method: 'DELETE' })
}

// ── Project members ───────────────────────────────────────────────────────────

export interface ProjectMember {
  userId: string
  name: string | null
  email: string | null
}

export async function listProjectMembers(orgId: string, teamId: string, projectId: string): Promise<ProjectMember[]> {
  const list = await apiFetchJson<PersonResponse[]>(ORG_TEAM_PROJECT_MEMBERS_ENDPOINT(orgId, teamId, projectId))
  return list.map(p => ({ userId: p.user_id, name: p.name ?? null, email: p.email ?? null }))
}

export async function addProjectMember(orgId: string, teamId: string, projectId: string, userId: string): Promise<ProjectMember> {
  const data = await apiFetchJson<PersonResponse>(ORG_TEAM_PROJECT_MEMBERS_ENDPOINT(orgId, teamId, projectId), {
    method: 'POST',
    body: JSON.stringify({ userId }),
  })
  return { userId: data.user_id, name: data.name ?? null, email: data.email ?? null }
}

export async function removeProjectMember(orgId: string, teamId: string, projectId: string, memberId: string): Promise<void> {
  await apiFetch(ORG_TEAM_PROJECT_MEMBER_ENDPOINT(orgId, teamId, projectId, memberId), { method: 'DELETE' })
}

export async function inviteTeamMembers(
  orgId: string,
  teamId: string,
  emails: string[],
  role?: WorkspaceRole,
  creditCap?: number,
  projectId?: string,
): Promise<TeamInvite> {
  // 'editor' is a team-level grant, not an OrganizationRole: it maps to an org
  // 'member' whose invite carries grantTeamEditor=true, so the backend grants a
  // TeamEditor row on accept (and a plain member does NOT auto-become editor).
  const orgRole = role === 'admin' ? 'admin' : 'member'
  const grantTeamEditor = role === 'editor'
  const data = await apiFetchJson<InviteResponse>(ORG_TEAM_INVITES_ENDPOINT(orgId, teamId), {
    method: 'POST',
    body: JSON.stringify({
      emails,
      role: orgRole,
      grantTeamEditor,
      ...(creditCap && creditCap > 0 ? { creditCap } : {}),
      ...(projectId ? { projectId } : {}),
    }),
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

// ── Team connector approval (§14) ─────────────────────────────────────────────

export type ConnectorRequestStatus = 'pending' | 'approved' | 'denied'

export interface TeamConnectorRequest {
  teamId:              string
  connectorSlug:       string
  status:              ConnectorRequestStatus
  requestedByUserId:   string
  requestedByName:     string | null
  requestedByEmail:    string | null
  note:                string | null
  createdAt:           string
  updatedAt:           string
}

interface TeamConnectorResponse {
  team_id:               string
  connector_slug:        string
  status:                ConnectorRequestStatus
  requested_by_user_id:  string
  requested_by_name:     string | null
  requested_by_email:    string | null
  note:                  string | null
  created_at:            string
  updated_at:            string
}

function normalizeTeamConnector(r: TeamConnectorResponse): TeamConnectorRequest {
  return {
    teamId:            r.team_id,
    connectorSlug:     r.connector_slug,
    status:            r.status,
    requestedByUserId: r.requested_by_user_id,
    requestedByName:   r.requested_by_name ?? null,
    requestedByEmail:  r.requested_by_email ?? null,
    note:              r.note ?? null,
    createdAt:         r.created_at,
    updatedAt:         r.updated_at,
  }
}

export async function listTeamConnectors(orgId: string, teamId: string): Promise<TeamConnectorRequest[]> {
  const list = await apiFetchJson<TeamConnectorResponse[]>(ORG_TEAM_CONNECTORS_ENDPOINT(orgId, teamId))
  return list.map(normalizeTeamConnector)
}

export async function listTeamConnectorCatalog(
  orgId: string,
  teamId: string,
): Promise<ConnectorCatalogEntry[]> {
  return apiFetchJson<ConnectorCatalogEntry[]>(ORG_TEAM_CONNECTOR_CATALOG_ENDPOINT(orgId, teamId))
}

export async function requestTeamConnector(orgId: string, teamId: string, slug: string, note?: string): Promise<TeamConnectorRequest> {
  const data = await apiFetchJson<TeamConnectorResponse>(ORG_TEAM_CONNECTORS_ENDPOINT(orgId, teamId), {
    method: 'POST',
    body: JSON.stringify({ slug, ...(note ? { note } : {}) }),
  })
  return normalizeTeamConnector(data)
}

export async function setTeamConnectorStatus(
  orgId: string,
  teamId: string,
  slug: string,
  status: ConnectorRequestStatus,
): Promise<TeamConnectorRequest> {
  const data = await apiFetchJson<TeamConnectorResponse>(ORG_TEAM_CONNECTOR_ENDPOINT(orgId, teamId, slug), {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
  return normalizeTeamConnector(data)
}

export async function deleteTeamConnector(orgId: string, teamId: string, slug: string): Promise<void> {
  await apiFetch(ORG_TEAM_CONNECTOR_ENDPOINT(orgId, teamId, slug), { method: 'DELETE' })
}

// ── Team connections / shared accounts (§15) ──────────────────────────────────

export interface TeamConnectionEntry {
  slug:              string
  displayName:       string
  authMode:          'oauth2' | 'api_key'
  apiKeyFields:      ApiKeyField[]
  status:            ConnectorRequestStatus
  /** Currently attached org shared account id. */
  sharedAccountId:   string | null
  /** Admin-friendly label of the attached shared account. */
  accountLabel:      string | null
  /** Provider identity of the attached shared account. */
  accountIdentifier: string | null
  /** True when a shared account is attached and connected. */
  workspaceLinked:   boolean
  /** User id that attached the shared account. */
  workspaceLinkedBy: string | null
  /** Available org shared accounts for this connector (picker list). */
  accounts:          ConnectorAccount[]
  /** Current tool policies for this team connection. */
  tools:             ConnectorTool[]
}

// Raw response shape — matches ConnectorCatalogEntry from the backend.
interface TeamConnectionResponse {
  slug:                  string
  display_name?:         string
  auth_mode?:            'oauth2' | 'api_key'
  api_key_fields?:       ApiKeyField[]
  status?:               ConnectorRequestStatus
  shared_account_id?:    string | null
  account_label?:        string | null
  account_identifier?:   string | null
  workspace_linked?:     boolean
  workspace_linked_by?:  string | null
  accounts?:             Array<{
    id:                string
    organization_id:   string
    connector_slug:    string
    account_label:     string
    account_identifier: string | null
    connected:         boolean
    status:            'active' | 'disabled' | 'expired'
    version:           number
    team_ids:          string[]
    linked_by_user_id: string
    created_at:        string
    updated_at:        string
  }>
  tools?:                ConnectorTool[]
}

function normalizeConnection(r: TeamConnectionResponse): TeamConnectionEntry {
  return {
    slug:              r.slug,
    displayName:       r.display_name ?? r.slug,
    authMode:          r.auth_mode ?? 'api_key',
    apiKeyFields:      r.api_key_fields ?? [],
    status:            r.status ?? 'approved',
    sharedAccountId:   r.shared_account_id ?? null,
    accountLabel:      r.account_label ?? null,
    accountIdentifier: r.account_identifier ?? null,
    workspaceLinked:   r.workspace_linked ?? false,
    workspaceLinkedBy: r.workspace_linked_by ?? null,
    accounts:          (r.accounts ?? []).map(a => ({
      id:               a.id,
      organizationId:   a.organization_id,
      connectorSlug:    a.connector_slug,
      accountLabel:     a.account_label,
      accountIdentifier: a.account_identifier ?? null,
      connected:        a.connected,
      status:           a.status,
      version:          a.version,
      teamIds:          a.team_ids ?? [],
      linkedByUserId:   a.linked_by_user_id,
      createdAt:        a.created_at,
      updatedAt:        a.updated_at,
    })),
    tools:             r.tools ?? [],
  }
}

export async function listTeamConnections(orgId: string, teamId: string): Promise<TeamConnectionEntry[]> {
  const list = await apiFetchJson<TeamConnectionResponse[]>(ORG_TEAM_CONNECTIONS_ENDPOINT(orgId, teamId))
  return list.map(normalizeConnection)
}

export async function createTeamConnectionAccount(
  orgId: string,
  teamId: string,
  slug: string,
  params: { accountLabel: string; accountIdentifier?: string; initData?: Record<string, string> },
): Promise<{ connectorSlug: string; redirectUrl: string | null; sharedAccountId: string | null }> {
  const body: Record<string, unknown> = { accountLabel: params.accountLabel }
  if (params.accountIdentifier) body.accountIdentifier = params.accountIdentifier
  if (params.initData)          body.init_data          = params.initData
  const data = await apiFetchJson<{ connector_slug: string; redirect_url: string | null; shared_account_id: string | null }>(
    `${ORG_TEAM_CONNECTION_ENDPOINT(orgId, teamId, slug)}/link`,
    { method: 'POST', body: JSON.stringify(body) },
  )
  return {
    connectorSlug:    data.connector_slug,
    redirectUrl:      data.redirect_url,
    sharedAccountId:  data.shared_account_id,
  }
}

export async function attachSharedAccount(
  orgId: string,
  teamId: string,
  slug: string,
  sharedAccountId: string,
): Promise<TeamConnectionEntry> {
  const data = await apiFetchJson<TeamConnectionResponse>(ORG_TEAM_CONNECTION_ENDPOINT(orgId, teamId, slug), {
    method: 'PATCH',
    body: JSON.stringify({ sharedAccountId }),
  })
  return normalizeConnection(data)
}

export async function updateTeamConnectionPermissions(
  orgId: string,
  teamId: string,
  slug: string,
  permissions: ConnectorTool[],
): Promise<TeamConnectionEntry> {
  const data = await apiFetchJson<TeamConnectionResponse>(ORG_TEAM_CONNECTION_ENDPOINT(orgId, teamId, slug), {
    method: 'PATCH',
    body: JSON.stringify({ permissions }),
  })
  return normalizeConnection(data)
}

export async function unlinkTeamConnection(orgId: string, teamId: string, slug: string): Promise<void> {
  await apiFetch(ORG_TEAM_CONNECTION_ENDPOINT(orgId, teamId, slug), { method: 'DELETE' })
}
