'use client'

import React, { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowDownOneIcon,
  FilterMailIcon,
  PlusSignIcon,
  SearchOneIcon,
  UserIcon,
} from '@strange-huge/icons'
import { Badge, type BadgeColor } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Dropdown } from '@/components/Dropdown'
import { IconButton } from '@/components/IconButton'
import { InputField } from '@/components/InputField'
import { AppInviteModal } from '@/components/InviteModal'
import {
  SettingsTable,
  SettingsTableCell,
  SettingsTableHeader,
  SettingsTableHeaderCell,
  SettingsTableRow,
  SettingsTableToolbar,
} from '@/components/SettingsTable'
import { useOrg } from '@/context/org-context'
import type { InviteStatus, OrgMember, WorkspaceRole } from '@/types/teams'

const MEMBER_COLUMNS = '219px 222px 221px 202px'
const MEMBER_COLUMN_GAP = 64
const ROLE_OPTIONS: WorkspaceRole[] = ['member', 'editor', 'admin']

const ROLE_LABEL: Record<WorkspaceRole, string> = {
  admin:  'Admin',
  editor: 'Editor',
  member: 'Member',
}

const ROLE_BADGE_COLOR: Record<WorkspaceRole, BadgeColor> = {
  admin:  'Green',
  editor: 'Blue',
  member: 'Yellow',
}

const TEAM_MEMBER_ROWS = [
  { name: 'Chai Landge (you)', email: 'chai@acmeinc.com', role: 'admin' as WorkspaceRole, inviteStatus: 'signed_up' as InviteStatus },
  { name: 'Alex Rivera', email: 'alex@acmeinc.com', role: 'editor' as WorkspaceRole, inviteStatus: 'signed_up' as InviteStatus },
  { name: 'Jordan Kim', email: 'alex@acmeinc.com', role: 'member' as WorkspaceRole, inviteStatus: 'signed_up' as InviteStatus },
  { name: 'Sam Patel', email: 'sam@acmeinc.com', role: 'member' as WorkspaceRole, inviteStatus: 'invite_sent' as InviteStatus },
]

const TEAM_MEMBERSHIP = [
  { teamId: 'team_01', teamName: 'Marketing', isTeamOwner: true },
]

function Card({
  children,
  danger = false,
}: {
  children: React.ReactNode
  danger?: boolean
}) {
  return (
    <section
      style={{
        border:        `1px solid ${danger ? 'var(--red-400)' : 'var(--neutral-200)'}`,
        borderRadius:  16,
        boxShadow:     '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
        overflow:      'hidden',
        display:       'flex',
        flexDirection: 'column',
        gap:           12,
        padding:       '12px 0',
      }}
    >
      {children}
    </section>
  )
}

function CardHeader({
  title,
  subtitle,
  danger = false,
  compact = false,
}: {
  title: string
  subtitle?: string
  danger?: boolean
  compact?: boolean
}) {
  return (
    <div
      style={{
        padding:      compact ? '6px 24px 12px' : '12px 24px 24px',
        borderBottom: '1px solid var(--neutral-100)',
      }}
    >
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
    <div
      style={{
        width:           36,
        height:          36,
        borderRadius:    '50%',
        backgroundColor: 'var(--blue-600)',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        flexShrink:      0,
        boxShadow:       '0px 0px 0px 1px var(--blue-100)',
      }}
    >
      <UserIcon size={20} color="white" />
    </div>
  )
}

function InviteStatusBadge({ status }: { status: InviteStatus }) {
  if (status === 'signed_up') return null
  return <Badge label={status === 'invite_sent' ? 'Invite sent' : 'Not invited'} color="Neutral" />
}

function MemberCell({ member }: { member: OrgMember }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
      <MemberAvatar />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {member.name}
          </p>
          <InviteStatusBadge status={member.inviteStatus} />
        </div>
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-500)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {member.email}
        </p>
      </div>
    </div>
  )
}

