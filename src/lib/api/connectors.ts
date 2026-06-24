"use client"

import { z } from 'zod'
import { apiFetch, apiFetchJson } from './client'
import {
  CONNECTORS_ENDPOINT,
  CONNECTOR_DETAIL_ENDPOINT,
  CONNECTOR_LINK_ENDPOINT,
  ORG_CATALOG_ENDPOINT,
} from '@/lib/config'

// ── Backend response schemas ──────────────────────────────────────────────────
// These mirror services/connectors/schemas.py exactly: snake_case field names,
// exact types, and only the `.default()`s the backend itself declares. Responses
// are validated at the fetch boundary (schema.parse) so the UI renders
// deterministically from the endpoint's real shape — no guessed defaults, no
// fabricated fields. See the billing precedent in src/lib/api/organization.ts.

export const POLICY_VALUES = ['allow', 'block', 'ask', 'allow_once'] as const
const policySchema        = z.enum(POLICY_VALUES)
const accountScopeSchema  = z.enum(['personal', 'shared_team'])
const accountStatusSchema = z.enum(['active', 'disabled', 'expired'])
const accessStatusSchema  = z.enum(['pending', 'approved', 'denied'])

const toolEntrySchema = z.object({
  slug:   z.string(),
  policy: policySchema.default('ask'),
})

/** Rich descriptor for a single credential field returned by GET /connectors/{slug}.
 *  Mirrors Composio's connected-account initiation field metadata. */
const apiKeyFieldSchema = z.object({
  /** Key used in the PATCH credentials payload (e.g. "subdomain", "generic_api_key"). */
  name:     z.string(),
  /** Human-readable label shown above the input (e.g. "Store Subdomain"). */
  label:    z.string(),
  /** Placeholder / hint text (e.g. "your-store-name", "shpat_..."). */
  help:     z.string().default(''),
  /** When true the input should be rendered as type="password". */
  secret:   z.boolean().default(false),
  /** When true the Connect button stays disabled until this field has a value. */
  required: z.boolean().default(true),
})

/** Org-owned shared account embedded in ConnectorCatalogEntry.accounts — snake_case,
 *  as the backend's OrganizationConnectorAccountResponse serializes it. */
const orgConnectorAccountSchema = z.object({
  id:                 z.string(),
  organization_id:    z.string(),
  connector_slug:     z.string(),
  account_label:      z.string(),
  account_identifier: z.string().nullable().default(null),
  connected:          z.boolean(),
  scope:              accountScopeSchema.default('shared_team'),
  status:             accountStatusSchema.default('active'),
  version:            z.number().int().default(1),
  team_ids:           z.array(z.string()).default([]),
  linked_by_user_id:  z.string().nullable().default(null),
  created_at:         z.string(),
  updated_at:         z.string(),
})

/** A selectable account the current user can use for one connector — personal
 *  (UserConnection) or shared (OrganizationConnectorAccount, surfaced via teams). */
const connectorAccountOptionSchema = z.object({
  account_ref:        z.string(),
  connector_slug:     z.string(),
  scope:              accountScopeSchema,
  account_label:      z.string(),
  account_identifier: z.string().nullable().default(null),
  connected:          z.boolean().default(true),
  status:             accountStatusSchema.default('active'),
  team_ids:           z.array(z.string()).default([]),
  team_names:         z.array(z.string()).default([]),
  shared_account_id:  z.string().nullable().default(null),
  linked_by_user_id:  z.string().nullable().default(null),
  can_manage:         z.boolean().default(false),
})

const connectorCatalogEntrySchema = z.object({
  slug:                z.string(),
  display_name:        z.string(),
  auth_mode:           z.enum(['oauth2', 'api_key']),
  description:         z.string(),
  tools:               z.array(toolEntrySchema).default([]),
  api_key_fields:      z.array(apiKeyFieldSchema).default([]),
  /** True when the current user's personal connector is linked. */
  linked:              z.boolean(),
  /** True when a shared team account is attached and connected. */
  workspace_linked:    z.boolean().default(false),
  /** User ID that linked the team/shared workspace account. */
  workspace_linked_by: z.string().nullable().default(null),
  /** ID of the org shared account currently attached to the team connector. */
  shared_account_id:   z.string().nullable().default(null),
  /** Admin-friendly label of the attached org shared account. */
  account_label:       z.string().nullable().default(null),
  /** Provider identity (e.g. email/login) of the attached shared account. */
  account_identifier:  z.string().nullable().default(null),
  /** Org shared accounts for this connector. Populated for admins/editors. */
  accounts:            z.array(orgConnectorAccountSchema).default([]),
  /** Selectable account options the current user can execute under. */
  account_options:     z.array(connectorAccountOptionSchema).default([]),
  /** Whether the slug is enabled in the org catalog. null outside org context. */
  org_enabled:            z.boolean().nullable().default(null),
  /** Current user's personal access request status, or null. */
  personal_access_status: accessStatusSchema.nullable().default(null),
  /** Not in the backend schema — some FE code sets it locally for the avatar. */
  icon_url:            z.string().optional(),
})

