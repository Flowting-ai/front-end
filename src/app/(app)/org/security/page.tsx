'use client'

import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { SecurityToggleRow } from '@/components/SecurityToggleRow'
import { InputField } from '@/components/InputField'
import { Button } from '@/components/Button'
import { useOrg } from '@/context/org-context'
import { getOrgSettings, updateOrgSettings } from '@/lib/api/organization'
import type { HITLThreshold } from '@/types/teams'

const SHADOW_CARD = '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-200)'

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
      <div style={{ width: 967, maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
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
        boxShadow:       SHADOW_CARD,
        overflow:        'hidden',
        backgroundColor: 'var(--neutral-50)',
      }}
    >
      {children}
    </section>
  )
}

export default function OrgSecurityPage() {
  const { orgId, org, currentUserRole } = useOrg()
  const isAdmin = currentUserRole === 'admin'

  const [googleSSO,    setGoogleSSO]    = useState(false)
  const [msSSO,        setMsSSO]        = useState(false)
  const [domainOn,     setDomainOn]     = useState(false)
  const [domain,       setDomain]       = useState('')
  const [domainStatus, setDomainStatus] = useState<'idle' | 'verifying' | 'verified'>('idle')
  const [twoFA,        setTwoFA]        = useState(false)
  const [hitl,         setHitl]         = useState<HITLThreshold>(org.hitlThreshold)

  const [instructions,    setInstructions]    = useState('')
  const [emailDomains,    setEmailDomains]    = useState('')
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [savingSettings,  setSavingSettings]  = useState(false)

  useEffect(() => {
    if (!orgId) return
    setSettingsLoading(true)
    getOrgSettings(orgId)
      .then(s => {
        setInstructions(s.orgInstructions ?? '')
        setEmailDomains((s.allowedEmailDomains ?? []).join(', '))
      })
      .catch(console.error)
      .finally(() => setSettingsLoading(false))
  }, [orgId])

  const handleSaveSettings = async () => {
    if (!orgId) return
    setSavingSettings(true)
    try {
      await updateOrgSettings(orgId, {
        orgInstructions:     instructions || null,
        allowedEmailDomains: emailDomains.split(',').map(d => d.trim()).filter(Boolean),
      })
      toast.success('Settings saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSavingSettings(false)
    }
  }

  const handleVerify = () => {
    setDomainStatus('verifying')
    setTimeout(() => setDomainStatus('verified'), 2000)
  }

  return (
    <PageShell>
      <div>
        <h1 style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 28, color: 'var(--neutral-900)', margin: 0 }}>
          Security
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, color: 'var(--neutral-500)', margin: '4px 0 0' }}>
          Configure authentication and access controls for your workspace.
        </p>
      </div>

      {/* Workspace defaults */}
      <PageCard>
        <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--neutral-100)' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 15, color: 'var(--neutral-900)', margin: 0 }}>Workspace defaults</p>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, color: 'var(--neutral-500)', margin: '3px 0 0' }}>
            Applied to every AI session and new content in this workspace.
          </p>
        </div>
        <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 20, opacity: settingsLoading ? 0.6 : 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-700)', margin: 0 }}>
              Workspace instructions
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-500)', margin: 0 }}>
              Applied to every AI session in this workspace.
            </p>
            <textarea
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              disabled={!isAdmin || settingsLoading}
              placeholder="e.g. Always respond in formal English. Reference our brand guide."
              style={{
                minHeight:       88,
                resize:          'vertical',
                border:          'none',
                borderRadius:    10,
                padding:         '10px 12px',
                backgroundColor: 'var(--neutral-white)',
                boxShadow:       '0px 1px 1.5px 0px rgba(82,75,71,0.08), 0px 0px 0px 1px var(--neutral-100)',
                fontFamily:      'var(--font-body)',
                fontSize:        14,
                lineHeight:      '22px',
                color:           'var(--neutral-900)',
                outline:         '2px solid transparent',
                outlineOffset:   3,
                width:           '100%',
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-700)', margin: 0 }}>
              Allowed email domains
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-500)', margin: 0 }}>
              Comma-separated list of domains that can access this workspace (e.g. acme.com, acme.io).
            </p>
            <InputField
              value={emailDomains}
              onChange={setEmailDomains}
              placeholder="acme.com, acme.io"
              disabled={!isAdmin || settingsLoading}
            />
          </div>
          {isAdmin && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="default"
                size="sm"
                onClick={handleSaveSettings}
                disabled={savingSettings || settingsLoading}
              >
                {savingSettings ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          )}
        </div>
      </PageCard>

      {/* Authentication card */}
      <PageCard>
        <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--neutral-100)' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 15, color: 'var(--neutral-900)', margin: 0 }}>Authentication</p>
        </div>

        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--neutral-100)' }}>
          <SecurityToggleRow
            type="toggle"
            label="Google OAuth SSO"
            description="Let members sign in with their Google account"
            isEnabled={googleSSO}
            onToggle={isAdmin ? () => setGoogleSSO(v => !v) : undefined}
          />
        </div>

        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--neutral-100)' }}>
          <SecurityToggleRow
            type="toggle"
            label="Microsoft OAuth SSO"
            description="Let members sign in with their Microsoft account"
            isEnabled={msSSO}
            onToggle={isAdmin ? () => setMsSSO(v => !v) : undefined}
          />
        </div>

        {/* Domain claiming with inline DNS verification flow */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--neutral-100)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SecurityToggleRow
            type="toggle"
            label="Domain Claiming"
            description="Users who sign up with a verified email domain auto-join this workspace"
            isEnabled={domainOn}
            onToggle={isAdmin ? () => { setDomainOn(v => !v); if (!domainOn) setDomainStatus('idle') } : undefined}
            status={domainStatus === 'verifying' ? 'pending' : 'active'}
            pendingLabel="Verifying…"
          />
          {domainOn && domainStatus !== 'verified' && isAdmin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 2 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <InputField
                  value={domain}
                  onChange={setDomain}
                  placeholder="yourdomain.com"
                  style={{ maxWidth: 280 }}
                />
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleVerify}
                  disabled={!domain.trim() || domainStatus === 'verifying'}
                >
                  Verify domain
                </Button>
              </div>
              {domain.trim() && domainStatus === 'idle' && (
                <div style={{ padding: '10px 12px', borderRadius: 8, backgroundColor: 'var(--neutral-50)', border: '1px solid var(--neutral-200)' }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12, color: 'var(--neutral-700)', margin: '0 0 4px' }}>
                    Add this DNS TXT record to verify ownership:
                  </p>
                  <code style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--neutral-600)' }}>
                    souvenir-verify=sv_01abcdef1234
                  </code>
                </div>
              )}
              {domainStatus === 'verifying' && (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-400)', margin: 0 }}>
                  Checking DNS records…
                </p>
              )}
            </div>
          )}
          {domainOn && domainStatus === 'verified' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 2 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <circle cx="7" cy="7" r="6" fill="var(--color-tag-Green-bg-soft)" stroke="var(--color-tag-Green-text)" strokeWidth="1" />
                <path d="M4 7l2 2 4-4" stroke="var(--color-tag-Green-text)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-tag-Green-text)' }}>
                {domain} verified
              </span>
            </div>
          )}
        </div>

        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--neutral-100)' }}>
          <SecurityToggleRow
            type="toggle"
            label="2FA Enforcement"
            description="Require all workspace members to enable two-factor authentication"
            isEnabled={twoFA}
            onToggle={isAdmin ? () => setTwoFA(v => !v) : undefined}
          />
        </div>

        {/* SAML — Enterprise only, always disabled */}
        <div style={{ padding: '16px 24px' }}>
          <SecurityToggleRow
            type="toggle"
            label="SAML 2.0 / SCIM"
            description="Enterprise only — upgrade to access SSO provisioning and directory sync"
            isEnabled={false}
            status="disabled"
          />
        </div>
      </PageCard>

      {/* HITL Approval Threshold card */}
      <PageCard>
        <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--neutral-100)' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 15, color: 'var(--neutral-900)', margin: 0 }}>Approval Threshold</p>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, color: 'var(--neutral-500)', margin: '3px 0 0' }}>
            When Brain should pause and ask for approval before taking actions. Applies workspace-wide.
          </p>
        </div>
        <div style={{ padding: '16px 24px', opacity: isAdmin ? 1 : 0.5, pointerEvents: isAdmin ? 'auto' : 'none' }}>
          <SecurityToggleRow
            type="radio"
            label="HITL Threshold"
            description=""
            value={hitl}
            onChange={(v) => setHitl(v as HITLThreshold)}
            options={[
              { value: 'auto',        label: 'Auto-proceed everything',               description: 'Brain never asks for approval. All actions run automatically.' },
              { value: 'tier_3_plus', label: 'Ask for Tier 3+ actions (recommended)', description: 'Brain pauses before delete, send, or publish actions.' },
              { value: 'everything',  label: 'Ask for everything',                    description: 'Brain asks before any write action. Maximum control.' },
            ]}
          />
        </div>
      </PageCard>
    </PageShell>
  )
}
