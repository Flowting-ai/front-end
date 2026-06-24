'use client'

import { z } from 'zod'
import { ApiError, apiFetch, apiFetchJson, friendlyApiError } from './client'
import {
  SLACK_INSTALL_ENDPOINT,
  SLACK_STATUS_ENDPOINT,
  SLACK_LINK_ENDPOINT,
  ORG_SLACK_CHANNELS_ENDPOINT,
  ORG_SLACK_CHANNEL_MAPPING_ENDPOINT,
  ORG_SLACK_INSTALLATION_ENDPOINT,
  ORG_SLACK_PROJECT_CHANNEL_ENDPOINT,
} from '@/lib/config'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SlackChannel {
  channelId:   string
  channelName: string
  isMember:    boolean
  isPrivate:   boolean
  projectId:   string | null
  projectTitle: string | null
}

/** Mirrors services/slack/schemas.py SlackChannelItem. `is_member` is not part
 *  of that schema (the project-channel endpoints never send it); it's kept
 *  optional only so the legacy channels-list normalizer can share this type. */
const slackChannelItemSchema = z.object({
  channel_id:    z.string(),
  channel_name:  z.string(),
  is_member:     z.boolean().optional(),
  is_private:    z.boolean().default(false),
  project_id:    z.string().nullable().default(null),
  project_title: z.string().nullable().default(null),
})

type SlackChannelItemResponse = z.infer<typeof slackChannelItemSchema>

interface SlackChannelsResponseRaw {
  team_id:   string
  team_name: string
  channels:  SlackChannelItemResponse[]
}

export interface SlackChannelsResponse {
  teamId:   string
  teamName: string
  channels: SlackChannel[]
}

function normalizeChannel(c: SlackChannelItemResponse): SlackChannel {
  return {
    channelId:   c.channel_id,
    channelName: c.channel_name,
    isMember:    c.is_member ?? false,
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
  }))
  return { connected: workspaces.length > 0, workspaces }
}

// ── API functions ─────────────────────────────────────────────────────────────

/** GET /slack/install — the "Add to Slack" URL (FE opens it; Slack redirects to the callback). */
export async function getSlackInstallUrl(): Promise<string> {
  const raw = await apiFetchJson<unknown>(SLACK_INSTALL_ENDPOINT)
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

/** GET /organizations/{id}/slack/channels */
export async function listSlackChannels(orgId: string): Promise<SlackChannelsResponse> {
  const data = await apiFetchJson<SlackChannelsResponseRaw>(ORG_SLACK_CHANNELS_ENDPOINT(orgId))
  return {
    teamId:   data.team_id,
    teamName: data.team_name,
    channels: data.channels.map(normalizeChannel),
  }
}

/** PUT /organizations/{id}/slack/channels/{channelId}/mapping */
export async function setSlackChannelMapping(
  orgId:     string,
  channelId: string,
  projectId: string | null,
): Promise<SlackChannel> {
  const data = await apiFetchJson<SlackChannelItemResponse>(
    ORG_SLACK_CHANNEL_MAPPING_ENDPOINT(orgId, channelId),
    { method: 'PUT', body: JSON.stringify({ projectId }) },
  )
  return normalizeChannel(data)
}

// ── Identity link / unlink (the /connect + /disconnect flow) ──────────────────

interface SlackLinkResponseRaw {
  ok:      boolean
  team_id: string
}

interface SlackDisconnectResponseRaw {
  ok:      boolean
  removed: number
}

/** POST /slack/link — complete a `/connect` deep link, binding the Slack
 * identity carried in `state` to the logged-in account. */
export async function linkSlackIdentity(state: string): Promise<{ teamId: string }> {
  const data = await apiFetchJson<SlackLinkResponseRaw>(SLACK_LINK_ENDPOINT, {
    method: 'POST',
    body:   JSON.stringify({ state }),
  })
  return { teamId: data.team_id }
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

/** GET /organizations/{id}/slack/projects/{projectId}/channel */
export async function getProjectSlackChannel(
  orgId: string,
  projectId: string,
): Promise<SlackChannel | null> {
  const raw = await apiFetchJson<unknown>(
    ORG_SLACK_PROJECT_CHANNEL_ENDPOINT(orgId, projectId),
  )
  if (raw == null) return null
  return normalizeChannel(slackChannelItemSchema.parse(raw))
}

/** POST /organizations/{id}/slack/projects/{projectId}/channel */
export async function createProjectSlackChannel(
  orgId: string,
  projectId: string,
  params: { name: string; isPrivate?: boolean },
): Promise<SlackChannel> {
  const raw = await apiFetchJson<unknown>(
    ORG_SLACK_PROJECT_CHANNEL_ENDPOINT(orgId, projectId),
    {
      method: 'POST',
      body: JSON.stringify({ name: params.name, is_private: params.isPrivate ?? false }),
    },
  )
  return normalizeChannel(slackChannelItemSchema.parse(raw))
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