const connectorListResponseSchema = z.object({
  connectors: z.array(connectorCatalogEntrySchema).default([]),
})

const linkResponseSchema = z.object({
  connector_slug:    z.string(),
  // Nullable per the backend spec — may be omitted when an OAuth handler can't
  // produce a URL (misconfigured provider, missing client creds, etc.).
  redirect_url:      z.string().nullable().default(null),
  shared_account_id: z.string().nullable().default(null),
})

// ── Inferred types ─────────────────────────────────────────────────────────────

export type ConnectorTool          = z.infer<typeof toolEntrySchema>
export type ApiKeyField            = z.infer<typeof apiKeyFieldSchema>
/** Snake_case shape of an org shared account as embedded in the catalog entry. */
export type ConnectorAccount       = z.infer<typeof orgConnectorAccountSchema>
export type ConnectorAccountOption = z.infer<typeof connectorAccountOptionSchema>
export type ConnectorCatalogEntry  = z.infer<typeof connectorCatalogEntrySchema>
export type ConnectorListResponse  = z.infer<typeof connectorListResponseSchema>
export type LinkResponse           = z.infer<typeof linkResponseSchema>
export type PersonalAccessStatus   = z.infer<typeof accessStatusSchema>

/** Fallback field used when the catalog entry omits api_key_fields entirely. */
export const DEFAULT_API_KEY_FIELD: ApiKeyField = {
  name:     'api_key',
  label:    'API Key',
  help:     '',
  secret:   true,
  required: true,
}

/**
 * True for per-tenant OAuth connectors that require init fields up front —
 * e.g. Shopify's bring-your-own-app S2S, which declares `client_id` /
 * `client_secret` in `api_key_fields`. The merchant must submit these so the
 * backend can mint their per-merchant auth config; they're posted in
 * `init_data` on POST /connectors/{slug}/link (NOT PATCHed as credentials).
 * Plain OAuth connectors have no init fields and link with a bare POST.
 */
export function oauthNeedsInitFields(
  c: { auth_mode?: string; api_key_fields?: ApiKeyField[] | null },
): boolean {
  return c.auth_mode === 'oauth2'
    && Array.isArray(c.api_key_fields)
    && c.api_key_fields.length > 0
}

export interface UpdateConnectorRequest {
  permissions?: { slug: string; policy: 'allow' | 'block' | 'ask' | 'allow_once' }[]
  credentials?: Record<string, string>
}

// ── API functions ─────────────────────────────────────────────────────────────

export async function listConnectors(): Promise<ConnectorCatalogEntry[]> {
  const raw = await apiFetchJson<unknown>(CONNECTORS_ENDPOINT)
  return connectorListResponseSchema.parse(raw).connectors
}

export async function getConnector(slug: string): Promise<ConnectorCatalogEntry> {
  const raw = await apiFetchJson<unknown>(CONNECTOR_DETAIL_ENDPOINT(slug))
  return connectorCatalogEntrySchema.parse(raw)
}

export async function initiateLink(
  slug: string,
  initData?: Record<string, string>,
): Promise<LinkResponse> {
  // Per-tenant OAuth (Shopify BYOA) submits its app credentials here as
  // `init_data`; the backend mints a per-merchant auth config from them and
  // returns the hosted connect link. Plain OAuth sends no body.
  const hasInit = initData != null && Object.keys(initData).length > 0
  const raw = await apiFetchJson<unknown>(CONNECTOR_LINK_ENDPOINT(slug), {
    method: 'POST',
    ...(hasInit ? { body: JSON.stringify({ init_data: initData }) } : {}),
  })
  return linkResponseSchema.parse(raw)
}

