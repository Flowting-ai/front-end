'use client'

import React, { useEffect, useState } from 'react'
import { PlusSignIcon, ArrowDownOneIcon } from '@strange-huge/icons'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { Dropdown } from '@/components/Dropdown'
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
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    if (!orgId) return
    let cancelled = false
    Promise.all([
      listProjectMembers(orgId, teamId, projectId),
      listMembers(orgId),
      listTeamEditors(orgId, teamId),
    ])
      .then(([assigned, all, editors]) => {
        if (cancelled) return
        const editorIds = new Set(editors.map(editor => editor.userId))
        const eligibleIds = new Set(
          all
            .filter(member => (
              member.inviteStatus !== 'invite_sent'
              && member.orgRole !== 'owner'
              && member.orgRole !== 'admin'
              && member.id !== ownerUserId
              && !editorIds.has(member.id)
            ))
            .map(member => member.id),
        )
        setMembers(assigned.filter(member => eligibleIds.has(member.userId)))
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [orgId, teamId, projectId, ownerUserId])

  const handleOpenAdd = () => {
    if (!orgId) return
    setAddOpen(true)
    setPickerOpen(false)
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

  const selectedMember      = orgMembers.find(m => m.id === selected)
  const selectedMemberLabel = selectedMember ? (selectedMember.name || selectedMember.email) : 'Select member...'

  return (
    <div style={{ backgroundColor: 'var(--neutral-50)' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 24px 16px',
      }}>
        <div style={{ flex: '1 0 0', minWidth: 0 }}>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
            Project members
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, lineHeight: '16px', color: 'var(--neutral-500)', margin: 0 }}>
            Members assigned directly to this project.
          </p>
        </div>
        <Button variant="secondary" size="sm" leftIcon={<PlusSignIcon size={14} />} onClick={handleOpenAdd}>
          Add member
        </Button>
      </div>

      {addOpen && (
        <div style={{ padding: '12px 24px', borderTop: '1px solid var(--neutral-100)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {orgMembers.length === 0 ? (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: '22px', color: 'var(--neutral-400)', margin: 0 }}>
              Everyone eligible is already in this project.
            </p>
          ) : (
            <Dropdown.Float
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              placement="bottom-start"
              trigger={
                <Button variant="outline" fluid rightIcon={<ArrowDownOneIcon animated />}>
                  {selectedMemberLabel}
                </Button>
              }
            >
              <Dropdown>
                <Dropdown.Section>
                  <div
                    className="kaya-scrollbar"
                    style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 362, overflowY: 'auto', padding: 3 }}
                  >
                    {orgMembers.map(m => (
                      <Dropdown.Item
                        key={m.id}
                        label={m.name || m.email}
                        subLabel={m.name && m.email ? m.email : undefined}
                        selected={selected === m.id}
                        onClick={() => { setSelected(m.id); setPickerOpen(false) }}
                        fluid
                      />
                    ))}
                  </div>
                </Dropdown.Section>
              </Dropdown>
            </Dropdown.Float>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button size="sm" disabled={!selected || saving} onClick={handleAdd}>
              {saving ? 'Adding...' : 'Add member'}
            </Button>
          </div>
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(240px, 1fr) 140px',
        alignItems: 'center',
        padding: '4px 24px 8px',
        borderTop: '1px solid var(--neutral-100)',
      }}>
        <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)' }}>
          Member
        </span>
        <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', textAlign: 'right' }}>
          Actions
        </span>
      </div>

      {loading && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-400)', margin: 0, padding: '12px 24px 16px' }}>
          Loading members...
        </p>
      )}
      {!loading && members.length === 0 && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-400)', margin: 0, padding: '12px 24px 16px' }}>
          No project members yet.
        </p>
      )}
      {members.map(m => (
        <div key={m.userId} style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(240px, 1fr) 140px',
          alignItems: 'center',
          minHeight: 58,
          padding: '0 24px',
          borderTop: '1px solid var(--neutral-100)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <Avatar name={m.name || m.email || m.userId} size="sm" />
            <div style={{ minWidth: 0 }}>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.name ?? m.userId}
              </p>
              {m.email && (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, lineHeight: '16px', color: 'var(--neutral-500)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.email}
                </p>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="danger" size="sm" onClick={() => handleRemove(m.userId)}>
              Remove
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default ProjectMembersPanel
