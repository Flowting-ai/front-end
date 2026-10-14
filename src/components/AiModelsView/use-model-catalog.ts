'use client'

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { loadAllModels, toggleBlockModel, type LLMModel } from '@/lib/api/models'
import { bustModelsCache } from '@/lib/ai-models'
import { filterModels, providersInOrder, withBlocked, type CatalogTab } from '@/lib/models/catalog'
import { queryKeys } from '@/lib/query-keys'

/** The settings list (wire shape, blocked flags included); under ["models"] so bustModelsCache refreshes it. */
const SETTINGS_KEY = [...queryKeys.models.all(), 'settings'] as const
const TABS: readonly CatalogTab[] = ['all', 'enabled', 'disabled']

/**
 * Data and filters for /settings/ai. The catalogue is a React Query entry;
 * tab and search live in the URL (`?tab=enabled&q=gpt`) so a filtered view can
 * be linked and survives a reload; search is deferred so typing stays smooth.
 * The toggle is optimistic, reconciles with the backend's answer, rolls back on
 * failure, and refreshes every model consumer (bustModelsCache).
 */
export function useModelCatalog() {
  const qc = useQueryClient()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const listQ = useQuery({ queryKey: SETTINGS_KEY, queryFn: loadAllModels })
  const models = useMemo(() => listQ.data ?? [], [listQ.data])
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const tabParam = params.get('tab') as CatalogTab | null
  const tab: CatalogTab = tabParam && TABS.includes(tabParam) ? tabParam : 'all'
  // The input is local state (instant); the URL follows after a pause.
  const [search, setSearchState] = useState(() => params.get('q') ?? '')
  const deferredSearch = useDeferredValue(search)
  const urlSearch = useDebouncedValue(search, 300)

  const setParam = useCallback((key: 'tab' | 'q', value: string, fallback: string) => {
    const next = new URLSearchParams(params.toString())
    if (!value || value === fallback) next.delete(key)
    else next.set(key, value)
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [params, pathname, router])

  useEffect(() => {
    if ((params.get('q') ?? '') !== urlSearch) setParam('q', urlSearch, '')
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the debounced value changes
  }, [urlSearch])

  const write = (fn: (prev: LLMModel[]) => LLMModel[]) => qc.setQueryData<LLMModel[]>(SETTINGS_KEY, prev => fn(prev ?? []))

  const toggle = useCallback(async (model: LLMModel) => {
    if (togglingId) return
    setTogglingId(model.model_id)
    await qc.cancelQueries({ queryKey: SETTINGS_KEY, exact: true })
    write(prev => withBlocked(prev, model.model_id, !model.blocked))
    try {
      const result = await toggleBlockModel(model.model_id)
      write(prev => withBlocked(prev, model.model_id, result.blocked))
      bustModelsCache()
      toast.success(result.blocked ? `${model.model_name} disabled` : `${model.model_name} enabled`)
    } catch {
      write(prev => withBlocked(prev, model.model_id, model.blocked))
      toast.error(`Failed to update ${model.model_name}`)
    } finally {
      setTogglingId(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- write is a stable helper over qc
  }, [togglingId, qc])

  const allProviders = useMemo(() => providersInOrder(models), [models])
  const filteredModels = useMemo(() => filterModels(models, tab, deferredSearch), [models, tab, deferredSearch])
  const visibleProviders = useMemo(
    () => allProviders.filter(p => filteredModels.some(m => m.model_provider === p)),
    [allProviders, filteredModels],
  )

  return {
    models,
    isLoading: listQ.isPending,
    loadFailed: listQ.isError && !listQ.data,
    retryLoad: () => { void listQ.refetch() },
    togglingId,
    toggle,
    tab,
    setTab: (next: string) => setParam('tab', next, 'all'),
    search,
    setSearch: setSearchState,
    filteredModels,
    visibleProviders,
    totalEnabled: models.filter(m => !m.blocked).length,
  }
}