export async function updateConnector(
  slug: string,
  body: UpdateConnectorRequest,
): Promise<ConnectorCatalogEntry> {
  const raw = await apiFetchJson<unknown>(CONNECTOR_DETAIL_ENDPOINT(slug), {
    method: 'PATCH',
    body:   JSON.stringify(body),
  })
  return connectorCatalogEntrySchema.parse(raw)
}

export async function unlinkConnector(slug: string): Promise<void> {
  const res = await apiFetch(CONNECTOR_DETAIL_ENDPOINT(slug), { method: 'DELETE' })
  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to unlink connector: ${res.status}`)
  }
}

// ── Org connector catalog (admin) ─────────────────────────────────────────────

/** GET /organizations/{id}/connectors/catalog — admin-only. */
export async function listOrgCatalog(orgId: string): Promise<ConnectorCatalogEntry[]> {
  const raw = await apiFetchJson<unknown>(ORG_CATALOG_ENDPOINT(orgId))
  return z.array(connectorCatalogEntrySchema).parse(raw)
}

/**
 * PUT /organizations/{id}/connectors/catalog — admin-only.
 * Replaces the org allowlist with the provided slug list.
 */
export async function updateOrgCatalog(
  orgId: string,
  connectorSlugs: string[],
): Promise<ConnectorCatalogEntry[]> {
  const raw = await apiFetchJson<unknown>(ORG_CATALOG_ENDPOINT(orgId), {
    method: 'PUT',
    body: JSON.stringify({ connectorSlugs }),
  })
  return z.array(connectorCatalogEntrySchema).parse(raw)
}

// ── Credential-field metadata ─────────────────────────────────────────────────
// Human-readable labels, security hints, and placeholder hints for well-known
// connector fields. Used by all connect forms to pick input type and labels.

const FIELD_LABELS: Record<string, string> = {
  subdomain:       'Store Subdomain',
  generic_api_key: 'Admin API Access Token',
  api_key:         'API Key',
  access_token:    'Access Token',
  shop:            'Shop Domain',
  store_name:      'Store Name',
  username:        'Username',
  password:        'Password',
  client_id:       'Client ID',
  client_secret:   'Client Secret',
}

const FIELD_PLACEHOLDERS: Record<string, string> = {
  subdomain:       'your-store-name',
  generic_api_key: 'shpat_...',
  api_key:         'sk_...',
  client_secret:   'cs_...',
}

const SECRET_KEYWORDS = ['key', 'token', 'secret', 'password', 'api'] as const

/** True when a credential field should be rendered as a masked (password) input. */
export function isSecretField(name: string): boolean {
  const lower = name.toLowerCase()
  return SECRET_KEYWORDS.some((kw) => lower.includes(kw))
}

/** Human-readable label for a credential field. */
export function fieldLabel(name: string): string {
  return (
    FIELD_LABELS[name] ??
    name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  )
}

/** Placeholder hint string for a credential field, or undefined. */
export function fieldPlaceholder(name: string): string | undefined {
  return FIELD_PLACEHOLDERS[name]
}

/**
 * Poll GET /connectors/{slug} until `linked: true`, or until timeoutMs elapses.
 *
 * Uses exponential backoff (2 s → 4 s → 8 s → … capped at 30 s) so a 2-minute
 * wait generates ~9 requests instead of 60.  The cap prevents the interval from
 * growing so large that a fast OAuth completion goes undetected for too long.
 */
export async function pollConnectorUntilActive(
  slug: string,
  {
    initialIntervalMs = 2_000,
    maxIntervalMs     = 30_000,
    timeoutMs         = 120_000,
    signal,
  }: { initialIntervalMs?: number; maxIntervalMs?: number; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<ConnectorCatalogEntry> {
  const deadline = Date.now() + timeoutMs
  let intervalMs  = initialIntervalMs
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new DOMException('Polling aborted', 'AbortError')
    const entry = await getConnector(slug)
    if (entry.linked) return entry
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, intervalMs)
      signal?.addEventListener('abort', () => {
        clearTimeout(t)
        reject(new DOMException('Polling aborted', 'AbortError'))
      }, { once: true })
    })
    // Double the interval each round, but never exceed the cap.
    intervalMs = Math.min(intervalMs * 2, maxIntervalMs)
  }
  throw new Error(`Connector ${slug} did not become linked within ${timeoutMs}ms`)
}
