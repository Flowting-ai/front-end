'use client'

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { BadgeColor } from '@/components/Badge'
import type { PinProps, PinLabel } from '@/components/Pin'

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

// ── Context ────────────────────────────────────────────────────────────────────

interface ProjectsContextValue {
  projects:       Project[]
  chats:          ProjectChat[]
  createProject:  (name: string, description: string) => Project
  updateProject:  (id: string, patch: Partial<Pick<Project, 'name' | 'description' | 'instructions' | 'tags'>>) => void
  deleteProject:  (id: string) => void
  addFile:        (projectId: string, file: ProjectFile) => void
  removeFile:     (projectId: string, fileId: string) => void
  addChat:        (projectId: string, title: string) => ProjectChat
  getProject:     (id: string) => Project | undefined
  getChats:       (projectId: string) => ProjectChat[]
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null)

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [chats, setChats]       = useState<ProjectChat[]>([])

  const createProject = useCallback((name: string, description: string): Project => {
    const now = new Date().toISOString()
    const project: Project = {
      id:           `proj-${Date.now()}`,
      name,
      description,
      instructions: '',
      tags:         [],
      files:        [],
      chatCount:    0,
      updatedAt:    now,
      createdAt:    now,
    }
    setProjects(prev => [project, ...prev])
    return project
  }, [])

  const updateProject = useCallback((id: string, patch: Partial<Pick<Project, 'name' | 'description' | 'instructions' | 'tags'>>) => {
    setProjects(prev => prev.map(p =>
      p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p,
    ))
  }, [])

  const deleteProject = useCallback((id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id))
    setChats(prev => prev.filter(c => c.projectId !== id))
  }, [])

  const addFile = useCallback((projectId: string, file: ProjectFile) => {
    setProjects(prev => prev.map(p =>
      p.id === projectId ? { ...p, files: [...p.files, file], updatedAt: new Date().toISOString() } : p,
    ))
  }, [])

  const removeFile = useCallback((projectId: string, fileId: string) => {
    setProjects(prev => prev.map(p =>
      p.id === projectId ? { ...p, files: p.files.filter(f => f.id !== fileId), updatedAt: new Date().toISOString() } : p,
    ))
  }, [])

  const addChat = useCallback((projectId: string, title: string): ProjectChat => {
    const now  = new Date().toISOString()
    const chat: ProjectChat = {
      id:        `chat-${Date.now()}`,
      projectId,
      title,
      pinCount:  0,
      createdAt: now,
      updatedAt: now,
    }
    setChats(prev => [chat, ...prev])
    setProjects(prev => prev.map(p =>
      p.id === projectId ? { ...p, chatCount: p.chatCount + 1, updatedAt: now } : p,
    ))
    return chat
  }, [])

  const getProject = useCallback((id: string) => projects.find(p => p.id === id), [projects])

  const getChats = useCallback((projectId: string) => chats.filter(c => c.projectId === projectId), [chats])

  const value = useMemo<ProjectsContextValue>(() => ({
    projects,
    chats,
    createProject,
    updateProject,
    deleteProject,
    addFile,
    removeFile,
    addChat,
    getProject,
    getChats,
  }), [projects, chats, createProject, updateProject, deleteProject, addFile, removeFile, addChat, getProject, getChats])

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>
}

export function useProjects(): ProjectsContextValue {
  const ctx = useContext(ProjectsContext)
  if (!ctx) throw new Error('useProjects must be used inside <ProjectsProvider>')
  return ctx
}
