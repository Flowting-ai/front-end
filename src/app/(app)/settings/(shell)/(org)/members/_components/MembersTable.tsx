'use client'

import { useDeferredValue, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SearchOneIcon, CancelCircleIcon, UserAddOneIcon } from '@strange-huge/icons'
import { Badge } from '@/components/Badge'
import { ROLE_LABEL } from '@/components/RoleBadge'
import { Button, IconButton } from '@/components/ui/button'
import { Avatar } from '@/components/Avatar'
import { InputField } from '@/components/InputField'
import { Tooltip } from '@/components/Tooltip'
import { SettingsTable, SettingsTableCell, SettingsTableHeader, SettingsTableHeaderCell, SettingsTableRow, SettingsTableToolbar } from '@/components/SettingsTable'
import type { OrgMember } from '@/types/teams'
import { displayRoleFor } from './members-shared'
import { RemoveButton, RoleDropdown } from './RoleControls'

// ── Members table ─────────────────────────────────────────────────────────────

// Member takes the room and truncates; role and actions are fixed and right-aligned, so the table
// never needs to scroll sideways at the settings page width.
export const WORKSPACE_MEMBER_COLUMNS = 'minmax(0, 1fr) 150px 130px'

export function MembersTable({
  members,
  isAdmin,
  currentUserEmail,
  loading,
  onManageRole,
  onRemove,
  onRevokeInvite,
  onInviteClick,
}: {
  members:              OrgMember[]
  isAdmin:              boolean
  /** Current user's email — used only to spot their own row for the sole-admin lock below. */
  currentUserEmail?:    string | null
  loading?:             boolean
  onManageRole:         (id: string, desiredOrgRole: 'admin' | 'member') => Promise<boolean>
  onRemove:             (id: string) => Promise<void>
  onRevokeInvite:       (id: string) => Promise<void>
  onInviteClick:        () => void
}) {
  const adminCount = members.filter(m => displayRoleFor(m) === 'admin').length
  const [searchQuery,   setSearchQuery]   = useState('')
  // Search starts collapsed to an icon button — matches the Pinboard panel's
  // search affordance (PinboardHeader): click to expand, an embedded icon
  // inside the field clears the query and collapses it back in one action.
  const [searchOpen,    setSearchOpen]    = useState(false)

  // Filtering follows a deferred copy of the query, so typing stays responsive in a large workspace.
  const normalizedQuery = useDeferredValue(searchQuery).trim().toLowerCase()
  const filteredMembers = normalizedQuery
    ? members.filter(member => (
        member.name.toLowerCase().includes(normalizedQuery)
        || member.email.toLowerCase().includes(normalizedQuery)
        || member.role.toLowerCase().includes(normalizedQuery)
        || member.orgRole.toLowerCase().includes(normalizedQuery)
        || member.teamMemberships.some(team => team.teamName.toLowerCase().includes(normalizedQuery))
      ))
    : members

  return (
    <SettingsTable columns={WORKSPACE_MEMBER_COLUMNS} columnGap={0}>
      <SettingsTableToolbar
        title="Team Members"
        style={{ flexWrap: 'wrap' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 12, maxWidth: '100%' }}>
          <Tooltip content="Search" disabled={searchOpen}>
            <div style={{ display: 'flex', alignItems: 'center', flex: searchOpen ? '1 0 160px' : undefined, minWidth: 0, maxWidth: searchOpen ? 260 : undefined }}>
              <AnimatePresence initial={false} mode="popLayout">
                {!searchOpen ? (
                  <motion.span
                    key="search-btn"
                    layout
                    initial={{ opacity: 0, y: 4, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transition: { type: 'spring', duration: 0.3, bounce: 0 } }}
                    exit={{ opacity: 0, scale: 0.25, filter: 'blur(4px)', transition: { type: 'spring', duration: 0.2, bounce: 0 } }}
                    style={{ display: 'inline-flex', flexShrink: 0 }}
                  >
                    <IconButton
                      variant="ghost"
                      size="sm"
                      icon={<SearchOneIcon size={20} />}
                      aria-label="Open search"
                      onClick={() => setSearchOpen(true)}
                    />
                  </motion.span>
                ) : (
                  <motion.div
                    key="search-input"
                    initial={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', transition: { type: 'spring', duration: 0.3, bounce: 0 } }}
                    exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)', transition: { duration: 0.15, ease: 'easeIn' } }}
                    style={{ flex: '1 0 0', minWidth: 0 }}
                  >
                    <InputField
                      label="Search members"
                      showLabel={false}
                      showSubtitle={false}
                      size="small"
                      fluid
                      leftIcon={<SearchOneIcon size={16} />}
                      rightIcon={
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label="Close search"
                          onClick={() => { setSearchOpen(false); setSearchQuery('') }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') { setSearchOpen(false); setSearchQuery('') }
                          }}
                          className="kds-icon-in-field"
                          style={{ display: 'inline-flex', cursor: 'pointer', lineHeight: 0 }}
                        >
                          <CancelCircleIcon size={16} />
                        </span>
                      }
                      placeholder="Search members"
                      value={searchQuery}
                      onChange={setSearchQuery}
                      // eslint-disable-next-line jsx-a11y/no-autofocus -- focus moves into search on user-triggered open
                      autoFocus
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Tooltip>
          {isAdmin && (
            <Button
              variant="secondary"
              size="sm"
              iconSize={20}
              leftIcon={<UserAddOneIcon animated size={20} />}
              onClick={onInviteClick}
            >
              Invite members
            </Button>
          )}
        </div>
      </SettingsTableToolbar>

      <div>
        <div role="table" aria-label="Workspace members">
          <SettingsTableHeader>
            <SettingsTableHeaderCell>Member</SettingsTableHeaderCell>
            <SettingsTableHeaderCell>Role</SettingsTableHeaderCell>
            <SettingsTableHeaderCell align="end">Actions</SettingsTableHeaderCell>
          </SettingsTableHeader>

          {loading ? (
            <div style={{ padding: '32px 24px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>
                Loading members…
              </p>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div style={{ padding: '32px 24px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>
                {members.length === 0 ? 'No members yet' : 'No members match your search'}
              </p>
            </div>
          ) : filteredMembers.map(member => {
            // Any admin can manage/remove any other member, admin or not —
            // the backend itself rejects an action that would drop the org
            // below one admin, so no client-side "protect one special member"
            // logic is needed here — EXCEPT for the sole admin's own row,
            // where we block it client-side too (see lockSelfDemotion below);
            // letting them open the menu and get rejected by the network
            // after confirming is worse than not opening it at all.
            const canManageRole = isAdmin && member.inviteStatus !== 'invite_sent'
            const canRemove = isAdmin && member.inviteStatus !== 'invite_sent'
            const isSelf = !!currentUserEmail && member.email === currentUserEmail
            const lockSelfDemotion = isSelf && displayRoleFor(member) === 'admin' && adminCount <= 1

            return (
              <SettingsTableRow
                key={member.id}
                minHeight={72}
              >
                <SettingsTableCell style={{ alignSelf: 'flex-start', paddingTop: 16, paddingBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <Avatar name={member.name || member.email} seed={member.id} size="md" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {member.name || member.email}
                        </span>
                        {isSelf && <Badge color="Blue" label="You" />}
                        {member.inviteStatus === 'invite_sent' && (
                          <Badge color="Yellow" label="Invite sent" />
                        )}
                      </div>
                      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-500)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {member.email}
                      </span>
                    </div>
                  </div>
                </SettingsTableCell>

                <SettingsTableCell style={{ alignSelf: 'center' }}>
                  {canManageRole ? (
                    <RoleDropdown member={member} onManageRole={onManageRole} lockSelfDemotion={lockSelfDemotion} />
                  ) : (
                    <Badge label={ROLE_LABEL[displayRoleFor(member)]} color="Neutral" />
                  )}
                </SettingsTableCell>

                <SettingsTableCell align="end" style={{ alignSelf: 'center' }}>
                  {canRemove && (
                    <RemoveButton
                      memberName={member.name || member.email}
                      onConfirm={() => onRemove(member.id)}
                    />
                  )}
                  {isAdmin && member.inviteStatus === 'invite_sent' && (
                    <RemoveButton
                      memberName={member.name || member.email}
                      label="Withdraw"
                      confirmLabel="Withdraw invite"
                      onConfirm={() => onRevokeInvite(member.id)}
                    />
                  )}
                </SettingsTableCell>
              </SettingsTableRow>
            )
          })}
        </div>
      </div>
    </SettingsTable>
  )
}
