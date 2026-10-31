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

export type TemplateLoadState = 'forbidden' | 'not_found' | 'revoked' | 'timeout' | 'too_large' | 'error'

/** Largest HTML document the route will serve (model-written pages are far smaller). */
export const TEMPLATE_MAX_BYTES = 10 * 1024 * 1024

/** Declared size is over the cap (a missing or bad header passes; the stream cap still applies). */
export function declaredTooLarge(contentLength: string | null, max = TEMPLATE_MAX_BYTES): boolean {
  const n = Number(contentLength)
  return contentLength !== null && Number.isFinite(n) && n > max
}

/** Pass bytes through until `max`, then fail the stream (the frame shows a broken load, not a partial page that looks complete). */
export function capStream(body: ReadableStream<Uint8Array>, max = TEMPLATE_MAX_BYTES, onExceeded: () => void = () => {}): ReadableStream<Uint8Array> {
  let seen = 0
  return body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      seen += chunk.byteLength
      if (seen > max) {
        onExceeded()
        controller.error(new Error('Template exceeds the size cap'))
        return
      }
      controller.enqueue(chunk)
    },
  }))
}

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
/** What the viewer is told when a template can't be shown (the page, and the frame when only the HTML fails). */
export const TEMPLATE_NOTICES: Record<Exclude<TemplateLoadState, 'not_found'>, { heading: string; body: string; tone: 'status' | 'alert' }> = {
  forbidden: {
    heading: "You don't have access",
    body: 'This page belongs to someone in another organization. Ask whoever sent the link to share it from your workspace.',
    tone: 'status',
  },
  revoked: {
    heading: 'This page was revoked',
    body: 'Its creator took it down. Ask them for a fresh one.',
    tone: 'status',
  },
  too_large: {
    heading: 'This page is too large to show',
    body: 'Ask whoever made it for a smaller version.',
    tone: 'alert',
  },
  timeout: {
    heading: 'This is taking too long',
    body: "The template didn't load in time. Try again in a moment.",
    tone: 'alert',
  },
  error: {
    heading: 'Something went wrong',
    body: "The template couldn't be loaded. Try again in a moment.",
    tone: 'alert',
  },
}

/**
 * The notice as a standalone HTML page, for the template's `<iframe>`: it navigates to the HTML
 * route itself, so a JSON error would be shown to the viewer as raw text. Fixed strings only.
 * `theme` is the app's (the frame's own prefers-color-scheme follows the OS, not the app); the
 * colours are the app's --neutral-white / -900 / -500 for that theme.
 */
export function templateNoticeHtml(state: TemplateLoadState, theme: 'light' | 'dark' = 'light'): string {
  const notice = state === 'not_found'
    ? { heading: 'Link not found', body: "This template doesn't exist, or the address is wrong.", tone: 'status' as const }
    : TEMPLATE_NOTICES[state]
  const colors = theme === 'dark'
    ? 'color-scheme:dark;--bg:#1C1C1C;--fg:#DEDEDE;--muted:#989898'
    : 'color-scheme:light;--bg:#F9F8F5;--fg:#26211E;--muted:#756D67'
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root{${colors}}
html,body{height:100%;margin:0}
body{display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;background:var(--bg);color:var(--fg);font:14px/20px system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center}
h1{margin:0 0 6px;font-size:18px;line-height:26px;font-weight:500}
p{margin:0;color:var(--muted);max-width:420px}
</style></head><body><div role="${notice.tone}"><h1>${notice.heading}</h1><p>${notice.body}</p></div></body></html>`
}

export const TEMPLATE_ROUTE_ERRORS: Record<TemplateLoadState, { status: number; message: string }> = {
  forbidden: { status: 403, message: "You don't have access to this template" },
  not_found: { status: 404, message: 'Template not found' },
  revoked: { status: 410, message: 'This template was revoked' },
  timeout: { status: 504, message: 'The template took too long to load' },
  too_large: { status: 502, message: 'This template is too large to show' },
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
