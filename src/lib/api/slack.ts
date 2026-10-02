'use client'

import { z } from 'zod'
import { ApiError, apiFetch, apiFetchJson, friendlyApiError } from './client'
import { toConnector, type Connector } from '@/lib/connector'
import {
  SLACK_INSTALL_ENDPOINT,
  SLACK_STATUS_ENDPOINT,
  SLACK_LINK_ENDPOINT,
  ORG_SLACK_CHANNELS_ENDPOINT,
  ORG_SLACK_CHANNEL_SUMMARY_ENDPOINT,
  ORG_SLACK_INSTALLATION_ENDPOINT,
  ORG_SLACK_AUTOMATIONS_ENDPOINT,
  ORG_SLACK_CHANNEL_CONFIG_ENDPOINT,
  ORG_SLACK_CONNECTOR_ENDPOINT,
  ORG_SLACK_CONNECTORS_ENDPOINT,
  ORG_SLACK_CONFIG_ENDPOINT,
  ORG_SLACK_SKILLS_ENDPOINT,
  ORG_SLACK_PROJECT_CHANNEL_ENDPOINT,
  directUpload,
} from '@/lib/config'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SlackChannel {
  channelId:   string
  channelName: string
  isPrivate:   boolean
  projectId:   string | null
  projectTitle: string | null
}

/** Mirrors services/slack/schemas.py SlackChannelItem. */
const slackChannelItemSchema = z.object({
  channel_id:    z.string(),
  channel_name:  z.string(),
  is_private:    z.boolean().default(false),
  project_id:    z.string().nullable().default(null),
  project_title: z.string().nullable().default(null),
})

type SlackChannelItemResponse = z.infer<typeof slackChannelItemSchema>

function normalizeChannel(c: SlackChannelItemResponse): SlackChannel {
  return {
    channelId:   c.channel_id,
    channelName: c.channel_name,
    isPrivate:   c.is_private ?? false,
    projectId:   c.project_id ?? null,
    projectTitle: c.project_title ?? null,
  }
}

// ── Install / status types ──────────────────────────────────────────────────────

const slackInstallURLResponseSchema = z.object({ url: z.string() })

// Mirrors services/slack/schemas.py SlackWorkspaceStatus / SlackStatusResponse.
const slackWorkspaceStatusSchema = z.object({
  team_id:         z.string(),
  team_name:       z.string(),
  installed_at:    z.string(),
  missing_scopes:  z.array(z.string()).default([]),
  needs_reinstall: z.boolean().default(false),
})

const slackStatusResponseSchema = z.object({
  workspaces: z.array(slackWorkspaceStatusSchema).default([]),
})

type SlackStatusResponseRaw = z.infer<typeof slackStatusResponseSchema>

export interface SlackWorkspaceStatus {
  teamId:      string
  teamName:    string
  installedAt: string
  missingScopes: string[]
  needsReinstall: boolean
}

export interface SlackStatus {
  /** True when the bot is installed in at least one workspace for this user. */
  connected:  boolean
  workspaces: SlackWorkspaceStatus[]
}

function normalizeStatus(data: SlackStatusResponseRaw): SlackStatus {
  const workspaces = (data.workspaces ?? []).map(w => ({
    teamId:      w.team_id,
    teamName:    w.team_name,
    installedAt: w.installed_at,
    missingScopes: w.missing_scopes,
    needsReinstall: w.needs_reinstall,
  }))
  return { connected: workspaces.length > 0, workspaces }
}

// ── API functions ─────────────────────────────────────────────────────────────

/** GET /slack/install — the "Add to Slack" URL (FE opens it; Slack redirects to the callback). */
export async function getSlackInstallUrl(teamId?: string): Promise<string> {
  const endpoint = teamId
    ? `${SLACK_INSTALL_ENDPOINT}?${new URLSearchParams({ team_id: teamId })}`
    : SLACK_INSTALL_ENDPOINT
  const raw = await apiFetchJson<unknown>(endpoint)
  return slackInstallURLResponseSchema.parse(raw).url
}

/** GET /slack/status — workspaces where the bot is installed for this user. */
export async function getSlackStatus(): Promise<SlackStatus> {
  const raw = await apiFetchJson<unknown>(SLACK_STATUS_ENDPOINT)
  return normalizeStatus(slackStatusResponseSchema.parse(raw))
}

/** GET /organizations/{id}/slack/installation */
export async function getOrgSlackStatus(orgId: string): Promise<SlackStatus> {
  const raw = await apiFetchJson<unknown>(ORG_SLACK_INSTALLATION_ENDPOINT(orgId))
  return normalizeStatus(slackStatusResponseSchema.parse(raw))
}

