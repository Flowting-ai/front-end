'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlusSignIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import {
  SettingsTable,
  SettingsTableCell,
  SettingsTableHeader,
  SettingsTableHeaderCell,
  SettingsTableRow,
  SettingsTableToolbar,
} from '@/components/SettingsTable'
import { useOrg } from '@/context/org-context'
import type { Team } from '@/types/teams'

const TEAM_COLUMNS = '177px 178px 178px 177px 178px 178px'
const TEAM_COLUMN_GAP = 0

function TeamNameCell({ team }: { team: Team }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p
        style={{
          fontFamily:   'var(--font-body)',
          fontWeight:   500,
          fontSize:     14,
          lineHeight:   '22px',
          color:        'var(--neutral-900)',
          margin:       0,
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
        }}
      >
        {team.name}
      </p>
      {team.description && (
        <p
          style={{
            fontFamily:   'var(--font-body)',
            fontWeight:   400,
            fontSize:     11,
            lineHeight:   '16px',
            color:        'var(--neutral-500)',
            margin:       0,
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}
        >
          {team.description}
        </p>
      )}
    </div>
  )
}

function TextPill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display:        'inline-flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        '5px 8px',
        borderRadius:   8,
        fontFamily:     'var(--font-body)',
        fontWeight:     500,
        fontSize:       14,
        lineHeight:     '22px',
        color:          'var(--neutral-700)',
        whiteSpace:     'nowrap',
      }}
    >
      {children}
    </span>
  )
}

export default function OrgTeamsPage() {
  const router = useRouter()
  const { teams: contextTeams, currentUserRole } = useOrg()
  const isAdmin = currentUserRole === 'admin'

  const [teams, setTeams] = useState<Team[]>(contextTeams)

  const activeTeams = teams.filter(team => team.status === 'active')

  const handleCreateTeam = () => {
    const team: Team = {
      id:          `team_new_${Date.now()}`,
      name:        'New team',
      description: 'Team description',
      status:      'active',
      memberCount: 1,
      owners:      [{ id: 'usr_01', name: 'Alex Rivera' }],
      projects:    [],
      creditUsed:  0,
      createdAt:   new Date().toISOString().split('T')[0] ?? '',
    }

    setTeams(prev => [...prev, team])
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
        padding:        '64px 24px 48px',
      }}
    >
      <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 1114 }}>
        <div style={{ paddingLeft: 4, marginBottom: 4, display: 'flex', alignItems: 'flex-end', gap: 12 }}>
          <div style={{ flex: '1 0 0', minWidth: 0 }}>
            <h1 style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
              Teams
            </h1>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
              Manage teams, membership, and projects within your workspace.
            </p>
          </div>
          {isAdmin && (
            <Button variant="default" size="sm" leftIcon={<PlusSignIcon size={16} />} onClick={handleCreateTeam}>
              Create new team
            </Button>
          )}
        </div>

        <SettingsTable>
          <SettingsTableToolbar title="Team Members">
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-500)', margin: 0 }}>
              {activeTeams.length} teams
            </p>
          </SettingsTableToolbar>

          <SettingsTableHeader
            columns={TEAM_COLUMNS}
            columnGap={TEAM_COLUMN_GAP}
            style={{ minHeight: 44, padding: '6px 24px 16px' }}
          >
            <SettingsTableHeaderCell>Team</SettingsTableHeaderCell>
            <SettingsTableHeaderCell align="center">Members</SettingsTableHeaderCell>
            <SettingsTableHeaderCell align="center">Owner</SettingsTableHeaderCell>
            <SettingsTableHeaderCell align="center">Projects</SettingsTableHeaderCell>
            <SettingsTableHeaderCell align="center">Credits used</SettingsTableHeaderCell>
            <SettingsTableHeaderCell>{null}</SettingsTableHeaderCell>
          </SettingsTableHeader>

          {activeTeams.map((team) => {
            const ownerName = 'Alex Rivera'
            const projectCount = team.projects.length || 2
            const creditsUsed = team.creditUsed || 24_800

            return (
              <SettingsTableRow
                key={team.id}
                columns={TEAM_COLUMNS}
                columnGap={TEAM_COLUMN_GAP}
                minHeight={72}
                divider
              >
                <SettingsTableCell>
                  <TeamNameCell team={team} />
                </SettingsTableCell>
                <SettingsTableCell align="center">
                  <TextPill>{team.memberCount}</TextPill>
                </SettingsTableCell>
                <SettingsTableCell align="center">
                  <TextPill>{ownerName}</TextPill>
                </SettingsTableCell>
                <SettingsTableCell align="center">
                  <TextPill>{projectCount}</TextPill>
                </SettingsTableCell>
                <SettingsTableCell align="center">
                  <TextPill>{creditsUsed.toLocaleString()}</TextPill>
                </SettingsTableCell>
                <SettingsTableCell align="end">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => router.push(`/settings/org/teams/${team.id}`)}
                  >
                    Team setting
                  </Button>
                </SettingsTableCell>
              </SettingsTableRow>
            )
          })}
        </SettingsTable>
      </div>
    </div>
  )
}
