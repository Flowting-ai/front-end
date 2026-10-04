import { getConnector, listConnectors, type ConnectorCatalog } from '@/lib/api/connectors'

/**
 * Data behind the new-chat "Connect an app" menu.
 *
 * The menu used to crawl the WHOLE connector catalogue on every mount (100 apps per request, one
 * request after another: ~20 requests, ~30 s) just to show six apps. It now loads only what it
 * displays, in parallel, and keeps it:
 *   • FEATURED apps are fetched by slug, all at once (also gives their linked state, so connected
 *     apps show a tick).
 *   • Typed searches go to the backend (`q`), 8 results, debounced by the caller.
 *   • Everything is cached in memory and served immediately; a copy older than STALE_MS refreshes
 *     in the background (stale-while-revalidate). `warmConnectApps` runs from the app shell so the
 *     first open is usually instant.
 */

export const FEATURED_APPS = ['gmail', 'outlook', 'googlecalendar', 'slack', 'notion', 'googledrive']
const STALE_MS = 5 * 60 * 1000
const SEARCH_LIMIT = 8

let featured: { at: number; rows: ConnectorCatalog[] } | null = null
let featuredInFlight: Promise<ConnectorCatalog[]> | null = null
const searches = new Map<string, { at: number; rows: ConnectorCatalog[] }>()
const searchInFlight = new Map<string, Promise<ConnectorCatalog[]>>()

export function cachedFeaturedApps(): ConnectorCatalog[] | null {
  return featured?.rows ?? null
}

export function featuredIsStale(): boolean {
  return !featured || Date.now() - featured.at > STALE_MS
}

/** Fetch the featured apps (deduplicated). A slug that fails to load is skipped, not fatal. */
export function loadFeaturedApps(): Promise<ConnectorCatalog[]> {
  if (featuredInFlight) return featuredInFlight
  featuredInFlight = Promise.allSettled(FEATURED_APPS.map(slug => getConnector(slug)))
    .then(results => {
      const rows = results.flatMap(r => (r.status === 'fulfilled' ? [r.value] : []))
      // Keep what we had if everything failed (offline blip) rather than blanking the menu.
      if (rows.length > 0 || !featured) featured = { at: Date.now(), rows }
      return featured.rows
    })
    .finally(() => { featuredInFlight = null })
  return featuredInFlight
}

/** Warm the featured list if it is missing or stale. Safe to call repeatedly. */
export function warmConnectApps(): void {
  if (featuredIsStale()) void loadFeaturedApps()
}

/** Drop cached results (after connecting an app) so the next read reflects the new linked state. */
export function invalidateConnectApps(): void {
  if (featured) featured = { ...featured, at: 0 }
  searches.clear()
}

export function cachedSearch(query: string): ConnectorCatalog[] | null {
  return searches.get(query.trim().toLowerCase())?.rows ?? null
}

export function searchApps(query: string): Promise<ConnectorCatalog[]> {
  const key = query.trim().toLowerCase()
  const hit = searches.get(key)
  if (hit && Date.now() - hit.at <= STALE_MS) return Promise.resolve(hit.rows)
  const pending = searchInFlight.get(key)
  if (pending) return pending
  const request = listConnectors({ q: key, limit: SEARCH_LIMIT })
    .then(page => {
      searches.set(key, { at: Date.now(), rows: page.connectors })
      return page.connectors
    })
    .finally(() => { searchInFlight.delete(key) })
  searchInFlight.set(key, request)
  return request
}
