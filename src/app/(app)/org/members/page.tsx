'use client'

import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { PlusSignIcon, SearchOneIcon, CancelCircleIcon } from '@strange-huge/icons'
import { Badge }            from '@/components/Badge'
import { RoleBadge }        from '@/components/RoleBadge'
import { CREDIT_CAP_COLUMNS, CreditCapRow } from '@/components/CreditCapRow'
import { Button }           from '@/components/Button'
import { Avatar }           from '@/components/Avatar'
import { InputField }       from '@/components/InputField'
import { Popover }          from '@/components/Popover'
import { DropdownMenuItem } from '@/components/DropdownMenuItem'
import { AppInviteModal }   from '@/components/InviteModal'
import {
  SettingsTable,
  SettingsTableCell,
  SettingsTableFooter,
  SettingsTableHeader,
  SettingsTableHeaderCell,
  SettingsTableRow,
  SettingsTableToolbar,
} from '@/components/SettingsTable'
import { toast }           from 'sonner'
import { useOrg }           from '@/context/org-context'
import { useAuth }          from '@/context/auth-context'
import { setMemberRole, removeMember, getOrgSettings, setMemberCap } from '@/lib/api/organization'
import { inviteTeamMembers, listTeamEditors, addTeamEditor, removeTeamEditor } from '@/lib/api/teams'
import { fetchProjects, type ApiProjectSummary } from '@/lib/api/projects'
import { updateUser } from '@/lib/api/user'
import type { OrgMember, WorkspaceRole } from '@/types/teams'

// ── Shadows ───────────────────────────────────────────────────────────────────
const SHADOW_CARD      = '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-200)'
const SHADOW_ROLE_BTN  = '0px 1.091px 1.091px 0px rgba(59,54,50,0.05), 0px 1.455px 3.127px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-100)'
const SHADOW_ROLE_INNER = 'inset 0px -2.182px 0.364px 0px var(--neutral-100)'
const SHADOW_REMOVE    = '0px 1.091px 1.091px 0px rgba(24,2,2,0.05), 0px 1.455px 3.127px 0px rgba(24,2,2,0.15), 0px 0px 0px 1px var(--red-100)'
const SHADOW_REMOVE_INNER = 'inset 0px -2.182px 0.364px 0px var(--red-100)'

// ── Role dropdown (portal-mounted) ────────────────────────────────────────────

function RoleDropdown({
  currentRole,
  onSelect,
  onClose,
  triggerEl,
  position,
  availableRoles = ['admin', 'editor', 'member'] as WorkspaceRole[],
}: {
  currentRole:     WorkspaceRole
  onSelect:        (r: WorkspaceRole) => void
  onClose:         () => void
  triggerEl:       HTMLButtonElement
  position:        { top: number; left: number }
  availableRoles?: WorkspaceRole[]
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const LABELS: Record<WorkspaceRole, string> = {
    admin:  'Admin',
    editor: 'Team editor',
    member: 'Member',
  }
  const DESCS: Record<WorkspaceRole, string> = {
    admin:  'Manage workspace settings, members, teams, and connectors',
    editor: 'Edit content in assigned teams',
    member: 'Use assigned projects',
  }

  React.useEffect(() => {
    const h = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node) || triggerEl.contains(e.target as Node)) return
      onClose()
    }
    document.addEventListener('mousedown', h, { capture: true })
    return () => document.removeEventListener('mousedown', h, { capture: true })
  }, [onClose, triggerEl])

  if (typeof document === 'undefined') return null

  return createPortal(
    <motion.div
      initial={{ opacity: 0, scaleX: 0.96, scaleY: 0.75, transformOrigin: 'top left' }}
      animate={{ opacity: 1, scaleX: 1, scaleY: 1, transition: { duration: 0.15, ease: [0.16, 1, 0.3, 1] } }}
      exit={{ opacity: 0, transition: { duration: 0.08 } }}
      style={{ position: 'fixed', top: position.top, left: position.left, zIndex: 9999, minWidth: 220 }}
    >
      <Popover ref={panelRef} variant="dropdown" maxHeight={false} role="menu" style={{ padding: 4 }}>
        {availableRoles.map(r => (
          <DropdownMenuItem
            key={r}
            fluid
            label={LABELS[r]}
            subLabel={DESCS[r]}
            selected={r === currentRole}
            onClick={() => { onSelect(r); onClose() }}
          />
        ))}
      </Popover>
    </motion.div>,
    document.body,
  )
}

// ── Role button ───────────────────────────────────────────────────────────────

