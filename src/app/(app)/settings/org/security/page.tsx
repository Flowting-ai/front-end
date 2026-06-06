'use client'

import React, { useState } from 'react'
import { Button } from '@/components/Button'
import { Checkbox } from '@/components/Checkbox'
import { InputField } from '@/components/InputField'
import { Switch } from '@/components/Switch'
import { useOrg } from '@/context/org-context'
import type { HITLThreshold } from '@/types/teams'

function PageShell({ children }: { children: React.ReactNode }) {
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
      <div style={{ width: 967, maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: 32 }}>
        {children}
      </div>
    </div>
  )
}

function PageCard({ children }: { children: React.ReactNode }) {
  return (
    <section
      style={{
        width:           '100%',
        border:          '1px solid var(--neutral-200)',
        borderRadius:    16,
        boxShadow:       '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
        overflow:        'hidden',
        backgroundColor: 'var(--neutral-50)',
      }}
    >
      {children}
    </section>
  )
}

function BodyText({
  children,
  size = 14,
  color = 'var(--neutral-500)',
  weight = 400,
  family = 'var(--font-body)',
  style,
}: {
  children: React.ReactNode
  size?: 11 | 12 | 14 | 16 | 24
  color?: string
  weight?: 400 | 500 | 600
  family?: string
  style?: React.CSSProperties
}) {
  const lineHeight = size === 24 ? '32px' : size === 11 || size === 12 ? '16px' : '22px'

  return (
    <p
      style={{
        fontFamily: family,
        fontWeight: weight,
        fontSize:   size,
        lineHeight,
        color,
        margin:     0,
        ...style,
      }}
    >
      {children}
    </p>
  )
}

function CardHeader({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div style={{ padding: '12px 24px 24px', borderBottom: '1px solid var(--neutral-100)', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <BodyText weight={500} color="var(--neutral-900)">{title}</BodyText>
      {description && <BodyText>{description}</BodyText>}
    </div>
  )
}

function SettingsRow({
  title,
  description,
  children,
  divider = true,
}: {
  title: string
  description: string
  children: React.ReactNode
  divider?: boolean
}) {
  return (
    <div
      style={{
        padding:      '16px 24px',
        borderBottom: divider ? '1px solid var(--neutral-100)' : undefined,
        display:      'flex',
        alignItems:   'center',
        gap:          24,
      }}
    >
      <div style={{ flex: '1 0 0', minWidth: 0 }}>
        <BodyText weight={500} color="var(--neutral-900)">{title}</BodyText>
        <BodyText size={12}>{description}</BodyText>
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  )
}

export default function OrgSecurityPage() {
  const { org, currentUserRole } = useOrg()
  const isAdmin = currentUserRole === 'admin'

  const [googleSSO,      setGoogleSSO]      = useState(false)
  const [microsoftSSO,   setMicrosoftSSO]   = useState(false)
  const [domainClaiming, setDomainClaiming] = useState(false)
  const [twoFA,          setTwoFA]          = useState(false)
  const [hitlThreshold,  setHitlThreshold]  = useState<HITLThreshold>(org.hitlThreshold)
  const [domain,         setDomain]         = useState('')
  const [dnsShown,       setDnsShown]       = useState(false)

  const hitlOptions: { value: HITLThreshold; label: string; description: string }[] = [
    { value: 'auto',        label: 'Auto-proceed everything',                description: 'Brain never asks for approval.' },
    { value: 'tier_3_plus', label: 'Ask for Tier 3+ actions (recommended)', description: 'Brain asks before delete, send, or publish.' },
    { value: 'everything',  label: 'Ask for everything',                    description: 'Brain asks before any write action.' },
  ]

  return (
    <PageShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ minHeight: 36 }}>
          <h1 style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: '#1a1916', margin: 0 }}>
            Security
          </h1>
          <BodyText>Configure authentication and access controls for your workspace.</BodyText>
        </div>
      </div>

      <PageCard>
        <CardHeader title="Authentication" />
        <SettingsRow
          title="Google OAuth SSO"
          description="Let members sign in with their Google account."
        >
          <Switch checked={googleSSO} disabled={!isAdmin} onCheckedChange={setGoogleSSO} />
        </SettingsRow>

        <SettingsRow
          title="Microsoft OAuth SSO"
          description="Let members sign in with their Microsoft account."
        >
          <Switch checked={microsoftSSO} disabled={!isAdmin} onCheckedChange={setMicrosoftSSO} />
        </SettingsRow>

        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--neutral-100)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ flex: '1 0 0', minWidth: 0 }}>
              <BodyText weight={500} color="var(--neutral-900)">Domain claiming</BodyText>
              <BodyText size={12}>Users who sign up with a verified domain email auto-join this workspace.</BodyText>
            </div>
            <Switch checked={domainClaiming} disabled={!isAdmin} onCheckedChange={setDomainClaiming} />
          </div>

          {domainClaiming && isAdmin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
                <InputField
                  fluid
                  label="Workspace domain"
                  placeholder="yourdomain.com"
                  value={domain}
                  onChange={setDomain}
                />
                <Button variant="default" size="md" onClick={() => setDnsShown(true)}>Verify domain</Button>
              </div>
              {dnsShown && (
                <div
                  style={{
                    padding:         12,
                    borderRadius:    12,
                    backgroundColor: 'white',
                    boxShadow:       '0px 0px 0px 1px var(--neutral-200)',
                    display:         'flex',
                    flexDirection:   'column',
                    gap:             4,
                  }}
                >
                  <BodyText size={12} weight={500} color="var(--neutral-700)">Add this DNS TXT record to verify ownership:</BodyText>
                  <code style={{ fontFamily: 'monospace', fontSize: 12, lineHeight: '16px', color: 'var(--neutral-600)' }}>
                    souvenir-verify=sv_01abcdef1234
                  </code>
                </div>
              )}
            </div>
          )}
        </div>

        <SettingsRow
          title="2FA enforcement"
          description="Require all workspace members to enable two-factor authentication."
          divider={false}
        >
          <Switch checked={twoFA} disabled={!isAdmin} onCheckedChange={setTwoFA} />
        </SettingsRow>
      </PageCard>

      <PageCard>
        <CardHeader
          title="HITL Approval Threshold"
          description="When Brain should pause and ask for approval before taking actions."
        />
        <div
          style={{
            padding:       '16px 24px',
            display:       'flex',
            flexDirection: 'column',
            gap:           12,
            opacity:       isAdmin ? 1 : 0.5,
            pointerEvents: isAdmin ? 'auto' : 'none',
          }}
        >
          {hitlOptions.map((option, index) => {
            const selected = hitlThreshold === option.value

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setHitlThreshold(option.value)}
                style={{
                  padding:         0,
                  border:          'none',
                  backgroundColor: 'transparent',
                  display:         'flex',
                  alignItems:      'flex-start',
                  gap:             10,
                  cursor:          'pointer',
                  textAlign:       'left',
                  paddingBottom:   index === hitlOptions.length - 1 ? 0 : 12,
                  borderBottom:    index === hitlOptions.length - 1 ? undefined : '1px solid var(--neutral-100)',
                }}
              >
                <Checkbox
                  checked={selected}
                  onCheckedChange={() => setHitlThreshold(option.value)}
                  aria-label={option.label}
                  style={{ marginTop: 3 }}
                />
                <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <BodyText weight={500} color="var(--neutral-900)">{option.label}</BodyText>
                  <BodyText size={12}>{option.description}</BodyText>
                </span>
              </button>
            )
          })}
        </div>
      </PageCard>
    </PageShell>
  )
}
