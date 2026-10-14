import { z } from 'zod'

/**
 * Pure pieces of the /template/<uuid> viewer: the backend response schema,
 * the metadata load, the status mapping for the HTML route and the display
 * helpers. Kept out of the page so they can be unit-tested in Node.
 */

/** Both template fetches give up after this long and report a timeout. */
export const TEMPLATE_FETCH_TIMEOUT_MS = 15_000

/** Mirrors services/templates/schemas.py TemplateResponse. */
export const templateSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  url: z.string(),
  byte_size: z.number(),
  created_at: z.string(),
  revoked: z.boolean(),
})

export type Template = z.infer<typeof templateSchema>

export type TemplateLoadState = 'forbidden' | 'not_found' | 'revoked' | 'timeout' | 'error'

export type TemplateLoadResult =
  | { state: 'ok'; template: Template }
  | { state: TemplateLoadState }

export function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
}

/** Maps a non-OK backend status to the viewer state it represents. */
export function stateForStatus(status: number): TemplateLoadState {
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not_found'
  if (status === 410) return 'revoked'
  if (status === 504) return 'timeout'
  return 'error'
}

/** Loads template metadata. Never throws: every failure becomes a state. */
export async function loadTemplate(
  base: string,
  uuid: string,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TemplateLoadResult> {
  let upstream: Response
  try {
    upstream = await fetchImpl(`${base}/templates/${uuid}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(TEMPLATE_FETCH_TIMEOUT_MS),
    })
  } catch (error) {
    return { state: isTimeoutError(error) ? 'timeout' : 'error' }
  }

  if (!upstream.ok) return { state: stateForStatus(upstream.status) }

  let body: unknown
  try {
    body = await upstream.json()
  } catch {
    return { state: 'error' }
  }
  const parsed = templateSchema.safeParse(body)
  if (!parsed.success) return { state: 'error' }
  return { state: 'ok', template: parsed.data }
}

/**
 * Fixed messages the HTML route returns instead of forwarding backend error
 * bodies to the browser.
 */
export const TEMPLATE_ROUTE_ERRORS: Record<TemplateLoadState, { status: number; message: string }> = {
  forbidden: { status: 403, message: "You don't have access to this template" },
  not_found: { status: 404, message: 'Template not found' },
  revoked: { status: 410, message: 'This template was revoked' },
  timeout: { status: 504, message: 'The template took too long to load' },
  error: { status: 502, message: 'Failed to load template' },
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

const MAX_CODE_POINT = 0x10ffff

/**
 * The stored title is the raw inner text of the document's own `<title>` —
 * the backend extracts it with a regex and does not unescape it, so a page
 * named "Revenue & funnel" arrives as "Revenue &amp; funnel". Decoding is
 * safe because React escapes whatever this returns on render. Out-of-range
 * code points are left as written (String.fromCodePoint would throw).
 */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, body: string) => {
    if (body.startsWith('#')) {
      const hex = body[1] === 'x' || body[1] === 'X'
      const code = hex ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10)
      if (!Number.isInteger(code) || code < 0 || code > MAX_CODE_POINT) return whole
      return String.fromCodePoint(code)
    }
    return ENTITIES[body.toLowerCase()] ?? whole
  })
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatBuilt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'at an unknown time'
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
