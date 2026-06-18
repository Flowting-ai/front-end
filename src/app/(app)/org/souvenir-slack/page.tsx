'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ArrowDownOneIcon, CancelOneIcon, CheckmarkCircleTwoIcon, PlusSignIcon } from '@strange-huge/icons'
import { useOrg } from '@/context/org-context'
import { SlackConnectModal } from '@/components/SlackConnectModal'
import { getSlackStatus, listSlackChannels, setSlackChannelMapping, removeOrgSlackInstallation } from '@/lib/api/slack'
import type { SlackChannel, SlackStatus } from '@/lib/api/slack'
import { fetchProjects } from '@/lib/api/projects'
import type { ApiProjectSummary } from '@/lib/api/projects'

// ── Native select styled to match the Kaya design ───────────────────────────────

function Select({
  value,
  onChange,
  placeholder,
  options,
  disabled,
}: {
  value:       string
  onChange:    (v: string) => void
  placeholder: string
  options:     { value: string; label: string }[]
  disabled?:   boolean
}) {
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <select
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        style={{
          width:           '100%',
          height:          36,
          appearance:      'none',
          WebkitAppearance: 'none',
          MozAppearance:   'none',
          backgroundColor: 'white',
          borderRadius:    10,
          border:          'none',
          boxShadow:       '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-200)',
          padding:         '0 30px 0 10px',
          fontFamily:      'var(--font-body)',
          fontWeight:      400,
          fontSize:        14,
          lineHeight:      '22px',
          color:           value ? 'var(--neutral-900)' : 'var(--neutral-400)',
          cursor:          disabled ? 'not-allowed' : 'pointer',
          opacity:         disabled ? 0.6 : 1,
          outline:         'none',
        }}
      >
        <option value="">{placeholder}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', lineHeight: 0 }}>
        <ArrowDownOneIcon size={12} color="var(--neutral-400)" />
      </span>
    </div>
  )
}

// ── Private/Public toggle (UI-only — no backend field exists for this) ───────────

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      style={{
        width:           40,
        height:          22,
        borderRadius:    999,
        border:          'none',
        cursor:          'pointer',
        padding:         2,
        backgroundColor: on ? 'var(--blue-500, #3b82f6)' : 'var(--neutral-300)',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  on ? 'flex-end' : 'flex-start',
        transition:      'background-color 120ms',
        flexShrink:      0,
      }}
    >
      <span style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: 'white', boxShadow: '0px 1px 2px rgba(0,0,0,0.2)' }} />
    </button>
  )
}

const COL = {
  channel: '1.6fr',
  team:    '1.3fr',
  project: '1.3fr',
  toggle:  '0.9fr',
  actions: '0.7fr',
}
const GRID_COLS = `${COL.channel} ${COL.team} ${COL.project} ${COL.toggle} ${COL.actions}`

// ── Page ────────────────────────────────────────────────────────────────────────

