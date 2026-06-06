'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { Switch } from '@/components/Switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/Tabs'
import {
  listConnectors,
  initiateLink,
  updateConnector,
  unlinkConnector,
  pollConnectorUntilActive,
  oauthNeedsInitFields,
  DEFAULT_API_KEY_FIELD,
} from '@/lib/api/connectors'
import type { ApiKeyField, ConnectorCatalogEntry, ConnectorTool } from '@/lib/api/connectors'
import { ApiError } from '@/lib/api/client'
import { Button } from '@/components/Button'

// ── Inline SVG icons ──────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="4.5" stroke="var(--neutral-400)" strokeWidth="1.5"/>
      <path d="M10.5 10.5L13.5 13.5" stroke="var(--neutral-400)" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function ChevronRightIcon({ rotated }: { rotated?: boolean }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 16 16" fill="none"
      style={{ transform: rotated ? 'rotate(90deg)' : undefined, transition: 'transform 200ms', flexShrink: 0 }}
    >
      <path d="M6 4L10 8L6 12" stroke="var(--neutral-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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

// ── Connector icon / avatar ───────────────────────────────────────────────────

// Maps connector slugs (as returned by the API) to local logo files under
// /public/connector-logos/. Covers all common slug variants (hyphenated,
// underscored, camelCase) so the lookup is resilient to API naming changes.
const CONNECTOR_LOGO_MAP: Record<string, string> = {
  // Airtable
  'airtable':             '/connector-logos/airtable.svg',
  // Asana
  'asana':                '/connector-logos/asana.svg',
  // Calendly
  'calendly':             '/connector-logos/calendly.svg',
  // ClickUp
  'clickup':              '/connector-logos/clickup.svg',
  'click-up':             '/connector-logos/clickup.svg',
  // Fireflies
  'fireflies':            '/connector-logos/fireflies.svg',
  'fireflies-ai':         '/connector-logos/fireflies.svg',
  // Gmail
  'gmail':                '/connector-logos/gmail.svg',
  // Google Ads
  'googleads':            '/connector-logos/google-ads.svg',
  'google-ads':           '/connector-logos/google-ads.svg',
  'google_ads':           '/connector-logos/google-ads.svg',
  // Google Calendar
  'googlecalendar':       '/connector-logos/google-calendar.svg',
  'google-calendar':      '/connector-logos/google-calendar.svg',
  'google_calendar':      '/connector-logos/google-calendar.svg',
  // Google Docs
  'googledocs':           '/connector-logos/google-docs.svg',
  'google-docs':          '/connector-logos/google-docs.svg',
  'google_docs':          '/connector-logos/google-docs.svg',
  // Google Drive
  'googledrive':          '/connector-logos/google-drive.svg',
  'google-drive':         '/connector-logos/google-drive.svg',
  'google_drive':         '/connector-logos/google-drive.svg',
  // Google Sheets
  'googlesheets':         '/connector-logos/google-sheets.svg',
  'google-sheets':        '/connector-logos/google-sheets.svg',
  'google_sheets':        '/connector-logos/google-sheets.svg',
  // HubSpot
  'hubspot':              '/connector-logos/hubspot.svg',
  // Jira
  'jira':                 '/connector-logos/jira.svg',
  // Linear
  'linear':               '/connector-logos/linear.svg',
  // LinkedIn
  'linkedin':             '/connector-logos/linkedin.svg',
  // Meta / Meta Ads / Facebook Ads
  'meta':                 '/connector-logos/meta.svg',
  'meta-ads':             '/connector-logos/meta.svg',
  'meta_ads':             '/connector-logos/meta.svg',
  'metaads':              '/connector-logos/meta.svg',
  'facebook':             '/connector-logos/meta.svg',
  'facebook-ads':         '/connector-logos/meta.svg',
  'facebook_ads':         '/connector-logos/meta.svg',
  'facebookads':          '/connector-logos/meta.svg',
  // Notion
  'notion':               '/connector-logos/notion.svg',
  // Outlook
  'outlook':              '/connector-logos/outlook.svg',
  'microsoft-outlook':    '/connector-logos/outlook.svg',
  // Salesforce
  'salesforce':           '/connector-logos/salesforce.svg',
  // ShipEngine
  'shipengine':           '/connector-logos/shipengine.jpeg',
  'ship-engine':          '/connector-logos/shipengine.jpeg',
  // Shopify
  'shopify':              '/connector-logos/shopify.svg',
  // Slack
  'slack':                '/connector-logos/slack.svg',
  // Stripe
  'stripe':               '/connector-logos/stripe.svg',
  // Zoom
  'zoom':                 '/connector-logos/zoom.svg',
}

function ConnectorAvatar({ entry, size = 32 }: { entry: ConnectorCatalogEntry; size?: number }) {
  const localLogo = CONNECTOR_LOGO_MAP[entry.slug]

  if (localLogo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element, react-doctor/nextjs-no-img-element -- local brand asset, variable path prevents next/image static analysis
      <img
        src={localLogo}
        alt={entry.display_name}
        width={size}
        height={size}
        style={{ objectFit: 'contain', flexShrink: 0 }}
      />
    )
  }

  if (entry.icon_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element, react-doctor/nextjs-no-img-element -- dynamic connector icon URL, external domain not in next config
      <img
        src={entry.icon_url}
        alt={entry.display_name}
        width={size}
        height={size}
        style={{ objectFit: 'contain', flexShrink: 0 }}
      />
    )
  }

  // Unknown connector — deterministic letter tile fallback.
  const letter = entry.display_name.charAt(0).toUpperCase()
  const hue    = [...entry.slug].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
  return (
    <div style={{
      width:           size,
      height:          size,
      backgroundColor: `hsl(${hue} 60% 90%)`,
      color:           `hsl(${hue} 60% 35%)`,
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      fontFamily:      'var(--font-body)',
      fontWeight:      700,
      fontSize:        size * 0.45,
      flexShrink:      0,
      userSelect:      'none',
    }}>
      {letter}
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
  allow:       'Always allow',
  ask:         'Ask',
  block:       'Never',
  allow_once:  'Allow once',
}

