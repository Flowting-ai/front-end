import type { Project } from './project-model'

/**
 * Who may do what with a project, mirroring project.py. One place instead of
 * per-page copies. `project.canEdit` means "viewer owns it" (derived from
 * ownerUserId in lib/api/projects.ts).
 *
 * - edit-content: title/description/instructions/tags/files. The backend's
 *   update() uses requireWritable, which also passes for any workspace member on
 *   a Workspace project. NOT yet correct for a non-owner collaborator on a
 *   Shared project — that needs the member list, which isn't fetched eagerly.
 * - delete, change-visibility: owner only (requireDelete === requireOwned).
 * - leave: a non-owner on a workspace/shared project. Personal projects have no
 *   membership (backend 400s); owner leave needs a transfer flow that doesn't exist yet.
 * - manage-members: Shared projects only; workspace access is the whole org.
 */
export type ProjectAction = 'edit-content' | 'delete' | 'leave' | 'manage-members' | 'change-visibility'

type ProjectFacts = Pick<Project, 'canEdit' | 'visibility' | 'teamId'>

export function canProject(action: ProjectAction, project: ProjectFacts | null | undefined, orgId: string | null | undefined): boolean {
  if (!project) return false
  switch (action) {
    case 'edit-content':
      return project.canEdit || (project.visibility === 'workspace' && !!orgId && project.teamId === orgId)
    case 'delete':
      return project.canEdit
    case 'leave':
      return project.visibility !== 'personal' && !project.canEdit
    case 'manage-members':
      return project.visibility === 'shared'
    case 'change-visibility':
      return project.canEdit && !!orgId
  }
}