function RoleButton({
  role,
  label: labelProp,
  isOwner = false,
  isAdmin = true,
  onClick,
  btnRef,
}: {
  role:     WorkspaceRole
  /** Explicit display label (e.g. "Owner"). Falls back to the capitalised role. */
  label?:   string
  isOwner?: boolean
  isAdmin?: boolean
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
  btnRef?:  (el: HTMLButtonElement | null) => void
}) {
  const [hov, setHov] = React.useState(false)
  const label = labelProp ?? role.charAt(0).toUpperCase() + role.slice(1)

  if (isOwner || !isAdmin) {
    return (
      <span
        style={{
          display:         'inline-flex',
          alignItems:      'center',
          justifyContent:  'center',
          padding:         '5px 8px',
          borderRadius:    8,
          backgroundColor: hov ? 'rgba(237,225,215,0.6)' : 'transparent',
          boxShadow:       isOwner ? SHADOW_ROLE_BTN : 'none',
          fontFamily:      'var(--font-body)',
          fontWeight:      500,
          fontSize:        'var(--font-size-body)',
          color:           'var(--neutral-700)',
          whiteSpace:      'nowrap',
          position:        'relative',
          transition:      'background-color 120ms ease',
        }}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
      >
        {label}
        {isOwner && (
          <span aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', boxShadow: SHADOW_ROLE_INNER }} />
        )}
      </span>
    )
  }

  return (
    <button
      ref={btnRef}
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        gap:             4,
        padding:         '5px 8px',
        borderRadius:    8,
        border:          'none',
        cursor:          'pointer',
        position:        'relative',
        overflow:        'hidden',
        backgroundColor: hov ? 'rgba(237,225,215,0.6)' : 'var(--neutral-white)',
        boxShadow:       SHADOW_ROLE_BTN,
        fontFamily:      'var(--font-body)',
        fontWeight:      500,
        fontSize:        'var(--font-size-body)',
        color:           'var(--neutral-700)',
        whiteSpace:      'nowrap',
        outline:         'none',
        transition:      'background-color 120ms ease',
      }}
    >
      {label}
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
        <path d="M2 3.5l3 3 3-3" stroke="var(--neutral-500)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', boxShadow: SHADOW_ROLE_INNER }} />
    </button>
  )
}

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
            display:         'inline-flex', alignItems: 'center', gap: 4,
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
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
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

// ── Teams badges column ───────────────────────────────────────────────────────

function TeamsBadges({
  teams,
  hasGlobalAccess = false,
}: {
  teams: OrgMember['teamMemberships']
  hasGlobalAccess?: boolean
}) {
  if (hasGlobalAccess || teams.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {teams.map(t => (
        <span
          key={t.teamId}
          style={{
            display:         'inline-flex',
            alignItems:      'center',
            padding:         '2px 6px',
            borderRadius:    6,
            backgroundColor: 'var(--neutral-50)',
            boxShadow:       '0px 0px 0px 1px var(--neutral-100)',
            fontFamily:      'var(--font-body)',
            fontWeight:      500,
            fontSize:        'var(--font-size-caption)',
            lineHeight:      'var(--line-height-caption)',
            color:           'var(--neutral-700)',
            whiteSpace:      'nowrap',
            flexShrink:      0,
          }}
        >
          {t.teamName}
        </span>
      ))}
    </div>
  )
}

// ── Assign-team dropdown ──────────────────────────────────────────────────────

function AssignTeamButton({
  teams,
  assigning,
  onSelect,
}: {
  teams:     { id: string; name: string }[]
  assigning: boolean
  onSelect:  (teamId: string) => void
}) {
  const [open,      setOpen]      = useState(false)
  const triggerRef  = useRef<HTMLButtonElement>(null)
  const panelRef    = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (!open) return
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left })
    }
    const h = (e: MouseEvent) => {
      if (
        panelRef.current?.contains(e.target as Node) ||
        triggerRef.current?.contains(e.target as Node)
      ) return
      setOpen(false)
    }
    document.addEventListener('mousedown', h, { capture: true })
    return () => document.removeEventListener('mousedown', h, { capture: true })
  }, [open])

  if (teams.length === 0) return null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={assigning}
        onClick={() => setOpen(o => !o)}
        style={{
          display:         'flex',
          alignItems:      'center',
          gap:             4,
          padding:         '3px 8px',
          borderRadius:    6,
          border:          '1px dashed var(--neutral-300)',
          backgroundColor: 'transparent',
          cursor:          assigning ? 'not-allowed' : 'pointer',
          fontFamily:      'var(--font-body)',
          fontWeight:      500,
          fontSize:        12,
          color:           'var(--neutral-500)',
          opacity:         assigning ? 0.5 : 1,
          transition:      'border-color 120ms, color 120ms',
        }}
      >
        {!assigning && <PlusSignIcon size={14} />}
        {assigning ? 'Assigning…' : 'Assign team'}
      </button>

      {open && pos && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 300, minWidth: 180 }}
        >
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.12 } }}
              exit={{ opacity: 0, y: -4, transition: { duration: 0.08 } }}
            >
              <Popover variant="dropdown" maxHeight={false} style={{ padding: 4 }}>
                {teams.map(team => (
                  <DropdownMenuItem
                    key={team.id}
                    fluid
                    label={team.name}
                    onClick={() => { setOpen(false); onSelect(team.id) }}
                  />
                ))}
              </Popover>
            </motion.div>
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </>
  )
}

// ── Assign-editor-team modal ──────────────────────────────────────────────────
// Guardrail: making someone a team editor first requires choosing which team
// they'll edit, so editor access is never granted without an explicit scope.

