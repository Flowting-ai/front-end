"use client"

import { z } from 'zod'
import { apiKeyFieldSchema } from '@/lib/api/connector-schemas'
import { toConnector } from '@/lib/connector'
import { logger } from '@/lib/logger'

// Every card that blocks a turn on the person, defined once. Each schema reads the backend's
// prompt event (core/sse_schemas.py) and resolves to the shape its card renders.

const promptOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  style: z.string().optional(),
})

const questionOptionSchema = z.object({
  value:       z.string(),
  label:       z.string(),
  description: z.string().optional(),
  /** Agent choices only, filled by the server. */
  handle:      z.string().optional(),
  avatar_url:  z.string().optional(),
  recommended: z.boolean().default(false),
})

const YES_NO: z.infer<typeof questionOptionSchema>[] = [
  { value: 'yes', label: 'Yes', recommended: false },
  { value: 'no', label: 'No', recommended: false },
]

const questionSchema = z.object({
  id:           z.string(),
  question:     z.string(),
  type:         z.enum(['single_choice', 'multi_choice', 'text', 'yes_no']),
  entity:       z.enum(['generic', 'persona', 'pin']).default('generic'),
  options:      z.array(questionOptionSchema).default([]),
  placeholder:  z.string().optional(),
  required:     z.boolean().default(true),
  allow_custom: z.boolean().default(true),
}).transform((question) =>
  question.type === 'yes_no' && question.options.length === 0 ? { ...question, options: YES_NO } : question,
)

/** A question that fails its schema is left out; the rest of the card still shows. */
const questionsSchema = z.array(z.unknown()).default([]).transform((items) =>
  items.flatMap((item) => {
    const question = questionSchema.safeParse(item)
    return question.success ? [question.data] : []
  }),
)

const gateFields = {
  prompt_id:   z.string(),
  respond_url: z.string(),
}

const connectorFields = {
  connector_slug: z.string(),
  display_name:   z.string(),
  icon_url:       z.string().optional(),
  tool_slug:      z.string().default(''),
  options:        z.array(promptOptionSchema).default([]),
}

const APPROVAL_OPTIONS = [
  { value: 'approve', label: 'Approve', style: 'primary' },
  { value: 'reject', label: 'Reject', style: 'danger' },
]

export const promptSchemas = {
  tool_connect_prompt: z.object({
    ...gateFields,
    ...connectorFields,
    auth_mode:      z.enum(['oauth2', 'api_key']),
    provider:       z.string(),
    api_key_fields: z.array(apiKeyFieldSchema).default([]),
  }).transform((raw) => ({
    card:           'connect' as const,
    request_id:     raw.prompt_id,
    respond_url:    raw.respond_url,
    connector:      toConnector(raw),
    auth_mode:      raw.auth_mode,
    provider:       (['pipedream', 'mcp', 'zapier', 'api'] as const).find((value) => value === raw.provider),
    /** The action that needs the app. Empty when the run is binding the app itself. */
    tool_name:      raw.tool_slug,
    api_key_fields: raw.api_key_fields,
  })),

  permission_prompt: z.object({
    ...gateFields,
    ...connectorFields,
    /** What the call does ("Raw GET https://…"), shown when the tool slug is unreadable. */
    summary:        z.string().default(''),
    suggested_args: z.record(z.string(), z.unknown()).default({}),
    /** False for raw requests, which must not be saved in settings. */
    persistable:    z.boolean().default(true),
  }).transform((raw) => ({
    card:           'permission' as const,
    request_id:     raw.prompt_id,
    respond_url:    raw.respond_url,
    connector:      toConnector(raw),
    tool_name:      raw.tool_slug,
    summary:        raw.summary,
    suggested_args: raw.suggested_args,
    persistable:    raw.persistable,
    options:        raw.options,
  })),

  user_prompt: z.object({
    ...gateFields,
    kind:        z.string(),
    title:       z.string(),
    description: z.string().default(''),
    options:     z.array(promptOptionSchema).default([]),
  }).transform((raw) => chatPrompt(raw, {
    kind:        raw.kind,
    title:       raw.title || 'Quick question',
    description: raw.description,
    options:     raw.options,
  })),

  question_prompt: z.object({
    ...gateFields,
    title:       z.string().default(''),
    description: z.string().default(''),
    questions:   questionsSchema,
  }).transform((raw) => chatPrompt(raw, {
    kind:        'questions',
    title:       raw.title || 'Quick question',
    description: raw.description,
    questions:   raw.questions,
  })),

  approval_prompt: z.object({
    ...gateFields,
    ...connectorFields,
    verb:        z.string(),
    target:      z.string().default(''),
    preview_xml: z.string().default(''),
  }).transform((raw) => chatPrompt(raw, {
    kind:        'approval',
    title:       `Approve ${raw.verb || 'this action'}?`,
    description: raw.target || raw.preview_xml,
    options:     raw.options.length > 0 ? raw.options : APPROVAL_OPTIONS,
  })),
}

export type ChatPromptOption   = z.infer<typeof promptOptionSchema>
export type ChatPromptQuestion = z.infer<typeof questionSchema>

/** A question, choice or approval card: everything that is not about linking or permitting a connector. */
export interface ChatPrompt {
  card:        'chat'
  request_id:  string
  respond_url: string
  kind:        string
  title:       string
  description: string
  options:     ChatPromptOption[]
  questions:   ChatPromptQuestion[]
  /** Client-side only: the person's answer, kept in message state so an answered card stays hidden. */
  decision?:   string
}

function chatPrompt(
  gate: { prompt_id: string; respond_url: string },
  fields: Pick<ChatPrompt, 'kind' | 'title' | 'description'> & Partial<Pick<ChatPrompt, 'options' | 'questions'>>,
): ChatPrompt {
  return { card: 'chat', request_id: gate.prompt_id, respond_url: gate.respond_url, options: [], questions: [], ...fields }
}

export type PromptEventName           = keyof typeof promptSchemas
export type ConnectorConnectPrompt    = z.infer<typeof promptSchemas.tool_connect_prompt>
/** `decision` is client-side only: the person's answer ("allow" | "allow_once" | "block"). */
export type ConnectorPermissionPrompt = z.infer<typeof promptSchemas.permission_prompt> & { decision?: string }
export type PermissionPromptOption    = ConnectorPermissionPrompt['options'][number]
export type Prompt                    = ConnectorConnectPrompt | ConnectorPermissionPrompt | ChatPrompt

export const isPromptEvent = (name: string): name is PromptEventName => name in promptSchemas

/** The card for a prompt event, or null (logged) when the payload does not match its schema. */
export function parsePrompt(name: PromptEventName, raw: unknown): Prompt | null {
  const parsed = promptSchemas[name].safeParse(raw)
  if (parsed.success) return parsed.data
  logger.warn(`[prompts] '${name}' failed schema validation`, parsed.error.issues)
  return null
}
