'use client'

import { z } from 'zod'
import { apiFetch, apiFetchJson } from './client'
import { toConnector, type Connector } from '@/lib/connector'
import {
  CONNECTORS_ENDPOINT,
  CONNECTOR_DETAIL_ENDPOINT,
  CONNECTOR_LINK_ENDPOINT,
  CONNECTOR_COMPLETE_ENDPOINT,
} from '@/lib/config'
import {
  connectionResponseSchema,
  connectorCatalogEntrySchema,
  connectorListResponseSchema,
  linkResponseSchema,
  type ApiKeyField,
  type ConnectorAccountScope,
  type ConnectorAccountStatus,
  type ConnectorCatalogEntryWire,
  type ConnectorCatalogMetadata,
  type ConnectorToolPermission,
  type ConnectionResponseWire,
  type LinkResponseWire,
  type ToolEntryWire,
} from './connector-schemas'

export type {
  ApiKeyField,
  ConnectorAccountScope,
  ConnectorAccountStatus,
  ConnectorCatalogMetadata,
  ConnectorToolPermission,
}

export type AccountVisibility = 'shared' | 'private'
export type AccountConnectionStatus = 'connected' | 'reconnect-required'
export type AccountPermissionSummary = 'always' | 'ask' | 'blocked' | 'custom'

export const DEFAULT_API_KEY_FIELD: ApiKeyField = {
  name:     'api_key',
  label:    'API Key',
  help:     '',
  secret:   true,
  required: true,
}

export class ConnectorTool {
  readonly key: string
  readonly name: string
  readonly description: string
  readonly readOnly: boolean | null
  readonly permission: ConnectorToolPermission

  constructor(wire: ToolEntryWire) {
    this.key = wire.key
    this.name = wire.name || wire.key
    this.description = wire.description
    this.readOnly = wire.read_only
    this.permission = wire.permission
  }

  get group(): 'read-only' | 'write' {
    return this.readOnly === true ? 'read-only' : 'write'
  }

  get permissionMode(): Exclude<AccountPermissionSummary, 'custom'> {
    return this.permission === 'allowed' ? 'always' : this.permission
  }

  withPermission(permission: ConnectorToolPermission): ConnectorTool {
    return new ConnectorTool({
      key: this.key,
      name: this.name,
      description: this.description,
      read_only: this.readOnly,
      permission,
    })
  }
}

export class ConnectorConnection {
  readonly id: string
  readonly nickname: string
  readonly scope: ConnectorAccountScope
  readonly connectorSlug: string
  readonly accountIdentifier: string | null
  readonly connected: boolean
  readonly status: ConnectorAccountStatus
  readonly version: number
  readonly linkedByUserId: string | null
  readonly createdAt: string
  readonly updatedAt: string

  constructor(wire: ConnectionResponseWire) {
    this.id = wire.id
    this.nickname = wire.nickname
    this.scope = wire.scope
    this.connectorSlug = wire.connector_slug
    this.accountIdentifier = wire.account_identifier
    this.connected = wire.connected
    this.status = wire.status
    this.version = wire.version
    this.linkedByUserId = wire.linked_by_user_id
    this.createdAt = wire.created_at
    this.updatedAt = wire.updated_at
  }

  static parse(raw: unknown): ConnectorConnection {
    return new ConnectorConnection(connectionResponseSchema.parse(raw))
  }

  static parseList(raw: unknown): ConnectorConnection[] {
    return z.array(connectionResponseSchema).parse(raw).map(wire => new ConnectorConnection(wire))
  }

  get visibility(): AccountVisibility {
    return this.scope === 'shared' ? 'shared' : 'private'
  }

  get isShared(): boolean {
    return this.scope === 'shared'
  }

  get isPrivate(): boolean {
    return this.scope === 'personal'
  }

  get email(): string {
    return this.accountIdentifier ?? ''
  }

  get needsReconnect(): boolean {
    return !this.connected || this.status !== 'active'
  }

  get connectionState(): AccountConnectionStatus {
    return this.needsReconnect ? 'reconnect-required' : 'connected'
  }

  canManage(canManageShared: boolean): boolean {
    return this.isPrivate || canManageShared
  }
}

