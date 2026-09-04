'use client'

import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SearchOneIcon, CancelCircleIcon, InformationCircleIcon, TickTwoIcon, UserAddOneIcon, ArrowDownOneIcon } from '@strange-huge/icons'
import { Badge } from '@/components/Badge'
import { RoleGlyph, ROLE_TOKENS, ROLE_LABEL } from '@/components/RoleBadge'
import { Button }           from '@/components/Button'
import { IconButton }       from '@/components/IconButton'
import { Avatar }           from '@/components/Avatar'
import { InputField }       from '@/components/InputField'
import { Dropdown, DropdownFloat } from '@/components/Dropdown'
import { DropdownMenuItem } from '@/components/DropdownMenuItem'
import { Tooltip }          from '@/components/Tooltip'
import { AppInviteModal, type InviteResult } from '@/components/InviteModal'
import {
  SettingsTable,
  SettingsTableCell,
  SettingsTableHeader,
  SettingsTableHeaderCell,
  SettingsTableRow,
  SettingsTableToolbar,
} from '@/components/SettingsTable'
import { toast }           from 'sonner'
import { useOrg }           from '@/context/org-context'
import { useAuth }          from '@/context/auth-context'
import { setMemberRole, removeMember, revokeInvite, getOrgSettings } from '@/lib/api/organization'
import { inviteMembers } from '@/lib/api/teams'
import { fetchProjects, type ApiProjectSummary } from '@/lib/api/projects'
import { updateUser } from '@/lib/api/user'
import type { OrgMember, WorkspaceRole } from '@/types/teams'

// ── Shadows ───────────────────────────────────────────────────────────────────
const SHADOW_CARD      = '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-200)'
const SHADOW_STAT_CARD = '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)'
const SHADOW_REMOVE    = '0px 1.091px 1.091px 0px rgba(24,2,2,0.05), 0px 1.455px 3.127px 0px rgba(24,2,2,0.15), 0px 0px 0px 1px var(--red-100)'
const SHADOW_REMOVE_INNER = 'inset 0px -2.182px 0.364px 0px var(--red-100)'

// ── Remove button (blur-swap animation) ───────────────────────────────────────

const REVEAL = { duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] as const }

