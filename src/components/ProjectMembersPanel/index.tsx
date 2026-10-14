'use client'

import React, { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PlusSignIcon, ManageTeamsIcon } from '@strange-huge/icons'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ConfirmModal'
import { toast } from 'sonner'
import { removeProjectMemberFromProject, type ApiProjectMember } from '@/lib/api/projects'
import { projectMembersQuery } from '@/lib/projects/project-queries'
import { queryKeys } from '@/lib/query-keys'

export interface ProjectMembersPanelProps {
  projectId:   string
  ownerUserId: string
  /** Whether the viewer can invite/remove members — the backend 404s these
   *  mutations for anyone but the project owner, so the controls are hidden
   *  entirely for everyone else rather than rendering a dead-end action. */
  canManage:   boolean
  /** Called when "Add member" is clicked. This panel no longer has its own
   *  inline add-member picker — adding now goes through the same Sharing
   *  modal the page's "Share" button opens, so this just asks the parent to
   *  open that instead of duplicating that flow here. */
  onAddMember?: () => void
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
  backgroundColor: 'var(--card-bg)',
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

export function ProjectMembersPanel({ projectId, ownerUserId, canManage, onAddMember }: ProjectMembersPanelProps) {
  // Shared query: ProjectAddMembersList invalidates it when someone is added.
  const queryClient = useQueryClient()
  const membersQ = useQuery(projectMembersQuery(projectId))
  const members = membersQ.data ?? []
  const loading = membersQ.isPending
  const [removeTarget, setRemoveTarget] = useState<ApiProjectMember | null>(null)

  useEffect(() => {
    if (membersQ.isError) toast.error('Failed to load project members')
  }, [membersQ.isError, membersQ.errorUpdatedAt])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
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
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setRemoveTarget(m)}
                      >
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

      {/* Add member — opens the project's Sharing modal (ProjectAddMembersList)
          instead of a separate inline picker here, so there's one add-member
          flow instead of two independently-maintained ones. */}
      {canManage && (
        <div style={{ paddingTop: 12, flexShrink: 0 }}>
          <Button variant="secondary" size="md" fluid leftIcon={<PlusSignIcon size={16} />} onClick={onAddMember}>
            Add member
          </Button>
        </div>
      )}

      {removeTarget && (
        <ConfirmModal
          title={`Remove ${removeTarget.name ?? removeTarget.email ?? 'this member'}?`}
          description="They'll lose access to this project immediately."
          confirmLabel="Remove"
          onConfirm={async () => {
            await removeProjectMemberFromProject(projectId, removeTarget.userId)
            queryClient.setQueryData<ApiProjectMember[]>(queryKeys.projectMembers(projectId), prev => prev?.filter(m => m.userId !== removeTarget.userId))
            void queryClient.invalidateQueries({ queryKey: queryKeys.projectMembers(projectId) })
            toast.success('Member removed from project')
          }}
          onClose={() => setRemoveTarget(null)}
        />
      )}
    </div>
  )
}

export default ProjectMembersPanel
