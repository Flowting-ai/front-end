'use client'

// Setup modal — S11 (reconnect) and S18 (connect), wired to the connect flow
// in useConnectorSetupFlow. See docs-v1.5/connectors-v1.5-migration-plan.md §4
// (edge cases).
//
// Anyone can connect an account and anyone can share their own: sharing is a
// flag on the row you own, so the choice here is just the flag's starting
// value, and it stays changeable afterwards from the Access tab.
//
// A person may hold several accounts per app. An account added while one is
// already in use is parked: it does not take over what automations already
// run through, and switching is its own deliberate act on the Access tab.

import React from 'react'
import { z } from 'zod'
import { toast } from 'sonner'
import { ConnectorGlyph } from '@/components/ConnectorGlyph'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useZodForm } from '@/hooks/use-zod-form'
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

const heading = 'm-0 font-[family-name:var(--font-title)] text-[22px] font-normal leading-[1.2] text-[var(--neutral-900)]'
const muted = 'm-0 font-[family-name:var(--font-body)] text-[length:var(--font-size-body)] leading-[var(--line-height-body)] text-[var(--color-text-muted)]'
const panel = 'rounded-xl bg-[var(--neutral-white)] shadow-[0_0_0_1px_var(--neutral-100)]'

export function Modal({ label, onDismiss, busy = false, dirty = false, children }: {
  label: string
  onDismiss: () => void
  /** A save is running: Esc and outside clicks do nothing, so its result has somewhere to land. */
  busy?: boolean
  /** Something is typed: an outside click keeps it open (Esc, Cancel and the X still close). */
  dirty?: boolean
  children: React.ReactNode
}) {
  // Radix keeps Tab inside, wires Esc/outside click, and returns focus to the opener on close.
  return (
    <Dialog open onOpenChange={open => { if (!open) onDismiss() }}>
      <DialogContent
        hideClose
        aria-describedby={undefined}
        onEscapeKeyDown={event => { if (busy) event.preventDefault() }}
        onInteractOutside={event => { if (busy || dirty) event.preventDefault() }}
        className="p-6"
        style={{ width: 520, maxHeight: 'min(760px, calc(100vh - 48px))', overflowY: 'auto', boxShadow: '0 24px 72px rgba(30,28,27,.28)', borderRadius: 12 }}
      >
        <DialogTitle className="sr-only">{label}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  )
}

function credentialFields(catalog: ConnectorCatalog): ApiKeyField[] {
  if (catalog.apiKeyFields.length > 0) return catalog.apiKeyFields
  return catalog.authMode === 'api_key' ? [DEFAULT_API_KEY_FIELD] : []
}

type SetupFormValues = {
  name: string
  visibility: AccountVisibility
  credentials: Record<string, string>
}

