'use client'

import React, { useState } from 'react'
import { ArrowLeftOneIcon, DeleteTwoIcon, PenOneIcon, UnlinkOneIcon } from '@strange-huge/icons'
import { useQuery } from '@tanstack/react-query'
import { BOX_STYLE, INPUT_STYLE } from '@/components/AgentEditor/styles'
import { Avatar } from '@/components/Avatar'
import { Badge } from '@/components/Badge'
import { ProjectMembersPanel } from '@/components/ProjectMembersPanel'
import { Skeleton } from '@/components/Skeleton'
import { Button, IconButton } from '@/components/ui/button'
import { useProjectsData } from '@/context/projects-context'
import { PROJECT_VISIBILITY_OPTIONS } from '@/lib/api/projects'
import type { Project } from '@/lib/projects/project-model'
import { projectMembersQuery } from '@/lib/projects/project-queries'

// Laid out like the Library's File info card: blocks split by hairlines, each with a label row,
// read-only details, and the actions pinned at the bottom while the blocks above scroll. Editing
// happens in the Edit dialog (the dark Edit button), as before.

const MUTED: React.CSSProperties = { fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-600)' }
const VALUE: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', overflowWrap: 'anywhere' }
const BLOCK: React.CSSProperties = { padding: '10px 4px' }
const DIVIDER: React.CSSProperties = { ...BLOCK, borderTop: '1px solid var(--border-default)' }
const PREVIEW_AVATARS = 5

/** "Oct 3, 2026, 3:42 PM" in the viewer's time zone: the backend sends full timestamps, so date, year and time. */
function fullDateTime(iso: string): string {
  const at = Date.parse(iso)
  if (Number.isNaN(at)) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    .format(at)
    .replace(/[  ]/g, ' ')
}
// Small grey field label, as above each value in File info's blocks.
const FIELD_LABEL: React.CSSProperties = { margin: 0, fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-600)' }

function BlockLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 6, fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)' }}>{children}</div>
  )
}

function Pair({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '88px minmax(0, 1fr)', gap: 12, padding: '4px 0' }}>
      <dt style={MUTED}>{name}</dt>
      <dd style={{ ...VALUE, margin: 0 }}>{children}</dd>
    </div>
  )
}

