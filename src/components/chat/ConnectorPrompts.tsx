"use client"

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import type { ConnectorConnectPrompt, ConnectorPermissionPrompt } from '@/hooks/use-chat-state'
import {
  getConnector,
  initiateLink,
  updateConnector,
  pollConnectorUntilActive,
  oauthNeedsInitFields,
  DEFAULT_API_KEY_FIELD,
  type ApiKeyField,
} from '@/lib/api/connectors'

// ── Spinner icon ──────────────────────────────────────────────────────────────

function SpinnerIcon() {
  return (
    <svg
      width="12" height="12" viewBox="0 0 24 24" fill="none"
      style={{ animation: 'connector-spin 0.8s linear infinite', flexShrink: 0 }}
    >
      <style>{`@keyframes connector-spin { to { transform: rotate(360deg) } }`}</style>
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

// ── Shared card shell ─────────────────────────────────────────────────────────

function PromptCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display:         'flex',
        flexDirection:   'column',
        gap:             12,
        padding:         '14px 16px',
        borderRadius:    12,
        border:          '1px solid var(--neutral-200)',
        backgroundColor: 'var(--neutral-50)',
        maxWidth:        420,
        marginTop:       10,
      }}
    >
      {children}
    </div>
  )
}

function PromptButton({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
}: {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'outline' | 'danger'
  disabled?: boolean
}) {
  const base: React.CSSProperties = {
    display:        'inline-flex',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            6,
    padding:        '7px 14px',
    borderRadius:   8,
    fontSize:       13,
    fontWeight:     500,
    fontFamily:     'var(--font-body)',
    cursor:         disabled ? 'not-allowed' : 'pointer',
    opacity:        disabled ? 0.55 : 1,
    border:         'none',
    transition:     'opacity 0.15s',
    flexShrink:     0,
  }
  const variants: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: 'var(--neutral-900)',
      color:           '#fff',
    },
    outline: {
      backgroundColor: 'transparent',
      color:           'var(--neutral-700)',
      border:          '1px solid var(--neutral-300)',
    },
    danger: {
      backgroundColor: 'transparent',
      color:           'var(--red-600, #DC2626)',
      border:          '1px solid var(--red-200, #FECACA)',
    },
  }
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{ ...base, ...variants[variant] }}
    >
      {children}
    </button>
  )
}

// ── ConnectPromptCard ─────────────────────────────────────────────────────────

interface ConnectPromptCardProps {
  prompt:        ConnectorConnectPrompt
  onConnected?:  () => void
}

