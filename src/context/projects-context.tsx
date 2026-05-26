'use client'

import React, { createContext, useCallback, use, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { BadgeColor } from '@/components/Badge'
import type { PinProps, PinLabel } from '@/components/Pin'
import {
  fetchProjects,
  fetchProject,
  fetchProjectChats,
  createProjectApi,
  updateProjectApi,
  deleteProjectApi,
  addChatToProject,
  removeProjectDocumentApi,
  addProjectFilesApi,
} from '@/lib/api/projects'
import type { ApiProject, ApiProjectSummary, ApiProjectChat } from '@/lib/api/projects'

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface ProjectTag {
  id:    string
  label: string
  color: BadgeColor
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
  name:         string
  description:  string
  instructions: string
  tags:         ProjectTag[]
  files:        ProjectFile[]
  chatCount:    number
  updatedAt:    string
  createdAt:    string
}

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function storageSizesKey(projectId: string) { return `project-file-sizes:${projectId}` }

function loadStoredSizes(projectId: string): Map<string, number> {
  if (typeof window === 'undefined') return new Map()
  try {
    const raw = localStorage.getItem(storageSizesKey(projectId))
    return raw ? new Map(JSON.parse(raw) as [string, number][]) : new Map()
  } catch { return new Map() }
}

function saveStoredSizes(projectId: string, sizes: Map<string, number>) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(storageSizesKey(projectId), JSON.stringify([...sizes])) } catch {}
}