const slackWorkspaceChannelSchema = z.object({
  id:            z.string(),
  name:          z.string(),
  is_private:    z.boolean(),
  project_id:    z.string().nullable(),
  project_title: z.string().nullable(),
})

export interface SlackWorkspaceChannel {
  id:           string
  name:         string
  isPrivate:    boolean
  projectId:    string | null
  projectTitle: string | null
}

function toWorkspaceChannel(row: z.infer<typeof slackWorkspaceChannelSchema>): SlackWorkspaceChannel {
  return {
    id:           row.id,
    name:         row.name,
    isPrivate:    row.is_private,
    projectId:    row.project_id,
    projectTitle: row.project_title,
  }
}

/** GET /organizations/{id}/slack/channels — channels the bot is a member of. */
export async function listSlackChannels(orgId: string): Promise<SlackWorkspaceChannel[]> {
  const raw = await apiFetchJson<unknown>(ORG_SLACK_CHANNELS_ENDPOINT(orgId))
  return z.array(slackWorkspaceChannelSchema).parse(raw).map(toWorkspaceChannel)
}

/** POST /organizations/{id}/slack/channels — create a channel, bound to a project when given. */
export async function createSlackChannel(
  orgId: string,
  params: { name: string; isPrivate: boolean; projectId: string | null },
): Promise<SlackWorkspaceChannel> {
  const raw = await apiFetchJson<unknown>(ORG_SLACK_CHANNELS_ENDPOINT(orgId), {
    method: 'POST',
    body: JSON.stringify({ name: params.name, is_private: params.isPrivate, project_id: params.projectId }),
  })
  return toWorkspaceChannel(slackWorkspaceChannelSchema.parse(raw))
}

const slackChannelSummarySchema = z.object({
  channel_id:    z.string(),
  summary:       z.string(),
  message_count: z.number(),
  as_of:         z.string(),
})

export interface SlackChannelSummary {
  channelId:    string
  summary:      string
  messageCount: number
  /** 00:00 UTC of the day the summary covers up to. */
  asOf:         string
}

/** GET /organizations/{id}/slack/channels/{channelId}/summary — made once per UTC day. */
export async function getSlackChannelSummary(
  orgId: string,
  channelId: string,
): Promise<SlackChannelSummary> {
  const raw = await apiFetchJson<unknown>(ORG_SLACK_CHANNEL_SUMMARY_ENDPOINT(orgId, channelId))
  const row = slackChannelSummarySchema.parse(raw)
  return { channelId: row.channel_id, summary: row.summary, messageCount: row.message_count, asOf: row.as_of }
}

// ── Identity link / unlink (the /connect + /disconnect flow) ──────────────────

interface SlackLinkResponseRaw {
  ok:                boolean
  team_id:           string
  authorization_url: string
}

interface SlackDisconnectResponseRaw {
  ok:      boolean
  removed: number
}

/** POST /slack/link — complete a `/connect` deep link, binding the Slack
 * identity carried in `state` to the logged-in account.
 *
 * Linking is only half the flow. `authorizationUrl` is Slack's per-person
 * consent screen, and the user token it mints is the only way Souvenir can read
 * Slack as the member rather than as the bot — searching their own messages
 * included. Dropping it leaves every identity linked but tokenless, so the
 * caller must send them there. */
export async function linkSlackIdentity(
  state: string,
): Promise<{ teamId: string; authorizationUrl: string }> {
  const data = await apiFetchJson<SlackLinkResponseRaw>(SLACK_LINK_ENDPOINT, {
    method: 'POST',
    body:   JSON.stringify({ state }),
  })
  return { teamId: data.team_id, authorizationUrl: data.authorization_url }
}

/** DELETE /slack/link — unlink the user's Slack identity from every workspace. */
export async function disconnectSlackIdentity(): Promise<{ removed: number }> {
  const data = await apiFetchJson<SlackDisconnectResponseRaw>(SLACK_LINK_ENDPOINT, {
    method: 'DELETE',
  })
  return { removed: data.removed }
}

/** DELETE /organizations/{id}/slack/installation — remove the bot from the
 * organization (revokes on Slack + drops the install). Admin only. */
export async function removeOrgSlackInstallation(orgId: string): Promise<void> {
  const response = await apiFetch(ORG_SLACK_INSTALLATION_ENDPOINT(orgId), { method: 'DELETE' })
  if (response.ok) return

  let rawMessage = `Request failed with status ${response.status}`
  try {
    const body = await response.json() as { detail?: string; message?: string; error?: string }
    rawMessage = body.detail ?? body.message ?? body.error ?? rawMessage
  } catch {
    // Keep the status-derived fallback for non-JSON responses.
  }
  throw new ApiError(
    response.status,
    'slack_uninstall_failed',
    friendlyApiError(rawMessage, response.status),
    rawMessage,
  )
}