function RoleControl({
  role,
  editable,
  onChange,
}: {
  role: WorkspaceRole
  editable: boolean
  onChange?: (role: WorkspaceRole) => void
}) {
  const [open, setOpen] = useState(false)

  if (!editable) {
    return <Badge label={ROLE_LABEL[role]} color={ROLE_BADGE_COLOR[role]} />
  }

  return (
    <Dropdown.Float
      open={open}
      onOpenChange={setOpen}
      placement="bottom-start"
      trigger={
        <Button size="sm" variant="secondary" rightIcon={<ArrowDownOneIcon size={16} />}>
          {ROLE_LABEL[role]}
        </Button>
      }
    >
      <Dropdown size="sm" style={{ minWidth: 140 }}>
        <Dropdown.Section fluid>
          {ROLE_OPTIONS.map(option => (
            <Dropdown.Item
              key={option}
              label={ROLE_LABEL[option]}
              selected={option === role}
              fluid
              onClick={() => {
                onChange?.(option)
                setOpen(false)
              }}
            />
          ))}
        </Dropdown.Section>
      </Dropdown>
    </Dropdown.Float>
  )
}

function TeamBadges({ member }: { member: OrgMember }) {
  if (member.teamMemberships.length === 0) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minWidth: 0, flexWrap: 'wrap' }}>
      {member.teamMemberships.map((team, index) => (
        <Badge
          key={team.teamId}
          label={`${team.isTeamOwner ? '★ ' : ''}${team.teamName}`}
          color={index % 2 === 0 ? 'Green' : 'Blue'}
        />
      ))}
    </div>
  )
}

function RedOutlineButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         '5px 8px',
        borderRadius:    8,
        border:          'none',
        cursor:          'pointer',
        backgroundColor: 'white',
        boxShadow:       '0px 1.091px 1.091px 0px rgba(24,2,2,0.05), 0px 1.455px 3.127px 0px rgba(24,2,2,0.15), 0px 0px 0px 1px var(--red-100), inset 0px -2.182px 0.364px 0px var(--red-100)',
        fontFamily:      'var(--font-body)',
        fontWeight:      500,
        fontSize:        14,
        lineHeight:      '22px',
        color:           'var(--red-700)',
        whiteSpace:      'nowrap',
      }}
    >
      {children}
    </button>
  )
}

function createDisplayMembers(source: OrgMember[]): OrgMember[] {
  return source.map((member, index) => {
    const row = TEAM_MEMBER_ROWS[index]
    if (!row) return member

    return {
      ...member,
      name:            row.name,
      email:           row.email,
      role:            row.role,
      inviteStatus:    row.inviteStatus,
      teamMemberships: index < 3 ? TEAM_MEMBERSHIP : [],
    }
  })
}

