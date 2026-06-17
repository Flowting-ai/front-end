'use client'

import { apiFetchJson } from './client'
import {
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

// ── API functions ─────────────────────────────────────────────────────────────

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
