'use client'

import { apiFetch, apiFetchJson } from './client'
import {
  ORG_CONNECTORS_ENDPOINT,
  ORG_CONNECTOR_REQUEST_ENDPOINT,
  ORG_CONNECTOR_ACCOUNTS_ENDPOINT,
  ORG_CONNECTOR_ACCOUNT_ENDPOINT,
  ORG_CONNECTOR_USED_BY_ENDPOINT,
} from '@/lib/config'

// ── Types ─────────────────────────────────────────────────────────────────────

export type AccountStatus = 'active' | 'disabled' | 'expired'

export interface OrgConnectorAccount {
  id:               string
  organizationId:   string
  connectorSlug:    string
  accountLabel:     string
  accountIdentifier: string | null
  connected:        boolean
  status:           AccountStatus
  version:          number
  /** Connector slugs this one account is attached to (it can fan out to many). */
  attachedSlugs:    string[]
  linkedByUserId:   string | null
  createdAt:        string
  updatedAt:        string
}

interface OrgConnectorAccountResponse {
  id:                   string
  organization_id:      string
  connector_slug:       string
  account_label:        string
  account_identifier:   string | null
  connected:            boolean
  status:               AccountStatus
  version:              number
  attached_slugs:       string[]
  linked_by_user_id:    string | null
  created_at:           string
  updated_at:           string
}

/** An organization's standing request for a connector — the only org-level
 *  gate left. Members file one as `pending`; an owner/admin's own request is
 *  approved on the spot. It never gates personal linking. */
export type ConnectorRequestStatus = 'pending' | 'approved' | 'denied'

export interface OrgConnectorRequest {
  organizationId:    string
  connectorSlug:     string
  status:            ConnectorRequestStatus
  requestedByUserId: string
  requestedByName:   string | null
  requestedByEmail:  string | null
  note:              string
  createdAt:         string
  updatedAt:         string
}

interface OrgConnectorRequestResponse {
  organization_id:      string
  connector_slug:       string
  status:               ConnectorRequestStatus
  requested_by_user_id: string
  requested_by_name:    string | null
  requested_by_email:   string | null
  note:                 string
  created_at:           string
  updated_at:           string
}

function normalizeRequest(r: OrgConnectorRequestResponse): OrgConnectorRequest {
  return {
    organizationId:    r.organization_id,
    connectorSlug:     r.connector_slug,
    status:            r.status,
    requestedByUserId: r.requested_by_user_id,
    requestedByName:   r.requested_by_name ?? null,
    requestedByEmail:  r.requested_by_email ?? null,
    note:              r.note ?? '',
    createdAt:         r.created_at,
    updatedAt:         r.updated_at,
  }
}

export interface ConnectorUsedByEntry {
  surface: string
  id:      string
  name:    string
}

function normalizeAccount(r: OrgConnectorAccountResponse): OrgConnectorAccount {
  return {
    id:               r.id,
    organizationId:   r.organization_id,
    connectorSlug:    r.connector_slug,
    accountLabel:     r.account_label,
    accountIdentifier: r.account_identifier ?? null,
    connected:        r.connected,
    status:           r.status,
    version:          r.version,
    attachedSlugs:    r.attached_slugs ?? [],
    linkedByUserId:   r.linked_by_user_id ?? null,
    createdAt:        r.created_at,
    updatedAt:        r.updated_at,
  }
}

// ── API functions ─────────────────────────────────────────────────────────────

/** GET /organizations/{id}/connectors — the org's connector requests. */
export async function listOrgConnectorRequests(orgId: string): Promise<OrgConnectorRequest[]> {
  const list = await apiFetchJson<OrgConnectorRequestResponse[]>(ORG_CONNECTORS_ENDPOINT(orgId))
  return list.map(normalizeRequest)
}

/** POST /organizations/{id}/connectors — file (or re-file) a connector request.
 *  Lands as `approved` when the caller is an owner/admin, else `pending`. */
export async function requestOrgConnector(
  orgId: string,
  slug: string,
  note = '',
): Promise<OrgConnectorRequest> {
  const data = await apiFetchJson<OrgConnectorRequestResponse>(ORG_CONNECTORS_ENDPOINT(orgId), {
    method: 'POST',
    body:   JSON.stringify({ slug, note }),
  })
  return normalizeRequest(data)
}

