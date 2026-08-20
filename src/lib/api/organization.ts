'use client'

import { z } from 'zod'
import { apiFetch, apiFetchJson } from './client'
import {
  ORGANIZATIONS_ENDPOINT,
  ORG_ENDPOINT,
  ORG_SETTINGS_ENDPOINT,
  ORG_PLAN_ENDPOINT,
  ORG_PLAN_POOL_CAP_ENDPOINT,
  ORG_PLAN_USAGE_ENDPOINT,
  ORG_AUDIT_ENDPOINT,
  ORG_TRANSFER_OWNER_ENDPOINT,
  ORG_MEMBERS_ENDPOINT,
  ORG_MEMBER_ENDPOINT,
  ORG_MEMBER_ROLE_ENDPOINT,
  ORG_INVITE_ENDPOINT,
} from '@/lib/config'
import type { OrgRole, OrgSettings, OrgMember, OrgPlan, OrgPlanUsage, AuditLogEntry } from '@/types/teams'

// ── Backend shapes (snake_case) ───────────────────────────────────────────────

interface OrganizationResponse {
  id: string
  name: string
  slug: string
  description: string
  logo_url: string | null
  archived: boolean
  my_role: OrgRole | null
  plan_type: 'teams' | 'enterprise' | null
  owner_user_id?: string | null
  owner_email?: string | null
}

interface AdminBillingPermsResponse {
  can_top_up: boolean
  can_manage_payment: boolean
  can_view_invoices: boolean
}

interface OrganizationSettingsResponse {
  organization_id: string
  org_instructions: string | null
  allowed_email_domains: string[] | null
  default_chat_visibility: string | null
  default_persona_visibility: string | null
  admin_billing_perms?: AdminBillingPermsResponse | null
}

// ── Plan endpoint schema ──────────────────────────────────────────────────────
// Mirrors services/organizations/schemas.py exactly (MemberResponse / PlanResponse).
// The response is validated at the boundary so the UI renders deterministically
// from the endpoint's real shape — no guessed defaults, no fabricated fields.
// Server-side every field is always present (Pydantic bakes the defaults in), so
// the only `.default()`s here are the ones the backend itself declares.

const memberResponseSchema = z.object({
  user_id:          z.string(),
  name:             z.string().nullable().default(null),
  email:            z.string().nullable().default(null),
  role:             z.enum(['owner', 'admin', 'member']),
  usage_total:      z.number().default(0),
  invite_status:    z.enum(['active', 'pending']),
  invite_id:        z.string().nullable().default(null),
  is_pending_invite: z.boolean().default(false),
})

const planResponseSchema = z.object({
  organization_id:  z.string(),
  plan_type:        z.string(),               // backend: str ("teams" | "enterprise")
  billing_model:    z.string(),               // backend: str ("prepaid" | "postpaid")
  plan_credits:     z.number(),
  topup_credits:    z.number(),
  total_credits:    z.number(),
  used:             z.number(),
  remaining:        z.number(),
  percent_used:     z.number(),
  pool_status:      z.enum(['healthy', 'warning_95', 'paused']),
  pool_cap:         z.number().nullable().default(null),
  members:          z.array(memberResponseSchema).default([]),
  included_usage_usd:           z.number().default(0),
  provider_usage_usd:           z.number().default(0),
  included_usage_remaining_usd: z.number().default(0),
  overage_usd:                  z.number().default(0),
  projected_invoice_usd:        z.number().default(0),
  input_tokens:     z.number().int().default(0),
  output_tokens:    z.number().int().default(0),
  reasoning_tokens: z.number().int().default(0),
  cached_tokens:    z.number().int().default(0),
  total_tokens:     z.number().int().default(0),
  usage_event_count: z.number().int().default(0),
})

type MemberResponse = z.infer<typeof memberResponseSchema>
type PlanResponse = z.infer<typeof planResponseSchema>

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
  const p = s.admin_billing_perms
  return {
    organizationId:           s.organization_id,
    orgInstructions:          s.org_instructions,
    allowedEmailDomains:      s.allowed_email_domains,
    defaultChatVisibility:    s.default_chat_visibility,
    defaultPersonaVisibility: s.default_persona_visibility,
    adminBillingPerms: {
      canTopUp:         p?.can_top_up         ?? true,
      canManagePayment: p?.can_manage_payment  ?? true,
      canViewInvoices:  p?.can_view_invoices   ?? true,
    },
  }
}

const toDisplayCredits = (value: number | null | undefined): number =>
  Math.round((value ?? 0) * 1000)

function normalizeMember(m: MemberResponse): OrgMember {
  // Backend's MemberResponse no longer carries team_id/credit_cap/credit_used
  // (Team and per-member caps are gone) — 'editor' and a real allocation/cap
  // were only ever reachable through those fields, so they're hardcoded to
  // their empty state below rather than parsed from data that doesn't exist.
  const role = (m.role === 'owner' || m.role === 'admin') ? 'admin' : 'member'
  const inviteStatus = m.invite_status === 'pending' ? 'invite_sent' : 'signed_up'
  return {
    id:              m.user_id,
    name:            m.name ?? '',
    email:           m.email ?? '',
    role,
    orgRole:         m.role,
    inviteStatus,
    teamMemberships: [],
    creditUsed:      inviteStatus === 'invite_sent'
      ? 0
      : toDisplayCredits(m.usage_total),
    inviteId:        m.invite_id ?? null,
  }
}

