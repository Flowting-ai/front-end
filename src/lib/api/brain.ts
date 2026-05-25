'use client'

import { apiFetch, apiFetchJson, ApiError } from './client'
import { API_BASE_URL } from '../config'

// ── Endpoint helpers ──────────────────────────────────────────────────────────

const withBase = (path: string) => `${API_BASE_URL}${path}`

const BRAIN_BASE     = withBase('/brain')
const BRAIN_CREATE   = withBase('/brain/create')
const BRAIN_RENAME   = withBase('/brain/rename')
const BRAIN_STREAM   = (chatId: string) => withBase(`/brain/${chatId}/stream`)
const BRAIN_MESSAGES = (chatId: string) => withBase(`/brain/${chatId}/messages`)
const BRAIN_PLANS    = (chatId: string) => withBase(`/brain/${chatId}/plans`)
const BRAIN_STOP     = (chatId: string) => withBase(`/brain/${chatId}/stop`)
const BRAIN_STAR     = (chatId: string) => withBase(`/brain/${chatId}/star`)
const PROMPT_RESPOND = (promptId: string) => withBase(`/chats/prompts/${promptId}`)

// ── Backend types ─────────────────────────────────────────────────────────────

export interface BackendPlanStep {
  id:              string
  title:           string
  description?:    string
  kind:            'skill' | 'connector' | 'tool' | 'synthesis'
  tool?:           string
  connector_slug?: string
  depends_on?:     string[]
  args_preview?:   Record<string, unknown>
  status?:         'pending' | 'running' | 'completed' | 'failed'
  result_preview?: string
  error?:          string
  started_at?:     string
  completed_at?:   string
}

export interface BackendPlanJson {
  summary:             string
  steps:               BackendPlanStep[]
  required_connectors: string[]
}

export interface BrainChatListItem {
  id:            string
  chat_title:    string
  starred:       boolean
  message_count: number
  created_at:    string
  updated_at:    string
}

export interface BrainPlanResponse {
  id:             string
  status:         'proposed' | 'approved' | 'countered' | 'cancelled' | 'executing' | 'completed' | 'failed'
  supersedes_id?: string
  counter_text?:  string
  plan_json:      BackendPlanJson
  final_error?:   string
  created_at:     string
}

export interface BrainMessage {
  id:                  string
  input:               string
  output:              string
  reasoning?:          string
  reasoning_sections?: unknown[]
  model_name?:         string
  created_at:          string
  tool_calls?:         unknown[]
  plan:                BrainPlanResponse | null
}

// ── Prompt response body ──────────────────────────────────────────────────────

export type PromptResponseBody =
  | { response: { decision: 'approve' } }
  | { response: { decision: 'counter'; counter_text: string } }
  | { response: { decision: 'cancel' } }

// ── SSE callbacks ─────────────────────────────────────────────────────────────

export interface BrainSSECallbacks {
  onNamed:  (name: string, data: unknown) => void
  onInline: (data: unknown) => void
  onClose?: () => void
  onError?: (e: Error) => void
}

// ── SSE stream consumer ───────────────────────────────────────────────────────

/**
 * Reads a Brain SSE response body until the stream closes.
 * Named events  ("event: <name>\ndata: {...}")  → callbacks.onNamed
 * Inline events ("data: {...}")                 → callbacks.onInline
 */
export async function consumeBrainStream(
  response: Response,
  callbacks: BrainSSECallbacks,
): Promise<void> {
  if (!response.body) {
    callbacks.onError?.(new Error('No response body'))
    callbacks.onClose?.()
    return
  }

  const reader  = response.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })

      let idx: number
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const raw = buf.slice(0, idx)
        buf = buf.slice(idx + 2)

        const lines = raw.split('\n')
        let eventName = ''
        let dataStr   = ''
        for (const line of lines) {
          if (line.startsWith('event: '))     eventName = line.slice(7).trim()
          else if (line.startsWith('data: ')) dataStr  += line.slice(6)
        }
        if (!dataStr) continue

        let data: unknown
        try { data = JSON.parse(dataStr) } catch { continue }

        if (eventName) callbacks.onNamed(eventName, data)
        else           callbacks.onInline(data)
      }
    }
  } catch (e) {
    callbacks.onError?.(e instanceof Error ? e : new Error(String(e)))
  } finally {
    callbacks.onClose?.()
  }
}