export default function SouvenirSlackPage() {
  const { orgId, teams } = useOrg()

  const [statusLoading, setStatusLoading] = useState(true)
  const [status,        setStatus]        = useState<SlackStatus | null>(null)
  const [modalOpen,     setModalOpen]     = useState(false)

  const [channels,      setChannels]      = useState<SlackChannel[]>([])
  const [channelsLoading, setChannelsLoading] = useState(false)
  const [projects,      setProjects]      = useState<ApiProjectSummary[]>([])
  const [savingId,      setSavingId]      = useState<string | null>(null)
  const [removing,      setRemoving]      = useState(false)

  // UI-only state (no backend field): team selection + private/public per channel.
  const [teamByChannel,    setTeamByChannel]    = useState<Record<string, string>>({})
  const [publicByChannel,  setPublicByChannel]  = useState<Record<string, boolean>>({})

  const connected = status?.connected ?? false
  const teamName  = status?.workspaces[0]?.teamName ?? null

  // Load Slack connection status; open the connect dialog when not connected.
  const loadStatus = () => {
    setStatusLoading(true)
    getSlackStatus()
      .then(s => {
        setStatus(s)
        setModalOpen(!s.connected)
      })
      .catch(() => { setStatus({ connected: false, workspaces: [] }); setModalOpen(true) })
      .finally(() => setStatusLoading(false))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  useEffect(() => { loadStatus() }, [])

  // Once connected, load channels (mapping source of truth) + projects (dropdown).
  useEffect(() => {
    if (!orgId || !connected) return
    setChannelsLoading(true)
    listSlackChannels(orgId)
      .then(res => setChannels(res.channels))
      .catch(() => { /* nothing mapped yet */ })
      .finally(() => setChannelsLoading(false))
    fetchProjects()
      .then(setProjects)
      .catch(() => {})
  }, [orgId, connected])

  const handleProjectChange = async (channelId: string, projectId: string) => {
    if (!orgId) return
    setSavingId(channelId)
    try {
      const updated = await setSlackChannelMapping(orgId, channelId, projectId || null)
      setChannels(prev => prev.map(c => c.channelId === channelId ? updated : c))
      toast.success(projectId ? 'Channel mapped' : 'Mapping cleared')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save mapping')
    } finally {
      setSavingId(null)
    }
  }

  const handleRemoveSlack = async () => {
    if (!orgId || removing) return
    if (!window.confirm('Remove the Slack bot from this organization? It will be uninstalled from the workspace and all channel mappings stop working.')) return
    setRemoving(true)
    try {
      await removeOrgSlackInstallation(orgId)
      setChannels([])
      setStatus({ connected: false, workspaces: [] })
      toast.success('Slack removed from this organization')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove Slack')
    } finally {
      setRemoving(false)
    }
  }

  const projectOptions = projects.map(p => ({ value: p.id, label: p.title }))
  const teamOptions    = teams.map(t => ({ value: t.id, label: t.name }))

  return (
    <div
      className="kaya-scrollbar"
      style={{
        flex:       '1 0 0',
        minHeight:  0,
        overflowY:  'auto',
        overflowX:  'hidden',
        display:    'flex',
        justifyContent: 'center',
        padding:    '48px 24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 1100, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ flex: '1 0 0', minWidth: 0 }}>
            <h1 style={{
              fontFamily: 'var(--font-title)',
              fontWeight: 400,
              fontSize:   28,
              lineHeight: '36px',
              color:      'var(--neutral-900)',
              margin:     '0 0 4px',
            }}>
              Channel → Project mapping
            </h1>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              fontSize:   14,
              lineHeight: '22px',
              color:      'var(--neutral-500)',
              margin:     0,
            }}>
              Brain uses the mapped project context automatically in each channel.
            </p>
          </div>

          {connected && (
            <button
              type="button"
              onClick={handleRemoveSlack}
              disabled={removing}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 8, border: 'none',
                cursor: removing ? 'not-allowed' : 'pointer',
                backgroundColor: 'white', flexShrink: 0, opacity: removing ? 0.6 : 1,
                boxShadow: '0px 1px 1.5px 0px rgba(24,2,2,0.05), 0px 1px 2px 0px rgba(24,2,2,0.15), 0px 0px 0px 1px var(--red-200, #fecaca)',
                fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px',
                color: 'var(--red-600, #dc2626)',
              }}
            >
              <CancelOneIcon size={14} />
              {removing ? 'Removing…' : 'Disconnect Slack'}
            </button>
          )}
        </div>

        {/* ── Connected badge ── */}
        {connected && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
            padding: '4px 10px', borderRadius: 8,
            backgroundColor: 'var(--blue-100, #dbeafe)',
            boxShadow: '0px 0px 0px 1px var(--blue-200, #bfdbfe)',
          }}>
            <CheckmarkCircleTwoIcon size={14} color="var(--blue-600, #2563eb)" />
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, color: 'var(--blue-700, #1d4ed8)' }}>
              {teamName ? `Slack connected · ${teamName}` : 'Slack connected'}
            </span>
          </div>
        )}

        {/* ── States ── */}
        {statusLoading ? (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)' }}>Loading…</p>
        ) : !connected ? (
          <div style={{
            border: '1px solid var(--neutral-200)', borderRadius: 16, padding: '48px 24px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center',
          }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 500, color: 'var(--neutral-700)', margin: 0 }}>
              Slack isn’t connected yet
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-500)', margin: 0 }}>
              Connect your workspace to map channels to projects.
            </p>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              style={{
                marginTop: 4, padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
                backgroundColor: 'var(--neutral-900)', color: 'white',
                fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14,
              }}
            >
              Connect Slack workspace
            </button>
          </div>
        ) : (
          /* ── Mapping table ── */
          <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 16, overflow: 'hidden' }}>
            {/* Header row */}
            <div style={{
              display: 'grid', gridTemplateColumns: GRID_COLS, gap: 16,
              padding: '14px 20px', borderBottom: '1px solid var(--neutral-100)',
              backgroundColor: 'var(--neutral-50)',
            }}>
              {['Member Channel', 'Team', 'Project', 'Private/Public', 'Actions'].map((h, i) => (
                <span key={h} style={{
                  fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13,
                  color: 'var(--neutral-500)',
                  textAlign: i >= 3 ? 'center' : 'left',
                }}>
                  {h}
                </span>
              ))}
            </div>

            {/* Body */}
            {channelsLoading ? (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', padding: '20px' }}>Loading channels…</p>
            ) : channels.length === 0 ? (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', padding: '20px' }}>
                No channels yet. The bot picks up channels once it’s invited to them in Slack.
              </p>
            ) : channels.map(ch => (
              <div
                key={ch.channelId}
                style={{
                  display: 'grid', gridTemplateColumns: GRID_COLS, gap: 16, alignItems: 'center',
                  padding: '12px 20px', borderBottom: '1px solid var(--neutral-100)',
                  opacity: savingId === ch.channelId ? 0.6 : 1,
                }}
              >
                <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: 'var(--neutral-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  # {ch.channelName}
                </span>

                <Select
                  value={teamByChannel[ch.channelId] ?? ''}
                  onChange={v => setTeamByChannel(prev => ({ ...prev, [ch.channelId]: v }))}
                  placeholder="Select a team"
                  options={teamOptions}
                />

                <Select
                  value={ch.projectId ?? ''}
                  onChange={v => handleProjectChange(ch.channelId, v)}
                  placeholder="Select a project"
                  options={projectOptions}
                  disabled={savingId === ch.channelId}
                />

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <Toggle
                    on={publicByChannel[ch.channelId] ?? false}
                    onToggle={() => setPublicByChannel(prev => ({ ...prev, [ch.channelId]: !(prev[ch.channelId] ?? false) }))}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <button
                    type="button"
                    aria-label="Clear mapping"
                    disabled={savingId === ch.channelId || !ch.projectId}
                    onClick={() => handleProjectChange(ch.channelId, '')}
                    style={{
                      background: 'none', border: 'none', lineHeight: 0,
                      cursor: ch.projectId ? 'pointer' : 'default',
                      color: 'var(--red-500, #ef4444)', opacity: ch.projectId ? 1 : 0.35,
                    }}
                  >
                    <CancelOneIcon size={16} />
                  </button>
                </div>
              </div>
            ))}

            {/* Footer — add channel (channels sync from Slack automatically) */}
            <div style={{ padding: '12px 20px' }}>
              <button
                type="button"
                onClick={() => toast.info('Channels sync automatically once the bot is invited to them in Slack.')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  backgroundColor: 'var(--neutral-900)', color: 'white',
                  fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14,
                }}
              >
                <PlusSignIcon size={14} />
                Add channel
              </button>
            </div>
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
