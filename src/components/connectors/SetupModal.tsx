'use client'

// Setup modal — S11 (reconnect) and S18 (connect), wired to the connect flow
// in useConnectorSetupFlow. See docs v1.5/connectors-v1.5-migration-plan.md §4
// (edge cases).
//
// Anyone can connect an account and anyone can share their own: sharing is a
// flag on the row you own, so the choice here is just the flag's starting
// value, and it stays changeable afterwards from the Access tab.

import React, { useState } from 'react'
import { toast } from 'sonner'
import { ConnectorGlyph } from '@/components/ConnectorGlyph'
import { Button } from '@/components/Button'
import { InputField } from '@/components/InputField'
import { VisibilityRow } from '@/components/VisibilityRow'
import {
  ConnectorCatalog,
  ConnectorConnection,
  DEFAULT_API_KEY_FIELD,
  fieldLabel,
  fieldPlaceholder,
  isSecretField,
  type AccountVisibility,
  type ApiKeyField,
} from '@/lib/api/connectors'
import { useConnectorSetupFlow, type SetupFlowResult } from '@/lib/useConnectorSetupFlow'
import { isZapierProviderConnector } from '@/lib/connectorProvider'

const SPACE = { xs: 4, sm: 6, md: 8, lg: 12, xl: 16, xxl: 24 } as const
const heading: React.CSSProperties = { margin: 0, color: 'var(--neutral-900)', fontFamily: 'var(--font-title)', fontSize: 22, fontWeight: 400, lineHeight: 1.2 }
const muted: React.CSSProperties = { margin: 0, color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-body)', lineHeight: 'var(--line-height-body)' }
const panel: React.CSSProperties = { borderRadius: 12, background: 'var(--neutral-white)', boxShadow: '0 0 0 1px var(--neutral-100)' }

function Modal({ label, onDismiss, children }: { label: string; onDismiss: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'grid', placeItems: 'center', padding: SPACE.xxl, background: 'rgba(30,28,27,.58)' }} onClick={onDismiss}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={e => e.stopPropagation()}
        style={{ ...panel, width: '100%', maxWidth: 520, maxHeight: 'min(760px, calc(100vh - 48px))', overflowY: 'auto', padding: SPACE.xxl, boxShadow: '0 24px 72px rgba(30,28,27,.28)' }}
      >
        {children}
      </div>
    </div>
  )
}

function credentialFields(catalog: ConnectorCatalog): ApiKeyField[] {
  if (catalog.apiKeyFields.length > 0) return catalog.apiKeyFields
  return catalog.authMode === 'api_key' ? [DEFAULT_API_KEY_FIELD] : []
}

