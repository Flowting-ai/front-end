import { z } from 'zod'
import { connectorDisplayName } from '@/lib/connectorNames'

// One connector identity — resolved once via toConnector(), rendered anywhere.
// Never rebuild name/logo fallback chains at a call site: pass whatever raw
// shape you have (slug string, SSE context/prompt event, catalog entry,
// external-output action) and use the resulting object.

export const connectorSchema = z.object({
  slug:   z.string(),
  name:   z.string(),
  /** The backend's provider-hosted logo_url/icon_url, or null when the
   *  catalog entry carries none — callers render a letter fallback. There is
   *  no bundled-asset fallback: the backend is the only source of logos. */
  logo:   z.string().nullable(),
  status: z.enum(['connected', 'disconnected', 'failed', 'pending']),
})

export type Connector = z.infer<typeof connectorSchema>

// Union of every wire shape the app receives a connector in: `slug` /
// `connector_slug`, `display_name` / `name` / `connector`, `logo_url` /
// `icon_url`. Loose so typed payloads pass through with their extra fields.
const rawConnectorSchema = z.looseObject({
  slug:           z.string().nullish(),
  connector_slug: z.string().nullish(),
  display_name:   z.string().nullish(),
  name:           z.string().nullish(),
  connector:      z.string().nullish(),
  logo_url:       z.string().nullish(),
  icon_url:       z.string().nullish(),
  status:         z.string().nullish(),
})

const statusSchema = connectorSchema.shape.status.catch('connected')

export function toConnector(input: string | object): Connector {
  const raw  = rawConnectorSchema.parse(typeof input === 'string' ? { slug: input } : input)
  // || not ??: wire payloads use empty strings for "absent" as often as null.
  const slug = raw.slug || raw.connector_slug || ''
  const name = raw.display_name || raw.name || raw.connector || connectorDisplayName(slug)
  return connectorSchema.parse({
    slug,
    name,
    logo:   raw.logo_url || raw.icon_url || null,
    status: statusSchema.parse(raw.status || 'connected'),
  })
}