/** Account name must not repeat another of this app's accounts; required credentials must be filled when asked for. */
function setupFormSchema(existingNames: string[], required: string[]) {
  return z.object({
    name: z.string().refine(v => !v.trim() || !existingNames.includes(v.trim().toLowerCase()), 'That account name is already used.'),
    visibility: z.enum(['private', 'shared']),
    credentials: z.record(z.string(), z.string()).refine(c => required.every(k => (c[k] ?? '').trim()), 'Fill in the required fields.'),
  })
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

  const flow = useConnectorSetupFlow({
    connectorSlug: catalog.slug,
    connectorName: catalog.name,
    connectorProvider: catalog.provider,
    onConnected,
  })

  // What this link may name and share is whatever row it produces, and only a
  // row it produces: authorizing a remote account already on file re-uses that
  // row, and the flow leaves it alone rather than PATCHing whichever account
  // was handy — which is what turned a connected private account shared.
  const addingToExisting = catalog.ownedConnections.length > 0
  const showAccountName = mode === 'connect'
  const fields = credentialFields(catalog)
  const needsInitFields = catalog.needsOAuthInitFields
  const hosted = isZapierProviderConnector(catalog.provider)
  const needsForm = !hosted && (catalog.authMode === 'api_key' || needsInitFields)
  const busy = flow.state === 'opening' || flow.state === 'polling' || flow.state === 'submitting'

  // Re-authorizing writes to the row, and only its owner may do that. An
  // account shared with you is usable but not yours to reconnect.
  const reconnectNotOwned = reconnecting && initialAccount != null && !initialAccount.canManage

  // Rebuilt per render on purpose: the React Compiler memoizes it on catalog/initialAccount.
  const schema = setupFormSchema(
    showAccountName ? catalog.connections.filter(a => a.id !== initialAccount?.id).map(a => a.nickname.toLowerCase()) : [],
    needsForm && !reconnectNotOwned ? fields.filter(f => f.required).map(f => f.name) : [],
  )
  const form = useZodForm<SetupFormValues>(schema, {
    name: reconnecting ? (initialAccount?.nickname ?? '') : '',
    visibility: reconnecting ? (initialAccount?.visibility ?? 'private') : 'private',
    credentials: {},
  })
  const { name, visibility, credentials } = form.values
  const duplicate = Boolean(form.errors.name)
  const typedCredentials = Object.values(credentials).some(v => v.trim() !== '')

  const submit = form.handleSubmit(data => {
    if (reconnectNotOwned) {
      toast.error(`Only ${initialAccount?.nickname ?? 'the owner'}'s owner can reconnect it.`)
      return
    }
    flow.connect({
      initData: needsForm ? data.credentials : undefined,
      shared: !reconnecting && data.visibility === 'shared',
      accountLabel: showAccountName ? data.name.trim() || undefined : undefined,
      knownAccountIds: catalog.connections.map(row => row.id),
      reconnecting: reconnecting ? initialAccount?.id : undefined,
    })
  })

  return (
    <Modal label={`${reconnecting ? 'Reconnect' : 'Connect'} ${catalog.name}`} onDismiss={cancel} busy={flow.state === 'submitting'} dirty={typedCredentials}>
      <div className="mb-4 flex gap-3">
        <ConnectorGlyph slug={catalog.slug} name={catalog.name} logoUrl={catalog.logoUrl} size={36} />
        <div>
          <h2 className={heading}>{reconnecting ? `Reconnect ${initialAccount?.nickname ?? catalog.name}` : `Connect ${catalog.name}`}</h2>
          <p className={`${muted} mt-1`}>{reconnecting ? 'Authorize this account again.' : 'Choose access before authorizing.'}</p>
        </div>
      </div>

      {showAccountName && (
        <InputField
          label="Account name (optional)"
          subtitle={form.errors.name ?? 'Shown wherever this account appears.'}
          error={duplicate}
          value={name}
          onChange={v => form.setField('name', v)}
          placeholder="you@company.com"
          fluid
        />
      )}

      {!reconnecting && (
        <fieldset className="m-0 mt-6 border-0 p-0">
          <legend className="mb-2 block p-0 font-[family-name:var(--font-body)] font-[var(--font-weight-regular)] text-[length:var(--font-size-body)] leading-[var(--line-height-body)] text-[var(--text-field-label)]">
            Who can use it?
          </legend>
          <div className="flex flex-col gap-2">
            <VisibilityRow
              label="Shared"
              description="Everyone in this workspace can use it. You stay the only one who can change it."
              selected={visibility === 'shared'}
              locked={!orgId}
              lockedBadgeLabel="Needs a workspace"
              onClick={() => { if (orgId) form.setField('visibility', 'shared') }}
            />
            <VisibilityRow
              label="Private"
              description="Only you can use it."
              selected={visibility === 'private'}
              onClick={() => form.setField('visibility', 'private')}
            />
          </div>
          <p className={`${muted} mt-1.5`}>
            {addingToExisting
              ? 'This account is added alongside the one you already use. Nothing switches over until you say so from its Access tab.'
              : 'You can change this later from the account’s Access tab.'}
          </p>
        </fieldset>
      )}

      {needsForm && !reconnectNotOwned && (
        <div className="mt-4 flex flex-col gap-2">
          {fields.map(field => (
            <InputField
              key={field.name}
              fluid
              type={field.secret || isSecretField(field.name) ? 'password' : 'text'}
              label={field.label || fieldLabel(field.name)}
              placeholder={field.help || fieldPlaceholder(field.name)}
              value={credentials[field.name] ?? ''}
              onChange={value => form.setField('credentials', { ...credentials, [field.name]: value })}
            />
          ))}
        </div>
      )}

      {reconnectNotOwned && (
        <div className={`${panel} mt-4 bg-[var(--yellow-50)] p-3`}>
          <p className={muted}>
            {initialAccount?.nickname} was shared with you. Only the person who connected it can re-authorize it.
          </p>
        </div>
      )}

      {flow.state === 'error' && flow.error && (
        <div role="alert" className="mt-2">
          <p className="m-0 text-[13px] text-[var(--red-600,#DC2626)]">{flow.error.message}</p>
          {flow.error.recovery === 'ask_admin' && (
            <p className={`${muted} mt-1 text-[13px]`}>Ask a workspace admin to enable or set up {catalog.name}.</p>
          )}
        </div>
      )}

      {/* Announces the wait while the user is in the other window. */}
      <p aria-live="polite" className="sr-only">
        {flow.state === 'opening' ? `Opening ${catalog.name} sign-in` : flow.state === 'polling' ? `Waiting for you to authorize ${catalog.name} in the other window` : ''}
      </p>

      <div className="mt-6 flex justify-end gap-2">
        {/* Only disabled while actually writing to the account row
            (naming/sharing after a successful link) — opening the popup or
            waiting on auth is always safe to bail out of, and closing this
            modal fully aborts the poll (see useConnectorSetupFlow's cleanup
            effect). Without this, a user who closes the external OAuth
            window has no way to escape "Waiting for auth…" except waiting
            out the poll's timeout. */}
        <Button variant="cancel" size="sm" onClick={cancel} disabled={flow.state === 'submitting'}>Cancel</Button>
        <Button
          size="sm"
          disabled={busy || reconnectNotOwned || !form.isValid}
          loading={busy}
          onClick={submit}
        >
          {flow.state === 'opening' ? 'Opening…' : flow.state === 'polling' ? 'Waiting for auth…' : flow.state === 'error' && flow.error?.recovery !== 'ask_admin' ? 'Try again' : reconnecting ? 'Reconnect' : `Continue to ${catalog.name}`}
        </Button>
      </div>
    </Modal>
  )
}