export class ConnectorCatalog {
  readonly slug: string
  readonly displayName: string
  readonly authMode: 'oauth2' | 'api_key'
  readonly provider: string
  readonly description: string
  readonly logoUrl: string | null
  readonly categories: string[]
  readonly catalogMetadata: ConnectorCatalogMetadata
  readonly tools: ConnectorTool[]
  readonly apiKeyFields: ApiKeyField[]
  readonly linked: boolean
  readonly connections: ConnectorConnection[]

  constructor(wire: ConnectorCatalogEntryWire) {
    this.slug = wire.slug
    this.displayName = wire.display_name
    this.authMode = wire.auth_mode
    this.provider = wire.provider
    this.description = wire.description
    this.logoUrl = wire.logo_url
    this.categories = wire.categories
    this.catalogMetadata = wire.catalog_metadata
    this.tools = wire.tools.map(tool => new ConnectorTool(tool))
    this.apiKeyFields = wire.api_key_fields
    this.linked = wire.linked
    this.connections = wire.connections.map(row => new ConnectorConnection(row))
  }

  static parse(raw: unknown): ConnectorCatalog {
    return new ConnectorCatalog(connectorCatalogEntrySchema.parse(raw))
  }

  static parseList(raw: unknown): ConnectorCatalog[] {
    return connectorListResponseSchema.parse(raw).connectors.map(wire => new ConnectorCatalog(wire))
  }

  get name(): string {
    return this.displayName
  }

  get identity(): Connector {
    return toConnector({
      slug: this.slug,
      display_name: this.displayName,
      logo_url: this.logoUrl,
    })
  }

  get logo(): string | null {
    return this.identity.logo
  }

  get featuredWeight(): number | null {
    const weight = this.catalogMetadata.featured_weight
    return typeof weight === 'number' ? weight : null
  }

  get needsOAuthInitFields(): boolean {
    return this.authMode === 'oauth2' && this.apiKeyFields.length > 0
  }

  get privateConnections(): ConnectorConnection[] {
    return this.connections.filter(row => row.isPrivate)
  }

  get sharedConnections(): ConnectorConnection[] {
    return this.connections.filter(row => row.isShared)
  }

  get connectedPrivate(): ConnectorConnection[] {
    return this.privateConnections.filter(row => !row.needsReconnect)
  }

  get connectedShared(): ConnectorConnection[] {
    return this.sharedConnections.filter(row => !row.needsReconnect)
  }

  get hasPrivateAccount(): boolean {
    return this.privateConnections.length > 0
  }

  get isAvailable(): boolean {
    return this.linked
  }

  get permissionSummary(): AccountPermissionSummary {
    if (this.tools.length === 0) return 'custom'
    const first = this.tools[0].permissionMode
    return this.tools.every(tool => tool.permissionMode === first) ? first : 'custom'
  }

  get needsAttention(): boolean {
    return this.connections.some(row => row.needsReconnect)
  }

  static needingAttention(catalogs: ConnectorCatalog[]): ConnectorConnection[] {
    return catalogs.flatMap(catalog => catalog.connections.filter(row => row.needsReconnect))
  }
}

export type LinkResponse = {
  connectorSlug: string
  redirectUrl: string | null
  sharedAccountId: string | null
}

function linkFromWire(wire: LinkResponseWire): LinkResponse {
  return {
    connectorSlug: wire.connector_slug,
    redirectUrl: wire.redirect_url,
    sharedAccountId: wire.shared_account_id,
  }
}

export interface UpdateConnectorRequest {
  permissions?: { key: string; permission: ConnectorToolPermission }[]
  credentials?: Record<string, string>
}

export function oauthNeedsInitFields(
  c: { auth_mode?: string; api_key_fields?: ApiKeyField[] | null },
): boolean {
  return c.auth_mode === 'oauth2'
    && Array.isArray(c.api_key_fields)
    && c.api_key_fields.length > 0
}

const CATALOG_CACHE_TTL = 30_000
let catalogCache: { data: ConnectorCatalog[]; time: number } | null = null
let catalogInFlight: Promise<ConnectorCatalog[]> | null = null
let catalogBySlug = new Map<string, ConnectorCatalog>()

