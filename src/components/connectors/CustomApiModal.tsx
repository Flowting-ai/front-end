'use client'

// Add a custom REST API. This only describes the API — base URL and how its
// token is sent. The token itself links through SetupModal afterwards, like
// any api_key connector, so naming, sharing and reconnecting work the same.

import React, { useState } from 'react'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowDownOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { Dropdown } from '@/components/Dropdown'
import { InputField } from '@/components/InputField'
import { ConnectorCatalog, createCustomApi, type CustomApiAuth } from '@/lib/api/connectors'
import { Modal } from './SetupModal'

const SPACE = { xs: 4, sm: 6, md: 8, lg: 12, xl: 16, xxl: 24 } as const
const heading: React.CSSProperties = { margin: 0, color: 'var(--neutral-900)', fontFamily: 'var(--font-title)', fontSize: 22, fontWeight: 400, lineHeight: 1.2 }
const muted: React.CSSProperties = { margin: 0, color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-body)', lineHeight: 'var(--line-height-body)' }
const label: React.CSSProperties = { display: 'block', marginBottom: SPACE.sm, fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-body)', lineHeight: 'var(--line-height-body)', color: 'var(--text-field-label)' }
const SHADOW_TRIGGER = '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-200)'

type AuthType = CustomApiAuth['type']

const AUTH_OPTIONS: { value: AuthType; label: string; nameLabel?: string; namePlaceholder?: string }[] = [
  { value: 'bearer', label: 'Bearer token' },
  { value: 'header', label: 'API key header', nameLabel: 'Header name', namePlaceholder: 'X-API-Key' },
  { value: 'query',  label: 'Query parameter', nameLabel: 'Parameter name', namePlaceholder: 'api_key' },
  { value: 'basic',  label: 'Basic auth (username + password)' },
]

// Same rule as the backend's CredentialName: an HTTP token, never Host.
const credentialName = z.string().trim().regex(/^[A-Za-z0-9!#$%&'*+.^_`|~-]{1,64}$/).refine(v => v.toLowerCase() !== 'host')

const customApiSchema = z.object({
  name:     z.string().trim().min(1).max(128),
  base_url: z.string().trim().url().startsWith('https://'),
  auth:     z.discriminatedUnion('type', [
    z.object({ type: z.literal('bearer') }),
    z.object({ type: z.literal('header'), name: credentialName }),
    z.object({ type: z.literal('query'), name: credentialName }),
    z.object({ type: z.literal('basic') }),
  ]),
  docs_url: z.string().trim().url().optional(),
})

function AuthDropdown({ value, onChange }: { value: AuthType; onChange: (value: AuthType) => void }) {
  const [open, setOpen] = useState(false)
  const current = AUTH_OPTIONS.find(option => option.value === value)
  return (
    <Dropdown.Float
      open={open}
      onOpenChange={setOpen}
      placement="bottom-start"
      offset={4}
      trigger={
        <button type="button" id="custom-api-auth"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.md, width: '100%', padding: '8px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', backgroundColor: 'var(--neutral-white)', boxShadow: SHADOW_TRIGGER, fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-body)', color: 'var(--neutral-700)', outline: 'none' }}>
          <span>{current?.label}</span>
          <ArrowDownOneIcon size={14} color="var(--neutral-400)" />
        </button>
      }
    >
      <Dropdown maxHeight={false}>
        <Dropdown.Section fluid>
          {AUTH_OPTIONS.map(option => (
            <Dropdown.Item key={option.value} fluid label={option.label} selected={value === option.value}
              onClick={() => { onChange(option.value); setOpen(false) }} />
          ))}
        </Dropdown.Section>
      </Dropdown>
    </Dropdown.Float>
  )
}

export function CustomApiModal({
  cancel, onCreated,
}: {
  cancel: () => void
  /** The new connector, ready for SetupModal to link its token. */
  onCreated: (entry: ConnectorCatalog) => void
}) {
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [authType, setAuthType] = useState<AuthType>('bearer')
  const [credentialNameValue, setCredentialNameValue] = useState('')
  const [docsUrl, setDocsUrl] = useState('')
  const [busy, setBusy] = useState(false)

  const authOption = AUTH_OPTIONS.find(option => option.value === authType)
  const auth = authOption?.nameLabel ? { type: authType, name: credentialNameValue } : { type: authType }
  const validation = customApiSchema.safeParse({
    name,
    base_url: baseUrl,
    auth,
    docs_url: docsUrl.trim() || undefined,
  })
  const baseUrlInvalid = Boolean(baseUrl.trim()) && !z.string().trim().url().startsWith('https://').safeParse(baseUrl).success

  async function submit() {
    if (!validation.success || busy) return
    setBusy(true)
    try {
      onCreated(await createCustomApi(validation.data))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add API')
      setBusy(false)
    }
  }

  return (
    <Modal label="Add custom API" onDismiss={cancel}>
      <h2 style={heading}>Add custom API</h2>
      <p style={{ ...muted, marginTop: SPACE.xs }}>
        Connect any REST API so Souvenir can call it with your credentials. You&apos;ll add the token next.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xl, marginTop: SPACE.xxl }}>
        <InputField label="Name" value={name} onChange={setName} placeholder="My API" fluid />

        <InputField
          label="Base URL"
          subtitle={baseUrlInvalid ? 'Use a full https:// URL.' : 'Every request must start with this URL.'}
          error={baseUrlInvalid}
          value={baseUrl}
          onChange={setBaseUrl}
          placeholder="https://api.example.com/v1"
          type="url"
          fluid
        />

        <div>
          <label htmlFor="custom-api-auth" style={label}>Authentication</label>
          <AuthDropdown value={authType} onChange={setAuthType} />
        </div>

        {authOption?.nameLabel && (
          <InputField
            label={authOption.nameLabel}
            value={credentialNameValue}
            onChange={setCredentialNameValue}
            placeholder={authOption.namePlaceholder}
            fluid
          />
        )}

        <InputField
          label="Documentation URL"
          labelSuffix={<span style={{ color: 'var(--neutral-400)' }}> (optional)</span>}
          subtitle="Souvenir reads this before calling the API."
          value={docsUrl}
          onChange={setDocsUrl}
          placeholder="https://developer.example.com/docs"
          type="url"
          fluid
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: SPACE.md, marginTop: SPACE.xxl }}>
        <Button variant="ghost" size="sm" onClick={cancel} disabled={busy}>Cancel</Button>
        <Button variant="default" size="sm" onClick={() => void submit()} loading={busy} disabled={!validation.success}>Next</Button>
      </div>
    </Modal>
  )
}
