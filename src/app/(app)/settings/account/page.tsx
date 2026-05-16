'use client'

import React, { useState } from 'react'
import { useAuth } from '@/context/auth-context'
import { InputField } from '@/components/InputField'
import { Button } from '@/components/Button'

// ── Section card wrapper ──────────────────────────────────────────────────────

function SettingsCard({
  children,
  danger,
}: {
  children: React.ReactNode
  danger?: boolean
}) {
  return (
    <div
      style={{
        border:        `1px solid ${danger ? 'var(--red-400)' : 'var(--neutral-200)'}`,
        borderRadius:  16,
        boxShadow:     '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
        display:       'flex',
        flexDirection: 'column',
        overflow:      'hidden',
        paddingTop:    12,
        paddingBottom: 12,
      }}
    >
      {children}
    </div>
  )
}

// ── Divider inside a card ─────────────────────────────────────────────────────

function CardSection({
  children,
  divider,
  padTop = 12,
  padBottom = 24,
}: {
  children: React.ReactNode
  divider?: boolean
  padTop?: number
  padBottom?: number
}) {
  return (
    <div
      style={{
        display:         'flex',
        flexDirection:   'column',
        padding:         `${padTop}px 24px ${padBottom}px`,
        borderBottom:    divider ? '1px solid var(--neutral-100)' : undefined,
      }}
    >
      {children}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AccountPage() {
  const { user } = useAuth()

  const initialFullName = user
    ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.name || ''
    : ''

  const [fullName,    setFullName]    = useState(initialFullName)
  const [displayName, setDisplayName] = useState(user?.name?.split(' ')[0] ?? '')
  const [isSaving,    setIsSaving]    = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    // TODO: wire to PATCH /api/backend/user endpoint
    await new Promise(r => setTimeout(r, 800))
    setIsSaving(false)
  }

  const handleDeleteAccount = () => {
    // TODO: open confirmation dialog before proceeding
  }

  return (
    <div
      className="kaya-scrollbar"
      style={{
        flex:          '1 0 0',
        minHeight:     0,
        overflowY:     'auto',
        overflowX:     'hidden',
        display:       'flex',
        alignItems:    'flex-start',
        justifyContent:'center',
        padding:       '96px 155px 48px',
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
            Account
          </h1>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize:   14,
            lineHeight: '22px',
            color:      'var(--neutral-500)',
            margin:     0,
          }}>
            Manage your personal profile, sign-in methods, and account settings.
          </p>
        </div>

        {/* ── Main profile card ── */}
        <SettingsCard>
          {/* Profile picture */}
          <CardSection divider padTop={12} padBottom={24}>
            <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
              {/* Avatar circle */}
              <div style={{
                width:        65,
                height:       65,
                borderRadius: 55,
                backgroundColor: 'var(--neutral-100)',
                boxShadow:    '0px 1.091px 1.09px 0px rgba(59,54,50,0.05), 0px 1.455px 1px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-100)',
                flexShrink:   0,
                overflow:     'hidden',
                position:     'relative',
              }} />

              {/* Controls */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 400,
                  fontSize:   16,
                  lineHeight: '22px',
                  color:      'var(--neutral-900)',
                  margin:     0,
                  overflow:   'hidden',
                  textOverflow:'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  Profile Picture
                </p>
                <button
                  style={{
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    padding:        '5px 8px',
                    borderRadius:   8,
                    border:         'none',
                    cursor:         'pointer',
                    backgroundColor:'transparent',
                    boxShadow:      '0px 0px 0px 1px rgba(59,54,50,0.3)',
                    fontFamily:     'var(--font-body)',
                    fontWeight:     500,
                    fontSize:       14,
                    lineHeight:     '22px',
                    color:          'var(--neutral-700)',
                  }}
                >
                  Change Avatar
                </button>
              </div>
            </div>
          </CardSection>

          {/* Full Name + Display Name */}
          <CardSection divider padTop={12} padBottom={24}>
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
              <InputField
                fluid
                label="Full Name"
                value={fullName}
                onChange={setFullName}
                placeholder="Your full name"
              />
              <InputField
                fluid
                label="Display Name"
                value={displayName}
                onChange={setDisplayName}
                placeholder="Display name"
                subtitle="Shown in team chats and persona attribution"
              />
            </div>
          </CardSection>

          {/* Role + Email (read-only) */}
          <CardSection padTop={12} padBottom={12}>
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
              <InputField
                fluid
                label="Role"
                value=""
                placeholder="-"
                disabled
              />
              <InputField
                fluid
                label="Email address"
                value={user?.email ?? ''}
                disabled
                subtitle="Used for billing and notifications"
              />
            </div>
          </CardSection>

          {/* Save changes */}
          <CardSection padTop={12} padBottom={12}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="default"
                size="sm"
                loading={isSaving}
                onClick={handleSave}
              >
                Save changes
              </Button>
            </div>
          </CardSection>
        </SettingsCard>

        {/* ── Danger Zone card ── */}
        <SettingsCard danger>
          {/* Header */}
          <CardSection divider padTop={6} padBottom={12}>
            <h2 style={{
              fontFamily:   'var(--font-body)',
              fontWeight:   500,
              fontSize:     16,
              lineHeight:   '22px',
              color:        'var(--red-400)',
              margin:       0,
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}>
              Danger Zone
            </h2>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              fontSize:   14,
              lineHeight: '22px',
              color:      'var(--neutral-500)',
              margin:     0,
            }}>
              Permanent actions that cannot be undone.
            </p>
          </CardSection>

          {/* Delete account row */}
          <CardSection padTop={6} padBottom={12}>
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end' }}>
              <div style={{ flex: '1 0 0', minWidth: 0 }}>
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
                  Delete account
                </p>
                <p style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 400,
                  fontSize:   14,
                  lineHeight: '22px',
                  color:      'var(--neutral-500)',
                  margin:     0,
                }}>
                  Permanently delete your account and all associated data, personas, workflows, and pins. This action cannot be undone.
                </p>
              </div>

              {/* Danger outline button */}
              <button
                onClick={handleDeleteAccount}
                style={{
                  flexShrink:     0,
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  padding:        '6px 10px 8px',
                  borderRadius:   10,
                  border:         'none',
                  cursor:         'pointer',
                  backgroundColor:'var(--neutral-white)',
                  boxShadow:      '0px 1.091px 1.091px 0px rgba(24,2,2,0.05), 0px 1.455px 3.127px 0px rgba(24,2,2,0.15), 0px 0px 0px 1px var(--red-100)',
                  fontFamily:     'var(--font-body)',
                  fontWeight:     500,
                  fontSize:       14,
                  lineHeight:     '22px',
                  color:          'var(--red-700)',
                  whiteSpace:     'nowrap',
                  position:       'relative',
                }}
              >
                <div
                  aria-hidden
                  style={{
                    position:     'absolute',
                    inset:        0,
                    borderRadius: 'inherit',
                    boxShadow:    'inset 0px -2.182px 0.364px 0px var(--red-100)',
                    pointerEvents:'none',
                  }}
                />
                Delete account
              </button>
            </div>
          </CardSection>
        </SettingsCard>

      </div>
    </div>
  )
}
