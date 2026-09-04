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
  PROJECT_INVITE_ENDPOINT,
  PROJECT_INVITES_ENDPOINT,
  PROJECT_MEMBERS_ENDPOINT,
  PROJECT_MEMBER_ENDPOINT,
  PROJECT_LEAVE_ENDPOINT,
  PROJECT_RESTORE_ENDPOINT,
  directUpload,
} from '@/lib/config'

// ── Backend shapes ──────────────────────────────────────────────────────────
// The `services/projects` rewrite replaced the old snake_case, visibility-
// toggle shape with a class-based `Project` actor whose Pydantic response
// models serialize by field NAME (camelCase), not the snake_case
// `validation_alias` they parse from the DB row. `can_edit`/`can_manage_visibility`
// are gone for good — sharing is real `ProjectMember` rows (GET/DELETE
// `/projects/{id}/members`, `POST /projects/{id}/invite(s)`), not an org-wide
// toggle; see `canEdit`'s derivation in the normalizers below for how we make
// do without a server-supplied signal there.
//
// UPDATE: `visibility` itself is back (commit 342b899d, "Enhance project
// management features with access control and recovery options") — but as a
// set-ONCE-at-creation field (`personal | workspace | shared`, sent as a
// `visibility` form field to `POST /projects`), not the old PATCH-toggle.
// `PATCH /projects/{id}/visibility` (below) genuinely still doesn't exist —
// don't resurrect it.

export interface ProjectDocumentResponse {
  id:        string
  filename:  string
  fileLink:  string
  createdAt: string
}

export type ProjectVisibility = 'personal' | 'workspace' | 'shared'

export interface ProjectSummary {
  id:             string
  ownerUserId:    string
  organizationId?: string | null
  visibility:     ProjectVisibility
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
  visibility:         ProjectVisibility
  title:              string
  description:        string
  systemInstruction:  string
  tags:               string[]
  createdAt:          string
  updatedAt:          string
  documents:          ProjectDocumentResponse[]
}

/** GET /projects/{id}/members — unlike every other response in this file,
 *  this schema has no camelCase alias declared on the backend, so it's the
 *  one place in this API that's genuinely snake_case on the wire. */
