"use client"

import { apiFetch, apiFetchJson } from './client'
import {
  PROJECTS_ENDPOINT,
  PROJECT_DETAIL_ENDPOINT,
  PROJECT_CHATS_ENDPOINT,
  PROJECT_CHAT_LINK_ENDPOINT,
} from '@/lib/config'

// ── Backend shapes (snake_case from FastAPI) ──────────────────────────────────

interface BackendDocument {
  id:                string
  document_filename: string
  document_s3_key:   string
  created_at:        string
}

interface BackendProjectSummary {
  id:             string
  title:          string
  description:    string
  updated_at:     string
  chat_count:     number
  document_count: number
}

interface BackendProjectResponse {
  id:                 string
  title:              string
  description:        string
  system_instruction: string
  created_at:         string
  updated_at:         string
  documents:          BackendDocument[]
}

interface BackendProjectChatSummary {
  id:            string
  chat_title:    string
  starred:       boolean
  updated_at:    string
  message_count: number
}

// ── Normalized types (camelCase for the frontend) ─────────────────────────────

export interface ApiProjectDocument {
  id:        string
  filename:  string
  s3Key:     string
  createdAt: string
}

export interface ApiProjectSummary {
  id:            string
  title:         string
  description:   string
  updatedAt:     string
  chatCount:     number
  documentCount: number
}

export interface ApiProject {
  id:                string
  title:             string
  description:       string
  systemInstruction: string
  createdAt:         string
  updatedAt:         string
  documents:         ApiProjectDocument[]
}

export interface ApiProjectChat {
  id:           string
  chatTitle:    string
  starred:      boolean
  updatedAt:    string
  messageCount: number
}

// ── Normalizers ───────────────────────────────────────────────────────────────

function normalizeDocument(d: BackendDocument): ApiProjectDocument {
  return { id: d.id, filename: d.document_filename, s3Key: d.document_s3_key, createdAt: d.created_at }
}

function normalizeProjectSummary(p: BackendProjectSummary): ApiProjectSummary {
  return {
    id:            p.id,
    title:         p.title,
    description:   p.description,
    updatedAt:     p.updated_at,
    chatCount:     p.chat_count,
    documentCount: p.document_count,
  }
}

function normalizeProject(p: BackendProjectResponse): ApiProject {
  return {
    id:                p.id,
    title:             p.title,
    description:       p.description,
    systemInstruction: p.system_instruction,
    createdAt:         p.created_at,
    updatedAt:         p.updated_at,
    documents:         p.documents.map(normalizeDocument),
  }
}

function normalizeProjectChat(c: BackendProjectChatSummary): ApiProjectChat {
  return {
    id:           c.id,
    chatTitle:    c.chat_title,
    starred:      c.starred,
    updatedAt:    c.updated_at,
    messageCount: c.message_count,
  }
}

// ── API functions ─────────────────────────────────────────────────────────────

export async function fetchProjects(): Promise<ApiProjectSummary[]> {
  const list = await apiFetchJson<BackendProjectSummary[]>(PROJECTS_ENDPOINT)
  return list.map(normalizeProjectSummary)
}

export async function fetchProject(projectId: string): Promise<ApiProject> {
  const project = await apiFetchJson<BackendProjectResponse>(PROJECT_DETAIL_ENDPOINT(projectId))
  return normalizeProject(project)
}

export interface CreateProjectParams {
  title:             string
  description?:      string
  systemInstruction?: string
  files?:            File[]
}

export async function createProjectApi(params: CreateProjectParams): Promise<ApiProject> {
  const form = new FormData()
  form.append('title', params.title)
  if (params.description)       form.append('description', params.description)
  if (params.systemInstruction) form.append('system_instruction', params.systemInstruction)
  params.files?.forEach(f => form.append('files', f))

  const project = await apiFetchJson<BackendProjectResponse>(PROJECTS_ENDPOINT, { method: 'POST', body: form })
  return normalizeProject(project)
}

export interface UpdateProjectParams {
  title?:             string
  description?:       string
  systemInstruction?: string
  removeDocumentIds?: string[]
  files?:             File[]
}

export async function updateProjectApi(projectId: string, params: UpdateProjectParams): Promise<ApiProject> {
  const form = new FormData()
  if (params.title !== undefined)             form.append('title', params.title)
  if (params.description !== undefined)       form.append('description', params.description)
  if (params.systemInstruction !== undefined) form.append('system_instruction', params.systemInstruction)
  if (params.removeDocumentIds?.length)       form.append('remove_document_ids', params.removeDocumentIds.join(','))
  params.files?.forEach(f => form.append('files', f))

  const project = await apiFetchJson<BackendProjectResponse>(PROJECT_DETAIL_ENDPOINT(projectId), { method: 'PATCH', body: form })
  return normalizeProject(project)
}

export async function deleteProjectApi(projectId: string): Promise<void> {
  await apiFetch(PROJECT_DETAIL_ENDPOINT(projectId), { method: 'DELETE' })
}

export async function fetchProjectChats(projectId: string): Promise<ApiProjectChat[]> {
  const list = await apiFetchJson<BackendProjectChatSummary[]>(PROJECT_CHATS_ENDPOINT(projectId))
  return list.map(normalizeProjectChat)
}

export async function addChatToProject(projectId: string, chatId: string): Promise<void> {
  await apiFetch(PROJECT_CHAT_LINK_ENDPOINT(projectId, chatId), { method: 'POST' })
}

export async function removeChatFromProject(projectId: string, chatId: string): Promise<void> {
  await apiFetch(PROJECT_CHAT_LINK_ENDPOINT(projectId, chatId), { method: 'DELETE' })
}
