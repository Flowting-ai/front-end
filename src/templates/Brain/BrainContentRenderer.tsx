'use client'

import React from 'react'
import { ContentRenderer } from '@/lib/content-renderer'

// ── Connector result detection ─────────────────────────────────────────────────
// When the Brain model outputs a raw connector result JSON blob as content,
// detect it and render a clean summary card instead of the raw JSON.

interface ConnectorResultJson {
  _saved_to_file?: string
  _note?: string
  _schema?: unknown
  preview?: string
}

interface PreviewMeta {
  connector?: string
  tool?: string
  arguments?: Record<string, unknown>
  fetched_at?: string
}

interface PreviewResult {
  exports?: Record<string, unknown>
}

function tryParseConnectorResult(content: string): ConnectorResultJson | null {
  const trimmed = content.trim()
  if (!trimmed.startsWith('{')) return null
  // Fast path: only attempt full parse if the key sentinel is present
  if (!trimmed.includes('"_saved_to_file"') && !trimmed.includes('"_note"')) return null
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>
    if (typeof parsed !== 'object' || !parsed) return null
    if (!('_saved_to_file' in parsed) && !('_note' in parsed)) return null
    return parsed as ConnectorResultJson
  } catch {
    return null
  }
}

function isPartialConnectorResult(content: string): boolean {
  const trimmed = content.trim()
  return (
    trimmed.startsWith('{"_saved_to_file"') ||
    trimmed.startsWith('{ "_saved_to_file"') ||
    trimmed.startsWith('{"_note"')
  )
}

// ── Display helpers ────────────────────────────────────────────────────────────

const CONNECTOR_NAMES: Record<string, string> = {
  gmail:           'Gmail',
  googlecalendar:  'Google Calendar',
  googledrive:     'Google Drive',
  googledocs:      'Google Docs',
  googlesheets:    'Google Sheets',
  googleanalytics: 'Google Analytics',
  googlemeet:      'Google Meet',
  googleslides:    'Google Slides',
  googleads:       'Google Ads',
  slack:           'Slack',
  notion:          'Notion',
  hubspot:         'HubSpot',
  salesforce:      'Salesforce',
  linear:          'Linear',
  jira:            'Jira',
  asana:           'Asana',
  clickup:         'ClickUp',
  airtable:        'Airtable',
  shopify:         'Shopify',
  stripe:          'Stripe',
  zoom:            'Zoom',
  calendly:        'Calendly',
  notion2:         'Notion',
  intercom:        'Intercom',
  customerio:      'Customer.io',
  mixpanel:        'Mixpanel',
  amplitude:       'Amplitude',
  figma:           'Figma',
  miro:            'Miro',
  canva:           'Canva',
  vercel:          'Vercel',
  supabase:        'Supabase',
  databricks:      'Databricks',
  outlook:         'Outlook',
  teams:           'Microsoft Teams',
  onedrive:        'OneDrive',
  sharepoint:      'SharePoint',
  excel:           'Excel',
  word:            'Word',
  onenote:         'OneNote',
  quickbooks:      'QuickBooks',
  zohobooks:       'Zoho Books',
  twilio:          'Twilio',
  richpanel:       'Richpanel',
  shipstation:     'ShipStation',
  monday:          'Monday.com',
}

function connectorDisplayName(slug: string): string {
  return CONNECTOR_NAMES[slug.toLowerCase()] ?? slug
}

function toolDisplayLabel(toolSlug: string, connectorSlug: string): string {
  const lower = toolSlug.toLowerCase()
  const prefix = connectorSlug.toLowerCase() + '-'
  const withoutPrefix = lower.startsWith(prefix) ? lower.slice(prefix.length) : lower
  return withoutPrefix
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// ── Connector result card ──────────────────────────────────────────────────────

function ConnectorResultCard({ data }: { data: ConnectorResultJson }) {
  let meta: PreviewMeta | null = null
  let result: PreviewResult | null = null
  if (data.preview) {
    try {
      const preview = JSON.parse(data.preview) as Record<string, unknown>
      meta   = (preview._meta   as PreviewMeta)   ?? null
      result = (preview.result  as PreviewResult)  ?? null
    } catch { /* incomplete JSON during streaming — already handled above */ }
  }

  const connectorSlug  = meta?.connector ?? ''
  const connectorName  = connectorSlug ? connectorDisplayName(connectorSlug) : ''
  const toolSlug       = meta?.tool ?? ''
  const actionLabel    = toolSlug ? toolDisplayLabel(toolSlug, connectorSlug) : 'Action completed'
  const summary        = typeof result?.exports?.['$summary'] === 'string'
    ? result.exports['$summary'] as string
    : null
  const heading        = [connectorName, actionLabel].filter(Boolean).join(' · ')

  return (
    <div
      style={{
        display:         'flex',
        alignItems:      'flex-start',
        gap:             10,
        padding:         '10px 14px',
        borderRadius:    10,
        border:          '1px solid var(--neutral-200)',
        backgroundColor: 'var(--neutral-50)',
        margin:          '4px 0',
      }}
    >
      {/* Success icon */}
      <div style={{ flexShrink: 0, marginTop: 2, color: 'var(--green-500, #22c55e)' }}>
        <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle cx={8} cy={8} r={7.5} stroke="currentColor" strokeOpacity={0.35} />
          <path
            d="M4.75 8.25 7 10.5l4.25-5"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontFamily:  'var(--font-body)',
          fontSize:    'var(--font-size-body)',
          fontWeight:  'var(--font-weight-medium)',
          color:       'var(--neutral-800)',
          margin:      0,
          lineHeight:  'var(--line-height-body)',
        }}>
          {heading || 'Action completed'}
        </p>
        {summary && (
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-caption)',
            color:      'var(--neutral-500)',
            margin:     '2px 0 0',
            lineHeight: 'var(--line-height-caption)',
          }}>
            {summary}
          </p>
        )}
      </div>
    </div>
  )
}

// ── BrainContentRenderer ───────────────────────────────────────────────────────

export interface BrainContentRendererProps {
  content: string
}

export function BrainContentRenderer({ content }: BrainContentRendererProps) {
  const trimmed = content.trim()

  // Fully-parsed connector result → clean card
  const parsed = tryParseConnectorResult(trimmed)
  if (parsed) {
    return <ConnectorResultCard data={parsed} />
  }

  // Partially-streamed connector result (JSON not yet complete) → placeholder
  if (isPartialConnectorResult(trimmed)) {
    return (
      <div style={{
        display:         'flex',
        alignItems:      'center',
        gap:             8,
        padding:         '10px 14px',
        borderRadius:    10,
        border:          '1px dashed var(--neutral-200)',
        backgroundColor: 'var(--neutral-50)',
        margin:          '4px 0',
        fontFamily:      'var(--font-body)',
        fontSize:        'var(--font-size-caption)',
        color:           'var(--neutral-400)',
      }}>
        <svg width={12} height={12} viewBox="0 0 12 12" fill="none" aria-hidden>
          <circle cx={6} cy={6} r={5} stroke="currentColor" strokeOpacity={0.4} />
          <circle cx={6} cy={6} r={2} fill="currentColor" opacity={0.5} />
        </svg>
        Processing result…
      </div>
    )
  }

  return <ContentRenderer content={content} />
}
