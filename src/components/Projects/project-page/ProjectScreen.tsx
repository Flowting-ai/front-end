'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeftOneIcon } from '@strange-huge/icons'
import { ProjectNotFound } from '@/components/Projects/ProjectRouteStates'
import { useAuth } from '@/context/auth-context'
import { useOrg } from '@/context/org-context'
import { useProjects } from '@/context/projects-context'
import { canProject } from '@/lib/projects/project-permissions'
import { PROJECTS_ROUTE } from '@/lib/routes'
import { ProjectChatList } from './ProjectChatList'
import { ProjectComposer } from './ProjectComposer'
import { ProjectHeader } from './ProjectHeader'
import { ProjectFrame, ProjectModals, ProjectPageSkeleton, ProjectToolsMenu, type ProjectDialog } from './ProjectSections'
import { useProjectComposer } from './use-project-composer'
import { useProjectPanels } from './use-project-panels'
import { useProjectTeamChats } from './use-project-team-chats'

/**
 * One project's page. The route renders it keyed by project id, so switching projects in the
 * sidebar starts every piece of state (composer draft, open panel, tab, dialogs) fresh.
 * Data: useProjects() for the project, use-project-team-chats for a team project's chat list.
 * Sections: header, composer, chat list, tools menu (panels in the app shell) and modals.
 */
export function ProjectScreen({ projectId }: { projectId: string }) {
  const { push } = useRouter()
  const { getProject, updateProject, deleteProject, loadProject, loadProjectChats, loading: projectsLoading, refreshProjects } = useProjects()
  const { orgId, org, caps, members } = useOrg()
  const { user } = useAuth()
  const viewerId = user?.auth0Id ?? undefined
  const project = getProject(projectId)

  const [loading, setLoading] = useState(true)
  useEffect(() => {
    Promise.all([loadProject(projectId), loadProjectChats(projectId)]).finally(() => setLoading(false))
  }, [projectId, loadProject, loadProjectChats])

  const [dialog, setDialog] = useState<ProjectDialog>(null)
  const [deleting, setDeleting] = useState(false)

  // Rules for every check: lib/projects/project-permissions.ts. On a Shared project any member can
  // add or remove members (only the owner cannot be removed); delete is owner-only, as on the backend.
  const canEdit = canProject('edit-content', project, orgId)
  const canManageMembers = canProject('manage-members', project, orgId)

  const teamChats = useProjectTeamChats(project, projectId, viewerId)
  const composer = useProjectComposer(projectId)
  const [openInstructions] = useState(() => () => setDialog('instructions'))
  const [openShare] = useState(() => () => setDialog('share'))
  const panels = useProjectPanels({ project, canEdit, canManageMembers, onOpenInstructions: openInstructions, onAddMember: openShare })

  if (!project) return projectsLoading || loading ? <ProjectPageSkeleton /> : <ProjectNotFound />

  const shared = project.visibility !== 'personal'
  // Publishing needs a team to publish to: an org member's Personal project also has a teamId.
  const canPublish = shared && !!project.teamId && caps.canPublishToTeam(project.teamId)

  async function confirmDelete() {
    setDeleting(true)
    try {
      await deleteProject(projectId)
      push(PROJECTS_ROUTE)
    } catch {
      // the projects context already showed the error
    } finally {
      setDeleting(false)
    }
  }

  return (
    <ProjectFrame
      overlay={
        <>
          {/* Back, in the TopBar zone. */}
          <button
            onClick={() => push(PROJECTS_ROUTE)}
            style={{ position: 'absolute', top: 6, left: 8, zIndex: 10, display: 'flex', alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '10px', flexShrink: 0 }}
            aria-label="Back to Projects"
          >
            <ArrowLeftOneIcon style={{ width: 20, height: 20, color: 'var(--neutral-700)' }} />
          </button>
          <ProjectToolsMenu panels={panels} showMembers={shared} />
          <ProjectModals
            project={project}
            dialog={dialog}
            onClose={() => setDialog(null)}
            canEdit={canEdit}
            canChangeVisibility={canProject('change-visibility', project, orgId)}
            viewerId={viewerId}
            orgName={org?.name ?? ''}
            deleting={deleting}
            onSave={(patch) => updateProject(projectId, patch)}
            onConfirmDelete={confirmDelete}
            onLeft={() => {
              // The leave succeeded; a failed refresh only leaves /projects stale until the next load.
              refreshProjects().catch(() => {})
              push(PROJECTS_ROUTE)
            }}
          />
        </>
      }
    >
      <ProjectHeader
        project={project}
        ownerName={members.find(m => m.id === project.ownerUserId)?.name}
        canEdit={canEdit}
        canLeave={canProject('leave', project, orgId)}
        canDelete={canProject('delete', project, orgId)}
        onEdit={() => setDialog('edit')}
        onLeave={() => setDialog('leave')}
        onDelete={() => setDialog('delete')}
        onShare={openShare}
      />
      <ProjectComposer composer={composer} onOpenAgents={() => panels.show('agents')} />
      <ProjectChatList project={project} viewerId={viewerId} members={members} canPublish={canPublish} team={teamChats} />
    </ProjectFrame>
  )
}
