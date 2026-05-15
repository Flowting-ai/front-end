'use client'

import React, { useState } from 'react'

// ── Shared buttons ─────────────────────────────────────────────────────────────

function WhiteButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        justifyContent:  'center',
        gap:             4,
        padding:         '6px 10px 8px',
        borderRadius:    10,
        border:          'none',
        cursor:          'pointer',
        backgroundColor: 'white',
        boxShadow:       '0px 1.091px 1.091px 0px rgba(59,54,50,0.05), 0px 1.455px 3.127px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-100), inset 0px -2.182px 0.364px 0px var(--neutral-100)',
        fontFamily:      'var(--font-body)',
        fontWeight:      500,
        fontSize:        14,
        lineHeight:      '22px',
        color:           'var(--neutral-700)',
        whiteSpace:      'nowrap',
        flexShrink:      0,
      }}
    >
      {children}
    </button>
  )
}

function GhostButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         '5px 8px',
        borderRadius:    8,
        border:          'none',
        cursor:          'pointer',
        backgroundColor: 'transparent',
        boxShadow:       '0px 0px 0px 1px rgba(59,54,50,0.3)',
        fontFamily:      'var(--font-body)',
        fontWeight:      500,
        fontSize:        14,
        lineHeight:      '22px',
        color:           'var(--neutral-700)',
        whiteSpace:      'nowrap',
        flexShrink:      0,
      }}
    >
      {children}
    </button>
  )
}

function RedButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
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
        boxShadow:       '0px 0px 0px 1px rgba(var(--red-100-rgb, 254,226,226),1), 0px 1px 1.5px 0px rgba(82,75,71,0.1)',
        fontFamily:      'var(--font-body)',
        fontWeight:      500,
        fontSize:        14,
        lineHeight:      '22px',
        color:           'var(--red-700)',
        whiteSpace:      'nowrap',
        flexShrink:      0,
      }}
    >
      {children}
    </button>
  )
}

function IconButton({ icon, onClick }: { icon: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        justifyContent:  'center',
        width:           32,
        height:          32,
        borderRadius:    8,
        border:          'none',
        cursor:          'pointer',
        backgroundColor: 'white',
        boxShadow:       '0px 1.091px 1.091px 0px rgba(59,54,50,0.05), 0px 1.455px 3.127px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-100)',
        flexShrink:      0,
      }}
    >
      {icon}
    </button>
  )
}

// ── Avatar ─────────────────────────────────────────────────────────────────────

function Avatar({ initials, size = 32 }: { initials: string; size?: number }) {
  const colors = [
    { bg: '#e8e0f8', text: '#5b3dbf' },
    { bg: '#fde8d8', text: '#c4540a' },
    { bg: '#d8f0e8', text: '#0f6b40' },
    { bg: '#fde8ef', text: '#c4124a' },
    { bg: '#dce8fd', text: '#1a45c4' },
  ]
  const idx = initials.charCodeAt(0) % colors.length
  const { bg, text } = colors[idx]
  return (
    <div style={{
      width:           size,
      height:          size,
      borderRadius:    '50%',
      backgroundColor: bg,
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      flexShrink:      0,
      fontFamily:      'var(--font-body)',
      fontWeight:      500,
      fontSize:        size * 0.35,
      color:           text,
    }}>
      {initials}
    </div>
  )
}

// ── Checkbox ──────────────────────────────────────────────────────────────────

function TableCheckbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <div
      onClick={onChange}
      style={{
        width:           16,
        height:          16,
        borderRadius:    4,
        border:          checked ? 'none' : '1.5px solid var(--neutral-300)',
        backgroundColor: checked ? 'var(--neutral-900)' : 'white',
        cursor:          'pointer',
        flexShrink:      0,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
      }}
    >
      {checked && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  )
}

// ── Role pill select ──────────────────────────────────────────────────────────

