import type { BadgeColor } from '@/components/Badge'
import type { PinProps, PinLabel } from '@/components/Pin'
import type { ApiProject, ApiProjectSummary, ApiProjectChat, ProjectVisibility, UpdateProjectParams } from '@/lib/api/projects'
import { projectFileSizesKey } from '@/lib/storage-keys'

// Project view models and the pure rules for merging server responses into the
// cached list. Used by context/projects-context.tsx; kept here so they test in Node.

export interface ProjectTag {
  id:    string
  label: string
  color: BadgeColor
}

// Backend stores tags as a flat `string[]` (label only) — color/id are
// frontend-only presentation, derived deterministically from position so a
// tag's color stays stable across loads/saves without needing its own storage.
export const TAG_COLORS: BadgeColor[] = ['Blue', 'Green', 'Yellow', 'Purple', 'Red', 'Brown']

export function tagsFromLabels(labels: string[]): ProjectTag[] {
  return labels.map((label, i) => ({ id: label, label, color: TAG_COLORS[i % TAG_COLORS.length] }))
}

export interface ProjectFile {
  id:         string
  name:       string
  type:       'PDF' | 'DOC' | 'FIG' | 'MD' | 'URL' | string
  sizeBytes:  number
  sizeLabel:  string
  uploadedAt: string
  url:        string
}

export interface ProjectChat {
  id:        string
  ownerUserId: string
  canEdit:   boolean
  projectId: string
  title:     string
  pinCount:  number
  createdAt: string
  updatedAt: string
}

export interface ProjectPin {
  id:          string
  projectId:   string
  chatId:      string
  chatTitle:   string
  category:    PinProps['category']
  pinTitle:    string
  description: string
  labels:      PinLabel[]
  createdAt:   string
}

export interface Project {
  id:           string
  ownerUserId:  string
  name:         string
  description:  string
  instructions: string
  teamId:       string | null
  visibility:   ProjectVisibility
  canEdit:      boolean
  tags:         ProjectTag[]
  files:        ProjectFile[]
  chatCount:    number
  updatedAt:    string
  createdAt:    string
}

export type ProjectPatch = Partial<Pick<Project, 'name' | 'description' | 'instructions' | 'tags' | 'visibility'>>

// ── File sizes (localStorage until the backend sends size_bytes) ─────────────

export function loadStoredSizes(projectId: string): Map<string, number> {
  if (typeof window === 'undefined') return new Map()
  try {
    const raw = localStorage.getItem(projectFileSizesKey(projectId))
    return raw ? new Map(JSON.parse(raw) as [string, number][]) : new Map()
  } catch { return new Map() }
}

export function saveStoredSizes(projectId: string, sizes: Map<string, number>) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(projectFileSizesKey(projectId), JSON.stringify([...sizes])) } catch {}
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0)          return ''
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Mappers ──────────────────────────────────────────────────────────────────

function docToProjectFile(doc: ApiProject['documents'][number], sizeBytes = 0): ProjectFile {
  return {
    id:         doc.id,
    name:       doc.filename,
    type:       doc.filename.split('.').pop()?.toUpperCase() ?? 'FILE',
    sizeBytes,
    sizeLabel:  formatBytes(sizeBytes),
    uploadedAt: doc.createdAt,
    url:        doc.fileLink ?? '',
  }
}

export function summaryToProject(s: ApiProjectSummary): Project {
  return {
    id:           s.id,
    ownerUserId:  s.ownerUserId,
    name:         s.title,
    description:  s.description,
    instructions: '',
    teamId:       s.teamId,
    visibility:   s.visibility,
    canEdit:      s.canEdit,
    tags:         tagsFromLabels(s.tags),
    files:        [],
    chatCount:    s.chatCount,
    updatedAt:    s.updatedAt,
    createdAt:    s.updatedAt,
  }
}