// eslint-disable-next-line react-doctor/prefer-useReducer -- multiple useState calls; useReducer refactor deferred
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
    getConnector(prompt.connector_slug)
      .then((entry) => {
        if (!abortedRef.current) {
          setFieldDefs(entry.api_key_fields && entry.api_key_fields.length > 0 ? entry.api_key_fields : [DEFAULT_API_KEY_FIELD])
        }
      })
      .catch(() => {
        if (!abortedRef.current) setFieldDefs([DEFAULT_API_KEY_FIELD])
      })
  }, [prompt.auth_mode, prompt.connector_slug, showApiForm, fieldDefs])

  useEffect(() => {
    return () => { abortedRef.current = true }
  }, [])

  const handleOAuth = useCallback((initData?: Record<string, string>) => {
    // Open WITHOUT noopener/noreferrer so we can navigate popup.location after
    // getting the redirect URL. noopener leaves the popup stuck at about:blank
    // (Firefox returns null; some Chrome configs block location assignment).
    const popup = window.open('', '_blank', 'width=900,height=700')
    setState('connecting')
    setErrorMsg('')

    // initData carries per-tenant OAuth credentials (Shopify client_id/secret);
    // undefined for plain OAuth.
    initiateLink(prompt.connector_slug, initData)
      .then((link) => {
        if (abortedRef.current) { popup?.close(); return }
        if (!link.redirect_url) {
          popup?.close()
          throw new Error('No redirect URL returned by server')
        }
        if (popup && !popup.closed) {
          popup.location.href = link.redirect_url
        } else {
          // Popup was blocked — fall back to a new tab
          window.open(link.redirect_url, '_blank')
        }
        setState('polling')
        return pollConnectorUntilActive(prompt.connector_slug)
      })
      .then((entry) => {
        if (!entry || abortedRef.current) return
        popup?.close()
        setState('connected')
        toast.success(`${prompt.display_name} connected`)
        onConnected?.()
      })
      .catch((err: unknown) => {
        if (abortedRef.current) return
        popup?.close()
        setState('error')
        const msg = err instanceof Error ? err.message : 'Connection failed'
        setErrorMsg(msg)
        toast.error(`Failed to connect ${prompt.display_name}`)
      })
  }, [prompt, onConnected])

  const handleApiKey = useCallback(() => {
    setState('connecting')
    setErrorMsg('')
    updateConnector(prompt.connector_slug, { credentials: apiKeyFields as Record<string, string> })
      .then(() => {
        if (abortedRef.current) return
        setState('connected')
        toast.success(`${prompt.display_name} connected`)
        onConnected?.()
      })
      .catch((err: unknown) => {
        if (abortedRef.current) return
        setState('error')
        const msg = err instanceof Error ? err.message : 'Failed to save credentials'
        setErrorMsg(msg)
        toast.error(`Failed to connect ${prompt.display_name}`)
      })
  }, [prompt, apiKeyFields, onConnected])

  // Per-tenant OAuth (Shopify BYOA) declares required init fields in the connect
  // prompt; render the same credential form as api_key, but submit via the OAuth
  // path (posts init_data, then opens the hosted connect popup).
  const needsInitFields = oauthNeedsInitFields(prompt)
  const showCredentialForm = prompt.auth_mode === 'api_key' || needsInitFields

  if (state === 'connected') {
    return (
      <PromptCard>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="8" fill="#22C55E" />
            <path d="M4.5 8.5L7 11L11.5 6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500, color: 'var(--neutral-800)' }}>
            {prompt.display_name} connected: you can resend your message.
          </span>
        </div>
      </PromptCard>
    )
  }

  return (
    <PromptCard>
      <div>
        <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500, color: 'var(--neutral-800)' }}>
          Connect {prompt.display_name}
        </p>
        <p style={{ margin: '4px 0 0', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-500)' }}>
          To run <code style={{ fontSize: 12, background: 'var(--neutral-100)', padding: '1px 5px', borderRadius: 4 }}>{prompt.tool_name}</code>, you need to link your {prompt.display_name} account first.
        </p>
      </div>

      {state === 'error' && (
        <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--red-600, #DC2626)' }}>
          {errorMsg || 'Connection failed.'} Try again.
        </p>
      )}

      {showCredentialForm ? (
        <AnimatePresence initial={false}>
          {!showApiForm ? (
            <m.div key="cta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <PromptButton onClick={() => setShowApiForm(true)} disabled={state === 'connecting'}>
                Enter credentials
              </PromptButton>
            </m.div>
          ) : (
            <m.div
              key="form"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              {/* Render one input per field returned by the connector catalog */}
              {(fieldDefs ?? [DEFAULT_API_KEY_FIELD]).map((field) => (
                <div key={field.name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label
                    htmlFor={`cf-${prompt.connector_slug}-${field.name}`}
                    style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 500, color: 'var(--neutral-600)' }}
                  >
                    {field.label}
                  </label>
                  <input
                    id={`cf-${prompt.connector_slug}-${field.name}`}
                    type={field.secret ? 'password' : 'text'}
                    autoComplete="off"
                    placeholder={field.help ?? field.label}
                    value={apiKeyFields[field.name] ?? ''}
                    onChange={(e) => setApiKeyFields((prev) => ({ ...prev, [field.name]: e.target.value }))}
                    style={{
                      padding:         '8px 10px',
                      borderRadius:    8,
                      border:          '1px solid var(--neutral-300)',
                      fontFamily:      'var(--font-body)',
                      fontSize:        13,
                      // eslint-disable-next-line react-doctor/no-outline-none -- browser outline suppressed; :focus-visible handled by container or global styles
                      outline:         'none',
                      width:           '100%',
                      boxSizing:       'border-box',
                      backgroundColor: 'var(--neutral-0, #fff)',
                    }}
                  />
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <PromptButton
                  onClick={prompt.auth_mode === 'api_key' ? handleApiKey : () => handleOAuth(apiKeyFields)}
                  disabled={
                    state === 'connecting' || state === 'polling' ||
                    !(fieldDefs ?? [DEFAULT_API_KEY_FIELD])
                      .filter((f) => f.required)
                      .every((f) => (apiKeyFields[f.name] ?? '').trim())
                  }
                >
                  {state === 'polling' ? 'Waiting…' : state === 'connecting' ? 'Connecting…' : 'Connect'}
                </PromptButton>
                <PromptButton variant="outline" onClick={() => setShowApiForm(false)} disabled={state === 'connecting' || state === 'polling'}>
                  Cancel
                </PromptButton>
              </div>
            </m.div>
          )}
        </AnimatePresence>
      ) : (
        // ── OAuth2 ────────────────────────────────────────────────────────────
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <PromptButton
            onClick={state === 'idle' || state === 'error' ? () => handleOAuth() : undefined}
            disabled={state === 'connecting' || state === 'polling'}
          >
            {state === 'polling' ? (
              <>
                <SpinnerIcon />
                Waiting for connection…
              </>
            ) : state === 'connecting' ? (
              'Opening…'
            ) : (
              `Connect ${prompt.display_name}`
            )}
          </PromptButton>
          {state === 'polling' && (
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-400)' }}>
              Complete the sign-in in the new tab, then come back here.
            </span>
          )}
        </div>
      )}
    </PromptCard>
  )
}

