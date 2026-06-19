import { describe, expect, it } from 'vitest'
import { connectorCategory } from './connectorCategories'

describe('connectorCategory', () => {
  it('categorizes every connector seeded by the current catalog sync scripts', () => {
    const currentCatalogSlugs = [
      'gmail',
      'googlecalendar',
      'googledrive',
      'googlesheets',
      'googledocs',
      'clickup',
      'zoom',
      'slack',
      'fireflies',
      'shopify',
      'notion',
      'outlook',
      'googleads',
      'google_analytics',
      'salesforce',
      'metaads',
      'stripe',
      'linear',
      'jira',
      'asana',
      'linkedin',
      'whatsapp',
      'calendly',
      'airtable',
      'canva',
      'figma',
      'mixpanel',
      'vercel',
      'one_drive',
      'excel',
      'hubspot',
      'miro',
      'intercom',
      'box',
      'granola_mcp',
      'docusign',
      'semrush',
      'supabase',
      'monday',
      'customerio',
      'amplitude',
      'microsoft_teams',
      'microsoft_power_bi',
      'attio',
      'snowflake',
      'databricks',
      'fathom',
      'zendesk',
      'beehiiv',
      'triple-whale',
      'shipstation-v2',
      'zigpoll',
    ]

    expect(currentCatalogSlugs.filter(slug => connectorCategory(slug) === 'Other')).toEqual([])
  })

  it('normalizes case and keeps unknown future connectors in Other', () => {
    expect(connectorCategory(' FIGMA ')).toBe('Design')
    expect(connectorCategory('future-connector')).toBe('Other')
  })
})