function AssignEditorTeamModal({
  memberName,
  teams,
  onCancel,
  onConfirm,
}: {
  memberName: string
  teams:      { id: string; name: string }[]
  onCancel:   () => void
  onConfirm:  (teamIds: string[]) => void
}) {
  const [selected, setSelected] = useState<string[]>([])
  const toggle = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Assign team editor"
      style={{
        position:        'fixed',
        inset:           0,
        zIndex:          300,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        backgroundColor: 'rgba(0,0,0,0.35)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div
        style={{
          width:           420,
          maxWidth:        'calc(100vw - 32px)',
          borderRadius:    20,
          backgroundColor: 'var(--neutral-white)',
          border:          '1px solid var(--neutral-200)',
          boxShadow:       '0px 8px 32px rgba(0,0,0,0.12)',
          overflow:        'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '24px 24px 16px' }}>
          <h2 style={{ fontFamily: 'var(--font-title)', fontWeight: 500, fontSize: 20, lineHeight: '28px', color: 'var(--neutral-900)', margin: 0 }}>
            Assign team editor
          </h2>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: '4px 0 0' }}>
            Choose which team(s) <strong style={{ color: 'var(--neutral-700)' }}>{memberName}</strong> will edit as a team editor. Select one or more.
          </p>
        </div>

        {/* Team options */}
        <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
          {teams.map(team => {
            const active = selected.includes(team.id)
            return (
              <button
                key={team.id}
                type="button"
                onClick={() => toggle(team.id)}
                style={{
                  display:         'flex',
                  alignItems:      'center',
                  gap:             10,
                  width:           '100%',
                  padding:         '10px 12px',
                  borderRadius:    10,
                  border:          `1px solid ${active ? 'var(--neutral-900)' : 'var(--neutral-200)'}`,
                  backgroundColor: active ? 'var(--neutral-50)' : 'transparent',
                  cursor:          'pointer',
                  textAlign:       'left',
                  transition:      'all 0.1s',
                }}
              >
                <span style={{
                  width: 16, height: 16, borderRadius: 5, flexShrink: 0,
                  border: `2px solid ${active ? 'var(--neutral-900)' : 'var(--neutral-300)'}`,
                  backgroundColor: active ? 'var(--neutral-900)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.1s',
                }}>
                  {active && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                      <path d="M2 5l2 2 4-4.5" stroke="var(--neutral-white)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: 'var(--neutral-800)' }}>
                  {team.name}
                </span>
              </button>
            )
          })}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '20px 24px 24px' }}>
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          <Button variant="default" size="sm" disabled={selected.length === 0} onClick={() => { if (selected.length > 0) onConfirm(selected) }}>
            {selected.length > 1 ? `Assign editor (${selected.length} teams)` : 'Assign editor'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Members table ─────────────────────────────────────────────────────────────

const WORKSPACE_MEMBER_COLUMNS = 'minmax(260px, 1.25fr) 130px minmax(280px, 1fr) 150px'

function MembersTable({
  members,
  ownerMemberId,
  isAdmin,
  isCurrentUserOwner = false,
  loading,
  onRemove,
  onRevokeInvite,
  onInviteClick,
}: {
  members:              OrgMember[]
  ownerMemberId:        string
  isAdmin:              boolean
  isCurrentUserOwner?:  boolean
  loading?:             boolean
  onRemove:             (id: string) => void
  onRevokeInvite:       (id: string) => void
  onInviteClick:        () => void
}) {
  const [searchQuery,   setSearchQuery]   = useState('')
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
      <SettingsTableToolbar title="Workspace Members" style={{ flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 12, maxWidth: '100%' }}>
          <div style={{ width: 220, maxWidth: '100%', flexShrink: 1 }}>
            <InputField
              label="Search members"
              showLabel={false}
              showSubtitle={false}
              size="small"
              fluid
              leftIcon={<SearchOneIcon size={16} />}
              placeholder="Search members"
              value={searchQuery}
              onChange={setSearchQuery}
            />
          </div>
          {isAdmin && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<PlusSignIcon size={16} />}
              onClick={onInviteClick}
            >
              Invite members
            </Button>
          )}
        </div>
      </SettingsTableToolbar>

      <div style={{ overflowX: 'auto' }}>
        <div role="table" aria-label="Workspace members" style={{ minWidth: 900 }}>
          <SettingsTableHeader>
            <SettingsTableHeaderCell>Member</SettingsTableHeaderCell>
            <SettingsTableHeaderCell>Role</SettingsTableHeaderCell>
            <SettingsTableHeaderCell>Teams</SettingsTableHeaderCell>
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
            const isOwner = member.id === ownerMemberId
            const canEditMember = isAdmin && !isOwner && member.inviteStatus !== 'invite_sent' && (isCurrentUserOwner || member.orgRole === 'member')
            const hasGlobalAccess = member.orgRole === 'owner' || member.orgRole === 'admin'

            return (
              <SettingsTableRow
                key={member.id}
                minHeight={72}
              >
                <SettingsTableCell>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <Avatar name={member.name || member.email} size="md" />
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

                <SettingsTableCell style={{ alignSelf: 'flex-start', paddingTop: 16, paddingBottom: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {member.orgRole === 'owner' ? (
                      <Badge color="Yellow" label="Owner" />
                    ) : member.orgRole === 'admin' ? (
                      <RoleBadge role="admin" size="sm" />
                    ) : member.teamMemberships.length > 0 ? (
                      member.teamMemberships.map(t => (
                        <RoleBadge
                          key={t.teamId}
                          role={t.isTeamOwner ? 'editor' : 'member'}
                          size="sm"
                        />
                      ))
                    ) : (
                      <RoleBadge role="member" size="sm" />
                    )}
                  </div>
                </SettingsTableCell>

                <SettingsTableCell style={{ alignSelf: 'flex-start', paddingTop: 16, paddingBottom: 16 }}>
                  <TeamsBadges teams={member.teamMemberships} hasGlobalAccess={hasGlobalAccess} />
                </SettingsTableCell>

                <SettingsTableCell align="end">
                  {canEditMember && (
                    <RemoveButton memberName={member.name || member.email} onConfirm={() => onRemove(member.id)} />
                  )}
                  {isAdmin && !isOwner && member.inviteStatus === 'invite_sent' && (
                    <RemoveButton
                      memberName={member.name || member.email}
                      label="Revoke"
                      confirmLabel="Revoke invite"
                      icon={<CancelCircleIcon size={14} />}
                      onConfirm={() => onRevokeInvite(member.id)}
                    />
                  )}
                </SettingsTableCell>
              </SettingsTableRow>
            )
          })}

          <SettingsTableFooter style={{ borderTop: '1px solid var(--neutral-100)' }}>
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-600)' }}>
              {normalizedQuery
                ? `${filteredMembers.length} of ${members.length} members`
                : `${members.length} member${members.length === 1 ? '' : 's'}`}
            </span>
          </SettingsTableFooter>
        </div>
      </div>
    </SettingsTable>
  )
}

