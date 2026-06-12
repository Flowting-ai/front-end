'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  FilterMailIcon,
  PlusSignIcon,
  SearchOneIcon,
  UserIcon,
} from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { InputField } from '@/components/InputField'
import {
  SettingsTable,
  SettingsTableCell,
  SettingsTableHeader,
  SettingsTableHeaderCell,
  SettingsTableRow,
  SettingsTableToolbar,
} from '@/components/SettingsTable'
import { useOrg } from '@/context/org-context'
import {
  getTeam,
  updateTeam,
  archiveTeam,
  deleteTeam,
  listTeamEditors,
  removeTeamEditor,
  inviteTeamMembers,
} from '@/lib/api/teams'
import type { Team, TeamEditor } from '@/types/teams'
import { toast } from 'sonner'

const EDITOR_COLUMNS = '1fr 1fr 160px'
const EDITOR_COLUMN_GAP = 0

// ── Sub-components ────────────────────────────────────────────────────────────

function Card({ children, danger = false }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <section style={{
      border:        `1px solid ${danger ? 'var(--red-400)' : 'var(--neutral-200)'}`,
      borderRadius:  16,
      boxShadow:     '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
      overflow:      'hidden',
      display:       'flex',
      flexDirection: 'column',
      gap:           12,
      padding:       '12px 0',
    }}>
      {children}
    </section>
  )
}

function CardHeader({ title, subtitle, danger = false, compact = false }: {
  title: string; subtitle?: string; danger?: boolean; compact?: boolean
}) {
  return (
    <div style={{ padding: compact ? '6px 24px 12px' : '12px 24px 24px', borderBottom: '1px solid var(--neutral-100)' }}>
      <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: danger ? 'var(--red-400)' : 'var(--neutral-900)', margin: 0 }}>
        {title}
      </p>
      {subtitle && (
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}

function MemberAvatar() {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      backgroundColor: 'var(--blue-600)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, boxShadow: '0px 0px 0px 1px var(--blue-100)',
    }}>
      <UserIcon size={20} color="white" />
    </div>
  )
}

function EditorCell({ editor }: { editor: TeamEditor }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
      <MemberAvatar />
      <div style={{ minWidth: 0 }}>
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {editor.name ?? editor.userId}
        </p>
        {editor.email && (
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-500)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {editor.email}
          </p>
        )}
      </div>
    </div>
  )
}

