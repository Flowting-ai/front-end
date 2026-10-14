'use client'

import React, { createContext, useCallback, use, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/context/auth-context'
import { trackBrowserEvent, trackFeature } from '@/lib/analytics/events'
import {
  fetchProjects,
  fetchProject,
  fetchProjectChats,
  createProjectApi,
  updateProjectApi,
  deleteProjectApi,
  addChatToProject,
  removeChatFromProject,
  removeProjectDocumentApi,
  addProjectFilesApi,
} from '@/lib/api/projects'
import type { ProjectVisibility } from '@/lib/api/projects'
import { queryKeys } from '@/lib/query-keys'
import {
  apiChatToProjectChat,
  apiToProject,
  formatBytes,
  loadStoredSizes,
  mapProject,
  mergeProjectChats,
  mergeSummaries,
  saveStoredSizes,
  toApiPatch,
  upsertProject,
  type Project,
  type ProjectChat,
  type ProjectPatch,
  type ProjectTag,
} from '@/lib/projects/project-model'

// Types and tag helpers live in lib/projects/project-model.ts; re-exported for existing imports.
export { TAG_COLORS, tagsFromLabels } from '@/lib/projects/project-model'
export type { Project, ProjectChat, ProjectFile, ProjectPin, ProjectTag } from '@/lib/projects/project-model'

// ── Context ──────────────────────────────────────────────────────────────────
// Server state lives in the React Query cache (queryKeys.projects.*): the list,
// and a flat chat list filled per project. This provider keeps the original
// API and does the optimistic writes; every write cancels in-flight fetches for
// its key first so a late response can't overwrite it, and rolls back only the
// item it touched.

interface ProjectsContextValue {
  projects:         Project[]
  chats:            ProjectChat[]
  loading:          boolean
  createProject:    (name: string, description: string, teamId?: string, visibility?: ProjectVisibility, tags?: ProjectTag[]) => Promise<Project>
  updateProject:    (id: string, patch: ProjectPatch) => Promise<void>
  deleteProject:    (id: string) => Promise<void>
  loadProject:      (id: string) => Promise<void>
  uploadFiles:      (projectId: string, files: File[]) => Promise<void>
  removeFile:       (projectId: string, fileId: string) => Promise<void>
  addChat:          (projectId: string, chatId: string, title: string, options?: { skipLink?: boolean }) => void
  removeChat:       (projectId: string, chatId: string) => Promise<void>
  renameChat:       (projectId: string, chatId: string, title: string) => void
  loadProjectChats: (projectId: string) => Promise<void>
  getProject:       (id: string) => Project | undefined
  getChats:         (projectId: string) => ProjectChat[]
  /** Re-fetches the project list from the server (not a mutation itself) —
   *  for callers whose own action already changed server state through some
   *  other endpoint (e.g. leaving or restoring a project) and just need the
   *  list to catch up. Rejects if the fetch fails. */
  refreshProjects:  () => Promise<void>
}

/** The lists and lookups. Changes whenever a project or chat changes. */
export type ProjectsData = Pick<ProjectsContextValue, 'projects' | 'chats' | 'loading' | 'getProject' | 'getChats'>
/** The writes and loads. Stable for the signed-in user, so action-only consumers do not re-render on data changes. */
export type ProjectActions = Omit<ProjectsContextValue, keyof ProjectsData>

const ProjectsDataContext = createContext<ProjectsData | null>(null)
const ProjectActionsContext = createContext<ProjectActions | null>(null)

const EMPTY_PROJECTS: Project[] = []
const EMPTY_CHATS: ProjectChat[] = []
const errorDescription = (err: unknown) => (err instanceof Error ? err.message : undefined)

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  // Auth0 `sub` — matches the backend's `ownerUserId` on every project shape.
  // `canEdit` is derived as `ownerUserId === currentUserId`, so this must be the
  // real id; the queries wait for the profile.
  const currentUserId = user?.auth0Id ?? ''
  const qc = useQueryClient()
  const listKey = queryKeys.projects.list(currentUserId)
  const chatsKey = queryKeys.projects.chats(currentUserId)

  const listQuery = useQuery({
    queryKey: listKey,
    queryFn: async () => mergeSummaries(qc.getQueryData<Project[]>(listKey) ?? [], await fetchProjects(currentUserId)),
    enabled: !!currentUserId,
  })
  // Chats are written per project by loadProjectChats and the optimistic
  // actions; this query only exposes that cache entry.
  const chatsQuery = useQuery({
    queryKey: chatsKey,
    queryFn: () => qc.getQueryData<ProjectChat[]>(chatsKey) ?? [],
    initialData: EMPTY_CHATS,
    staleTime: Infinity,
    enabled: !!currentUserId,
  })

  const projects = listQuery.data ?? EMPTY_PROJECTS
  const chats = chatsQuery.data
  const loading = listQuery.isPending

  useEffect(() => {
    if (listQuery.isError && !listQuery.data) {
      toast.error('Failed to load projects', { description: errorDescription(listQuery.error) })
    }
  }, [listQuery.isError, listQuery.data, listQuery.error, listQuery.errorUpdatedAt])

  const setProjects = useCallback((fn: (prev: Project[]) => Project[]) => {
    qc.setQueryData<Project[]>(listKey, prev => fn(prev ?? []))
  }, [qc, listKey])
  const setChats = useCallback((fn: (prev: ProjectChat[]) => ProjectChat[]) => {
    qc.setQueryData<ProjectChat[]>(chatsKey, prev => fn(prev ?? []))
  }, [qc, chatsKey])
  const currentProject = useCallback(
    (id: string) => qc.getQueryData<Project[]>(listKey)?.find(p => p.id === id),
    [qc, listKey],
  )
  /** Stop a list refetch that would land after (and overwrite) an optimistic write. */
  const holdList = useCallback(() => qc.cancelQueries({ queryKey: listKey, exact: true }), [qc, listKey])

  const refreshProjects = useCallback(async () => {
    await qc.refetchQueries({ queryKey: listKey, exact: true }, { throwOnError: true })
  }, [qc, listKey])

  // ── CRUD ───────────────────────────────────────────────────────────────────

  const createProject = useCallback(async (
    name: string,
    description: string,
    teamId?: string,
    visibility?: ProjectVisibility,
    tags?: ProjectTag[],
  ): Promise<Project> => {
    const api = await createProjectApi({ title: name, description, teamId, visibility, tags: tags?.map(t => t.label) }, currentUserId)
    const project = apiToProject(api)
    await holdList()
    setProjects(prev => [project, ...prev.filter(p => p.id !== project.id)])
    // Analytics: shared-context adoption — team-shared vs personal project.
    // Reads the visibility param, not teamId — the only caller
    // (projects/new/page.tsx) always passes visibility and never teamId.
    trackBrowserEvent('project_created', { team_shared: visibility !== undefined && visibility !== 'personal' })
    return project
  }, [currentUserId, holdList, setProjects])

  const updateProject = useCallback(async (id: string, patch: ProjectPatch) => {
    const snapshot = currentProject(id)
    await holdList()
    setProjects(prev => mapProject(prev, id, p => ({ ...p, ...patch, updatedAt: new Date().toISOString() })))

    const apiPatch = toApiPatch(patch)
    if (Object.keys(apiPatch).length === 0) return
    try {
      const updated = await updateProjectApi(id, apiPatch, currentUserId)
      setProjects(prev => mapProject(prev, id, p => apiToProject(updated, p, undefined)))
      // Analytics: do people give projects instructions, or just make empty folders?
      if (patch.instructions !== undefined) {
        trackFeature('project_instructions_added', { has_instructions: !!patch.instructions.trim() })
      }
    } catch (err) {
      if (snapshot) setProjects(prev => mapProject(prev, id, () => snapshot))
      toast.error('Failed to update project', { description: errorDescription(err) })
      throw err
    }
  }, [currentUserId, currentProject, holdList, setProjects])

  const deleteProject = useCallback(async (id: string) => {
    const snapshot = currentProject(id)

    // Guardrail: owner-only, matching the backend exactly (requireDelete ===
    // requireOwned, project.py).
    if (snapshot && !snapshot.canEdit) {
      toast.error("You don't have permission to delete this project.")
      return
    }

    await holdList()
    setProjects(prev => prev.filter(p => p.id !== id))
    setChats(prev => prev.filter(c => c.projectId !== id))

    try {
      await deleteProjectApi(id)
    } catch (err) {
      if (snapshot) setProjects(prev => [snapshot, ...prev])
      toast.error('Failed to delete project', { description: errorDescription(err) })
      throw err
    }
  }, [currentProject, holdList, setProjects, setChats])

  const loadProject = useCallback(async (id: string) => {
    try {
      const api = await fetchProject(id, currentUserId)
      const storedSizes = loadStoredSizes(id)

      // Persist any sizes the server already knows about into localStorage.
      const serverSizes = new Map<string, number>(
        api.documents
          .filter(doc => doc.sizeBytes != null && doc.sizeBytes > 0)
          .map(doc => [doc.filename, doc.sizeBytes!]),
      )
      if (serverSizes.size > 0) saveStoredSizes(id, new Map([...storedSizes, ...serverSizes]))
      const mergedSizes = new Map([...storedSizes, ...serverSizes])

      setProjects(prev => upsertProject(prev, apiToProject(api, prev.find(p => p.id === id), mergedSizes)))

      // Background: HEAD-request sizes for docs the server AND localStorage both
      // lack. Goes away once documents carry size_bytes (backend gap).
      const missing = api.documents.filter(doc => !mergedSizes.has(doc.filename) && doc.fileLink)
      if (missing.length === 0) return
      const settled = await Promise.allSettled(
        missing.map(async doc => {
          const res = await fetch(doc.fileLink, { method: 'HEAD' })
          const len = res.headers.get('content-length')
          return { name: doc.filename, size: len ? parseInt(len, 10) : 0 }
        }),
      )
      const resolved = new Map<string, number>()
      for (const r of settled) {
        if (r.status === 'fulfilled' && r.value.size > 0) resolved.set(r.value.name, r.value.size)
      }
      if (resolved.size === 0) return
      saveStoredSizes(id, new Map([...loadStoredSizes(id), ...resolved]))
      setProjects(prev => mapProject(prev, id, p => ({
        ...p,
        files: p.files.map(f => {
          const size = resolved.get(f.name)
          return size ? { ...f, sizeBytes: size, sizeLabel: formatBytes(size) } : f
        }),
      })))
    } catch (err) {
      toast.error('Failed to load project', { description: errorDescription(err) })
    }
  }, [currentUserId, setProjects])

  // ── File management ────────────────────────────────────────────────────────

  const uploadFiles = useCallback(async (projectId: string, files: File[]) => {
    if (!files.length) return
    const uploadedSizes = new Map<string, number>(files.map(f => [f.name, f.size]))
    try {
      const updated = await addProjectFilesApi(projectId, files, currentUserId)
      const merged = new Map([...loadStoredSizes(projectId), ...uploadedSizes])
      saveStoredSizes(projectId, merged)
      await holdList()
      setProjects(prev => mapProject(prev, projectId, p => apiToProject(updated, p, merged)))
    } catch (err) {
      toast.error('Failed to upload files', { description: errorDescription(err) })
      throw err
    }
  }, [currentUserId, holdList, setProjects])

  const removeFile = useCallback(async (projectId: string, fileId: string) => {
    const snapshot = currentProject(projectId)
    const removedName = snapshot?.files.find(f => f.id === fileId)?.name

    await holdList()
    setProjects(prev => mapProject(prev, projectId, p => ({ ...p, files: p.files.filter(f => f.id !== fileId) })))

    try {
      // DELETE /projects/{project_id}/files/{document_id} returns the updated ProjectResponse directly.
      const updated = await removeProjectDocumentApi(projectId, fileId, currentUserId)
      // Guard: if the backend returned 200 but the file is still in the response, treat it as failure.
      if (updated.documents.some(d => d.id === fileId)) throw new Error('File could not be removed')
      if (removedName) {
        const stored = loadStoredSizes(projectId)
        stored.delete(removedName)
        saveStoredSizes(projectId, stored)
      }
      const storedSizes = loadStoredSizes(projectId)
      setProjects(prev => mapProject(prev, projectId, p => apiToProject(updated, p, storedSizes)))
    } catch (err) {
      if (snapshot) setProjects(prev => mapProject(prev, projectId, () => snapshot))
      toast.error('Failed to remove file', { description: errorDescription(err) })
    }
  }, [currentUserId, currentProject, holdList, setProjects])

  // ── Chat management ────────────────────────────────────────────────────────

  // Optimistic: called after a chat has been created via the chats API and linked to this project.
  // `skipLink` is for callers (move-to-project) that already awaited addChatToProject
  // themselves for real error handling — without it, every move fired the link call twice.
  const addChat = useCallback((projectId: string, chatId: string, title: string, options?: { skipLink?: boolean }) => {
    const now  = new Date().toISOString()
    const chat: ProjectChat = { id: chatId, ownerUserId: '', canEdit: true, projectId, title, pinCount: 0, createdAt: now, updatedAt: now }
    setChats(prev => [chat, ...prev.filter(c => !(c.projectId === projectId && c.id === chatId))])
    setProjects(prev => mapProject(prev, projectId, p => ({ ...p, chatCount: p.chatCount + 1, updatedAt: now })))
    if (!options?.skipLink) {
      addChatToProject(projectId, chatId).catch(() => {
        // silent - the chat was created, linking failure is non-fatal
      })
    }
  }, [setChats, setProjects])

  const removeChat = useCallback((projectId: string, chatId: string) => {
    setChats(prev => prev.filter(c => !(c.projectId === projectId && c.id === chatId)))
    setProjects(prev => mapProject(prev, projectId, p => ({ ...p, chatCount: Math.max(0, p.chatCount - 1) })))
    // Returns the request so a caller that cares when the delete completes
    // (e.g. the sidebar's confirm-delete dialog) can await/catch it. The extra
    // .catch keeps fire-and-forget callers from an unhandled rejection —
    // non-fatal if the chat was never linked in the first place.
    const request = removeChatFromProject(projectId, chatId)
    request.catch(() => {})
    return request
  }, [setChats, setProjects])

  const renameChat = useCallback((projectId: string, chatId: string, title: string) => {
    setChats(prev => prev.map(c => (c.projectId === projectId && c.id === chatId ? { ...c, title } : c)))
  }, [setChats])

  // The sidebar lists, the projects page and the project page all ask for the
  // same project at once; fetchQuery shares one in-flight request per project.
  const loadProjectChats = useCallback(async (projectId: string): Promise<void> => {
    try {
      const mapped = await qc.fetchQuery({
        queryKey: queryKeys.projects.chatLoad(currentUserId, projectId),
        queryFn: async () => (await fetchProjectChats(projectId, currentUserId)).map(c => apiChatToProjectChat(c, projectId)),
        staleTime: 0,
      })
      setChats(prev => mergeProjectChats(prev, projectId, mapped))
      // Sync chatCount to match the authoritative list from the API.
      setProjects(prev => mapProject(prev, projectId, p => ({ ...p, chatCount: mapped.length })))
    } catch (err) {
      toast.error('Failed to load project chats', { description: errorDescription(err) })
    }
  }, [qc, currentUserId, setChats, setProjects])

  // ── Lookups ────────────────────────────────────────────────────────────────

  const getProject = useCallback((id: string) => projects.find(p => p.id === id), [projects])

  const getChats = useCallback((projectId: string) => chats.filter(c => c.projectId === projectId), [chats])

  const data = useMemo<ProjectsData>(
    () => ({ projects, chats, loading, getProject, getChats }),
    [projects, chats, loading, getProject, getChats],
  )
  const actions = useMemo<ProjectActions>(() => ({
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
    refreshProjects,
  }), [
    createProject, updateProject, deleteProject, loadProject,
    uploadFiles, removeFile, addChat, removeChat, renameChat,
    loadProjectChats, refreshProjects,
  ])

  return (
    <ProjectActionsContext.Provider value={actions}>
      <ProjectsDataContext.Provider value={data}>{children}</ProjectsDataContext.Provider>
    </ProjectActionsContext.Provider>
  )
}

/** The project lists and lookups only. */
export function useProjectsData(): ProjectsData {
  const ctx = use(ProjectsDataContext)
  if (!ctx) throw new Error('useProjectsData must be used inside <ProjectsProvider>')
  return ctx
}

/** The project writes and loads only; does not re-render when project data changes. */
export function useProjectActions(): ProjectActions {
  const ctx = use(ProjectActionsContext)
  if (!ctx) throw new Error('useProjectActions must be used inside <ProjectsProvider>')
  return ctx
}

/** Data and actions together; re-renders on any project change. Prefer the two hooks above. */
export function useProjects(): ProjectsContextValue {
  const data = useProjectsData()
  const actions = useProjectActions()
  return useMemo(() => ({ ...data, ...actions }), [data, actions])
}