export interface ProjectMemberResponse {
  user_id: string
  name:    string | null
  email:   string | null
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
  visibility:    ProjectVisibility
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
  visibility:        ProjectVisibility
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

export interface ApiProjectMember {
  userId: string
  name:   string | null
  email:  string | null
}

// ── Normalizers ───────────────────────────────────────────────────────────────
// `canEdit` has no server-supplied signal any more (see the backend-shape note
// above), so every normalizer takes the caller's own id and derives it as
// straight ownership — the one part of the old `can_edit` contract ("can this
// user change this resource") that's still knowable without calling the new
// `/members` endpoint. `visibility` now reads the real wire value (set once at
// creation, see the UPDATE note above). `canManageVisibility` stays fixed at
// `false` — visibility genuinely can't be changed post-creation (no PATCH
// endpoint exists), so there's still nothing to manage.

function normalizeDocument(d: ProjectDocumentResponse): ApiProjectDocument {
  return { id: d.id, filename: d.filename, fileLink: d.fileLink, createdAt: d.createdAt, sizeBytes: null }
}

function normalizeProjectSummary(p: ProjectSummary, currentUserId: string): ApiProjectSummary {
  return {
    id:            p.id,
    ownerUserId:   p.ownerUserId,
    teamId:        p.organizationId ?? null,
    // No `existing` value to fall back to here (unlike apiToProject in
    // projects-context.tsx) — this is a hard default, not a last-known-value
    // guard. Still needed: the /projects list filters by exact visibility
    // match, so a missing/degraded value would otherwise vanish this project
    // from every scope tab silently instead of just mis-labeling it.
    visibility:    p.visibility ?? 'personal',
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
    visibility:        p.visibility ?? 'personal',
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

function normalizeProjectMember(m: ProjectMemberResponse): ApiProjectMember {
  return { userId: m.user_id, name: m.name, email: m.email }
}

// ── API functions ─────────────────────────────────────────────────────────────

/** GET /projects */
export async function fetchProjects(currentUserId: string): Promise<ApiProjectSummary[]> {
  const list = await apiFetchJson<ProjectSummary[]>(PROJECTS_ENDPOINT)
  return list.map(p => normalizeProjectSummary(p, currentUserId))
}

/** GET /projects?deleted=recoverable — the trash view. Only workspace/shared
 *  projects can ever appear here: personal projects hard-delete instantly
 *  server-side (`DELETE /projects/{id}`) and are never recoverable. */
export async function fetchDeletedProjects(currentUserId: string): Promise<ApiProjectSummary[]> {
  const list = await apiFetchJson<ProjectSummary[]>(`${PROJECTS_ENDPOINT}?deleted=recoverable`)
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
  /** 'personal' | 'workspace' | 'shared' — server defaults to 'personal' when
   *  omitted. 'workspace'/'shared' 400 server-side if the caller has no org. */
  visibility?:        ProjectVisibility
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
  if (params.visibility)       form.append('visibility', params.visibility)
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

export interface LeaveProjectParams {
  /** Required when the caller is the owner and other collaborators remain. */
  successorUserId?: string
  /** Required when the caller is the owner and no other collaborators remain. */
  aloneAction?: 'archive' | 'convertPersonal'
}

/**
 * POST /projects/{project_id}/leave — `200 { ok: true }`. Branches entirely
 * server-side on the caller's role (project.py's `Project.leave()`): a plain
 * collaborator just leaves (body ignored), an owner with other collaborators
 * must supply `successorUserId`, an owner with nobody else on the project
 * must supply `aloneAction`. Errors surface via apiFetchJson's own `detail`
 * extraction (e.g. "Must name a successor", "Must archive or convert to
 * personal") — real backend messages, not generic ones.
 */
export async function leaveProjectApi(projectId: string, params: LeaveProjectParams = {}): Promise<void> {
  await apiFetchJson<{ ok: boolean }>(PROJECT_LEAVE_ENDPOINT(projectId), {
    method: 'POST',
    body:   JSON.stringify(params),
  })
}

/** POST /projects/{project_id}/restore — only workspace/shared projects,
 *  only within the 30-day recovery window (see fetchDeletedProjects). */
export async function restoreProjectApi(projectId: string, currentUserId: string): Promise<ApiProject> {
  const project = await apiFetchJson<ProjectResponse>(PROJECT_RESTORE_ENDPOINT(projectId), { method: 'POST' })
  return normalizeProject(project, currentUserId)
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

/** GET /projects/{project_id}/members */
export async function fetchProjectMembers(projectId: string): Promise<ApiProjectMember[]> {
  const list = await apiFetchJson<ProjectMemberResponse[]>(PROJECT_MEMBERS_ENDPOINT(projectId))
  return list.map(normalizeProjectMember)
}

/** POST /projects/{project_id}/invite */
export async function inviteProjectMember(projectId: string, auth0Id: string): Promise<void> {
  const res = await apiFetch(PROJECT_INVITE_ENDPOINT(projectId), {
    method: 'POST',
    body:   JSON.stringify({ auth0Id }),
  })
  if (!res.ok) {
    throw new ApiError(res.status, 'invite_failed', `Failed to invite member (${res.status})`)
  }
}

/** POST /projects/{project_id}/invites */
export async function inviteProjectMembers(projectId: string, auth0Ids: string[]): Promise<void> {
  const res = await apiFetch(PROJECT_INVITES_ENDPOINT(projectId), {
    method: 'POST',
    body:   JSON.stringify({ auth0Ids }),
  })
  if (!res.ok) {
    throw new ApiError(res.status, 'invite_failed', `Failed to invite members (${res.status})`)
  }
}

/** DELETE /projects/{project_id}/members/{auth0_id} */
export async function removeProjectMemberFromProject(projectId: string, auth0Id: string): Promise<void> {
  await apiFetch(PROJECT_MEMBER_ENDPOINT(projectId, auth0Id), { method: 'DELETE' })
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