function RoleSelect({ role }: { role: string }) {
  return (
    <button style={{
      display:         'inline-flex',
      alignItems:      'center',
      gap:             4,
      padding:         '2px 8px',
      borderRadius:    6,
      border:          'none',
      cursor:          'pointer',
      backgroundColor: 'white',
      boxShadow:       '0px 1px 1.5px 0px rgba(82,75,71,0.08), 0px 0px 0px 1px var(--neutral-200)',
      fontFamily:      'var(--font-body)',
      fontWeight:      400,
      fontSize:        13,
      lineHeight:      '20px',
      color:           'var(--neutral-700)',
      whiteSpace:      'nowrap',
    }}>
      {role}
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M3 4.5l3 3 3-3" stroke="var(--neutral-500)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      border:       '1px solid var(--neutral-200)',
      borderRadius: 16,
      boxShadow:    '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
      overflow:     'hidden',
    }}>
      {children}
    </div>
  )
}

// ── Page data ─────────────────────────────────────────────────────────────────

const MEMBERS = [
  { id: 1, initials: 'SJ', name: 'Shyam Joshi',        email: 'contact@getsouvenir.com', role: 'Owner',  isOwner: true  },
  { id: 2, initials: 'AM', name: 'Alex Mitchell',       email: 'alex@getsouvenir.com',    role: 'Admin',  isOwner: false },
  { id: 3, initials: 'PR', name: 'Priya Rao',           email: 'priya@getsouvenir.com',   role: 'Member', isOwner: false },
  { id: 4, initials: 'TC', name: 'Tom Chen',            email: 'tom@getsouvenir.com',     role: 'Member', isOwner: false },
  { id: 5, initials: 'NL', name: 'Nina Larsson',        email: 'nina@getsouvenir.com',    role: 'Member', isOwner: false },
  { id: 6, initials: 'BK', name: 'Ben Kim',             email: 'ben@getsouvenir.com',     role: 'Member', isOwner: false },
]

const PENDING_INVITES = [
  { id: 1, initials: 'DP', email: 'designer@partnerco.com', sent: 'Invite sent 2 days ago' },
  { id: 2, initials: 'RS', email: 'reason@getsouvenir.com', sent: 'Invite sent 3 days ago' },
]

