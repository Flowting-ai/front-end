'use client'

import { Tooltip } from '@/components/Tooltip'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import Image from 'next/image'
import { PlusSignIcon, SearchOneIcon } from '@strange-huge/icons'
import { useAuth } from '@/context/auth-context'
import { Button } from '@/components/Button'
import { Switch } from '@/components/Switch'
import { fetchProjects, type ApiProjectSummary } from '@/lib/api/projects'
import {
  createSlackChannel,
  deleteProjectSlackChannel,
  getSlackAppConfig,
  getSlackChannelSettings,
  getSlackChannelSummary,
  listSlackChannels,
  renameProjectSlackChannel,
  updateSlackChannelSettings,
  type SlackChannelSettings,
  type SlackChannelSummary,
  type SlackWorkspaceChannel,
} from '@/lib/api/slack'
import { SlackAppPanel } from './SlackAppPanel'
import { SlackAutomationsPanel } from './SlackAutomationsPanel'
import { SlackConnectorsPanel } from './SlackConnectorsPanel'
import styles from './slack-config.module.css'

type Scope = { kind: 'default' } | { kind: 'new' } | { kind: 'channel'; id: string }

function defaultChannelName(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return slug || 'souvenir-project'
}

function ChannelTypeToggle({ isPrivate, onChange }: { isPrivate: boolean; onChange: (next: boolean) => void }) {
  return (
    <div className={styles.segmented}>
      {[
        { value: false, label: 'Public' },
        { value: true, label: 'Private' },
      ].map(option => {
        const active = isPrivate === option.value
        return (
          <button
            key={option.label}
            type="button"
            onClick={() => onChange(option.value)}
            className={`${styles.segment} ${active ? styles.segmentActive : ''}`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function AddChannelForm({
  orgId,
  projects,
  onCreated,
  onCancel,
}: {
  orgId: string
  projects: ApiProjectSummary[]
  onCreated: (channel: SlackWorkspaceChannel) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [projectId, setProjectId] = useState('')
  const [creating, setCreating] = useState(false)

  const pickProject = (id: string) => {
    setProjectId(id)
    const project = projects.find(p => p.id === id)
    if (project && !name.trim()) setName(defaultChannelName(project.title))
  }

  const create = async () => {
    if (!name.trim() || creating) return
    setCreating(true)
    try {
      const channel = await createSlackChannel(orgId, { name: name.trim(), isPrivate, projectId: projectId || null })
      toast.success('Slack channel created')
      onCreated(channel)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create Slack channel')
    } finally {
      setCreating(false)
    }
  }

  return (
    <section className={`${styles.newChannel} ${styles.stack}`}>
      <div className={styles.scopeHeader}>
        <h2 className={styles.scopeTitle}>Add a Slack channel</h2>
        <p className={styles.scopeDescription}>Create a channel for Souvenir and optionally attach project context.</p>
      </div>
      <input
        className={styles.field}
        type="text"
        aria-label="Channel name"
        placeholder="channel-name"
        value={name}
        onChange={event => setName(event.target.value)}
      />
      <ChannelTypeToggle isPrivate={isPrivate} onChange={setIsPrivate} />
      <select
        className={styles.field}
        aria-label="Project"
        value={projectId}
        onChange={event => pickProject(event.target.value)}
      >
        <option value="">No project</option>
        {projects.map(project => (
          <option key={project.id} value={project.id}>{project.title}</option>
        ))}
      </select>
      <p className={styles.sectionDescription}>
        A project channel carries that project&apos;s context into Slack. Your organization&apos;s members are invited.
      </p>
      <div className={styles.actions}>
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button variant="default" size="sm" loading={creating} disabled={!name.trim()} onClick={() => void create()}>
          Create
        </Button>
      </div>
    </section>
  )
}

function ChannelProjectCard({
  orgId,
  channel,
  onRenamed,
  onDeleted,
}: {
  orgId: string
  channel: SlackWorkspaceChannel & { projectId: string }
  onRenamed: (name: string) => void
  onDeleted: () => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const rename = async () => {
    if (draft === null || !draft.trim() || busy) return
    setBusy(true)
    try {
      const renamed = await renameProjectSlackChannel(orgId, channel.projectId, draft.trim())
      onRenamed(renamed.channelName)
      setDraft(null)
      toast.success('Slack channel renamed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to rename Slack channel')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (busy) return
    if (!window.confirm(`Archive #${channel.name}? It will be archived in Slack and unlinked from "${channel.projectTitle}".`)) return
    setBusy(true)
    try {
      await deleteProjectSlackChannel(orgId, channel.projectId)
      toast.success('Slack channel archived')
      onDeleted()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete Slack channel')
      setBusy(false)
    }
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionCopy}>
          <h3 className={styles.sectionTitle}>Linked project</h3>
          <p className={styles.sectionDescription}>
            Souvenir can use context from {channel.projectTitle} when it works in this channel.
          </p>
        </div>
      </div>
      {draft === null ? (
        <div className={styles.actions}>
          <Button variant="outline" size="sm" onClick={() => setDraft(channel.name)}>Rename channel</Button>
          <Button variant="ghost" size="sm" loading={busy} onClick={() => void remove()}>Archive channel</Button>
        </div>
      ) : (
        <div className={styles.projectMeta}>
          <input
            className={styles.field}
            type="text"
            aria-label="New channel name"
            value={draft}
            onChange={event => setDraft(event.target.value)}
            style={{ flex: 1 }}
          />
          <Button variant="default" size="sm" loading={busy} onClick={() => void rename()}>Save</Button>
          <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>Cancel</Button>
        </div>
      )}
    </section>
  )
}

/** The channel's own settings. Workspace-level instructions apply here too. */
function ChannelSettingsCard({ orgId, channelId }: { orgId: string; channelId: string }) {
  const [settings, setSettings] = useState<SlackChannelSettings | null>(null)
  const [inherited, setInherited] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([getSlackChannelSettings(orgId, channelId), getSlackAppConfig(orgId)])
      .then(([own, app]) => {
        if (cancelled) return
        setSettings(own)
        setInherited(app.prompt)
      })
      .catch(err => toast.error(err instanceof Error ? err.message : 'Failed to load channel settings'))
    return () => { cancelled = true }
  }, [orgId, channelId])

  const save = async (patch: Partial<SlackChannelSettings>) => {
    if (!settings) return
    setSaving(true)
    try {
      setSettings(await updateSlackChannelSettings(orgId, channelId, patch))
      toast.success('Channel saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save channel')
    } finally {
      setSaving(false)
    }
  }

  if (!settings) return <div className={`kaya-skeleton ${styles.skeleton}`} />

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionCopy}>
          <h3 className={styles.sectionTitle}>Respond in this channel</h3>
          <p className={styles.sectionDescription}>
            When off, Souvenir won&apos;t answer here. Direct messages aren&apos;t affected.
          </p>
        </div>
        <Switch
          aria-label="Souvenir answers in this channel"
          checked={settings.enabled}
          disabled={saving}
          onCheckedChange={enabled => void save({ enabled })}
        />
      </div>

      <div className={styles.subsection}>
        <h3 className={styles.sectionTitle}>Custom instructions</h3>
        <p className={styles.sectionDescription}>Add guidance that only applies in this channel.</p>
      </div>
      {inherited.trim() && (
        <p className={styles.inheritedCopy}>
          Inherited from workspace defaults: {inherited}
        </p>
      )}
      <textarea
        className={`${styles.field} ${styles.textarea}`}
        aria-label="Channel instructions"
        value={settings.instructions}
        onChange={event => setSettings({ ...settings, instructions: event.target.value })}
        placeholder="Instructions for this channel, added after workspace defaults"
        rows={5}
        style={{ marginTop: 12 }}
      />
      <div className={styles.actions}>
        <Button variant="default" size="sm" loading={saving} onClick={() => void save({ instructions: settings.instructions })}>
          Save instructions
        </Button>
      </div>
    </section>
  )
}

function ChannelSummaryCard({ orgId, channelId }: { orgId: string; channelId: string }) {
  const [summary, setSummary] = useState<SlackChannelSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getSlackChannelSummary(orgId, channelId)
      .then(next => { if (!cancelled) setSummary(next) })
      .catch(err => toast.error(err instanceof Error ? err.message : 'Failed to summarize the channel'))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [orgId, channelId])

  const asOf = summary
    ? new Date(summary.asOf).toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric' })
    : ''

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionCopy}>
          <h3 className={styles.sectionTitle}>Recent activity</h3>
          <p className={styles.sectionDescription}>A daily snapshot of recent conversation in this channel.</p>
        </div>
      </div>
      {loading
        ? <div className="kaya-skeleton" style={{ width: '100%', height: 72, borderRadius: 8, marginTop: 12 }} />
        : summary && (
          <>
            {summary.messageCount === 0
              ? <p className={styles.empty}>No messages before today.</p>
              : <p className={styles.summary}>
                  {summary.summary}
                </p>}
            <p className={styles.summaryMeta}>
              As of 00:00 UTC, {asOf}{summary.messageCount ? ` · last ${summary.messageCount} messages` : ''} · refreshes daily
            </p>
          </>
        )}
    </section>
  )
}

/** Claude Tag-style Slack config: workspace defaults, one channel's view, or a new channel. */
export function SlackWorkspaceConfig({ orgId, teamName }: { orgId: string; teamName: string | null }) {
  const { user } = useAuth()
  const currentUserId = user?.auth0Id ?? ''
  const [channels, setChannels] = useState<SlackWorkspaceChannel[]>([])
  const [projects, setProjects] = useState<ApiProjectSummary[]>([])
  const [scope, setScope] = useState<Scope>({ kind: 'default' })
  const [query, setQuery] = useState('')

  useEffect(() => {
    listSlackChannels(orgId)
      .then(setChannels)
      .catch(err => toast.error(err instanceof Error ? err.message : 'Failed to load channels'))
  }, [orgId])

  useEffect(() => {
    if (!currentUserId) return
    // Only Workspace/Shared projects can own a channel; a Personal project also
    // carries the org's teamId, so a bare teamId check would leak other members'
    // private projects into this admin list.
    fetchProjects(currentUserId)
      .then(rows => setProjects(rows.filter(p => p.teamId && p.visibility !== 'personal')))
      .catch(err => toast.error(err instanceof Error ? err.message : 'Failed to load projects'))
  }, [currentUserId])

  const channelNames = useMemo(
    () => Object.fromEntries(channels.map(channel => [channel.id, channel.name])),
    [channels],
  )
  const unboundProjects = projects.filter(p => !channels.some(c => c.projectId === p.id))
  const filtered = channels.filter(channel => channel.name.toLowerCase().includes(query.trim().toLowerCase()))
  const selected = scope.kind === 'channel' ? channels.find(c => c.id === scope.id) : undefined

  const updateChannel = (id: string, patch: Partial<SlackWorkspaceChannel>) =>
    setChannels(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)))

  return (
    <div className={styles.workspace}>
      <nav className={styles.rail} aria-label="Slack scopes">
        <button
          type="button"
          className={`${styles.railItem} ${scope.kind === 'default' ? styles.railItemActive : ''}`}
          onClick={() => setScope({ kind: 'default' })}
        >
          <span className={styles.railIcon}>
            <Image src="/icons/slack.svg" alt="" width={17} height={17} />
          </span>
          <span className={styles.railLabel}>Workspace defaults</span>
        </button>
        <div className={styles.searchWrap}>
          <SearchOneIcon className={styles.searchIcon} size={14} />
          <input
            className={styles.search}
            type="search"
            aria-label="Search channels"
            placeholder="Search channels"
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
        </div>
        <div className={styles.workspaceLabel}>
          <span className={styles.railLabel}>{teamName ?? 'Workspace'}</span>
          <Tooltip content="Add channel"><button
            className={styles.iconButton}
            type="button"
            aria-label="Add channel"
            onClick={() => setScope({ kind: 'new' })}
          >
            <PlusSignIcon size={14} />
          </button></Tooltip>
        </div>
        {filtered.map(channel => (
          <button
            key={channel.id}
            type="button"
            className={`${styles.railItem} ${scope.kind === 'channel' && scope.id === channel.id ? styles.railItemActive : ''}`}
            onClick={() => setScope({ kind: 'channel', id: channel.id })}
          >
            <span className={styles.railIcon} aria-hidden>{channel.isPrivate ? '🔒' : '#'}</span>
            <span className={styles.railLabel}>{channel.name}</span>
          </button>
        ))}
        {channels.length === 0 && (
          <p className={styles.emptyRail}>No channels you share with Souvenir yet.</p>
        )}
        {channels.length > 0 && filtered.length === 0 && (
          <p className={styles.emptyRail}>No matching channels.</p>
        )}
      </nav>

      <div className={styles.content}>
        <div className={styles.contentInner}>
        {scope.kind === 'default' && (
          <>
            <header className={styles.scopeHeader}>
              <h2 className={styles.scopeTitle}>Workspace defaults</h2>
              <p className={styles.scopeDescription}>
                Configure what Souvenir can access and how it behaves across every Slack channel.
              </p>
            </header>
            <SlackAppPanel orgId={orgId} />
            <SlackConnectorsPanel orgId={orgId} channelId={null} />
          </>
        )}
        {scope.kind === 'new' && (
          <AddChannelForm
            orgId={orgId}
            projects={unboundProjects}
            onCancel={() => setScope({ kind: 'default' })}
            onCreated={channel => {
              setChannels(prev => [...prev, channel].sort((a, b) => a.name.localeCompare(b.name)))
              setScope({ kind: 'channel', id: channel.id })
            }}
          />
        )}
        {selected && (
          <>
            <header className={styles.channelHeader}>
              <div className={styles.channelIdentity}>
                <span className={styles.channelMark} aria-hidden>#</span>
                <div>
                  <h2 className={styles.scopeTitle}>{selected.name}</h2>
                  <p className={styles.scopeDescription}>
                    Channel settings are applied after your workspace defaults.
                  </p>
                </div>
              </div>
              <div className={styles.channelMeta}>
                <span className={styles.metaPill}>{selected.isPrivate ? 'Private channel' : 'Public channel'}</span>
                {selected.projectTitle && <span className={styles.metaPill}>{selected.projectTitle}</span>}
              </div>
            </header>

            <div className={styles.channelGroups}>
              <div className={styles.channelGroup}>
                <div className={styles.groupHeader}>
                  <p className={styles.groupKicker}>Behavior</p>
                  <h3 className={styles.groupTitle}>How Souvenir works here</h3>
                  <p className={styles.groupDescription}>Control responses and add guidance specific to this channel.</p>
                </div>
                <ChannelSettingsCard key={`settings-${selected.id}`} orgId={orgId} channelId={selected.id} />
              </div>

              <div className={styles.channelGroup}>
                <div className={styles.groupHeader}>
                  <p className={styles.groupKicker}>Context &amp; access</p>
                  <h3 className={styles.groupTitle}>What Souvenir can use</h3>
                  <p className={styles.groupDescription}>Project context and connected accounts available in this channel.</p>
                </div>
                {selected.projectId ? (
                  <ChannelProjectCard
                    orgId={orgId}
                    channel={{ ...selected, projectId: selected.projectId }}
                    onRenamed={name => updateChannel(selected.id, { name })}
                    onDeleted={() => {
                      setChannels(prev => prev.filter(c => c.id !== selected.id))
                      setScope({ kind: 'default' })
                    }}
                  />
                ) : (
                  <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>Linked project</h3>
                    <p className={styles.sectionDescription}>No project context is attached to this channel.</p>
                  </section>
                )}
                <SlackConnectorsPanel key={`connectors-${selected.id}`} orgId={orgId} channelId={selected.id} />
              </div>

              <div className={styles.channelGroup}>
                <div className={styles.groupHeader}>
                  <p className={styles.groupKicker}>Activity</p>
                  <h3 className={styles.groupTitle}>What happens in this channel</h3>
                  <p className={styles.groupDescription}>Recent context and recurring work stay together here.</p>
                </div>
                <ChannelSummaryCard key={selected.id} orgId={orgId} channelId={selected.id} />
                <SlackAutomationsPanel orgId={orgId} channelId={selected.id} channelNames={channelNames} />
              </div>
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  )
}