// ── Roles & Permissions section (collapsible) ────────────────────────────────

const ROLES_INFO = [
  { role: 'owner'  as const, description: 'Full organization control, including billing, payment methods, invoices, subscriptions, topup credit purchases, and ownership transfer.' },
  { role: 'admin'  as const, description: 'Everything a owner can do. But cannot manage billing or payments.' },
  { role: 'editor' as const, description: 'Inherits Member access and can edit content in assigned teams, without organization settings or member administration.' },
  { role: 'member' as const, description: 'Baseline access through assigned projects. Cannot change organization settings, manage other members, or edit teams.' },
]

function RolesPermissionsSection() {
  const [open, setOpen] = React.useState(true)

  return (
    <div style={{
      borderRadius:    16,
      border:          '1px solid var(--neutral-200)',
      backgroundColor: '#f9f5f1',
      overflow:        'hidden',
      width:           '100%',
      boxShadow:       SHADOW_CARD,
    }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          gap: 12, padding: '12px 24px 16px', background: 'none', border: 'none', cursor: 'pointer',
          borderBottom: open ? '1px solid var(--neutral-100)' : 'none', textAlign: 'left',
        }}
      >
        <div>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 15, color: 'var(--neutral-900)', margin: 0 }}>
            Roles &amp; Permissions
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 'var(--font-size-caption)', color: 'var(--neutral-500)', margin: '3px 0 0' }}>
            Default behavior for new projects and chats across the workspace.
          </p>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden
          style={{ flexShrink: 0, marginTop: 4, transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 200ms ease', color: 'var(--neutral-400)' }}
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && ROLES_INFO.map((item, index) => (
        <React.Fragment key={item.role}>
          {index > 0 && <div style={{ height: 1, backgroundColor: 'var(--neutral-100)', margin: '0 24px' }} />}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 24px' }}>
            {item.role === 'owner' ? (
              <Badge label="Owner" color="Yellow" style={{ flexShrink: 0 }} />
            ) : (
              <RoleBadge role={item.role} size="sm" style={{ flexShrink: 0 }} />
            )}
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 'var(--font-size-body)', color: 'var(--neutral-700)', lineHeight: 'var(--line-height-body)' }}>
              {item.description}
            </span>
          </div>
        </React.Fragment>
      ))}
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
      <div style={{ width: '100%', maxWidth: 960, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Page header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SkeletonBlock width={120} height={28} radius={6} />
          <SkeletonBlock width={320} height={14} radius={4} />
        </div>

        {/* Stats row */}
        <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 16, boxShadow: SHADOW_CARD, padding: 12, display: 'flex', gap: 9 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ flex: '1 0 0', minWidth: 0, backgroundColor: i === 0 ? 'var(--neutral-50)' : 'var(--neutral-white)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 6, boxShadow: i === 0 ? 'none' : '0px 1px 2px 0px rgba(82,75,71,0.08), 0px 0px 0px 1px var(--neutral-100)' }}>
              <SkeletonBlock width={90} height={13} radius={4} />
              <SkeletonBlock width={40} height={28} radius={6} />
              <SkeletonBlock width={100} height={12} radius={4} />
            </div>
          ))}
        </div>

        {/* Members table skeleton */}
        <div style={{ borderRadius: 16, border: '1px solid var(--neutral-200)', backgroundColor: '#f9f5f1', boxShadow: SHADOW_CARD, overflow: 'hidden', width: '100%' }}>
          {/* Table header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 24px 24px', borderBottom: '1px solid var(--neutral-100)' }}>
            <SkeletonBlock width={120} height={16} radius={4} />
            <div style={{ flex: '1 0 0' }} />
            <SkeletonBlock width={32} height={32} radius={8} />
            <SkeletonBlock width={32} height={32} radius={8} />
            <SkeletonBlock width={110} height={32} radius={8} />
          </div>
          {/* Column headers */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '2px 24px 8px' }}>
            <div style={{ flex: '1 0 0', minWidth: 200 }}><SkeletonBlock width={60} height={13} radius={4} /></div>
            <div style={{ width: 110 }}><SkeletonBlock width={40} height={13} radius={4} /></div>
            <div style={{ width: 200 }}><SkeletonBlock width={50} height={13} radius={4} /></div>
            <div style={{ minWidth: 180, display: 'flex', justifyContent: 'flex-end' }}><SkeletonBlock width={60} height={13} radius={4} /></div>
          </div>
          {/* Member rows */}
          {[0, 1, 2, 3].map((i, idx) => (
            <React.Fragment key={i}>
              {idx > 0 && <div style={{ height: 1, backgroundColor: 'var(--neutral-100)', margin: 0 }} />}
              <div style={{ display: 'flex', alignItems: 'center', padding: '10px 24px' }}>
                <div style={{ flex: '1 0 0', minWidth: 200, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <SkeletonBlock width={32} height={32} radius={16} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <SkeletonBlock width={120} height={13} radius={4} />
                    <SkeletonBlock width={160} height={11} radius={4} />
                  </div>
                </div>
                <div style={{ width: 110 }}><SkeletonBlock width={70} height={28} radius={8} /></div>
                <div style={{ width: 200 }}><SkeletonBlock width={80} height={20} radius={6} /></div>
                <div style={{ minWidth: 180, display: 'flex', justifyContent: 'flex-end' }}><SkeletonBlock width={72} height={28} radius={8} /></div>
              </div>
            </React.Fragment>
          ))}
          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderTop: '1px solid var(--neutral-100)' }}>
            <SkeletonBlock width={160} height={13} radius={4} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <SkeletonBlock width={32} height={32} radius={8} />
              <SkeletonBlock width={32} height={32} radius={8} />
              <SkeletonBlock width={32} height={32} radius={8} />
            </div>
          </div>
        </div>

        {/* Roles & Permissions skeleton */}
        <div style={{ borderRadius: 16, border: '1px solid var(--neutral-200)', backgroundColor: '#f9f5f1', overflow: 'hidden', width: '100%', boxShadow: SHADOW_CARD }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '12px 24px 16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <SkeletonBlock width={150} height={15} radius={4} />
              <SkeletonBlock width={280} height={13} radius={4} />
            </div>
            <SkeletonBlock width={16} height={16} radius={4} />
          </div>
        </div>

      </div>
    </>
  )
}

