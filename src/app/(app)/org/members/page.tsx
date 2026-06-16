'use client'

import React, { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { SearchOneIcon, FilterMailIcon } from '@strange-huge/icons'
import { Badge }            from '@/components/Badge'
import { RoleBadge }        from '@/components/RoleBadge'
import { Button }           from '@/components/Button'
import { IconButton }       from '@/components/IconButton'
import { Avatar }           from '@/components/Avatar'
import { Popover }          from '@/components/Popover'
import { DropdownMenuItem } from '@/components/DropdownMenuItem'
import { Divider }          from '@/components/Divider'
import { AppInviteModal }   from '@/components/InviteModal'
import { toast }           from 'sonner'
import { useOrg }           from '@/context/org-context'
import { useAuth }          from '@/context/auth-context'
import { setMemberRole, removeMember } from '@/lib/api/organization'
import { inviteTeamMembers } from '@/lib/api/teams'
import type { OrgMember, WorkspaceRole, OrgRole } from '@/types/teams'

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
  triggerRef,
}: {
  currentRole: WorkspaceRole
  onSelect:    (r: WorkspaceRole) => void
  onClose:     () => void
  triggerRef:  React.RefObject<HTMLButtonElement | null>
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  const ROLES: WorkspaceRole[] = ['editor', 'member']
  const DESCS: Record<WorkspaceRole, string> = {
    admin:  'Full workspace access',
    editor: 'Can publish to Team scope',
    member: 'Use-only access',
  }

  React.useEffect(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.left })
    }
  }, [triggerRef])

  React.useEffect(() => {
    const h = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node) || triggerRef.current?.contains(e.target as Node)) return
      onClose()
    }
    document.addEventListener('mousedown', h, { capture: true })
    return () => document.removeEventListener('mousedown', h, { capture: true })
  }, [onClose, triggerRef])

  if (!pos || typeof document === 'undefined') return null

  return createPortal(
    <motion.div
      initial={{ opacity: 0, scaleX: 0.96, scaleY: 0.75, transformOrigin: 'top left' }}
      animate={{ opacity: 1, scaleX: 1, scaleY: 1, transition: { duration: 0.15, ease: [0.16, 1, 0.3, 1] } }}
      exit={{ opacity: 0, transition: { duration: 0.08 } }}
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, minWidth: 220 }}
    >
      <Popover ref={panelRef} variant="dropdown" maxHeight={false} role="menu" style={{ padding: 4 }}>
        {ROLES.map(r => (
          <DropdownMenuItem
            key={r}
            fluid
            label={r.charAt(0).toUpperCase() + r.slice(1)}
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
  isOwner = false,
  isAdmin = true,
  onClick,
  btnRef,
}: {
  role:     WorkspaceRole
  isOwner?: boolean
  isAdmin?: boolean
  onClick?: () => void
  btnRef?:  (el: HTMLButtonElement | null) => void
}) {
  const [hov, setHov] = React.useState(false)
  const label = role.charAt(0).toUpperCase() + role.slice(1)

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

function RemoveButton({ memberName, onConfirm }: { memberName: string; onConfirm: () => void }) {
  const [hov,        setHov]        = React.useState(false)
  const [confirming, setConfirming] = React.useState(false)

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {!confirming ? (
        <motion.button
          key="remove"
          type="button"
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
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M7 7.875a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM1.75 12.25c0-2.071 2.351-3.5 5.25-3.5M10.5 10.5l1.75 1.75M12.25 10.5L10.5 12.25" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Remove
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
            Confirm remove
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Teams badges column ───────────────────────────────────────────────────────

function TeamsBadges({ teams }: { teams: OrgMember['teamMemberships'] }) {
  if (teams.length === 0) return <span style={{ color: 'var(--neutral-300)' }}>—</span>
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {teams.map(t => (
        <Badge
          key={t.teamId}
          color={t.isTeamOwner ? 'Green' : 'Blue'}
          label={`${t.isTeamOwner ? '★ ' : ''}${t.teamName}`}
        />
      ))}
    </div>
  )
}

// ── Members table ─────────────────────────────────────────────────────────────

function MembersTable({
  members,
  ownerMemberId,
  isAdmin,
  onChangeRole,
  onRemove,
  onInviteClick,
}: {
  members:       OrgMember[]
  ownerMemberId: string
  isAdmin:       boolean
  onChangeRole:  (id: string, role: WorkspaceRole) => void
  onRemove:      (id: string) => void
  onInviteClick: () => void
}) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  return (
    <div style={{
      borderRadius:    16,
      border:          '1px solid var(--neutral-200)',
      backgroundColor: '#f9f5f1',
      boxShadow:       SHADOW_CARD,
      overflow:        'hidden',
      width:           '100%',
    }}>
      {/* Header */}
      <div style={{
        display:      'flex',
        alignItems:   'center',
        gap:          12,
        padding:      '12px 24px 24px',
        borderBottom: '1px solid var(--neutral-100)',
      }}>
        <span style={{ flex: '1 0 0', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, color: 'var(--neutral-900)' }}>
          Team Members
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <IconButton size="sm" variant="ghost" aria-label="Search" icon={<SearchOneIcon size={20} />} />
          <IconButton size="sm" variant="ghost" aria-label="Filter" icon={<FilterMailIcon size={20} />} />
        </div>
        {isAdmin && (
          <Button variant="secondary" size="sm" onClick={onInviteClick}>+ Invite members</Button>
        )}
      </div>

      {/* Column headers */}
      <div style={{
        display:    'flex',
        alignItems: 'center',
        padding:    '2px 24px 8px',
      }}>
        <span style={{ flex: '1 0 0', minWidth: 200, fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 'var(--font-size-body)', color: 'var(--neutral-900)' }}>Member</span>
        <span style={{ width: 110, textAlign: 'left', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 'var(--font-size-body)', color: 'var(--neutral-900)' }}>Role</span>
        <span style={{ width: 200, fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 'var(--font-size-body)', color: 'var(--neutral-900)' }}>Teams</span>
        <span style={{ minWidth: 180, textAlign: 'right', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 'var(--font-size-body)', color: 'var(--neutral-900)' }}>Actions</span>
      </div>

      {/* Rows */}
      {members.length === 0 ? (
        <div style={{ padding: '32px 24px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>
            No members yet
          </p>
        </div>
      ) : members.map((member, index) => {
        const isOwner = member.id === ownerMemberId
        return (
          <React.Fragment key={member.id}>
            {index > 0 && <Divider decorative style={{ backgroundColor: 'var(--neutral-100)', margin: 0 }} />}
            <div style={{
              display:    'flex',
              alignItems: 'center',
              gap:        0,
              padding:    '10px 24px',
              position:   'relative',
            }}>
              {/* Member info */}
              <div style={{ flex: '1 0 0', minWidth: 200, display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar name={member.name} size="sm" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 'var(--font-size-body)', color: 'var(--neutral-900)', whiteSpace: 'nowrap' }}>
                      {member.name}
                    </span>
                    {member.inviteStatus === 'invite_sent' && (
                      <Badge color="Neutral" label="Invite sent" />
                    )}
                  </div>
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 'var(--font-size-caption)', color: 'var(--neutral-500)', whiteSpace: 'nowrap' }}>
                    {member.email}
                  </span>
                </div>
              </div>

              {/* Role */}
              <div style={{ width: 110, display: 'flex', justifyContent: 'flex-start', flexShrink: 0, position: 'relative' }}>
                <RoleButton
                  role={member.role}
                  isOwner={isOwner}
                  isAdmin={isAdmin}
                  btnRef={el => { triggerRefs.current[member.id] = el }}
                  onClick={() => setOpenDropdown(prev => prev === member.id ? null : member.id)}
                />
                <AnimatePresence>
                  {openDropdown === member.id && (
                    <RoleDropdown
                      currentRole={member.role}
                      onSelect={role => { onChangeRole(member.id, role); setOpenDropdown(null) }}
                      onClose={() => setOpenDropdown(null)}
                      triggerRef={{ current: triggerRefs.current[member.id] ?? null }}
                    />
                  )}
                </AnimatePresence>
              </div>

              {/* Teams */}
              <div style={{ width: 200, flexShrink: 0 }}>
                <TeamsBadges teams={member.teamMemberships} />
              </div>

              {/* Actions */}
              <div style={{ minWidth: 180, display: 'flex', justifyContent: 'flex-end' }}>
                {isAdmin && !isOwner && (
                  <RemoveButton memberName={member.name} onConfirm={() => onRemove(member.id)} />
                )}
              </div>
            </div>
          </React.Fragment>
        )
      })}

      {/* Footer */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '12px 24px',
        borderTop:      '1px solid var(--neutral-100)',
      }}>
        <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 'var(--font-size-body)', color: 'var(--neutral-600)' }}>
          Showing 1–{members.length} of {members.length} members
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6, borderRadius: 8, border: '0.727px solid rgba(59,54,50,0.3)', background: 'none', cursor: 'pointer', overflow: 'hidden' }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M12 6l-4 4 4 4" stroke="var(--neutral-500)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5px 8px', borderRadius: 8, border: 'none', cursor: 'default', background: 'rgba(255,255,255,0)', boxShadow: '0px 0px 0px 1px rgba(59,54,50,0.3)', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 'var(--font-size-body)', color: 'var(--neutral-700)' }}>1</button>
          <button type="button" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6, borderRadius: 8, border: '0.727px solid rgba(59,54,50,0.3)', background: 'none', cursor: 'pointer', overflow: 'hidden' }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M8 6l4 4-4 4" stroke="var(--neutral-500)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Roles & Permissions section (collapsible) ────────────────────────────────

