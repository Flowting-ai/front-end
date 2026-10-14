'use client'

import { LinkButton } from '@/components/Library/LinkButton'
import { RouteState } from '@/components/RouteState'
import { Skeleton } from '@/components/Skeleton'
import { teamChatsLoadingRows } from '@/components/ProjectChatListSkeleton'
import { PROJECTS_ROUTE } from '@/lib/routes'

/** A project that doesn't exist, was deleted, or isn't shared with this user. */
export function ProjectNotFound() {
  return (
    <RouteState
      fill
      headingLevel="h2"
      heading="Project not found"
      body="It may have been deleted, or it isn't shared with you."
      actions={<LinkButton href={PROJECTS_ROUTE}>Back to Projects</LinkButton>}
    />
  )
}

/** Route-level placeholder for a project page (header + chat rows). */
export function ProjectDetailLoading() {
  return (
    <div role="status" aria-label="Loading project" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px 8px', boxSizing: 'border-box', gap: 12, height: '100%' }}>
      <div style={{ width: '100%', maxWidth: 679, marginBottom: 27 }}>
        <Skeleton width="40%" height={28} style={{ marginBottom: 12 }} />
        <Skeleton width="60%" height={14} />
      </div>
      <div style={{ width: '100%', maxWidth: 679 }}>{teamChatsLoadingRows()}</div>
    </div>
  )
}

/** Route-level placeholder for the projects list (grid cards are 262px tall). */
export function ProjectsListLoading() {
  return (
    <div role="status" aria-label="Loading projects" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px', boxSizing: 'border-box', gap: 24, height: '100%' }}>
      <div style={{ width: '100%', maxWidth: 679 }}>
        <Skeleton width="30%" height={28} style={{ marginBottom: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
          {[0, 1, 2, 3].map(i => <Skeleton key={i} height={262} radius={12} style={{ opacity: 1 - i * 0.15 }} />)}
        </div>
      </div>
    </div>
  )
}