// ── PermissionPromptCard ──────────────────────────────────────────────────────

type PermissionPolicy = 'allow' | 'block' | 'allow_once'

interface PermissionPromptCardProps {
  prompt:       ConnectorPermissionPrompt
  onDecided?:   (policy: PermissionPolicy) => void
  /** When true, skip saving to connector settings and immediately unblock the stream gate. */
  skipSave?:    boolean
}

export function PermissionPromptCard({ prompt, onDecided, skipSave = false }: PermissionPromptCardProps) {
  const [state,    setState]    = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [decided,  setDecided]  = useState<PermissionPolicy | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const abortedRef = useRef(false)

  useEffect(() => {
    return () => { abortedRef.current = true }
  }, [])

  const handlePolicy = useCallback((policy: PermissionPolicy) => {
    setState('saving')
    setErrorMsg('')

    if (skipSave) {
      setDecided(policy)
      setState('done')
      onDecided?.(policy)
      const label = policy === 'allow' ? 'Allowed' : policy === 'block' ? 'Blocked' : 'Allowed once'
      toast.success(`${label} — ${prompt.tool_name}`)
      return
    }

    updateConnector(prompt.connector_slug, {
      permissions: [{ slug: prompt.tool_name, policy }],
    })
      .then(() => {
        if (abortedRef.current) return
        setDecided(policy)
        setState('done')
        onDecided?.(policy)
        const label = policy === 'allow' ? 'Allowed' : policy === 'block' ? 'Blocked' : 'Allowed once'
        toast.success(`${label} — ${prompt.tool_name}`)
      })
      .catch((err: unknown) => {
        if (abortedRef.current) return
        setState('error')
        const msg = err instanceof Error ? err.message : 'Failed to save permission'
        setErrorMsg(msg)
        toast.error('Failed to update permission')
      })
  }, [prompt, onDecided, skipSave])

  if (state === 'done' && decided) {
    const labelMap: Record<PermissionPolicy, string> = {
      allow:       'Allowed',
      block:       'Blocked',
      allow_once:  'Allowed once',
    }
    return (
      <PromptCard>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="8" fill={decided === 'block' ? '#EF4444' : '#22C55E'} />
            {decided === 'block' ? (
              <path d="M5 5L11 11M11 5L5 11" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
            ) : (
              <path d="M4.5 8.5L7 11L11.5 6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500, color: 'var(--neutral-800)' }}>
            {labelMap[decided]}: {decided !== 'block' ? 'you can resend your message.' : 'tool will not run.'}
          </span>
        </div>
      </PromptCard>
    )
  }

  return (
    <PromptCard>
      <div>
        <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500, color: 'var(--neutral-800)' }}>
          Allow {prompt.display_name} to run?
        </p>
        <p style={{ margin: '4px 0 0', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-500)' }}>
          The AI wants to call <code style={{ fontSize: 12, background: 'var(--neutral-100)', padding: '1px 5px', borderRadius: 4 }}>{prompt.tool_name}</code> via {prompt.display_name}.
        </p>
      </div>

      {state === 'error' && (
        <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--red-600, #DC2626)' }}>
          {errorMsg || 'Failed to save permission.'} Try again.
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <PromptButton onClick={() => handlePolicy('allow')} disabled={state === 'saving'}>
          Allow
        </PromptButton>
        <PromptButton variant="outline" onClick={() => handlePolicy('allow_once')} disabled={state === 'saving'}>
          Allow once
        </PromptButton>
        <PromptButton variant="danger" onClick={() => handlePolicy('block')} disabled={state === 'saving'}>
          Block
        </PromptButton>
        {state === 'saving' && (
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-400)' }}>Saving…</span>
        )}
      </div>
    </PromptCard>
  )
}
