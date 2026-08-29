"use client"

import { z } from 'zod'
import { apiFetch, apiFetchJson } from './client'
import { toConnector, type Connector } from '@/lib/connector'
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

// services/connectors/schemas.py's AccountScope is Literal["personal", "shared"]
// (Workspace Model v2 — Team removed, connections are workspace-wide with no
// smaller scope to distinguish "shared" from).
const accountScopeSchema  = z.enum(['personal', 'shared'])
const accountStatusSchema = z.enum(['active', 'disabled', 'expired'])

const toolPermissionSchema = z.enum(['allowed', 'blocked', 'ask'])

// Mirrors backend ToolEntry (services/connectors/schemas.py). The readable
// permission is response-only and derived from the two booleans; parsing derives
// it again so a stale cached response without the new field still renders.
const toolEntrySchema = z.object({
  slug:       z.string(),
  allowed:    z.boolean().default(false),
  blocked:    z.boolean().default(false),
  permission: toolPermissionSchema.optional(),
}).passthrough().transform(tool => ({
  ...tool,
  permission: connectorToolPermission(tool),
}))

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
  scope:              accountScopeSchema.default('shared'),
  status:             accountStatusSchema.default('active'),
  version:            z.number().int().default(1),
  linked_by_user_id:  z.string().nullable().default(null),
  created_at:         z.string(),
  updated_at:         z.string(),
})

/** A connected account the current user acts through for one connector — personal
 *  (UserConnection) or shared (OrganizationConnectorAccount, surfaced through the
 *  viewer's organization). Informational: the server picks personal-first, else
 *  the organization's shared account. */
const connectorAccountOptionSchema = z.object({
  connector_slug:     z.string(),
  scope:              accountScopeSchema,
  account_label:      z.string(),
  account_identifier: z.string().nullable().default(null),
  /** Provider-side account reference (e.g. Pipedream's apn_…) used server-side to
   *  pin execution. An identifier, not a credential. */
  provider_account_id: z.string().nullable().default(null),
  connected:          z.boolean().default(true),
  status:             accountStatusSchema.default('active'),
  /** OAuth scopes the account holds, as the provider reports them. */
  authorized_scopes:  z.array(z.string()).default([]),
  shared_account_id:  z.string().nullable().default(null),
  linked_by_user_id:  z.string().nullable().default(null),
  can_manage:         z.boolean().default(false),
})

/** The Pipedream Apps API row the catalog sync stores per connector — typed
 *  mirror of the backend sync's App model. looseObject keeps any new provider
 *  fields Pipedream adds without failing the parse. */
const catalogMetadataSchema = z.looseObject({
  id:                 z.string().optional(),
  name_slug:          z.string().optional(),
  name:               z.string().optional(),
  img_src:            z.string().nullish(),
  description:        z.string().optional(),
  /** Provider auth style at Pipedream ("oauth" | "keys" | "none") — the
   *  catalog's auth_mode stays "oauth2" because linking always goes through
   *  the hosted Connect flow; this is the underlying truth. */
  auth_type:          z.string().nullish(),
  custom_fields_json: z.string().nullish(),
  categories:         z.array(z.string()).optional(),
  featured_weight:    z.number().nullish(),
})

