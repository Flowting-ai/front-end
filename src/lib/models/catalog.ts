import type { GetModelsWithStatus } from '@/lib/api/models'

/** The /settings/ai list logic, kept pure so it can be tested in Node. */

export type CatalogTab = 'all' | 'enabled' | 'disabled'

type CatalogModel = Pick<GetModelsWithStatus, 'model_id' | 'model_name' | 'model_provider' | 'blocked'>

/** Providers in the order the API lists them, each once. */
export function providersInOrder(models: readonly CatalogModel[]): string[] {
  return [...new Set(models.map(m => m.model_provider))]
}

/** Models visible for a tab and a search over name and provider. */
export function filterModels<T extends CatalogModel>(models: readonly T[], tab: string, search: string): T[] {
  const q = search.toLowerCase().trim()
  return models.filter(m => {
    if (tab === 'enabled'  &&  m.blocked) return false
    if (tab === 'disabled' && !m.blocked) return false
    if (q && !m.model_name.toLowerCase().includes(q) && !m.model_provider.toLowerCase().includes(q)) return false
    return true
  })
}

/** The list with one model's blocked flag set: used for the optimistic toggle,
 *  the reconcile with the server's answer, and the rollback. */
export function withBlocked<T extends CatalogModel>(models: readonly T[], modelId: string, blocked: boolean): T[] {
  return models.map(m => (m.model_id === modelId ? { ...m, blocked } : m))
}

/**
 * A model's context window for display: "1.5M ctx", "200k ctx", "512 ctx", or
 * null when unknown. One formatter for /settings/ai and Compare.
 */
export function formatContextWindow(tokens: number | null | undefined): string | null {
  if (!tokens || tokens <= 0) return null
  if (tokens >= 1_000_000) return `${Number((tokens / 1_000_000).toFixed(1))}M ctx`
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}k ctx`
  return `${tokens} ctx`
}