function RemoveButton({
  memberName,
  onConfirm,
  label = 'Remove',
  confirmLabel = 'Confirm remove',
  icon,
}: {
  memberName:    string
  onConfirm:     () => void
  /** Idle button text (e.g. "Remove" or "Revoke"). */
  label?:        string
  /** Confirmation button text (e.g. "Confirm remove" or "Revoke invite"). */
  confirmLabel?: string
  /** Leading icon for the idle button. Defaults to the remove-user glyph. */
  icon?:         React.ReactNode
}) {
  const [hov,        setHov]        = React.useState(false)
  const [confirming, setConfirming] = React.useState(false)

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {!confirming ? (
        <motion.button
          key="remove"
          type="button"
          aria-label={`${label} ${memberName}`}
          onClick={() => setConfirming(true)}
          onMouseEnter={() => setHov(true)}
          onMouseLeave={() => setHov(false)}
          initial={{ opacity: 0, filter: 'blur(4px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)', transition: REVEAL }}
          exit={{    opacity: 0, filter: 'blur(4px)', transition: REVEAL }}
          style={{
            display:         'inline-flex', alignItems: 'center', gap: 2,
            padding:         '5px 8px', borderRadius: 8, border: 'none',
            cursor:          'pointer', position: 'relative', overflow: 'hidden',
            backgroundColor: hov ? 'var(--red-50)' : 'var(--neutral-white)',
            boxShadow:       SHADOW_REMOVE,
            fontFamily:      'var(--font-body)', fontWeight: 500,
            fontSize:        'var(--font-size-body)', color: 'var(--red-500)',
            whiteSpace:      'nowrap', outline: 'none', transition: 'background-color 120ms ease',
          }}
        >
          {icon ?? (
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M7 7.875a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM1.75 12.25c0-2.071 2.351-3.5 5.25-3.5M10.5 10.5l1.75 1.75M12.25 10.5L10.5 12.25" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
          {label}
          <span aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', boxShadow: SHADOW_REMOVE_INNER }} />
        </motion.button>
      ) : (
        <motion.div
          key="confirm"
          initial={{ opacity: 0, filter: 'blur(4px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)', transition: REVEAL }}
          exit={{    opacity: 0, filter: 'blur(4px)', transition: REVEAL }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
        >
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} style={{ flexShrink: 0 }}>
            Cancel
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setConfirming(false); onConfirm() }}
            style={{ color: 'var(--red-500)', flexShrink: 0 }}
          >
            {confirmLabel}
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Role column — inline dropdown (Figma 23:29029/23:29056: "Member ▾" per
// row, not a modal) ───────────────────────────────────────────────────────────
// Team has no backend route left at all, so a member's role is just the
// org-level owner/admin/member value.

function RoleDropdownTrigger({ label, disabled }: { label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      style={{
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'space-between',
        gap:             8,
        padding:         '5px 8px',
        borderRadius:    8,
        border:          'none',
        backgroundColor: 'var(--neutral-white)',
        boxShadow:       '0px 1.091px 1.091px 0px rgba(59,54,50,0.05), 0px 1.455px 3.127px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-100)',
        cursor:          disabled ? 'default' : 'pointer',
        opacity:         disabled ? 0.6 : 1,
        fontFamily:      'var(--font-body)',
        fontWeight:      500,
        fontSize:        14,
        lineHeight:      '22px',
        color:           'var(--neutral-700)',
        whiteSpace:      'nowrap',
      }}
    >
      {label}
      {!disabled && <ArrowDownOneIcon size={12} color="var(--neutral-400)" />}
    </button>
  )
}

// Editable dropdown for a manageable row — selecting "Member" on an Admin
// routes through the same downgrade confirmation the old modal had. Any admin
// can promote/demote any other member — the backend itself is the only real
// gate (rejects dropping the org below one admin).
function RoleDropdown({
  member,
  onManageRole,
}: {
  member:       OrgMember
  onManageRole: (id: string, desiredOrgRole: 'admin' | 'member') => Promise<boolean>
}) {
  const [open, setOpen] = useState(false)
  const [confirmDowngrade, setConfirmDowngrade] = useState(false)
  const [saving, setSaving] = useState(false)
  const currentRole: 'admin' | 'member' = displayRoleFor(member)
  const memberName = member.name || member.email

  const commit = async (next: 'admin' | 'member') => {
    if (next === currentRole || saving) return
    setSaving(true)
    await onManageRole(member.id, next)
    setSaving(false)
  }

  const options: { value: 'admin' | 'member'; label: string }[] =
    [{ value: 'admin', label: 'Admin' }, { value: 'member', label: 'Member' }]

  return (
    <>
      <DropdownFloat open={open} onOpenChange={setOpen} placement="bottom-start" offset={4} trigger={
        <RoleDropdownTrigger label={ROLE_LABEL[currentRole]} disabled={saving} />
      }>
        <Dropdown style={{ width: 140 }}>
          {options.map(o => (
            <DropdownMenuItem
              key={o.value}
              fluid
              label={o.label}
              selected={o.value === currentRole}
              icon={o.value === currentRole ? <TickTwoIcon size={14} /> : undefined}
              onClick={() => {
                setOpen(false)
                if (currentRole === 'admin' && o.value === 'member') { setConfirmDowngrade(true); return }
                void commit(o.value)
              }}
            />
          ))}
        </Dropdown>
      </DropdownFloat>

      {confirmDowngrade && (
        <ConfirmModal
          title="Remove Admin access?"
          description={
            <>This will demote <strong style={{ color: 'var(--neutral-700)' }}>{memberName}</strong> from Admin to Member, removing their organization-wide access.</>
          }
          confirmLabel="Demote to Member"
          onCancel={() => setConfirmDowngrade(false)}
          onConfirm={() => { setConfirmDowngrade(false); void commit('member') }}
        />
      )}
    </>
  )
}

// Small confirmation dialog — used by RoleDropdown's admin→member downgrade
// and by the Actions column's remove/withdraw confirmations.
function ConfirmModal({
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title:        string
  description:  React.ReactNode
  confirmLabel: string
  onCancel:     () => void
  onConfirm:    () => void
}) {
  // Same mousedown+click double-check as ManageRoleModal's own backdrop — a
  // layout shift between press and release shouldn't be able to misfire this.
  const backdropMouseDown = useRef(false)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position:        'fixed',
        inset:           0,
        zIndex:          400,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        backgroundColor: 'rgba(0,0,0,0.35)',
      }}
      onMouseDown={(e) => { backdropMouseDown.current = e.target === e.currentTarget }}
      onClick={(e) => {
        if (backdropMouseDown.current && e.target === e.currentTarget) onCancel()
        backdropMouseDown.current = false
      }}
    >
      <div
        style={{
          width:           400,
          maxWidth:        'calc(100vw - 32px)',
          borderRadius:    20,
          backgroundColor: 'var(--neutral-white)',
          border:          '1px solid var(--neutral-200)',
          boxShadow:       '0px 8px 32px rgba(0,0,0,0.12)',
          overflow:        'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '24px 24px 16px' }}>
          <h2 style={{ fontFamily: 'var(--font-title)', fontWeight: 500, fontSize: 20, lineHeight: '28px', color: 'var(--neutral-900)', margin: 0 }}>
            {title}
          </h2>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: '4px 0 0' }}>
            {description}
          </p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '20px 24px 24px' }}>
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          <Button variant="danger" size="sm" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  )
}