const connectorCatalogEntrySchema = z.object({
  slug:                z.string(),
  display_name:        z.string(),
  auth_mode:           z.enum(['oauth2', 'api_key']),
  description:         z.string(),
  /** Provider-hosted brand logo (Pipedream Apps API img_src). Bundled assets
   *  in CONNECTOR_LOGO_MAP take precedence; this covers the long tail. */
  logo_url:            z.string().nullable().default(null),
  /** Provider taxonomy (Pipedream categories, e.g. "Communication"). Distinct
   *  from the FE's local connectorCategory grouping. */
  categories:          z.array(z.string()).default([]),
  catalog_metadata:    catalogMetadataSchema.default({}),
  tools:               z.array(toolEntrySchema).default([]),
  api_key_fields:      z.array(apiKeyFieldSchema).default([]),
  /** True when the current user's personal connector is linked. */
  linked:              z.boolean(),
  /** True when a shared organization account is attached and connected. */
  workspace_linked:    z.boolean().default(false),
  /** User ID that linked the shared organization account. */
  workspace_linked_by: z.string().nullable().default(null),
  /** ID of the org shared account currently attached to this connector. */
  shared_account_id:   z.string().nullable().default(null),
  /** Admin-friendly label of the attached org shared account. */
  account_label:       z.string().nullable().default(null),
  /** Provider identity (e.g. email/login) of the attached shared account. */
  account_identifier:  z.string().nullable().default(null),
  /** Org shared accounts for this connector. Populated for admins only. */
  accounts:            z.array(orgConnectorAccountSchema).default([]),
  /** Selectable account options the current user can execute under. */
  account_options:     z.array(connectorAccountOptionSchema).default([]),
  /** Whether this slug is in the org's enabled catalog. Nullable — null for a
   *  solo user with no org context. */
  org_enabled:         z.boolean().nullable().default(null),
  /** Status of the current user's own request to use this connector
   *  personally, when the org gates personal (private) links. Null when no
   *  such gate/request applies. */
  personal_access_status: z.enum(['pending', 'approved', 'denied']).nullable().default(null),
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
export type ConnectorToolPermission = z.infer<typeof toolPermissionSchema>
export type ApiKeyField            = z.infer<typeof apiKeyFieldSchema>

export function connectorToolPermission(tool: {
  allowed?: boolean
  blocked?: boolean
  permission?: ConnectorToolPermission
}): ConnectorToolPermission {
  if (tool.blocked) return 'blocked'
  if (tool.allowed) return 'allowed'
  return tool.permission ?? 'ask'
}

export function connectorToolBooleans(
  permission: ConnectorToolPermission,
): { allowed: boolean; blocked: boolean } {
  return {
    allowed: permission === 'allowed',
    blocked: permission === 'blocked',
  }
}

/** Snake_case shape of an org shared account as embedded in the catalog entry. */
export type ConnectorAccount       = z.infer<typeof orgConnectorAccountSchema>
export type ConnectorCatalogMetadata = z.infer<typeof catalogMetadataSchema>
export type ConnectorAccountOption = z.infer<typeof connectorAccountOptionSchema>
export type ConnectorCatalogEntry  = z.infer<typeof connectorCatalogEntrySchema>
export type ConnectorListResponse  = z.infer<typeof connectorListResponseSchema>
export type LinkResponse           = z.infer<typeof linkResponseSchema>
export type ConnectorAccountScope  = z.infer<typeof accountScopeSchema>

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
  permissions?: { slug: string; allowed: boolean; blocked: boolean }[]
  credentials?: Record<string, string>
}

// ── API functions ─────────────────────────────────────────────────────────────

const CATALOG_CACHE_TTL = 30_000
let _catalogCache: { data: ConnectorCatalogEntry[]; time: number } | null = null
let _catalogInFlight: Promise<ConnectorCatalogEntry[]> | null = null
let _catalogBySlug = new Map<string, ConnectorCatalogEntry>()

export function bustConnectorCatalogCache(): void {
  _catalogCache = null
  _catalogInFlight = null
  _catalogBySlug = new Map()
}

export function listConnectors(): Promise<ConnectorCatalogEntry[]> {
  if (_catalogCache && Date.now() - _catalogCache.time < CATALOG_CACHE_TTL) {
    return Promise.resolve(_catalogCache.data)
  }
  if (_catalogInFlight) return _catalogInFlight
  _catalogInFlight = apiFetchJson<unknown>(CONNECTORS_ENDPOINT)
    .then(raw => {
      const list = connectorListResponseSchema.parse(raw).connectors
      _catalogCache = { data: list, time: Date.now() }
      _catalogBySlug = new Map(list.map(entry => [entry.slug, entry]))
      return list
    })
    .finally(() => { _catalogInFlight = null })
  return _catalogInFlight
}

/**
 * Slug -> one Connector identity, resolved through the cached catalog when it's
 * loaded and through the bundled name/logo maps when it isn't. The single place
 * a persona's connector slugs (or any other slug) becomes something renderable.
 */
export function resolveConnector(slug: string): Connector {
  const entry = _catalogBySlug.get(slug)
  return entry ? toConnector(entry) : toConnector(slug)
}

export function resolveConnectors(slugs: string[]): Connector[] {
  return slugs.map(resolveConnector)
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
  bustConnectorCatalogCache()
  return connectorCatalogEntrySchema.parse(raw)
}

export async function unlinkConnector(slug: string): Promise<void> {
  const res = await apiFetch(CONNECTOR_DETAIL_ENDPOINT(slug), { method: 'DELETE' })
  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to unlink connector: ${res.status}`)
  }
  bustConnectorCatalogCache()
}

// ── Org connector catalog ─────────────────────────────────────────────────────

/**
 * GET /organizations/{id}/connectors/catalog — every active connector, with the
 * org's shared accounts filled in for admins. Read-only: the catalog is no
 * longer an allowlist the org edits, so there is no write counterpart. An org
 * that wants a connector files a request against
 * POST /organizations/{id}/connectors instead.
 */
export async function listOrgCatalog(orgId: string): Promise<ConnectorCatalogEntry[]> {
  const raw = await apiFetchJson<unknown>(ORG_CATALOG_ENDPOINT(orgId))
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
