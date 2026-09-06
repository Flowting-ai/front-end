'use client'

import React, { useEffect, useState } from 'react'
import { ManageTeamsIcon } from '@strange-huge/icons'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { toast } from 'sonner'
import { useOrg } from '@/context/org-context'
import { listMembers } from '@/lib/api/organization'
import { fetchProjectMembers, inviteProjectMember } from '@/lib/api/projects'
import type { OrgMember } from '@/types/teams'

// The Sharing modal's job for a Shared project is purely "invite someone
// new" — viewing/removing the people already in the project is
// ProjectMembersPanel's job (the "Members" floating panel), so this only
// ever lists org members who AREN'T in the project yet, each with its own
// "Add to project" action. Same card shell + skeleton/empty-state
// conventions as ProjectMembersPanel, for a consistent look between the two
// member-related surfaces.

const ROW_CARD_STYLE: React.CSSProperties = {
  display:         'flex',
  alignItems:      'center',
  gap:             12,
  borderRadius:    16,
  padding:         12,
  backgroundColor: 'var(--neutral-white)',
  boxShadow:       '0px 2px 2.8px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-100)',
}

function MemberRowSkeleton() {
  return (
    <div aria-hidden style={ROW_CARD_STYLE}>
      <div className="kaya-skeleton" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <div className="kaya-skeleton" style={{ height: 14, width: '45%', borderRadius: 6 }} />
        <div className="kaya-skeleton" style={{ height: 11, width: '65%', borderRadius: 6 }} />
      </div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '32px 16px', textAlign: 'center' }}>
      <div
        aria-hidden
        style={{
          width: 48, height: 48, borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'var(--neutral-100)',
        }}
      >
        <ManageTeamsIcon size={22} color="var(--neutral-400)" />
      </div>
      <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', lineHeight: 'var(--line-height-caption)', color: 'var(--neutral-500)' }}>
        {text}
      </p>
    </div>
  )
}

export interface ProjectAddMembersListProps {
  projectId: string
  /** Called after a successful add — lets a parent (e.g. the Sharing modal)
   *  refresh anything else that depends on the project's member list. */
  onAdded?:  () => void
}

export function ProjectAddMembersList({ projectId, onAdded }: ProjectAddMembersListProps) {
  const { orgId } = useOrg()
  const [loading,  setLoading]  = useState(true)
  const [eligible, setEligible] = useState<OrgMember[]>([])
  const [addingId, setAddingId] = useState<string | null>(null)

  useEffect(() => {
    if (!orgId) { setLoading(false); return }
    let cancelled = false
    Promise.all([fetchProjectMembers(projectId), listMembers(orgId)])
      .then(([members, all]) => {
        if (cancelled) return
        const memberIds = new Set(members.map(m => m.userId))
        // Same filter ProjectMembersPanel's own add-picker uses: exclude
        // people already in the project, and org invites still pending
        // (not real members yet, so there's nothing to add).
        setEligible(all.filter(m => m.inviteStatus !== 'invite_sent' && !memberIds.has(m.id)))
      })
      .catch(() => { if (!cancelled) toast.error('Failed to load workspace members') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [projectId, orgId])

  const handleAdd = async (member: OrgMember) => {
    setAddingId(member.id)
    try {
      await inviteProjectMember(projectId, member.id)
      setEligible(prev => prev.filter(m => m.id !== member.id))
      toast.success(`${member.name || member.email} added to project`)
      onAdded?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to add ${member.name || member.email}`)
    } finally {
      setAddingId(null)
    }
  }

  return (
    <div
      className="kaya-scrollbar"
      // `minHeight: 0` is required here, not just on the flex-parent wrapper
      // in the Sharing modal — a flex item's default min-height is `auto`,
      // which lets it grow to fit all rows and push past the modal's fixed
      // height instead of clipping/scrolling internally.
      style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', height: '100%', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: 3 }}
    >
      {loading ? (
        Array.from({ length: 3 }).map((_, i) => <MemberRowSkeleton key={i} />)
      ) : eligible.length === 0 ? (
        <EmptyState text="Everyone in the workspace is already in this project." />
      ) : (
        eligible.map(m => (
          <div key={m.id} style={ROW_CARD_STYLE}>
            <Avatar name={m.name || m.email || m.id} size="sm" />
            <div style={{ minWidth: 0, flex: '1 0 0' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.name || m.email}
              </p>
              {m.name && m.email && (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, lineHeight: '16px', color: 'var(--neutral-500)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.email}
                </p>
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              loading={addingId === m.id}
              onClick={() => void handleAdd(m)}
            >
              Add to project
            </Button>
          </div>
        ))
      )}
    </div>
  )
}

export default ProjectAddMembersList
