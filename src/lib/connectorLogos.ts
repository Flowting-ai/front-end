// Local brand-logo assets for connectors, keyed by slug. The backend does NOT
// return logo URLs (`/connectors` leaves `icon_url` null), so the FE bundles
// these under /public/connector-logos/ and resolves them by slug. Keep the
// slug variants (dash / underscore / concatenated) in sync with the backend's
// connector slugs.
export const CONNECTOR_LOGO_MAP: Record<string, string> = {
  'airtable':          '/connector-logos/airtable.svg',
  'asana':             '/connector-logos/asana.svg',
  'calendly':          '/connector-logos/calendly.svg',
  'clickup':           '/connector-logos/clickup.svg',
  'click-up':          '/connector-logos/clickup.svg',
  'fireflies':         '/connector-logos/fireflies.svg',
  'fireflies-ai':      '/connector-logos/fireflies.svg',
  'gmail':             '/connector-logos/gmail.svg',
  'googleads':         '/connector-logos/google-ads.svg',
  'google-ads':        '/connector-logos/google-ads.svg',
  'google_ads':        '/connector-logos/google-ads.svg',
  'googlecalendar':    '/connector-logos/google-calendar.svg',
  'google-calendar':   '/connector-logos/google-calendar.svg',
  'google_calendar':   '/connector-logos/google-calendar.svg',
  'googledocs':        '/connector-logos/google-docs.svg',
  'google-docs':       '/connector-logos/google-docs.svg',
  'google_docs':       '/connector-logos/google-docs.svg',
  'googledrive':       '/connector-logos/google-drive.svg',
  'google-drive':      '/connector-logos/google-drive.svg',
  'google_drive':      '/connector-logos/google-drive.svg',
  'googlesheets':      '/connector-logos/google-sheets.svg',
  'google-sheets':     '/connector-logos/google-sheets.svg',
  'google_sheets':     '/connector-logos/google-sheets.svg',
  'hubspot':           '/connector-logos/hubspot.svg',
  'jira':              '/connector-logos/jira.svg',
  'linear':            '/connector-logos/linear.svg',
  'linkedin':          '/connector-logos/linkedin.svg',
  'meta':              '/connector-logos/meta.svg',
  'meta-ads':          '/connector-logos/meta.svg',
  'meta_ads':          '/connector-logos/meta.svg',
  'metaads':           '/connector-logos/meta.svg',
  'facebook':          '/connector-logos/meta.svg',
  'facebook-ads':      '/connector-logos/meta.svg',
  'facebook_ads':      '/connector-logos/meta.svg',
  'facebookads':       '/connector-logos/meta.svg',
  'notion':            '/connector-logos/notion.svg',
  'outlook':           '/connector-logos/outlook.svg',
  'microsoft-outlook': '/connector-logos/outlook.svg',
  'salesforce':        '/connector-logos/salesforce.svg',
  'shipengine':        '/connector-logos/shipengine.jpeg',
  'ship-engine':       '/connector-logos/shipengine.jpeg',
  'shopify':           '/connector-logos/shopify.svg',
  'slack':             '/connector-logos/slack.svg',
  'stripe':            '/connector-logos/stripe.svg',
  'zoom':              '/connector-logos/zoom.svg',
}

/**
 * Resolve a connector's bundled logo from its slug or display name. Tries the
 * raw value first, then a normalized slug (lowercase, spaces→dashes, stripped
 * of punctuation) so both "hubspot" and "HubSpot" resolve. Returns null when
 * no asset is bundled for that connector — callers should render a fallback.
 */
export function connectorLogoSrc(slugOrName: string | null | undefined): string | null {
  if (!slugOrName) return null
  const raw = slugOrName.toLowerCase()
  if (CONNECTOR_LOGO_MAP[raw]) return CONNECTOR_LOGO_MAP[raw]
  const norm = raw.replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '')
  return CONNECTOR_LOGO_MAP[norm] ?? null
}

// Canonical display names for connector slugs. Used when reconstructing
// connector context from historical tool_calls (which only carry slugs).
// Live `context` SSE events already include `display_name`; this only fills
// the gap when no name is available. Heuristic fallback (title-cased slug)
// covers everything else.
const CONNECTOR_DISPLAY_NAME: Record<string, string> = {
  'airtable':         'Airtable',
  'asana':            'Asana',
  'calendly':         'Calendly',
  'clickup':          'ClickUp',
  'fireflies':        'Fireflies',
  'gmail':            'Gmail',
  'googleads':        'Google Ads',
  'googlecalendar':   'Google Calendar',
  'googledocs':       'Google Docs',
  'googledrive':      'Google Drive',
  'googlesheets':     'Google Sheets',
  'hubspot':          'HubSpot',
  'jira':             'Jira',
  'linear':           'Linear',
  'linkedin':         'LinkedIn',
  'meta':             'Meta',
  'facebook':         'Facebook',
  'notion':           'Notion',
  'outlook':          'Outlook',
  'salesforce':       'Salesforce',
  'shipengine':       'ShipEngine',
  'shopify':          'Shopify',
  'slack':            'Slack',
  'stripe':           'Stripe',
  'zoom':             'Zoom',
}

export function connectorDisplayName(slug: string | null | undefined): string {
  if (!slug) return ''
  const s = slug.toLowerCase()
  return CONNECTOR_DISPLAY_NAME[s]
    ?? slug.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