// ── Start new Brain chat ──────────────────────────────────────────────────────

/**
 * POST /brain/create — opens an SSE stream and returns the new chat ID
 * (from the X-Chat-Id response header) plus the raw Response for streaming.
 */
export async function startBrainChat(
  input:   string,
  opts:    { persona_id?: string; pin_ids?: string[] } = {},
  signal?: AbortSignal,
): Promise<{ chatId: string; stream: Response }> {
  const params = new URLSearchParams()
  params.append('input', input)
  if (opts.persona_id) params.append('persona_id', opts.persona_id)
  if (opts.pin_ids?.length) params.append('pin_ids', JSON.stringify(opts.pin_ids))

  const response = await apiFetch(BRAIN_CREATE, {
    method:  'POST',
    body:    params,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    signal,
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    console.error('[Brain] create failed', response.status, detail)
    throw new ApiError(response.status, 'brain_create_failed', 'Failed to start Brain chat')
  }

  const chatId = response.headers.get('X-Chat-Id') ?? ''
  return { chatId, stream: response }
}

// ── Continue existing Brain chat ──────────────────────────────────────────────

/**
 * POST /brain/{chat_id}/stream — opens an SSE stream for a follow-up turn.
 */
export async function continueBrainChat(
  chatId:  string,
  input:   string,
  opts:    { persona_id?: string; pin_ids?: string[] } = {},
  signal?: AbortSignal,
): Promise<Response> {
  const params = new URLSearchParams()
  params.append('input', input)
  if (opts.persona_id) params.append('persona_id', opts.persona_id)
  if (opts.pin_ids?.length) params.append('pin_ids', JSON.stringify(opts.pin_ids))

  const response = await apiFetch(BRAIN_STREAM(chatId), {
    method:  'POST',
    body:    params,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    signal,
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    console.error('[Brain] stream failed', response.status, detail)
    throw new ApiError(response.status, 'brain_stream_failed', 'Failed to stream Brain message')
  }

  return response
}

// ── REST helpers ──────────────────────────────────────────────────────────────

export async function getBrainMessages(chatId: string): Promise<BrainMessage[]> {
  return apiFetchJson<BrainMessage[]>(BRAIN_MESSAGES(chatId))
}

export async function getBrainPlans(chatId: string): Promise<BrainPlanResponse[]> {
  return apiFetchJson<BrainPlanResponse[]>(BRAIN_PLANS(chatId))
}

export async function listBrainChats(): Promise<BrainChatListItem[]> {
  return apiFetchJson<BrainChatListItem[]>(BRAIN_BASE)
}

/**
 * POST /chats/prompts/{prompt_id} — submit approve / counter / cancel for a plan.
 */
export async function respondToPrompt(
  promptId: string,
  body:     PromptResponseBody,
): Promise<void> {
  const response = await apiFetch(PROMPT_RESPOND(promptId), {
    method: 'POST',
    body:   JSON.stringify(body),
  })
  // 204 No Content is the success response
  if (!response.ok && response.status !== 204) {
    throw new ApiError(response.status, 'prompt_respond_failed', 'Failed to respond to prompt')
  }
}

export async function stopBrainChat(chatId: string): Promise<void> {
  await apiFetch(BRAIN_STOP(chatId), { method: 'POST' })
}

export async function starBrainChat(chatId: string): Promise<void> {
  await apiFetch(BRAIN_STAR(chatId), { method: 'PATCH' })
}

export async function renameBrainChat(chatId: string, chatTitle: string): Promise<void> {
  await apiFetch(BRAIN_RENAME, {
    method: 'PATCH',
    body:   JSON.stringify({ chat_id: chatId, chat_title: chatTitle }),
  })
}

export async function deleteBrainChat(chatId: string): Promise<void> {
  await apiFetch(BRAIN_BASE, {
    method: 'DELETE',
    body:   JSON.stringify({ chat_id: chatId }),
  })
}