/** PATCH /organizations/{id}/slack/projects/{projectId}/channel — rename the
 *  bound channel. Slack normalizes the name; name_taken/invalid_name → 400. */
export async function renameProjectSlackChannel(
  orgId: string,
  projectId: string,
  name: string,
): Promise<SlackChannel> {
  const raw = await apiFetchJson<unknown>(
    ORG_SLACK_PROJECT_CHANNEL_ENDPOINT(orgId, projectId),
    { method: 'PATCH', body: JSON.stringify({ name }) },
  )
  return normalizeChannel(slackChannelItemSchema.parse(raw))
}

const slackAppConfigSchema = z.object({
  name:        z.string(),
  description: z.string().default(''),
  prompt:      z.string().default(''),
  model_id:    z.string().nullable().default(null),
  skills:      z.array(z.string()).default([]),
  available_skills: z.array(z.object({
    name:        z.string(),
    description: z.string(),
  })).default([]),
})

export interface SlackSkill {
  name:        string
  description: string
}

export interface SlackAppConfig {
  name:        string
  description: string
  prompt:      string
  modelId:     string | null
  skills:      string[]
  availableSkills: SlackSkill[]
}

function normalizeSlackAppConfig(raw: unknown): SlackAppConfig {
  const config = slackAppConfigSchema.parse(raw)
  return {
    name: config.name,
    description: config.description,
    prompt: config.prompt,
    modelId: config.model_id,
    skills: config.skills,
    availableSkills: config.available_skills,
  }
}

/** GET /organizations/{id}/slack/config — the Slack app's name and instructions. */
export async function getSlackAppConfig(orgId: string): Promise<SlackAppConfig> {
  const raw = await apiFetchJson<unknown>(ORG_SLACK_CONFIG_ENDPOINT(orgId))
  return normalizeSlackAppConfig(raw)
}