export function bustConnectorCatalogCache(): void {
  catalogCache = null
  catalogInFlight = null
  catalogBySlug = new Map()
}

function remember(entry: ConnectorCatalog): ConnectorCatalog {
  catalogBySlug.set(entry.slug, entry)
  if (catalogCache) {
    catalogCache.data = catalogCache.data.map(row => row.slug === entry.slug ? entry : row)
  }
  return entry
}

export function listConnectors(): Promise<ConnectorCatalog[]> {
  if (catalogCache && Date.now() - catalogCache.time < CATALOG_CACHE_TTL) {
    return Promise.resolve(catalogCache.data)
  }
  if (catalogInFlight) return catalogInFlight
  catalogInFlight = apiFetchJson<unknown>(CONNECTORS_ENDPOINT)
    .then(raw => {
      const list = ConnectorCatalog.parseList(raw)
      catalogCache = { data: list, time: Date.now() }
      catalogBySlug = new Map(list.map(entry => [entry.slug, entry]))
      return list
    })
    .finally(() => { catalogInFlight = null })
  return catalogInFlight
}

export function resolveConnector(slug: string): Connector {
  const entry = catalogBySlug.get(slug)
  return entry ? entry.identity : toConnector(slug)
}

export function resolveConnectors(slugs: string[]): Connector[] {
  return slugs.map(resolveConnector)
}

export async function getConnector(slug: string): Promise<ConnectorCatalog> {
  const raw = await apiFetchJson<unknown>(CONNECTOR_DETAIL_ENDPOINT(slug))
  return remember(ConnectorCatalog.parse(raw))
}

export async function initiateLink(
  slug: string,
  initData?: Record<string, string>,
): Promise<LinkResponse> {
  const hasInit = initData != null && Object.keys(initData).length > 0
  const raw = await apiFetchJson<unknown>(CONNECTOR_LINK_ENDPOINT(slug), {
    method: 'POST',
    ...(hasInit ? { body: JSON.stringify({ init_data: initData }) } : {}),
  })
  return linkFromWire(linkResponseSchema.parse(raw))
}

export async function completeZapierLink(
  slug: string,
  connectionId: string,
  sharedAccountId?: string | null,
): Promise<ConnectorCatalog> {
  const raw = await apiFetchJson<unknown>(CONNECTOR_COMPLETE_ENDPOINT(slug), {
    method: 'POST',
    body: JSON.stringify({
      connection_id: connectionId,
      ...(sharedAccountId ? { shared_account_id: sharedAccountId } : {}),
    }),
  })
  bustConnectorCatalogCache()
  return ConnectorCatalog.parse(raw)
}

export async function updateConnector(
  slug: string,
  body: UpdateConnectorRequest,
): Promise<ConnectorCatalog> {
  const raw = await apiFetchJson<unknown>(CONNECTOR_DETAIL_ENDPOINT(slug), {
    method: 'PATCH',
    body:   JSON.stringify(body),
  })
  bustConnectorCatalogCache()
  return ConnectorCatalog.parse(raw)
}

export async function unlinkConnector(slug: string): Promise<void> {
  const res = await apiFetch(CONNECTOR_DETAIL_ENDPOINT(slug), { method: 'DELETE' })
  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to unlink connector: ${res.status}`)
  }
  bustConnectorCatalogCache()
}

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

export function isSecretField(name: string): boolean {
  const lower = name.toLowerCase()
  return SECRET_KEYWORDS.some((kw) => lower.includes(kw))
}

export function fieldLabel(name: string): string {
  return (
    FIELD_LABELS[name] ??
    name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  )
}

export function fieldPlaceholder(name: string): string | undefined {
  return FIELD_PLACEHOLDERS[name]
}

export async function pollConnectorUntilActive(
  slug: string,
  {
    initialIntervalMs = 2_000,
    maxIntervalMs     = 30_000,
    timeoutMs         = 120_000,
    signal,
  }: { initialIntervalMs?: number; maxIntervalMs?: number; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<ConnectorCatalog> {
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
    intervalMs = Math.min(intervalMs * 2, maxIntervalMs)
  }
  throw new Error(`Connector ${slug} did not become linked within ${timeoutMs}ms`)
}
