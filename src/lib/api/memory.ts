import { z } from 'zod'
import { apiFetchJson } from './client'
import { API_BASE_URL } from '../config'

/** The user's own memory, or an organization's shared memory (admins only) when `orgId` is set. */
const memoryBase = (orgId: string | null) =>
  orgId ? `${API_BASE_URL}/organizations/${orgId}/memory` : `${API_BASE_URL}/memory`

const memoryGroupSchema = z.enum([
  'profile', 'topics', 'areas', 'people',
  'mission', 'company', 'product', 'customers', 'team', 'operations', 'decisions',
])

const memoryNoteSchema = z.object({
  path:        z.string(),
  title:       z.string(),
  group:       memoryGroupSchema,
  description: z.string(),
  /** The note itself, markdown without its frontmatter. */
  content:     z.string(),
  updatedAt:   z.string(),
})

const memorySummarySchema = z.object({
  summary:     z.string(),
  notes:       z.array(memoryNoteSchema),
  generatedAt: z.string(),
})

const memoryEditSchema = z.object({
  reply:   z.string(),
  summary: memorySummarySchema,
})

export type MemoryGroup = z.infer<typeof memoryGroupSchema>
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
