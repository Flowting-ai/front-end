'use client'

import React, { useState } from 'react'
import { MoreVerticalIcon } from '@strange-huge/icons'
import { useAuth } from '@/context/auth-context'

// ── Inline SVGs ───────────────────────────────────────────────────────────────

function DeviceIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2.5" y="3" width="15" height="10.5" rx="1.5" stroke="rgba(82,75,71,0.65)" strokeWidth="1.4" />
      <path d="M7 16.5h6M10 13.5v3" stroke="rgba(82,75,71,0.65)" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18.17 10.23c0-.63-.06-1.25-.17-1.84H10v3.48h4.62a3.95 3.95 0 01-1.71 2.59v2.15h2.77C17.12 15.1 18.17 12.87 18.17 10.23z" fill="#4285F4" />
      <path d="M10 18.5c2.35 0 4.32-.78 5.76-2.1l-2.77-2.15c-.77.52-1.76.82-2.99.82-2.3 0-4.25-1.55-4.95-3.64H2.2v2.22A8.5 8.5 0 0010 18.5z" fill="#34A853" />
      <path d="M5.05 11.43A5.1 5.1 0 014.78 10c0-.5.09-1 .27-1.43V6.35H2.2A8.5 8.5 0 001.5 10c0 1.37.33 2.67.7 3.65l2.85-2.22z" fill="#FBBC04" />
      <path d="M10 4.93c1.3 0 2.46.45 3.38 1.33l2.53-2.53A8.47 8.47 0 0010 1.5a8.5 8.5 0 00-7.8 4.85l2.85 2.22C5.75 6.48 7.7 4.93 10 4.93z" fill="#EA4335" />
    </svg>
  )
}

// ── Shared badge styles ───────────────────────────────────────────────────────

function GreenBadge({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display:         'inline-flex',
      alignItems:      'center',
      justifyContent:  'center',
      padding:         2,
      borderRadius:    6,
      backgroundColor: 'var(--green-50)',
      boxShadow:       '0px 1px 1.5px 0px rgba(17,25,1,0.2), 0px 0px 0px 1px rgba(128,183,7,0.5), inset 0px 1px 0px 0px rgba(247,254,230,0.7), inset 0px -1px 0px 0px rgba(128,183,7,0.1)',
      flexShrink:      0,
    }}>
      <span style={{
        fontFamily: 'var(--font-body)',
        fontWeight: 500,
        fontSize: 12,
        lineHeight: '16px',
        color:      'var(--green-800)',
        padding:    '0 2px',
        whiteSpace: 'nowrap',
      }}>
        {children}
      </span>
    </div>
  )
}

function BrownBadge({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display:         'inline-flex',
      alignItems:      'center',
      justifyContent:  'center',
      padding:         2,
      borderRadius:    6,
      backgroundColor: 'var(--brown-100)',
      boxShadow:       '0px 1px 1.5px 0px rgba(20,12,5,0.2), 0px 0px 0px 1px rgba(126,84,53,0.5), inset 0px 1px 0px 0px rgba(250,241,235,0.7), inset 0px -1px 0px 0px rgba(126,84,53,0.1)',
      flexShrink:      0,
    }}>
      <span style={{
        fontFamily: 'var(--font-body)',
        fontWeight: 500,
        fontSize: 12,
        lineHeight: '16px',
        color:      'var(--brown-700)',
        padding:    '0 2px',
        whiteSpace: 'nowrap',
      }}>
        {children}
      </span>
    </div>
  )
}

function YellowBadge({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display:         'inline-flex',
      alignItems:      'center',
      justifyContent:  'center',
      padding:         2,
      borderRadius:    6,
      backgroundColor: '#e9dfc9',
      boxShadow:       '0px 1px 1.5px 0px rgba(20,16,5,0.2), 0px 0px 0px 1px rgba(143,116,39,0.5), inset 0px 1px 0px 0px rgba(250,246,235,0.7), inset 0px -1px 0px 0px rgba(143,116,39,0.1)',
      flexShrink:      0,
    }}>
      <span style={{
        fontFamily: 'var(--font-body)',
        fontWeight: 500,
        fontSize: 12,
        lineHeight: '16px',
        color:      '#6d5921',
        padding:    '0 2px',
        whiteSpace: 'nowrap',
      }}>
        {children}
      </span>
    </div>
  )
}

// ── Card shell ────────────────────────────────────────────────────────────────

