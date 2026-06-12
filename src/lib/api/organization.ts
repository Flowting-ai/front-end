'use client'

import { apiFetch, apiFetchJson } from './client'
import {
  ORG_ENDPOINT,
  ORG_SETTINGS_ENDPOINT,
  ORG_MEMBER_ENDPOINT,
  ORG_MEMBER_ROLE_ENDPOINT,
  ORG_MEMBER_CAP_ENDPOINT,
} from '@/lib/config'
import type { OrgRole, OrgSettings } from '@/types/teams'

// ── Backend shapes (snake_case) ───────────────────────────────────────────────

interface OrganizationResponse {
  id: string
  name: string
  my_role: OrgRole
}

interface OrganizationSettingsResponse {
  organization_id: string
  org_instructions: string | null
  allowed_email_domains: string[] | null
  default_chat_visibility: string | null
  default_persona_visibility: string | null
}

// ── Normalizers ───────────────────────────────────────────────────────────────

function normalizeSettings(s: OrganizationSettingsResponse): OrgSettings {
  return {
    organizationId:           s.organization_id,
    orgInstructions:          s.org_instructions,
    allowedEmailDomains:      s.allowed_email_domains,
    defaultChatVisibility:    s.default_chat_visibility,
    defaultPersonaVisibility: s.default_persona_visibility,
  }
}

// ── API functions ─────────────────────────────────────────────────────────────

export async function getOrg(orgId: string): Promise<{ id: string; name: string; role: OrgRole }> {
  const data = await apiFetchJson<OrganizationResponse>(ORG_ENDPOINT(orgId))
  return { id: data.id, name: data.name, role: data.my_role }
}

export async function getOrgSettings(orgId: string): Promise<OrgSettings> {
  const data = await apiFetchJson<OrganizationSettingsResponse>(ORG_SETTINGS_ENDPOINT(orgId))
  return normalizeSettings(data)
}

export async function updateOrgSettings(
  orgId: string,
  params: {
    orgInstructions?:        string | null
    allowedEmailDomains?:    string[] | null
    defaultChatVisibility?:  string | null
    defaultPersonaVisibility?: string | null
  },
): Promise<OrgSettings> {
  const data = await apiFetchJson<OrganizationSettingsResponse>(ORG_SETTINGS_ENDPOINT(orgId), {
    method: 'PATCH',
    body:   JSON.stringify(params),
  })
  return normalizeSettings(data)
}

export async function setMemberRole(orgId: string, memberId: string, role: OrgRole): Promise<void> {
  await apiFetch(ORG_MEMBER_ROLE_ENDPOINT(orgId, memberId), {
    method: 'PATCH',
    body:   JSON.stringify({ role }),
  })
}

export async function setMemberCap(orgId: string, memberId: string, cap: number | null): Promise<void> {
  await apiFetch(ORG_MEMBER_CAP_ENDPOINT(orgId, memberId), {
    method: 'PATCH',
    body:   JSON.stringify({ creditCap: cap }),
  })
}

export async function removeMember(orgId: string, memberId: string): Promise<void> {
  await apiFetch(ORG_MEMBER_ENDPOINT(orgId, memberId), { method: 'DELETE' })
}
