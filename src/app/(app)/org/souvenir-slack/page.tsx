'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CancelOneIcon, CheckmarkCircleTwoIcon, PlusSignIcon } from '@strange-huge/icons'
import { useOrg } from '@/context/org-context'
import { SlackConnectModal } from '@/components/SlackConnectModal'
import {
  createProjectSlackChannel,
  getProjectSlackChannel,
  getSlackStatus,
  removeOrgSlackInstallation,
} from '@/lib/api/slack'
import type { SlackChannel, SlackStatus } from '@/lib/api/slack'
import { fetchProject, fetchProjects } from '@/lib/api/projects'
import type { ApiProjectSummary } from '@/lib/api/projects'

type SlackProject = ApiProjectSummary & { teamId: string }

function defaultChannelName(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return slug || 'souvenir-project'
}

function ChannelTypeToggle({
  isPrivate,
  onChange,
  disabled,
}: {
  isPrivate: boolean
  onChange:  (next: boolean) => void
  disabled?: boolean
}) {
  return (
    <div style={{ display: 'inline-flex', gap: 4, padding: 3, borderRadius: 10, backgroundColor: 'var(--neutral-100)' }}>
      {[
        { value: false, label: 'Public' },
        { value: true, label: 'Private' },
      ].map(option => {
        const active = isPrivate === option.value
        return (
          <button
            key={option.label}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.value)}
            style={{
              height: 30,
              padding: '0 10px',
              borderRadius: 8,
              border: 'none',
              cursor: disabled ? 'not-allowed' : 'pointer',
              backgroundColor: active ? 'white' : 'transparent',
              boxShadow: active ? '0px 1px 1.5px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-200)' : 'none',
              color: active ? 'var(--neutral-900)' : 'var(--neutral-500)',
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              fontSize: 13,
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function ProjectSlackRow({
  project,
  teamName,
  channel,
  creating,
  nameDraft,
  isPrivate,
  onNameChange,
  onPrivacyChange,
  onCreate,
}: {
  project: SlackProject
  teamName: string
  channel: SlackChannel | null | undefined
  creating: boolean
  nameDraft: string
  isPrivate: boolean
  onNameChange: (value: string) => void
  onPrivacyChange: (value: boolean) => void
  onCreate: () => void
}) {
  return (
    <div
      style={{
        minWidth: 760,
        display: 'grid',
        gridTemplateColumns: 'minmax(180px, 1fr) minmax(180px, 1fr) minmax(190px, 250px) 120px',
        gap: 16,
        alignItems: 'center',
        padding: '14px 20px',
        borderBottom: '1px solid var(--neutral-100)',
        opacity: creating ? 0.6 : 1,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {project.title}
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-400)', margin: '2px 0 0' }}>
          {teamName} / {project.documentCount} files / {project.chatCount} chats
        </p>
      </div>

      {channel ? (
        <>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              # {channel.channelName}
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-400)', margin: '2px 0 0' }}>
              {channel.isPrivate ? 'Private channel' : 'Public channel'}
            </p>
          </div>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-500)' }}>
            Already connected
          </span>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <CheckmarkCircleTwoIcon size={18} color="var(--green-600, #16a34a)" />
          </div>
        </>
      ) : (
        <>
          <input
            type="text"
            value={nameDraft}
            disabled={creating}
            onChange={event => onNameChange(event.target.value)}
            placeholder="channel-name"
            style={{
              width: '100%',
              height: 36,
              border: 'none',
              borderRadius: 10,
              padding: '0 10px',
              backgroundColor: 'white',
              boxShadow: '0px 1px 1.5px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-200)',
              outline: 'none',
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              color: 'var(--neutral-900)',
            }}
          />
          <ChannelTypeToggle isPrivate={isPrivate} disabled={creating} onChange={onPrivacyChange} />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              disabled={creating || !nameDraft.trim()}
              onClick={onCreate}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                height: 36,
                padding: '0 12px',
                borderRadius: 10,
                border: 'none',
                cursor: creating || !nameDraft.trim() ? 'not-allowed' : 'pointer',
                backgroundColor: 'var(--neutral-900)',
                color: 'white',
                opacity: creating || !nameDraft.trim() ? 0.55 : 1,
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize: 13,
                whiteSpace: 'nowrap',
              }}
            >
              <PlusSignIcon size={14} />
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default function SouvenirSlackPage() {
  const { orgId, orgReady, orgRole, teams } = useOrg()

  const [statusLoading, setStatusLoading] = useState(true)
  const [status,        setStatus]        = useState<SlackStatus | null>(null)
  const [modalOpen,     setModalOpen]     = useState(false)

  const [projects,        setProjects]        = useState<SlackProject[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [channelsByProject, setChannelsByProject] = useState<Record<string, SlackChannel | null>>({})
  const [nameDrafts,      setNameDrafts]      = useState<Record<string, string>>({})
  const [privateDrafts,   setPrivateDrafts]   = useState<Record<string, boolean>>({})
  const [creatingId,      setCreatingId]      = useState<string | null>(null)
  const [removing,        setRemoving]        = useState(false)

  const isAdmin = orgRole === 'owner' || orgRole === 'admin'
  const connected = status?.connected ?? false
  const teamName  = status?.workspaces[0]?.teamName ?? null

  const loadStatus = () => {
    setStatusLoading(true)
    getSlackStatus()
      .then(s => {
        setStatus(s)
        setModalOpen(isAdmin && !s.connected)
      })
      .catch(() => {
        setStatus({ connected: false, workspaces: [] })
        setModalOpen(isAdmin)
      })
      .finally(() => setStatusLoading(false))
  }

  useEffect(() => {
    if (!orgReady) return
    let cancelled = false
    getSlackStatus()
      .then(s => {
        if (cancelled) return
        setStatus(s)
        setModalOpen(isAdmin && !s.connected)
      })
      .catch(() => {
        if (cancelled) return
        setStatus({ connected: false, workspaces: [] })
        setModalOpen(isAdmin)
      })
      .finally(() => {
        if (!cancelled) setStatusLoading(false)
      })
    return () => { cancelled = true }
  }, [orgReady, isAdmin])

  useEffect(() => {
    if (!orgId || !connected || !isAdmin) return
    const currentOrgId = orgId
    let cancelled = false

    async function loadProjectsAndChannels() {
      setProjectsLoading(true)
      try {
        const summaries = await fetchProjects()
        const details = await Promise.all(
          summaries.map(summary => fetchProject(summary.id).catch(() => null)),
        )
        const rows = summaries.flatMap((summary, index) => {
          const teamId = details[index]?.teamId
          return teamId ? [{ ...summary, teamId }] : []
        })
        if (cancelled) return
        setProjects(rows)
        setNameDrafts(prev => {
          const next = { ...prev }
          for (const project of rows) next[project.id] ??= defaultChannelName(project.title)
          return next
        })
        const entries = await Promise.all(
          rows.map(async project => {
            const channel = await getProjectSlackChannel(currentOrgId, project.id).catch(() => null)
            return [project.id, channel] as const
          }),
        )
        if (!cancelled) setChannelsByProject(Object.fromEntries(entries))
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load Slack projects')
      } finally {
        if (!cancelled) setProjectsLoading(false)
      }
    }

    void loadProjectsAndChannels()
    return () => { cancelled = true }
  }, [orgId, connected, isAdmin])

  const mappedCount = useMemo(
    () => Object.values(channelsByProject).filter(Boolean).length,
    [channelsByProject],
  )

  const handleCreateChannel = async (project: SlackProject) => {
    if (!orgId) return
    const name = (nameDrafts[project.id] ?? defaultChannelName(project.title)).trim()
    if (!name) return
    setCreatingId(project.id)
    try {
      const channel = await createProjectSlackChannel(orgId, project.id, {
        name,
        isPrivate: privateDrafts[project.id] ?? false,
      })
      setChannelsByProject(prev => ({ ...prev, [project.id]: channel }))
      toast.success('Slack channel created')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create Slack channel')
    } finally {
      setCreatingId(null)
    }
  }

  const handleRemoveSlack = async () => {
    if (!orgId || removing) return
    if (!window.confirm('Remove the Slack bot from this organization? It will be uninstalled from the workspace and all project channels stop working.')) return
    setRemoving(true)
    try {
      await removeOrgSlackInstallation(orgId)
      setChannelsByProject({})
      setStatus({ connected: false, workspaces: [] })
      setModalOpen(true)
      toast.success('Slack removed from this organization')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove Slack')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div
      className="kaya-scrollbar"
      style={{
        flex: '1 0 0',
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        display: 'flex',
        justifyContent: 'center',
        padding: '48px 24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 1100, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ flex: '1 0 0', minWidth: 0 }}>
            <h1 style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 28, lineHeight: '36px', color: 'var(--neutral-900)', margin: '0 0 4px' }}>
              Slack project channels
            </h1>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
              Create one Slack channel per project so Brain can use that project context automatically.
            </p>
          </div>

          {connected && isAdmin && (
            <button
              type="button"
              onClick={handleRemoveSlack}
              disabled={removing}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 8,
                border: 'none',
                cursor: removing ? 'not-allowed' : 'pointer',
                backgroundColor: 'white',
                flexShrink: 0,
                opacity: removing ? 0.6 : 1,
                boxShadow: '0px 1px 1.5px rgba(24,2,2,0.05), 0px 1px 2px rgba(24,2,2,0.15), 0px 0px 0px 1px var(--red-200, #fecaca)',
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize: 14,
                lineHeight: '22px',
                color: 'var(--red-600, #dc2626)',
              }}
            >
              <CancelOneIcon size={14} />
              {removing ? 'Removing...' : 'Disconnect Slack'}
            </button>
          )}
        </div>

        {connected && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', padding: '4px 10px', borderRadius: 8, backgroundColor: 'var(--blue-100, #dbeafe)', boxShadow: '0px 0px 0px 1px var(--blue-200, #bfdbfe)' }}>
            <CheckmarkCircleTwoIcon size={14} color="var(--blue-600, #2563eb)" />
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, color: 'var(--blue-700, #1d4ed8)' }}>
              {teamName ? `Slack connected - ${teamName}` : 'Slack connected'} / {mappedCount} project channels
            </span>
          </div>
        )}

        {!orgReady || statusLoading ? (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)' }}>Loading...</p>
        ) : !isAdmin ? (
          <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 16, padding: '48px 24px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 500, color: 'var(--neutral-700)', margin: 0 }}>
              Only workspace owners and admins can manage Slack.
            </p>
          </div>
        ) : !connected ? (
          <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 16, padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 500, color: 'var(--neutral-700)', margin: 0 }}>
              Slack is not connected yet
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-500)', margin: 0 }}>
              Connect your workspace before creating project channels.
            </p>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              style={{ marginTop: 4, padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', backgroundColor: 'var(--neutral-900)', color: 'white', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14 }}
            >
              Connect Slack workspace
            </button>
          </div>
        ) : (
          <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 16, overflowX: 'auto', overflowY: 'hidden' }}>
            <div style={{ minWidth: 760, display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) minmax(180px, 1fr) minmax(190px, 250px) 120px', gap: 16, padding: '14px 20px', borderBottom: '1px solid var(--neutral-100)', backgroundColor: 'var(--neutral-50)' }}>
              {['Project', 'Slack channel', 'Visibility', 'Action'].map((header, index) => (
                <span key={header} style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, color: 'var(--neutral-500)', textAlign: index === 3 ? 'right' : 'left' }}>
                  {header}
                </span>
              ))}
            </div>

            {projectsLoading ? (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', padding: '20px' }}>Loading projects...</p>
            ) : projects.length === 0 ? (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', padding: '20px' }}>
                No projects yet. Create a team project before adding Slack channels.
              </p>
            ) : projects.map(project => (
              <ProjectSlackRow
                key={project.id}
                project={project}
                teamName={teams.find(team => team.id === project.teamId)?.name ?? 'Team project'}
                channel={channelsByProject[project.id]}
                creating={creatingId === project.id}
                nameDraft={nameDrafts[project.id] ?? defaultChannelName(project.title)}
                isPrivate={privateDrafts[project.id] ?? false}
                onNameChange={value => setNameDrafts(prev => ({ ...prev, [project.id]: value }))}
                onPrivacyChange={value => setPrivateDrafts(prev => ({ ...prev, [project.id]: value }))}
                onCreate={() => void handleCreateChannel(project)}
              />
            ))}
          </div>
        )}
      </div>

      <SlackConnectModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConnected={loadStatus}
      />
    </div>
  )
}
