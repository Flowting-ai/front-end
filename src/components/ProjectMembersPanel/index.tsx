'use client'

import React, { useEffect, useState } from 'react'
import { UserIcon, PlusSignIcon } from '@strange-huge/icons'
import { toast } from 'sonner'
import { useOrg } from '@/context/org-context'
import { listMembers } from '@/lib/api/organization'
import { listProjectMembers, addProjectMember, removeProjectMember, listTeamEditors, type ProjectMember } from '@/lib/api/teams'
import type { OrgMember } from '@/types/teams'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ProjectMembersPanelProps {
  teamId:      string
  projectId:   string
  ownerUserId: string
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ProjectMembersPanel({ teamId, projectId, ownerUserId }: ProjectMembersPanelProps) {
  const { orgId } = useOrg()
  const [members,    setMembers]    = useState<ProjectMember[]>([])
  const [loading,    setLoading]    = useState(true)
  const [addOpen,    setAddOpen]    = useState(false)
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([])
  const [selected,   setSelected]   = useState('')
  const [saving,     setSaving]     = useState(false)

  useEffect(() => {
    if (!orgId) return
    setLoading(true)
    listProjectMembers(orgId, teamId, projectId)
      .then(setMembers)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [orgId, teamId, projectId])

  const handleOpenAdd = () => {
    if (!orgId) return
    setAddOpen(true)
    const memberIds = new Set(members.map(m => m.userId))
    Promise.all([listMembers(orgId), listTeamEditors(orgId, teamId)])
      .then(([all, editors]) => {
        const editorIds = new Set(editors.map(editor => editor.userId))
        setOrgMembers(all.filter(m =>
          m.inviteStatus !== 'invite_sent' &&
          m.orgRole !== 'owner' &&
          m.orgRole !== 'admin' &&
          m.id !== ownerUserId &&
          !memberIds.has(m.id) &&
          !editorIds.has(m.id)
        ))
      })
      .catch(console.error)
  }

  const handleAdd = async () => {
    if (!orgId || !selected) return
    setSaving(true)
    try {
      const added = await addProjectMember(orgId, teamId, projectId, selected)
      setMembers(prev => [...prev, added])
      setSelected('')
      setAddOpen(false)
      toast.success('Member added to project')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add member')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (userId: string) => {
    if (!orgId) return
    try {
      await removeProjectMember(orgId, teamId, projectId, userId)
      setMembers(prev => prev.filter(m => m.userId !== userId))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove member')
    }
  }

  return (
    <div style={{
      border:        '1px solid var(--neutral-200)',
      borderRadius:  14,
      overflow:      'hidden',
      backgroundColor: 'white',
    }}>
      {/* Header */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '10px 14px',
        borderBottom:   '1px solid var(--neutral-100)',
      }}>
        <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, color: 'var(--neutral-800)' }}>
          Project members
        </span>
        <button
          type="button"
          onClick={handleOpenAdd}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '3px 8px', borderRadius: 6, border: '1px solid var(--neutral-200)',
            background: 'white', cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12, color: 'var(--neutral-700)',
          }}
        >
          <PlusSignIcon size={12} />
          Add
        </button>
      </div>

      {/* Add member form */}
      {addOpen && (
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--neutral-100)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {orgMembers.length === 0 ? (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-400)', margin: 0 }}>
              Everyone eligible is already in this project.
            </p>
          ) : (
            <select
              value={selected}
              onChange={e => setSelected(e.target.value)}
              style={{
                fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-900)',
                border: '1px solid var(--neutral-200)', borderRadius: 6,
                padding: '6px 10px', backgroundColor: 'white', width: '100%',
              }}
            >
              <option value="">Select member…</option>
              {orgMembers.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name || m.email}{m.name && m.email ? ` (${m.email})` : ''}
                </option>
              ))}
            </select>
          )}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setAddOpen(false)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--neutral-200)', background: 'white', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-700)' }}>
              Cancel
            </button>
            <button type="button" disabled={!selected || saving} onClick={handleAdd} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: !selected || saving ? 'var(--neutral-300)' : 'var(--neutral-900)', cursor: !selected || saving ? 'default' : 'pointer', fontFamily: 'var(--font-body)', fontSize: 12, color: 'white', fontWeight: 500 }}>
              {saving ? 'Adding…' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {/* Member list */}
      <div style={{ padding: '6px 0' }}>
        {loading && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-400)', margin: 0, padding: '8px 14px' }}>
            Loading…
          </p>
        )}
        {!loading && members.length === 0 && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-400)', margin: 0, padding: '8px 14px' }}>
            No members yet.
          </p>
        )}
        {members.map(m => (
          <div key={m.userId} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 14px',
          }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', backgroundColor: 'var(--blue-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <UserIcon size={14} color="var(--blue-600)" />
            </div>
            <div style={{ flex: '1 0 0', minWidth: 0 }}>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12, color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.name ?? m.userId}
              </p>
              {m.email && (
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, color: 'var(--neutral-500)', margin: 0 }}>
                  {m.email}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => handleRemove(m.userId)}
              style={{ padding: '2px 7px', borderRadius: 5, border: '1px solid var(--red-200)', background: 'white', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--red-700)', flexShrink: 0 }}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ProjectMembersPanel
