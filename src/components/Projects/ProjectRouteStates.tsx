'use client'

import { LinkButton } from '@/components/Library/LinkButton'
import { RouteState } from '@/components/RouteState'
import { Skeleton } from '@/components/Skeleton'
import { teamChatsLoadingRows } from '@/components/ProjectChatListSkeleton'
import { TopBarPortal } from '@/components/layout/TopBarSlots'
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

/**
 * The project page's shape while it loads, matching the real page so nothing jumps: the back arrow
 * in the TopBar, the title with the type chip, the description, the composer card, then chat rows.
 * Used by both the route's loading.tsx and the page itself (ProjectPageSkeleton).
 */
export function ProjectSkeletonBody() {
  return (
    <>
      <TopBarPortal side="left">
        <Skeleton width={32} height={32} radius={8} />
      </TopBarPortal>
      <div style={{ width: '100%', maxWidth: 679, marginBottom: 24, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, height: 32 }}>
          <Skeleton width="45%" height={26} radius={8} />
          <Skeleton width={72} height={24} radius={6} />
        </div>
        <Skeleton width="60%" height={14} style={{ marginTop: 8 }} />
      </div>
      {/* The composer card (24px radius, ~130px tall). */}
      <div style={{ width: '100%', maxWidth: 679, flexShrink: 0 }}>
        <Skeleton height={130} radius={24} />
      </div>
      <div style={{ width: '100%', maxWidth: 679, padding: 3, boxSizing: 'border-box' }}>{teamChatsLoadingRows()}</div>
    </>
  )
}

/** Route-level placeholder for a project page: the same frame and padding as ProjectFrame. */
export function ProjectDetailLoading() {
  return (
    <div role="status" aria-label="Loading project" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 16px 8px', boxSizing: 'border-box', gap: 12, height: '100%', width: '100%' }}>
      <ProjectSkeletonBody />
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
