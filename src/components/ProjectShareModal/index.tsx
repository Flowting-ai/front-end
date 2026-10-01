'use client'

import React from 'react'
import { createPortal } from 'react-dom'
import { CancelOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { IconButton } from '@/components/IconButton'
import { ProjectAddMembersList } from '@/components/ProjectAddMembersList'
import type { ProjectVisibility } from '@/lib/api/projects'

export interface ProjectShareModalProps {
  open:              boolean
  onClose:           () => void
  projectId:         string
  /** Only ever rendered for a non-personal project — the Sharing icon that
   *  opens this modal is itself hidden on personal projects. */
  projectVisibility: Exclude<ProjectVisibility, 'personal'>
  orgName:           string
  onMemberAdded:     () => void
}

// Portaled to document.body: AppLayout's rounded content container sets
// `isolation: isolate` for its own z-index scoping, which traps any z-index
// set on a descendant — including a `position: fixed` one — inside that
// local stacking context. Since the Instructions/Team panel and Pinboard
// render as siblings OUTSIDE that container (see project-panel-context /
// RightSidebar), nothing rendered in-place here could ever paint above them,
// no matter how high the z-index. Portaling escapes the trap the same way
// EditProjectModal/SystemInstructionsModal already do.
//
// This used to be a Private<->Shared visibility TOGGLE — that's gone: the
// backend has no PATCH to change a project's visibility after creation
// (personal/workspace/shared is fixed at creation, per
// sharing-model-v2.html's Types table). So this is now read-only status
// plus, for Shared projects, an invite-only list (org members NOT yet in the
// project, each with its own "Add to project" button — ProjectAddMembersList).
// Viewing/removing people already on the project stays the "Members"
// floating panel's job (ProjectMembersPanel) — this modal never shows
// current members, to avoid duplicating that same list in two places.
// Workspace projects have nothing to manage: access is automatic for the
// whole workspace, per spec ("membership = whole workspace, not managed").
export function ProjectShareModal({ open, onClose, projectId, projectVisibility, orgName, onMemberAdded }: ProjectShareModalProps) {
  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(18,12,8,0.4)', backdropFilter: 'blur(2px)', zIndex: 100 }}
      />
      <div
        style={{
          position:        'fixed',
          top:             '50%',
          left:            '50%',
          transform:       'translate(-50%, -50%)',
          zIndex:          101,
          width:           600,
          maxWidth:        'calc(100vw - 48px)',
          maxHeight:       'calc(100vh - 96px)',
          // Only the Shared branch (real member list below) gets a real
          // `height`, not just a cap — `flex: 1 1 0` on that list region
          // has flex-basis 0 and only grows into space the container
          // actually has; an auto-sized (maxHeight-only) column has none
          // to give it, so it rendered at ~0px. The Workspace branch is a
          // couple lines of static text with nothing to scroll, so it
          // stays auto-height (no wasted white space below short text).
          height:          projectVisibility === 'shared' ? 600 : undefined,
          overflow:        'hidden',
          borderRadius:    16,
          backgroundColor: 'var(--neutral-white)',
          boxShadow:       '0px 8px 32px rgba(18,12,8,0.18), 0px 0px 0px 1px var(--neutral-100)',
          padding:         24,
          display:         'flex',
          flexDirection:   'column',
          gap:             16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: '0 0 4px' }}>
              Sharing
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-500)', margin: 0 }}>
              {projectVisibility === 'workspace'
                ? `Everyone in ${orgName || 'your workspace'} can see this project.`
                : 'Add teammates from your workspace to this project.'}
            </p>
          </div>
          <IconButton
            variant="ghost"
            size="xs"
            icon={<CancelOneIcon />}
            aria-label="Close"
            onClick={onClose}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-500)' }}>
            Currently
          </span>
          {projectVisibility === 'workspace' ? (
            <Badge color="Blue" label="Workspace" />
          ) : (
            <Badge color="Yellow" label="Shared" />
          )}
        </div>

        {projectVisibility === 'workspace' ? (
          // No manageable list — per spec, Workspace access is automatic
          // for everyone currently in the org, not a curated list. Revoke
          // access by removing someone from the workspace itself, not here.
          <div style={{ padding: '16px', borderRadius: 16, border: '1px solid var(--neutral-200)', backgroundColor: 'var(--neutral-50)' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: '20px', color: 'var(--neutral-600)', margin: 0 }}>
              Workspace projects aren&apos;t shared with individual people — every
              current and future workspace member has access automatically.
              To remove someone&apos;s access, remove them from the workspace.
            </p>
          </div>
        ) : (
          // This modal is invite-only — viewing/removing people already
          // on the project is the "Members" floating panel's job
          // (ProjectMembersPanel), not this one's. `flex: 1 1 0` +
          // `minHeight: 0` let the list grow to fill whatever room the
          // header/badge/footer leave (bounded by the card's own
          // maxHeight above) and scroll internally once it overflows.
          <div style={{ flex: '1 1 0', minHeight: 0, display: 'flex' }}>
            <ProjectAddMembersList projectId={projectId} onAdded={onMemberAdded} />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>
    </>,
    document.body,
  )
}

export default ProjectShareModal