/** Members at a glance: a few faces, the count, and Manage (the full list is the sub-view). */
function MembersBlock({ project, onManage }: { project: Project; onManage: () => void }) {
  const membersQ = useQuery(projectMembersQuery(project.id))
  const members = membersQ.data ?? []
  const shown = members.slice(0, PREVIEW_AVATARS)
  const extra = members.length - shown.length
  return (
    <div style={DIVIDER}>
      <BlockLabel>Members</BlockLabel>
      {/* A card in two rows: faces left and the count right, then a full-width Manage members. */}
      <div style={{ ...BOX_STYLE, display: 'flex', flexDirection: 'column', gap: 10, padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 28 }}>
          {membersQ.isPending ? (
            <Skeleton height={28} width={120} radius={14} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
              {shown.map((member, i) => (
                <Avatar key={member.userId} name={member.name || member.email || member.userId} size="sm" title={member.name ?? member.email ?? undefined} style={{ marginLeft: i === 0 ? 0 : -6, boxShadow: '0 0 0 2px var(--field-surface)' }} />
              ))}
              {extra > 0 && <span style={{ ...MUTED, fontSize: 13, marginLeft: 6 }}>+{extra}</span>}
            </div>
          )}
          {!membersQ.isPending && (
            <span style={{ ...MUTED, fontSize: 13, whiteSpace: 'nowrap' }}>{members.length} {members.length === 1 ? 'member' : 'members'}</span>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Button variant="outline" size="sm" fluid onClick={onManage}>Manage members</Button>
        </div>
      </div>
    </div>
  )
}

/** The project's info in the right-hand panel, read-only like File info; Edit opens the Edit dialog. */
export function ProjectSettingsPanel({ project, ownerName, canEdit, canLeave, canDelete, canManageMembers, onEdit, onLeave, onDelete, onAddMember }: {
  project: Project
  /** Who made the project ('you' for the viewer). */
  ownerName: string | undefined
  canEdit: boolean
  canLeave: boolean
  canDelete: boolean
  canManageMembers: boolean
  onEdit: () => void
  onLeave: () => void
  onDelete: () => void
  onAddMember: () => void
}) {
  const [view, setView] = useState<'info' | 'members'>('info')
  const shared = project.visibility !== 'personal'
  const actionCount = [canEdit, canLeave, canDelete].filter(Boolean).length
  const visibility = PROJECT_VISIBILITY_OPTIONS.find(o => o.value === project.visibility)
  // The single-project response has no chat count (only the projects list does), so count the
  // chats this page has loaded and keep whichever number is larger.
  const { getChats } = useProjectsData()
  const chatCount = Math.max(project.chatCount, getChats(project.id).length)

  // Members sub-view: a back row (as the Agents panel's details view), then the full list.
  if (view === 'members') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconButton variant="ghost" size="sm" aria-label="Back to project settings" icon={<ArrowLeftOneIcon size={20} />} onClick={() => setView('info')} />
          <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)' }}>Members</span>
        </div>
        <div style={{ flex: '1 1 0', minHeight: 0 }}>
          <ProjectMembersPanel projectId={project.id} ownerUserId={project.ownerUserId} canManage={canManageMembers} onAddMember={onAddMember} />
        </div>
      </div>
    )
  }

  return (
    // The panel's full height: blocks scroll, Leave / Delete stay pinned at the bottom.
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="kaya-scrollbar kaya-no-gutter" style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', margin: '-12px -4px 0', padding: '0 4px' }}>
        {/* Name, description and tags, each labelled; the Edit button at the bottom changes them. */}
        <div style={BLOCK}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={FIELD_LABEL}>Name</span>
          </div>
          {/* Read-only fields: the same field box as the Edit dialog, disabled (Edit changes them). */}
          <div style={{ ...BOX_STYLE, padding: '8px 10px', marginTop: 6 }}>
            <input aria-label="Project name" value={project.name} disabled readOnly style={{ ...INPUT_STYLE, color: 'var(--neutral-800)', cursor: 'not-allowed' }} />
          </div>

          <p style={{ ...FIELD_LABEL, margin: '12px 0 0' }}>Description</p>
          <div style={{ ...BOX_STYLE, padding: '8px 10px', marginTop: 6 }}>
            <textarea
              aria-label="Project description"
              value={project.description}
              placeholder="No description."
              disabled
              readOnly
              rows={3}
              className="kaya-scrollbar"
              style={{ ...INPUT_STYLE, color: 'var(--neutral-800)', resize: 'none', display: 'block', cursor: 'not-allowed' }}
            />
          </div>

          <p style={{ ...FIELD_LABEL, margin: '12px 0 0' }}>Tags</p>
          {project.tags.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {project.tags.map(tag => <Badge key={tag.id} label={tag.label} color={tag.color} />)}
            </div>
          ) : (
            <p style={{ ...MUTED, margin: '2px 0 0' }}>No tags.</p>
          )}
        </div>

        {/* Details, as File info lists Type / Owner / Created / Size. */}
        <div style={DIVIDER}>
          <dl style={{ margin: 0 }}>
            <Pair name="Access">
              {visibility?.label}
              {visibility && <small style={{ display: 'block', fontSize: 12, lineHeight: '16px', color: 'var(--neutral-600)' }}>{visibility.description}</small>}
            </Pair>
            {ownerName && <Pair name="Owner">{ownerName === 'you' ? 'You' : ownerName}</Pair>}
            <Pair name="Contents">
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 1 }}>
                <Badge color="Neutral" label={`${chatCount} ${chatCount === 1 ? 'chat' : 'chats'}`} />
                <Badge color="Neutral" label={`${project.files.length} ${project.files.length === 1 ? 'file' : 'files'}`} />
              </span>
            </Pair>
            <Pair name="Created">{fullDateTime(project.createdAt)}</Pair>
            <Pair name="Updated">{fullDateTime(project.updatedAt)}</Pair>
          </dl>
        </div>

        {shared && <MembersBlock project={project} onManage={() => setView('members')} />}
      </div>

      {/* Actions stay pinned at the bottom; only the blocks above scroll. */}
      {/* Edit (dark, opens the Edit dialog), Leave and Delete as equal buttons. */}
      {actionCount > 0 && (
        <div style={{ flex: 'none', padding: '12px 4px 4px', borderTop: '1px solid var(--border-default)', display: 'grid', gridTemplateColumns: `repeat(${actionCount}, 1fr)`, gap: 8 }}>
          {canEdit && <Button variant="default" size="sm" fluid leftIcon={<PenOneIcon size={14} />} onClick={onEdit}>Edit</Button>}
          {canLeave && <Button variant="outline" size="sm" fluid leftIcon={<UnlinkOneIcon size={14} />} onClick={onLeave}>Leave</Button>}
          {canDelete && <Button variant="danger" size="sm" fluid leftIcon={<DeleteTwoIcon size={14} />} onClick={onDelete}>Delete</Button>}
        </div>
      )}
    </div>
  )
}
