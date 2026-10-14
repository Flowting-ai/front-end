import { z } from 'zod'

// Mirrors back-end services/projects/schemas.py (camelCase on the wire, except
// members — see projectMemberSchema). Optional fields get the same defaults the
// backend models declare, so a field the backend drops degrades instead of
// crashing; a missing required field (id, title, owner…) fails the parse.

const visibilitySchema = z
  .string()
  .nullish()
  .transform((v): 'personal' | 'workspace' | 'shared' =>
    v === 'workspace' || v === 'shared' ? v : 'personal')

export const projectDocumentSchema = z.object({
  id:        z.string(),
  filename:  z.string(),
  fileLink:  z.string().default(''),
  createdAt: z.string(),
})

export const projectSummarySchema = z.object({
  id:             z.string(),
  ownerUserId:    z.string(),
  organizationId: z.string().nullish(),
  visibility:     visibilitySchema,
  title:          z.string(),
  description:    z.string().nullish().transform(v => v ?? ''),
  tags:           z.array(z.string()).nullish().transform(v => v ?? []),
  createdAt:      z.string(),
  updatedAt:      z.string(),
  chatCount:      z.number().default(0),
  documentCount:  z.number().default(0),
})

export const projectResponseSchema = z.object({
  id:                z.string(),
  ownerUserId:       z.string(),
  organizationId:    z.string().nullish(),
  visibility:        visibilitySchema,
  title:             z.string(),
  description:       z.string().nullish().transform(v => v ?? ''),
  systemInstruction: z.string().nullish().transform(v => v ?? ''),
  tags:              z.array(z.string()).nullish().transform(v => v ?? []),
  createdAt:         z.string(),
  updatedAt:         z.string(),
  documents:         z.array(projectDocumentSchema).nullish().transform(v => v ?? []),
})

/** GET /projects/{id}/members — the one snake_case response in this API. */
export const projectMemberSchema = z.object({
  user_id: z.string(),
  name:    z.string().nullable().default(null),
  email:   z.string().nullable().default(null),
})

export const projectChatSummarySchema = z.object({
  id:           z.string(),
  ownerUserId:  z.string(),
  chatTitle:    z.string(),
  visibility:   z.string().optional(),
  starred:      z.boolean().default(false),
  createdAt:    z.string(),
  updatedAt:    z.string(),
  messageCount: z.number().default(0),
})

export type ProjectSummaryWire = z.infer<typeof projectSummarySchema>
export type ProjectResponseWire = z.infer<typeof projectResponseSchema>
export type ProjectMemberWire = z.infer<typeof projectMemberSchema>
export type ProjectChatSummaryWire = z.infer<typeof projectChatSummarySchema>

/**
 * Parses a list response item by item. A malformed row is dropped (and
 * reported once) rather than failing the whole list, so one bad project can't
 * empty the sidebar; a non-array body is a hard error.
 */
export function parseList<T>(schema: z.ZodType<T>, raw: unknown, what: string): T[] {
  if (!Array.isArray(raw)) throw new Error(`Unexpected ${what} response: expected a list`)
  const out: T[] = []
  let dropped = 0
  for (const item of raw) {
    const parsed = schema.safeParse(item)
    if (parsed.success) out.push(parsed.data)
    else dropped++
  }
  if (dropped > 0) console.warn(`[api] dropped ${dropped} malformed ${what} item(s)`)
  return out
}
