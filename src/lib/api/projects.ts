"use client"

import { apiFetch, apiFetchJson, ApiError } from './client'
import {
  PROJECTS_ENDPOINT,
  PROJECT_DETAIL_ENDPOINT,
  PROJECT_VISIBILITY_ENDPOINT,
  PROJECT_CHATS_ENDPOINT,
  PROJECT_CHAT_LINK_ENDPOINT,
  PROJECT_FILES_ENDPOINT,
  PROJECT_FILE_ENDPOINT,
  directUpload,
} from '@/lib/config'

// ── Backend shapes ──────────────────────────────────────────────────────────
// The `services/projects` rewrite (back-end-test2 / the live `test` branch at
// devapi.getsouvenir.com) replaced the old snake_case, visibility-toggle shape
// with a class-based `Project` actor whose Pydantic response models serialize
// by field NAME (camelCase), not the snake_case `validation_alias` they parse
// from the DB row. There is no `visibility`/`can_edit`/`can_manage_visibility`
// on the wire anymore — sharing is now real `ProjectMember` rows (GET/DELETE
// `/projects/{id}/members`, `POST /projects/{id}/invite(s)`), not an org-wide
// toggle. Those endpoints aren't wired up on the frontend yet — see
// `canEdit`'s derivation in the normalizers below for how we make do without
// a server-supplied signal in the meantime.

export interface ProjectDocumentResponse {
  id:        string
  filename:  string
  fileLink:  string
  createdAt: string
}

export interface ProjectSummary {
  id:             string
  ownerUserId:    string
  organizationId?: string | null
  title:          string
  description:    string
  tags:           string[]
  createdAt:      string
  updatedAt:      string
  chatCount:      number
  documentCount:  number
}

export interface ProjectResponse {
  id:                 string
  ownerUserId:        string
  organizationId?:    string | null
  title:              string
  description:        string
  systemInstruction:  string
  tags:               string[]
  createdAt:          string
  updatedAt:          string
  documents:          ProjectDocumentResponse[]
}

export interface ProjectChatSummary {
  id:            string
  ownerUserId:   string
  chatTitle:     string
  starred:       boolean
  createdAt:     string
  updatedAt:     string
  messageCount:  number
}

// ── Normalized types (camelCase, used by frontend code) ───────────────────────

export interface ApiProjectDocument {
  id:        string
  filename:  string
  fileLink:  string
  createdAt: string
  sizeBytes: number | null
}

export interface ApiProjectSummary {
  id:            string
  ownerUserId:   string
  teamId:        string | null
  visibility:    'private' | 'team'
  canEdit:       boolean
  canManageVisibility: boolean
  title:         string
  description:   string
  tags:          string[]
  updatedAt:     string
  chatCount:     number
  documentCount: number
}

export interface ApiProject {
  id:                string
  ownerUserId:       string
  title:             string
  description:       string
  systemInstruction: string
  tags:              string[]
  teamId:            string | null
  visibility:        'private' | 'team'
  canEdit:           boolean
  canManageVisibility: boolean
  createdAt:         string
  updatedAt:         string
  documents:         ApiProjectDocument[]
}

export interface ApiProjectChat {
  id:           string
  ownerUserId:  string
  canEdit:      boolean
  chatTitle:    string
  starred:      boolean
  updatedAt:    string
  messageCount: number
}

// ── Normalizers ───────────────────────────────────────────────────────────────
// `canEdit` has no server-supplied signal any more (see the backend-shape note
// above), so every normalizer takes the caller's own id and derives it as
// straight ownership — the one part of the old `can_edit` contract ("can this
// user change this resource") that's still knowable without calling the new
// `/members` endpoint. `visibility`/`canManageVisibility` have no honest
// equivalent left (the backend now sets `organizationId` on every project an
// org member creates, shared or not, so it can't be used as a "this is shared"
// signal without over-claiming) — they're fixed at 'private'/false so the
// now-dead visibility-toggle UI stays hidden instead of lying about state.

function normalizeDocument(d: ProjectDocumentResponse): ApiProjectDocument {
  return { id: d.id, filename: d.filename, fileLink: d.fileLink, createdAt: d.createdAt, sizeBytes: null }
}

