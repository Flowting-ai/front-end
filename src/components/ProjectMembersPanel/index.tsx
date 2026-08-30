'use client'

import React, { useEffect, useState } from 'react'
import { PlusSignIcon, ArrowDownOneIcon } from '@strange-huge/icons'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { Dropdown } from '@/components/Dropdown'
import { toast } from 'sonner'
import { useOrg } from '@/context/org-context'
import { listMembers } from '@/lib/api/organization'
import {
  fetchProjectMembers,
  inviteProjectMember,
  removeProjectMemberFromProject,
  type ApiProjectMember,
} from '@/lib/api/projects'
import type { OrgMember } from '@/types/teams'
import { SectionHeader, EmptyRow } from '@/components/shared/ProjectPanelSection'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ProjectMembersPanelProps {
  projectId:   string
  ownerUserId: string
  /** Whether the viewer can invite/remove members — the backend 404s these
   *  mutations for anyone but the project owner, so the controls are hidden
   *  entirely for everyone else rather than rendering a dead-end action. */
  canManage:   boolean
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ProjectMembersPanel({ projectId, ownerUserId, canManage }: ProjectMembersPanelProps) {
  const { orgId } = useOrg()
  const [members,    setMembers]    = useState<ApiProjectMember[]>([])
  const [loading,    setLoading]    = useState(true)
  const [addOpen,    setAddOpen]    = useState(false)
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([])
  const [selected,   setSelected]   = useState('')
  const [saving,     setSaving]     = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchProjectMembers(projectId)
      .then(list => {
        if (!cancelled) setMembers(list)
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load project members')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [projectId])

  const handleOpenAdd = () => {
    if (!orgId) return
    setAddOpen(true)
    setPickerOpen(false)
    const memberIds = new Set(members.map(m => m.userId))
    listMembers(orgId)
      .then(all => {
        setOrgMembers(all.filter(m => m.inviteStatus !== 'invite_sent' && !memberIds.has(m.id)))
      })
      .catch(() => toast.error('Failed to load workspace members'))
  }

  const handleAdd = async () => {
    if (!selected) return
    const candidate = orgMembers.find(m => m.id === selected)
    setSaving(true)
    try {
      await inviteProjectMember(projectId, selected)
      if (candidate) {
        setMembers(prev => [...prev, { userId: candidate.id, name: candidate.name, email: candidate.email }])
      }
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
    try {
      await removeProjectMemberFromProject(projectId, userId)
      setMembers(prev => prev.filter(m => m.userId !== userId))
      toast.success('Member removed from project')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove member')
    }
  }

  const selectedMember      = orgMembers.find(m => m.id === selected)
  const selectedMemberLabel = selectedMember ? (selectedMember.name || selectedMember.email) : 'Select member...'

  return (
    <div style={{ backgroundColor: 'var(--neutral-50)' }}>
      <SectionHeader
        title="Project members"
        subtitle="Given direct access to just this project."
        padding="12px 24px 16px"
        action={canManage ? (
          <Button variant="secondary" size="sm" leftIcon={<PlusSignIcon size={14} />} onClick={handleOpenAdd}>
            Add member
          </Button>
        ) : undefined}
      />

      {addOpen && canManage && (
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

      {loading && <EmptyRow text="Loading members..." padding="12px 24px 16px" />}
      {!loading && members.length === 0 && (
        <EmptyRow text="No project members yet." padding="12px 24px 16px" />
      )}
      {members.map(m => {
        const isOwner = m.userId === ownerUserId
        return (
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
              {isOwner ? (
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-500)' }}>Owner</span>
              ) : canManage ? (
                <Button variant="danger" size="sm" onClick={() => handleRemove(m.userId)}>
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default ProjectMembersPanel