export default function TeamSettingsPage() {
  const params = useParams<{ teamId: string }>()
  const router = useRouter()
  const { teams, members } = useOrg()
  const team = teams.find(entry => entry.id === params.teamId)

  const [teamName, setTeamName] = useState(team?.name ?? '')
  const [teamDesc, setTeamDesc] = useState(team?.description ?? '')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [localMembers, setLocalMembers] = useState<OrgMember[]>(() => createDisplayMembers(members))

  if (!team) {
    return (
      <div style={{ flex: '1 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontFamily: 'var(--font-body)', color: 'var(--neutral-500)' }}>Team not found.</p>
      </div>
    )
  }

  const handleRoleChange = (memberId: string, role: WorkspaceRole) => {
    setLocalMembers(prev => prev.map(member => member.id === memberId ? { ...member, role } : member))
  }

  const handleRemove = (memberId: string) => {
    setLocalMembers(prev => prev.filter(member => member.id !== memberId))
  }

  const handleInvite = (email: string, role: WorkspaceRole) => {
    setLocalMembers(prev => [
      ...prev,
      {
        id:              `usr_new_${Date.now()}`,
        name:            email.split('@')[0] ?? email,
        email,
        role,
        inviteStatus:    'invite_sent',
        teamMemberships: [],
        creditUsed:      0,
      },
    ])
  }

  return (
    <div
      className="kaya-scrollbar"
      style={{
        flex:           '1 0 0',
        minHeight:      0,
        overflowY:      'auto',
        overflowX:      'hidden',
        display:        'flex',
        alignItems:     'flex-start',
        justifyContent: 'center',
        padding:        '96px 155px 48px',
      }}
    >
      <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 1114 }}>
        <div style={{ paddingLeft: 4, marginBottom: 4 }}>
          <button
            type="button"
            onClick={() => router.push('/settings/org/teams')}
            style={{
              display:         'inline-flex',
              alignItems:      'center',
              gap:             4,
              padding:         0,
              marginBottom:    4,
              border:          'none',
              background:      'transparent',
              cursor:          'pointer',
              fontFamily:      'var(--font-body)',
              fontWeight:      400,
              fontSize:        11,
              lineHeight:      '16px',
              color:           'var(--neutral-500)',
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
              <Button variant="default" size="sm">Save changes</Button>
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
              <Button variant="secondary" size="sm" leftIcon={<PlusSignIcon size={16} />} onClick={() => setInviteOpen(true)}>
                Invite members
              </Button>
            </div>
          </SettingsTableToolbar>

          <SettingsTableHeader columns={MEMBER_COLUMNS} columnGap={MEMBER_COLUMN_GAP}>
            <SettingsTableHeaderCell>Member</SettingsTableHeaderCell>
            <SettingsTableHeaderCell align="center">Role</SettingsTableHeaderCell>
            <SettingsTableHeaderCell align="center">Teams</SettingsTableHeaderCell>
            <SettingsTableHeaderCell align="center">Actions</SettingsTableHeaderCell>
          </SettingsTableHeader>

          {localMembers.map((member, index) => {
            const isCurrentUser = member.id === 'usr_01'

            return (
              <SettingsTableRow
                key={member.id}
                columns={MEMBER_COLUMNS}
                columnGap={MEMBER_COLUMN_GAP}
                divider={index < localMembers.length - 1}
              >
                <SettingsTableCell>
                  <MemberCell member={member} />
                </SettingsTableCell>
                <SettingsTableCell align="center">
                  <RoleControl
                    role={member.role}
                    editable={!isCurrentUser}
                    onChange={role => handleRoleChange(member.id, role)}
                  />
                </SettingsTableCell>
                <SettingsTableCell align="center">
                  <TeamBadges member={member} />
                </SettingsTableCell>
                <SettingsTableCell align="center">
                  {!isCurrentUser && (
                    <RedOutlineButton onClick={() => handleRemove(member.id)}>Remove</RedOutlineButton>
                  )}
                </SettingsTableCell>
              </SettingsTableRow>
            )
          })}
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
                  border:         'none',
                  background:     'transparent',
                  padding:        0,
                  cursor:         'pointer',
                  fontFamily:     'var(--font-body)',
                  fontWeight:     500,
                  fontSize:       14,
                  lineHeight:     '22px',
                  color:          'var(--neutral-900)',
                  textDecoration: 'underline',
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
                  This will archive the team and all its projects. Members can no longer access team content. You have 90 days to recover before permanent deletion.
                </p>
              </div>
              <RedOutlineButton>Archive</RedOutlineButton>
            </div>
          </div>

          <div style={{ padding: '6px 24px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24 }}>
              <div style={{ flex: '1 0 0', minWidth: 0 }}>
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
                  Delete team
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0, maxWidth: 395 }}>
                  Permanently delete this team, all teams, projects, and data. This cannot be undone.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                <InputField
                  value={deleteInput}
                  onChange={setDeleteInput}
                  placeholder='Type "Souvenir_Core" to confirm'
                />
                <RedOutlineButton>Delete workspace</RedOutlineButton>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <AppInviteModal
        isOpen={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvite={handleInvite}
      />
    </div>
  )
}
