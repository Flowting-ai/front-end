'use client'

// Setup modal — S11 (reconnect) and S18 (connect). Ported from the story's
// Setup, wired to real OAuth/API-key/shared-account mutations via
// useConnectorSetupFlow. See docs v1.5/connectors-v1.5-migration-plan.md §4
// (edge cases), Gap #2 (visibility locked after creation), Gap #14 (shared
// OAuth accounts can't be reconnected in place).

import React, { useState } from 'react'
import { toast } from 'sonner'
import { ConnectorGlyph } from '@/components/ConnectorGlyph'
import { Button } from '@/components/Button'
import { InputField } from '@/components/InputField'
import { VisibilityRow } from '@/components/VisibilityRow'
import {
  DEFAULT_API_KEY_FIELD,
  fieldLabel,
  fieldPlaceholder,
  isSecretField,
  oauthNeedsInitFields,
  type ApiKeyField,
} from '@/lib/api/connectors'
import { useConnectorSetupFlow, type SetupFlowResult } from '@/lib/useConnectorSetupFlow'
import type { AccountVisibility, UnifiedAccount, UnifiedConnectorSummary } from '@/lib/connectorsUnified'

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

function credentialFields(summary: UnifiedConnectorSummary): ApiKeyField[] {
  if (summary.apiKeyFields.length > 0) return summary.apiKeyFields
  return summary.authMode === 'api_key' ? [DEFAULT_API_KEY_FIELD] : []
}

