'use client'

import React, { useMemo, useState } from 'react'
import { ArrowLeftOneIcon, ArrowRightOneIcon } from '@strange-huge/icons'
import Tabs from '@/components/Tabs'
import { CONNECTOR_CATEGORIES, connectorCategory } from '@/lib/connectorCategories'
import type { ConnectorCategory } from '@/lib/connectorCategories'

export type CategorySelection = ConnectorCategory | 'all'

/**
 * Shared category-filter + pagination logic for every connector list (org
 * catalog, manage, team page, member browse, personal settings). The caller
 * filters by SEARCH first and passes the already-searched list + a `resetKey`
 * (its search term); this hook layers category filtering and 10-per-page
 * pagination on top. A new search/list context resets category and page, while
 * changing only the category resets the page.
 */
export function useConnectorBrowse<T>(
  items: T[],
  getSlug: (item: T) => string,
  opts?: { pageSize?: number; resetKey?: string },
) {
  const pageSize = opts?.pageSize ?? 10
  const resetKey = opts?.resetKey ?? ''

  const [category, setCategory] = useState<CategorySelection>('all')
  const [page, setPage] = useState(1)

  const availableCategories = useMemo<ConnectorCategory[]>(() => {
    const present = new Set(items.map(i => connectorCategory(getSlug(i))))
    const ordered = CONNECTOR_CATEGORIES.filter(c => present.has(c)) as ConnectorCategory[]
    return present.has('Other') ? [...ordered, 'Other'] : ordered
  }, [getSlug, items])

  const filtered = useMemo(
    () => (category === 'all' ? items : items.filter(i => connectorCategory(getSlug(i)) === category)),
    [category, getSlug, items],
  )

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))

  // Reset to page 1 when search / category / data change — adjust-state-during-
  // render (React's supported pattern), so we avoid a set-state-in-effect.
  const itemKey = items.map(getSlug).join('|')
  const contextKey = `${resetKey}::${itemKey}`
  const [lastContextKey, setLastContextKey] = useState(contextKey)
  if (contextKey !== lastContextKey) {
    setLastContextKey(contextKey)
    setCategory('all')
    setPage(1)
  }

  const [lastCategory, setLastCategory] = useState(category)
  if (category !== lastCategory) {
    setLastCategory(category)
    setPage(1)
  }

  const safePage = Math.min(page, pageCount)
  const pageItems = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  return {
    category,
    setCategory,
    page: safePage,
    setPage,
    pageCount,
    total: filtered.length,
    filteredItems: filtered,
    pageItems,
    availableCategories,
    pageSize,
  }
}

export function CategoryFilter({
  value,
  categories,
  onChange,
}: {
  value: CategorySelection
  categories: ConnectorCategory[]
  onChange: (next: CategorySelection) => void
}) {
  if (categories.length === 0) return null
  const chips: CategorySelection[] = ['all', ...categories]
  return (
    <div aria-label="Connector categories" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12, color: 'var(--neutral-500)' }}>
        Categories
      </span>
      <Tabs value={value} onValueChange={next => onChange(next as CategorySelection)}>
        <Tabs.List size="small" scrollable>
          {chips.map(chip => (
            <Tabs.Trigger key={chip} value={chip}>
              {chip === 'all' ? 'All connectors' : chip}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </Tabs>
    </div>
  )
}

export function Pagination({
  page,
  pageCount,
  onChange,
}: {
  page: number
  pageCount: number
  onChange: (page: number) => void
}) {
  if (pageCount <= 1) return null
  const btn = (disabled: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    height: 32,
    padding: '0 10px',
    borderRadius: 8,
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    backgroundColor: 'white',
    boxShadow: '0px 0px 0px 1px var(--neutral-200)',
    fontFamily: 'var(--font-body)',
    fontWeight: 500,
    fontSize: 13,
    color: 'var(--neutral-700)',
  })
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
      <button type="button" aria-label="Previous connector page" disabled={page <= 1} onClick={() => onChange(page - 1)} style={btn(page <= 1)}>
        <ArrowLeftOneIcon size={14} /> Previous
      </button>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-500)' }}>
        Page {page} of {pageCount}
      </span>
      <button type="button" aria-label="Next connector page" disabled={page >= pageCount} onClick={() => onChange(page + 1)} style={btn(page >= pageCount)}>
        Next <ArrowRightOneIcon size={14} />
      </button>
    </div>
  )
}