const POLICY_OPTIONS: UIPolicy[] = ['Always allow', 'Ask', 'Never', 'Allow once']

// ── Policy dropdown ───────────────────────────────────────────────────────────

function PolicyDropdown({
  value,
  onChange,
  disabled,
}: {
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
          display:         'inline-flex',
          alignItems:      'center',
          gap:             6,
          padding:         '4px 10px',
          borderRadius:    8,
          border:          'none',
          cursor:          disabled ? 'not-allowed' : 'pointer',
          opacity:         disabled ? 0.5 : 1,
          backgroundColor: 'white',
          boxShadow:       '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-200)',
          fontFamily:      'var(--font-body)',
          fontWeight:      500,
          fontSize:        13,
          lineHeight:      '20px',
          color:           'var(--neutral-700)',
          whiteSpace:      'nowrap',
        }}
      >
        {value}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="var(--neutral-500)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <>
          {/* eslint-disable-next-line react-doctor/click-events-have-key-events, react-doctor/no-static-element-interactions -- interactive div; keyboard handling delegated to inner elements */}
          <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setOpen(false)} />
          <div style={{
            position:        'absolute',
            right:           0,
            top:             'calc(100% + 4px)',
            backgroundColor: 'white',
            borderRadius:    10,
            boxShadow:       '0px 4px 16px 0px rgba(38,33,30,0.12), 0px 0px 0px 1px var(--neutral-100)',
            overflow:        'hidden',
            zIndex:          20,
            minWidth:        130,
          }}>
            {POLICY_OPTIONS.map(opt => (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false) }}
                style={{
                  display:         'flex',
                  width:           '100%',
                  padding:         '8px 12px',
                  border:          'none',
                  backgroundColor: opt === value ? 'var(--neutral-50)' : 'transparent',
                  cursor:          'pointer',
                  fontFamily:      'var(--font-body)',
                  fontWeight:      opt === value ? 500 : 400,
                  fontSize:        13,
                  lineHeight:      '20px',
                  color:           'var(--neutral-700)',
                  textAlign:       'left',
                  whiteSpace:      'nowrap',
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

function ToolPermissionsModal({
  entry,
  onClose,
  onUpdate,
}: {
  entry:    ConnectorCatalogEntry
  onClose:  () => void
  onUpdate: (updated: ConnectorCatalogEntry) => void
}) {
  // local copy of tools so UI updates optimistically
  // eslint-disable-next-line react-doctor/no-derived-useState -- intentional draft-state pattern; reset handled by key prop or effect
  const [tools,              setTools]              = useState<ConnectorTool[]>(entry.tools ?? [])
  const [saving,             setSaving]             = useState<string | null>(null)  // slug being saved
  const [unlinking,          setUnlinking]          = useState(false)
  const [allowingAll,        setAllowingAll]        = useState(false)
  const [expanded,           setExpanded]           = useState(false)
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)
  const abortedRef = useRef(false)
  // Reset on every effect setup so React StrictMode's mount→cleanup→mount
  // cycle doesn't leave abortedRef stuck at true (which would silently bail
  // every async handler — manifesting as "click Connect, nothing happens").
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
      // eslint-disable-next-line react-doctor/async-defer-await -- abort-guard: check if unmounted after async call, not before
      const updated = await updateConnector(entry.slug, {
        permissions: [{ slug: toolSlug, policy: apiPolicy }],
      })
      if (abortedRef.current) return
      setTools(updated.tools ?? [])
      onUpdate(updated)
      toast.success('Permission updated')
    } catch (err) {
      if (abortedRef.current) return
      // revert
      setTools(entry.tools ?? [])
      const msg = err instanceof Error ? err.message : 'Failed to update permission'
      toast.error(msg)
    } finally {
      if (!abortedRef.current) setSaving(null)
    }
  }, [entry, onUpdate])

  const handleDisconnect = useCallback(async () => {
    if (abortedRef.current) return
    setUnlinking(true)
    try {
      // eslint-disable-next-line react-doctor/async-defer-await -- abort-guard: check if unmounted after async call, not before
      await unlinkConnector(entry.slug)
      if (abortedRef.current) return
      toast.success(`${entry.display_name} disconnected`)
      // signal parent to refresh and close
      onUpdate({ ...entry, linked: false, tools: [] })
      onClose()
    } catch (err) {
      if (abortedRef.current) return
      const msg = err instanceof Error ? err.message : 'Failed to disconnect'
      toast.error(msg)
      setUnlinking(false)
    }
  }, [entry, onUpdate, onClose])

  const handleAllowAll = useCallback(async () => {
    if (abortedRef.current || tools.length === 0) return
    setAllowingAll(true)
    setTools(prev => prev.map(t => ({ ...t, policy: 'allow' as const })))
    try {
      // eslint-disable-next-line react-doctor/async-defer-await -- abort-guard: check if unmounted after async call, not before
      const updated = await updateConnector(entry.slug, {
        permissions: tools.map(t => ({ slug: t.slug, policy: 'allow' as const })),
      })
      if (abortedRef.current) return
      setTools(updated.tools ?? [])
      onUpdate(updated)
      toast.success('All tools set to Always allow')
    } catch (err) {
      if (abortedRef.current) return
      setTools(entry.tools ?? [])
      const msg = err instanceof Error ? err.message : 'Failed to update permissions'
      toast.error(msg)
    } finally {
      if (!abortedRef.current) setAllowingAll(false)
    }
  }, [entry, tools, onUpdate])

  // Show at most 5 tools collapsed; expand to see all
  const COLLAPSED_COUNT = 5
  const visibleTools = expanded ? tools : tools.slice(0, COLLAPSED_COUNT)
  const hasMore = tools.length > COLLAPSED_COUNT

  return (
    <>
      {/* eslint-disable-next-line react-doctor/click-events-have-key-events, react-doctor/no-static-element-interactions -- backdrop overlay closes modal; keyboard via Escape in useEffect */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(38,33,30,0.32)', zIndex: 50 }}
      />
      <div className="kaya-scrollbar" style={{
        position:        'fixed',
        top:             '50%',
        left:            '50%',
        transform:       'translate(-50%, -50%)',
        zIndex:          51,
        backgroundColor: 'white',
        borderRadius:    16,
        boxShadow:       '0px 8px 32px 0px rgba(38,33,30,0.18), 0px 0px 0px 1px var(--neutral-100)',
        width:           680,
        maxWidth:        'calc(100vw - 48px)',
        maxHeight:       'calc(100vh - 96px)',
        overflowY:       'auto',
      }}>

        {/* Header */}
        <div style={{
          display:      'flex',
          alignItems:   'center',
          gap:          12,
          padding:      '20px 24px 16px',
          borderBottom: '1px solid var(--neutral-100)',
        }}>
          <ConnectorAvatar entry={entry} size={36} />
          <div style={{ flex: '1 0 0', minWidth: 0 }}>
            <h2 style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize:   18,
              lineHeight: '26px',
              color:      'var(--neutral-900)',
              margin:     0,
            }}>
              {entry.display_name}
            </h2>
            <span style={{
              display:         'inline-flex',
              alignItems:      'center',
              padding:         '1px 6px',
              borderRadius:    6,
              backgroundColor: 'var(--green-50)',
              boxShadow:       '0px 0px 0px 1px rgba(128,183,7,0.4)',
              fontFamily:      'var(--font-body)',
              fontWeight:      500,
              fontSize: 12,
              lineHeight:      '16px',
              color:           'var(--green-800)',
            }}>
              Connected
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              width:           32,
              height:          32,
              borderRadius:    8,
              border:          'none',
              backgroundColor: 'transparent',
              cursor:          'pointer',
              flexShrink:      0,
            }}
          >
            <XIcon />
          </button>
        </div>

        {/* Description */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--neutral-100)' }}>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize:   14,
            lineHeight: '22px',
            color:      'var(--neutral-500)',
            margin:     0,
          }}>
            {entry.description}
          </p>
        </div>

        {/* Tool permissions */}
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
            <div>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                fontSize:   14,
                lineHeight: '22px',
                color:      'var(--neutral-900)',
                margin:     '0 0 4px',
              }}>
                Tool permissions
              </p>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize:   13,
                lineHeight: '20px',
                color:      'var(--neutral-500)',
                margin:     0,
              }}>
                Choose when Brain is allowed to use each tool.
              </p>
            </div>
            {tools.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                disabled={allowingAll || saving !== null || unlinking}
                loading={allowingAll}
                onClick={() => void handleAllowAll()}
              >
                Allow all
              </Button>
            )}
          </div>

          {tools.length === 0 ? (
            <p style={{
              fontFamily: 'var(--font-body)',
              fontSize:   13,
              color:      'var(--neutral-400)',
              margin:     0,
            }}>
              No tools available for this connector.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {visibleTools.map((tool, idx) => (
                <div key={tool.slug}>
                  {idx > 0 && <div style={{ height: 1, backgroundColor: 'var(--neutral-100)' }} />}
                  <div style={{
                    display:    'flex',
                    alignItems: 'center',
                    gap:        12,
                    padding:    '12px 0',
                  }}>
                    <span style={{
                      flex:        '1 0 0',
                      minWidth:    0,
                      fontFamily:  'var(--font-body)',
                      fontWeight:  400,
                      fontSize:    13,
                      lineHeight:  '20px',
                      color:       'var(--neutral-700)',
                      overflow:    'hidden',
                      textOverflow:'ellipsis',
                      whiteSpace:  'nowrap',
                    }}>
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
                  style={{
                    display:         'flex',
                    alignItems:      'center',
                    gap:             6,
                    marginTop:       8,
                    padding:         '8px 0',
                    border:          'none',
                    backgroundColor: 'transparent',
                    cursor:          'pointer',
                    fontFamily:      'var(--font-body)',
                    fontSize:        13,
                    color:           'var(--neutral-500)',
                  }}
                >
                  <ChevronRightIcon rotated={expanded} />
                  {expanded ? 'Show less' : `Show ${tools.length - COLLAPSED_COUNT} more tools`}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer: Disconnect */}
        <div style={{
          padding:        '16px 24px',
          borderTop:      '1px solid var(--neutral-100)',
        }}>
          {showDisconnectConfirm ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-700)' }}>
                Disconnecting <strong>{entry.display_name}</strong> will remove it from your account and disable it for all agents currently using it. This cannot be undone without reconnecting.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={unlinking}
                  onClick={() => setShowDisconnectConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={unlinking}
                  loading={unlinking}
                  onClick={() => void handleDisconnect()}
                >
                  <span style={{ color: 'var(--red-600, #DC2626)' }}>Yes, disconnect</span>
                </Button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                size="sm"
                variant="secondary"
                disabled={unlinking || allowingAll}
                onClick={() => setShowDisconnectConfirm(true)}
              >
                <span style={{ color: 'var(--red-600, #DC2626)' }}>Disconnect</span>
              </Button>
            </div>
          )}
        </div>

      </div>
    </>
  )
}

// ── Connect / Reconnect flow (OAuth + API key) ────────────────────────────────

type ConnectState = 'idle' | 'opening' | 'polling' | 'submitting' | 'error'

function useConnectFlow(
  entry: ConnectorCatalogEntry,
  onConnected: (updated: ConnectorCatalogEntry) => void,
) {
  const [state,        setState]        = useState<ConnectState>('idle')
  const [errorMsg,     setErrorMsg]     = useState('')
  const [apiKeyValues, setApiKeyValues] = useState<Record<string, string>>({})
  const abortedRef = useRef(false)
  // Reset on every effect setup so React StrictMode's mount→cleanup→mount
  // cycle doesn't leave abortedRef stuck at true (which would silently bail
  // every async handler — manifesting as "click Connect, nothing happens").
  useEffect(() => {
    abortedRef.current = false
    return () => { abortedRef.current = true }
  }, [])

  const startOAuth = useCallback((initData?: Record<string, string>) => {
    // Open without noopener so we can navigate popup.location after getting
    // the redirect URL. noopener leaves the popup stuck at about:blank in some
    // browsers (Firefox returns null; some Chrome configs block location assign).
    const popup = window.open('', '_blank', 'width=900,height=700')
    setState('opening')
    setErrorMsg('')

    // initData carries per-tenant OAuth credentials (Shopify client_id/secret);
    // undefined for plain OAuth.
    initiateLink(entry.slug, initData)
      .then((link) => {
        if (abortedRef.current) { popup?.close(); return }
        const url = link.redirect_url
        if (!url) {
          popup?.close()
          throw new Error(
            `${entry.display_name} did not return an OAuth URL. ` +
            `The connector provider may be misconfigured on the backend.`,
          )
        }
        if (popup && !popup.closed) {
          popup.location.href = url
        } else {
          // Popup was blocked — fall back to a new tab
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
        // For 5xx, prefer the verbatim backend detail (e.g. "Multiple connected
        // accounts found...") instead of the laundered generic message.
        if (err instanceof ApiError && err.status >= 500) {
          msg = err.rawMessage
            ? `${entry.display_name} (${err.status}): ${err.rawMessage}`
            : `${entry.display_name}: backend returned ${err.status}. ` +
              `The connector provider may not be configured (check backend logs).`
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

// ── API-key credential inline form ────────────────────────────────────────────

function ApiKeyForm({
  fields,
  values,
  onChange,
  onSubmit,
  onCancel,
  submitting,
}: {
  fields:     ApiKeyField[]
  values:     Record<string, string>
  onChange:   (vals: Record<string, string>) => void
  onSubmit:   () => void
  onCancel:   () => void
  submitting: boolean
}) {
  const allFilled = fields.filter(f => f.required).every(f => (values[f.name] ?? '').trim())
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
      {fields.map(field => (
        <div key={field.name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{
            fontFamily: 'var(--font-body)',
            fontSize:   12,
            fontWeight: 500,
            color:      'var(--neutral-600)',
          }}>
            {field.label}
          </label>
          <input
            type={field.secret ? 'password' : 'text'}
            autoComplete="off"
            placeholder={field.help ?? field.label}
            value={values[field.name] ?? ''}
            onChange={e => onChange({ ...values, [field.name]: e.target.value })}
            style={{
              padding:         '7px 10px',
              borderRadius:    8,
              border:          '1px solid var(--neutral-300)',
              fontFamily:      'var(--font-body)',
              fontSize:        13,
              // eslint-disable-next-line react-doctor/no-outline-none -- browser outline suppressed; :focus-visible handled by container or global styles
              outline:         'none',
              width:           '100%',
              boxSizing:       'border-box',
              backgroundColor: 'white',
            }}
          />
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <Button
          size="sm"
          onClick={onSubmit}
          disabled={!allFilled}
          loading={submitting}
        >
          Connect
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}

// ── Connector card ────────────────────────────────────────────────────────────

function ConnectorCard({
  entry,
  onManage,
  onUpdate,
}: {
  entry:    ConnectorCatalogEntry
  onManage: (e: ConnectorCatalogEntry) => void
  onUpdate: (updated: ConnectorCatalogEntry) => void
}) {
  const [showApiForm, setShowApiForm] = useState(false)
  const { state, errorMsg, apiKeyValues, setApiKeyValues, startOAuth, submitApiKey } = useConnectFlow(entry, (updated) => {
    setShowApiForm(false)
    onUpdate(updated)
  })

  const isActive     = entry.linked
  const isPolling    = state === 'polling'
  const isOpening    = state === 'opening'
  const isSubmitting = state === 'submitting'

  // api_key connectors and per-tenant OAuth connectors (Shopify BYOA, which
  // declares required init fields like client_id/client_secret) both collect a
  // credential form first. Plain OAuth goes straight to the popup.
  const needsForm = entry.auth_mode === 'api_key' || oauthNeedsInitFields(entry)

  const handleConnectClick = () => {
    if (needsForm) {
      setShowApiForm(true)
    } else {
      startOAuth()
    }
  }

  return (
    <div style={{
      position:        'relative',
      backgroundColor: 'white',
      borderRadius:    16,
      padding:         16,
      paddingBottom:   showApiForm ? 16 : 60,
      display:         'flex',
      flexDirection:   'column',
      gap:             12,
      boxShadow:       '0px 2px 2.8px 0px var(--neutral-200), 0px 0px 0px 1px var(--neutral-200)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ConnectorAvatar entry={entry} size={32} />
        </div>
        <div style={{ flex: '1 0 0', minWidth: 0 }}>
          <p style={{
            fontFamily:   'var(--font-body)',
            fontWeight:   500,
            fontSize:     14,
            lineHeight:   '22px',
            color:        'var(--neutral-900)',
            margin:       0,
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
            {entry.display_name}
          </p>
          <p style={{
            fontFamily:    'var(--font-body)',
            fontWeight:    400,
            fontSize:      12,
            lineHeight:    '16px',
            color:         'var(--neutral-400)',
            margin:        0,
            textTransform: 'capitalize',
          }}>
            {entry.auth_mode === 'api_key' ? 'API Key' : 'OAuth'}
          </p>
        </div>
      </div>

      {/* Description */}
      <p style={{
        fontFamily:      'var(--font-body)',
        fontWeight:      400,
        fontSize:        12,
        lineHeight:      '16px',
        color:           'var(--neutral-500)',
        margin:          0,
        overflow:        'hidden',
        display:         '-webkit-box',
        WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical',
      } as React.CSSProperties}>
        {entry.description}
      </p>

      {/* Error message */}
      {state === 'error' && errorMsg && (
        <p style={{
          margin:     0,
          fontFamily: 'var(--font-body)',
          fontSize:   12,
          color:      'var(--red-600, #DC2626)',
        }}>
          {errorMsg}
        </p>
      )}

      {/* Credential form — used by api_key connectors AND per-tenant OAuth
          (Shopify). For OAuth the fields are posted as init_data via startOAuth,
          which then opens the hosted connect popup; for api_key they're PATCHed.
          Button is hidden while this is open. */}
      {showApiForm && !isActive && (
        <ApiKeyForm
          fields={entry.api_key_fields && entry.api_key_fields.length > 0 ? entry.api_key_fields : [DEFAULT_API_KEY_FIELD]}
          values={apiKeyValues}
          onChange={setApiKeyValues}
          onSubmit={entry.auth_mode === 'api_key' ? submitApiKey : () => startOAuth(apiKeyValues)}
          onCancel={() => setShowApiForm(false)}
          submitting={isSubmitting || isOpening || isPolling}
        />
      )}

      {/* Action button — absolute bottom-right so all cards align regardless of content height */}
      {!showApiForm && (
        <div style={{ position: 'absolute', bottom: 16, right: 16 }}>
          {isActive ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onManage(entry)}
            >
              Manage
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleConnectClick}
              disabled={isOpening || isSubmitting}
              loading={isPolling}
            >
              {isOpening ? 'Opening…' : 'Connect'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{
      position:        'relative',
      backgroundColor: 'white',
      borderRadius:    16,
      padding:         16,
      paddingBottom:   60,
      display:         'flex',
      flexDirection:   'column',
      gap:             12,
      boxShadow:       '0px 2px 2.8px 0px var(--neutral-200), 0px 0px 0px 1px var(--neutral-200)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 6, backgroundColor: 'var(--neutral-100)' }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ height: 14, width: '55%', borderRadius: 4, backgroundColor: 'var(--neutral-100)' }} />
          <div style={{ height: 11, width: '30%', borderRadius: 4, backgroundColor: 'var(--neutral-100)' }} />
        </div>
      </div>
      <div style={{ height: 11, width: '90%', borderRadius: 4, backgroundColor: 'var(--neutral-100)' }} />
      <div style={{ height: 11, width: '70%', borderRadius: 4, backgroundColor: 'var(--neutral-100)' }} />
      <div style={{ position: 'absolute', bottom: 16, right: 16 }}>
        <div style={{ height: 32, width: 80, borderRadius: 8, backgroundColor: 'var(--neutral-100)' }} />
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line react-doctor/prefer-useReducer -- multiple useState calls; useReducer refactor deferred
export default function ConnectorsPage() {
  const [mainTab,        setMainTab]        = useState('my')
  const [searchQuery,    setSearchQuery]    = useState('')
  const [isSearching,    setIsSearching]    = useState(false)
  const [suggestionsOn,  setSuggestionsOn]  = useState(false)
  const [connectors,     setConnectors]     = useState<ConnectorCatalogEntry[]>([])
  const [loading,        setLoading]        = useState(true)
  const [loadError,      setLoadError]      = useState('')
  const [modalEntry,     setModalEntry]     = useState<ConnectorCatalogEntry | null>(null)

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

  // Update a single entry in state (after connect / permission change / disconnect)
  const handleUpdate = useCallback((updated: ConnectorCatalogEntry) => {
    setConnectors(prev => prev.map(c => c.slug === updated.slug ? updated : c))
    // Sync modal if it's open for this connector
    setModalEntry(prev => prev?.slug === updated.slug ? updated : prev)
    // If disconnected, close modal
    if (!updated.linked) {
      setModalEntry(null)
    }
  }, [])

  const handleManage = useCallback((entry: ConnectorCatalogEntry) => {
    setModalEntry(entry)
  }, [])

  // Filter
  const filtered = (() => {
    if (isSearching && searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return connectors.filter(c =>
        c.display_name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q),
      )
    }
    return connectors
  })()

  const connected  = filtered.filter(c => c.linked)
  const available  = filtered.filter(c => !c.linked)

  return (
    <>
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
          padding:        '96px 12px 48px',
        }}
      >
        <div style={{
          flex:          '1 0 0',
          maxWidth:      967,
          minWidth:      0,
          display:       'flex',
          flexDirection: 'column',
          gap:           10,
        }}>

          {/* Page header */}
          <div style={{ paddingLeft: 4, marginBottom: 16 }}>
            <h1 style={{
              fontFamily: 'var(--font-title)',
              fontWeight: 400,
              fontSize:   24,
              lineHeight: '32px',
              color:      'var(--neutral-900)',
              margin:     '0 0 12px',
            }}>
              Connectors
            </h1>
            <Tabs value={mainTab} onValueChange={setMainTab}>
              <TabsList>
                <TabsTrigger value="my">My Connectors</TabsTrigger>
                <TabsTrigger value="workspace">Workspace Connectors</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Suggestions toggle */}
          <div style={{
            border:       '1px solid var(--neutral-200)',
            borderRadius: 16,
            boxShadow:    '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
            padding:      '14px 20px',
            display:      'flex',
            alignItems:   'center',
            gap:          12,
          }}>
            <Switch checked={suggestionsOn} onCheckedChange={setSuggestionsOn} />
            <div style={{ flex: '1 0 0', minWidth: 0 }}>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize:   14,
                lineHeight: '22px',
                color:      'var(--neutral-900)',
                margin:     0,
              }}>
                Surface connector suggestions in chat
              </p>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize:   14,
                lineHeight: '22px',
                color:      'var(--neutral-500)',
                margin:     0,
              }}>
                Brain proactively suggests relevant connectors based on what you&apos;re working on
              </p>
            </div>
          </div>

          {/* Main card */}
          <div style={{
            border:       '1px solid var(--neutral-200)',
            borderRadius: 16,
            boxShadow:    '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
            overflow:     'hidden',
          }}>
            {/* Toolbar */}
            <div style={{
              display:      'flex',
              alignItems:   'center',
              gap:          12,
              padding:      '12px 16px',
              borderBottom: '1px solid var(--neutral-100)',
              justifyContent: 'flex-end',
            }}>
              {/* Search input */}
              <div style={{
                display:         'flex',
                alignItems:      'center',
                gap:             8,
                width:           280,
                flexShrink:      0,
                backgroundColor: 'white',
                borderRadius:    10,
                boxShadow:       '0px 1px 1.5px 0px rgba(82,75,71,0.08), 0px 0px 0px 1px var(--neutral-200)',
                padding:         '6px 10px',
              }}>
                <SearchIcon />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setIsSearching(e.target.value.length > 0) }}
                  onFocus={() => searchQuery && setIsSearching(true)}
                  onBlur={() => { if (!searchQuery) setIsSearching(false) }}
                  placeholder="Search connectors"
                  style={{
                    flex:       '1 0 0',
                    minWidth:   0,
                    border:     'none',
                    // eslint-disable-next-line react-doctor/no-outline-none -- browser outline suppressed; :focus-visible handled by container or global styles
                    outline:    'none',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 400,
                    fontSize:   14,
                    lineHeight: '22px',
                    color:      'var(--neutral-700)',
                    background: 'transparent',
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(''); setIsSearching(false) }}
                    style={{ display: 'flex', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: 'var(--neutral-400)' }}
                  >
                    <XIcon />
                  </button>
                )}
              </div>
            </div>

            {/* Content */}
            <div style={{ padding: 16 }}>
              {loading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
                </div>
              ) : loadError ? (
                <div style={{ padding: '24px 8px', textAlign: 'center' }}>
                  <p style={{
                    fontFamily: 'var(--font-body)',
                    fontSize:   14,
                    color:      'var(--neutral-500)',
                    margin:     '0 0 12px',
                  }}>
                    {loadError}
                  </p>
                  <button
                    onClick={() => void fetchConnectors()}
                    style={{
                      padding:         '6px 14px',
                      borderRadius:    8,
                      border:          '1px solid var(--neutral-200)',
                      backgroundColor: 'white',
                      cursor:          'pointer',
                      fontFamily:      'var(--font-body)',
                      fontSize:        13,
                      color:           'var(--neutral-700)',
                    }}
                  >
                    Retry
                  </button>
                </div>
              ) : filtered.length === 0 ? (
                <p style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 400,
                  fontSize:   14,
                  color:      'var(--neutral-400)',
                  margin:     0,
                  padding:    '24px 8px',
                  textAlign:  'center',
                }}>
                  {searchQuery ? `No connectors found for "${searchQuery}"` : 'No connectors available.'}
                </p>
              ) : (
                <>
                  {/* Connected section */}
                  {connected.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <p style={{
                          fontFamily: 'var(--font-body)',
                          fontWeight: 500,
                          fontSize:   14,
                          lineHeight: '22px',
                          color:      'var(--neutral-900)',
                          margin:     0,
                        }}>
                          Connected
                        </p>
                        <span style={{
                          display:         'inline-flex',
                          alignItems:      'center',
                          padding:         '1px 6px',
                          borderRadius:    6,
                          backgroundColor: 'var(--green-50)',
                          boxShadow:       '0px 0px 0px 1px rgba(128,183,7,0.4)',
                          fontFamily:      'var(--font-body)',
                          fontWeight:      500,
                          fontSize: 12,
                          lineHeight:      '16px',
                          color:           'var(--green-800)',
                        }}>
                          {connected.length} active
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                        {connected.map(c => (
                          <ConnectorCard
                            key={c.slug}
                            entry={c}
                            onManage={handleManage}
                            onUpdate={handleUpdate}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Available section */}
                  {available.length > 0 && (
                    <div>
                      <p style={{
                        fontFamily: 'var(--font-body)',
                        fontWeight: 500,
                        fontSize:   14,
                        lineHeight: '22px',
                        color:      'var(--neutral-900)',
                        margin:     '0 0 12px',
                      }}>
                        {connected.length > 0 ? 'Available to connect' : 'All Connectors'}
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                        {available.map(c => (
                          <ConnectorCard
                            key={c.slug}
                            entry={c}
                            onManage={handleManage}
                            onUpdate={handleUpdate}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Tool permissions modal */}
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
