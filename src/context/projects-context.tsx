'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { BadgeColor } from '@/components/Badge'
import type { PinProps, PinLabel } from '@/components/Pin'
import {
  fetchProjects,
  fetchProjectChats,
  createProjectApi,
  updateProjectApi,
  deleteProjectApi,
  addChatToProject,
} from '@/lib/api/projects'
import type { ApiProject, ApiProjectSummary, ApiProjectChat } from '@/lib/api/projects'

// ── Types ──────────────────────────────────────────────────────────────────────

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

// ── Helpers ────────────────────────────────────────────────────────────────────

function docToProjectFile(doc: ApiProject['documents'][number]): ProjectFile {
  return {
    id:         doc.id,
    name:       doc.filename,
    type:       doc.filename.split('.').pop()?.toUpperCase() ?? 'FILE',
    sizeBytes:  0,
    sizeLabel:  '',
    uploadedAt: doc.createdAt,
    url:        '',
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

function apiToProject(api: ApiProject, existing?: Project): Project {
  const files = api.documents.map(doc => {
    const match = existing?.files.find(f => f.id === doc.id)
    return match ?? docToProjectFile(doc)
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

// ── Context ────────────────────────────────────────────────────────────────────

interface ProjectsContextValue {
  projects:         Project[]
  chats:            ProjectChat[]
  loading:          boolean
  error:            string | null
  createProject:    (name: string, description: string) => Promise<Project>
  updateProject:    (id: string, patch: Partial<Pick<Project, 'name' | 'description' | 'instructions' | 'tags'>>) => Promise<void>
  deleteProject:    (id: string) => Promise<void>
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

  // ── Bootstrap ────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchProjects()
      .then(summaries => setProjects(summaries.map(summaryToProject)))
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load projects'))
      .finally(() => setLoading(false))
  }, [])

  // ── CRUD ──────────────────────────────────────────────────────────────────────

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
        setProjects(prev => prev.map(p => p.id === id ? apiToProject(updated, p) : p))
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

  // ── File management ───────────────────────────────────────────────────────────

  const uploadFiles = useCallback(async (projectId: string, files: File[]) => {
    if (!files.length) return
    try {
      const updated = await updateProjectApi(projectId, { files })
      setProjects(prev => prev.map(p => p.id === projectId ? apiToProject(updated, p) : p))
    } catch (err) {
      toast.error('Failed to upload files', { description: err instanceof Error ? err.message : undefined })
      throw err
    }
  }, [])

  const removeFile = useCallback(async (projectId: string, fileId: string) => {
    const snapshot = projects.find(p => p.id === projectId)

    // optimistic
    setProjects(prev => prev.map(p =>
      p.id === projectId ? { ...p, files: p.files.filter(f => f.id !== fileId) } : p,
    ))

    try {
      const updated = await updateProjectApi(projectId, { removeDocumentIds: [fileId] })
      setProjects(prev => prev.map(p => p.id === projectId ? apiToProject(updated, p) : p))
    } catch (err) {
      if (snapshot) setProjects(prev => prev.map(p => p.id === projectId ? snapshot : p))
      toast.error('Failed to remove file', { description: err instanceof Error ? err.message : undefined })
      throw err
    }
  }, [projects])

  // ── Chat management ───────────────────────────────────────────────────────────

  // Optimistic: called after a chat has been created via the chats API and linked to this project.
  const addChat = useCallback((projectId: string, chatId: string, title: string) => {
    const now  = new Date().toISOString()
    const chat: ProjectChat = { id: chatId, projectId, title, pinCount: 0, createdAt: now, updatedAt: now }
    setChats(prev => [chat, ...prev.filter(c => !(c.projectId === projectId && c.id === chatId))])
    setProjects(prev => prev.map(p =>
      p.id === projectId ? { ...p, chatCount: p.chatCount + 1, updatedAt: now } : p,
    ))
    addChatToProject(projectId, chatId).catch(() => {
      // silent — the chat was created, linking failure is non-fatal
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

  // ── Lookups ───────────────────────────────────────────────────────────────────

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
    createProject, updateProject, deleteProject,
    uploadFiles, removeFile, addChat, removeChat, renameChat,
    loadProjectChats, getProject, getChats,
  ])

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>
}

export function useProjects(): ProjectsContextValue {
  const ctx = useContext(ProjectsContext)
  if (!ctx) throw new Error('useProjects must be used inside <ProjectsProvider>')
  return ctx
}