export function apiToProject(api: ApiProject, existing?: Project, uploadedSizes?: Map<string, number>): Project {
  // Priority: server size_bytes > uploaded/existing localStorage > 0
  const knownSizes = new Map<string, number>([
    ...(existing?.files.map((f): [string, number] => [f.name, f.sizeBytes]) ?? []),
    ...(uploadedSizes ? [...uploadedSizes] : []),
  ])
  // Skip ghost records: backend creates a DB row before type-validation, so a
  // rejected upload leaves a document with an empty file_link. Filter these out
  // so they never appear in the UI (they surface via PATCH/GET responses).
  const files = api.documents.filter(doc => !!doc.fileLink).map(doc => {
    const serverSize = doc.sizeBytes != null && doc.sizeBytes > 0 ? doc.sizeBytes : null
    const sizeBytes  = serverSize ?? knownSizes.get(doc.filename) ?? 0
    // Reuse existing record (preserves any extra local state) but refresh size/url.
    const match = existing?.files.find(f => f.id === doc.id)
    if (match) return { ...match, sizeBytes, sizeLabel: formatBytes(sizeBytes), url: doc.fileLink ?? match.url }
    return docToProjectFile(doc, sizeBytes)
  })
  return {
    id:           api.id,
    ownerUserId:  api.ownerUserId,
    name:         api.title,
    description:  api.description,
    instructions: api.systemInstruction,
    teamId:       api.teamId ?? existing?.teamId ?? null,
    // Same fallback as teamId above — a partial/degraded response shouldn't
    // be able to leave these two disagreeing.
    visibility:   api.visibility ?? existing?.visibility ?? 'personal',
    canEdit:      api.canEdit,
    tags:         tagsFromLabels(api.tags),
    files,
    chatCount:    existing?.chatCount ?? 0,
    updatedAt:    api.updatedAt,
    createdAt:    api.createdAt,
  }
}

export function apiChatToProjectChat(c: ApiProjectChat, projectId: string): ProjectChat {
  return {
    id:        c.id,
    ownerUserId: c.ownerUserId,
    canEdit:   c.canEdit,
    projectId,
    title:     c.chatTitle,
    pinCount:  0,
    createdAt: c.updatedAt,
    updatedAt: c.updatedAt,
  }
}

// ── Merge rules ──────────────────────────────────────────────────────────────

/**
 * Apply a fresh list response. Keeps instructions + files a detail load already
 * fetched (the detail call can resolve before the list), refreshes summary
 * fields, and drops projects no longer in the list (left or deleted).
 */
export function mergeSummaries(prev: Project[], summaries: ApiProjectSummary[]): Project[] {
  const prevMap = new Map(prev.map(p => [p.id, p]))
  return summaries.map(s => {
    const existing = prevMap.get(s.id)
    if (existing && (existing.instructions || existing.files.length > 0)) {
      return {
        ...existing,
        name:        s.title,
        description: s.description,
        ownerUserId: s.ownerUserId,
        teamId:      s.teamId,
        visibility:  s.visibility,
        canEdit:     s.canEdit,
        chatCount:   s.chatCount,
        updatedAt:   s.updatedAt,
      }
    }
    return summaryToProject(s)
  })
}

/** Insert or replace a fully loaded project. */
export function upsertProject(prev: Project[], full: Project): Project[] {
  return prev.some(p => p.id === full.id) ? prev.map(p => p.id === full.id ? full : p) : [full, ...prev]
}

/** Map one project in the list. */
export function mapProject(prev: Project[], id: string, fn: (p: Project) => Project): Project[] {
  return prev.map(p => p.id === id ? fn(p) : p)
}

/** The PATCH body for a view-model patch; empty when nothing goes to the server. */
export function toApiPatch(patch: ProjectPatch): UpdateProjectParams {
  const apiPatch: UpdateProjectParams = {}
  if (patch.name !== undefined)         apiPatch.title = patch.name
  if (patch.description !== undefined)  apiPatch.description = patch.description
  if (patch.instructions !== undefined) apiPatch.systemInstruction = patch.instructions
  if (patch.tags !== undefined)         apiPatch.tags = patch.tags.map(t => t.label)
  if (patch.visibility !== undefined)   apiPatch.visibility = patch.visibility
  return apiPatch
}

/**
 * Apply a project's chat list from the server. Keeps chats added locally that
 * the server does not list yet (just created), replaces the rest for that project.
 */
export function mergeProjectChats(prev: ProjectChat[], projectId: string, fresh: ProjectChat[]): ProjectChat[] {
  const apiIds = new Set(fresh.map(c => c.id))
  const localOnly = prev.filter(c => c.projectId === projectId && !apiIds.has(c.id))
  return [...prev.filter(c => c.projectId !== projectId), ...localOnly, ...fresh]
}
