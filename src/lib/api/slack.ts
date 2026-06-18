'use client'

import { apiFetchJson } from './client'
import {
  SLACK_INSTALL_ENDPOINT,
  SLACK_STATUS_ENDPOINT,
  SLACK_LINK_ENDPOINT,
  ORG_SLACK_CHANNELS_ENDPOINT,
  ORG_SLACK_CHANNEL_MAPPING_ENDPOINT,
} from '@/lib/config'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SlackChannel {
  channelId:   string
  channelName: string
  isMember:    boolean
  projectId:   string | null
}

interface SlackChannelItemResponse {
  channel_id:   string
  channel_name: string
  is_member?:   boolean
  project_id?:  string | null
}

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
    projectId:   c.project_id ?? null,
  }
}

// ── Install / status types ──────────────────────────────────────────────────────

interface SlackInstallURLResponseRaw {
  url: string
}

interface SlackWorkspaceStatusRaw {
  team_id:      string
  team_name:    string
  installed_at: string
}

interface SlackStatusResponseRaw {
  workspaces: SlackWorkspaceStatusRaw[]
}

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

// ── API functions ─────────────────────────────────────────────────────────────

/** GET /slack/install — the "Add to Slack" URL (FE opens it; Slack redirects to the callback). */
export async function getSlackInstallUrl(): Promise<string> {
  const data = await apiFetchJson<SlackInstallURLResponseRaw>(SLACK_INSTALL_ENDPOINT)
  return data.url
}

/** GET /slack/status — workspaces where the bot is installed for this user. */
export async function getSlackStatus(): Promise<SlackStatus> {
  const data = await apiFetchJson<SlackStatusResponseRaw>(SLACK_STATUS_ENDPOINT)
  const workspaces = (data.workspaces ?? []).map(w => ({
    teamId:      w.team_id,
    teamName:    w.team_name,
    installedAt: w.installed_at,
  }))
  return { connected: workspaces.length > 0, workspaces }
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
