'use client'

import React, { useEffect, useState } from 'react'
import { PlusSignIcon, ArrowDownOneIcon, ManageTeamsIcon } from '@strange-huge/icons'
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

export interface ProjectMembersPanelProps {
  projectId:   string
  ownerUserId: string
  /** Whether the viewer can invite/remove members — the backend 404s these
   *  mutations for anyone but the project owner, so the controls are hidden
   *  entirely for everyone else rather than rendering a dead-end action. */
  canManage:   boolean
}

// Same card shell PersonaCard/PersonaCardSkeleton use in the sibling Agents
// panel (AgentsPanel/index.tsx) — matching it here so the two panels people
// flip between in this same side-panel slot read as one system.
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

  const handleCancelAdd = () => {
    setAddOpen(false)
    setSelected('')
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Scrollable member list — same flush region + kaya-scrollbar treatment
          the sibling Agents panel uses for its own list. */}
      <div style={{ position: 'relative', flex: '1 1 0', minHeight: 0 }}>
        <div className="kaya-scrollbar" style={{ position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden', padding: 3 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <MemberRowSkeleton key={i} />)
            ) : members.length === 0 ? (
              <EmptyState text="No project members yet." />
            ) : (
              members.map(m => {
                const isOwner = m.userId === ownerUserId
                return (
                  <div key={m.userId} style={ROW_CARD_STYLE}>
                    <Avatar name={m.name || m.email || m.userId} size="sm" />
                    <div style={{ minWidth: 0, flex: '1 0 0' }}>
                      <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.name ?? m.userId}
                      </p>
                      {m.email && (
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, lineHeight: '16px', color: 'var(--neutral-500)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.email}
                        </p>
                      )}
                    </div>
                    {isOwner ? (
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-500)', flexShrink: 0 }}>Owner</span>
                    ) : canManage ? (
                      <Button variant="danger" size="sm" onClick={() => handleRemove(m.userId)}>
                        Remove
                      </Button>
                    ) : null}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Add-member — inline picker replaces the footer button while open,
          same footer position/weight as the sibling Agents panel's own
          Create New / Manage Agents row. */}
      {canManage && (
        addOpen ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 12, flexShrink: 0 }}>
            {orgMembers.length === 0 ? (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: '22px', color: 'var(--neutral-400)', margin: 0 }}>
                Everyone eligible is already in this project.
              </p>
            ) : (
              <Dropdown.Float
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                placement="top-start"
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
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="outline" size="md" fluid onClick={handleCancelAdd}>Cancel</Button>
              <Button size="md" fluid disabled={!selected || saving} onClick={handleAdd}>
                {saving ? 'Adding…' : 'Add member'}
              </Button>
            </div>
          </div>
        ) : (
          <div style={{ paddingTop: 12, flexShrink: 0 }}>
            <Button variant="secondary" size="md" fluid leftIcon={<PlusSignIcon size={16} />} onClick={handleOpenAdd}>
              Add member
            </Button>
          </div>
        )
      )}
    </div>
  )
}

export default ProjectMembersPanel