/** PATCH /organizations/{id}/connectors/{slug} — admin-only approve/deny. */
export async function setOrgConnectorStatus(
  orgId: string,
  slug: string,
  status: ConnectorRequestStatus,
): Promise<OrgConnectorRequest> {
  const data = await apiFetchJson<OrgConnectorRequestResponse>(
    ORG_CONNECTOR_REQUEST_ENDPOINT(orgId, slug),
    { method: 'PATCH', body: JSON.stringify({ status }) },
  )
  return normalizeRequest(data)
}

/** DELETE /organizations/{id}/connectors/{slug} — admin-only. */
export async function removeOrgConnector(orgId: string, slug: string): Promise<void> {
  await apiFetch(ORG_CONNECTOR_REQUEST_ENDPOINT(orgId, slug), { method: 'DELETE' })
}

/** GET /organizations/{id}/connectors/{slug}/accounts */
export async function listOrgConnectorAccounts(orgId: string, slug: string): Promise<OrgConnectorAccount[]> {
  const list = await apiFetchJson<OrgConnectorAccountResponse[]>(ORG_CONNECTOR_ACCOUNTS_ENDPOINT(orgId, slug))
  return list.map(normalizeAccount)
}

/** POST /organizations/{id}/connectors/{slug}/accounts */
export async function createOrgConnectorAccount(
  orgId: string,
  slug: string,
  params: { accountLabel: string; accountIdentifier?: string; initData?: Record<string, string> },
): Promise<{ connectorSlug: string; redirectUrl: string | null; sharedAccountId: string }> {
  const body: Record<string, unknown> = { accountLabel: params.accountLabel }
  if (params.accountIdentifier) body.accountIdentifier = params.accountIdentifier
  if (params.initData)          body.init_data          = params.initData
  const data = await apiFetchJson<{ connector_slug: string; redirect_url: string | null; shared_account_id: string }>(
    ORG_CONNECTOR_ACCOUNTS_ENDPOINT(orgId, slug),
    { method: 'POST', body: JSON.stringify(body) },
  )
  return { connectorSlug: data.connector_slug, redirectUrl: data.redirect_url, sharedAccountId: data.shared_account_id }
}

/** PATCH /organizations/{id}/connectors/accounts/{accountId} */
export async function updateOrgConnectorAccount(
  orgId: string,
  accountId: string,
  params: {
    accountLabel?:      string
    accountIdentifier?: string
    credentials?:       Record<string, string>
    status?:            AccountStatus
    expectedVersion?:   number
  },
): Promise<OrgConnectorAccount> {
  const data = await apiFetchJson<OrgConnectorAccountResponse>(
    ORG_CONNECTOR_ACCOUNT_ENDPOINT(orgId, accountId),
    { method: 'PATCH', body: JSON.stringify(params) },
  )
  return normalizeAccount(data)
}

/** DELETE /organizations/{id}/connectors/accounts/{accountId} */
export async function deleteOrgConnectorAccount(orgId: string, accountId: string): Promise<void> {
  await apiFetch(ORG_CONNECTOR_ACCOUNT_ENDPOINT(orgId, accountId), { method: 'DELETE' })
}

/** GET /organizations/{id}/connectors/{slug}/used-by */
export async function getConnectorUsedBy(orgId: string, slug: string): Promise<ConnectorUsedByEntry[]> {
  return apiFetchJson<ConnectorUsedByEntry[]>(ORG_CONNECTOR_USED_BY_ENDPOINT(orgId, slug))
}

/**
 * Poll GET /organizations/{id}/connectors/{slug}/accounts until the account
 * with `targetId` has `connected=true`, or until timeoutMs elapses.
 */
export async function pollOrgConnectorAccountUntilConnected(
  orgId: string,
  slug: string,
  targetId: string,
  {
    initialIntervalMs = 2_000,
    maxIntervalMs     = 30_000,
    timeoutMs         = 120_000,
  }: { initialIntervalMs?: number; maxIntervalMs?: number; timeoutMs?: number } = {},
): Promise<OrgConnectorAccount> {
  const deadline = Date.now() + timeoutMs
  let intervalMs  = initialIntervalMs
  while (Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop -- polling loop
    const accounts = await listOrgConnectorAccounts(orgId, slug)
    const target = accounts.find(a => a.id === targetId)
    if (target?.connected) return target
    // eslint-disable-next-line no-await-in-loop -- intentional delay
    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs))
    intervalMs = Math.min(intervalMs * 2, maxIntervalMs)
  }
  throw new Error(`Shared account ${targetId} did not connect within ${timeoutMs}ms`)
}
