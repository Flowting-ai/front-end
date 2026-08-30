'use client'

// Unified account/connector model for the Connectors v1.5 UI
// (docs v1.5/connectors-v1.5-migration-plan.md).
//
// The new design has ONE `Account` shape per connector with a shared/private
// visibility flag. The backend does not — personal links and org-shared
// accounts are two structurally different objects (see Gap #2 in the plan
// doc). This module is the single place that reconciles them: every screen
// should read `UnifiedAccount`/`UnifiedConnectorSummary`, never reach into
// `ConnectorCatalogEntry.accounts`/`account_options` directly.

import type {
  ApiKeyField,
  ConnectorAccountOption,
  ConnectorCatalogEntry,
  ConnectorTool,
} from '@/lib/api/connectors'

export type AccountVisibility = 'shared' | 'private'
export type AccountConnectionStatus = 'connected' | 'reconnect_required'
/** 'custom' covers: tools disagree (private), or no per-tool data exists yet (shared — Gap #11). */
export type AccountPermissionSummary = 'always' | 'ask' | 'blocked' | 'custom'

export interface UnifiedAccount {
  /** `personal:{slug}` for the viewer's own link, else the org shared account's real id. */
  id: string
  connectorSlug: string
  connectorName: string
  nickname: string
  email: string
  visibility: AccountVisibility
  status: AccountConnectionStatus
  /** Aggregate permission summary for display only — see Gap #11 for why shared is always 'custom'. */
  permission: AccountPermissionSummary
  /** Whether the viewer can edit/remove this specific account (Settings/Access/remove actions). */
  canManage: boolean
  /** Present only on the viewer's own private account. */
  ownerId?: string
}

export interface UnifiedConnectorSummary {
  slug: string
  name: string
  description: string
  logoUrl: string | null
  authMode: 'oauth2' | 'api_key'
  apiKeyFields: ApiKeyField[]
  tools: ConnectorTool[]
  accounts: UnifiedAccount[]
  /** True when the viewer's own personal link exists (mirrors entry.linked). */
  hasPrivateAccount: boolean
  /** Original catalog entry, for call sites that still need a raw field. */
  raw: ConnectorCatalogEntry
}

function summarizePermission(tools: ConnectorTool[]): AccountPermissionSummary {
  if (tools.length === 0) return 'custom'
  const first = tools[0].permission
  const uniform = tools.every(t => t.permission === first)
  if (!uniform) return 'custom'
  if (first === 'allowed') return 'always'
  if (first === 'blocked') return 'blocked'
  return 'ask'
}

function accountFromOption(
  option: ConnectorAccountOption,
  entry: ConnectorCatalogEntry,
  privatePermission: AccountPermissionSummary,
): UnifiedAccount {
  const visibility: AccountVisibility = option.scope === 'personal' ? 'private' : 'shared'
  const connected = option.connected && option.status === 'active'
  return {
    id: visibility === 'shared'
      ? option.shared_account_id ?? `shared:${entry.slug}:${option.account_label}`
      : `personal:${entry.slug}`,
    connectorSlug: entry.slug,
    connectorName: entry.display_name,
    nickname: option.account_label,
    email: option.account_identifier ?? '',
    visibility,
    status: connected ? 'connected' : 'reconnect_required',
    // Shared accounts have no per-tool permission storage at all today
    // (Gap #11) — always reported as 'custom' rather than faking a value.
    permission: visibility === 'private' ? privatePermission : 'custom',
    canManage: visibility === 'private' ? true : option.can_manage,
    ownerId: visibility === 'private' ? (option.linked_by_user_id ?? 'me') : undefined,
  }
}

/** Build the unified view of one catalog entry. The single conversion point
 *  between the backend's split personal/shared model and the new design's
 *  one-account-shape-with-visibility model. */
export function summarizeConnector(entry: ConnectorCatalogEntry): UnifiedConnectorSummary {
  const privatePermission = summarizePermission(entry.tools)
  const accounts = entry.account_options.map(option => accountFromOption(option, entry, privatePermission))

  // Fallback for the rare case where `linked` is true but the backend hasn't
  // (yet) surfaced a matching `account_options` entry — don't silently drop
  // a connected account from the UI.
  if (entry.linked && !accounts.some(a => a.visibility === 'private')) {
    accounts.unshift({
      id: `personal:${entry.slug}`,
      connectorSlug: entry.slug,
      connectorName: entry.display_name,
      nickname: entry.account_label ?? entry.display_name,
      email: entry.account_identifier ?? '',
      visibility: 'private',
      status: 'connected',
      permission: privatePermission,
      canManage: true,
      ownerId: 'me',
    })
  }

  return {
    slug: entry.slug,
    name: entry.display_name,
    description: entry.description,
    logoUrl: entry.logo_url,
    authMode: entry.auth_mode,
    apiKeyFields: entry.api_key_fields,
    tools: entry.tools,
    accounts,
    hasPrivateAccount: entry.linked,
    raw: entry,
  }
}

export function summarizeCatalog(entries: ConnectorCatalogEntry[]): UnifiedConnectorSummary[] {
  return entries.map(summarizeConnector)
}

/** True when this connector has at least one account that needs reconnecting —
 *  drives the S14 "N accounts need attention" banner. */
export function needsAttention(summary: UnifiedConnectorSummary): boolean {
  return summary.accounts.some(a => a.status === 'reconnect_required')
}

export function accountsNeedingAttention(summaries: UnifiedConnectorSummary[]): UnifiedAccount[] {
  return summaries.flatMap(s => s.accounts.filter(a => a.status === 'reconnect_required'))
}
