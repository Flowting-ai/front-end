'use client'

import { apiFetch, apiFetchJson } from './client'
import {
  CHAT_SHARES_ENDPOINT,
  CHAT_SHARES_SHARED_WITH_ME_ENDPOINT,
  CHAT_SHARE_ENDPOINT,
  CHAT_SHARE_FORK_ENDPOINT,
} from '@/lib/config'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ChatShareMode = 'read_only' | 'editable'

export interface ChatShare {
  id:            string
  chatId:        string
  mode:          ChatShareMode
  sharedByUserId: string
  sharedByName:  string | null
  targetUserId:  string | null
  targetUserName: string | null
  targetUserEmail: string | null
  targetTeamId:  string | null
  targetProjectId: string | null
  createdAt:     string
}

export interface SharedChatItem {
  shareId:         string
  chatId:          string
  chatTitle:       string
  mode:            ChatShareMode
  sharedByName:    string | null
  sharedByUserId:  string | null
  targetTeamId:    string | null
  targetProjectId: string | null
  forkedChatId:    string | null
  createdAt:       string
}

// ── Backend shapes ─────────────────────────────────────────────────────────────

interface ChatShareResponse {
  id:                 string
  chat_id:            string
  mode:               ChatShareMode
  shared_by_user_id:  string
  shared_by_name:     string | null
  target_user_id:     string | null
  target_user_name:   string | null
  target_user_email:  string | null
  target_team_id:     string | null
  target_project_id:  string | null
  created_at:         string
}

interface SharedChatItemResponse {
  share_id:         string
  chat_id:          string
  chat_title:       string
  mode:             ChatShareMode
  shared_by:        { user_id?: string | null; name?: string | null } | null
  target_team_id:   string | null
  target_project_id: string | null
  forked_chat_id:   string | null
  created_at:       string
}

// ── Normalizers ───────────────────────────────────────────────────────────────

function normalizeShare(r: ChatShareResponse): ChatShare {
  return {
    id:              r.id,
    chatId:          r.chat_id,
    mode:            r.mode,
    sharedByUserId:  r.shared_by_user_id,
    sharedByName:    r.shared_by_name ?? null,
    targetUserId:    r.target_user_id ?? null,
    targetUserName:  r.target_user_name ?? null,
    targetUserEmail: r.target_user_email ?? null,
    targetTeamId:    r.target_team_id ?? null,
    targetProjectId: r.target_project_id ?? null,
    createdAt:       r.created_at,
  }
}

function normalizeSharedItem(r: SharedChatItemResponse): SharedChatItem {
  return {
    shareId:         r.share_id,
    chatId:          r.chat_id,
    chatTitle:       r.chat_title,
    mode:            r.mode,
    sharedByName:    r.shared_by?.name ?? null,
    sharedByUserId:  r.shared_by?.user_id ?? null,
    targetTeamId:    r.target_team_id ?? null,
    targetProjectId: r.target_project_id ?? null,
    forkedChatId:    r.forked_chat_id ?? null,
    createdAt:       r.created_at,
  }
}

// ── API functions ─────────────────────────────────────────────────────────────

/** POST /chat-shares */
export async function createChatShare(params: {
  chatId: string
  mode?: ChatShareMode
  userId?: string
  teamId?: string
  projectId?: string
}): Promise<ChatShare> {
  const body: Record<string, unknown> = { chatId: params.chatId }
  if (params.mode)   body.mode   = params.mode
  if (params.userId) body.userId = params.userId
  if (params.teamId) body.teamId = params.teamId
  if (params.projectId) body.projectId = params.projectId
  const data = await apiFetchJson<ChatShareResponse>(CHAT_SHARES_ENDPOINT, {
    method: 'POST',
    body:   JSON.stringify(body),
  })
  return normalizeShare(data)
}

/** GET /chat-shares?chat_id=... */
export async function listChatShares(chatId: string): Promise<ChatShare[]> {
  const url = `${CHAT_SHARES_ENDPOINT}?chat_id=${encodeURIComponent(chatId)}`
  const list = await apiFetchJson<ChatShareResponse[]>(url)
  return list.map(normalizeShare)
}

/** GET /chat-shares/shared-with-me */
export async function listSharedWithMe(): Promise<SharedChatItem[]> {
  const list = await apiFetchJson<SharedChatItemResponse[]>(CHAT_SHARES_SHARED_WITH_ME_ENDPOINT)
  return list.map(normalizeSharedItem)
}

/** POST /chat-shares/{shareId}/fork */
export async function forkChatShare(shareId: string): Promise<{ chatId: string }> {
  const data = await apiFetchJson<{ chat_id: string }>(CHAT_SHARE_FORK_ENDPOINT(shareId), {
    method: 'POST',
  })
  return { chatId: data.chat_id }
}

/** DELETE /chat-shares/{shareId} */
export async function deleteChatShare(shareId: string): Promise<void> {
  await apiFetch(CHAT_SHARE_ENDPOINT(shareId), { method: 'DELETE' })
}

// ── Shared chat view (§19.4) ──────────────────────────────────────────────────

export interface SharedChatMessage {
  id:        string
  input:     string | null
  output:    string | null
  modelName: string | null
  createdAt: string
}

export interface SharedChatView {
  shareId:   string
  chatId:    string
  chatTitle: string
  mode:      ChatShareMode
  messages:  SharedChatMessage[]
}

interface SharedChatViewResponse {
  share_id:   string
  chat_id:    string
  chat_title: string
  mode:       ChatShareMode
  messages:   {
    id:         string
    input:      string | null
    output:     string | null
    reasoning?: string | null
    model_name: string | null
    created_at: string
  }[]
}

/** GET /chat-shares/{shareId} — returns live view with full message history */
export async function getSharedChatView(shareId: string): Promise<SharedChatView> {
  const data = await apiFetchJson<SharedChatViewResponse>(CHAT_SHARE_ENDPOINT(shareId))
  return {
    shareId:   data.share_id,
    chatId:    data.chat_id,
    chatTitle: data.chat_title,
    mode:      data.mode,
    messages:  data.messages.map(m => ({
      id:        m.id,
      input:     m.input,
      output:    m.output,
      modelName: m.model_name,
      createdAt: m.created_at,
    })),
  }
}
