// Connector categories for grouping/filtering in the connector UIs.
//
// Frontend-only source of truth (the backend has no category field). When a new
// connector is added, map its slug here; anything unmapped falls under "Other"
// so the UI never breaks — it just lands in the catch-all bucket.

export const CONNECTOR_CATEGORIES = [
  'CRM & Sales',
  'Marketing & Ads',
  'Commerce & Payments',
  'Analytics & Data',
  'Project Management',
  'Documents & Files',
  'Communication',
  'Scheduling',
  'Meetings & Notes',
  'Design',
  'Developer',
] as const

export type ConnectorCategory = (typeof CONNECTOR_CATEGORIES)[number] | 'Other'

const SLUG_CATEGORY: Record<string, ConnectorCategory> = {
  // CRM & Sales
  hubspot: 'CRM & Sales',
  salesforce: 'CRM & Sales',
  attio: 'CRM & Sales',
  intercom: 'CRM & Sales',
  customerio: 'CRM & Sales',
  'modjo-ai': 'CRM & Sales',

  // Marketing & Ads
  googleads: 'Marketing & Ads',
  metaads: 'Marketing & Ads',
  linkedin: 'Marketing & Ads',
  beehiiv: 'Marketing & Ads',
  semrush: 'Marketing & Ads',
  zigpoll: 'Marketing & Ads',

  // Commerce & Payments
  shopify: 'Commerce & Payments',
  stripe: 'Commerce & Payments',
  klaviyo: 'Commerce & Payments',
  'shipstation-v2': 'Commerce & Payments',
  'triple-whale': 'Commerce & Payments',

  // Analytics & Data
  amplitude: 'Analytics & Data',
  mixpanel: 'Analytics & Data',
  google_analytics: 'Analytics & Data',
  microsoft_clarity: 'Analytics & Data',
  microsoft_power_bi: 'Analytics & Data',
  fathom: 'Analytics & Data',
  databricks: 'Analytics & Data',
  snowflake: 'Analytics & Data',

  // Project Management
  asana: 'Project Management',
  clickup: 'Project Management',
  jira: 'Project Management',
  linear: 'Project Management',
  monday: 'Project Management',
  notion: 'Project Management',
  microsoft_planner: 'Project Management',
  microsoft_todo: 'Project Management',

  // Documents & Files
  googledocs: 'Documents & Files',
  googlesheets: 'Documents & Files',
  googledrive: 'Documents & Files',
  box: 'Documents & Files',
  one_drive: 'Documents & Files',
  sharepoint: 'Documents & Files',
  onenote: 'Documents & Files',
  microsoft_word: 'Documents & Files',
  excel: 'Documents & Files',
  microsoft_powerpoint: 'Documents & Files',
  airtable: 'Documents & Files',
  supabase: 'Documents & Files',
  docusign: 'Documents & Files',

  // Communication
  slack: 'Communication',
  gmail: 'Communication',
  outlook: 'Communication',
  microsoft_teams: 'Communication',
  whatsapp: 'Communication',
  zoom: 'Communication',

  // Scheduling
  googlecalendar: 'Scheduling',
  calendly: 'Scheduling',
  microsoft_bookings: 'Scheduling',
  'booking-com': 'Scheduling',
  'booking-com-reservations': 'Scheduling',

  // Meetings & Notes
  fireflies: 'Meetings & Notes',
  granola_mcp: 'Meetings & Notes',

  // Design
  figma: 'Design',
  canva: 'Design',
  miro: 'Design',

  // Developer
  vercel: 'Developer',

  // Known provider aliases kept for catalog compatibility.
  bookingcom: 'Scheduling',
  booking_com_reservations: 'Scheduling',
  granola: 'Meetings & Notes',
  'granola-ai': 'Meetings & Notes',
  triplewhale: 'Commerce & Payments',
  microsoftbookings: 'Scheduling',
  'microsoft-bookings': 'Scheduling',
  microsoftclarity: 'Analytics & Data',
  'microsoft-clarity': 'Analytics & Data',
  powerbi: 'Analytics & Data',
  'power-bi': 'Analytics & Data',
  power_bi: 'Analytics & Data',
  microsoftteams: 'Communication',
  'microsoft-teams': 'Communication',
  teams: 'Communication',
  onedrive: 'Documents & Files',
  microsoftonedrive: 'Documents & Files',
  'microsoft-onedrive': 'Documents & Files',
  microsoft_onedrive: 'Documents & Files',
  monday_com: 'Project Management',
  'monday-com': 'Project Management',
  modjo: 'CRM & Sales',
  zendesk: 'CRM & Sales',
}

export function connectorCategory(slug: string): ConnectorCategory {
  return SLUG_CATEGORY[slug.trim().toLowerCase()] ?? 'Other'
}