/** PATCH /organizations/{id}/slack/config */
export async function updateSlackAppConfig(
  orgId: string,
  config: Partial<SlackAppConfig>,
): Promise<SlackAppConfig> {
  const body: Record<string, unknown> = {}
  if ('name' in config) body.name = config.name
  if ('description' in config) body.description = config.description
  if ('prompt' in config) body.prompt = config.prompt
  if ('modelId' in config) body.model_id = config.modelId
  if ('skills' in config) body.skills = config.skills
  const raw = await apiFetchJson<unknown>(ORG_SLACK_CONFIG_ENDPOINT(orgId), {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  return normalizeSlackAppConfig(raw)
}

/** Upload and enable a workspace-scoped Markdown skill for Slack. */
export async function uploadSlackSkill(orgId: string, file: File): Promise<SlackAppConfig> {
  const form = new FormData()
  form.append('file', file)
  const raw = await apiFetchJson<unknown>(directUpload(ORG_SLACK_SKILLS_ENDPOINT(orgId)), {
    method: 'POST',
    body: form,
  })
  return normalizeSlackAppConfig(raw)
}

const slackScopeConnectorSchema = z.object({
  id:             z.string(),
  account_id:     z.string(),
  connector_slug: z.string(),
  display_name:   z.string().nullable(),
  logo_url:       z.string().nullable(),
  account_label:  z.string(),
  owner_id:       z.string(),
  owner_name:     z.string(),
  owned:          z.boolean(),
  inherited:      z.boolean(),
})

/** A connected account lent to the Slack bot. It runs under its owner's permissions. */
export interface SlackScopeConnector {
  id:            string
  accountId:     string
  connector:     Connector
  accountLabel:  string
  ownerName:     string
  /** The viewer connected it, so they alone can change its permissions. */
  owned:         boolean
  /** Lent to the workspace and seen from a channel. */
  inherited:     boolean
}

function toScopeConnector(row: z.infer<typeof slackScopeConnectorSchema>): SlackScopeConnector {
  return {
    id:            row.id,
    accountId:     row.account_id,
    connector:     toConnector(row),
    accountLabel:  row.account_label,
    ownerName:     row.owner_name,
    owned:         row.owned,
    inherited:     row.inherited,
  }
}

/** GET /organizations/{id}/slack/connectors — workspace connectors, or a channel's with what it inherits. */
export async function listSlackConnectors(orgId: string, channelId: string | null): Promise<SlackScopeConnector[]> {
  const url = channelId
    ? `${ORG_SLACK_CONNECTORS_ENDPOINT(orgId)}?channel_id=${encodeURIComponent(channelId)}`
    : ORG_SLACK_CONNECTORS_ENDPOINT(orgId)
  const raw = await apiFetchJson<unknown>(url)
  return z.array(slackScopeConnectorSchema).parse(raw).map(toScopeConnector)
}

/** POST /organizations/{id}/slack/connectors — lend one of your own accounts. */
export async function lendSlackConnector(
  orgId: string,
  params: { accountId: string; channelId: string | null },
): Promise<SlackScopeConnector> {
  const raw = await apiFetchJson<unknown>(ORG_SLACK_CONNECTORS_ENDPOINT(orgId), {
    method: 'POST',
    body: JSON.stringify({ account_id: params.accountId, channel_id: params.channelId }),
  })
  return toScopeConnector(slackScopeConnectorSchema.parse(raw))
}

/** DELETE /organizations/{id}/slack/connectors/{entryId} */
export async function removeSlackConnector(orgId: string, entryId: string): Promise<void> {
  const response = await apiFetch(ORG_SLACK_CONNECTOR_ENDPOINT(orgId, entryId), { method: 'DELETE' })
  if (!response.ok) {
    throw new ApiError(response.status, 'slack_connector_remove_failed', 'Failed to remove connector')
  }
}

const slackChannelSettingsSchema = z.object({
  channel_id:   z.string(),
  instructions: z.string(),
  enabled:      z.boolean(),
})

export interface SlackChannelSettings {
  instructions: string
  enabled:      boolean
}

/** GET /organizations/{id}/slack/channels/{channelId}/config — the channel's own settings. */
export async function getSlackChannelSettings(orgId: string, channelId: string): Promise<SlackChannelSettings> {
  const row = slackChannelSettingsSchema.parse(await apiFetchJson<unknown>(ORG_SLACK_CHANNEL_CONFIG_ENDPOINT(orgId, channelId)))
  return { instructions: row.instructions, enabled: row.enabled }
}

/** PATCH /organizations/{id}/slack/channels/{channelId}/config */
export async function updateSlackChannelSettings(
  orgId: string,
  channelId: string,
  settings: Partial<SlackChannelSettings>,
): Promise<SlackChannelSettings> {
  const raw = await apiFetchJson<unknown>(ORG_SLACK_CHANNEL_CONFIG_ENDPOINT(orgId, channelId), {
    method: 'PATCH',
    body: JSON.stringify(settings),
  })
  const row = slackChannelSettingsSchema.parse(raw)
  return { instructions: row.instructions, enabled: row.enabled }
}

const slackChannelAutomationSchema = z.object({
  id:         z.string(),
  name:       z.string(),
  summary:    z.string(),
  channel_id: z.string(),
  status:     z.string(),
  owned:      z.boolean(),
  created_at: z.string(),
})

export interface SlackChannelAutomation {
  id:        string
  name:      string
  summary:   string
  channelId: string
  status:    string
  /** Only the owner can pause, run or delete it. */
  owned:     boolean
  createdAt: string
}

/** GET /organizations/{id}/slack/automations — automations watching channels you share with the bot. */
export async function listSlackChannelAutomations(orgId: string): Promise<SlackChannelAutomation[]> {
  const raw = await apiFetchJson<unknown>(ORG_SLACK_AUTOMATIONS_ENDPOINT(orgId))
  return z.array(slackChannelAutomationSchema).parse(raw).map(row => ({
    id:        row.id,
    name:      row.name,
    summary:   row.summary,
    channelId: row.channel_id,
    status:    row.status,
    owned:     row.owned,
    createdAt: row.created_at,
  }))
}

/** DELETE /organizations/{id}/slack/projects/{projectId}/channel — archive the
 *  Slack channel and unbind it from the project. */
export async function deleteProjectSlackChannel(
  orgId: string,
  projectId: string,
): Promise<void> {
  const response = await apiFetch(
    ORG_SLACK_PROJECT_CHANNEL_ENDPOINT(orgId, projectId),
    { method: 'DELETE' },
  )
  if (response.ok || response.status === 204) return

  let rawMessage = `Request failed with status ${response.status}`
  try {
    const body = await response.json() as { detail?: string; message?: string; error?: string }
    rawMessage = body.detail ?? body.message ?? body.error ?? rawMessage
  } catch {
    // Keep the status-derived fallback for non-JSON responses.
  }
  throw new ApiError(
    response.status,
    'slack_channel_delete_failed',
    friendlyApiError(rawMessage, response.status),
    rawMessage,
  )
}
