'use client'

import { apiFetch, apiFetchJson } from './client'
import {
  ORG_INVITES_ENDPOINT,
  ORG_PROJECT_MEMBERS_ENDPOINT,
  ORG_PROJECT_MEMBER_ENDPOINT,
  TEAM_INVITE_PREVIEW_ENDPOINT,
  TEAM_INVITE_ACCEPT_ENDPOINT,
} from '@/lib/config'
import type {
  Invite,
  WorkspaceRole,
  OrgRole,
  InvitedMember,
  InvitedProject,
  TeamInviteOnboarding,
  OrgMember,
} from '@/types/teams'

// ── Backend shapes (snake_case) ───────────────────────────────────────────────

interface PersonResponse {
  user_id: string
  name?: string | null
  email?: string | null
  can_link_accounts?: boolean
}

interface InviteResponse {
  id: string
  organization_id: string
  recipient_emails?: string[] | null
  expires_at: string
  invite_url: string
}

// ── Normalizers ───────────────────────────────────────────────────────────────

function normalizeInvite(i: InviteResponse): Invite {
  return {
    id: i.id,
    organizationId: i.organization_id,
    recipientEmails: i.recipient_emails ?? [],
    expiresAt: i.expires_at,
    inviteUrl: i.invite_url,
  }
}

// ── API functions ─────────────────────────────────────────────────────────────

// ── Project members ───────────────────────────────────────────────────────────

export interface ProjectMember {
  userId: string
  name: string | null
  email: string | null
}

export async function listProjectMembers(orgId: string, projectId: string): Promise<ProjectMember[]> {
  const list = await apiFetchJson<PersonResponse[]>(ORG_PROJECT_MEMBERS_ENDPOINT(orgId, projectId))
  return list.map(p => ({ userId: p.user_id, name: p.name ?? null, email: p.email ?? null }))
}

export async function addProjectMember(orgId: string, projectId: string, userId: string): Promise<ProjectMember> {
  const data = await apiFetchJson<PersonResponse>(ORG_PROJECT_MEMBERS_ENDPOINT(orgId, projectId), {
    method: 'POST',
    body: JSON.stringify({ userId }),
  })
  return { userId: data.user_id, name: data.name ?? null, email: data.email ?? null }
}

export async function removeProjectMember(orgId: string, projectId: string, memberId: string): Promise<void> {
  await apiFetch(ORG_PROJECT_MEMBER_ENDPOINT(orgId, projectId, memberId), { method: 'DELETE' })
}

/**
 * Flat org-level invite — the backend's InviteRequest is
 * {emails, role: owner|admin|member, project_id}, no team-grant concept at
 * all anymore. An 'editor' selection folds to 'member' here: TeamEditor
 * grants have no live route to apply on accept regardless of what's
 * requested at invite time.
 */
export async function inviteMembers(
  orgId: string,
  emails: string[],
  role?: WorkspaceRole,
  projectId?: string,
): Promise<Invite> {
  const orgRole = role === 'admin' ? 'admin' : 'member'
  const data = await apiFetchJson<InviteResponse>(ORG_INVITES_ENDPOINT(orgId), {
    method: 'POST',
    body: JSON.stringify({
      emails,
      role: orgRole,
      ...(projectId ? { projectId } : {}),
    }),
  })
  return normalizeInvite(data)
}

// ── Team-invite onboarding (rich payload) ──────────────────────────────────────

interface InvitedMemberResponse {
  user_id: string
  name?: string | null
  initials?: string | null
  email?: string | null
  image?: string | null
  role?: OrgRole | null
}

interface InvitedProjectResponse {
  id: string
  title?: string | null
  description?: string | null
  member_count?: number | null
  members?: InvitedMemberResponse[] | null
}

interface InviteOnboardingResponse {
  invite_id: string
  organization_id: string
  organization_name?: string | null
  organization_description?: string | null
  organization_logo_url?: string | null
  invited_by_name?: string | null
  invited_by_email?: string | null
  invited_by_image?: string | null
  role?: OrgRole | null
  project_id?: string | null
  project_name?: string | null
  project_count?: number | null
  projects?: InvitedProjectResponse[] | null
  organization_member_count?: number | null
  organization_members?: InvitedMemberResponse[] | null
  expires_at: string
}

function normalizeInvitedMember(m: InvitedMemberResponse): InvitedMember {
  return {
    userId:   m.user_id,
    name:     m.name ?? '',
    initials: m.initials ?? '',
    email:    m.email ?? '',
    image:    m.image ?? null,
    role:     m.role ?? 'member',
  }
}

function normalizeInvitedProject(p: InvitedProjectResponse): InvitedProject {
  return {
    id:          p.id,
    title:       p.title ?? '',
    description: p.description ?? '',
    memberCount: p.member_count ?? (p.members?.length ?? 0),
    members:     (p.members ?? []).map(normalizeInvitedMember),
  }
}

export async function getTeamInviteOnboarding(inviteId: string): Promise<TeamInviteOnboarding> {
  // The backend returns the full invite payload from the preview path itself
  // (GET /team-invite/{id}) — there is no separate /onboarding endpoint.
  const data = await apiFetchJson<InviteOnboardingResponse>(TEAM_INVITE_PREVIEW_ENDPOINT(inviteId))
  return {
    inviteId:                data.invite_id,
    organizationId:          data.organization_id,
    organizationName:        data.organization_name ?? '',
    organizationDescription: data.organization_description ?? '',
    organizationLogoUrl:     data.organization_logo_url ?? null,
    invitedByName:           data.invited_by_name ?? '',
    invitedByEmail:          data.invited_by_email ?? '',
    invitedByImage:          data.invited_by_image ?? null,
    role:                    data.role ?? 'member',
    projectId:               data.project_id ?? null,
    projectName:             data.project_name ?? null,
    projectCount:            data.project_count ?? (data.projects?.length ?? 0),
    projects:                (data.projects ?? []).map(normalizeInvitedProject),
    organizationMemberCount: data.organization_member_count ?? (data.organization_members?.length ?? 0),
    organizationMembers:     (data.organization_members ?? []).map(normalizeInvitedMember),
    expiresAt:               data.expires_at,
  }
}

export async function acceptTeamInvite(inviteId: string): Promise<void> {
  // Real response is OrganizationResponse, but no caller reads it — accepting
  // just commits membership; the caller re-fetches org state separately.
  await apiFetchJson<unknown>(TEAM_INVITE_ACCEPT_ENDPOINT(inviteId), { method: 'POST' })
}

/**
 * The viewer's internal backend user id, in the same id space as
 * `OrgMember.id` (both ultimately `user_id` on the backend). `/users/me`
 * never returns this internal id —
 * `AuthUser.id` is never populated — so it can't be read directly off
 * `useAuth()`. The org's member list is the only place the current user's
 * internal id is exposed on the frontend, keyed by the one identity we do
 * reliably have client-side: email. Returns `null` if the viewer isn't in
 * `members` yet (list still loading) or no email is available.
 */
export function resolveViewerUserId(members: OrgMember[], viewerEmail: string | null | undefined): string | null {
  if (!viewerEmail) return null
  return members.find(m => m.email === viewerEmail)?.id ?? null
}