function RedOutlineButton({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        padding: '5px 8px', borderRadius: 8, border: 'none', cursor: disabled ? 'default' : 'pointer',
        backgroundColor: 'white', opacity: disabled ? 0.5 : 1,
        boxShadow: '0px 1.091px 1.091px 0px rgba(24,2,2,0.05), 0px 1.455px 3.127px 0px rgba(24,2,2,0.15), 0px 0px 0px 1px var(--red-100), inset 0px -2.182px 0.364px 0px var(--red-100)',
        fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px',
        color: 'var(--red-700)', whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

// ── Invite modal (inline, simple) ─────────────────────────────────────────────

function InvitePanel({ onInvite, onClose }: {
  onInvite: (emails: string[]) => Promise<void>
  onClose: () => void
}) {
  const [raw, setRaw] = useState('')
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    const emails = raw.split(/[\s,;]+/).map(e => e.trim()).filter(Boolean)
    if (!emails.length) return
    setSending(true)
    try {
      await onInvite(emails)
      setRaw('')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invites')
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ padding: '16px 24px', borderTop: '1px solid var(--neutral-100)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: 'var(--neutral-900)', margin: 0 }}>
        Invite members
      </p>
      <InputField
        value={raw}
        onChange={setRaw}
        placeholder="email@example.com, another@example.com"
        fluid
      />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="default" size="sm" disabled={!raw.trim() || sending} onClick={handleSend}>
          {sending ? 'Sending…' : 'Send invites'}
        </Button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TeamSettingsPage() {
  const params = useParams<{ teamId: string }>()
  const router = useRouter()
  const { orgId, refreshTeams } = useOrg()

  const [team, setTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)
  const [editors, setEditors] = useState<TeamEditor[]>([])
  const [editorsLoading, setEditorsLoading] = useState(true)

  const [teamName, setTeamName] = useState('')
  const [teamDesc, setTeamDesc] = useState('')
  const [saving, setSaving] = useState(false)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')

  useEffect(() => {
    if (!orgId || !params.teamId) return
    setLoading(true)
    getTeam(orgId, params.teamId)
      .then(t => {
        setTeam(t)
        setTeamName(t.name)
        setTeamDesc(t.description)
      })
      .catch(() => setTeam(null))
      .finally(() => setLoading(false))
  }, [orgId, params.teamId])

  useEffect(() => {
    if (!orgId || !params.teamId) return
    setEditorsLoading(true)
    listTeamEditors(orgId, params.teamId)
      .then(setEditors)
      .catch(console.error)
      .finally(() => setEditorsLoading(false))
  }, [orgId, params.teamId])

  const handleSave = async () => {
    if (!orgId || !team) return
    setSaving(true)
    try {
      const updated = await updateTeam(orgId, team.id, { name: teamName, description: teamDesc })
      setTeam(updated)
      refreshTeams()
      toast.success('Team updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update team')
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async () => {
    if (!orgId || !team) return
    try {
      await archiveTeam(orgId, team.id)
      refreshTeams()
      router.push('/settings/org/teams')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to archive team')
    }
  }

  const handleDelete = async () => {
    if (!orgId || !team || deleteInput !== team.name) return
    try {
      await deleteTeam(orgId, team.id)
      refreshTeams()
      router.push('/settings/org/teams')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete team')
    }
  }

  const handleRemoveEditor = async (memberId: string) => {
    if (!orgId || !team) return
    try {
      await removeTeamEditor(orgId, team.id, memberId)
      setEditors(prev => prev.filter(e => e.userId !== memberId))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove member')
    }
  }

  const handleInvite = async (emails: string[]) => {
    if (!orgId || !team) return
    await inviteTeamMembers(orgId, team.id, emails)
    toast.success(`Invite sent to ${emails.length} email${emails.length > 1 ? 's' : ''}`)
  }

  if (loading) {
    return (
      <div style={{ flex: '1 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontFamily: 'var(--font-body)', color: 'var(--neutral-500)' }}>Loading…</p>
      </div>
    )
  }

  if (!team) {
    return (
      <div style={{ flex: '1 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontFamily: 'var(--font-body)', color: 'var(--neutral-500)' }}>Team not found.</p>
      </div>
    )
  }

  return (
    <div
      className="kaya-scrollbar"
      style={{
        flex: '1 0 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '64px 24px 48px',
      }}
    >
      <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 1114 }}>
        <div style={{ paddingLeft: 4, marginBottom: 4 }}>
          <button
            type="button"
            onClick={() => router.push('/settings/org/teams')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: 0, marginBottom: 4, border: 'none', background: 'transparent',
              cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 400,
              fontSize: 11, lineHeight: '16px', color: 'var(--neutral-500)',
            }}
          >
            ← All teams
          </button>
          <h1 style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
            {team.name}
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
            Manage this team name, members, and settings.
          </p>
        </div>

        <Card>
          <CardHeader title="Team identity" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '6px 24px 12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <InputField label="Team name" value={teamName} onChange={setTeamName} fluid />
              <InputField label="Description" value={teamDesc} onChange={setTeamDesc} fluid />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="default" size="sm" disabled={saving} onClick={handleSave}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        </Card>

        <SettingsTable>
          <SettingsTableToolbar title="Team Members">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <IconButton variant="ghost" size="sm" aria-label="Search members" icon={<SearchOneIcon size={20} />} />
                <IconButton variant="ghost" size="sm" aria-label="Filter members" icon={<FilterMailIcon size={20} />} />
              </div>
              <Button variant="secondary" size="sm" leftIcon={<PlusSignIcon size={16} />} onClick={() => setInviteOpen(o => !o)}>
                Invite members
              </Button>
            </div>
          </SettingsTableToolbar>

          <SettingsTableHeader columns={EDITOR_COLUMNS} columnGap={EDITOR_COLUMN_GAP}>
            <SettingsTableHeaderCell>Member</SettingsTableHeaderCell>
            <SettingsTableHeaderCell>Email</SettingsTableHeaderCell>
            <SettingsTableHeaderCell align="center">Actions</SettingsTableHeaderCell>
          </SettingsTableHeader>

          {editorsLoading && (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>Loading members…</p>
            </div>
          )}

          {!editorsLoading && editors.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>No members yet.</p>
            </div>
          )}

          {editors.map((editor, index) => (
            <SettingsTableRow
              key={editor.userId}
              columns={EDITOR_COLUMNS}
              columnGap={EDITOR_COLUMN_GAP}
              divider={index < editors.length - 1}
            >
              <SettingsTableCell>
                <EditorCell editor={editor} />
              </SettingsTableCell>
              <SettingsTableCell>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-600)' }}>
                  {editor.email ?? '—'}
                </span>
              </SettingsTableCell>
              <SettingsTableCell align="center">
                <RedOutlineButton onClick={() => handleRemoveEditor(editor.userId)}>Remove</RedOutlineButton>
              </SettingsTableCell>
            </SettingsTableRow>
          ))}

          {inviteOpen && (
            <InvitePanel
              onInvite={handleInvite}
              onClose={() => setInviteOpen(false)}
            />
          )}
        </SettingsTable>

        <Card>
          <CardHeader
            title="Connector access"
            subtitle="Connector access is managed in Organization settings. All workspace connectors are available to all teams."
          />
          <div style={{ padding: '6px 24px 24px' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
              Manage connectors in{' '}
              <button
                type="button"
                onClick={() => router.push('/settings/org/connectors')}
                style={{
                  border: 'none', background: 'transparent', padding: 0, cursor: 'pointer',
                  fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px',
                  color: 'var(--neutral-900)', textDecoration: 'underline',
                }}
              >
                Organization → Connectors
              </button>
            </p>
          </div>
        </Card>

        <Card danger>
          <CardHeader title="Danger Zone" subtitle="Actions here are permanent and cannot be undone." danger compact />

          <div style={{ padding: '6px 24px 12px', borderBottom: '1px solid var(--neutral-100)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24 }}>
              <div style={{ flex: '1 0 0', minWidth: 0 }}>
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
                  Archive team
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
                  This will archive the team and all its projects. Members can no longer access team content.
                </p>
              </div>
              <RedOutlineButton onClick={handleArchive}>Archive</RedOutlineButton>
            </div>
          </div>

          <div style={{ padding: '6px 24px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24 }}>
              <div style={{ flex: '1 0 0', minWidth: 0 }}>
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
                  Delete team
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0, maxWidth: 395 }}>
                  Permanently delete this team and all its data. This cannot be undone.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                <InputField
                  value={deleteInput}
                  onChange={setDeleteInput}
                  placeholder={`Type "${team.name}" to confirm`}
                />
                <RedOutlineButton disabled={deleteInput !== team.name} onClick={handleDelete}>
                  Delete team
                </RedOutlineButton>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
