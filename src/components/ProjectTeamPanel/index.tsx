'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { useOrg } from '@/context/org-context'
import { listTeamEditors } from '@/lib/api/teams'
import type { TeamEditor } from '@/types/teams'
import { fetchPersonas, personasForTeamContext, usePersonaRepoDeduped, type Persona } from '@/lib/api/personas'
import { AGENT_CHAT_ROUTE } from '@/lib/routes'
import { ProjectMembersPanel } from '@/components/ProjectMembersPanel'

export interface ProjectTeamPanelProps {
  teamId: string
  projectId: string
  ownerUserId: string
  canEdit: boolean
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ padding: '12px 24px 10px' }}>
      <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
        {title}
      </p>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, lineHeight: '16px', color: 'var(--neutral-500)', margin: 0 }}>
        {subtitle}
      </p>
    </div>
  )
}

function EmptyRow({ text }: { text: string }) {
  return (
    <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-400)', margin: 0, padding: '2px 24px 16px' }}>
      {text}
    </p>
  )
}

export function ProjectTeamPanel({ teamId, projectId, ownerUserId, canEdit }: ProjectTeamPanelProps) {
  const { push } = useRouter()
  const { orgId } = useOrg()
  const [teamMembers, setTeamMembers] = useState<TeamEditor[]>([])
  const [membersLoading, setMembersLoading] = useState(true)
  const [agents, setAgents] = useState<Persona[]>([])
  const [agentsLoading, setAgentsLoading] = useState(true)
  const [usingId, setUsingId] = useState<string | null>(null)

  // Team-shared agents aren't owned by the member viewing this panel, so the
  // dedicated chat route 404s on them directly (chat creation is owner-only on
  // the backend). Clone into the member's own account first (deduped — repeat
  // clicks reuse the same copy, never pile up duplicates), then open its chat.
  async function handleUseAgent(agent: Persona) {
    setUsingId(agent.id)
    const toastId = toast.loading(`Opening "${agent.name}"…`)
    try {
      const copy = await usePersonaRepoDeduped(agent.id)
      toast.dismiss(toastId)
      push(AGENT_CHAT_ROUTE(copy.id))
    } catch {
      toast.dismiss(toastId)
      toast.error('Failed to open agent. Please try again.')
    } finally {
      setUsingId(null)
    }
  }

  useEffect(() => {
    if (!orgId) return
    let cancelled = false
    setMembersLoading(true)
    listTeamEditors(orgId, teamId)
      .then(editors => { if (!cancelled) setTeamMembers(editors) })
      .catch(console.error)
      .finally(() => { if (!cancelled) setMembersLoading(false) })
    return () => { cancelled = true }
  }, [orgId, teamId])

  useEffect(() => {
    let cancelled = false
    setAgentsLoading(true)
    fetchPersonas()
      .then(list => { if (!cancelled) setAgents(personasForTeamContext(list, teamId)) })
      .catch(() => { if (!cancelled) setAgents([]) })
      .finally(() => { if (!cancelled) setAgentsLoading(false) })
    return () => { cancelled = true }
  }, [teamId])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Team members */}
      <div style={{ backgroundColor: 'var(--neutral-50)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--neutral-200)' }}>
        <SectionHeader title="Team members" subtitle="Editors and members of this team." />
        {membersLoading && <EmptyRow text="Loading…" />}
        {!membersLoading && teamMembers.length === 0 && <EmptyRow text="No team members yet." />}
        {teamMembers.map(m => (
          <div
            key={m.userId}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 24px',
              borderTop: '1px solid var(--neutral-100)',
            }}
          >
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
        ))}
      </div>

      {/* Shared agents */}
      <div style={{ backgroundColor: 'var(--neutral-50)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--neutral-200)' }}>
        <SectionHeader title="Shared agents" subtitle="Agents shared with this team." />
        {agentsLoading && <EmptyRow text="Loading…" />}
        {!agentsLoading && agents.length === 0 && <EmptyRow text="No shared agents for this team." />}
        {agents.map(agent => (
          <div
            key={agent.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 24px',
              borderTop: '1px solid var(--neutral-100)',
            }}
          >
            {agent.imageUrl ? (
              <img
                src={agent.imageUrl}
                alt=""
                style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
              />
            ) : (
              <Avatar name={agent.name} size="sm" />
            )}
            <div style={{ minWidth: 0, flex: '1 0 0' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {agent.name}
              </p>
              {agent.description && (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, lineHeight: '16px', color: 'var(--neutral-500)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {agent.description}
                </p>
              )}
            </div>
            <Button
              size="sm"
              variant="secondary"
              loading={usingId === agent.id}
              disabled={usingId !== null && usingId !== agent.id}
              onClick={() => void handleUseAgent(agent)}
            >
              Use
            </Button>
          </div>
        ))}
      </div>

      {/* Project members (add/remove) */}
      {canEdit && (
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--neutral-200)' }}>
          <ProjectMembersPanel
            teamId={teamId}
            projectId={projectId}
            ownerUserId={ownerUserId}
          />
        </div>
      )}

    </div>
  )
}

export default ProjectTeamPanel
