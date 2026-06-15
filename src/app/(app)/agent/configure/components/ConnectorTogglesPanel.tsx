'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { listConnectors } from '@/lib/api/connectors'
import { getVersion, setVersionBlockedConnectors, unblockVersionConnector } from '@/lib/api/personas'
import type { ConnectorCatalogEntry } from '@/lib/api/connectors'

const CONNECTOR_LOGO_MAP: Record<string, string> = {
  gmail:            '/connector-logos/gmail.svg',
  googlecalendar:   '/connector-logos/google-calendar.svg',
  googledrive:      '/connector-logos/google-drive.svg',
  googledocs:       '/connector-logos/google-docs.svg',
  googlesheets:     '/connector-logos/google-sheets.svg',
  googleads:        '/connector-logos/google-ads.svg',
  slack:            '/connector-logos/slack.svg',
  notion:           '/connector-logos/notion.svg',
  hubspot:          '/connector-logos/hubspot.svg',
  clickup:          '/connector-logos/clickup.svg',
  jira:             '/connector-logos/jira.svg',
  linear:           '/connector-logos/linear.svg',
  asana:            '/connector-logos/asana.svg',
  zoom:             '/connector-logos/zoom.svg',
  salesforce:       '/connector-logos/salesforce.svg',
  stripe:           '/connector-logos/stripe.svg',
  outlook:          '/connector-logos/outlook.svg',
  shopify:          '/connector-logos/shopify.svg',
  airtable:         '/connector-logos/airtable.svg',
  linkedin:         '/connector-logos/linkedin.svg',
  calendly:         '/connector-logos/calendly.svg',
  fireflies:        '/connector-logos/fireflies.svg',
  metaads:          '/connector-logos/meta.svg',
  beehiiv:          '/connector-logos/beehiiv.svg',
  bookingcom:       '/connector-logos/booking-com.svg',
  canva:            '/connector-logos/canva.svg',
  customerio:       '/connector-logos/customer-io.svg',
  databricks:       '/connector-logos/databricks.svg',
  figma:            '/connector-logos/figma.svg',
  intercom:         '/connector-logos/intercom.svg',
  miro:             '/connector-logos/miro.svg',
  mixpanel:         '/connector-logos/mixpanel.svg',
  supabase:         '/connector-logos/supabase.svg',
  triplewhale:      '/connector-logos/triple_whale.svg',
  vercel:           '/connector-logos/vercel.svg',
  whatsapp:         '/connector-logos/whatsapp.svg',
  amplitude:           '/connector-logos/amplitude.svg',
  attio:               '/connector-logos/attio.svg',
  box:                 '/connector-logos/box.svg',
  fathom:              '/connector-logos/fathom.svg',
  granola:                     '/connector-logos/granola.svg',
  'granola-ai':                '/connector-logos/granola.svg',
  microsoftbookings:           '/connector-logos/microsoft-bookings.svg',
  'microsoft-bookings':        '/connector-logos/microsoft-bookings.svg',
  microsoft_bookings:          '/connector-logos/microsoft-bookings.svg',
  bookings:                    '/connector-logos/microsoft-bookings.svg',
  microsoftclarity:            '/connector-logos/microsoft-clarity.png',
  'microsoft-clarity':         '/connector-logos/microsoft-clarity.png',
  microsoft_clarity:           '/connector-logos/microsoft-clarity.png',
  clarity:                     '/connector-logos/microsoft-clarity.png',
  microsoftexcel:              '/connector-logos/microsoft-excel.svg',
  'microsoft-excel':           '/connector-logos/microsoft-excel.svg',
  microsoft_excel:             '/connector-logos/microsoft-excel.svg',
  excel:                       '/connector-logos/microsoft-excel.svg',
  microsoftonedrive:           '/connector-logos/microsoft-onedrive.svg',
  'microsoft-onedrive':        '/connector-logos/microsoft-onedrive.svg',
  microsoft_onedrive:          '/connector-logos/microsoft-onedrive.svg',
  onedrive:                    '/connector-logos/microsoft-onedrive.svg',
  microsoftonenote:            '/connector-logos/microsoft-onenote.svg',
  'microsoft-onenote':         '/connector-logos/microsoft-onenote.svg',
  microsoft_onenote:           '/connector-logos/microsoft-onenote.svg',
  onenote:                     '/connector-logos/microsoft-onenote.svg',
  microsoftplanner:            '/connector-logos/microsoft-planner.svg',
  'microsoft-planner':         '/connector-logos/microsoft-planner.svg',
  microsoft_planner:           '/connector-logos/microsoft-planner.svg',
  planner:                     '/connector-logos/microsoft-planner.svg',
  microsoftpowerpoint:         '/connector-logos/microsoft-powerpoint.svg',
  'microsoft-powerpoint':      '/connector-logos/microsoft-powerpoint.svg',
  microsoft_powerpoint:        '/connector-logos/microsoft-powerpoint.svg',
  powerpoint:                  '/connector-logos/microsoft-powerpoint.svg',
  microsoftsharepoint:         '/connector-logos/microsoft-sharepoint.svg',
  'microsoft-sharepoint':      '/connector-logos/microsoft-sharepoint.svg',
  microsoft_sharepoint:        '/connector-logos/microsoft-sharepoint.svg',
  sharepoint:                  '/connector-logos/microsoft-sharepoint.svg',
  microsoftteams:              '/connector-logos/microsoft-teams.svg',
  'microsoft-teams':           '/connector-logos/microsoft-teams.svg',
  microsoft_teams:             '/connector-logos/microsoft-teams.svg',
  teams:                       '/connector-logos/microsoft-teams.svg',
  microsofttodo:               '/connector-logos/microsoft-to-do.svg',
  'microsoft-to-do':           '/connector-logos/microsoft-to-do.svg',
  'microsoft-todo':            '/connector-logos/microsoft-to-do.svg',
  microsoft_to_do:             '/connector-logos/microsoft-to-do.svg',
  microsoft_todo:              '/connector-logos/microsoft-to-do.svg',
  todo:                        '/connector-logos/microsoft-to-do.svg',
  microsoftword:               '/connector-logos/microsoft-word.svg',
  'microsoft-word':            '/connector-logos/microsoft-word.svg',
  microsoft_word:              '/connector-logos/microsoft-word.svg',
  word:                        '/connector-logos/microsoft-word.svg',
  modjo:                       '/connector-logos/modjo-ai.jpeg',
  'modjo-ai':                  '/connector-logos/modjo-ai.jpeg',
  monday:                      '/connector-logos/monday.svg',
  'monday-com':                '/connector-logos/monday.svg',
  monday_com:                  '/connector-logos/monday.svg',
  powerbi:                     '/connector-logos/power-bi.svg',
  'power-bi':                  '/connector-logos/power-bi.svg',
  power_bi:                    '/connector-logos/power-bi.svg',
  semrush:                     '/connector-logos/semrush.jpeg',
  zigpoll:                     '/connector-logos/zigpoll.jpeg',
  'slack-bot':                 '/connector-logos/slack.svg',
  slackbot:                    '/connector-logos/slack.svg',
  slack_bot:                   '/connector-logos/slack.svg',
  'booking-com-reservations':  '/connector-logos/booking-com.svg',
  bookingcomreservations:      '/connector-logos/booking-com.svg',
  booking_com_reservations:    '/connector-logos/booking-com.svg',
}