function formatBytes(bytes: number): string {
  if (bytes <= 0)          return ''
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function docToProjectFile(
  doc: ApiProject['documents'][number],
  sizeBytes = 0,
): ProjectFile {
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

function summaryToProject(s: ApiProjectSummary): Project {
  return {
    id:           s.id,
    name:         s.title,
    description:  s.description,
    instructions: '',
    tags:         [],
    files:        [],
    chatCount:    s.chatCount,
    updatedAt:    s.updatedAt,
    createdAt:    s.updatedAt,
  }
}

function apiToProject(
  api: ApiProject,
  existing?: Project,
  uploadedSizes?: Map<string, number>,
): Project {
  const knownSizes = new Map<string, number>([
    ...(existing?.files.map((f): [string, number] => [f.name, f.sizeBytes]) ?? []),
    ...(uploadedSizes ? [...uploadedSizes] : []),
  ])
  const files = api.documents.map(doc => {
    const sizeBytes = knownSizes.get(doc.filename) ?? 0
    // Reuse existing record (preserves any extra local state) but refresh size/url.
    const match = existing?.files.find(f => f.id === doc.id)
    if (match) return { ...match, sizeBytes, sizeLabel: formatBytes(sizeBytes), url: doc.fileLink ?? match.url }
    return docToProjectFile(doc, sizeBytes)
  })
  return {
    id:           api.id,
    name:         api.title,
    description:  api.description,
    instructions: api.systemInstruction,
    tags:         existing?.tags ?? [],
    files,
    chatCount:    existing?.chatCount ?? 0,
    updatedAt:    api.updatedAt,
    createdAt:    api.createdAt,
  }
}

function apiChatToProjectChat(c: ApiProjectChat, projectId: string): ProjectChat {
  return {
    id:        c.id,
    projectId,
    title:     c.chatTitle,
    pinCount:  0,
    createdAt: c.updatedAt,
    updatedAt: c.updatedAt,
  }
}

// â”€â”€ Context â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface ProjectsContextValue {
  projects:         Project[]
  chats:            ProjectChat[]
  loading:          boolean
  error:            string | null
  createProject:    (name: string, description: string) => Promise<Project>
  updateProject:    (id: string, patch: Partial<Pick<Project, 'name' | 'description' | 'instructions' | 'tags'>>) => Promise<void>
  deleteProject:    (id: string) => Promise<void>
  loadProject:      (id: string) => Promise<void>
  uploadFiles:      (projectId: string, files: File[]) => Promise<void>
  removeFile:       (projectId: string, fileId: string) => Promise<void>
  addChat:          (projectId: string, chatId: string, title: string) => void
  removeChat:       (projectId: string, chatId: string) => void
  renameChat:       (projectId: string, chatId: string, title: string) => void
  loadProjectChats: (projectId: string) => Promise<void>
  getProject:       (id: string) => Project | undefined
  getChats:         (projectId: string) => ProjectChat[]
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null)

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const [projects,        setProjects]        = useState<Project[]>([])
  const [chats,           setChats]           = useState<ProjectChat[]>([])
  const [loading,         setLoading]         = useState(true)
  const [error,           setError]           = useState<string | null>(null)

  // â”€â”€ Bootstrap â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // eslint-disable-next-line react-doctor/no-cascading-set-state -- React 18+ batches these; useReducer refactor tracked separately
  useEffect(() => {
    fetchProjects()
      .then(summaries => setProjects(summaries.map(summaryToProject)))
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load projects'))
      .finally(() => setLoading(false))
  }, [])

  // â”€â”€ CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const createProject = useCallback(async (name: string, description: string): Promise<Project> => {
    const api = await createProjectApi({ title: name, description })
    const project = apiToProject(api)
    setProjects(prev => [project, ...prev])
    return project
  }, [])

  const updateProject = useCallback(async (
    id: string,
    patch: Partial<Pick<Project, 'name' | 'description' | 'instructions' | 'tags'>>,
  ) => {
    const snapshot = projects.find(p => p.id === id)

    // optimistic
    setProjects(prev => prev.map(p =>
      p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p,
    ))

    const apiPatch: Parameters<typeof updateProjectApi>[1] = {}
    if (patch.name !== undefined)         apiPatch.title = patch.name
    if (patch.description !== undefined)  apiPatch.description = patch.description
    if (patch.instructions !== undefined) apiPatch.systemInstruction = patch.instructions

    if (Object.keys(apiPatch).length > 0) {
      try {
        const updated = await updateProjectApi(id, apiPatch)
        setProjects(prev => prev.map(p => p.id === id ? apiToProject(updated, p, undefined) : p))
      } catch (err) {
        if (snapshot) setProjects(prev => prev.map(p => p.id === id ? snapshot : p))
        toast.error('Failed to update project', { description: err instanceof Error ? err.message : undefined })
        throw err
      }
    }
  }, [projects])

  const deleteProject = useCallback(async (id: string) => {
    const snapshot = projects.find(p => p.id === id)

    // optimistic
    setProjects(prev => prev.filter(p => p.id !== id))
    setChats(prev => prev.filter(c => c.projectId !== id))

    try {
      await deleteProjectApi(id)
    } catch (err) {
      if (snapshot) setProjects(prev => [snapshot, ...prev])
      toast.error('Failed to delete project', { description: err instanceof Error ? err.message : undefined })
      throw err
    }
  }, [projects])

  const loadProject = useCallback(async (id: string) => {
    try {
      const api = await fetchProject(id)
      const storedSizes = loadStoredSizes(id)
      setProjects(prev => {
        const existing = prev.find(p => p.id === id)
        const full = apiToProject(api, existing, storedSizes)
        return existing ? prev.map(p => p.id === id ? full : p) : [full, ...prev]
      })
    } catch (err) {
      toast.error('Failed to load project', { description: err instanceof Error ? err.message : undefined })
    }
  }, [])

  // â”€â”€ File management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const uploadFiles = useCallback(async (projectId: string, files: File[]) => {
    if (!files.length) return
    const uploadedSizes = new Map<string, number>(files.map(f => [f.name, f.size]))
    try {
      const updated = await addProjectFilesApi(projectId, files)
      const merged = new Map([...loadStoredSizes(projectId), ...uploadedSizes])
      saveStoredSizes(projectId, merged)
      setProjects(prev => prev.map(p =>
        p.id === projectId ? apiToProject(updated, p, merged) : p,
      ))
    } catch (err) {
      toast.error('Failed to upload files', { description: err instanceof Error ? err.message : undefined })
      throw err
    }
  }, [])

  const removeFile = useCallback(async (projectId: string, fileId: string) => {
    const snapshot = projects.find(p => p.id === projectId)
    const removedName = snapshot?.files.find(f => f.id === fileId)?.name

    // optimistic
    setProjects(prev => prev.map(p =>
      p.id === projectId ? { ...p, files: p.files.filter(f => f.id !== fileId) } : p,
    ))

    try {
      // DELETE /projects/{project_id}/files/{document_id} returns the updated ProjectResponse directly.
      const updated = await removeProjectDocumentApi(projectId, fileId)
      if (removedName) {
        const stored = loadStoredSizes(projectId)
        stored.delete(removedName)
        saveStoredSizes(projectId, stored)
      }
      const storedSizes = loadStoredSizes(projectId)
      setProjects(prev => prev.map(p => p.id === projectId ? apiToProject(updated, p, storedSizes) : p))
    } catch (err) {
      if (snapshot) setProjects(prev => prev.map(p => p.id === projectId ? snapshot : p))
      toast.error('Failed to remove file', { description: err instanceof Error ? err.message : undefined })
    }
  }, [projects])

  // â”€â”€ Chat management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // Optimistic: called after a chat has been created via the chats API and linked to this project.
  const addChat = useCallback((projectId: string, chatId: string, title: string) => {
    const now  = new Date().toISOString()
    const chat: ProjectChat = { id: chatId, projectId, title, pinCount: 0, createdAt: now, updatedAt: now }
    setChats(prev => [chat, ...prev.filter(c => !(c.projectId === projectId && c.id === chatId))])
    setProjects(prev => prev.map(p =>
      p.id === projectId ? { ...p, chatCount: p.chatCount + 1, updatedAt: now } : p,
    ))
    addChatToProject(projectId, chatId).catch(() => {
      // silent - the chat was created, linking failure is non-fatal
    })
  }, [])

  const removeChat = useCallback((projectId: string, chatId: string) => {
    setChats(prev => prev.filter(c => !(c.projectId === projectId && c.id === chatId)))
    setProjects(prev => prev.map(p =>
      p.id === projectId ? { ...p, chatCount: Math.max(0, p.chatCount - 1) } : p,
    ))
  }, [])

  const renameChat = useCallback((projectId: string, chatId: string, title: string) => {
    setChats(prev => prev.map(c =>
      c.projectId === projectId && c.id === chatId ? { ...c, title } : c,
    ))
  }, [])

  const loadProjectChats = useCallback(async (projectId: string) => {
    try {
      const apiChats = await fetchProjectChats(projectId)
      const mapped   = apiChats.map(c => apiChatToProjectChat(c, projectId))
      setChats(prev => [
        ...prev.filter(c => c.projectId !== projectId),
        ...mapped,
      ])
    } catch (err) {
      toast.error('Failed to load project chats', { description: err instanceof Error ? err.message : undefined })
    }
  }, [])

  // â”€â”€ Lookups â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const getProject = useCallback((id: string) => projects.find(p => p.id === id), [projects])

  const getChats = useCallback((projectId: string) => chats.filter(c => c.projectId === projectId), [chats])

  const value = useMemo<ProjectsContextValue>(() => ({
    projects,
    chats,
    loading,
    error,
    createProject,
    updateProject,
    deleteProject,
    loadProject,
    uploadFiles,
    removeFile,
    addChat,
    removeChat,
    renameChat,
    loadProjectChats,
    getProject,
    getChats,
  }), [
    projects, chats, loading, error,
    createProject, updateProject, deleteProject, loadProject,
    uploadFiles, removeFile, addChat, removeChat, renameChat,
    loadProjectChats, getProject, getChats,
  ])

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>
}

export function useProjects(): ProjectsContextValue {
  const ctx = use(ProjectsContext)
  if (!ctx) throw new Error('useProjects must be used inside <ProjectsProvider>')
  return ctx
}