function normalizeProjectSummary(p: ProjectSummary, currentUserId: string): ApiProjectSummary {
  return {
    id:            p.id,
    ownerUserId:   p.ownerUserId,
    teamId:        p.organizationId ?? null,
    visibility:    'private',
    canEdit:       p.ownerUserId === currentUserId,
    canManageVisibility: false,
    title:         p.title,
    description:   p.description,
    tags:          p.tags ?? [],
    updatedAt:     p.updatedAt,
    chatCount:     p.chatCount,
    documentCount: p.documentCount,
  }
}

function normalizeProject(p: ProjectResponse, currentUserId: string): ApiProject {
  return {
    id:                p.id,
    ownerUserId:       p.ownerUserId,
    title:             p.title,
    description:       p.description,
    systemInstruction: p.systemInstruction ?? '',
    tags:              p.tags ?? [],
    teamId:            p.organizationId ?? null,
    visibility:        'private',
    canEdit:           p.ownerUserId === currentUserId,
    canManageVisibility: false,
    createdAt:         p.createdAt,
    updatedAt:         p.updatedAt,
    documents:         (p.documents ?? []).map(normalizeDocument),
  }
}

function normalizeProjectChat(c: ProjectChatSummary, currentUserId: string): ApiProjectChat {
  return {
    id:           c.id,
    ownerUserId:  c.ownerUserId,
    canEdit:      c.ownerUserId === currentUserId,
    chatTitle:    c.chatTitle,
    starred:      c.starred,
    updatedAt:    c.updatedAt,
    messageCount: c.messageCount,
  }
}

// ── API functions ─────────────────────────────────────────────────────────────

/** GET /projects */
export async function fetchProjects(currentUserId: string): Promise<ApiProjectSummary[]> {
  const list = await apiFetchJson<ProjectSummary[]>(PROJECTS_ENDPOINT)
  return list.map(p => normalizeProjectSummary(p, currentUserId))
}

/** GET /projects/{project_id} */
export async function fetchProject(projectId: string, currentUserId: string): Promise<ApiProject> {
  const project = await apiFetchJson<ProjectResponse>(PROJECT_DETAIL_ENDPOINT(projectId))
  return normalizeProject(project, currentUserId)
}

export interface CreateProjectParams {
  title:              string
  description?:       string
  systemInstruction?: string
  tags?:              string[]
  files?:             File[]
  teamId?:            string
}

/**
 * POST /projects (multipart/form-data). `teamId` is no longer sent — the
 * backend derives `organizationId` itself from the caller's own org
 * membership (`Project.create()`), it doesn't accept one from the client.
 */
export async function createProjectApi(params: CreateProjectParams, currentUserId: string): Promise<ApiProject> {
  const form = new FormData()
  form.append('title', params.title)
  if (params.description)       form.append('description', params.description)
  if (params.systemInstruction) form.append('systemInstruction', params.systemInstruction)
  if (params.tags)             form.append('tags', JSON.stringify(params.tags))
  params.files?.forEach(f => form.append('files', f))

  // Direct-to-backend: file uploads can exceed the 4.5 MB serverless proxy cap.
  const project = await apiFetchJson<ProjectResponse>(directUpload(PROJECTS_ENDPOINT), { method: 'POST', body: form })
  return normalizeProject(project, currentUserId)
}

export interface UpdateProjectParams {
  title?:             string
  description?:       string
  systemInstruction?: string
  /** Full replacement tag list. */
  tags?:              string[]
}

/** PATCH /projects/{project_id} — JSON body (`UpdateProjectFields`), not form-encoded. */
export async function updateProjectApi(projectId: string, params: UpdateProjectParams, currentUserId: string): Promise<ApiProject> {
  const body: Record<string, unknown> = {}
  if (params.title !== undefined)             body.title = params.title
  if (params.description !== undefined)       body.description = params.description
  if (params.systemInstruction !== undefined) body.systemInstruction = params.systemInstruction
  if (params.tags !== undefined)               body.tags = params.tags

  const project = await apiFetchJson<ProjectResponse>(PROJECT_DETAIL_ENDPOINT(projectId), {
    method: 'PATCH',
    body:   JSON.stringify(body),
  })
  return normalizeProject(project, currentUserId)
}