const ROLES_INFO = [
  { role: 'admin'  as const, description: 'Full access including billing, workspace deletion, and ownership transfer. One per workspace.' },
  { role: 'editor' as const, description: 'Can manage members, approve personas and workflows, and change workspace settings. Cannot delete the workspace.' },
  { role: 'member' as const, description: 'Can use all workspace features within admin-set permissions. Cannot change settings or manage members.' },
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
            <RoleBadge role={item.role} size="sm" style={{ flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 'var(--font-size-body)', color: 'var(--neutral-700)', lineHeight: 'var(--line-height-body)' }}>
              {item.description}
            </span>
          </div>
        </React.Fragment>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrgMembersPage() {
  const { orgId, org, members: orgMembers, currentUserRole, teams } = useOrg()
  const { user } = useAuth()
  const isAdmin = currentUserRole === 'admin'

  const [members,       setMembers]       = useState<OrgMember[]>(orgMembers)
  const [inviteOpen,    setInviteOpen]    = useState(false)
  const [inviteLoading, setInviteLoading] = useState(false)

  // Replace the current user's member-list name with the auth-profile name.
  // The plan API can return a stale or placeholder name (e.g. "Someone") when
  // the Auth0 profile hasn't synced to the backend yet — the auth context is
  // always the freshest source of truth for the logged-in user's own name.
  // Best available name for the logged-in user: firstName+lastName first,
  // then the combined `name` from the auth profile (if it's not just their email).
  const currentUserName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
    (user?.name && !user.name.includes('@') ? user.name : '')
  const displayMembers = members.map(m =>
    user?.email && m.email === user.email && currentUserName
      ? { ...m, name: currentUserName }
      : m
  )

  // First admin is the workspace owner (cannot be removed)
  const ownerMemberId = members.find(m => m.role === 'admin')?.id ?? ''

  const totalMembers   = members.length
  const adminCount     = members.filter(m => m.role === 'admin').length
  const pendingInvites = members.filter(m => m.inviteStatus === 'invite_sent').length

  const handleChangeRole = async (id: string, role: WorkspaceRole) => {
    const prev = members
    setMembers(ms => ms.map(m => m.id === id ? { ...m, role } : m))
    if (!orgId) return
    const apiRole: OrgRole = role === 'admin' ? 'admin' : 'member'
    try {
      await setMemberRole(orgId, id, apiRole)
    } catch (err) {
      setMembers(prev)
      toast.error(err instanceof Error ? err.message : 'Failed to update role')
    }
  }

  const handleRemove = async (id: string) => {
    const prev = members
    setMembers(ms => ms.filter(m => m.id !== id))
    if (!orgId) return
    try {
      await removeMember(orgId, id)
    } catch (err) {
      setMembers(prev)
      toast.error(err instanceof Error ? err.message : 'Failed to remove member')
    }
  }

  const handleInvite = async (email: string, role: WorkspaceRole) => {
    if (!orgId) return
    const teamId = teams[0]?.id
    if (!teamId) {
      toast.error('Create a team first before inviting members')
      return
    }
    setInviteLoading(true)
    try {
      await inviteTeamMembers(orgId, teamId, [email])
      setMembers(prev => [...prev, {
        id:              `invite_${Date.now()}`,
        name:            email.split('@')[0] ?? email,
        email,
        role,
        inviteStatus:    'invite_sent',
        teamMemberships: [],
        creditUsed:      0,
      }])
      setInviteOpen(false)
      toast.success('Invite sent')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invite')
    } finally {
      setInviteLoading(false)
    }
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
          onChangeRole={handleChangeRole}
          onRemove={handleRemove}
          onInviteClick={() => setInviteOpen(true)}
        />

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
      />
    </div>
  )
}
