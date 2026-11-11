'use client'

import { z } from 'zod'
import { apiFetch, apiFetchJson, ApiError, friendlyApiError } from './client'
import {
  ORGANIZATIONS_ENDPOINT,
  ORG_ENDPOINT,
  ORG_SETTINGS_ENDPOINT,
  ORG_PLAN_USAGE_ENDPOINT,
  ORG_AUDIT_ENDPOINT,
  ORG_MEMBERS_ENDPOINT,
  ORG_MEMBER_ENDPOINT,
  ORG_MEMBER_ROLE_ENDPOINT,
  ORG_INVITE_ENDPOINT,
  ORG_LEAVE_ENDPOINT,
} from '@/lib/config'
import type { OrgRole, OrgSettings, OrgMember, OrgPlanUsage, AuditLogEntry } from '@/types/teams'
import { dollarsToCredits, normalizeMember, planMemberSchema } from './plan'
import { trackBrowserEvent, trackFeature } from '@/lib/analytics/events'

// ── Backend shapes ────────────────────────────────────────────────────────────
// Unlike MemberBurn/AuditEntry/InvitePreview elsewhere in this file (still
// genuinely snake_case — no alias declared on those models), OrganizationResponse
// and OrganizationSettingsResponse in services/organizations/schemas.py both
// declare a `serialization_alias` on every multi-word field, so — same as
// MemberResponse above — the actual wire format is camelCase.

interface OrganizationResponse {
  id: string
  name: string
  slug: string
  description: string
  logoUrl: string | null
  archived: boolean
  // 'owner' is a real value here (the org's creator) — not just 'admin'/'member'
  // as OrgRole claims. There's no separate Owner capability tier anywhere in
  // the UI (admin already has full billing/org authority), so it's folded
  // into 'admin' at the boundary via foldOwnerRole() below rather than
  // leaking a third value into every OrgRole-typed consumer (org-context's
  // orgRole/currentUserRole, LeftSidebar, SettingsSidebar, roles.ts...),
  // which all silently read an unrecognized 'owner' as "not admin".
  myRole: OrgRole | 'owner' | null
  planType: 'teams' | 'enterprise' | null
}

function foldOwnerRole(role: OrgRole | 'owner' | null): OrgRole | null {
  return role === 'owner' ? 'admin' : role
}

interface OrganizationSettingsResponse {
  organizationId: string
  orgInstructions: string | null
  allowedEmailDomains: string[] | null
  defaultChatVisibility: string | null
  defaultPersonaVisibility: string | null
}

interface MemberBurnResponse {
  user_id: string
  name: string | null
  email: string | null
  credits_used: number
}

interface PlanUsageResponse {
  organization_id: string
  by_member: MemberBurnResponse[]
}

interface AuditEntryResponse {
  id: string
  actor_user_id: string
  actor_name: string | null
  actor_email: string | null
  action: string
  target_type: string | null
  target_id: string | null
  target_name: string | null
  extra: Record<string, unknown> | null
  created_at: string
}

// ── Normalizers ───────────────────────────────────────────────────────────────

function normalizeSettings(s: OrganizationSettingsResponse): OrgSettings {
  return {
    organizationId:           s.organizationId,
    orgInstructions:          s.orgInstructions,
    allowedEmailDomains:      s.allowedEmailDomains,
    defaultChatVisibility:    s.defaultChatVisibility,
    defaultPersonaVisibility: s.defaultPersonaVisibility,
  }
}

function normalizePlanUsage(u: PlanUsageResponse): OrgPlanUsage {
  return {
    organizationId: u.organization_id,
    byMember: u.by_member.map(m => ({
      userId:      m.user_id,
      name:        m.name,
      email:       m.email,
      creditsUsed: dollarsToCredits(m.credits_used),
    })),
  }
}

function normalizeAuditEntry(e: AuditEntryResponse): AuditLogEntry {
  return {
    id:           e.id,
    actorUserId:  e.actor_user_id,
    actorName:    e.actor_name ?? null,
    actorEmail:   e.actor_email ?? null,
    action:       e.action,
    targetType:   e.target_type,
    targetId:     e.target_id,
    targetName:   e.target_name ?? null,
    extra:        e.extra,
    createdAt:    e.created_at,
  }
}

// ── API functions ─────────────────────────────────────────────────────────────

/**
 * Create a new organization (team workspace). The backend makes the calling
 * user an admin and stamps `org_id` on their profile, which unlocks the
 * Organization settings (members / teams / plans). Used by team onboarding.
 */
