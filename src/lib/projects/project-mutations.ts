'use client'

import { mutationOptions, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/context/auth-context'
import { trackFeature } from '@/lib/analytics/events'
import { deleteProjectApi, updateProjectApi } from '@/lib/api/projects'
import { queryKeys } from '@/lib/query-keys'
import { apiToProject, mapProject, toApiPatch, type Project, type ProjectChat, type ProjectPatch } from './project-model'

const errorDescription = (err: unknown) => (err instanceof Error ? err.message : undefined)

/** Thrown before anything changes when a non-owner tries to delete (the backend allows owners only). */
export class ProjectDeleteForbiddenError extends Error {
  constructor() {
    super("You don't have permission to delete this project.")
    this.name = 'ProjectDeleteForbiddenError'
  }
}

export type UpdateProjectVars = { id: string; patch: ProjectPatch }

export interface ProjectMutationDeps {
  update?: typeof updateProjectApi
  remove?: typeof deleteProjectApi
}

/**
 * Edit a project (name, description, tags, visibility, instructions). Optimistic in the list; the
 * server's copy replaces it on success, and only this project goes back on failure.
 */
export function updateProjectOptions(qc: QueryClient, userId: string, { update = updateProjectApi }: ProjectMutationDeps = {}) {
  const listKey = queryKeys.projects.list(userId)
  return mutationOptions({
    mutationKey: [...queryKeys.projects.all(userId), 'update'],
    mutationFn: async ({ id, patch }: UpdateProjectVars) => {
      const apiPatch = toApiPatch(patch)
      // Nothing the server stores changed (the optimistic write is all there is to do).
      if (Object.keys(apiPatch).length === 0) return null
      return update(id, apiPatch, userId)
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: listKey, exact: true })
      const snapshot = qc.getQueryData<Project[]>(listKey)?.find(p => p.id === id)
      qc.setQueryData<Project[]>(listKey, prev => mapProject(prev ?? [], id, p => ({ ...p, ...patch, updatedAt: new Date().toISOString() })))
      return { snapshot }
    },
    onSuccess: (updated, { id, patch }) => {
      if (!updated) return
      qc.setQueryData<Project[]>(listKey, prev => mapProject(prev ?? [], id, p => apiToProject(updated, p, undefined)))
      // Analytics: do people give projects instructions, or just make empty folders?
      if (patch.instructions !== undefined) {
        trackFeature('project_instructions_added', { has_instructions: !!patch.instructions.trim() })
      }
    },
    onError: (err, { id }, ctx) => {
      const snapshot = ctx?.snapshot
      if (snapshot) qc.setQueryData<Project[]>(listKey, prev => mapProject(prev ?? [], id, () => snapshot))
      toast.error('Failed to update project', { description: errorDescription(err) })
    },
    onSettled: (updated) => {
      // A no-op patch never reached the server, so there is nothing to refetch.
      if (updated !== null) void qc.invalidateQueries({ queryKey: listKey, exact: true })
    },
  })
}

/**
 * Delete a project (owner only). The project and its chats leave the lists at once and come back
 * on failure. Settling refetches the project list only.
 */
export function deleteProjectOptions(qc: QueryClient, userId: string, { remove = deleteProjectApi }: ProjectMutationDeps = {}) {
  const listKey = queryKeys.projects.list(userId)
  const chatsKey = queryKeys.projects.chats(userId)
  return mutationOptions({
    mutationKey: [...queryKeys.projects.all(userId), 'delete'],
    mutationFn: (id: string) => remove(id),
    onMutate: async (id) => {
      const snapshot = qc.getQueryData<Project[]>(listKey)?.find(p => p.id === id)
      // Guardrail: owner-only, matching the backend exactly (requireDelete === requireOwned, project.py).
      if (snapshot && !snapshot.canEdit) throw new ProjectDeleteForbiddenError()
      await qc.cancelQueries({ queryKey: listKey, exact: true })
      const chats = qc.getQueryData<ProjectChat[]>(chatsKey)?.filter(c => c.projectId === id) ?? []
      qc.setQueryData<Project[]>(listKey, prev => prev?.filter(p => p.id !== id))
      qc.setQueryData<ProjectChat[]>(chatsKey, prev => prev?.filter(c => c.projectId !== id))
      return { snapshot, chats }
    },
    onError: (err, _id, ctx) => {
      if (err instanceof ProjectDeleteForbiddenError) {
        toast.error(err.message)
        return
      }
      const snapshot = ctx?.snapshot
      if (snapshot) qc.setQueryData<Project[]>(listKey, prev => (prev?.some(p => p.id === snapshot.id) ? prev : [snapshot, ...(prev ?? [])]))
      const chats = ctx?.chats ?? []
      if (chats.length) qc.setQueryData<ProjectChat[]>(chatsKey, prev => [...chats.filter(c => !prev?.some(p => p.id === c.id)), ...(prev ?? [])])
      toast.error('Failed to delete project', { description: errorDescription(err) })
    },
    onSettled: (_data, err) => {
      if (err instanceof ProjectDeleteForbiddenError) return
      void qc.invalidateQueries({ queryKey: listKey, exact: true })
    },
  })
}

/** The signed-in user's id, which scopes every project cache entry. */
function useProjectUserId() {
  return useAuth().user?.auth0Id ?? ''
}

export function useUpdateProject() {
  return useMutation(updateProjectOptions(useQueryClient(), useProjectUserId()))
}

export function useDeleteProject() {
  return useMutation(deleteProjectOptions(useQueryClient(), useProjectUserId()))
}