const ROLES = [
  {
    label:       'Owner',
    description: 'Full access including billing, workspace deletion, and ownership transfer. One per workspace.',
  },
  {
    label:       'Admin',
    description: 'Can manage members, approve personas and workflows, and change workspace settings. Cannot delete the workspace.',
  },
  {
    label:       'Member',
    description: 'Can use all workspace features within admin-set permissions. Cannot change settings or manage members.',
  },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrgMembersPage() {
  const [selectedMembers,  setSelectedMembers]  = useState<number[]>([])
  const [selectedInvites,  setSelectedInvites]  = useState<number[]>([])

  const toggleMember = (id: number) =>
    setSelectedMembers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const toggleInvite = (id: number) =>
    setSelectedInvites(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

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
      <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* ── Page header ── */}
        <div style={{ paddingLeft: 4, marginBottom: 4 }}>
          <h1 style={{
            fontFamily:   'var(--font-title)',
            fontWeight:   400,
            fontSize:     24,
            lineHeight:   '32px',
            color:        'var(--neutral-900)',
            margin:       0,
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
            Members
          </h1>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize:   14,
            lineHeight: '22px',
            color:      'var(--neutral-500)',
            margin:     0,
          }}>
            Manage who has access to your workspace and what they can do.
          </p>
        </div>

        {/* ── Stats row ── */}
        <div style={{
          border:       '1px solid var(--neutral-200)',
          borderRadius: 16,
          boxShadow:    '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
          padding:      12,
          display:      'flex',
          gap:          9,
        }}>
          {/* Total members */}
          <div style={{
            flex:            '1 0 0',
            minWidth:        0,
            backgroundColor: 'var(--neutral-50)',
            borderRadius:    12,
            padding:         12,
            display:         'flex',
            flexDirection:   'column',
            gap:             2,
          }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-500)', margin: 0 }}>
              Total members
            </p>
            <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 28, lineHeight: '36px', color: 'var(--neutral-900)', margin: 0 }}>
              6
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>
              unlimited seats available
            </p>
          </div>

          {/* Admins */}
          <div style={{
            flex:            '1 0 0',
            minWidth:        0,
            backgroundColor: 'white',
            borderRadius:    12,
            padding:         12,
            display:         'flex',
            flexDirection:   'column',
            gap:             2,
            boxShadow:       '0px 1px 2px 0px rgba(82,75,71,0.08), 0px 0px 0px 1px var(--neutral-100)',
          }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-500)', margin: 0 }}>
              Admins
            </p>
            <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 28, lineHeight: '36px', color: 'var(--neutral-900)', margin: 0 }}>
              2
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>
              Owner +1 admin
            </p>
          </div>

          {/* Pending invites */}
          <div style={{
            flex:            '1 0 0',
            minWidth:        0,
            backgroundColor: 'white',
            borderRadius:    12,
            padding:         12,
            display:         'flex',
            flexDirection:   'column',
            gap:             2,
            boxShadow:       '0px 1px 2px 0px rgba(82,75,71,0.08), 0px 0px 0px 1px var(--neutral-100)',
          }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-500)', margin: 0 }}>
              Pending invites
            </p>
            <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 28, lineHeight: '36px', color: 'var(--neutral-900)', margin: 0 }}>
              2
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>
              Awaiting acceptance
            </p>
          </div>
        </div>

        {/* ── Team Members card ── */}
        <Card>
          {/* Header */}
          <div style={{
            borderBottom: '1px solid var(--neutral-100)',
            padding:      '12px 16px',
            display:      'flex',
            alignItems:   'center',
            gap:          8,
          }}>
            <p style={{
              flex:       '1 0 0',
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              fontSize:   16,
              lineHeight: '22px',
              color:      'var(--neutral-900)',
              margin:     0,
            }}>
              Team Members
            </p>
            <IconButton icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="4.5" stroke="var(--neutral-500)" strokeWidth="1.4" />
                <path d="M10.5 10.5L13.5 13.5" stroke="var(--neutral-500)" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            } />
            <IconButton icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M13 4l-.8 9.2A1 1 0 0 1 11.2 14H4.8a1 1 0 0 1-1-.8L3 4" stroke="var(--neutral-500)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            } />
            <WhiteButton>Invite members</WhiteButton>
          </div>

          {/* Column headers */}
          <div style={{
            display:      'flex',
            alignItems:   'center',
            padding:      '6px 16px',
            borderBottom: '1px solid var(--neutral-100)',
            gap:          12,
          }}>
            <div style={{ width: 16 }} />
            <p style={{ flex: '1 0 0', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-500)', margin: 0 }}>
              Member
            </p>
            <p style={{ width: 120, fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-500)', margin: 0 }}>
              Role
            </p>
            <p style={{ width: 80, fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-500)', margin: 0 }}>
              Action
            </p>
          </div>

          {/* Member rows */}
          {MEMBERS.map((member, index) => (
            <div
              key={member.id}
              style={{
                display:      'flex',
                alignItems:   'center',
                padding:      '10px 16px',
                gap:          12,
                borderBottom: index < MEMBERS.length - 1 ? '1px solid var(--neutral-100)' : undefined,
              }}
            >
              <TableCheckbox
                checked={selectedMembers.includes(member.id)}
                onChange={() => toggleMember(member.id)}
              />
              <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar initials={member.initials} size={32} />
                <div style={{ flex: '1 0 0', minWidth: 0 }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {member.name}
                  </p>
                  <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {member.email}
                  </p>
                </div>
              </div>
              <div style={{ width: 120 }}>
                {member.isOwner ? (
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-500)' }}>
                    Owner
                  </span>
                ) : (
                  <RoleSelect role={member.role} />
                )}
              </div>
              <div style={{ width: 80 }}>
                {!member.isOwner && (
                  <RedButton>Remove</RedButton>
                )}
              </div>
            </div>
          ))}

          {/* Footer / pagination */}
          <div style={{
            display:      'flex',
            alignItems:   'center',
            padding:      '10px 16px',
            borderTop:    '1px solid var(--neutral-100)',
            gap:          8,
          }}>
            <p style={{
              flex:       '1 0 0',
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              fontSize:   13,
              lineHeight: '20px',
              color:      'var(--neutral-400)',
              margin:     0,
            }}>
              Showing 1–6 of 6 members
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button style={{ width: 28, height: 28, border: 'none', borderRadius: 6, backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M9 10.5L5 7l4-3.5" stroke="var(--neutral-400)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button style={{ width: 28, height: 28, border: 'none', borderRadius: 6, backgroundColor: 'var(--neutral-900)', cursor: 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, color: 'white' }}>
                1
              </button>
              <button style={{ width: 28, height: 28, border: 'none', borderRadius: 6, backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M5 3.5L9 7l-4 3.5" stroke="var(--neutral-400)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </Card>

        {/* ── Pending Invites card ── */}
        <Card>
          {/* Header */}
          <div style={{
            borderBottom: '1px solid var(--neutral-100)',
            padding:      '12px 16px',
            display:      'flex',
            alignItems:   'center',
            gap:          8,
          }}>
            <p style={{
              flex:       '1 0 0',
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              fontSize:   16,
              lineHeight: '22px',
              color:      'var(--neutral-900)',
              margin:     0,
            }}>
              Pending Invites
            </p>
            <div style={{
              display:         'inline-flex',
              alignItems:      'center',
              justifyContent:  'center',
              padding:         '2px 6px',
              borderRadius:    6,
              backgroundColor: 'var(--yellow-100)',
              boxShadow:       '0px 1px 1.5px 0px rgba(17,25,1,0.1), 0px 0px 0px 1px rgba(143,116,39,0.5)',
            }}>
              <span style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize:   11,
                lineHeight: '16px',
                color:      'var(--yellow-700)',
                whiteSpace: 'nowrap',
              }}>
                2 pending
              </span>
            </div>
          </div>

          {/* Invite rows */}
          {PENDING_INVITES.map((invite, index) => (
            <div
              key={invite.id}
              style={{
                display:      'flex',
                alignItems:   'center',
                padding:      '10px 16px',
                gap:          12,
                borderBottom: index < PENDING_INVITES.length - 1 ? '1px solid var(--neutral-100)' : undefined,
              }}
            >
              <TableCheckbox
                checked={selectedInvites.includes(invite.id)}
                onChange={() => toggleInvite(invite.id)}
              />
              <Avatar initials={invite.initials} size={32} />
              <div style={{ flex: '1 0 0', minWidth: 0 }}>
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {invite.email}
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>
                  {invite.sent}
                </p>
              </div>
              <GhostButton>Resend</GhostButton>
              <RedButton>Revoke</RedButton>
            </div>
          ))}
        </Card>

        {/* ── Roles & Permissions card ── */}
        <Card>
          <div style={{
            borderBottom: '1px solid var(--neutral-100)',
            padding:      '12px 24px 24px',
          }}>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              fontSize:   16,
              lineHeight: '22px',
              color:      'var(--neutral-900)',
              margin:     '0 0 6px',
            }}>
              Roles &amp; Permissions
            </p>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              fontSize:   14,
              lineHeight: '22px',
              color:      'var(--neutral-500)',
              margin:     0,
            }}>
              Understand what each role can do in your workspace.
            </p>
          </div>

          {ROLES.map((role, index) => (
            <div
              key={role.label}
              style={{
                display:      'flex',
                alignItems:   'flex-start',
                gap:          12,
                padding:      '12px 24px',
                borderBottom: index < ROLES.length - 1 ? '1px solid var(--neutral-100)' : undefined,
              }}
            >
              <div style={{
                display:         'inline-flex',
                alignItems:      'center',
                justifyContent:  'center',
                padding:         '2px 10px',
                borderRadius:    99,
                backgroundColor: 'white',
                boxShadow:       '0px 0px 0px 1px var(--neutral-200)',
                fontFamily:      'var(--font-body)',
                fontWeight:      500,
                fontSize:        13,
                lineHeight:      '20px',
                color:           'var(--neutral-700)',
                whiteSpace:      'nowrap',
                flexShrink:      0,
                marginTop:       1,
              }}>
                {role.label}
              </div>
              <p style={{
                flex:       '1 0 0',
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize:   14,
                lineHeight: '22px',
                color:      'var(--neutral-500)',
                margin:     0,
              }}>
                {role.description}
              </p>
            </div>
          ))}
        </Card>

      </div>
    </div>
  )
}
