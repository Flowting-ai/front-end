'use client'

import { useDeferredValue, useMemo, useState } from 'react'
import { rankByTitle } from '@/lib/search/text-match'
import type { Persona } from '@/lib/api/personas'
import { resolveModelName } from '../_lib/agent-models'

export type SortKey = 'activity' | 'az' | 'za'

export type AgentFilters = {
  status:     Set<'live' | 'draft' | 'paused'>
  visibility: Set<'private' | 'team'>
  superLink:  Set<'has-link' | 'no-link'>
  models:     Set<string>
}

export const EMPTY_FILTERS: AgentFilters = {
  status: new Set(), visibility: new Set(), superLink: new Set(), models: new Set(),
}

interface Inputs {
  /** Every agent in the list (feeds the model filter's options). */
  personas: Persona[]
  /** The agents this viewer may see — what filtering and sorting apply to. */
  visiblePersonas: Persona[]
  visibilityForPersona: Record<string, 'private' | 'team'>
  /** Persona repo ids that have at least one active Super Link. */
  activeShareRepoIds: Set<string>
  modelIdToName: Map<string, string>
}

/**
 * Search, sort and filter state for the My Agents list, and the resulting
 * filtered + sorted list. Three chained memos so a sort change doesn't re-run
 * filtering, and a filter change doesn't re-run the sort. Search and filters
 * are deferred so typing / toggling stays responsive while the list catches up
 * in a low-priority render.
 */
export function useAgentFilters({
  personas, visiblePersonas, visibilityForPersona, activeShareRepoIds, modelIdToName,
}: Inputs) {
  const [search,  setSearch]  = useState('')
  const [sort,    setSort]    = useState<SortKey>('activity')
  const [filters, setFilters] = useState<AgentFilters>(EMPTY_FILTERS)

  // Unique model display names present in the current persona list.
  const uniqueModelNames = useMemo(() => {
    const names = new Set<string>()
    for (const p of personas) {
      const name = resolveModelName(modelIdToName, p.modelId)
      if (name) names.add(name)
    }
    return [...names].sort()
  }, [personas, modelIdToName])

  const activeFilterCount =
    filters.status.size + filters.visibility.size + filters.superLink.size + filters.models.size

  function toggleFilter<K extends keyof AgentFilters>(key: K, value: string) {
    setFilters(prev => {
      const next = new Set(prev[key]) as Set<string>
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return { ...prev, [key]: next }
    })
  }

  const deferredFilters = useDeferredValue(filters)
  const filterPanelFiltered = useMemo(() => {
    let result = visiblePersonas

    if (deferredFilters.status.size > 0) {
      result = result.filter(p => {
        // Paused is exclusive: a paused agent shows only under "Paused", never
        // under Live/Draft (the !hasSystemInstructions heuristic must not leak it).
        if (deferredFilters.status.has('live')   && !p.isPaused && p.status === 'active') return true
        if (deferredFilters.status.has('draft')  && !p.isPaused && (p.status === 'draft' || !p.hasSystemInstructions)) return true
        if (deferredFilters.status.has('paused') && p.isPaused) return true
        return false
      })
    }

    if (deferredFilters.visibility.size > 0) {
      result = result.filter(p => deferredFilters.visibility.has(visibilityForPersona[p.id] ?? 'private'))
    }

    if (deferredFilters.superLink.size > 0) {
      result = result.filter(p => {
        const hasLink = activeShareRepoIds.has(p.id)
        if (deferredFilters.superLink.has('has-link') && hasLink)  return true
        if (deferredFilters.superLink.has('no-link')  && !hasLink) return true
        return false
      })
    }

    if (deferredFilters.models.size > 0) {
      result = result.filter(p => {
        const name = resolveModelName(modelIdToName, p.modelId)
        return name !== null && deferredFilters.models.has(name)
      })
    }

    return result
  }, [visiblePersonas, deferredFilters, visibilityForPersona, activeShareRepoIds, modelIdToName])

  const deferredSearch = useDeferredValue(search)
  const filtered = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase()
    const searched = query
      ? filterPanelFiltered.filter(p => p.name.toLowerCase().includes(query))
      : filterPanelFiltered
    const ordered = sort === 'az' ? searched.toSorted((a, b) => a.name.localeCompare(b.name))
      : sort === 'za' ? searched.toSorted((a, b) => b.name.localeCompare(a.name))
      : searched
    // Best name matches first; ties keep the chosen sort.
    return rankByTitle(ordered, query, p => [p.name])
  }, [filterPanelFiltered, deferredSearch, sort])

  return {
    search, setSearch, sort, setSort, filters, setFilters,
    activeFilterCount, toggleFilter, uniqueModelNames, filtered,
  }
}
