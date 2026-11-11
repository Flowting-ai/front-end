'use client'

import { apiFetch, apiFetchJson, ApiError, friendlyApiError } from './client'
import {
  CHAT_SHARES_ENDPOINT,
  CHAT_SHARES_SHARED_WITH_ME_ENDPOINT,
  CHAT_SHARE_ENDPOINT,
  CHAT_SHARE_FORK_ENDPOINT,
} from '@/lib/config'
import { trackBrowserEvent } from '@/lib/analytics/events'
import { parseList } from './project-schemas'
import {
  chatShareResponseSchema,
  forkResponseSchema,
  sharedChatItemResponseSchema,
  sharedChatViewResponseSchema,
} from './share-schemas'

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
  const data = chatShareResponseSchema.parse(await apiFetchJson<unknown>(CHAT_SHARES_ENDPOINT, {
    method: 'POST',
    body:   JSON.stringify({ chatId: params.chatId, userId: params.userId }),
  }))
  trackBrowserEvent('share_created', { kind: 'user' })
  return normalizeShare(data)
}

/** GET /chat-shares?chat_id=... */
export async function listChatShares(chatId: string): Promise<ChatShare[]> {
  const url = `${CHAT_SHARES_ENDPOINT}?chat_id=${encodeURIComponent(chatId)}`
  return parseList(chatShareResponseSchema, await apiFetchJson<unknown>(url), 'chat share').map(normalizeShare)
}

/** GET /chat-shares/shared-with-me */
export async function listSharedWithMe(): Promise<SharedChatItem[]> {
  const raw = await apiFetchJson<unknown>(CHAT_SHARES_SHARED_WITH_ME_ENDPOINT)
  return parseList(sharedChatItemResponseSchema, raw, 'shared chat').map(normalizeSharedItem)
}

/** POST /chat-shares/{shareId}/fork */
export async function forkChatShare(shareId: string): Promise<{ chatId: string }> {
  const data = forkResponseSchema.parse(await apiFetchJson<unknown>(CHAT_SHARE_FORK_ENDPOINT(shareId), {
    method: 'POST',
  }))
  trackBrowserEvent('share_forked', { kind: 'chat' })
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
  trackBrowserEvent('share_revoked', { kind: 'chat' })
}

// ── Shared chat view (§19.4) ──────────────────────────────────────────────────
// Viewing is always read-only-in-place; forking into your own editable copy
// is always offered as a separate action — there's no mode to gate either on.

export interface SharedChatMessage {
  id:        string
  input:     string | null
  output:    string | null
  /** The model's reasoning for this reply, when it had any. */
  reasoning: string | null
  modelName: string | null
  createdAt: string
}

export interface SharedChatView {
  shareId:   string
  chatId:    string
  chatTitle: string
  messages:  SharedChatMessage[]
}

/** GET /chat-shares/{shareId} — returns live view with full message history */
export async function getSharedChatView(shareId: string): Promise<SharedChatView> {
  const data = sharedChatViewResponseSchema.parse(await apiFetchJson<unknown>(CHAT_SHARE_ENDPOINT(shareId)))
  return {
    shareId:   data.share_id,
    chatId:    data.chat_id,
    chatTitle: data.chat_title,
    messages:  data.messages.map(m => ({
      id:        m.id,
      input:     m.input,
      output:    m.output,
      reasoning: m.reasoning?.trim() ? m.reasoning : null,
      modelName: m.model_name,
      createdAt: m.created_at,
    })),
  }
}