export async function createOrganization(params: {
  name: string
  description?: string
  logoUrl?: string | null
  tags?: string[]
}): Promise<{ id: string; name: string; slug: string; role: OrgRole }> {
  const body: Record<string, unknown> = { name: params.name }
  if (params.description !== undefined) body.description = params.description
  if (params.logoUrl !== undefined)     body.logoUrl     = params.logoUrl
  if (params.tags !== undefined)        body.tags        = params.tags
  const data = await apiFetchJson<OrganizationResponse>(ORGANIZATIONS_ENDPOINT, {
    method: 'POST',
    body:   JSON.stringify(body),
  })
  return { id: data.id, name: data.name, slug: data.slug, role: foldOwnerRole(data.myRole) ?? 'admin' }
}

/**
 * List the organizations the current user belongs to. Used as a fallback to
 * discover the user's org when `/users/me` doesn't include `org_id`, so team
 * members still get their Organization settings.
 */
export async function listOrganizations(): Promise<Array<{ id: string; name: string; slug: string; role: OrgRole }>> {
  const data = await apiFetchJson<OrganizationResponse[]>(ORGANIZATIONS_ENDPOINT)
  return (data ?? []).map(o => ({
    id:   o.id,
    name: o.name,
    slug: o.slug,
    role: foldOwnerRole(o.myRole) ?? 'member',
  }))
}

export async function getOrg(orgId: string): Promise<{ id: string; name: string; slug: string; description: string; logoUrl: string | null; role: OrgRole | null; planType: 'teams' | 'enterprise' | null }> {
  const data = await apiFetchJson<OrganizationResponse>(ORG_ENDPOINT(orgId))
  return {
    id:          data.id,
    name:        data.name,
    slug:        data.slug,
    description: data.description,
    logoUrl:     data.logoUrl,
    role:        foldOwnerRole(data.myRole),
    planType:    data.planType === 'enterprise' ? 'enterprise' : data.planType === 'teams' ? 'teams' : null,
  }
}

export async function updateOrg(
  orgId: string,
  params: { name?: string | null; slug?: string | null; description?: string | null; logoFile?: File | null },
): Promise<{ id: string; name: string; slug: string; logoUrl: string | null }> {
  // Multipart: the logo is sent as raw image bytes (`logo` file part), not a URL.
  // apiFetch omits Content-Type for FormData so the browser sets the boundary.
  const form = new FormData()
  if (params.name != null)        form.append('name', params.name)
  if (params.slug != null)        form.append('slug', params.slug)
  if (params.description != null) form.append('description', params.description)
  if (params.logoFile)            form.append('logo', params.logoFile)
  const data = await apiFetchJson<OrganizationResponse>(ORG_ENDPOINT(orgId), {
    method: 'PATCH',
    body:   form,
  })
  return { id: data.id, name: data.name, slug: data.slug, logoUrl: data.logoUrl }
}

export async function deleteOrg(orgId: string, confirmName: string): Promise<void> {
  const res = await apiFetch(ORG_ENDPOINT(orgId), {
    method: 'DELETE',
    body:   JSON.stringify({ confirmName }),
  })
  if (!res.ok) {
    let detail = `Request failed with status ${res.status}`
    try {
      const body = await res.json() as { detail?: string }
      if (typeof body.detail === 'string') detail = body.detail
    } catch { /* non-JSON error body */ }
    throw new ApiError(res.status, 'delete_org_failed', friendlyApiError(detail, res.status), detail)
  }
  trackBrowserEvent('org_deleted')
}

/**
 * POST /organizations/{id}/leave — 204 No Content on success. `successorAdminUserId`
 * is only read server-side when the caller is the last admin (organization.py);
 * harmless to omit otherwise. Uses `apiFetch` directly (not `apiFetchJson`) since
 * a 204 body would fail `.json()` parsing on the success path — the error path
 * below mirrors apiFetchJson's own `detail` extraction so real backend messages
 * ("Must promote a replacement admin", "The billing admin cannot leave — transfer
 * billing first", "Successor must be another member of this organization")
 * surface verbatim instead of a generic status-code string.
 */
export async function leaveOrganization(orgId: string, successorAdminUserId?: string): Promise<void> {
  const res = await apiFetch(ORG_LEAVE_ENDPOINT(orgId), {
    method: 'POST',
    body:   JSON.stringify(successorAdminUserId ? { successorAdminUserId } : {}),
  })
  if (!res.ok) {
    let detail = `Request failed with status ${res.status}`
    try {
      const body = await res.json() as { detail?: string }
      if (typeof body.detail === 'string') detail = body.detail
    } catch { /* non-JSON error body */ }
    throw new ApiError(res.status, 'leave_org_failed', friendlyApiError(detail, res.status), detail)
  }
  trackBrowserEvent('org_left', { with_successor: Boolean(successorAdminUserId) })
}

