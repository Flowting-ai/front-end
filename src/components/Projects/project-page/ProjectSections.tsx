'use client'

import React from 'react'
import { PinIcon, SettingsOneIcon, UserAiIcon, UserIcon } from '@strange-huge/icons'
import { FloatingMenu } from '@/components/FloatingMenu'
import { FloatingMenuItem } from '@/components/FloatingMenuItem'
import { teamChatsLoadingRows } from '@/components/ProjectChatListSkeleton'
import { DeleteProjectModal, EditProjectModal, LeaveProjectModal, ProjectShareModal } from '@/components/Projects/lazy-modals'
import { Skeleton } from '@/components/Skeleton'
import { SystemInstructionsModal } from '@/components/SystemInstructionsModal'
import type { Project, ProjectPatch } from '@/lib/projects/project-model'
import { PROJECT_VISIBILITY_OPTIONS } from '@/lib/api/projects'
import { PINS_ENABLED } from '@/lib/feature-flags'
import type { ProjectPanels } from './use-project-panels'

const screenStyle: React.CSSProperties = { position: 'relative', display: 'flex', width: '100%', flex: '1 1 auto', minHeight: 0, overflow: 'hidden' }
const columnStyle: React.CSSProperties = { flex: '1 0 0', minWidth: 0, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }
const innerStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px 8px', boxSizing: 'border-box', gap: '12px', height: '100%' }

/** The page frame: the outer row and the centred left column. Shared by the page and its skeleton. */
export function ProjectFrame({ children, overlay }: { children: React.ReactNode; overlay?: React.ReactNode }) {
  return (
    <div style={screenStyle}>
      {overlay}
      <div style={columnStyle}>
        <div style={innerStyle}>{children}</div>
      </div>
    </div>
  )
}

/** The page's own shell (title block and chat rows) while the project loads, so it never flashes bare text. */
export function ProjectPageSkeleton() {
  return (
    <ProjectFrame>
      <div style={{ width: '100%', maxWidth: '679px', marginBottom: '27px', flexShrink: 0 }}>
        <Skeleton width="40%" height={28} style={{ marginBottom: 12 }} />
        <Skeleton width="60%" height={14} />
      </div>
      <div style={{ width: '100%', maxWidth: '679px' }}>{teamChatsLoadingRows()}</div>
    </ProjectFrame>
  )
}

/**
 * The floating tools menu on the right. The panels it opens render in AppLayout's shared slot (a
 * flex sibling, like Pinboard), so the menu never has to move for them.
 */
export function ProjectToolsMenu({ panels, showMembers }: { panels: ProjectPanels; showMembers: boolean }) {
  return (
    <div style={{ position: 'absolute', top: '50%', right: 16, transform: 'translateY(-50%)', zIndex: 20 }}>
      <FloatingMenu aria-label="Project tools">
        <FloatingMenuItem icon={<SettingsOneIcon size={20} animated />} label="Instructions & Files" active={panels.open === 'files'} onClick={() => panels.toggle('files')} />
        {PINS_ENABLED && <FloatingMenuItem icon={<PinIcon size={20} />} label="Pinboard" active={panels.pinboardOpen} onClick={panels.togglePins} />}
        <FloatingMenuItem icon={<UserAiIcon size={20} animated />} label="Agents" active={panels.open === 'agents'} onClick={() => panels.toggle('agents')} />
        {showMembers && <FloatingMenuItem icon={<UserIcon size={20} animated />} label="Members" active={panels.open === 'members'} onClick={() => panels.toggle('members')} />}
      </FloatingMenu>
    </div>
  )
}

export type ProjectDialog = 'edit' | 'leave' | 'delete' | 'instructions' | 'share' | null

/** Edit, Leave, Delete, the instructions editor and Sharing. All lazy except the instructions editor. */
export function ProjectModals({ project, dialog, onClose, canEdit, canChangeVisibility, viewerId, orgName, deleting, onSave, onConfirmDelete, onLeft }: {
  project: Project
  dialog: ProjectDialog
  onClose: () => void
  canEdit: boolean
  canChangeVisibility: boolean
  viewerId: string | undefined
  orgName: string
  deleting: boolean
  onSave: (patch: ProjectPatch) => Promise<void>
  onConfirmDelete: () => void
  onLeft: () => void
}) {
  return (
    <>
      {canEdit && (
        <EditProjectModal
          open={dialog === 'edit'}
          name={project.name}
          description={project.description}
          tags={project.tags}
          visibility={project.visibility}
          visibilityOptions={canChangeVisibility ? PROJECT_VISIBILITY_OPTIONS : []}
          onSave={(name, description, tags, visibility) => onSave({ name, description, tags, visibility })}
          onClose={onClose}
        />
      )}
      {dialog === 'leave' && viewerId && (
        <LeaveProjectModal projectId={project.id} isOwner={project.canEdit} currentUserId={viewerId} onClose={onClose} onLeft={onLeft} />
      )}
      <DeleteProjectModal
        open={dialog === 'delete'}
        projectName={project.name}
        chatCount={project.chatCount}
        loading={deleting}
        onConfirm={onConfirmDelete}
        onClose={onClose}
      />
      {canEdit && (
        <SystemInstructionsModal
          open={dialog === 'instructions'}
          projectName={project.name}
          value={project.instructions}
          onSave={(text) => onSave({ instructions: text })}
          onClose={onClose}
        />
      )}
      {/* Sharing opens only from the Sharing button, which personal projects do not have. */}
      {project.visibility !== 'personal' && (
        <ProjectShareModal open={dialog === 'share'} onClose={onClose} projectId={project.id} projectVisibility={project.visibility} orgName={orgName} />
      )}
    </>
  )
}
