import type { ActivityStatus, ActivityType } from '@/hooks/use-chat-state'

// The single place backend tool telemetry turns into the props `ActivityRow`
// renders. Transport agnostic on purpose: chat drives it from `useStreamingChat`'s
// XHR loop, Brain from its own stream consumer, and both hand the result to the
// same row — so an icon, verb or result list added here shows up on both surfaces.

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

/** Backend tool name → the row's icon and default verb. */
export function toolNameToType(toolName: string): ActivityType {
  const lower = toolName.toLowerCase()
  // `browser` drives a real page; it never produces search results, so it must
  // not borrow the web-search row — that row promises sources it cannot fill.
  if (lower === 'browser') return 'browser'
  if (lower === 'web_search' || lower.includes('search')) return 'web-search'
  if (lower === 'read_pages' || lower.includes('read_pdf')) return 'read-pages'
  if (lower === 'csv_execute' || lower.includes('csv')) return 'csv-execute'
  if (lower === 'fetch_resource' || lower.includes('fetch')) return 'fetch-resource'
  if (lower === 'doc_execute') return 'doc-execute'
  if (lower === 'docx_execute' || lower.includes('docx') || lower.includes('document')) return 'docx-progress'
  if (lower === 'skills') return 'skills'
  return 'tool-call'
}

export type ActivityResult = { title: string; url?: string; domain?: string }

/**
 * `web_search` → the favicon result rows the web-search activity auto-expands.
 *
 * A search event carries both: `links` are the bare URLs in rank order and
 * `results` the per-result metadata behind them. Prefer `results` — it is what
 * gives each row a real title instead of a truncated URL — and fall back to
 * `links` for searches persisted before that metadata was streamed.
 */
export function webSearchResults(links: unknown, results?: unknown, limit = 6): ActivityResult[] {
  const source = Array.isArray(results) && results.length > 0 ? results : links
  if (!Array.isArray(source)) return []

  return source.slice(0, limit).flatMap((link: unknown): ActivityResult[] => {
    if (typeof link === 'string') {
      try {
        const url = new URL(link)
        return [{ title: url.hostname + url.pathname.slice(0, 40), url: link, domain: url.hostname }]
      } catch {
        return [{ title: link, url: link, domain: '' }]
      }
    }
    if (typeof link === 'object' && link !== null) {
      const obj = link as Record<string, unknown>
      const url = asString(obj.url) ?? ''
      let domain = ''
      try { domain = new URL(url).hostname } catch { /* not a parseable URL — no favicon */ }
      return [{ title: asString(obj.title) ?? url, url, domain: asString(obj.domain) ?? domain }]
    }
    return []
  })
}

/**
 * Free-text backend status → the five states `ActivityRow` draws. Anything
 * unrecognised is treated as in-flight, so a new backend status word shows a
 * spinner rather than silently reading as finished.
 */
export function normalizeActivityStatus(raw: string | null | undefined): ActivityStatus {
  switch ((raw ?? '').toLowerCase()) {
    case 'done':
    case 'complete':
    case 'completed':
    case 'success':
      return 'done'
    case 'error':
    case 'failed':
    case 'failure':
      return 'error'
    case 'reading':
      return 'reading'
    case 'start':
    case 'started':
    case 'streaming':
      return 'start'
    default:
      return 'executing'
  }
}