function ConnectorChip({
  entry,
  enabled,
  saving,
  onToggle,
}: {
  entry:    ConnectorCatalogEntry
  enabled:  boolean
  saving:   boolean
  onToggle: () => void
}) {
  const logo = CONNECTOR_LOGO_MAP[entry.slug]

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={saving}
      title={`${enabled ? 'Disable' : 'Enable'} ${entry.display_name} in this persona`}
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        gap:             5,
        padding:         '4px 8px 4px 5px',
        borderRadius:    8,
        border:          '1px solid',
        borderColor:     enabled ? 'var(--neutral-400)' : 'var(--neutral-200)',
        backgroundColor: enabled ? 'var(--neutral-100)' : 'transparent',
        cursor:          saving ? 'not-allowed' : 'pointer',
        opacity:         saving ? 0.55 : 1,
        transition:      'border-color 120ms, background-color 120ms, opacity 120ms',
        flexShrink:      0,
      }}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element, react-doctor/nextjs-no-img-element -- local brand asset
        <img src={logo} alt="" width={14} height={14} style={{ objectFit: 'contain', flexShrink: 0 }} />
      ) : (
        <span style={{
          width: 14, height: 14, borderRadius: 3, flexShrink: 0,
          backgroundColor: `hsl(${[...entry.slug].reduce((a, c) => a + c.charCodeAt(0), 0) % 360} 60% 85%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 700, color: `hsl(${[...entry.slug].reduce((a, c) => a + c.charCodeAt(0), 0) % 360} 60% 35%)`,
        }}>
          {entry.display_name.charAt(0).toUpperCase()}
        </span>
      )}
      <span style={{
        fontFamily: 'var(--font-body)',
        fontWeight: 500,
        fontSize:   12,
        lineHeight: '16px',
        color:      enabled ? 'var(--neutral-800)' : 'var(--neutral-400)',
        whiteSpace: 'nowrap',
      }}>
        {entry.display_name}
      </span>
    </button>
  )
}

/**
 * Compact connector toggle row for the test-chat panel.
 * Shows only linked connectors. Clicking a chip enables/disables that
 * connector for this persona version and calls `onConnectorsChange` with
 * the new active slug list so the parent can update its stream options.
 */
export function ConnectorTogglesPanel({
  repoId,
  versionId,
  onConnectorsChange,
}: {
  repoId:               string
  versionId:            string
  onConnectorsChange?:  (slugs: string[]) => void
}) {
  const [linked,       setLinked]       = useState<ConnectorCatalogEntry[]>([])
  const [enabled,      setEnabled]      = useState<Set<string>>(new Set())
  const [savingSlug,   setSavingSlug]   = useState<string | null>(null)
  const [loaded,       setLoaded]       = useState(false)

  useEffect(() => {
    if (!repoId || !versionId) return
    let cancelled = false
    Promise.all([
      listConnectors(),
      getVersion(repoId, versionId),
    ]).then(([catalog, version]) => {
      if (cancelled) return
      const linkedConnectors = catalog.filter(c => c.linked)
      setLinked(linkedConnectors)
      const blockedSet = new Set<string>(version.blocked_connectors ?? [])
      const initial = new Set<string>(linkedConnectors.filter(c => !blockedSet.has(c.slug)).map(c => c.slug))
      setEnabled(initial)
      onConnectorsChange?.([...initial])
      setLoaded(true)
    }).catch(() => {})
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally runs once per repoId+versionId pair
  }, [repoId, versionId])

  const handleToggle = useCallback(async (slug: string) => {
    if (savingSlug) return
    setSavingSlug(slug)
    const prev = new Set(enabled)
    const next = new Set(enabled)
    if (next.has(slug)) { next.delete(slug) } else { next.add(slug) }
    setEnabled(next)
    onConnectorsChange?.([...next])
    try {
      if (next.has(slug)) {
        // Enabling: remove from block-list
        await unblockVersionConnector(repoId, versionId, slug)
      } else {
        // Disabling: add to block-list (send full blocked set)
        const linked_ = linked.map(c => c.slug)
        const blocked = linked_.filter(s => !next.has(s))
        await setVersionBlockedConnectors(repoId, versionId, blocked)
      }
      setEnabled(next)
      onConnectorsChange?.([...next])
    } catch (err) {
      setEnabled(prev)
      onConnectorsChange?.([...prev])
      toast.error(err instanceof Error ? err.message : 'Failed to update connector')
    } finally {
      setSavingSlug(null)
    }
  }, [repoId, versionId, enabled, savingSlug, onConnectorsChange])

  if (!loaded || linked.length === 0) return null

  return (
    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4, padding: '0 4px' }}>
      <span style={{
        fontFamily: 'var(--font-body)',
        fontWeight: 500,
        fontSize:   11,
        lineHeight: '16px',
        color:      'var(--neutral-400)',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}>
        Connectors
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {linked.map(c => (
          <ConnectorChip
            key={c.slug}
            entry={c}
            enabled={enabled.has(c.slug)}
            saving={savingSlug === c.slug}
            onToggle={() => void handleToggle(c.slug)}
          />
        ))}
      </div>
    </div>
  )
}