export async function getOrgSettings(orgId: string): Promise<OrgSettings> {
  const data = await apiFetchJson<OrganizationSettingsResponse>(ORG_SETTINGS_ENDPOINT(orgId))
  return normalizeSettings(data)
}

export async function updateOrgSettings(
  orgId: string,
  params: {
    orgInstructions?:          string | null
    allowedEmailDomains?:      string[] | null
    defaultChatVisibility?:    string | null
    defaultPersonaVisibility?: string | null
  },
): Promise<OrgSettings> {
  const data = await apiFetchJson<OrganizationSettingsResponse>(ORG_SETTINGS_ENDPOINT(orgId), {
    method: 'PATCH',
    body:   JSON.stringify(params),
  })
  return normalizeSettings(data)
}

/**
 * GET /organizations/{id}/members — the authoritative member list with real
 * roles (owner | admin | member). Use this (not the plan's bundled members) to
 * render roles on the Members and Activity pages.
 */
export async function listMembers(orgId: string): Promise<OrgMember[]> {
  // Validate like getOrgPlan/setOrgPoolCap do — this was previously just cast via
  // the generic (`apiFetchJson<MemberResponse[]>`) with no runtime check, so it
  // silently read the pre-alias-fix field names (user_id, invite_status, ...)
  // against a response that's actually camelCase (userId, inviteStatus, ...),
  // producing members with undefined ids/emails and an always-wrong invite
  // status instead of throwing — the same drift getOrgPlan's ZodError caught.
  const raw = await apiFetchJson<unknown>(ORG_MEMBERS_ENDPOINT(orgId))
  const data = z.array(planMemberSchema).parse(raw)
  return data.map(normalizeMember)
}

export async function getOrgPlanUsage(orgId: string): Promise<OrgPlanUsage> {
  const data = await apiFetchJson<PlanUsageResponse>(ORG_PLAN_USAGE_ENDPOINT(orgId))
  return normalizePlanUsage(data)
}

export async function listAudit(
  orgId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<AuditLogEntry[]> {
  const params = new URLSearchParams()
  if (opts.limit  !== undefined) params.set('limit',  String(opts.limit))
  if (opts.offset !== undefined) params.set('offset', String(opts.offset))
  const qs = params.toString()
  const url = qs ? `${ORG_AUDIT_ENDPOINT(orgId)}?${qs}` : ORG_AUDIT_ENDPOINT(orgId)
  const data = await apiFetchJson<AuditEntryResponse[]>(url)
  return data.map(normalizeAuditEntry)
}

export async function setMemberRole(orgId: string, memberId: string, role: OrgRole): Promise<void> {
  const res = await apiFetch(ORG_MEMBER_ROLE_ENDPOINT(orgId, memberId), {
    method: 'PATCH',
    body:   JSON.stringify({ role }),
  })
  if (!res.ok) {
    let detail = `Request failed with status ${res.status}`
    try {
      const body = await res.json() as { detail?: string }
      if (typeof body.detail === 'string') detail = body.detail
    } catch { /* non-JSON error body */ }
    throw new ApiError(res.status, 'set_member_role_failed', friendlyApiError(detail, res.status), detail)
  }
  trackFeature('permission_level_changed', { role_changed_to: role })
}

export async function removeMember(orgId: string, memberId: string): Promise<void> {
  const res = await apiFetch(ORG_MEMBER_ENDPOINT(orgId, memberId), { method: 'DELETE' })
  if (!res.ok) {
    let detail = `Request failed with status ${res.status}`
    try {
      const body = await res.json() as { detail?: string }
      if (typeof body.detail === 'string') detail = body.detail
    } catch { /* non-JSON error body */ }
    throw new ApiError(res.status, 'remove_member_failed', friendlyApiError(detail, res.status), detail)
  }
  trackBrowserEvent('org_member_removed')
}

export async function revokeInvite(orgId: string, inviteId: string): Promise<void> {
  const res = await apiFetch(ORG_INVITE_ENDPOINT(orgId, inviteId), { method: 'DELETE' })
  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to revoke invite: ${res.status}`)
  }
  trackBrowserEvent('org_invite_revoked')
}