function normalizePlan(p: PlanResponse): OrgPlan {
  // Postpaid plans (enterprise) track budget via included_usage_usd / provider_usage_usd
  // / included_usage_remaining_usd. The prepaid fields (plan_credits, total_credits,
  // used, remaining) are always 0 for postpaid — read the right set per billing model.
  const isPostpaid = p.billing_model === 'postpaid'
  return {
    organizationId: p.organization_id,
    planType:       p.plan_type === 'enterprise' ? 'enterprise' : 'teams',
    billingModel:   isPostpaid ? 'postpaid' : 'prepaid',
    planCredits:    toDisplayCredits(p.plan_credits),
    topupCredits:   toDisplayCredits(p.topup_credits),
    totalCredits:   toDisplayCredits(isPostpaid ? p.included_usage_usd        : p.total_credits),
    used:           toDisplayCredits(isPostpaid ? p.provider_usage_usd         : p.used),
    remaining:      toDisplayCredits(isPostpaid ? p.included_usage_remaining_usd : p.remaining),
    percentUsed:    isPostpaid
      ? (p.included_usage_usd > 0 ? Math.round((p.provider_usage_usd / p.included_usage_usd) * 100) : 0)
      : p.percent_used,
    poolStatus:     p.pool_status,
    poolCapUsd:     p.pool_cap,
    members:        p.members.map(normalizeMember),
    includedUsageUsd: p.included_usage_usd,
    providerUsageUsd: p.provider_usage_usd,
    includedUsageRemainingUsd: p.included_usage_remaining_usd,
    overageUsd: p.overage_usd,
    projectedInvoiceUsd: p.projected_invoice_usd,
    inputTokens: p.input_tokens,
    outputTokens: p.output_tokens,
    reasoningTokens: p.reasoning_tokens,
    cachedTokens: p.cached_tokens,
    totalTokens: p.total_tokens,
    usageEventCount: p.usage_event_count,
  }
}

function normalizePlanUsage(u: PlanUsageResponse): OrgPlanUsage {
  return {
    organizationId: u.organization_id,
    byMember: u.by_member.map(m => ({
      userId:      m.user_id,
      name:        m.name,
      email:       m.email,
      creditsUsed: toDisplayCredits(m.credits_used),
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
 * user the owner and stamps `org_id` on their profile, which unlocks the
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
  return { id: data.id, name: data.name, slug: data.slug, role: data.my_role ?? 'admin' }
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
    role: o.my_role ?? 'member',
  }))
}

export async function getOrg(orgId: string): Promise<{ id: string; name: string; slug: string; description: string; logoUrl: string | null; role: OrgRole | null; planType: 'teams' | 'enterprise'; ownerEmail: string | null; ownerUserId: string | null }> {
  const data = await apiFetchJson<OrganizationResponse>(ORG_ENDPOINT(orgId))
  return {
    id:          data.id,
    name:        data.name,
    slug:        data.slug,
    description: data.description,
    logoUrl:     data.logo_url,
    role:        data.my_role,
    planType:    data.plan_type === 'enterprise' ? 'enterprise' : 'teams',
    ownerEmail:  data.owner_email ?? null,
    ownerUserId: data.owner_user_id ?? null,
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
  return { id: data.id, name: data.name, slug: data.slug, logoUrl: data.logo_url }
}

export async function deleteOrg(orgId: string, confirmName: string): Promise<void> {
  await apiFetch(ORG_ENDPOINT(orgId), {
    method: 'DELETE',
    body:   JSON.stringify({ confirmName }),
  })
}

export async function transferOrgOwnership(orgId: string, newOwnerUserId: string): Promise<void> {
  await apiFetch(ORG_TRANSFER_OWNER_ENDPOINT(orgId), {
    method: 'POST',
    body:   JSON.stringify({ newOwnerUserId }),
  })
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
    adminBillingPerms?: {
      canTopUp?:         boolean
      canManagePayment?: boolean
      canViewInvoices?:  boolean
    }
  },
): Promise<OrgSettings> {
  const data = await apiFetchJson<OrganizationSettingsResponse>(ORG_SETTINGS_ENDPOINT(orgId), {
    method: 'PATCH',
    body:   JSON.stringify(params),
  })
  return normalizeSettings(data)
}

export async function getOrgPlan(orgId: string): Promise<OrgPlan> {
  const raw = await apiFetchJson<unknown>(ORG_PLAN_ENDPOINT(orgId))
  return normalizePlan(planResponseSchema.parse(raw))
}

export async function setOrgPoolCap(orgId: string, poolCapUsd: number): Promise<OrgPlan> {
  const raw = await apiFetchJson<unknown>(ORG_PLAN_POOL_CAP_ENDPOINT(orgId), {
    method: 'PATCH',
    body:   JSON.stringify({ poolCap: poolCapUsd }),
  })
  return normalizePlan(planResponseSchema.parse(raw))
}

/**
 * GET /organizations/{id}/members — the authoritative member list with real
 * roles (owner | admin | member). Use this (not the plan's bundled members) to
 * render roles on the Members and Activity pages.
 */
export async function listMembers(orgId: string): Promise<OrgMember[]> {
  const data = await apiFetchJson<MemberResponse[]>(ORG_MEMBERS_ENDPOINT(orgId))
  return (data ?? []).map(normalizeMember)
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
  await apiFetch(ORG_MEMBER_ROLE_ENDPOINT(orgId, memberId), {
    method: 'PATCH',
    body:   JSON.stringify({ role }),
  })
}

export async function removeMember(orgId: string, memberId: string): Promise<void> {
  await apiFetch(ORG_MEMBER_ENDPOINT(orgId, memberId), { method: 'DELETE' })
}

export async function revokeInvite(orgId: string, inviteId: string): Promise<void> {
  const res = await apiFetch(ORG_INVITE_ENDPOINT(orgId, inviteId), { method: 'DELETE' })
  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to revoke invite: ${res.status}`)
  }
}
