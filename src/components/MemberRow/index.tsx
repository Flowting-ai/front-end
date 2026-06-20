'use client'

import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDownOneIcon } from '@strange-huge/icons'
import type { OrgMember } from '@/types/teams'
import type { WorkspaceRole } from '@/components/RoleBadge'
import { RoleBadge } from '@/components/RoleBadge'
import { Dropdown, DropdownFloat } from '@/components/Dropdown'
import { DropdownMenuItem } from '@/components/DropdownMenuItem'

export interface MemberRowProps {
  member:          OrgMember
  isCurrentUser:   boolean
  onRoleChange?:   (role: WorkspaceRole) => void
  onRemove?:       () => void
  showTeamsColumn: boolean
  isAdmin:         boolean
  isOwner?:        boolean
  divider?:        boolean
}

function MemberAvatar({ name }: { name: string }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const colors = [
    { bg: 'var(--purple-100)', text: 'var(--purple-700)' },
    { bg: 'var(--orange-100)', text: 'var(--orange-700)' },
    { bg: 'var(--green-100)',  text: 'var(--green-700)'  },
    { bg: 'var(--blue-100)',   text: 'var(--blue-700)'   },
  ]
  const idx = name.charCodeAt(0) % colors.length
  const { bg, text } = colors[idx]

  return (
    <div style={{
      width:           32,
      height:          32,
      borderRadius:    '50%',
      backgroundColor: bg,
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      flexShrink:      0,
      fontFamily:      'var(--font-body)',
      fontWeight:      500,
      fontSize:        12,
      color:           text,
    }}>
      {initials}
    </div>
  )
}

function InviteStatusBadge({ status }: { status: OrgMember['inviteStatus'] }) {
  if (status === 'signed_up') return null

  const cfg = status === 'invite_sent'
    ? { label: 'Invite sent', bg: 'var(--yellow-100)', color: 'var(--yellow-700)' }
    : { label: 'Not invited', bg: 'var(--neutral-100)', color: 'var(--neutral-500)' }

  return (
    <span style={{
      display:         'inline-flex',
      alignItems:      'center',
      padding:         '1px 6px',
      borderRadius:    4,
      backgroundColor: cfg.bg,
      fontFamily:      'var(--font-body)',
      fontWeight:      400,
      fontSize:        11,
      lineHeight:      '16px',
      color:           cfg.color,
      flexShrink:      0,
    }}>
      {cfg.label}
    </span>
  )
}

const confirmVariants = {
  open:   { height: 'auto' as const, opacity: 1, transition: { duration: 0.18, ease: 'easeOut' as const } },
  closed: { height: 0,              opacity: 0, transition: { duration: 0.14, ease: 'easeIn' as const  } },
}

