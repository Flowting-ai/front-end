'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CancelOneIcon, CheckmarkCircleTwoIcon, PlusSignIcon } from '@strange-huge/icons'
import { useOrg } from '@/context/org-context'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { SettingsPageShell } from '@/components/SettingsPageShell'
import {
  SettingsTable,
  SettingsTableToolbar,
  SettingsTableHeader,
  SettingsTableHeaderCell,
  SettingsTableRow,
  SettingsTableCell,
  SettingsTableFooter,
} from '@/components/SettingsTable'
import { SlackConnectModal } from '@/components/SlackConnectModal'
import {
  createProjectSlackChannel,
  getOrgSlackStatus,
  getProjectSlackChannel,
  removeOrgSlackInstallation,
} from '@/lib/api/slack'
import type { SlackChannel, SlackStatus } from '@/lib/api/slack'
import { fetchProjects } from '@/lib/api/projects'
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

const SLACK_COLUMNS = 'minmax(200px, 1.4fr) minmax(200px, 1.4fr) minmax(170px, 220px) 130px'

function ProjectSlackRow({
  project,
  teamName,
  channel,
  creating,
  nameDraft,
  isPrivate,
  divider,
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
  divider: boolean
  onNameChange: (value: string) => void
  onPrivacyChange: (value: boolean) => void
  onCreate: () => void
}) {
  return (
    <SettingsTableRow minHeight={72} divider={divider} style={{ opacity: creating ? 0.6 : 1 }}>
      <SettingsTableCell>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {project.title}
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-400)', margin: '2px 0 0' }}>
            {teamName} / {project.documentCount} files / {project.chatCount} chats
          </p>
        </div>
      </SettingsTableCell>

      {channel ? (
        <>
          <SettingsTableCell>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              # {channel.channelName}
            </p>
          </SettingsTableCell>
          <SettingsTableCell>
            <Badge label={channel.isPrivate ? 'Private' : 'Public'} color={channel.isPrivate ? 'Neutral' : 'Blue'} />
          </SettingsTableCell>
          <SettingsTableCell align="end">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--green-600, #16a34a)' }}>
              <CheckmarkCircleTwoIcon size={18} color="var(--green-600, #16a34a)" />
              Connected
            </span>
          </SettingsTableCell>
        </>
      ) : (
        <>
          <SettingsTableCell>
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
          </SettingsTableCell>
          <SettingsTableCell>
            <ChannelTypeToggle isPrivate={isPrivate} disabled={creating} onChange={onPrivacyChange} />
          </SettingsTableCell>
          <SettingsTableCell align="end">
            <Button
              variant="default"
              size="sm"
              leftIcon={<PlusSignIcon size={16} />}
              disabled={creating || !nameDraft.trim()}
              loading={creating}
              onClick={onCreate}
            >
              Create
            </Button>
          </SettingsTableCell>
        </>
      )}
    </SettingsTableRow>
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
    if (!orgId) return
    setStatusLoading(true)
    getOrgSlackStatus(orgId)
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
    if (!orgReady || !orgId) return
    let cancelled = false
    getOrgSlackStatus(orgId)
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
  }, [orgId, orgReady, isAdmin])

  useEffect(() => {
    if (!orgId || !connected || !isAdmin) return
    const currentOrgId = orgId
    let cancelled = false

    async function loadProjectsAndChannels() {
      setProjectsLoading(true)
      try {
        const summaries = await fetchProjects()
        const rows = summaries.flatMap(summary => {
          return summary.teamId ? [{ ...summary, teamId: summary.teamId }] : []
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
            const channel = await getProjectSlackChannel(currentOrgId, project.id)
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
      const nextStatus = await getOrgSlackStatus(orgId)
      if (nextStatus.connected) {
        throw new Error('Slack is still connected. Please try disconnecting again.')
      }
      setChannelsByProject({})
      setStatus(nextStatus)
      setModalOpen(false)
      toast.success('Slack removed from this organization')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove Slack')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <SettingsPageShell
      title="Slack project channels"
      description="Create one Slack channel per project so Brain can use that project context automatically."
    >
      {connected && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, backgroundColor: 'var(--blue-100, #dbeafe)', boxShadow: '0px 0px 0px 1px var(--blue-200, #bfdbfe)' }}>
            <CheckmarkCircleTwoIcon size={14} color="var(--blue-600, #2563eb)" />
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, color: 'var(--blue-700, #1d4ed8)' }}>
              {teamName ? `Slack connected - ${teamName}` : 'Slack connected'} / {mappedCount} project channels
            </span>
          </div>
          {isAdmin && (
            <Button variant="danger" size="sm" leftIcon={<CancelOneIcon size={14} />} disabled={removing} loading={removing} onClick={handleRemoveSlack}>
              Disconnect Slack
            </Button>
          )}
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
          <Button variant="default" size="sm" style={{ marginTop: 4 }} onClick={() => setModalOpen(true)}>
            Connect Slack workspace
          </Button>
        </div>
      ) : (
        <SettingsTable columns={SLACK_COLUMNS} columnGap={0}>
          <SettingsTableToolbar title="Project channels" />
          <div style={{ overflowX: 'auto' }}>
            <div role="table" aria-label="Slack project channels" style={{ minWidth: 760 }}>
              <SettingsTableHeader>
                <SettingsTableHeaderCell>Project</SettingsTableHeaderCell>
                <SettingsTableHeaderCell>Slack channel</SettingsTableHeaderCell>
                <SettingsTableHeaderCell>Visibility</SettingsTableHeaderCell>
                <SettingsTableHeaderCell align="end">Action</SettingsTableHeaderCell>
              </SettingsTableHeader>

              {projectsLoading ? (
                <div style={{ padding: '24px', textAlign: 'center' }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>Loading projects...</p>
                </div>
              ) : projects.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center' }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>
                    {teams.length > 0
                      ? 'Your teams are available, but no projects are published to a team yet.'
                      : 'No teams are available yet. Create a team before adding Slack project channels.'}
                  </p>
                </div>
              ) : projects.map((project, index) => (
                <ProjectSlackRow
                  key={project.id}
                  project={project}
                  teamName={teams.find(team => team.id === project.teamId)?.name ?? 'Team project'}
                  channel={channelsByProject[project.id]}
                  creating={creatingId === project.id}
                  nameDraft={nameDrafts[project.id] ?? defaultChannelName(project.title)}
                  isPrivate={privateDrafts[project.id] ?? false}
                  divider={index < projects.length - 1}
                  onNameChange={value => setNameDrafts(prev => ({ ...prev, [project.id]: value }))}
                  onPrivacyChange={value => setPrivateDrafts(prev => ({ ...prev, [project.id]: value }))}
                  onCreate={() => void handleCreateChannel(project)}
                />
              ))}

              {!projectsLoading && projects.length > 0 && (
                <SettingsTableFooter style={{ borderTop: '1px solid var(--neutral-100)' }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-500)' }}>
                    {mappedCount} of {projects.length} project{projects.length === 1 ? '' : 's'} connected
                  </span>
                </SettingsTableFooter>
              )}
            </div>
          </div>
        </SettingsTable>
      )}

      <SlackConnectModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        orgId={orgId}
        onConnected={loadStatus}
      />
    </SettingsPageShell>
  )
}