function SecurityCard({ children }: { children: React.ReactNode }) {
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

function CardHeader({ title, subtitle, right }: {
  title:    React.ReactNode
  subtitle: string
  right?:   React.ReactNode
}) {
  return (
    <div style={{
      borderBottom:  '1px solid var(--neutral-100)',
      padding:       '12px 24px 24px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{ flex: '1 0 0', minWidth: 0 }}>
          {typeof title === 'string' ? (
            <p style={{
              fontFamily:   'var(--font-body)',
              fontWeight:   500,
              fontSize:     16,
              lineHeight:   '22px',
              color:        'var(--neutral-900)',
              margin:       0,
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}>
              {title}
            </p>
          ) : title}
        </div>
        {right}
      </div>
      <p style={{
        fontFamily:   'var(--font-body)',
        fontWeight:   400,
        fontSize:     14,
        lineHeight:   '22px',
        color:        'var(--neutral-500)',
        margin:       0,
        overflow:     'hidden',
        textOverflow: 'ellipsis',
        whiteSpace:   'nowrap',
      }}>
        {subtitle}
      </p>
    </div>
  )
}

// ── Ghost button (outline, transparent bg) ────────────────────────────────────

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

// ── Session row ───────────────────────────────────────────────────────────────

function SessionRow({
  browser,
  location,
  lastActive,
  isCurrent,
  divider,
}: {
  browser:    string
  location:   string
  lastActive: string
  isCurrent?: boolean
  divider?:   boolean
}) {
  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      gap:          16,
      padding:      '12px 24px 24px',
      borderBottom: divider ? '1px solid var(--neutral-100)' : undefined,
    }}>
      {/* Device icon */}
      <div style={{
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         8,
        borderRadius:    8,
        backgroundColor: 'var(--neutral-200)',
        boxShadow:       '0px 0px 0px 1px rgba(59,54,50,0.3)',
        flexShrink:      0,
      }}>
        <DeviceIcon />
      </div>

      {/* Text */}
      <div style={{ flex: '1 0 0', minWidth: 0 }}>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 500,
          fontSize:   14,
          lineHeight: '22px',
          color:      'var(--neutral-900)',
          margin:     0,
        }}>
          {browser}
        </p>
        <div style={{
          display:    'flex',
          gap:        6,
          alignItems: 'center',
        }}>
          <span style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize: 12,
            lineHeight: '16px',
            color:      'var(--neutral-500)',
            whiteSpace: 'nowrap',
          }}>
            {location}
          </span>
          <span style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize: 12,
            lineHeight: '16px',
            color:      'var(--neutral-500)',
            whiteSpace: 'nowrap',
          }}>
            {lastActive}
          </span>
        </div>
      </div>

      {/* Current badge (only on active session) */}
      {isCurrent && <GreenBadge>Current</GreenBadge>}

      {/* 3-dot menu button */}
      <button style={{
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         6,
        borderRadius:    8,
        border:          '0.727px solid rgba(59,54,50,0.3)',
        cursor:          'pointer',
        backgroundColor: 'transparent',
        flexShrink:      0,
        lineHeight:      0,
      }}>
        <MoreVerticalIcon size={20} color="var(--neutral-700)" />
      </button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const SESSIONS = [
  { browser: 'Chrome on macOS',       location: 'New Delhi, IN', lastActive: 'Last active: Now',          isCurrent: true  },
  { browser: 'Safari on iPhone 17 Pro', location: 'New Delhi, IN', lastActive: 'Last active: 2 hours ago', isCurrent: false },
  { browser: 'Safari on iPhone 17 Pro', location: 'New Delhi, IN', lastActive: 'Last active: 2 hours ago', isCurrent: false },
  { browser: 'Safari on iPhone 17 Pro', location: 'New Delhi, IN', lastActive: 'Last active: 2 hours ago', isCurrent: false },
]

