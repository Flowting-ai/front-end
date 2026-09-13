'use client'

import { apiFetch, apiFetchJson, ApiError, friendlyApiError } from './client'
import {
  CHAT_SHARES_ENDPOINT,
  CHAT_SHARES_SHARED_WITH_ME_ENDPOINT,
  CHAT_SHARE_ENDPOINT,
  CHAT_SHARE_FORK_ENDPOINT,
} from '@/lib/config'
import { trackBrowserEvent } from '@/lib/analytics/events'

// ── Types ─────────────────────────────────────────────────────────────────────
// Standalone chat sharing is person-to-person only now — no project/team
// target, no editable/read-only mode. Both were dropped from the backend in
// migration c8d1e4f7a2b5 (ChatShare.mode column removed, target_project_id
// removed; in-project chats use POST /chats/{id}/share instead, which
// inherits the whole project as its audience). Per spec, every share is
// uniformly "view read-only, then optionally fork your own copy" — there's
// no longer a distinguishing mode to gate that on.

export interface ChatShare {
  id:              string
  chatId:          string
  sharedByUserId:  string
  sharedByName:    string | null
  sharedByEmail:   string | null
  targetUserId:    string
  targetUserName:  string | null
  targetUserEmail: string | null
  createdAt:       string
}

export interface SharedChatItem {
  shareId:        string
  chatId:         string
  chatTitle:      string
  sharedByName:   string | null
  sharedByUserId: string
  forkedChatId:   string | null
  createdAt:      string
}

// ── Backend shapes ─────────────────────────────────────────────────────────────

interface ChatShareResponse {
  id:                 string
  chat_id:            string
  shared_by_user_id:  string
  shared_by_name:     string | null
  shared_by_email:    string | null
  target_user_id:     string
  target_user_name:   string | null
  target_user_email:  string | null
  created_at:         string
}

interface SharedChatItemResponse {
  share_id:       string
  chat_id:        string
  chat_title:     string
  shared_by:      { user_id: string; name: string | null; email: string | null }
  forked_chat_id: string | null
  created_at:     string
}

// ── Normalizers ───────────────────────────────────────────────────────────────

function normalizeShare(r: ChatShareResponse): ChatShare {
  return {
    id:              r.id,
    chatId:          r.chat_id,
    sharedByUserId:  r.shared_by_user_id,
    sharedByName:    r.shared_by_name ?? null,
    sharedByEmail:   r.shared_by_email ?? null,
    targetUserId:    r.target_user_id,
    targetUserName:  r.target_user_name ?? null,
    targetUserEmail: r.target_user_email ?? null,
    createdAt:       r.created_at,
  }
}

function normalizeSharedItem(r: SharedChatItemResponse): SharedChatItem {
  return {
    shareId:        r.share_id,
    chatId:         r.chat_id,
    chatTitle:      r.chat_title,
    sharedByName:   r.shared_by.name ?? null,
    sharedByUserId: r.shared_by.user_id,
    forkedChatId:   r.forked_chat_id ?? null,
    createdAt:      r.created_at,
  }
}

// ── API functions ─────────────────────────────────────────────────────────────

/** POST /chat-shares — person-to-person only; 400s if the chat is project-linked. */
export async function createChatShare(params: {
  chatId: string
  userId: string
}): Promise<ChatShare> {
  const data = await apiFetchJson<ChatShareResponse>(CHAT_SHARES_ENDPOINT, {
    method: 'POST',
    body:   JSON.stringify({ chatId: params.chatId, userId: params.userId }),
  })
  trackBrowserEvent('share_created', { kind: 'user' })
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
  const res = await apiFetch(CHAT_SHARE_ENDPOINT(shareId), { method: 'DELETE' })
  if (!res.ok) {
    let detail = `Failed to revoke share (${res.status})`
    try {
      const body = await res.json() as { detail?: string }
      if (typeof body.detail === 'string') detail = body.detail
    } catch { /* non-JSON error body */ }
    throw new ApiError(res.status, 'revoke_share_failed', friendlyApiError(detail, res.status), detail)
  }
}

// ── Shared chat view (§19.4) ──────────────────────────────────────────────────
// Viewing is always read-only-in-place; forking into your own editable copy
// is always offered as a separate action — there's no mode to gate either on.

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
  messages:  SharedChatMessage[]
}

interface SharedChatViewResponse {
  share_id:   string
  chat_id:    string
  chat_title: string
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
    messages:  data.messages.map(m => ({
      id:        m.id,
      input:     m.input,
      output:    m.output,
      modelName: m.model_name,
      createdAt: m.created_at,
    })),
  }
}
