import { queryOptions } from '@tanstack/react-query'
import {
  getConnector,
  listConnectorCategories,
  listConnectors,
  listLinkedConnectors,
  type ConnectorCatalog,
  type ConnectorListQuery,
} from '@/lib/api/connectors'
import { queryKeys } from '@/lib/query-keys'
import { STALE_STATIC_MS } from '@/lib/query-policy'

/**
 * React Query for connectors. Replaces the module caches that used to live in
 * ConnectionsView (`pageCache`), lib/connect-apps-cache.ts and the catalogue
 * map. Every connector mutation in lib/api/connectors.ts ends with
 * `bustConnectorCatalogCache()`, which invalidates all of these at once.
 */

/** Apps the new-chat "Connect an app" menu shows before anything is typed. */
export const FEATURED_APPS = ['gmail', 'outlook', 'googlecalendar', 'slack', 'notion', 'googledrive']
const MENU_SEARCH_LIMIT = 8
/** The catalogue changes rarely; linked state changes go through invalidation. */
const CATALOG_STALE_MS = STALE_STATIC_MS

/** One page of the catalogue (browse, discover, search). */
export const connectorsPageQuery = (query: ConnectorListQuery) =>
  queryOptions({
    queryKey: queryKeys.connectors.page(query),
    queryFn: () => listConnectors(query),
    staleTime: CATALOG_STALE_MS,
  })

/** Everything the viewer has linked (all pages). Refetches on focus, which picks up a connect done in another tab. */
export const linkedConnectorsQuery = () =>
  queryOptions({ queryKey: queryKeys.connectors.linked(), queryFn: listLinkedConnectors })

/** One connector with tools and accounts. */
export const connectorDetailQuery = (slug: string) =>
  queryOptions({ queryKey: queryKeys.connectors.detail(slug), queryFn: () => getConnector(slug) })

export const connectorCategoriesQuery = () =>
  queryOptions({ queryKey: queryKeys.connectors.categories(), queryFn: listConnectorCategories, staleTime: Infinity })

/** The featured apps, fetched by slug in parallel (gives linked state too). A slug that fails is skipped. */
export async function loadFeaturedApps(fetchOne: (slug: string) => Promise<ConnectorCatalog> = getConnector): Promise<ConnectorCatalog[]> {
  const results = await Promise.allSettled(FEATURED_APPS.map(slug => fetchOne(slug)))
  const rows = results.flatMap(r => (r.status === 'fulfilled' ? [r.value] : []))
  // All failed (offline blip): fail the query so the cached rows stay on screen.
  if (rows.length === 0) throw new Error("Couldn't load featured apps")
  return rows
}

export const featuredAppsQuery = () =>
  queryOptions({ queryKey: queryKeys.connectors.featured(), queryFn: () => loadFeaturedApps(), staleTime: CATALOG_STALE_MS })

/** The menu's typed search: 8 backend results per (trimmed, lower-cased) query. */
export const appSearchQuery = (q: string) => {
  const key = q.trim().toLowerCase()
  return queryOptions({
    queryKey: queryKeys.connectors.search(key),
    queryFn: async () => (await listConnectors({ q: key, limit: MENU_SEARCH_LIMIT })).connectors,
    enabled: key.length > 0,
    staleTime: CATALOG_STALE_MS,
  })
}

/**
 * The connectors page's working list: the linked connectors (server truth,
 * refetched after every change), plus catalogue rows the user picked that
 * aren't linked yet. A linked row always wins over a picked copy of it.
 */
export function mergeCatalog(linked: ConnectorCatalog[] | undefined, extras: Iterable<ConnectorCatalog>): ConnectorCatalog[] {
  const bySlug = new Map((linked ?? []).map(row => [row.slug, row]))
  for (const row of extras) if (!bySlug.has(row.slug)) bySlug.set(row.slug, row)
  return [...bySlug.values()]
}
