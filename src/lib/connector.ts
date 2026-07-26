import { z } from 'zod'
import { connectorLogoSrc, connectorDisplayName } from '@/lib/connectorLogos'

// One connector identity — resolved once via toConnector(), rendered anywhere.
// Never rebuild name/logo fallback chains at a call site: pass whatever raw
// shape you have (slug string, SSE context/prompt event, catalog entry,
// external-output action) and use the resulting object.

export const connectorSchema = z.object({
  slug:   z.string(),
  name:   z.string(),
  /** The backend's provider-hosted logo_url/icon_url when present, else a
   *  bundled brand asset as a fallback, else null — callers render a letter
   *  fallback. */
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
    // Prefer the backend-hosted image directly; only fall back to a bundled
    // local asset when the backend doesn't send one for this connector.
    logo:   (raw.logo_url || raw.icon_url || null) ?? connectorLogoSrc(slug) ?? connectorLogoSrc(name),
    status: statusSchema.parse(raw.status || 'connected'),
  })
}