export default function SecurityPage() {
  const { logout } = useAuth()
  const [sessions, setSessions] = useState(SESSIONS)

  const removeSession = (index: number) => {
    setSessions(prev => prev.filter((_, i) => i !== index))
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
      <div style={{ width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 10 }}>

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
            Security
          </h1>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize:   14,
            lineHeight: '22px',
            color:      'var(--neutral-500)',
            margin:     0,
          }}>
            Protect your account with two-factor authentication and manage active sessions.
          </p>
        </div>

        {/* ── Two-factor authentication card ── */}
        <SecurityCard>
          <CardHeader
            title="Two-factor authentication"
            subtitle="Add an extra layer of security to your account by requiring a verification code at sign-in."
          />
          <div style={{ padding: '12px 24px' }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius:    8,
              boxShadow:       '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
              padding:         12,
              display:         'flex',
              alignItems:      'center',
              gap:             12,
            }}>
              {/* Left: status + description */}
              <div style={{ width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <YellowBadge>Not enabled</YellowBadge>
                  <span style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 500,
                    fontSize: 12,
                    lineHeight: '16px',
                    color:      '#a28847',
                  }}>
                    Recommended
                  </span>
                </div>
                <p style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 400,
                  fontSize: 12,
                  lineHeight: '16px',
                  color:      'var(--neutral-500)',
                  margin:     0,
                }}>
                  Protect your account against unauthorised access
                </p>
              </div>

              {/* Enable 2FA dark button */}
              <button style={{
                display:         'inline-flex',
                alignItems:      'center',
                justifyContent:  'center',
                padding:         '6px 10px 8px',
                borderRadius:    10,
                border:          'none',
                cursor:          'pointer',
                background:      'linear-gradient(to bottom, var(--neutral-700), var(--neutral-900))',
                boxShadow:       '0px 0px 0px 1px black, 0px 1.091px 1.091px 0px rgba(59,54,50,0.1), 0px 1.455px 3.127px 0px rgba(59,54,50,0.4), inset 0px 1px 0.364px 0px rgba(247,242,237,0.3), inset 0px -2.182px 0.364px 0px #120c08, inset 0px -2.545px 4px -2.182px rgba(247,242,237,0.5)',
                fontFamily:      'var(--font-body)',
                fontWeight:      500,
                fontSize:        14,
                lineHeight:      '22px',
                color:           'var(--neutral-50)',
                whiteSpace:      'nowrap',
                flexShrink:      0,
              }}>
                Enable 2FA
              </button>
            </div>
          </div>
        </SecurityCard>

        {/* ── Password card ── */}
        <SecurityCard>
          <CardHeader
            title="Password"
            subtitle="Manage the password used to sign in to your Souvenir account."
          />
          <div style={{ padding: '12px 24px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            {/* Password field + badge */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Masked password display */}
              <div style={{
                width:           327,
                height:          36,
                backgroundColor: 'white',
                borderRadius:    10,
                boxShadow:       '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
                display:         'flex',
                alignItems:      'center',
                padding:         '0 12px',
                flexShrink:      0,
              }}>
                <span style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 400,
                  fontSize:   14,
                  lineHeight: '22px',
                  color:      'var(--neutral-500)',
                  letterSpacing: '0.04em',
                }}>
                  ••••••••••••••••
                </span>
              </div>

              <GreenBadge>Last changed 45 days ago</GreenBadge>
            </div>

            {/* Change password button */}
            <button style={{
              display:         'inline-flex',
              alignItems:      'center',
              justifyContent:  'center',
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
            }}>
              Change password
            </button>
          </div>
        </SecurityCard>

        {/* ── Active sessions card ── */}
        <SecurityCard>
          <CardHeader
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontFamily:   'var(--font-body)',
                  fontWeight:   500,
                  fontSize:     16,
                  lineHeight:   '22px',
                  color:        'var(--neutral-900)',
                  overflow:     'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace:   'nowrap',
                }}>
                  Active sessions
                </span>
                <BrownBadge>{sessions.length} sessions</BrownBadge>
              </div>
            }
            subtitle="Protect your account - review and remove sessions you don't recognise."
            right={<GhostButton onClick={() => { void logout() }}>Log out all devices</GhostButton>}
          />
          {sessions.map((session, i) => (
            // eslint-disable-next-line react/no-array-index-as-key, react-doctor/no-array-index-as-key -- sessions are ordered by recency, index is stable
            <SessionRow key={i}
              browser={session.browser}
              location={session.location}
              lastActive={session.lastActive}
              isCurrent={session.isCurrent}
              divider={i < sessions.length - 1}
            />
          ))}
        </SecurityCard>

        {/* ── Sign-In methods card ── */}
        <SecurityCard>
          <CardHeader
            title="Sign-In methods"
            subtitle="External accounts you can use to sign into Souvenir."
          />

          {/* Google row */}
          <div style={{
            display:    'flex',
            alignItems: 'center',
            gap:        16,
            padding:    '12px 24px',
          }}>
            {/* Google icon button */}
            <div style={{
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              padding:         8,
              borderRadius:    10,
              backgroundColor: 'transparent',
              boxShadow:       '0px 0px 0px 1px rgba(59,54,50,0.3)',
              flexShrink:      0,
            }}>
              <GoogleIcon />
            </div>

            {/* Text */}
            <div style={{ flex: '1 0 0', minWidth: 0 }}>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize:   14,
                lineHeight: '22px',
                color:      'var(--neutral-900)',
                margin:     0,
              }}>
                Google
              </p>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize: 12,
                lineHeight: '16px',
                color:      'var(--neutral-500)',
                margin:     0,
                whiteSpace: 'nowrap',
              }}>
                contact@getsouvenir.com
              </p>
            </div>

            <GreenBadge>Connected</GreenBadge>

            {/* Disconnect red button */}
            <button style={{
              display:         'inline-flex',
              alignItems:      'center',
              justifyContent:  'center',
              padding:         '5px 8px',
              borderRadius:    8,
              border:          'none',
              cursor:          'pointer',
              position:        'relative',
              backgroundColor: 'white',
              boxShadow:       '0px 1.091px 1.091px 0px rgba(24,2,2,0.05), 0px 1.455px 3.127px 0px rgba(24,2,2,0.15), 0px 0px 0px 1px var(--red-100), inset 0px -2.182px 0.364px 0px var(--red-100)',
              fontFamily:      'var(--font-body)',
              fontWeight:      500,
              fontSize:        14,
              lineHeight:      '22px',
              color:           'var(--red-700)',
              whiteSpace:      'nowrap',
              flexShrink:      0,
            }}>
              Disconnect
            </button>
          </div>
        </SecurityCard>

      </div>
    </div>
  )
}