export function SetupModal({
  catalog, orgId, mode, initialAccount, cancel, onConnected,
}: {
  catalog: ConnectorCatalog
  /** Null when the viewer is in no workspace — nobody to share with. */
  orgId: string | null
  mode: 'connect' | 'reconnect'
  initialAccount?: ConnectorConnection
  cancel: () => void
  onConnected: (result: SetupFlowResult) => void
}) {
  const reconnecting = mode === 'reconnect'
  const [name, setName] = useState(reconnecting ? (initialAccount?.nickname ?? '') : '')
  const [visibility, setVisibility] = useState<AccountVisibility>(
    reconnecting ? (initialAccount?.visibility ?? 'private') : 'private',
  )
  const [values, setValues] = useState<Record<string, string>>({})

  const flow = useConnectorSetupFlow({
    connectorSlug: catalog.slug,
    connectorName: catalog.name,
    connectorProvider: catalog.provider,
    onConnected,
  })

  const existingNames = catalog.connections.filter(a => a.id !== initialAccount?.id).map(a => a.nickname.toLowerCase())
  // Every account carries a nickname now, private or shared — it is what the
  // model picks between when you hold several of the same connector.
  const showAccountName = mode === 'connect'
  const duplicate = showAccountName && Boolean(name.trim()) && existingNames.includes(name.trim().toLowerCase())
  const fields = credentialFields(catalog)
  const needsInitFields = catalog.needsOAuthInitFields
  const hosted = isZapierProviderConnector(catalog.provider)
  const needsForm = !hosted && (catalog.authMode === 'api_key' || needsInitFields)
  const allRequiredFilled = fields.filter(f => f.required).every(f => (values[f.name] ?? '').trim())
  const busy = flow.state === 'opening' || flow.state === 'polling' || flow.state === 'submitting'

  // Re-authorizing writes to the row, and only its owner may do that. An
  // account shared with you is usable but not yours to reconnect.
  const reconnectNotOwned = reconnecting && initialAccount != null && !initialAccount.owned

  function submit() {
    if (reconnectNotOwned) {
      toast.error(`Only ${initialAccount?.nickname ?? 'the owner'}'s owner can reconnect it.`)
      return
    }
    flow.connect({
      initData: needsForm ? values : undefined,
      shared: !reconnecting && visibility === 'shared',
      accountLabel: showAccountName ? name.trim() || undefined : undefined,
      knownAccountIds: catalog.connections.map(row => row.id),
    })
  }

  return (
    <Modal label={`${reconnecting ? 'Reconnect' : 'Connect'} ${catalog.name}`} onDismiss={cancel}>
      <div style={{ display: 'flex', gap: SPACE.lg, marginBottom: SPACE.xl }}>
        <ConnectorGlyph slug={catalog.slug} name={catalog.name} logoUrl={catalog.logoUrl} size={36} />
        <div>
          <h2 style={heading}>{reconnecting ? `Reconnect ${initialAccount?.nickname ?? catalog.name}` : `Connect ${catalog.name}`}</h2>
          <p style={{ ...muted, marginTop: SPACE.xs }}>{reconnecting ? 'Authorize this account again.' : 'Choose access before authorizing.'}</p>
        </div>
      </div>

      {showAccountName && (
        <InputField
          label="Account name (optional)"
          subtitle={duplicate ? 'That account name is already used.' : 'Helps the model pick between several accounts on the same app.'}
          error={duplicate}
          value={name}
          onChange={setName}
          placeholder="you@company.com"
          fluid
        />
      )}

      {!reconnecting && (
        <fieldset style={{ border: 0, padding: 0, margin: `${SPACE.xxl}px 0 0` }}>
          <legend style={{ marginBottom: SPACE.md }}>Who can use it?</legend>
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
            <VisibilityRow
              label="Shared"
              description="Everyone in this workspace can use it. You stay the only one who can change it."
              selected={visibility === 'shared'}
              locked={!orgId}
              lockedBadgeLabel="Needs a workspace"
              onClick={() => orgId && setVisibility('shared')}
            />
            <VisibilityRow
              label="Private"
              description="Only you can use it."
              selected={visibility === 'private'}
              onClick={() => setVisibility('private')}
            />
          </div>
          <p style={{ ...muted, marginTop: SPACE.sm }}>
            You can change this later from the account&apos;s Access tab.
          </p>
        </fieldset>
      )}

      {needsForm && !reconnectNotOwned && (
        <div style={{ marginTop: SPACE.xl, display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
          {fields.map(field => (
            <InputField
              key={field.name}
              fluid
              type={field.secret || isSecretField(field.name) ? 'password' : 'text'}
              label={field.label || fieldLabel(field.name)}
              placeholder={field.help || fieldPlaceholder(field.name)}
              value={values[field.name] ?? ''}
              onChange={value => setValues(prev => ({ ...prev, [field.name]: value }))}
            />
          ))}
        </div>
      )}

      {reconnectNotOwned && (
        <div style={{ ...panel, padding: SPACE.lg, marginTop: SPACE.xl, background: 'var(--yellow-50)' }}>
          <p style={{ ...muted, margin: 0 }}>
            {initialAccount?.nickname} was shared with you. Only the person who connected it can re-authorize it.
          </p>
        </div>
      )}

      {flow.state === 'error' && flow.errorMsg && (
        <p style={{ margin: `${SPACE.md}px 0 0`, color: 'var(--red-600, #DC2626)', fontSize: 13 }}>{flow.errorMsg}</p>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: SPACE.md, marginTop: SPACE.xxl }}>
        <Button variant="ghost" size="sm" onClick={cancel} disabled={busy}>Cancel</Button>
        <Button
          size="sm"
          disabled={duplicate || busy || reconnectNotOwned || (needsForm && !allRequiredFilled)}
          loading={busy}
          onClick={submit}
        >
          {flow.state === 'opening' ? 'Opening…' : flow.state === 'polling' ? 'Waiting for auth…' : reconnecting ? 'Reconnect' : `Continue to ${catalog.name}`}
        </Button>
      </div>
    </Modal>
  )
}
