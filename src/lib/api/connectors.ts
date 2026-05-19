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
  slug:           string
  display_name:   string
  auth_mode:      'oauth2' | 'api_key'
  description:    string
  tools:          ConnectorTool[]
  api_key_fields: string[]
  linked:         boolean
  status:         'pending' | 'active' | 'failed' | 'revoked' | null
  redirect_url:   string | null
  icon_url?:      string
}

export interface ConnectorListResponse {
  connectors: ConnectorCatalogEntry[]
}

export interface LinkResponse {
  redirect_url:          string
  connected_account_id:  string
  status:                string
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
 * Poll GET /connectors/{slug} until status === 'active', 'failed', or
 * 'revoked', or until timeoutMs elapses. Resolves with the final entry.
 */
export async function pollConnectorUntilActive(
  slug: string,
  { intervalMs = 2000, timeoutMs = 120_000 }: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<ConnectorCatalogEntry> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const entry = await getConnector(slug)
    if (entry.status === 'active') return entry
    if (entry.status === 'failed' || entry.status === 'revoked') {
      throw new Error(`Connector ${slug} ended in status: ${entry.status}`)
    }
    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs))
  }
  throw new Error(`Connector ${slug} did not become active within ${timeoutMs}ms`)
}
