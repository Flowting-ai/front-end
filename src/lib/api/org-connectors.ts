'use client'

// Connector sharing is workspace-wide: a shared account is created against
// the organization via POST .../connectors/{slug}/accounts. The row shape is
// ConnectionResponse — the same class GET /connectors embeds in `connections`.

import { apiFetch, apiFetchJson } from './client'
import { bustConnectorCatalogCache, ConnectorConnection } from './connectors'
import { linkResponseSchema } from './connector-schemas'
import {
  ORG_CONNECTOR_ACCOUNTS_ENDPOINT,
  ORG_CONNECTOR_ACCOUNT_ENDPOINT,
  ORG_CONNECTOR_USED_BY_ENDPOINT,
} from '@/lib/config'

export type { ConnectorConnection }

export interface ConnectorUsedByEntry {
  surface: string
  id:      string
  name:    string
}

export async function listOrgConnectorAccounts(orgId: string, slug: string): Promise<ConnectorConnection[]> {
  const raw = await apiFetchJson<unknown>(ORG_CONNECTOR_ACCOUNTS_ENDPOINT(orgId, slug))
  return ConnectorConnection.parseList(raw)
}

export async function createOrgConnectorAccount(
  orgId: string,
  slug: string,
  params: { accountLabel: string; accountIdentifier?: string; initData?: Record<string, string> },
): Promise<{ connectorSlug: string; redirectUrl: string | null; sharedAccountId: string }> {
  const body: Record<string, unknown> = { accountLabel: params.accountLabel }
  if (params.accountIdentifier) body.accountIdentifier = params.accountIdentifier
  if (params.initData)          body.init_data          = params.initData
  const data = linkResponseSchema.parse(
    await apiFetchJson<unknown>(
      ORG_CONNECTOR_ACCOUNTS_ENDPOINT(orgId, slug),
      { method: 'POST', body: JSON.stringify(body) },
    ),
  )
  bustConnectorCatalogCache()
  if (!data.shared_account_id) {
    throw new Error('Shared account was created without an id.')
  }
  return {
    connectorSlug: data.connector_slug,
    redirectUrl: data.redirect_url,
    sharedAccountId: data.shared_account_id,
  }
}

export async function updateOrgConnectorAccount(
  orgId: string,
  accountId: string,
  params: {
    accountLabel?:      string
    accountIdentifier?: string
    credentials?:       Record<string, string>
    status?:            ConnectorConnection['status']
    expectedVersion?:   number
  },
): Promise<ConnectorConnection> {
  const data = await apiFetchJson<unknown>(
    ORG_CONNECTOR_ACCOUNT_ENDPOINT(orgId, accountId),
    { method: 'PATCH', body: JSON.stringify(params) },
  )
  bustConnectorCatalogCache()
  return ConnectorConnection.parse(data)
}

export async function deleteOrgConnectorAccount(orgId: string, accountId: string): Promise<void> {
  await apiFetch(ORG_CONNECTOR_ACCOUNT_ENDPOINT(orgId, accountId), { method: 'DELETE' })
  bustConnectorCatalogCache()
}

export async function getConnectorUsedBy(orgId: string, slug: string): Promise<ConnectorUsedByEntry[]> {
  return apiFetchJson<ConnectorUsedByEntry[]>(ORG_CONNECTOR_USED_BY_ENDPOINT(orgId, slug))
}

export async function pollOrgConnectorAccountUntilConnected(
  orgId: string,
  slug: string,
  targetId: string,
  {
    initialIntervalMs = 2_000,
    maxIntervalMs     = 30_000,
    timeoutMs         = 120_000,
  }: { initialIntervalMs?: number; maxIntervalMs?: number; timeoutMs?: number } = {},
): Promise<ConnectorConnection> {
  const deadline = Date.now() + timeoutMs
  let intervalMs  = initialIntervalMs
  while (Date.now() < deadline) {
    const accounts = await listOrgConnectorAccounts(orgId, slug)
    const target = accounts.find(a => a.id === targetId)
    if (target?.connected) return target
    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs))
    intervalMs = Math.min(intervalMs * 2, maxIntervalMs)
  }
  throw new Error(`Shared account ${targetId} did not connect within ${timeoutMs}ms`)
}
