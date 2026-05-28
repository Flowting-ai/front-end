'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { PlusSignIcon } from '@strange-huge/icons'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/Button'
import {
  listConnectors,
  initiateLink,
  updateConnector,
  unlinkConnector,
  pollConnectorUntilActive,
  DEFAULT_API_KEY_FIELD,
} from '@/lib/api/connectors'
import type { ApiKeyField, ConnectorCatalogEntry, ConnectorTool } from '@/lib/api/connectors'
import { ApiError } from '@/lib/api/client'

// ── Connector logo map ────────────────────────────────────────────────────────

const CONNECTOR_LOGO_MAP: Record<string, string> = {
  'airtable':             '/connector-logos/airtable.svg',
  'asana':                '/connector-logos/asana.svg',
  'calendly':             '/connector-logos/calendly.svg',
  'clickup':              '/connector-logos/clickup.svg',
  'click-up':             '/connector-logos/clickup.svg',
  'fireflies':            '/connector-logos/fireflies.svg',
  'fireflies-ai':         '/connector-logos/fireflies.svg',
  'gmail':                '/connector-logos/gmail.svg',
  'googleads':            '/connector-logos/google-ads.svg',
  'google-ads':           '/connector-logos/google-ads.svg',
  'google_ads':           '/connector-logos/google-ads.svg',
  'googlecalendar':       '/connector-logos/google-calendar.svg',
  'google-calendar':      '/connector-logos/google-calendar.svg',
  'google_calendar':      '/connector-logos/google-calendar.svg',
  'googledocs':           '/connector-logos/google-docs.svg',
  'google-docs':          '/connector-logos/google-docs.svg',
  'google_docs':          '/connector-logos/google-docs.svg',
  'googledrive':          '/connector-logos/google-drive.svg',
  'google-drive':         '/connector-logos/google-drive.svg',
  'google_drive':         '/connector-logos/google-drive.svg',
  'googlesheets':         '/connector-logos/google-sheets.svg',
  'google-sheets':        '/connector-logos/google-sheets.svg',
  'google_sheets':        '/connector-logos/google-sheets.svg',
  'hubspot':              '/connector-logos/hubspot.svg',
  'jira':                 '/connector-logos/jira.svg',
  'linear':               '/connector-logos/linear.svg',
  'linkedin':             '/connector-logos/linkedin.svg',
  'meta':                 '/connector-logos/meta.svg',
  'meta-ads':             '/connector-logos/meta.svg',
  'meta_ads':             '/connector-logos/meta.svg',
  'metaads':              '/connector-logos/meta.svg',
  'facebook':             '/connector-logos/meta.svg',
  'facebook-ads':         '/connector-logos/meta.svg',
  'facebook_ads':         '/connector-logos/meta.svg',
  'facebookads':          '/connector-logos/meta.svg',
  'notion':               '/connector-logos/notion.svg',
  'outlook':              '/connector-logos/outlook.svg',
  'microsoft-outlook':    '/connector-logos/outlook.svg',
  'salesforce':           '/connector-logos/salesforce.svg',
  'shipengine':           '/connector-logos/shipengine.jpeg',
  'ship-engine':          '/connector-logos/shipengine.jpeg',
  'shopify':              '/connector-logos/shopify.svg',
  'slack':                '/connector-logos/slack.svg',
  'stripe':               '/connector-logos/stripe.svg',
  'zoom':                 '/connector-logos/zoom.svg',
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="4.5" stroke="var(--neutral-400)" strokeWidth="1.5"/>
      <path d="M10.5 10.5L13.5 13.5" stroke="var(--neutral-400)" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M13.5 4.5L4.5 13.5M4.5 4.5L13.5 13.5" stroke="var(--neutral-600)" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function SpinnerIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      style={{ animation: 'conn-spin 0.8s linear infinite', flexShrink: 0 }}
    >
      <style>{`@keyframes conn-spin { to { transform: rotate(360deg) } }`}</style>
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 3v10M6 9l4 4 4-4M4 15h12" stroke="var(--neutral-500)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function FilterIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M3 5h14M6 10h8M9 15h2" stroke="var(--neutral-500)" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function ChevronDownIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ── Connector icon / avatar ───────────────────────────────────────────────────

function ConnectorAvatar({ entry, size = 26 }: { entry: ConnectorCatalogEntry; size?: number }) {
  const localLogo = CONNECTOR_LOGO_MAP[entry.slug]

  if (localLogo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element, react-doctor/nextjs-no-img-element -- local brand asset
      <img src={localLogo} alt={entry.display_name} width={size} height={size} style={{ objectFit: 'contain', flexShrink: 0 }} />
    )
  }

  if (entry.icon_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element, react-doctor/nextjs-no-img-element -- dynamic connector icon URL
      <img src={entry.icon_url} alt={entry.display_name} width={size} height={size} style={{ objectFit: 'contain', flexShrink: 0 }} />
    )
  }

  const letter = entry.display_name.charAt(0).toUpperCase()
  const hue    = [...entry.slug].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
  return (
    <div style={{
      width: size, height: size, borderRadius: 4,
      backgroundColor: `hsl(${hue} 60% 90%)`, color: `hsl(${hue} 60% 35%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: size * 0.45,
      flexShrink: 0, userSelect: 'none',
    }}>
      {letter}
    </div>
  )
}

// ── Toggle switch ─────────────────────────────────────────────────────────────

function ToggleSwitch({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      aria-checked={on}
      role="switch"
      style={{
        position: 'relative', display: 'inline-block',
        width: 34, height: 20, borderRadius: 20,
        border: 'none', padding: 0, cursor: disabled ? 'not-allowed' : 'pointer', flexShrink: 0,
        backgroundColor: on ? '#6e98cb' : 'var(--neutral-200, #d1c6bd)',
        boxShadow: on
          ? '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(19,84,135,0.7)'
          : '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(106,98,93,0.3)',
        transition: 'background-color 200ms',
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: on ? 16 : 2,
        width: 16, height: 16, borderRadius: '50%',
        backgroundColor: 'white',
        boxShadow: '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(19,84,135,0.4)',
        transition: 'left 200ms',
      }} />
    </button>
  )
}

// ── Status badges ─────────────────────────────────────────────────────────────

function OnBadge() {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      height: 20, padding: '2px 4px', borderRadius: 6,
      backgroundColor: '#e9dfc9',
      boxShadow: '0px 1px 1.5px 0px rgba(20,16,5,0.2), 0px 0px 0px 1px rgba(143,116,39,0.5)',
    }}>
      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11, lineHeight: '16px', color: '#6d5921' }}>
        ON
      </span>
    </div>
  )
}

function ConnectedBadge() {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      height: 20, padding: '2px 4px', borderRadius: 6,
      backgroundColor: 'var(--neutral-100, #ede1d7)',
      boxShadow: '0px 1px 1.5px 0px rgba(18,12,8,0.2), 0px 0px 0px 1px rgba(106,98,93,0.5)',
      position: 'relative',
    }}>
      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-700, #524b47)', position: 'relative' }}>
        Connected
      </span>
    </div>
  )
}

// ── Policy helpers ────────────────────────────────────────────────────────────

type UIPolicy = 'Always allow' | 'Ask' | 'Never' | 'Allow once'

const UI_TO_API: Record<UIPolicy, ConnectorTool['policy']> = {
  'Always allow': 'allow',
  'Ask':          'ask',
  'Never':        'block',
  'Allow once':   'allow_once',
}

const API_TO_UI: Record<ConnectorTool['policy'], UIPolicy> = {
  allow:      'Always allow',
  ask:        'Ask',
  block:      'Never',
  allow_once: 'Allow once',
}

const POLICY_OPTIONS: UIPolicy[] = ['Always allow', 'Ask', 'Never', 'Allow once']

// ── Policy dropdown ───────────────────────────────────────────────────────────

function PolicyDropdown({ value, onChange, disabled }: {
  value:    UIPolicy
  onChange: (v: UIPolicy) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px',
          borderRadius: 8, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1, backgroundColor: 'white',
          boxShadow: '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-200)',
          fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, lineHeight: '20px',
          color: 'var(--neutral-700)', whiteSpace: 'nowrap',
        }}
      >
        {value}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="var(--neutral-500)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <>
          {/* eslint-disable-next-line react-doctor/click-events-have-key-events, react-doctor/no-static-element-interactions -- interactive div */}
          <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', right: 0, top: 'calc(100% + 4px)',
            backgroundColor: 'white', borderRadius: 10,
            boxShadow: '0px 4px 16px 0px rgba(38,33,30,0.12), 0px 0px 0px 1px var(--neutral-100)',
            overflow: 'hidden', zIndex: 20, minWidth: 130,
          }}>
            {POLICY_OPTIONS.map(opt => (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false) }}
                style={{
                  display: 'flex', width: '100%', padding: '8px 12px', border: 'none',
                  backgroundColor: opt === value ? 'var(--neutral-50)' : 'transparent',
                  cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: opt === value ? 500 : 400,
                  fontSize: 13, lineHeight: '20px', color: 'var(--neutral-700)',
                  textAlign: 'left', whiteSpace: 'nowrap',
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Tool permissions modal ────────────────────────────────────────────────────

function ToolPermissionsModal({ entry, onClose, onUpdate }: {
  entry:    ConnectorCatalogEntry
  onClose:  () => void
  onUpdate: (updated: ConnectorCatalogEntry) => void
}) {
  // eslint-disable-next-line react-doctor/no-derived-useState -- intentional draft-state pattern
  const [tools,     setTools]     = useState<ConnectorTool[]>(entry.tools ?? [])
  const [saving,    setSaving]    = useState<string | null>(null)
  const [unlinking, setUnlinking] = useState(false)
  const [expanded,  setExpanded]  = useState(false)
  const abortedRef = useRef(false)
  useEffect(() => {
    abortedRef.current = false
    return () => { abortedRef.current = true }
  }, [])

  const handlePolicyChange = useCallback(async (toolSlug: string, uiPolicy: UIPolicy) => {
    if (abortedRef.current) return
    const apiPolicy = UI_TO_API[uiPolicy]
    setTools(prev => prev.map(t => t.slug === toolSlug ? { ...t, policy: apiPolicy } : t))
    setSaving(toolSlug)
    try {
      // eslint-disable-next-line react-doctor/async-defer-await -- abort-guard
      const updated = await updateConnector(entry.slug, { permissions: [{ slug: toolSlug, policy: apiPolicy }] })
      if (abortedRef.current) return
      setTools(updated.tools ?? [])
      onUpdate(updated)
      toast.success('Permission updated')
    } catch (err) {
      if (abortedRef.current) return
      setTools(entry.tools ?? [])
      toast.error(err instanceof Error ? err.message : 'Failed to update permission')
    } finally {
      if (!abortedRef.current) setSaving(null)
    }
  }, [entry, onUpdate])

  const handleDisconnect = useCallback(async () => {
    if (abortedRef.current) return
    setUnlinking(true)
    try {
      // eslint-disable-next-line react-doctor/async-defer-await -- abort-guard
      await unlinkConnector(entry.slug)
      if (abortedRef.current) return
      toast.success(`${entry.display_name} disconnected`)
      onUpdate({ ...entry, linked: false, tools: [] })
      onClose()
    } catch (err) {
      if (abortedRef.current) return
      toast.error(err instanceof Error ? err.message : 'Failed to disconnect')
      setUnlinking(false)
    }
  }, [entry, onUpdate, onClose])

  const COLLAPSED_COUNT = 5
  const visibleTools = expanded ? tools : tools.slice(0, COLLAPSED_COUNT)
  const hasMore = tools.length > COLLAPSED_COUNT

  return (
    <>
      {/* eslint-disable-next-line react-doctor/click-events-have-key-events, react-doctor/no-static-element-interactions -- backdrop overlay */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(38,33,30,0.32)', zIndex: 50 }} />
      <div className="kaya-scrollbar" style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 51, backgroundColor: 'white', borderRadius: 16,
        boxShadow: '0px 8px 32px 0px rgba(38,33,30,0.18), 0px 0px 0px 1px var(--neutral-100)',
        width: 680, maxWidth: 'calc(100vw - 48px)', maxHeight: 'calc(100vh - 96px)', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 24px 16px', borderBottom: '1px solid var(--neutral-100)' }}>
          <div style={{ width: 38, height: 38, backgroundColor: 'white', border: '1px solid var(--neutral-100)', borderRadius: 5, padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ConnectorAvatar entry={entry} size={26} />
          </div>
          <div style={{ flex: '1 0 0', minWidth: 0 }}>
            <h2 style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 18, lineHeight: '26px', color: 'var(--neutral-900)', margin: 0 }}>
              {entry.display_name}
            </h2>
            <ConnectedBadge />
          </div>
          <button
            onClick={onClose}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: 'none', backgroundColor: 'transparent', cursor: 'pointer', flexShrink: 0 }}
          >
            <XIcon />
          </button>
        </div>

        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--neutral-100)' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
            {entry.description}
          </p>
        </div>

        <div style={{ padding: '20px 24px' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: '0 0 4px' }}>
            Tool permissions
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-500)', margin: '0 0 16px' }}>
            Choose when this persona is allowed to use each tool.
          </p>

          {tools.length === 0 ? (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-400)', margin: 0 }}>
              No tools available for this connector.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {visibleTools.map((tool, idx) => (
                <div key={tool.slug}>
                  {idx > 0 && <div style={{ height: 1, backgroundColor: 'var(--neutral-100)' }} />}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
                    <span style={{ flex: '1 0 0', minWidth: 0, fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tool.slug}
                    </span>
                    <PolicyDropdown
                      value={API_TO_UI[tool.policy]}
                      onChange={v => void handlePolicyChange(tool.slug, v)}
                      disabled={saving === tool.slug}
                    />
                    {saving === tool.slug && <SpinnerIcon size={12} />}
                  </div>
                </div>
              ))}
              {hasMore && (
                <button
                  onClick={() => setExpanded(e => !e)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '8px 0', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-500)' }}
                >
                  {expanded ? 'Show less' : `Show ${tools.length - COLLAPSED_COUNT} more tools`}
                </button>
              )}
            </div>
          )}
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--neutral-100)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => void handleDisconnect()}
            disabled={unlinking}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8,
              border: '1px solid var(--red-200, #FECACA)', backgroundColor: 'transparent',
              cursor: unlinking ? 'not-allowed' : 'pointer', opacity: unlinking ? 0.6 : 1,
              fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: 'var(--red-600, #DC2626)',
            }}
          >
            {unlinking ? <><SpinnerIcon size={12} /> Disconnecting…</> : 'Disconnect'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Connect flow hook (OAuth + API key) ───────────────────────────────────────

type ConnectState = 'idle' | 'opening' | 'polling' | 'submitting' | 'error'

function useConnectFlow(
  entry: ConnectorCatalogEntry,
  onConnected: (updated: ConnectorCatalogEntry) => void,
) {
  const [state,        setState]        = useState<ConnectState>('idle')
  const [errorMsg,     setErrorMsg]     = useState('')
  const [apiKeyValues, setApiKeyValues] = useState<Record<string, string>>({})
  const abortedRef = useRef(false)
  useEffect(() => {
    abortedRef.current = false
    return () => { abortedRef.current = true }
  }, [])

  const startOAuth = useCallback(() => {
    const popup = window.open('', '_blank', 'width=900,height=700')
    setState('opening')
    setErrorMsg('')

    initiateLink(entry.slug)
      .then((link) => {
        if (abortedRef.current) { popup?.close(); return }
        const url = link.redirect_url
        if (!url) {
          popup?.close()
          throw new Error(`${entry.display_name} did not return an OAuth URL.`)
        }
        if (popup && !popup.closed) {
          popup.location.href = url
        } else {
          window.open(url, '_blank')
        }
        setState('polling')
        return pollConnectorUntilActive(entry.slug)
      })
      .then((activeEntry) => {
        if (!activeEntry || abortedRef.current) return
        popup?.close()
        setState('idle')
        toast.success(`${entry.display_name} connected`)
        onConnected(activeEntry)
      })
      .catch((err: unknown) => {
        if (abortedRef.current) return
        popup?.close()
        setState('error')
        let msg = err instanceof Error ? err.message : 'Connection failed'
        if (err instanceof ApiError && err.status >= 500) {
          msg = err.rawMessage
            ? `${entry.display_name} (${err.status}): ${err.rawMessage}`
            : `${entry.display_name}: backend returned ${err.status}.`
        }
        setErrorMsg(msg)
        toast.error(msg)
      })
  }, [entry, onConnected])

  const submitApiKey = useCallback(() => {
    setState('submitting')
    setErrorMsg('')
    updateConnector(entry.slug, { credentials: apiKeyValues })
      .then((updated) => {
        if (abortedRef.current) return
        setState('idle')
        toast.success(`${entry.display_name} connected`)
        onConnected(updated)
      })
      .catch((err: unknown) => {
        if (abortedRef.current) return
        setState('error')
        const msg = err instanceof Error ? err.message : 'Failed to save credentials'
        setErrorMsg(msg)
        toast.error(`Failed to connect ${entry.display_name}`)
      })
  }, [entry, apiKeyValues, onConnected])

  return { state, errorMsg, apiKeyValues, setApiKeyValues, startOAuth, submitApiKey }
}

// ── API-key inline form ───────────────────────────────────────────────────────

function ApiKeyForm({ fields, values, onChange, onSubmit, onCancel, submitting }: {
  fields:     ApiKeyField[]
  values:     Record<string, string>
  onChange:   (vals: Record<string, string>) => void
  onSubmit:   () => void
  onCancel:   () => void
  submitting: boolean
}) {
  const allFilled = fields.filter(f => f.required).every(f => (values[f.name] ?? '').trim())
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {fields.map(field => (
        <div key={field.name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 500, color: 'var(--neutral-600)' }}>
            {field.label}
          </label>
          <input
            type={field.secret ? 'password' : 'text'}
            autoComplete="off"
            placeholder={field.help ?? field.label}
            value={values[field.name] ?? ''}
            onChange={e => onChange({ ...values, [field.name]: e.target.value })}
            // eslint-disable-next-line react-doctor/no-outline-none -- focus-visible handled globally
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--neutral-300)', fontFamily: 'var(--font-body)', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box', backgroundColor: 'white' }}
          />
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button
          onClick={onSubmit}
          disabled={!allFilled || submitting}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: 'none',
            cursor: (!allFilled || submitting) ? 'not-allowed' : 'pointer', opacity: (!allFilled || submitting) ? 0.55 : 1,
            background: 'linear-gradient(180deg, var(--neutral-700) 0%, var(--neutral-900) 100%)',
            fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, color: 'white',
          }}
        >
          {submitting ? <><SpinnerIcon size={12} /> Connecting…</> : 'Connect'}
        </button>
        <button
          onClick={onCancel}
          disabled={submitting}
          style={{
            display: 'inline-flex', alignItems: 'center', padding: '6px 14px', borderRadius: 8,
            border: '1px solid var(--neutral-200)', cursor: submitting ? 'not-allowed' : 'pointer',
            backgroundColor: 'white', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, color: 'var(--neutral-700)',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Connector row (personal) ──────────────────────────────────────────────────

function ConnectorRow({ entry, isExpanded, onExpandToggle, onManage, onUpdate }: {
  entry:          ConnectorCatalogEntry
  isExpanded:     boolean
  onExpandToggle: (slug: string) => void
  onManage:       (e: ConnectorCatalogEntry) => void
  onUpdate:       (updated: ConnectorCatalogEntry) => void
}) {
  const [disconnecting, setDisconnecting] = useState(false)

  const { state, errorMsg, apiKeyValues, setApiKeyValues, startOAuth, submitApiKey } = useConnectFlow(
    entry,
    (updated) => {
      onExpandToggle(entry.slug)
      onUpdate(updated)
    },
  )

  const isPolling    = state === 'polling'
  const isOpening    = state === 'opening'
  const isSubmitting = state === 'submitting'
  const isBusy       = isPolling || isOpening || isSubmitting || disconnecting

  const handleToggleOff = async () => {
    if (disconnecting) return
    setDisconnecting(true)
    try {
      await unlinkConnector(entry.slug)
      toast.success(`${entry.display_name} disconnected`)
      onUpdate({ ...entry, linked: false, tools: [] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to disconnect')
    } finally {
      setDisconnecting(false)
    }
  }

  const handleConnectClick = () => {
    onExpandToggle(entry.slug)
  }

  const handleContinueWithOAuth = () => {
    startOAuth()
  }

  return (
    <>
      {/* Row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        height: 56, padding: '0 12px', borderRadius: 12,
      }}>
        {/* Logo */}
        <div style={{
          width: 38, height: 38, backgroundColor: 'white', borderRadius: 5,
          padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <ConnectorAvatar entry={entry} size={26} />
        </div>

        {/* Name + subtitle */}
        <div style={{ flex: '1 0 0', minWidth: 0 }}>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: '#3b3632', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {entry.display_name}
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11, lineHeight: '16px', color: '#827a74', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {entry.description}
          </p>
        </div>

        {/* Right controls */}
        {entry.linked ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <OnBadge />
            <ToggleSwitch on={true} onChange={() => void handleToggleOff()} disabled={disconnecting} />
          </div>
        ) : (
          <button
            onClick={handleConnectClick}
            disabled={isBusy}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 2, padding: '5px 8px',
              borderRadius: 8, border: 'none', cursor: isBusy ? 'not-allowed' : 'pointer',
              opacity: isBusy ? 0.7 : 1,
              backgroundColor: 'rgba(255,255,255,0)',
              boxShadow: '0px 0px 0px 1px rgba(59,54,50,0.3)',
              fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px',
              color: 'var(--neutral-800, #3b3632)', whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            {isPolling ? <><SpinnerIcon size={12} /> Connecting…</> : isOpening ? 'Opening…' : (
              <>
                Connect
                <ChevronDownIcon size={16} />
              </>
            )}
          </button>
        )}
      </div>

      {/* Inline connect panel (API key only — OAuth opens popup) */}
      {isExpanded && !entry.linked && entry.auth_mode === 'api_key' && (
        <div style={{ padding: '0 12px 16px 12px' }}>
          <div style={{ padding: '16px', borderRadius: 10, backgroundColor: 'white', boxShadow: '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: '#0a0a0a', margin: '0 0 4px' }}>
              Connect {entry.display_name}
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11, lineHeight: '16px', color: '#6a625d', margin: '0 0 12px' }}>
              {entry.description}. This connection is stored in Settings and can be removed at any time.
            </p>
            {state === 'error' && errorMsg && (
              <p style={{ margin: '0 0 8px', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--red-600, #DC2626)' }}>
                {errorMsg}
              </p>
            )}
            <ApiKeyForm
              fields={entry.api_key_fields && entry.api_key_fields.length > 0 ? entry.api_key_fields : [DEFAULT_API_KEY_FIELD]}
              values={apiKeyValues}
              onChange={setApiKeyValues}
              onSubmit={submitApiKey}
              onCancel={() => onExpandToggle(entry.slug)}
              submitting={isSubmitting}
            />
          </div>
        </div>
      )}

      {/* Inline connect panel (OAuth) */}
      {isExpanded && !entry.linked && entry.auth_mode === 'oauth2' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px 16px 12px', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 0 0', minWidth: 0 }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: '#0a0a0a', margin: 0, whiteSpace: 'nowrap' }}>
              Connect {entry.display_name}
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11, lineHeight: '16px', color: '#6a625d', margin: 0, maxWidth: 560 }}>
              Sign in to {entry.display_name} to allow this persona to access your account.<br />
              This connection is stored in Settings and can be removed at any time.
            </p>
            {state === 'error' && errorMsg && (
              <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--red-600, #DC2626)' }}>
                {errorMsg}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {!isBusy && (
              <button
                onClick={() => onExpandToggle(entry.slug)}
                style={{ padding: '6px 10px 8px', borderRadius: 8, border: '1px solid var(--neutral-200)', backgroundColor: 'white', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: 'var(--neutral-700)' }}
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleContinueWithOAuth}
              disabled={isBusy}
              style={{
                position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '6px 10px 8px', borderRadius: 8, border: 'none',
                cursor: isBusy ? 'not-allowed' : 'pointer', overflow: 'hidden',
                boxShadow: '0px 0px 0px 1px black, 0px 1.091px 1.091px 0px rgba(59,54,50,0.1), 0px 1.455px 3.127px 0px rgba(59,54,50,0.4)',
              }}
            >
              <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, var(--neutral-700) 0%, var(--neutral-900) 100%)', pointerEvents: 'none' }} />
              <div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', boxShadow: 'inset 0px 1px 0.364px 0px rgba(247,242,237,0.3), inset 0px -2.182px 0.364px 0px #120c08, inset 0px -2.545px 4px -2.182px rgba(247,242,237,0.5)', pointerEvents: 'none' }} />
              <span style={{ position: 'relative', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'white', whiteSpace: 'nowrap' }}>
                {isBusy ? <><SpinnerIcon size={12} /> Connecting…</> : `Continue with ${entry.display_name}`}
              </span>
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// ── Workspace connector row (read-only) ───────────────────────────────────────

function WorkspaceConnectorRow({ entry, workspaceName }: {
  entry:         ConnectorCatalogEntry
  workspaceName: string
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      height: 56, padding: '0 12px', borderRadius: 12,
    }}>
      <div style={{
        width: 38, height: 38, backgroundColor: 'white', borderRadius: 5,
        padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <ConnectorAvatar entry={entry} size={26} />
      </div>
      <div style={{ flex: '1 0 0', minWidth: 0 }}>
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: '#3b3632', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.display_name}
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11, lineHeight: '16px', color: '#827a74', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.description}
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11, lineHeight: '16px', color: '#6a625d', whiteSpace: 'nowrap' }}>
          {workspaceName}
        </span>
        <ConnectedBadge />
      </div>
    </div>
  )
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 56, padding: '0 12px' }}>
      <div style={{ width: 38, height: 38, borderRadius: 5, backgroundColor: 'var(--neutral-100)' }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ height: 14, width: '40%', borderRadius: 4, backgroundColor: 'var(--neutral-100)' }} />
        <div style={{ height: 11, width: '60%', borderRadius: 4, backgroundColor: 'var(--neutral-100)' }} />
      </div>
      <div style={{ height: 20, width: 60, borderRadius: 6, backgroundColor: 'var(--neutral-100)' }} />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

// eslint-disable-next-line react-doctor/prefer-useReducer -- multiple useState calls; refactor deferred
export default function ConnectorsTab() {
  const { push } = useRouter()
  const [connectors,   setConnectors]   = useState<ConnectorCatalogEntry[]>([])
  const [loading,      setLoading]      = useState(true)
  const [loadError,    setLoadError]    = useState('')
  const [searchQuery,  setSearchQuery]  = useState('')
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null)
  const [modalEntry,   setModalEntry]   = useState<ConnectorCatalogEntry | null>(null)

  const fetchConnectors = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const list = await listConnectors()
      setConnectors(list)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load connectors'
      setLoadError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchConnectors() }, [fetchConnectors])

  const handleUpdate = useCallback((updated: ConnectorCatalogEntry) => {
    setConnectors(prev => prev.map(c => c.slug === updated.slug ? updated : c))
    setModalEntry(prev => prev?.slug === updated.slug ? updated : prev)
    if (!updated.linked) setModalEntry(null)
  }, [])

  const handleExpandToggle = useCallback((slug: string) => {
    setExpandedSlug(prev => prev === slug ? null : slug)
  }, [])

  const filtered = searchQuery.trim()
    ? connectors.filter(c =>
        c.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.slug.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : connectors

  // Workspace connectors would come from the API when supported (scope: 'workspace').
  // For now this list is always empty; the section only renders when populated.
  const workspaceConnectors: ConnectorCatalogEntry[] = []
  const personalConnectors = filtered

  const sectionLabel: React.CSSProperties = {
    fontFamily: 'var(--font-body)',
    fontWeight: 500,
    fontSize:   14,
    lineHeight: '22px',
    color:      '#0a0a0a',
    margin:     0,
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%', paddingTop: 3 }}>

        {/* Heading + Add connectors button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <h2 style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: '#1a1916', margin: 0, whiteSpace: 'nowrap' }}>
            Connectors Management
          </h2>
          <Button
            leftIcon={<PlusSignIcon size={16} />}
            onClick={() => push('/settings/connectors')}
          >
            Add connectors
          </Button>
        </div>

        {/* Search + filter actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', alignItems: 'center', gap: 2, padding: '7px 10px', borderRadius: 10, backgroundColor: 'white', boxShadow: '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)' }}>
            <SearchIcon />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search connectors…"
              // eslint-disable-next-line react-doctor/no-outline-none -- focus-visible handled globally
              style={{ flex: 1, minWidth: 0, padding: '0 2px', fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: '#6a625d', backgroundColor: 'transparent', border: 'none', outline: 'none' }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ display: 'flex', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}>
                <XIcon />
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 4px' }}>
            <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6, borderRadius: 8, border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}>
              <DownloadIcon />
            </button>
            <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6, borderRadius: 8, border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}>
              <FilterIcon />
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'var(--neutral-50, #f7f2ed)', borderRadius: 10 }}>
            {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : loadError ? (
          <div style={{ padding: '24px 0', textAlign: 'center' as const }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-500)', margin: '0 0 12px' }}>
              {loadError}
            </p>
            <button
              onClick={() => void fetchConnectors()}
              style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--neutral-200)', backgroundColor: 'white', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-700)' }}
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Workspace Connectors */}
            {workspaceConnectors.length > 0 && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={sectionLabel}>Workspace Connectors</p>
                <div style={{ backgroundColor: 'var(--neutral-50, #f7f2ed)', borderRadius: 10, overflow: 'hidden' }}>
                  {workspaceConnectors.map(c => (
                    <WorkspaceConnectorRow key={c.slug} entry={c} workspaceName="Workspace" />
                  ))}
                </div>
              </section>
            )}

            {/* Personal Connectors */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={sectionLabel}>Personal Connectors</p>
              {personalConnectors.length === 0 ? (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0, padding: '24px 0', textAlign: 'center' as const }}>
                  {searchQuery ? `No connectors found for "${searchQuery}"` : 'No connectors available.'}
                </p>
              ) : (
                <div style={{ backgroundColor: 'var(--neutral-50, #f7f2ed)', borderRadius: 10, overflow: 'hidden' }}>
                  {personalConnectors.map(c => (
                    <ConnectorRow
                      key={c.slug}
                      entry={c}
                      isExpanded={expandedSlug === c.slug}
                      onExpandToggle={handleExpandToggle}
                      onManage={setModalEntry}
                      onUpdate={handleUpdate}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}

      </div>

      {modalEntry && modalEntry.linked && (
        <ToolPermissionsModal
          entry={modalEntry}
          onClose={() => setModalEntry(null)}
          onUpdate={handleUpdate}
        />
      )}
    </>
  )
}