export function MemberRow({
  member,
  isCurrentUser,
  onRoleChange,
  onRemove,
  showTeamsColumn,
  isAdmin,
  isOwner = false,
  divider = true,
}: MemberRowProps) {
  const availableRoles: WorkspaceRole[] = isOwner
    ? ['admin', 'editor', 'member']
    : ['editor', 'member']
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [menuOpen,      setMenuOpen]      = useState(false)

  const teamsDisplay = member.teamMemberships.length === 0
    ? '—'
    : member.teamMemberships.map(t => t.isTeamOwner ? `★ ${t.teamName}` : t.teamName).join(', ')

  return (
    <div style={{ borderBottom: divider ? '1px solid var(--neutral-100)' : undefined }}>
      <div style={{
        display:    'flex',
        alignItems: 'center',
        padding:    '10px 16px',
        gap:        12,
      }}>
        <MemberAvatar name={member.name} />

        <div style={{ flex: '1 0 0', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <p style={{
              fontFamily:   'var(--font-body)',
              fontWeight:   500,
              fontSize:     14,
              lineHeight:   '22px',
              color:        'var(--neutral-900)',
              margin:       0,
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}>
              {member.name}
              {isCurrentUser && (
                <span style={{ color: 'var(--neutral-400)', fontWeight: 400, marginLeft: 4 }}>(you)</span>
              )}
            </p>
            <InviteStatusBadge status={member.inviteStatus} />
          </div>
          <p style={{
            fontFamily:   'var(--font-body)',
            fontWeight:   400,
            fontSize:     12,
            lineHeight:   '16px',
            color:        'var(--neutral-400)',
            margin:       0,
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
            {member.email}
          </p>
        </div>

        {/* Role — dropdown if admin, not current user, and target is not a protected admin */}
        <div style={{ width: 100, flexShrink: 0 }}>
          {isAdmin && !isCurrentUser && onRoleChange && (isOwner || member.orgRole === 'member') ? (
            <DropdownFloat
              open={menuOpen}
              onOpenChange={setMenuOpen}
              placement="bottom-start"
              offset={4}
              trigger={
                <button
                  type="button"
                  style={{
                    display:    'inline-flex',
                    alignItems: 'center',
                    gap:        4,
                    padding:    0,
                    background: 'none',
                    border:     'none',
                    cursor:     'pointer',
                  }}
                >
                  <RoleBadge role={member.role} />
                  <ArrowDownOneIcon size={12} color="var(--neutral-500)" />
                </button>
              }
            >
              <Dropdown>
                {availableRoles.map(r => (
                  <DropdownMenuItem
                    key={r}
                    label={r.charAt(0).toUpperCase() + r.slice(1)}
                    selected={r === member.role}
                    onClick={() => { onRoleChange(r); setMenuOpen(false) }}
                  />
                ))}
              </Dropdown>
            </DropdownFloat>
          ) : (
            <RoleBadge role={member.role} />
          )}
        </div>

        {/* Teams column */}
        {showTeamsColumn && (
          <div style={{
            width:        140,
            flexShrink:   0,
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              fontSize:   12,
              lineHeight: '16px',
              color:      'var(--neutral-500)',
              margin:     0,
            }}>
              {teamsDisplay}
            </p>
          </div>
        )}

        {/* Remove button */}
        <div style={{ width: 80, flexShrink: 0 }}>
          {isAdmin && !isCurrentUser && onRemove && (isOwner || member.orgRole === 'member') && (
            <button
              onClick={() => setConfirmRemove(true)}
              style={{
                display:         'inline-flex',
                alignItems:      'center',
                justifyContent:  'center',
                padding:         '4px 8px',
                borderRadius:    6,
                border:          'none',
                cursor:          'pointer',
                backgroundColor: 'var(--neutral-white)',
                boxShadow:       '0px 0px 0px 1px var(--red-200)',
                fontFamily:      'var(--font-body)',
                fontWeight:      400,
                fontSize:        12,
                lineHeight:      '16px',
                color:           'var(--red-700)',
                whiteSpace:      'nowrap',
              }}
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Remove confirmation drawer */}
      <AnimatePresence initial={false}>
        {confirmRemove && (
          <motion.div
            key="confirm"
            initial="closed"
            animate="open"
            exit="closed"
            variants={confirmVariants}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              display:         'flex',
              alignItems:      'center',
              gap:             10,
              padding:         '8px 16px 8px 60px',
              backgroundColor: 'var(--red-50)',
              borderTop:       '1px solid var(--red-100)',
            }}>
              <p style={{
                flex:       '1 0 0',
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize:   13,
                lineHeight: '20px',
                color:      'var(--red-700)',
                margin:     0,
              }}>
                Remove {member.name} from workspace?
              </p>
              <button
                onClick={() => { onRemove?.(); setConfirmRemove(false) }}
                style={{
                  padding:         '4px 10px',
                  borderRadius:    6,
                  border:          'none',
                  cursor:          'pointer',
                  backgroundColor: 'var(--red-600)',
                  fontFamily:      'var(--font-body)',
                  fontWeight:      500,
                  fontSize:        12,
                  color:           'var(--neutral-white)',
                  flexShrink:      0,
                }}
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmRemove(false)}
                style={{
                  padding:         '4px 10px',
                  borderRadius:    6,
                  border:          'none',
                  cursor:          'pointer',
                  backgroundColor: 'transparent',
                  boxShadow:       '0px 0px 0px 1px var(--red-200)',
                  fontFamily:      'var(--font-body)',
                  fontWeight:      400,
                  fontSize:        12,
                  color:           'var(--neutral-600)',
                  flexShrink:      0,
                }}
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

MemberRow.displayName = 'MemberRow'
export default MemberRow
