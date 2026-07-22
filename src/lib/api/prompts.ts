"use client"

import { z } from 'zod'

// ── Connector permission prompt (SSE) ─────────────────────────────────────────
// Wire schema for the backend's PermissionPromptEvent (core/sse_schemas.py).
// Older streams named the fields request_id/tool_name; the transform folds both
// eras into one canonical shape so every surface (chat, persona, agent
// configure, compare, brain) parses permission prompts identically.

const promptOptionSchema = z.object({
  value: z.string(),
  label: z.string().optional(),
  style: z.string().optional(),
})

export const connectorPermissionPromptSchema = z.looseObject({
  prompt_id:      z.string().optional(),
  request_id:     z.string().optional(),
  respond_url:    z.string().optional(),
  connector_slug: z.string().default(''),
  display_name:   z.string().optional(),
  tool_slug:      z.string().optional(),
  tool_name:      z.string().optional(),
  suggested_args: z.record(z.string(), z.unknown()).optional(),
  icon_url:       z.string().nullish(),
  /** Human-readable description of the exact call ("Raw GET https://…") —
   *  what the card shows when the tool slug is an unreadable raw slug. */
  summary:        z.string().optional(),
  /** False for synthetic/raw requests that must not be saved in settings. */
  persistable:    z.boolean().default(true),
  options:        z.array(promptOptionSchema).default([]),
  /** Client-side only: the user's answer ("allow" | "allow_once" | "block").
   *  Never sent on the wire — recorded in message state when the user decides,
   *  so answered prompts stay hidden across remounts (e.g. the message-id swap
   *  on message_saved). */
  decision:       z.string().optional(),
}).transform((raw) => ({
  request_id:     raw.prompt_id ?? raw.request_id ?? `cpp-${Date.now()}`,
  connector_slug: raw.connector_slug,
  display_name:   raw.display_name ?? raw.connector_slug,
  tool_name:      raw.tool_slug ?? raw.tool_name ?? '',
  suggested_args: raw.suggested_args,
  icon_url:       raw.icon_url ?? undefined,
  summary:        raw.summary ?? '',
  respond_url:    raw.respond_url,
  persistable:    raw.persistable,
  options:        raw.options.map((o) => ({ value: o.value, label: o.label ?? o.value, style: o.style })),
  decision:       raw.decision,
}))

export type ConnectorPermissionPrompt = z.infer<typeof connectorPermissionPromptSchema>
export type PermissionPromptOption    = ConnectorPermissionPrompt['options'][number]

/** Parse a raw SSE payload into the canonical prompt, or null if malformed. */
export function parsePermissionPrompt(raw: unknown): ConnectorPermissionPrompt | null {
  const parsed = connectorPermissionPromptSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

// ── Generic prompt gates (SSE) ────────────────────────────────────────────────

export interface ChatPromptOption {
  value: string
  label: string
  style?: string
}

export interface ChatPromptQuestion {
  id: string
  question: string
  type?: 'single_choice' | 'multi_choice' | 'text' | 'yes_no' | string
  options?: ChatPromptOption[]
  placeholder?: string
  required?: boolean
  allow_custom?: boolean
}

export interface ChatPrompt {
  request_id: string
  kind: string
  title: string
  description?: string
  options: ChatPromptOption[]
  questions?: ChatPromptQuestion[]
  respond_url?: string
  decision?: string
}

export type ChatPromptEventName = 'user_prompt' | 'questions' | 'approval_prompt'

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

const parseChatPromptOptions = (value: unknown): ChatPromptOption[] =>
  Array.isArray(value) ? value.flatMap((option) => {
    if (!option || typeof option !== 'object') return []
    const row = option as Record<string, unknown>
    const optionValue = optionalString(row.value)
    return optionValue ? [{
      value: optionValue,
      label: optionalString(row.label) || optionValue,
      style: optionalString(row.style),
    }] : []
  }) : []

/** Normalize all three non-connector prompt events into the one card model
 * used by chat, persona chat, and the agent test surface. */
export function parseChatPrompt(
  eventName: ChatPromptEventName,
  raw: unknown,
): ChatPrompt | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>
  const promptId = optionalString(data.prompt_id)
  if (!promptId) return null

  const options = parseChatPromptOptions(data.options)
  if (eventName === 'approval_prompt' && options.length === 0) {
    options.push(
      { value: 'approve', label: 'Approve', style: 'primary' },
      { value: 'reject', label: 'Reject', style: 'danger' },
    )
  }

  const questions = Array.isArray(data.questions)
    ? data.questions.flatMap((question): ChatPromptQuestion[] => {
        if (!question || typeof question !== 'object') return []
        const row = question as Record<string, unknown>
        const id = optionalString(row.id)
        const text = optionalString(row.question)
        if (!id || !text) return []
        const type = optionalString(row.type)
        const questionOptions = parseChatPromptOptions(row.options)
        if (type === 'yes_no' && questionOptions.length === 0) {
          questionOptions.push(
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          )
        }
        return [{
          id,
          question: text,
          type,
          options: questionOptions,
          placeholder: optionalString(row.placeholder),
          required: row.required !== false,
          allow_custom: row.allow_custom !== false,
        }]
      })
    : []

  return {
    request_id: promptId,
    kind: eventName === 'questions'
      ? 'questions'
      : eventName === 'approval_prompt' ? 'approval' : optionalString(data.kind) || 'input',
    title: eventName === 'approval_prompt'
      ? `Approve ${optionalString(data.verb) || 'this action'}?`
      : optionalString(data.title) || 'Quick question',
    description: eventName === 'approval_prompt'
      ? optionalString(data.target) || optionalString(data.preview_xml)
      : optionalString(data.description),
    options,
    questions: questions.length > 0 ? questions : undefined,
    respond_url: optionalString(data.respond_url),
  }
}
