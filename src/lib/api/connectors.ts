"use client"

import { apiFetch, apiFetchJson } from './client'
import {
  CONNECTORS_ENDPOINT,
  CONNECTOR_DETAIL_ENDPOINT,
  CONNECTOR_LINK_ENDPOINT,
} from '@/lib/config'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ConnectorTool {
  slug: string
  policy: 'allow' | 'block' | 'ask' | 'allow_once'
}

/** Rich descriptor for a single credential field returned by GET /connectors/{slug}. */
export interface ApiKeyField {
  /** Key used in the PATCH credentials payload (e.g. "subdomain", "generic_api_key"). */
  name:      string
  /** Human-readable label shown above the input (e.g. "Store Subdomain"). */
  label:     string
  /** Placeholder / hint text (e.g. "your-store-name", "shpat_..."). */
  help?:     string
  /** When true the input should be rendered as type="password". */
  secret:    boolean
  /** When true the Connect button stays disabled until this field has a value. */
  required:  boolean
}

/** Fallback field used when the catalog entry omits api_key_fields entirely. */
export const DEFAULT_API_KEY_FIELD: ApiKeyField = {
  name:     'api_key',
  label:    'API Key',
  secret:   true,
  required: true,
}

export interface ConnectorCatalogEntry {
  slug:            string
  display_name:    string
  auth_mode:       'oauth2' | 'api_key'
  description:     string
  tools?:          ConnectorTool[]
  api_key_fields?: ApiKeyField[]
  linked:          boolean
  /** Not in OpenAPI spec — kept for back-compat with code that reads it. */
  icon_url?:       string
}

export interface ConnectorListResponse {
  connectors: ConnectorCatalogEntry[]
}

export interface LinkResponse {
  connector_slug: string
  // Nullable per the OpenAPI spec — backend may omit when an OAuth handler
  // can't produce a URL (misconfigured provider, missing client creds, etc.).
  redirect_url:   string | null
}

export interface UpdateConnectorRequest {
  permissions?: { slug: string; policy: 'allow' | 'block' | 'ask' | 'allow_once' }[]
  credentials?: Record<string, string>
}

// ── API functions ─────────────────────────────────────────────────────────────

export async function listConnectors(): Promise<ConnectorCatalogEntry[]> {
  const data = await apiFetchJson<ConnectorListResponse>(CONNECTORS_ENDPOINT)
  return data.connectors ?? []
}

export async function getConnector(slug: string): Promise<ConnectorCatalogEntry> {
  return apiFetchJson<ConnectorCatalogEntry>(CONNECTOR_DETAIL_ENDPOINT(slug))
}

export async function initiateLink(slug: string): Promise<LinkResponse> {
  return apiFetchJson<LinkResponse>(CONNECTOR_LINK_ENDPOINT(slug), { method: 'POST' })
}

export async function updateConnector(
  slug: string,
  body: UpdateConnectorRequest,
): Promise<ConnectorCatalogEntry> {
  return apiFetchJson<ConnectorCatalogEntry>(CONNECTOR_DETAIL_ENDPOINT(slug), {
    method: 'PATCH',
    body:   JSON.stringify(body),
  })
}

export async function unlinkConnector(slug: string): Promise<void> {
  const res = await apiFetch(CONNECTOR_DETAIL_ENDPOINT(slug), { method: 'DELETE' })
  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to unlink connector: ${res.status}`)
  }
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
  }: { initialIntervalMs?: number; maxIntervalMs?: number; timeoutMs?: number } = {},
): Promise<ConnectorCatalogEntry> {
  const deadline = Date.now() + timeoutMs
  let intervalMs  = initialIntervalMs
  while (Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop, react-doctor/async-await-in-loop -- polling loop; each check is gated on the previous result
    const entry = await getConnector(slug)
    if (entry.linked) return entry
    // eslint-disable-next-line no-await-in-loop, react-doctor/async-await-in-loop -- intentional delay between polls
    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs))
    // Double the interval each round, but never exceed the cap.
    intervalMs = Math.min(intervalMs * 2, maxIntervalMs)
  }
  throw new Error(`Connector ${slug} did not become linked within ${timeoutMs}ms`)
}
