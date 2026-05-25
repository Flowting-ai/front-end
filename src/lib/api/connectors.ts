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

export interface ConnectorCatalogEntry {
  slug:            string
  display_name:    string
  auth_mode:       'oauth2' | 'api_key'
  description:     string
  tools?:          ConnectorTool[]
  api_key_fields?: string[]
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

/**
 * Poll GET /connectors/{slug} until `linked: true`, or until timeoutMs elapses.
 *
 * Per the API contract, `linked` is the source of truth for connection state —
 * Composio is queried fresh on every GET /connectors call, so it flips true
 * the moment OAuth completes.
 */
export async function pollConnectorUntilActive(
  slug: string,
  { intervalMs = 2000, timeoutMs = 120_000 }: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<ConnectorCatalogEntry> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop, react-doctor/async-await-in-loop -- polling loop; each check is gated on the previous result
    const entry = await getConnector(slug)
    if (entry.linked) return entry
    // eslint-disable-next-line no-await-in-loop, react-doctor/async-await-in-loop -- intentional delay between polls
    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs))
  }
  throw new Error(`Connector ${slug} did not become linked within ${timeoutMs}ms`)
}
