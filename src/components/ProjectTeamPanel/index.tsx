'use client'

import React from 'react'
import { ProjectMembersPanel } from '@/components/ProjectMembersPanel'

export interface ProjectTeamPanelProps {
  projectId: string
  ownerUserId: string
  canEdit: boolean
}

// TeamEditor grants have no backend route anymore (Team was removed entirely
// in the flatten-teams-into-organizations migration) — this used to also show
// a "Team members" roster sourced from listTeamEditors() above the project
// members list below. That's gone with no replacement; project-level access
// (below) is the only membership concept left.
export function ProjectTeamPanel({ projectId, ownerUserId, canEdit }: ProjectTeamPanelProps) {
  if (!canEdit) return null
  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--neutral-200)' }}>
      <ProjectMembersPanel
        projectId={projectId}
        ownerUserId={ownerUserId}
      />
    </div>
  )
}

export default ProjectTeamPanel