// ── Members table ─────────────────────────────────────────────────────────────

const WORKSPACE_MEMBER_COLUMNS = 'minmax(260px, 1.25fr) minmax(320px, 1.5fr) 150px'

function MembersTable({
  members,
  isAdmin,
  loading,
  onManageRole,
  onRemove,
  onRevokeInvite,
  onInviteClick,
}: {
  members:              OrgMember[]
  isAdmin:              boolean
  loading?:             boolean
  onManageRole:         (id: string, desiredOrgRole: 'admin' | 'member') => Promise<boolean>
  onRemove:             (id: string) => void
  onRevokeInvite:       (id: string) => void
  onInviteClick:        () => void
}) {
  const [searchQuery,   setSearchQuery]   = useState('')
  // Search starts collapsed to an icon button — matches the Pinboard panel's
  // search affordance (PinboardHeader): click to expand, an embedded icon
  // inside the field clears the query and collapses it back in one action.
  const [searchOpen,    setSearchOpen]    = useState(false)

  const normalizedQuery = searchQuery.trim().toLowerCase()
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

      <div className="kaya-scrollbar" style={{ overflowX: 'auto' }}>
        <div role="table" aria-label="Workspace members" style={{ minWidth: 900 }}>
          <SettingsTableHeader>
            <SettingsTableHeaderCell>Member</SettingsTableHeaderCell>
            <SettingsTableHeaderCell align="center">Role</SettingsTableHeaderCell>
            <SettingsTableHeaderCell align="center">Actions</SettingsTableHeaderCell>
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
            // logic is needed here.
            const canManageRole = isAdmin && member.inviteStatus !== 'invite_sent'
            const canRemove = isAdmin && member.inviteStatus !== 'invite_sent'

            return (
              <SettingsTableRow
                key={member.id}
                minHeight={72}
              >
                <SettingsTableCell style={{ alignSelf: 'flex-start', paddingTop: 16, paddingBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <Avatar name={member.name || member.email} size="md" style={{ fontSize: 16 }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {member.name || member.email}
                        </span>
                        {member.inviteStatus === 'invite_sent' && (
                          <Badge color="Neutral" label="Invite sent" />
                        )}
                      </div>
                      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-500)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {member.email}
                      </span>
                    </div>
                  </div>
                </SettingsTableCell>

                <SettingsTableCell align="center" style={{ alignSelf: 'center' }}>
                  {canManageRole ? (
                    <RoleDropdown member={member} onManageRole={onManageRole} />
                  ) : (
                    <Badge label={ROLE_LABEL[displayRoleFor(member)]} color="Neutral" />
                  )}
                </SettingsTableCell>

                <SettingsTableCell align="center" style={{ alignSelf: 'center' }}>
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

// ── Roles & Permissions modal ──────────────────────────────────────────────────
// Triggered by the info button next to the "Members" page title, rather than
// a standalone card in the page flow.

const ROLES_INFO = [
  { role: 'admin'  as const, description: 'Full organization control, including billing, payment methods, invoices, subscriptions, and topup credit purchases. Any number of admins per org, all equal.' },
  { role: 'member' as const, description: 'Baseline access through assigned projects. Cannot change organization settings or manage other members.' },
]

// Badge diameter — same size for all four levels; the rail (connecting line +
// ordering) carries the hierarchy, not badge scale.
const ROLE_STACK_BADGE_SIZE = 36
const ROLE_STACK_RAIL_WIDTH = ROLE_STACK_BADGE_SIZE

function RolesPermissionsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Same mousedown+click double-check as ManageRoleModal's own backdrop.
  const backdropMouseDown = useRef(false)
  const [detailOpen, setDetailOpen] = useState(false)

  if (!open) return null

  return (
    <>
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Roles & Permissions"
      style={{
        position:        'fixed',
        inset:           0,
        zIndex:          300,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        backgroundColor: 'rgba(0,0,0,0.35)',
      }}
      onMouseDown={(e) => { backdropMouseDown.current = e.target === e.currentTarget }}
      onClick={(e) => {
        if (backdropMouseDown.current && e.target === e.currentTarget) onClose()
        backdropMouseDown.current = false
      }}
    >
      <div
        style={{
          width:           640,
          maxWidth:        'calc(100vw - 32px)',
          maxHeight:       'calc(100vh - 64px)',
          borderRadius:    20,
          backgroundColor: '#f9f5f1',
          border:          '1px solid var(--neutral-200)',
          boxShadow:       '0px 8px 32px rgba(0,0,0,0.12)',
          overflow:        'hidden',
          display:         'flex',
          flexDirection:   'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '24px 24px 16px' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-title)', fontWeight: 500, fontSize: 20, lineHeight: '28px', color: 'var(--neutral-900)', margin: 0 }}>
              Roles &amp; Permissions
            </h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: '4px 0 0' }}>
              Default behavior for new projects and chats across the workspace.
            </p>
          </div>
          <IconButton variant="ghost" size="sm" aria-label="Close" icon={<CancelCircleIcon size={18} />} onClick={onClose} />
        </div>

        {/* Hierarchical stack, highest role first — a vertical timeline (rail +
            circular badges, all the same size) connecting the four roles top
            to bottom; ordering and copy carry the hierarchy. The connector
            between two badges is a flex-grown div, so it always fills exactly
            the gap between them with no manual pixel math. */}
        <div className="kaya-scrollbar" style={{ overflowY: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', padding: '4px 24px 24px' }}>
            {ROLES_INFO.map((item, i) => {
              const tokens = ROLE_TOKENS[item.role]
              const badgeSize = ROLE_STACK_BADGE_SIZE
              const isLast = i === ROLES_INFO.length - 1
              return (
                <div
                  key={item.role}
                  style={{ display: 'flex', gap: 14 }}
                >
                  {/* Rail column — badge, then a connector filling the rest of this row's height */}
                  <div style={{ width: ROLE_STACK_RAIL_WIDTH, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                      flexShrink:      0,
                      width:           badgeSize,
                      height:          badgeSize,
                      borderRadius:    '50%',
                      display:         'flex',
                      alignItems:      'center',
                      justifyContent:  'center',
                      backgroundColor: tokens.bg,
                      boxShadow:       tokens.shadow,
                      color:           tokens.text,
                    }}>
                      <RoleGlyph role={item.role} size={Math.round(badgeSize * 0.5)} />
                    </div>
                    {!isLast && (
                      <div aria-hidden style={{ width: 2, flex: '1 0 0', marginTop: 4, backgroundColor: 'var(--neutral-200)' }} />
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 4, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <p style={{
                        margin:     0,
                        fontFamily: 'var(--font-title)',
                        fontWeight: 400,
                        fontSize:   20,
                        lineHeight: '24px',
                        color:      tokens.text,
                      }}>
                        {ROLE_LABEL[item.role]}
                      </p>
                      {(i === 0 || isLast) && (
                        <span style={{
                          fontFamily: 'var(--font-body)',
                          fontWeight: 500,
                          fontSize:   'var(--font-size-caption)',
                          color:      'var(--neutral-400)',
                        }}>
                          {i === 0 ? 'Highest access' : 'Lowest access'}
                        </span>
                      )}
                    </div>
                    <p style={{
                      margin:     0,
                      fontFamily: 'var(--font-body)',
                      fontWeight: 400,
                      fontSize:   'var(--font-size-body)',
                      lineHeight: 'var(--line-height-body)',
                      color:      'var(--neutral-600)',
                    }}>
                      {item.description}
                    </p>
                    {/* Gap to the next role — lives in the text column (not row
                        padding/margin) so the rail's flex-grown connector, which
                        stretches to match this column's full height, threads
                        through it and reaches the next badge with no gap in the line. */}
                    {!isLast && <div style={{ height: 20 }} />}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '16px 24px 24px' }}>
          <Button variant="secondary" size="sm" onClick={() => setDetailOpen(true)}>
            View in detail
          </Button>
        </div>
      </div>
    </div>

    <RoleComparisonModal open={detailOpen} onClose={() => setDetailOpen(false)} />
    </>
  )
}

// ── Role comparison table ──────────────────────────────────────────────────────
// Rows mirror the actual capability ladder in src/lib/roles.ts (itself a mirror
// of the backend's services/organizations/roles.py) — not a separate marketing
// description of the roles, so this can't drift from what the roles actually do.

const ROLE_COMPARISON_COLUMNS = ROLES_INFO.map(r => r.role)
const ROLE_COMPARISON_GRID_COLUMNS = 'minmax(200px, 1fr) repeat(2, 84px)'

const ROLE_CAPABILITIES: { label: string; grants: Record<'admin' | 'member', boolean> }[] = [
  {
    label: 'Access assigned projects',
    grants: { admin: true, member: true },
  },
  {
    label: 'Full access to every project org-wide',
    grants: { admin: true, member: false },
  },
  {
    label: 'Manage the org: invites, members, roles, connectors',
    grants: { admin: true, member: false },
  },
  {
    label: 'Manage billing: plans, top-ups, invoices, payment method',
    grants: { admin: true, member: false },
  },
]

function RoleComparisonModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const backdropMouseDown = useRef(false)

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Role comparison"
      style={{
        position:        'fixed',
        inset:           0,
        zIndex:          400,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        backgroundColor: 'rgba(0,0,0,0.35)',
      }}
      onMouseDown={(e) => { backdropMouseDown.current = e.target === e.currentTarget }}
      onClick={(e) => {
        if (backdropMouseDown.current && e.target === e.currentTarget) onClose()
        backdropMouseDown.current = false
      }}
    >
      <div
        style={{
          width:           720,
          maxWidth:        'calc(100vw - 32px)',
          maxHeight:       'calc(100vh - 64px)',
          borderRadius:    20,
          backgroundColor: 'var(--neutral-white)',
          border:          '1px solid var(--neutral-200)',
          boxShadow:       '0px 8px 32px rgba(0,0,0,0.12)',
          overflow:        'hidden',
          display:         'flex',
          flexDirection:   'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '24px 24px 16px' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-title)', fontWeight: 500, fontSize: 20, lineHeight: '28px', color: 'var(--neutral-900)', margin: 0 }}>
              Role comparison
            </h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: '4px 0 0' }}>
              What each role can do, side by side.
            </p>
          </div>
          <IconButton variant="ghost" size="sm" aria-label="Close" icon={<CancelCircleIcon size={18} />} onClick={onClose} />
        </div>

        {/* Table */}
        <div className="kaya-scrollbar" style={{ overflowX: 'auto', overflowY: 'auto', paddingBottom: 24 }}>
          {/* Horizontal padding lives on this inner wrapper, not the
              scrolling element above — keeps the scrollbar flush with the
              modal's edge. */}
          <div style={{ padding: '0 24px' }}>
          <div style={{ minWidth: 640 }}>
            {/* Column header — role icon + name, same colors as the stack above */}
            <div style={{ display: 'grid', gridTemplateColumns: ROLE_COMPARISON_GRID_COLUMNS, gap: 8, padding: '8px 0' }}>
              <div />
              {ROLE_COMPARISON_COLUMNS.map(role => {
                const tokens = ROLE_TOKENS[role]
                return (
                  <div key={role} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <span style={{ display: 'inline-flex', color: tokens.text }}>
                      <RoleGlyph role={role} size={18} />
                    </span>
                    <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, color: tokens.text }}>
                      {ROLE_LABEL[role]}
                    </p>
                  </div>
                )
              })}
            </div>

            <div style={{ height: 1, backgroundColor: 'var(--neutral-200)' }} />

            {/* Capability rows */}
            {ROLE_CAPABILITIES.map((cap, i) => (
              <div
                key={cap.label}
                style={{
                  display:             'grid',
                  gridTemplateColumns: ROLE_COMPARISON_GRID_COLUMNS,
                  gap:                 8,
                  alignItems:          'center',
                  padding:             '12px 0',
                  borderBottom:        i < ROLE_CAPABILITIES.length - 1 ? '1px solid var(--neutral-100)' : 'none',
                }}
              >
                <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 13, lineHeight: '18px', color: 'var(--neutral-700)' }}>
                  {cap.label}
                </p>
                {ROLE_COMPARISON_COLUMNS.map(role => (
                  <div key={role} style={{ display: 'flex', justifyContent: 'center' }}>
                    {cap.grants[role]
                      ? <TickTwoIcon size={16} color="var(--green-600)" />
                      : <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-300)' }}>–</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonBlock({ width = '100%', height, radius = 8 }: { width?: string | number; height: number; radius?: number }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'linear-gradient(90deg, var(--neutral-100) 25%, var(--neutral-50) 50%, var(--neutral-100) 75%)',
      backgroundSize: '200% 100%',
      animation: 'membersSkeletonShimmer 1.4s ease-in-out infinite',
      flexShrink: 0,
    }} />
  )
}

function MembersPageSkeleton() {
  return (
    <>
      <style>{`@keyframes membersSkeletonShimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
      <div style={{ width: '100%', maxWidth: 1008, padding: '0 24px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Page header — h1/subtitle left, "Roles & Permissions" button right */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SkeletonBlock width={120} height={28} radius={6} />
            <SkeletonBlock width={320} height={14} radius={4} />
          </div>
          <SkeletonBlock width={170} height={32} radius={8} />
        </div>

        {/* Stats row */}
        <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 16, boxShadow: SHADOW_CARD, padding: 12, display: 'flex', gap: 9 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ flex: '1 0 0', minWidth: 0, backgroundColor: 'var(--neutral-white)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 6, boxShadow: SHADOW_STAT_CARD }}>
              <SkeletonBlock width={90} height={13} radius={4} />
              <SkeletonBlock width={40} height={28} radius={6} />
              <SkeletonBlock width={100} height={12} radius={4} />
            </div>
          ))}
        </div>

        {/* Members table skeleton */}
        <div style={{ borderRadius: 16, border: '1px solid var(--neutral-200)', backgroundColor: '#f9f5f1', boxShadow: SHADOW_CARD, overflow: 'hidden', width: '100%' }}>
          {/* Toolbar — title left, search icon button + "Invite members" button right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 24px 24px', borderBottom: '1px solid var(--neutral-100)' }}>
            <SkeletonBlock width={120} height={16} radius={4} />
            <div style={{ flex: '1 0 0' }} />
            <SkeletonBlock width={32} height={32} radius={8} />
            <SkeletonBlock width={130} height={32} radius={8} />
          </div>
          {/* Column headers — Member / Role / Actions (WORKSPACE_MEMBER_COLUMNS) */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '12px 24px' }}>
            <div style={{ flex: '1.25 0 0', minWidth: 260 }}><SkeletonBlock width={60} height={13} radius={4} /></div>
            <div style={{ flex: '1.5 0 0', minWidth: 320, display: 'flex', justifyContent: 'center' }}><SkeletonBlock width={40} height={13} radius={4} /></div>
            <div style={{ width: 150, display: 'flex', justifyContent: 'center' }}><SkeletonBlock width={55} height={13} radius={4} /></div>
          </div>
          {/* Member rows */}
          {[0, 1, 2, 3].map((i, idx) => (
            <React.Fragment key={i}>
              {idx > 0 && <div style={{ height: 1, backgroundColor: 'var(--neutral-100)', margin: 0 }} />}
              <div style={{ display: 'flex', alignItems: 'center', padding: '10px 24px' }}>
                <div style={{ flex: '1.25 0 0', minWidth: 260, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <SkeletonBlock width={32} height={32} radius={16} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <SkeletonBlock width={120} height={13} radius={4} />
                    <SkeletonBlock width={160} height={11} radius={4} />
                  </div>
                </div>
                <div style={{ flex: '1.5 0 0', minWidth: 320, display: 'flex', justifyContent: 'center' }}><SkeletonBlock width={80} height={28} radius={8} /></div>
                <div style={{ width: 150, display: 'flex', justifyContent: 'center' }}><SkeletonBlock width={72} height={28} radius={8} /></div>
              </div>
            </React.Fragment>
          ))}
        </div>

      </div>
    </>
  )
}

// Team has no backend route left at all, so a member's role is always just
// the org-level admin/member value — never a team-derived 'editor'. A
// 'service' row (machine principal) also displays as plain Member. 'owner'
// folds into 'admin' — same fold the backend applies to the viewer's own
// role; there's no separate Owner tier in the UI.
function displayRoleFor(member: OrgMember): WorkspaceRole {
  return (member.orgRole === 'admin' || member.orgRole === 'owner') ? 'admin' : 'member'
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrgMembersPage() {
  const { orgId, org, members: orgMembers, membersLoading, currentUserRole, refreshMembers } = useOrg()
  const { user } = useAuth()
  const isAdmin = currentUserRole === 'admin'

  const [members,        setMembers]        = useState<OrgMember[]>(orgMembers)
  // Bumped by every optimistic local edit (role change, remove, invite, ...)
  // so a stale render from a superseded orgMembers update never clobbers it.
  const membersVersionRef = useRef(0)

  // Sync context members into local state when the API response arrives.
  // useState only uses its initial value once, so without this effect the table
  // stays empty until the component is remounted.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMembers(orgMembers.map(member => ({ ...member, role: displayRoleFor(member) })))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [orgMembers])

  // Every optimistic local edit goes through this instead of setMembers
  // directly, so any in-flight background resync (see syncMembers above)
  // knows to discard its result rather than clobber the edit.
  const bumpMembers = (updater: React.SetStateAction<OrgMember[]>) => {
    membersVersionRef.current += 1
    setMembers(updater)
  }

  const [inviteOpen,     setInviteOpen]     = useState(false)
  const [inviteLoading,  setInviteLoading]  = useState(false)
  const [projects,       setProjects]       = useState<ApiProjectSummary[]>([])
  const [allowedDomains, setAllowedDomains] = useState<string[]>([])
  const [rolesInfoOpen,  setRolesInfoOpen]  = useState(false)

  useEffect(() => {
    if (!orgId) return
    getOrgSettings(orgId)
      .then(s => setAllowedDomains(s.allowedEmailDomains ?? []))
      .catch(() => { /* non-fatal — open invite if settings unavailable */ })
  }, [orgId])

  useEffect(() => {
    if (!inviteOpen) return
    let cancelled = false
    fetchProjects(user?.auth0Id ?? '')
      .then(items => {
        if (!cancelled) setProjects(items.filter(project => project.teamId))
      })
      .catch(() => {
        if (!cancelled) setProjects([])
      })
    return () => { cancelled = true }
  }, [inviteOpen, user?.auth0Id])

  // Sync the current user's name to the backend when it appears stale
  // ("Someone" or empty) — mirrors how the individual plan syncs via
  // updateUser() during onboarding/settings.
  const currentUserName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
    (user?.name && !user.name.includes('@') ? user.name : '')

  useEffect(() => {
    if (!user?.email || !currentUserName) return
    const self = members.find(m => m.email === user.email)
    if (!self) return
    const nameIsStale = !self.name || self.name.toLowerCase() === 'someone'
    if (!nameIsStale) return
    const [first, ...rest] = currentUserName.split(' ')
    updateUser({ first_name: first ?? '', last_name: rest.join(' ') || null })
      .then(() => {
        bumpMembers(prev => prev.map(m =>
          m.email === user.email ? { ...m, name: currentUserName } : m,
        ))
      })
      .catch(() => { /* non-fatal — UI already shows the correct name via displayMembers */ })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email, currentUserName, members.length])

  const displayMembers = members.map(m =>
    user?.email && m.email === user.email && currentUserName
      ? { ...m, name: currentUserName }
      : m
  )

  const totalMembers   = members.length
  const adminCount     = members.filter(m => displayRoleFor(m) === 'admin').length
  const pendingInvites = members.filter(m => m.inviteStatus === 'invite_sent').length

  // Applies the Manage-role modal's result: a plain org-level Admin/Member
  // choice. Used to also diff a per-team None/Member/Editor grant here (Team
  // has no backend route left at all, so that's gone with no replacement).
  // Returns whether the save fully succeeded, so ManageRoleModal only closes
  // itself (via doSave) on a clean save.
  const handleManageRole = async (
    memberId: string,
    desiredOrgRole: 'admin' | 'member',
  ): Promise<boolean> => {
    const member = members.find(m => m.id === memberId)
    if (!member || !orgId) return false
    const memberName = member.name || member.email
    const prev = members

    try {
      // Compare against the *displayed* role, not the raw one — an 'owner'
      // member already displays (and behaves) as Admin, so picking "Admin"
      // for them shouldn't fire a write that would demote them off the
      // owner role.
      if (desiredOrgRole !== displayRoleFor(member)) {
        await setMemberRole(orgId, memberId, desiredOrgRole)
      }
      bumpMembers(ms => ms.map(m => m.id === memberId ? { ...m, role: desiredOrgRole, orgRole: desiredOrgRole } : m))
      toast.success(desiredOrgRole === 'admin' ? `${memberName} is now an Admin` : `Updated ${memberName}'s role`)
      refreshMembers()
      return true
    } catch (err) {
      bumpMembers(prev)
      toast.error(err instanceof Error ? err.message : 'Failed to update role')
      return false
    }
  }

  const handleRemove = async (id: string) => {
    if (!orgId) return
    const prev = members
    const removed = prev.find(m => m.id === id)
    bumpMembers(ms => ms.filter(m => m.id !== id))
    try {
      await removeMember(orgId, id)
      toast.success(`Removed ${removed?.name || removed?.email || 'member'}`)
    } catch (err) {
      bumpMembers(prev)
      toast.error(err instanceof Error ? err.message : 'Failed to remove member')
    }
  }

  const handleRevokeInvite = async (id: string) => {
    if (!orgId) return
    const prev = members
    const invited = prev.find(m => m.id === id)
    bumpMembers(ms => ms.filter(m => m.id !== id))
    try {
      // Pending invites live in the invite table, not the member table. Use
      // the invite-specific DELETE endpoint; fall back to removeMember only
      // if invite metadata is missing (e.g. optimistic row before BE refresh).
      if (invited?.inviteId) {
        await revokeInvite(orgId, invited.inviteId)
      } else {
        await removeMember(orgId, id)
      }
      toast.success(`Invite to ${invited?.email || 'member'} revoked`)
    } catch (err) {
      bumpMembers(prev)
      toast.error(err instanceof Error ? err.message : 'Failed to revoke invite')
    }
  }

  // Returns per-email results rather than throwing, so InviteModal can drop
  // only the emails that actually succeeded and keep the rest (with why they
  // failed) visible as chips instead of silently clearing the whole batch —
  // see InviteModal's handleSubmit for the other half of this contract.
  const handleInvite = async (
    emails: string[],
    role: WorkspaceRole,
    projectId?: string,
  ): Promise<InviteResult> => {
    if (!orgId) {
      return { succeeded: [], failed: emails.map(email => ({ email, reason: 'No organization selected' })) }
    }

    // Local checks first (no round trip needed): already-a-member and
    // domain-restriction. Only what passes both goes into the batched call.
    const failed: { email: string; reason: string }[] = []
    const toSend: string[] = []
    for (const raw of emails) {
      const email = raw.trim()
      const normalizedEmail = email.toLowerCase()
      const alreadyMember = members.some(m => m.email?.toLowerCase() === normalizedEmail)
      if (alreadyMember) {
        failed.push({ email, reason: 'Already a member of this workspace' })
        continue
      }
      if (allowedDomains.length > 0) {
        const domain = email.split('@')[1]?.toLowerCase() ?? ''
        if (!allowedDomains.includes(domain)) {
          failed.push({ email, reason: `Domain not allowed — restricted to ${allowedDomains.join(', ')}` })
          continue
        }
      }
      toSend.push(email)
    }

    if (toSend.length === 0) return { succeeded: [], failed }

    setInviteLoading(true)
    try {
      await inviteMembers(orgId, toSend, role, projectId)

      // Optimistic pending rows.
      bumpMembers(prev => [
        ...prev,
        ...toSend.map(email => ({
          id:              `invite_${Date.now()}_${email}`,
          name:            email.split('@')[0] ?? email,
          email,
          role,
          orgRole:         (role === 'admin' ? 'admin' : 'member') as OrgMember['orgRole'],
          inviteStatus:    'invite_sent' as const,
          teamMemberships: [],
          creditUsed:      0,
        })),
      ])
      toast.success(toSend.length === 1 ? 'Invite sent' : `${toSend.length} invites sent`)
      // Reconcile the optimistic (synthetic-id) rows with the real backend
      // invite records so their user_ids are available for revoking.
      refreshMembers()
      return { succeeded: toSend, failed }
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Failed to send invite'
      toast.error(reason)
      return { succeeded: [], failed: [...failed, ...toSend.map(email => ({ email, reason }))] }
    } finally {
      setInviteLoading(false)
    }
  }

  if (membersLoading) {
    return (
      <div className="kaya-scrollbar" style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 64, paddingBottom: 48 }}>
        <MembersPageSkeleton />
      </div>
    )
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
        paddingTop:     64,
        paddingBottom:  48,
      }}
    >
      {/* Horizontal padding lives here, not on the scrolling element above —
          keeps the scrollbar flush with the container's edge. */}
      <div style={{ width: '100%', maxWidth: 1008, padding: '0 24px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            {/* 24/32 matches the header treatment on every other v1.5 settings
                page (Account, Usage, General) and Figma node 18:24255. */}
            <h1 style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
              Members
            </h1>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: '4px 0 0' }}>
              Manage who has access to your workspace and what they can do.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<InformationCircleIcon size={16} />}
            onClick={() => setRolesInfoOpen(true)}
          >
            Roles &amp; Permissions
          </Button>
        </div>

        {/* Stats row */}
        <div style={{
          border:       '1px solid var(--neutral-200)',
          borderRadius: 16,
          boxShadow:    SHADOW_CARD,
          padding:      12,
          display:      'flex',
          gap:          9,
        }}>
          <div style={{ flex: '1 0 0', minWidth: 0, backgroundColor: 'var(--neutral-white)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 6, boxShadow: SHADOW_STAT_CARD }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-500)', margin: 0 }}>Total members</p>
            <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 28, lineHeight: '36px', color: 'var(--neutral-900)', margin: 0 }}>{totalMembers}</p>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>unlimited seats</p>
          </div>
          <div style={{ flex: '1 0 0', minWidth: 0, backgroundColor: 'var(--neutral-white)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 6, boxShadow: SHADOW_STAT_CARD }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-500)', margin: 0 }}>Admins</p>
            <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 28, lineHeight: '36px', color: 'var(--neutral-900)', margin: 0 }}>{adminCount}</p>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>workspace admins</p>
          </div>
          <div style={{ flex: '1 0 0', minWidth: 0, backgroundColor: 'var(--neutral-white)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 6, boxShadow: SHADOW_STAT_CARD }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-500)', margin: 0 }}>Pending invites</p>
            <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 28, lineHeight: '36px', color: 'var(--neutral-900)', margin: 0 }}>{pendingInvites}</p>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>awaiting acceptance</p>
          </div>
        </div>

        {/* Members table */}
        <MembersTable
          members={displayMembers}
          isAdmin={isAdmin}
          loading={membersLoading}
          onManageRole={(id, desiredOrgRole) => handleManageRole(id, desiredOrgRole)}
          onRemove={handleRemove}
          onRevokeInvite={handleRevokeInvite}
          onInviteClick={() => setInviteOpen(true)}
        />

      </div>

      {/* Roles & Permissions info modal — opened from the info button next to the page title */}
      <RolesPermissionsModal open={rolesInfoOpen} onClose={() => setRolesInfoOpen(false)} />

      {/* Invite modal */}
      <AppInviteModal
        isOpen={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvite={handleInvite}
        workspaceName={org.name}
        loading={inviteLoading}
        projects={projects.flatMap(project => (
          project.teamId
            ? [{ id: project.id, title: project.title, teamId: project.teamId }]
            : []
        ))}
        existingEmails={members.map(m => m.email).filter(Boolean)}
        allowedDomains={allowedDomains}
      />
    </div>
  )
}
