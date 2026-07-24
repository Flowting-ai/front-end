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

// ── Backend shapes (snake_case from FastAPI, matches OpenAPI components) ──────

export interface ProjectDocumentResponse {
  id:                string
  document_filename: string
  file_link:         string
  created_at:        string
  size_bytes?:       number | null
}

export interface ProjectSummary {
  id:             string
  owner_user_id:  string
  team_id?:       string | null
  visibility:     'private' | 'team'
  can_edit:       boolean
  can_manage_visibility: boolean
  title:          string
  description:    string
  tags:           string[]
  updated_at:     string
  chat_count:     number
  document_count: number
}

export interface ProjectResponse {
  id:                 string
  owner_user_id:      string
  title:              string
  description:        string
  system_instruction: string
  tags:               string[]
  team_id?:           string | null
  visibility:         'private' | 'team'
  can_edit:           boolean
  can_manage_visibility: boolean
  created_at:         string
  updated_at:         string
  documents:          ProjectDocumentResponse[]
}

export interface ProjectChatSummary {
  id:            string
  owner_user_id: string
  can_edit:      boolean
  chat_title:    string
  starred:       boolean
  updated_at:    string
  message_count: number
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

function normalizeDocument(d: ProjectDocumentResponse): ApiProjectDocument {
  return { id: d.id, filename: d.document_filename, fileLink: d.file_link, createdAt: d.created_at, sizeBytes: d.size_bytes ?? null }
}

function normalizeProjectSummary(p: ProjectSummary): ApiProjectSummary {
  return {
    id:            p.id,
    ownerUserId:   p.owner_user_id,
    teamId:        p.team_id ?? null,
    visibility:    p.visibility,
    canEdit:       p.can_edit,
    canManageVisibility: p.can_manage_visibility,
    title:         p.title,
    description:   p.description,
    tags:          p.tags ?? [],
    updatedAt:     p.updated_at,
    chatCount:     p.chat_count,
    documentCount: p.document_count,
  }
}

function normalizeProject(p: ProjectResponse): ApiProject {
  return {
    id:                p.id,
    ownerUserId:       p.owner_user_id,
    title:             p.title,
    description:       p.description,
    systemInstruction: p.system_instruction ?? '',
    tags:              p.tags ?? [],
    teamId:            p.team_id ?? null,
    visibility:        p.visibility,
    canEdit:           p.can_edit,
    canManageVisibility: p.can_manage_visibility,
    createdAt:         p.created_at,
    updatedAt:         p.updated_at,
    documents:         (p.documents ?? []).map(normalizeDocument),
  }
}

function normalizeProjectChat(c: ProjectChatSummary): ApiProjectChat {
  return {
    id:           c.id,
    ownerUserId:  c.owner_user_id,
    canEdit:      c.can_edit,
    chatTitle:    c.chat_title,
    starred:      c.starred,
    updatedAt:    c.updated_at,
    messageCount: c.message_count,
  }
}

// ── API functions ─────────────────────────────────────────────────────────────

/** GET /projects */
export async function fetchProjects(): Promise<ApiProjectSummary[]> {
  const list = await apiFetchJson<ProjectSummary[]>(PROJECTS_ENDPOINT)
  return list.map(normalizeProjectSummary)
}

/** GET /projects/{project_id} */
export async function fetchProject(projectId: string): Promise<ApiProject> {
  const project = await apiFetchJson<ProjectResponse>(PROJECT_DETAIL_ENDPOINT(projectId))
  return normalizeProject(project)
}

export interface CreateProjectParams {
  title:              string
  description?:       string
  systemInstruction?: string
  tags?:              string[]
  files?:             File[]
  teamId?:            string
}

/** POST /projects (multipart/form-data) */
export async function createProjectApi(params: CreateProjectParams): Promise<ApiProject> {
  const form = new FormData()
  form.append('title', params.title)
  if (params.description)       form.append('description', params.description)
  if (params.systemInstruction) form.append('system_instruction', params.systemInstruction)
  if (params.tags)             form.append('tags', JSON.stringify(params.tags))
  if (params.teamId)           form.append('team_id', params.teamId)
  params.files?.forEach(f => form.append('files', f))

  // Direct-to-backend: file uploads can exceed the 4.5 MB serverless proxy cap.
  const project = await apiFetchJson<ProjectResponse>(directUpload(PROJECTS_ENDPOINT), { method: 'POST', body: form })
  return normalizeProject(project)
}

export interface UpdateProjectParams {
  title?:             string
  description?:       string
  systemInstruction?: string
  /** Full replacement tag list — backend expects a JSON-encoded string array. Pass `[]` to clear. */
  tags?:              string[]
}

/** PATCH /projects/{project_id} (application/x-www-form-urlencoded) */
export async function updateProjectApi(projectId: string, params: UpdateProjectParams): Promise<ApiProject> {
  const form = new URLSearchParams()
  if (params.title !== undefined)             form.append('title', params.title)
  if (params.description !== undefined)       form.append('description', params.description)
  if (params.systemInstruction !== undefined) form.append('system_instruction', params.systemInstruction)
  if (params.tags !== undefined)               form.append('tags', JSON.stringify(params.tags))

  const project = await apiFetchJson<ProjectResponse>(PROJECT_DETAIL_ENDPOINT(projectId), {
    method:  'PATCH',
    body:    form,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return normalizeProject(project)
}

/** DELETE /projects/{project_id} */
export async function deleteProjectApi(projectId: string): Promise<void> {
  await apiFetch(PROJECT_DETAIL_ENDPOINT(projectId), { method: 'DELETE' })
}

/** PUT /projects/{project_id}/files (multipart/form-data) — uploads files. */
export async function addProjectFilesApi(projectId: string, files: File[]): Promise<ApiProject> {
  const form = new FormData()
  files.forEach(f => form.append('files', f))
  // Direct-to-backend: file uploads can exceed the 4.5 MB serverless proxy cap.
  const project = await apiFetchJson<ProjectResponse>(directUpload(PROJECT_FILES_ENDPOINT(projectId)), {
    method: 'PUT',
    body:   form,
  })
  return normalizeProject(project)
}

/** DELETE /projects/{project_id}/files/{document_id} */
export async function removeProjectDocumentApi(projectId: string, documentId: string): Promise<ApiProject> {
  const project = await apiFetchJson<ProjectResponse>(PROJECT_FILE_ENDPOINT(projectId, documentId), {
    method: 'DELETE',
  })
  return normalizeProject(project)
}

/** GET /projects/{project_id}/chats */
export async function fetchProjectChats(projectId: string): Promise<ApiProjectChat[]> {
  const list = await apiFetchJson<ProjectChatSummary[]>(PROJECT_CHATS_ENDPOINT(projectId))
  return list.map(normalizeProjectChat)
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

/** PATCH /projects/{project_id}/visibility */
export async function setProjectVisibility(
  projectId: string,
  visibility: 'private' | 'team',
  teamId?: string,
): Promise<void> {
  const body: Record<string, unknown> = { visibility }
  if (visibility === 'team' && teamId) body.teamId = teamId
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
