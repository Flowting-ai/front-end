import { z } from 'zod'
import { apiFetchJson } from './client'
import { API_BASE_URL } from '../config'

/** The user's own memory, or an organization's shared memory (admins only) when `orgId` is set. */
const memoryBase = (orgId: string | null) =>
  orgId ? `${API_BASE_URL}/organizations/${orgId}/memory` : `${API_BASE_URL}/memory`

const memoryNoteSchema = z.object({
  path:        z.string(),
  title:       z.string(),
  /** One of the summary's groups, which the backend picks per memory. */
  group:       z.string(),
  description: z.string(),
  /** The note itself, markdown without its frontmatter. */
  content:     z.string(),
  updatedAt:   z.string(),
})

const memorySummarySchema = z.object({
  summary:     z.string(),
  /** Group names in display order. */
  groups:      z.array(z.string()),
  notes:       z.array(memoryNoteSchema),
  generatedAt: z.string(),
  /** Notes changed since this was written; the backend is already writing a fresh one. */
  stale:       z.boolean(),
})

const memoryEditSchema = z.object({
  reply:   z.string(),
  summary: memorySummarySchema,
})

export type MemoryNote = z.infer<typeof memoryNoteSchema>
export type MemorySummary = z.infer<typeof memorySummarySchema>
export type MemoryEdit = z.infer<typeof memoryEditSchema>

/** GET …/memory/summary — rewritten by the backend only when the notes changed since the last one. */
export async function fetchMemorySummary(orgId: string | null): Promise<MemorySummary> {
  return memorySummarySchema.parse(await apiFetchJson<unknown>(`${memoryBase(orgId)}/summary`))
}

/** POST …/memory/edit — the memory agent acts on the request and returns the fresh summary. */
export async function editMemory(orgId: string | null, message: string): Promise<MemoryEdit> {
  return memoryEditSchema.parse(await apiFetchJson<unknown>(`${memoryBase(orgId)}/edit`, {
    method: 'POST',
    body:   JSON.stringify({ message }),
  }))
}

/** DELETE …/memory/notes — forgets one listed note; the summary comes back without it while a fresh one is written. */
export async function forgetMemoryNote(orgId: string | null, path: string): Promise<MemorySummary> {
  return memorySummarySchema.parse(await apiFetchJson<unknown>(
    `${memoryBase(orgId)}/notes?path=${encodeURIComponent(path)}`,
    { method: 'DELETE' },
  ))
}
