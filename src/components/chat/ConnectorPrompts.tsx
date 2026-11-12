"use client"

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import type { ConnectorConnectPrompt } from '@/types/chat'
import { ConnectorHeading } from '@/components/shared/ConnectorHeading'
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
import { isApiProviderConnector, opensInCurrentTab, isZapierProviderConnector, waitForZapierAuthId, zapierConnectHref } from '@/lib/connectorProvider'

// ── Spinner icon ──────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  display:         'flex',
  flexDirection:   'column',
  gap:             12,
  padding:         '14px 16px',
  borderRadius:    12,
  border:          '1px solid var(--border-default)',
  backgroundColor: 'var(--neutral-white)',
  maxWidth:        480,
  marginTop:       10,
}

// ── ConnectPromptCard ─────────────────────────────────────────────────────────

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
  const abortedRef = useRef(false)

  // Fetch field definitions from the catalog only when the SSE event didn't
  // carry them and the form has been opened for the first time.
  useEffect(() => {
    if (prompt.auth_mode !== 'api_key' || fieldDefs !== null || !showApiForm) return
    getConnector(prompt.connector.slug)
      .then((entry) => {
        if (!abortedRef.current) {
          setFieldDefs(entry.apiKeyFields.length > 0 ? entry.apiKeyFields : [DEFAULT_API_KEY_FIELD])
        }
      })
      .catch(() => {
        if (!abortedRef.current) setFieldDefs([DEFAULT_API_KEY_FIELD])
      })
  }, [prompt.auth_mode, prompt.connector.slug, showApiForm, fieldDefs])

  useEffect(() => {
    return () => { abortedRef.current = true }
  }, [])

  const handleOAuth = useCallback((initData?: Record<string, string>) => {
    // Native MCP and Shopify connectors: the backend's OAuth callback redirects back to
    // our own app domain on success/failure, so this must navigate the
    // current tab rather than a popup. No popup to pre-open in that case.
    const currentTab = opensInCurrentTab(prompt.connector.slug, prompt.provider)
    const isApi = isApiProviderConnector(prompt.provider)

    // Open WITHOUT the noopener FEATURE so window.open() still returns a
    // reference — we need it below to navigate popup.location once the
    // redirect URL comes back (passing noopener here would make most
    // browsers return null instead). Reverse-tabnabbing is still closed off
    // without that feature string: setting popup.opener = null right after
    // opening severs the popup's own window.opener (settable cross-origin)
    // while leaving this `popup` reference fully usable for .location/.close().
    const popup = currentTab || isApi ? null : window.open('', '_blank', 'width=900,height=700')
    if (popup) { try { popup.opener = null } catch { /* best-effort */ } }
    setState('connecting')
    setErrorMsg('')

    // initData carries per-tenant OAuth credentials (Shopify client_id/secret);
    // undefined for plain OAuth.
    initiateLink(prompt.connector.slug, initData)
      .then((link) => {
        if (abortedRef.current) { popup?.close(); return }
        if (isApi) return pollConnectorUntilActive(prompt.connector.slug)
        if (!link.redirectUrl) {
          popup?.close()
          throw new Error('No redirect URL returned by server')
        }
        if (currentTab) {
          window.location.href = link.redirectUrl
          return
        }
        const openUrl = isZapierProviderConnector(prompt.provider, link.redirectUrl)
          ? zapierConnectHref(link.redirectUrl)
          : link.redirectUrl
        if (popup && !popup.closed) {
          popup.location.href = openUrl
        } else {
          // Popup was blocked — fall back to a new tab. Safe to pass noopener
          // here (unlike the deferred-navigation `popup` above): this call's
          // return value is never read, so there's no window reference that
          // needs to survive.
          window.open(openUrl, '_blank', 'noopener')
        }
        setState('polling')
        if (isZapierProviderConnector(prompt.provider, link.redirectUrl)) {
          return waitForZapierAuthId().then(id => completeZapierLink(prompt.connector.slug, id))
        }
        return pollConnectorUntilActive(prompt.connector.slug)
      })
      .then((entry) => {
        if (!entry || abortedRef.current) return
        popup?.close()
        setState('connected')
        toast.success(`${prompt.connector.name} connected — continuing your request.`)
        onConnected?.()
      })
      .catch((err: unknown) => {
        if (abortedRef.current) return
        popup?.close()
        setState('error')
        const msg = err instanceof Error ? err.message : 'Connection failed'
        setErrorMsg(msg)
        toast.error(`Failed to connect ${prompt.connector.name}`)
      })
  }, [prompt, onConnected])

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
  const connectLabel = done ? 'Connected' : state === 'polling' ? 'Waiting for connection…' : `Connect ${prompt.connector.name}`

  return (
    <div style={cardStyle}>
      <ConnectorHeading connector={prompt.connector} title={<>Connect {prompt.connector.name} to continue</>}>
        {prompt.tool_name
          ? <>Task needs <code style={{ fontFamily: 'var(--font-code)', fontSize: 'inherit' }}>{prompt.tool_name}</code> from {prompt.connector.name}.</>
          : <>Task needs access to {prompt.connector.name} to keep going.</>}
      </ConnectorHeading>

      {state === 'error' && (
        <span role="alert" style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', color: 'var(--red-600, #DC2626)' }}>
          {errorMsg || 'Connection failed.'} Try again.
        </span>
      )}

      {state === 'polling' && (
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', color: 'var(--neutral-600)' }}>
          Complete the sign-in in the new tab, then come back here.
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

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        {showCredentialForm && !showApiForm && !done ? (
          <Button size="sm" variant="default" onClick={() => setShowApiForm(true)}>
            Enter credentials
          </Button>
        ) : showCredentialForm && !done ? (
          <>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setShowApiForm(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="default"
              loading={busy}
              disabled={!allFilled}
              onClick={prompt.auth_mode === 'api_key' ? handleApiKey : () => handleOAuth(apiKeyFields)}
            >
              {connectLabel}
            </Button>
          </>
        ) : (
          <Button size="sm" variant="default" loading={busy} disabled={done} onClick={() => handleOAuth()}>
            {connectLabel}
          </Button>
        )}
      </div>
    </div>
  )
}

// The permission card lives in components/shared/PermissionPromptCard —
// one implementation for chat, persona, agent configure, and compare.
