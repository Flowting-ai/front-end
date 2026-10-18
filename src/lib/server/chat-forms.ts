import { z } from "zod"
import { isSafeId } from "@/lib/server/backend"

/**
 * Zod schemas for the multipart bodies of POST /api/chat and
 * /api/persona-chat, checked before anything is forwarded. Limits mirror what
 * the backend accepts (services/chat/router.py: UUID ids, `algorithm` base|pro,
 * `effort` low|medium|high) plus caps the backend doesn't set. Attachments
 * arrive as Library file ids, not file parts.
 */

/** A pasted document can be long; anything past this is a client bug or abuse. */
export const MAX_INPUT_CHARS = 200_000
export const MAX_PIN_IDS = 100
export const MAX_LIBRARY_FILE_IDS = 100
export const MAX_SYSTEM_PROMPT_CHARS = 20_000
export const MAX_CONNECTOR_SLUGS = 50

const id = z.string().max(100).refine(isSafeId, "Invalid id")
const flag = z.enum(["true", "false"]).optional().transform(v => v === "true")
/** A JSON array of short string ids, sent as one form field. */
const idList = (field: string, max: number) => z.string().max(10_000).optional().refine(raw => {
  if (raw === undefined) return true
  try {
    const value: unknown = JSON.parse(raw)
    return Array.isArray(value) && value.length <= max && value.every(item => typeof item === "string" && item.length <= 100)
  } catch {
    return false
  }
}, `${field} must be a JSON array of ids`)
const pinIds = idList("pinIds", MAX_PIN_IDS)
const libraryFileIds = idList("libraryFileIds", MAX_LIBRARY_FILE_IDS)
const librarySourcesOff = idList("librarySourcesOff", 200)

/** A chat id: a real one, or a client placeholder ("temp-…") meaning "create". */
const chatId = z.string().max(100).optional().refine(v => v === undefined || v.startsWith("temp-") || isSafeId(v), "Invalid chatId")

export const chatFormSchema = z.object({
  input: z.string().max(MAX_INPUT_CHARS, "Message is too long").default(""),
  chatId,
  modelId: z.string().max(100).optional(),
  algorithm: z.enum(["base", "pro"]).optional(),
  pinIds,
  referenceMessageId: id.optional(),
  replaceMessageId: id.optional(),
  webSearch: flag,
  enable_thinking: flag,
  effort: z.string().max(20).optional(),
  personaId: id.optional(),
  systemPrompt: z.string().max(MAX_SYSTEM_PROMPT_CHARS).optional(),
  temperature: z.coerce.number().min(0, "temperature must be between 0 and 2").max(2, "temperature must be between 0 and 2").optional(),
  toneId: z.string().max(50).optional(),
  libraryFileIds,
  saveToLibrary: z.enum(["true", "false"]).optional(),
  librarySourcesOff,
}).superRefine((form, ctx) => {
  // The backend only knows these effort levels; only sent with thinking on.
  if (form.enable_thinking && form.effort && !["low", "medium", "high"].includes(form.effort)) {
    ctx.addIssue({ code: "custom", path: ["effort"], message: "effort must be low, medium or high" })
  }
})

export const personaChatFormSchema = z.object({
  input: z.string().max(MAX_INPUT_CHARS, "Message is too long").default(""),
  repoId: id,
  chatId,
  modelId: z.string().max(100).optional(),
  connectorSlugs: z.array(z.string().min(1).max(100)).max(MAX_CONNECTOR_SLUGS).default([]),
  libraryFileIds,
  saveToLibrary: z.enum(["true", "false"]).optional(),
})

export type ChatForm = z.infer<typeof chatFormSchema>
export type PersonaChatForm = z.infer<typeof personaChatFormSchema>

/** FormData text fields as an object: empty strings and File parts dropped, repeated keys listed. */
export function formFields(form: FormData, repeated: readonly string[] = []): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {}
  for (const key of new Set(form.keys())) {
    const values = form.getAll(key).filter((v): v is string => typeof v === "string" && v !== "")
    if (repeated.includes(key)) out[key] = values
    else if (values.length > 0) out[key] = values[0]
  }
  return out
}

/** The first issue as a short message for a 400. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid request"
}
