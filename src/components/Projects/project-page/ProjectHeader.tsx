'use client'

import React, { useState } from 'react'
import { DeleteTwoIcon, MoreVerticalIcon, PenOneIcon, ShareOneIcon, UnlinkOneIcon } from '@strange-huge/icons'
import { Divider } from '@/components/Divider'
import { Dropdown } from '@/components/Dropdown'
import { IconButton } from '@/components/ui/button'
import type { Project } from '@/context/projects-context'

const metaText: React.CSSProperties = { fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-500)' }

/** Project name, the options menu (Edit, Leave, Delete) and Sharing, then who made it and the description. */
export function ProjectHeader({ project, ownerName, canEdit, canLeave, canDelete, onEdit, onLeave, onDelete, onShare }: {
  project: Project
  ownerName: string | undefined
  canEdit: boolean
  canLeave: boolean
  canDelete: boolean
  onEdit: () => void
  onLeave: () => void
  onDelete: () => void
  onShare: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const shared = project.visibility !== 'personal'
  // Delete is confirmed in a modal; it never fires straight from the menu.
  const pick = (action: () => void) => () => { setMenuOpen(false); action() }

  return (
    <div style={{ width: '100%', maxWidth: '679px', marginBottom: '27px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
        <h1 style={{ flex: '1 0 0', minWidth: 0, fontFamily: 'var(--font-title)', fontWeight: 'var(--font-weight-regular)', fontSize: '24px', lineHeight: '32px', color: 'var(--neutral-800)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {project.name}
        </h1>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
          {(canDelete || canLeave) && (
            <Dropdown.Float
              open={menuOpen}
              onOpenChange={setMenuOpen}
              placement="bottom-end"
              trigger={<IconButton variant="outline" size="md" icon={<MoreVerticalIcon triggered={menuOpen} />} aria-label="Project options" />}
            >
              <Dropdown size="md" maxHeight={false}>
                {/* One section for all items: a section per item stacked its padding into large gaps. */}
                <Dropdown.Section fluid>
                  {canEdit && <Dropdown.Item icon={<PenOneIcon color="var(--neutral-600)" />} label="Edit" onClick={pick(onEdit)} fluid />}
                  {canLeave && <Dropdown.Item icon={<UnlinkOneIcon color="var(--neutral-600)" />} label="Leave project" onClick={pick(onLeave)} fluid />}
                  {canDelete && (
                    <>
                      {(canEdit || canLeave) && <Divider decorative />}
                      <Dropdown.Item icon={<DeleteTwoIcon color="var(--red-500)" />} label="Delete" variant="danger" onClick={pick(onDelete)} fluid />
                    </>
                  )}
                </Dropdown.Section>
              </Dropdown>
            </Dropdown.Float>
          )}
          {shared && <IconButton variant="outline" size="md" icon={<ShareOneIcon animated />} aria-label="Sharing" onClick={onShare} />}
        </div>
      </div>

      {shared ? (
        ownerName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, marginBottom: project.description ? 6 : 0 }}>
            <span style={{ ...metaText, whiteSpace: 'nowrap' }}>
              Created by {ownerName} · {project.visibility === 'workspace' ? 'Workspace' : 'Shared'} Project
            </span>
          </div>
        )
      ) : (
        <p style={{ ...metaText, margin: 0, marginTop: 2, marginBottom: project.description ? 6 : 0 }}>Personal Project</p>
      )}

      {project.description && (
        <p style={{ width: '60%', fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-regular)', fontSize: '14px', lineHeight: '20px', color: 'var(--legacy-1a1714)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}>
          {project.description}
        </p>
      )}
    </div>
  )
}
