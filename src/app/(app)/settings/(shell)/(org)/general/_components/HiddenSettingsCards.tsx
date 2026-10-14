'use client'

import React from 'react'
import { DeleteTwoIcon } from '@strange-huge/icons'
import { Button, IconButton } from '@/components/ui/button'
import { Card, CardHeader, TextInput, VisibilitySelect } from './GeneralParts'
import type { OrgSettings } from './use-org-settings'

// Both cards are switched off on the page (SHOW_ALLOWED_DOMAINS, SHOW_WORKSPACE_DEFAULTS) until
// the product turns them on; they are wired to the org settings API.

/** Email domains that may join the workspace. */
export function AllowedDomainsCard({ settings }: { settings: OrgSettings }) {
  const { allowedDomains, setAllowedDomains, showAddDomain, setShowAddDomain, addDomainInput, setAddDomainInput, settingsLoading, settingsSaving, handleSaveDomains } = settings
  return (
    <Card>
      <div style={{
        borderBottom: '1px solid var(--neutral-100)',
        padding:      '12px 24px',
        display:      'flex',
        alignItems:   'center',
        gap:          12,
      }}>
        <p style={{
          flex:       '1 0 0',
          minWidth:   0,
          fontFamily: 'var(--font-body)',
          fontWeight: 500,
          fontSize:   16,
          lineHeight: '22px',
          color:      'var(--neutral-900)',
          margin:     0,
        }}>
          Allowed email domains
        </p>
        <Button variant="secondary" size="sm" onClick={() => { setShowAddDomain(true); setAddDomainInput('') }}>+ Add domain</Button>
      </div>

      <div style={{ padding: '12px 24px', display: 'flex', flexDirection: 'column', gap: 12, opacity: settingsLoading ? 0.6 : 1 }}>
        {allowedDomains.length === 0 && !showAddDomain ? (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>
            No allowed domains configured.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {allowedDomains.map(domain => (
              <div key={domain} style={{
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'space-between',
                gap:             8,
                padding:         '10px 8px 10px 14px',
                borderRadius:    10,
                border:          '1px solid var(--border-default)',
                backgroundColor: 'var(--neutral-white)',
              }}>
                <span style={{
                  flex:         '1 0 0',
                  minWidth:     0,
                  fontFamily:   'var(--font-body)',
                  fontWeight:   500,
                  fontSize:     14,
                  color:        'var(--neutral-900)',
                  overflow:     'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace:   'nowrap',
                }}>
                  {domain}
                </span>
                <IconButton
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove ${domain}`}
                  icon={<DeleteTwoIcon size={16} />}
                  onClick={() => setAllowedDomains(ds => ds.filter(d => d !== domain))}
                />
              </div>
            ))}
          </div>
        )}
        {showAddDomain && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TextInput
              value={addDomainInput}
              onChange={setAddDomainInput}
              placeholder="example.com"
              style={{ flex: '1 0 0' }}
            />
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                const domain = addDomainInput.trim().toLowerCase()
                if (!domain) return
                if (!allowedDomains.includes(domain)) {
                  setAllowedDomains(ds => [...ds, domain])
                }
                setShowAddDomain(false)
                setAddDomainInput('')
              }}
            >
              Add
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setShowAddDomain(false); setAddDomainInput('') }}
            >
              Cancel
            </Button>
          </div>
        )}
        {allowedDomains.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
            <Button
              variant="default"
              size="sm"
              onClick={handleSaveDomains}
              disabled={settingsSaving}
            >
              {settingsSaving ? 'Saving…' : 'Save domains'}
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}

/** Default visibility for new chats and agents. */
export function WorkspaceDefaultsCard({ settings }: { settings: OrgSettings }) {
  const { defaultChatVisibility, setDefaultChatVisibility, defaultPersonaVisibility, setDefaultPersonaVisibility, settingsLoading, settingsSaving, handleSaveDefaults } = settings
  return (
    <Card>
      <CardHeader
        title="Workspace defaults"
        subtitle="Set default behaviors for new chats and AI interactions in your workspace."
      />

      {/* Default chat visibility */}
      <div style={{
        display:      'flex',
        alignItems:   'center',
        gap:          12,
        padding:      '12px 24px',
        borderBottom: '1px solid var(--neutral-100)',
        opacity:      settingsLoading ? 0.6 : 1,
      }}>
        <div style={{ flex: '1 0 0', minWidth: 0 }}>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 500,
            fontSize:   14,
            lineHeight: '22px',
            color:      'var(--neutral-900)',
            margin:     0,
          }}>
            Default chat visibility
          </p>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize: 12,
            lineHeight: '16px',
            color:      'var(--neutral-400)',
            margin:     0,
          }}>
            Controls whether new chats are visible to workspace members by default.
          </p>
        </div>
        <VisibilitySelect
          value={defaultChatVisibility}
          onChange={setDefaultChatVisibility}
          disabled={settingsLoading}
        />
      </div>

      {/* Default agent visibility */}
      <div style={{
        display:    'flex',
        alignItems: 'center',
        gap:        12,
        padding:    '12px 24px',
        opacity:    settingsLoading ? 0.6 : 1,
      }}>
        <div style={{ flex: '1 0 0', minWidth: 0 }}>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 500,
            fontSize:   14,
            lineHeight: '22px',
            color:      'var(--neutral-900)',
            margin:     0,
          }}>
            Default agent visibility
          </p>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize: 12,
            lineHeight: '16px',
            color:      'var(--neutral-400)',
            margin:     0,
          }}>
            The default visibility for newly created agents.
          </p>
        </div>
        <VisibilitySelect
          value={defaultPersonaVisibility}
          onChange={setDefaultPersonaVisibility}
          disabled={settingsLoading}
        />
      </div>

      <div style={{ padding: '12px 24px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--neutral-100)' }}>
        <Button
          variant="default"
          size="sm"
          onClick={handleSaveDefaults}
          disabled={settingsSaving || settingsLoading}
        >
          {settingsSaving ? 'Saving…' : 'Save defaults'}
        </Button>
      </div>
    </Card>
  )
}