export function SetupModal({
  summary, orgId, canManageShared, mode, initialAccount, cancel, onConnected,
}: {
  summary: UnifiedConnectorSummary
  orgId: string | null
  /** False for a non-admin member — the backend still requires org
   *  owner/admin for every shared-account mutation (create/update/delete). */
  canManageShared: boolean
  mode: 'connect' | 'reconnect'
  initialAccount?: UnifiedAccount
  cancel: () => void
  onConnected: (result: SetupFlowResult) => void
}) {
  const reconnecting = mode === 'reconnect'
  const [name, setName] = useState(reconnecting ? (initialAccount?.nickname ?? '') : '')
  const [visibility, setVisibility] = useState<AccountVisibility>(
    reconnecting ? (initialAccount?.visibility ?? 'private') : (orgId && canManageShared ? 'shared' : 'private'),
  )
  const [values, setValues] = useState<Record<string, string>>({})

  const flow = useConnectorSetupFlow({
    connectorSlug: summary.slug,
    connectorName: summary.name,
    orgId,
    onConnected,
  })

  const existingNames = summary.accounts.filter(a => a.id !== initialAccount?.id).map(a => a.nickname.toLowerCase())
  // Personal connections have no account-name field on the backend (a single
  // unnamed row per user+connector) — the name is only ever saved for shared
  // accounts, so it's only shown and validated in that case.
  const showAccountName = mode === 'connect' && visibility === 'shared'
  const duplicate = showAccountName && Boolean(name.trim()) && existingNames.includes(name.trim().toLowerCase())
  const fields = credentialFields(summary)
  const needsInitFields = oauthNeedsInitFields(summary.raw)
  const needsForm = summary.authMode === 'api_key' || needsInitFields
  const allRequiredFilled = fields.filter(f => f.required).every(f => (values[f.name] ?? '').trim())
  const busy = flow.state === 'opening' || flow.state === 'polling' || flow.state === 'submitting'

  // Gap #14 — shared OAuth accounts have no re-authorize-in-place endpoint.
  const reconnectSharedOAuthBlocked = reconnecting && visibility === 'shared' && summary.authMode === 'oauth2'

  // Every shared-account mutation (create, reconnect/update) goes through the
  // admin-only shared-account endpoints — a non-admin member can't do this
  // regardless of auth mode. The "Shared" row is locked below so this should
  // be unreachable via normal interaction; kept as a defensive submit-time
  // check too.
  const sharedPermissionBlocked = visibility === 'shared' && !canManageShared

  // The backend has no concept of a second private account for this
  // connector (personal links are a single row per user+connector — a
  // second "connect" attempt silently overwrites the first one's
  // credentials in place rather than creating anything new, and the OAuth
  // poll reports "connected" immediately because the existing row already
  // satisfies it). Block it here rather than let the UI promise something
  // the backend can't do.
  const existingPrivateAccount = summary.accounts.find(a => a.visibility === 'private')
  const privateAccountLimitBlocked = !reconnecting && visibility === 'private' && Boolean(existingPrivateAccount)

  function submit() {
    if (sharedPermissionBlocked) {
      toast.error(reconnecting ? 'Only workspace admins can reconnect a shared account.' : 'Only workspace admins can create a shared account.')
      return
    }
    if (reconnectSharedOAuthBlocked) {
      toast.error("Reconnecting a shared OAuth account isn't supported yet — remove and reconnect it instead.")
      return
    }
    if (privateAccountLimitBlocked) {
      toast.error(`You already have a private ${summary.name} account — only one is supported per person.`)
      return
    }
    if (visibility === 'private') {
      if (needsForm) {
        if (summary.authMode === 'api_key') flow.submitApiKeyPrivate(values)
        else flow.connectPrivate(values)
      } else {
        flow.connectPrivate()
      }
      return
    }
    // Shared — workspace-wide, no team involved. Reconnect + api_key =
    // credential update in place (works today).
    if (reconnecting && initialAccount) {
      flow.connectShared(name.trim() || initialAccount.nickname, undefined, undefined, summary.authMode === 'api_key' ? values : undefined)
      return
    }
    flow.connectShared(
      name.trim() || `${summary.name} account`,
      undefined,
      summary.authMode === 'oauth2' ? values : undefined,
      summary.authMode === 'api_key' ? values : undefined,
    )
  }

  return (
    <Modal label={`${reconnecting ? 'Reconnect' : 'Connect'} ${summary.name}`} onDismiss={cancel}>
      <div style={{ display: 'flex', gap: SPACE.lg, marginBottom: SPACE.xl }}>
        <ConnectorGlyph slug={summary.slug} name={summary.name} logoUrl={summary.logoUrl} size={36} />
        <div>
          <h2 style={heading}>{reconnecting ? `Reconnect ${initialAccount?.nickname ?? summary.name}` : `Connect ${summary.name}`}</h2>
          <p style={{ ...muted, marginTop: SPACE.xs }}>{reconnecting ? 'Authorize this account again.' : 'Choose access before authorizing.'}</p>
        </div>
      </div>

      {showAccountName && (
        <InputField
          label="Account name (optional)"
          subtitle={duplicate ? 'That account name is already used.' : 'Defaults to the connected email. Helps the model choose the right account.'}
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
              description="Everyone in this workspace can use it."
              selected={visibility === 'shared'}
              locked={!orgId || !canManageShared}
              lockedBadgeLabel={!orgId ? 'Needs a workspace' : 'Admins only'}
              onClick={() => orgId && canManageShared && setVisibility('shared')}
            />
            <VisibilityRow
              label="Private"
              description="Only you can use it."
              selected={visibility === 'private'}
              locked={Boolean(existingPrivateAccount)}
              lockedBadgeLabel="Already connected"
              onClick={() => !existingPrivateAccount && setVisibility('private')}
            />
          </div>
          {existingPrivateAccount && (
            <p style={{ ...muted, marginTop: SPACE.sm }}>
              You already have a private {summary.name} account ({existingPrivateAccount.nickname}) — only one is supported per person. Use Reconnect on that account to re-authorize it, or connect Shared instead.
            </p>
          )}
          {orgId && !canManageShared && (
            <p style={{ ...muted, marginTop: SPACE.sm }}>
              Only workspace admins can create shared accounts. Connect Private instead, or ask an admin.
            </p>
          )}
        </fieldset>
      )}

      {needsForm && !reconnectSharedOAuthBlocked && (
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

      {reconnecting && sharedPermissionBlocked && (
        <div style={{ ...panel, padding: SPACE.lg, marginTop: SPACE.xl, background: 'var(--yellow-50)' }}>
          <p style={{ ...muted, margin: 0 }}>Only workspace admins can reconnect a shared account.</p>
        </div>
      )}

      {reconnectSharedOAuthBlocked && (
        <div style={{ ...panel, padding: SPACE.lg, marginTop: SPACE.xl, background: 'var(--yellow-50)' }}>
          <p style={{ ...muted, margin: 0 }}>Reconnecting a shared OAuth account isn&apos;t supported yet. Remove this account and connect it again instead.</p>
        </div>
      )}

      {flow.state === 'error' && flow.errorMsg && (
        <p style={{ margin: `${SPACE.md}px 0 0`, color: 'var(--red-600, #DC2626)', fontSize: 13 }}>{flow.errorMsg}</p>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: SPACE.md, marginTop: SPACE.xxl }}>
        <Button variant="ghost" size="sm" onClick={cancel} disabled={busy}>Cancel</Button>
        <Button
          size="sm"
          disabled={duplicate || busy || reconnectSharedOAuthBlocked || sharedPermissionBlocked || privateAccountLimitBlocked || (needsForm && !allRequiredFilled)}
          loading={busy}
          onClick={submit}
        >
          {flow.state === 'opening' ? 'Opening…' : flow.state === 'polling' ? 'Waiting for auth…' : reconnecting ? 'Reconnect' : `Continue to ${summary.name}`}
        </Button>
      </div>
    </Modal>
  )
}
