import { z } from 'zod'
import type {
  AcceptShareResponse,
  PersonaShare,
  PersonaSharePreview,
  ReceivedShareResponse,
  SentShareResponse,
  ShareDashboardResponse,
  ShareRecipientSummary,
} from './persona-shares'

// Wire schemas for persona shares (`/persona-shares`) and chat shares
// (`/chat-shares`). Optional and nullable fields degrade to null / 0 / [] so a
// field the backend drops does not crash a page; a missing id fails the parse.

const nullableString = z.string().nullish().transform((v) => v ?? null)
const nullableNumber = z.number().nullish().transform((v) => v ?? null)
const count = z.number().nullish().transform((v) => v ?? 0)

const recipientSummarySchema: z.ZodType<ShareRecipientSummary> = z.object({
  recipient_user_id: z.string(),
  recipient_name: z.string().nullish().transform((v) => v ?? ''),
  recipient_email: nullableString,
  message_count: count,
  credit_used: count,
  credit_remaining: nullableNumber,
  is_active: z.boolean(),
  accepted_at: z.string(),
})

export const personaShareSchema: z.ZodType<PersonaShare> = z.object({
  id: z.string(),
  persona_repo_id: z.string(),
  persona_id: z.string().optional(),
  shared_by_user_id: z.string(),
  share_type: z.enum(['link', 'email']),
  recipient_emails: z.array(z.string()).nullish().transform((v) => v ?? null),
  credit_limit: nullableNumber,
  credit_used: count,
  credit_remaining: z.number().nullish(),
  expires_at: z.string(),
  is_active: z.boolean(),
  share_url: z.string(),
  created_at: z.string(),
  updated_at: z.string().optional(),
  persona_name: z.string().nullish(),
  pct_used: z.number().nullish(),
  recipients: z.array(recipientSummarySchema).optional(),
})

export const sharePreviewSchema: z.ZodType<PersonaSharePreview> = z.object({
  share_id: z.string(),
  persona_name: z.string(),
  description: nullableString,
  prompt: z.string().nullish().transform((v) => v ?? ''),
  model_id: nullableString,
  temperature: nullableNumber,
  image_url: nullableString,
  shared_by_name: z.string().nullish().transform((v) => v ?? ''),
  shared_by_email: z.string().nullish().transform((v) => v ?? ''),
  expires_at: z.string(),
  credit_limit: nullableNumber,
  credit_remaining: nullableNumber,
})

export const acceptShareSchema: z.ZodType<AcceptShareResponse> = z.object({
  id: z.string(),
  persona_repo_id: z.string(),
  name: z.string(),
  handler: z.string().nullish().transform((v) => v ?? ''),
  source_share_id: z.string().nullish().transform((v) => v ?? ''),
})

export const receivedShareSchema: z.ZodType<ReceivedShareResponse> = z.object({
  persona_id: z.string(),
  persona_repo_id: z.string(),
  share_id: z.string(),
  name: z.string(),
  description: nullableString,
  image_url: nullableString,
  shared_by_name: z.string().nullish().transform((v) => v ?? ''),
  shared_by_email: nullableString,
  credit_limit: nullableNumber,
  credit_used: count,
  credit_remaining: nullableNumber,
  is_available: z.boolean(),
  is_active: z.boolean(),
  expires_at: z.string(),
})

export const sentShareSchema: z.ZodType<SentShareResponse> = z.object({
  share_id: z.string(),
  persona_id: z.string(),
  recipient_user_id: z.string(),
  recipient_name: z.string().nullish().transform((v) => v ?? ''),
  recipient_email: nullableString,
  credit_limit: nullableNumber,
  credit_used: count,
  credit_remaining: nullableNumber,
  is_active: z.boolean(),
  accepted_at: z.string(),
})

export const shareDashboardSchema: z.ZodType<ShareDashboardResponse> = z.object({
  summary: z.object({
    active_links: count,
    total_links: count,
    conversations: count,
    conversations_delta_pct: nullableNumber,
    credits_this_month: count,
    credits_delta_pct: nullableNumber,
  }),
  daily: z.array(z.object({ date: z.string(), credits: count })).nullish().transform((v) => v ?? []),
  window_days: z.number(),
  // Malformed link cards are dropped rather than failing the whole dashboard.
  links: z.array(z.unknown()).nullish().transform((v) =>
    (v ?? []).flatMap((item) => {
      const parsed = personaShareSchema.safeParse(item)
      return parsed.success ? [parsed.data] : []
    })),
})

// ── Chat shares (snake_case wire shapes; chat-shares.ts maps them to camelCase) ──

export const chatShareResponseSchema = z.object({
  id: z.string(),
  chat_id: z.string(),
  shared_by_user_id: z.string(),
  shared_by_name: nullableString,
  shared_by_email: nullableString,
  target_user_id: z.string(),
  target_user_name: nullableString,
  target_user_email: nullableString,
  created_at: z.string(),
})

export const sharedChatItemResponseSchema = z.object({
  share_id: z.string(),
  chat_id: z.string(),
  chat_title: z.string().nullish().transform((v) => v ?? 'Untitled chat'),
  shared_by: z.object({ user_id: z.string(), name: nullableString, email: nullableString }),
  forked_chat_id: nullableString,
  created_at: z.string(),
})

export const forkResponseSchema = z.object({ chat_id: z.string() })

export const sharedChatViewResponseSchema = z.object({
  share_id: z.string(),
  chat_id: z.string(),
  chat_title: z.string().nullish().transform((v) => v ?? 'Untitled chat'),
  messages: z.array(z.object({
    id: z.string(),
    input: nullableString,
    output: nullableString,
    reasoning: nullableString,
    model_name: nullableString,
    created_at: z.string(),
  })),
})
