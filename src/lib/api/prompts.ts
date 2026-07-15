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