function displayRoleFor(member: OrgMember): WorkspaceRole {
  if (member.orgRole === 'owner' || member.orgRole === 'admin') return 'admin'
  return member.teamMemberships.length > 0 ? 'editor' : 'member'
}

// ── Credit caps section ───────────────────────────────────────────────────────
// Per-member credit-cap editing (may-day CreditCapRow). Pending invitees are
// omitted — the backend cap endpoint is keyed by user_id, which they lack until
// they accept (the invite's own cap is applied on accept instead).

function CreditCapsSection({ members, isAdmin, onAssignCredits }: {
  members:     OrgMember[]
  isAdmin:     boolean
  onAssignCredits: (memberId: string, amount: number) => void | Promise<void>
}) {
  const active = members.filter(m => m.inviteStatus === 'signed_up')
  if (active.length === 0) return null

  return (
    <SettingsTable columns={CREDIT_CAP_COLUMNS} columnGap={0}>
      <SettingsTableToolbar title="Per-member credit caps" />
      <div style={{ overflowX: 'auto' }}>
        <div role="table" aria-label="Per-member credit caps" style={{ minWidth: 810 }}>
          <SettingsTableHeader>
            <SettingsTableHeaderCell>Member</SettingsTableHeaderCell>
            <SettingsTableHeaderCell align="center">Allocation used</SettingsTableHeaderCell>
            <SettingsTableHeaderCell align="center">Current cap</SettingsTableHeaderCell>
            <SettingsTableHeaderCell align="center">Remaining</SettingsTableHeaderCell>
            <SettingsTableHeaderCell align="center">Assign credits</SettingsTableHeaderCell>
          </SettingsTableHeader>
          {active.map(m => (
            <CreditCapRow
              key={m.id}
              memberName={m.name || m.email}
              email={m.email}
              creditUsed={m.creditUsed}
              allocationUsed={m.allocationUsed}
              creditCap={m.creditCap}
              isAdmin={isAdmin}
              canAssign={m.orgRole === 'member'}
              onAssignCredits={(amount) => onAssignCredits(m.id, amount)}
            />
          ))}
        </div>
      </div>
    </SettingsTable>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrgMembersPage() {
  const { orgId, org, members: orgMembers, membersLoading, currentUserRole, teams, refreshMembers } = useOrg()
  const { user } = useAuth()
  const isAdmin = currentUserRole === 'admin'
  const currentUserIsOwner = orgMembers.find(m => m.email === user?.email)?.orgRole === 'owner'

  const [members,        setMembers]        = useState<OrgMember[]>(orgMembers)

  // Sync context members into local state when the API response arrives.
  // useState only uses its initial value once, so without this effect the table
  // stays empty until the component is remounted.
  useEffect(() => {
    let cancelled = false

    async function syncMembers() {
      let next = orgMembers.map(member => ({ ...member, role: displayRoleFor(member) }))

      if (orgId && teams.length > 0) {
        const editorRows = await Promise.all(
          teams.map(async team => ({
            team,
            editors: await listTeamEditors(orgId, team.id).catch(() => []),
          })),
        )
        const membershipsByUser = new Map<string, OrgMember['teamMemberships']>()
        for (const { team, editors } of editorRows) {
          for (const editor of editors) {
            const current = membershipsByUser.get(editor.userId) ?? []
            current.push({ teamId: team.id, teamName: team.name, isTeamOwner: true })
            membershipsByUser.set(editor.userId, current)
          }
        }
        next = next.map(member => {
          const activeMemberships = membershipsByUser.get(member.id) ?? []
          const teamMemberships = member.orgRole === 'owner' || member.orgRole === 'admin'
            ? []
            : member.inviteStatus === 'invite_sent'
            ? member.teamMemberships
            : activeMemberships
          return { ...member, teamMemberships, role: displayRoleFor({ ...member, teamMemberships }) }
        })
      }

      if (!cancelled) setMembers(next)
    }

    void syncMembers()
    return () => { cancelled = true }
  }, [orgId, orgMembers, teams])
  const [inviteOpen,     setInviteOpen]     = useState(false)
  const [inviteLoading,  setInviteLoading]  = useState(false)
  const [projects,       setProjects]       = useState<ApiProjectSummary[]>([])
  const [allowedDomains, setAllowedDomains] = useState<string[]>([])
  // Member awaiting a team selection before being made a team editor.
  const [editorTarget,   setEditorTarget]   = useState<{ memberId: string; memberName: string } | null>(null)

  useEffect(() => {
    if (!orgId) return
    getOrgSettings(orgId)
      .then(s => setAllowedDomains(s.allowedEmailDomains ?? []))
      .catch(() => { /* non-fatal — open invite if settings unavailable */ })
  }, [orgId])

  useEffect(() => {
    if (!inviteOpen) return
    let cancelled = false
    fetchProjects()
      .then(items => {
        if (!cancelled) setProjects(items.filter(project => project.teamId))
      })
      .catch(() => {
        if (!cancelled) setProjects([])
      })
    return () => { cancelled = true }
  }, [inviteOpen])

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
        setMembers(prev => prev.map(m =>
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

  // The workspace owner (cannot be removed). Use the real backend role; fall
  // back to the first admin only if no member is flagged as owner.
  const ownerMemberId =
    members.find(m => m.orgRole === 'owner')?.id ??
    members.find(m => m.role === 'admin')?.id ??
    ''

  const totalMembers   = members.length
  const adminCount     = members.filter(m => m.orgRole === 'owner' || m.orgRole === 'admin').length
  const pendingInvites = members.filter(m => m.inviteStatus === 'invite_sent').length

  // Change a member's workspace role. Promoting/demoting to `editor` requires one
  // or more target teams (collected by the team-picker modal and passed as
  // editorTeamIds); the chosen grants are added on top of existing memberships.
  const handleChangeRole = async (id: string, role: WorkspaceRole, editorTeamIds?: string[]) => {
    const prev = members
    const prevMember = prev.find(m => m.id === id)
    if (!prevMember) return
    if (!orgId) return

    const previousTeamIds = prevMember.teamMemberships.map(tm => tm.teamId)

    // Resolve the editor's target team memberships. With teams chosen in the
    // modal we merge them onto existing grants; the all-teams fallback only
    // applies when none were picked.
    let targetMemberships = prevMember.teamMemberships
    if (role === 'editor') {
      if (editorTeamIds && editorTeamIds.length > 0) {
        const chosen = editorTeamIds.map(tid => ({
          teamId:      tid,
          teamName:    teams.find(team => team.id === tid)?.name ?? 'Team',
          isTeamOwner: true,
        }))
        targetMemberships = [
          ...prevMember.teamMemberships.filter(tm => !editorTeamIds.includes(tm.teamId)),
          ...chosen,
        ]
      } else if (previousTeamIds.length === 0) {
        targetMemberships = teams.map(team => ({ teamId: team.id, teamName: team.name, isTeamOwner: true }))
      }
      if (targetMemberships.length === 0) {
        toast.error('Create a team before assigning a team editor')
        return
      }
    }

    setMembers(ms => ms.map(m => {
      if (m.id !== id) return m
      if (role === 'admin') return { ...m, role: 'admin', orgRole: 'admin', teamMemberships: [] }
      if (role === 'editor') return { ...m, role: 'editor', orgRole: 'member', teamMemberships: targetMemberships }
      return { ...m, role: 'member', orgRole: 'member', teamMemberships: [] }
    }))

    const roleLabel = role === 'admin' ? 'Admin' : role === 'editor' ? 'Team editor' : 'Member'

    try {
      if (role === 'admin') {
        await setMemberRole(orgId, id, 'admin')
        await Promise.all(previousTeamIds.map(tid => removeTeamEditor(orgId, tid, id)))
      } else {
        await setMemberRole(orgId, id, 'member')
        if (role === 'editor') {
          // Grant only the newly chosen teams when picked; existing editor grants
          // stay intact. Falls back to all target teams otherwise.
          const teamsToGrant = editorTeamIds && editorTeamIds.length > 0
            ? editorTeamIds
            : targetMemberships.map(tm => tm.teamId)
          await Promise.all(teamsToGrant.map(tid => addTeamEditor(orgId, tid, id)))
        } else if (previousTeamIds.length > 0) {
          await Promise.all(previousTeamIds.map(tid => removeTeamEditor(orgId, tid, id)))
        }
      }
      let successMsg = `Role changed to ${roleLabel}`
      if (role === 'editor' && editorTeamIds && editorTeamIds.length > 0) {
        successMsg = editorTeamIds.length === 1
          ? `Assigned as team editor of ${teams.find(t => t.id === editorTeamIds[0])?.name ?? 'team'}`
          : `Assigned as team editor of ${editorTeamIds.length} teams`
      }
      toast.success(successMsg)
    } catch (err) {
      setMembers(prev)
      toast.error(err instanceof Error ? err.message : 'Failed to update role')
    }
  }

  // Promotion/demotion to editor first asks which team to assign (guardrail).
  const handleRequestEditor = (memberId: string, memberName: string) => {
    if (teams.length === 0) {
      toast.error('Create a team before assigning a team editor')
      return
    }
    setEditorTarget({ memberId, memberName })
  }

  const handleAssignTeam = async (memberId: string, teamId: string) => {
    const member = members.find(m => m.id === memberId)
    if (!member || !orgId) return
    try {
      await addTeamEditor(orgId, teamId, memberId)
      const team = teams.find(t => t.id === teamId)
      setMembers(prev => prev.map(m =>
        m.id === memberId
          ? {
              ...m,
              role: m.orgRole === 'owner' || m.orgRole === 'admin' ? 'admin' : 'editor',
              teamMemberships: [...m.teamMemberships, { teamId, teamName: team?.name ?? '', isTeamOwner: false }],
            }
          : m,
      ))
      toast.success(`Assigned to ${team?.name ?? 'team'}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to assign team')
    }
  }

  const handleRemove = async (id: string) => {
    const prev = members
    const removed = prev.find(m => m.id === id)
    setMembers(ms => ms.filter(m => m.id !== id))
    if (!orgId) return
    try {
      await removeMember(orgId, id)
      toast.success(`Removed ${removed?.name || removed?.email || 'member'}`)
    } catch (err) {
      setMembers(prev)
      toast.error(err instanceof Error ? err.message : 'Failed to remove member')
    }
  }

  // Revoke a pending invite. Pending invites are backed by a placeholder member
  // record keyed by user_id, so the same DELETE member endpoint cancels them.
  const handleRevokeInvite = async (id: string) => {
    const prev = members
    const invited = prev.find(m => m.id === id)
    setMembers(ms => ms.filter(m => m.id !== id))
    if (!orgId) return
    try {
      await removeMember(orgId, id)
      toast.success(`Invite to ${invited?.email || 'member'} revoked`)
    } catch (err) {
      setMembers(prev)
      toast.error(err instanceof Error ? err.message : 'Failed to revoke invite')
    }
  }

  const handleInvite = async (
    email: string,
    role: WorkspaceRole,
    creditCap?: number,
    selectedTeamId?: string,
    projectId?: string,
  ) => {
    if (!orgId) return

    if (allowedDomains.length > 0) {
      const domain = email.trim().split('@')[1]?.toLowerCase() ?? ''
      if (!allowedDomains.includes(domain)) {
        toast.error('Email domain not allowed', {
          description: `Invites are restricted to: ${allowedDomains.join(', ')}`,
        })
        return
      }
    }

    const teamId = selectedTeamId ?? teams[0]?.id
    if (!teamId) {
      toast.error('Create a team first before inviting members')
      return
    }
    setInviteLoading(true)
    try {
      // The backend now grants TeamEditor (for editor invites) and applies the
      // credit cap on accept — no fragile post-invite second calls needed.
      // Caps are entered in display credits; the API takes raw (÷1000).
      await inviteTeamMembers(
        orgId,
        teamId,
        [email],
        role,
        creditCap && creditCap > 0 ? creditCap / 1000 : undefined,
        projectId,
      )

      // Optimistic pending row. The cap and team-editor grant only take effect
      // once the invite is accepted, so they're not shown on the pending row.
      setMembers(prev => [...prev, {
        id:              `invite_${Date.now()}`,
        name:            email.split('@')[0] ?? email,
        email,
        role,
        orgRole:         role === 'admin' ? 'admin' : 'member',
        inviteStatus:    'invite_sent',
        teamMemberships: role === 'editor'
          ? [{ teamId, teamName: teams.find(t => t.id === teamId)?.name ?? 'Team', isTeamOwner: true }]
          : [],
        creditUsed:      0,
        allocationUsed:  0,
      }])
      setInviteOpen(false)
      toast.success('Invite sent')
      // Reconcile the optimistic (synthetic-id) row with the real backend
      // invite record so its user_id is available for revoking.
      refreshMembers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invite')
    } finally {
      setInviteLoading(false)
    }
  }

  // Assign additional display credits. The API accepts the resulting total cap
  // in raw credits (÷1000) and deducts only the added delta from the owner pool.
  const handleAssignCredits = async (memberId: string, amount: number) => {
    if (!orgId) return
    const member = members.find(m => m.id === memberId)
    if (!member || member.orgRole !== 'member' || amount <= 0) return
    const newCap = (member.creditCap ?? 0) + amount
    const prev = members
    setMembers(ms => ms.map(m => (m.id === memberId ? { ...m, creditCap: newCap } : m)))
    try {
      await setMemberCap(orgId, memberId, newCap / 1000)
      toast.success(`${amount.toLocaleString()} credits assigned`)
      refreshMembers()
    } catch (err) {
      setMembers(prev)
      toast.error(err instanceof Error ? err.message : 'Failed to assign credits')
    }
  }

  if (membersLoading) {
    return (
      <div className="kaya-scrollbar" style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '64px 24px 48px' }}>
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
        padding:        '64px 24px 48px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 960, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Page header */}
        <div>
          <h1 style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 28, lineHeight: '36px', color: 'var(--neutral-900)', margin: 0 }}>
            Members
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: '4px 0 0' }}>
            Manage who has access to your workspace and what they can do.
          </p>
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
          <div style={{ flex: '1 0 0', minWidth: 0, backgroundColor: 'var(--neutral-50)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-500)', margin: 0 }}>Total members</p>
            <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 28, lineHeight: '36px', color: 'var(--neutral-900)', margin: 0 }}>{totalMembers}</p>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>unlimited seats</p>
          </div>
          <div style={{ flex: '1 0 0', minWidth: 0, backgroundColor: 'var(--neutral-white)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 2, boxShadow: '0px 1px 2px 0px rgba(82,75,71,0.08), 0px 0px 0px 1px var(--neutral-100)' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-500)', margin: 0 }}>Admins</p>
            <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 28, lineHeight: '36px', color: 'var(--neutral-900)', margin: 0 }}>{adminCount}</p>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>in this workspace</p>
          </div>
          <div style={{ flex: '1 0 0', minWidth: 0, backgroundColor: 'var(--neutral-white)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 2, boxShadow: '0px 1px 2px 0px rgba(82,75,71,0.08), 0px 0px 0px 1px var(--neutral-100)' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-500)', margin: 0 }}>Pending invites</p>
            <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 28, lineHeight: '36px', color: 'var(--neutral-900)', margin: 0 }}>{pendingInvites}</p>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>awaiting acceptance</p>
          </div>
        </div>

        {/* Members table */}
        <MembersTable
          members={displayMembers}
          ownerMemberId={ownerMemberId}
          isAdmin={isAdmin}
          isCurrentUserOwner={currentUserIsOwner}
          loading={membersLoading}
          onRemove={handleRemove}
          onRevokeInvite={handleRevokeInvite}
          onInviteClick={() => setInviteOpen(true)}
        />

        {/* Credit caps */}
        <CreditCapsSection members={members} isAdmin={isAdmin} onAssignCredits={handleAssignCredits} />

        {/* Roles & Permissions */}
        <RolesPermissionsSection />

      </div>

      {/* Invite modal */}
      <AppInviteModal
        isOpen={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvite={handleInvite}
        workspaceName={org.name}
        loading={inviteLoading}
        teams={teams.map(team => ({ id: team.id, name: team.name }))}
        projects={projects.flatMap(project => (
          project.teamId
            ? [{ id: project.id, title: project.title, teamId: project.teamId }]
            : []
        ))}
      />

      {/* Team-editor scope picker (guardrail before granting editor access) */}
      {editorTarget && (
        <AssignEditorTeamModal
          memberName={editorTarget.memberName}
          teams={teams.map(team => ({ id: team.id, name: team.name }))}
          onCancel={() => setEditorTarget(null)}
          onConfirm={(teamIds) => {
            const { memberId } = editorTarget
            setEditorTarget(null)
            void handleChangeRole(memberId, 'editor', teamIds)
          }}
        />
      )}
    </div>
  )
}