/** DELETE /projects/{project_id} */
export async function deleteProjectApi(projectId: string): Promise<void> {
  await apiFetch(PROJECT_DETAIL_ENDPOINT(projectId), { method: 'DELETE' })
}

/** PUT /projects/{project_id}/files (multipart/form-data) — uploads files. */
export async function addProjectFilesApi(projectId: string, files: File[], currentUserId: string): Promise<ApiProject> {
  const form = new FormData()
  files.forEach(f => form.append('files', f))
  // Direct-to-backend: file uploads can exceed the 4.5 MB serverless proxy cap.
  const project = await apiFetchJson<ProjectResponse>(directUpload(PROJECT_FILES_ENDPOINT(projectId)), {
    method: 'PUT',
    body:   form,
  })
  return normalizeProject(project, currentUserId)
}

/** DELETE /projects/{project_id}/files/{document_id} */
export async function removeProjectDocumentApi(projectId: string, documentId: string, currentUserId: string): Promise<ApiProject> {
  const project = await apiFetchJson<ProjectResponse>(PROJECT_FILE_ENDPOINT(projectId, documentId), {
    method: 'DELETE',
  })
  return normalizeProject(project, currentUserId)
}

/** GET /projects/{project_id}/chats */
export async function fetchProjectChats(projectId: string, currentUserId: string): Promise<ApiProjectChat[]> {
  const list = await apiFetchJson<ProjectChatSummary[]>(PROJECT_CHATS_ENDPOINT(projectId))
  return list.map(c => normalizeProjectChat(c, currentUserId))
}

/** POST /projects/{project_id}/chats/{chat_id} */
export async function addChatToProject(projectId: string, chatId: string): Promise<void> {
  const res = await apiFetch(PROJECT_CHAT_LINK_ENDPOINT(projectId, chatId), { method: 'POST' })
  if (!res.ok) {
    throw new ApiError(res.status, 'add_chat_failed', `Failed to link chat to project (${res.status})`)
  }
}

/** DELETE /projects/{project_id}/chats/{chat_id} */
export async function removeChatFromProject(projectId: string, chatId: string): Promise<void> {
  await apiFetch(PROJECT_CHAT_LINK_ENDPOINT(projectId, chatId), { method: 'DELETE' })
}

/**
 * PATCH /projects/{project_id}/visibility — this route no longer exists on
 * the backend (dropped along with the visibility column; see the backend-shape
 * note up top). Nothing calls this any more: `canManageVisibility` is now
 * fixed at `false` in the normalizers above, so the UI button that used to
 * trigger this is never rendered. Kept only as a reference for whatever
 * replaces it once project sharing is rebuilt on top of the new
 * `/projects/{id}/members` + `/invite(s)` endpoints — delete it once that
 * lands, or sooner if nothing ends up needing the old wire format.
 */
export async function setProjectVisibility(
  projectId: string,
  visibility: 'private' | 'team',
  teamId?: string,
): Promise<void> {
  // Wire format is SetVisibilityRequest{visibility: "private"|"shared", organizationId?}
  // — there's only ever one organization now, so `teamId` here is really just
  // the caller's org id, not a choice among several teams. (This "org" vs.
  // "shared" value was wrong here for a long time and got copy-pasted into
  // the still-live personas/chat visibility setters — fixed there too.)
  const body: Record<string, unknown> = { visibility: visibility === 'team' ? 'shared' : 'private' }
  if (visibility === 'team' && teamId) body.organizationId = teamId
  const res = await apiFetch(PROJECT_VISIBILITY_ENDPOINT(projectId), {
    method: 'PATCH',
    body:   JSON.stringify(body),
  })
  // The endpoint returns 204 No Content on success, so this can't use
  // apiFetchJson (its success path unconditionally calls response.json(),
  // which throws on an empty body) — check res.ok manually instead. Without
  // this, a rejected change (e.g. the 403 a non-owner gets from
  // set_resource_visibility) resolved silently and the caller reported
  // success even though the project's visibility never changed.
  if (!res.ok) {
    let message = `Failed to update visibility (${res.status})`
    try {
      const data = await res.clone().json() as { detail?: string }
      if (typeof data.detail === 'string') message = data.detail
    } catch {
      // non-JSON error body - keep the default message
    }
    throw new ApiError(res.status, 'set_visibility_failed', message)
  }
}
