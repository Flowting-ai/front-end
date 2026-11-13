"use client"

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import type { ConnectorConnectPrompt } from '@/types/chat'
import { ConnectorPromptShell } from '@/components/shared/ConnectorHeading'
import { ConnectorStatusBadge } from '@/components/ConnectorStatusBadge'
import { Button } from '@/components/ui/button'
import {
  getConnector,
  initiateLink,
  completeZapierLink,
  pollConnectorUntilActive,
  oauthNeedsInitFields,
  DEFAULT_API_KEY_FIELD,
  type ApiKeyField,
} from '@/lib/api/connectors'
import { respondToChatPrompt } from '@/lib/api/chat'
import { isApiProviderConnector, isZapierProviderConnector, onLinkResult, waitForZapierAuthId, zapierConnectHref } from '@/lib/connectorProvider'

// ── ConnectPromptCard ─────────────────────────────────────────────────────────

const SIGN_IN_WAIT_MS = 300_000

interface ConnectPromptCardProps {
  prompt:        ConnectorConnectPrompt
  onConnected?:  () => void
}

export function ConnectPromptCard({ prompt, onConnected }: ConnectPromptCardProps) {
  const [state,        setState]        = useState<'idle' | 'connecting' | 'polling' | 'connected' | 'error'>('idle')
  const [errorMsg,     setErrorMsg]     = useState('')
  // api_key flow
  const [apiKeyFields, setApiKeyFields] = useState<Record<string, string>>({})
  const [fieldDefs,    setFieldDefs]    = useState<ApiKeyField[] | null>(
    prompt.api_key_fields && prompt.api_key_fields.length > 0 ? prompt.api_key_fields : null,
  )
  const [showApiForm,  setShowApiForm]  = useState(false)
  const abortedRef  = useRef(false)
  const answeredRef = useRef(false)

  // The turn that asked is waiting on this answer, or has left and takes its run back up on it.
  const finish = useCallback(async () => {
    if (answeredRef.current || abortedRef.current) return
    answeredRef.current = true
    await respondToChatPrompt('connected', prompt.respond_url).catch(() => {})
    if (abortedRef.current) return
    setState('connected')
    toast.success(`${prompt.connector.name} connected — continuing your request.`)
    onConnected?.()
  }, [prompt.respond_url, prompt.connector.name, onConnected])

  // The app may already be connected (from Connectors, or another tab) by the time this card shows.
  useEffect(() => {
    getConnector(prompt.connector.slug)
      .then((entry) => {
        if (entry.ownedConnections.some((row) => row.connected && !row.needsReconnect)) void finish()
        else if (prompt.auth_mode === 'api_key' && !abortedRef.current) {
          setFieldDefs((current) => current ?? (entry.apiKeyFields.length > 0 ? entry.apiKeyFields : [DEFAULT_API_KEY_FIELD]))
        }
      })
      .catch(() => {})
    return () => { abortedRef.current = true }
    // Checked once, when the card shows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleOAuth = useCallback((initData?: Record<string, string>) => {
    const isApi = isApiProviderConnector(prompt.provider)

    // The sign-in always runs in a popup, so the chat and its running turn stay where they are.
    // Opened without the noopener feature so the reference survives to be navigated and closed;
    // clearing popup.opener closes off reverse tabnabbing instead.
    const popup = isApi ? null : window.open('', '_blank', 'width=900,height=700')
    if (popup) { try { popup.opener = null } catch { /* best-effort */ } }
    setState('connecting')
    setErrorMsg('')

    // Our own sign-in landing page reports how the sign-in ended, sooner than the status poll would see it.
    const waiting = new AbortController()
    let ended = ''
    const stopListening = onLinkResult(prompt.connector.slug, (link) => {
      if (link === 'connected') void finish()
      else ended = link
      waiting.abort()
    })

    // initData carries per-tenant OAuth credentials (Shopify client_id/secret);
    // undefined for plain OAuth.
    initiateLink(prompt.connector.slug, initData)
      .then((link) => {
        if (abortedRef.current) return
        const status = { signal: waiting.signal, timeoutMs: SIGN_IN_WAIT_MS }
        if (isApi) return pollConnectorUntilActive(prompt.connector.slug, status)
        if (!link.redirectUrl) throw new Error('No redirect URL returned by server')
        const openUrl = isZapierProviderConnector(prompt.provider, link.redirectUrl)
          ? zapierConnectHref(link.redirectUrl)
          : link.redirectUrl
        if (popup && !popup.closed) {
          popup.location.href = openUrl
        } else {
          // Popup was blocked: a new tab instead. Its return value is never read, so noopener is safe here.
          window.open(openUrl, '_blank', 'noopener')
        }
        setState('polling')
        if (isZapierProviderConnector(prompt.provider, link.redirectUrl)) {
          return waitForZapierAuthId(waiting.signal).then(id => completeZapierLink(prompt.connector.slug, id))
        }
        return pollConnectorUntilActive(prompt.connector.slug, status)
      })
      .then((entry) => { if (entry) return finish() })
      .catch((err: unknown) => {
        if (abortedRef.current || answeredRef.current) return
        setState('error')
        setErrorMsg(
          ended === 'cancelled' ? 'The sign-in was cancelled.'
            : ended ? 'The sign-in did not go through.'
            : err instanceof Error ? err.message : 'Connection failed',
        )
        toast.error(`Failed to connect ${prompt.connector.name}`)
      })
      .finally(() => {
        stopListening()
        popup?.close()
      })
  }, [prompt, finish])

  // API-key connectors are linked through the same hosted Connect flow as
  // OAuth ones — the fields ride along as init_data. There is no separate
  // credential endpoint to post them to.
  const handleApiKey = useCallback(() => {
    handleOAuth(apiKeyFields as Record<string, string>)
  }, [handleOAuth, apiKeyFields])

  // Per-tenant OAuth (Shopify BYOA) declares required init fields in the connect
  // prompt; render the same credential form as api_key, but submit via the OAuth
  // path (posts init_data, then opens the hosted connect popup).
  const needsInitFields = oauthNeedsInitFields(prompt)
  const showCredentialForm = !isZapierProviderConnector(prompt.provider)
    && (prompt.auth_mode === 'api_key' || needsInitFields)

  const busy = state === 'connecting' || state === 'polling'
  const done = state === 'connected'
  const fields = fieldDefs ?? [DEFAULT_API_KEY_FIELD]
  const allFilled = fields.filter((field) => field.required).every((field) => (apiKeyFields[field.name] ?? '').trim())
  const connectLabel = state === 'polling' ? 'Waiting for connection…' : `Connect ${prompt.connector.name}`

  return (
    <ConnectorPromptShell
      connector={prompt.connector}
      title={<>Connect {prompt.connector.name} to continue</>}
      caption={prompt.tool_name
        ? <>Task needs <code style={{ fontFamily: 'var(--font-code)', fontSize: 'inherit' }}>{prompt.tool_name}</code> from {prompt.connector.name}.</>
        : <>Task needs access to {prompt.connector.name} to keep going.</>}
    >

      {state === 'error' && (
        <span role="alert" style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', color: 'var(--red-600, #DC2626)' }}>
          {errorMsg || 'Connection failed.'} Try again.
        </span>
      )}

      {state === 'polling' && (
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', color: 'var(--neutral-600)' }}>
          Finish the sign-in in the window that opened. This card checks {prompt.connector.name} until it is connected.
        </span>
      )}

      {showCredentialForm && showApiForm && !done && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {fields.map((field) => (
            <div key={field.name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label
                htmlFor={`cf-${prompt.connector.slug}-${field.name}`}
                style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', fontWeight: 500, color: 'var(--neutral-600)' }}
              >
                {field.label}
              </label>
              <input
                id={`cf-${prompt.connector.slug}-${field.name}`}
                type={field.secret ? 'password' : 'text'}
                autoComplete="off"
                placeholder={field.help || field.label}
                value={apiKeyFields[field.name] ?? ''}
                disabled={busy}
                onChange={(e) => setApiKeyFields((prev) => ({ ...prev, [field.name]: e.target.value }))}
                style={{
                  padding:         '7px 10px',
                  borderRadius:    8,
                  border:          '1px solid var(--neutral-300)',
                  fontFamily:      'var(--font-body)',
                  fontSize:        'var(--font-size-caption)',
                  outline:         'none',
                  width:           '100%',
                  boxSizing:       'border-box',
                  backgroundColor: 'var(--field-surface)',
                }}
              />
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
        {done ? (
          <ConnectorStatusBadge status="connected" />
        ) : showCredentialForm && !showApiForm ? (
          <Button size="sm" variant="approve" attention onClick={() => setShowApiForm(true)}>
            Enter credentials
          </Button>
        ) : showCredentialForm ? (
          <>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setShowApiForm(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="approve"
              loading={busy}
              disabled={!allFilled}
              onClick={prompt.auth_mode === 'api_key' ? handleApiKey : () => handleOAuth(apiKeyFields)}
            >
              {connectLabel}
            </Button>
          </>
        ) : (
          <Button size="sm" variant="approve" attention={!busy} loading={busy} onClick={() => handleOAuth()}>
            {connectLabel}
          </Button>
        )}
      </div>
    </ConnectorPromptShell>
  )
}

// The permission card lives in components/shared/PermissionPromptCard —
// one implementation for chat, persona, agent configure, and compare.
