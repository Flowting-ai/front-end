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
 * `web_search` links → the favicon result rows the web-search activity
 * auto-expands. Links arrive either as bare URL strings or as
 * `{url, title, domain}` objects depending on the search provider.
 */
export function webSearchResults(links: unknown, limit = 6): ActivityResult[] {
  if (!Array.isArray(links)) return []

  return links.slice(0, limit).flatMap((link: unknown): ActivityResult[] => {
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
