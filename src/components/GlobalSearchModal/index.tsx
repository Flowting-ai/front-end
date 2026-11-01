'use client'

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { useSearchParams } from 'next/navigation'
import { useVirtualizer } from '@tanstack/react-virtual'
import { SearchOneIcon } from '@strange-huge/icons'
import { InputField } from '@/components/InputField'
import { TabItem } from '@/components/TabItem'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { resultCountMessage } from '@/lib/search/global-search'

import {
  SHADOW_MODAL,
  EMPTY_SEARCH_RESULTS,
  TYPE_LABEL,
  SectionHeader,
  ResultRow,
  CloseModalButton,
  KbdHint,
} from './ResultParts'

// ── Types ─────────────────────────────────────────────────────────────────────

export type SearchResultType = 'chat' | 'agent-chat' | 'project' | 'persona' | 'pin' | 'page'

export interface SearchResult {
  /** Unique stable id — also used as DOM id for aria-activedescendant */
  id:        string
  type:      SearchResultType
  /** Primary text, truncated with ellipsis */
  title:     string
  /** Secondary line — projects: description; pins: "in [chat title]"; personas: handle; pages: section */
  subtitle?: string
  /** Right-side metadata — chats: "Today", "Yesterday", "Past month" */
  meta?:     string
}

export interface GlobalSearchModalProps {
  open:          boolean
  onClose:       () => void
  /** Fired when the user selects a result — parent handles navigation */
  onSelect:      (result: SearchResult) => void
  /** Fired on every query change — parent updates `results` accordingly */
  onQuery?:      (query: string) => void
  /** Live search results — updated by parent as `onQuery` fires */
  results?:      SearchResult[]
  /** Items shown when query is empty (last 5 recently opened) */
  recents?:      SearchResult[]
  /** Pre-populate the input — useful for story/test fixtures */
  defaultQuery?: string
  loading?:      boolean
  /** One line under the results, e.g. a source still loading or partly failed. */
  notice?:       string
  /** An action shown after the notice, e.g. "Search older chats". */
  noticeAction?: { label: string; onClick: () => void; busy?: boolean }
  className?:    string
}

// ── URL state ─────────────────────────────────────────────────────────────────

/** Search params the open modal mirrors its query and filter into, so they survive back/forward. */
export const SEARCH_QUERY_PARAM = 'search'
export const SEARCH_FILTER_PARAM = 'searchType'

/**
 * Shallow URL update: history.replaceState is picked up by Next's useSearchParams without a server
 * round-trip, a navigation or a scroll. Only touches the given keys; no-op when nothing changes.
 */
function writeSearchParams(patch: Record<string, string | null>) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  let changed = false
  for (const [key, value] of Object.entries(patch)) {
    if (!value) {
      if (url.searchParams.has(key)) { url.searchParams.delete(key); changed = true }
    } else if (url.searchParams.get(key) !== value) {
      url.searchParams.set(key, value)
      changed = true
    }
  }
  if (changed) window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
}

// ── Virtualized flat list (one type filter can hold every match) ─────────────

const ROW_ESTIMATE = 54

function VirtualResults({ items, focusedIndex, focusedId, query, scrollRef, onPick, onHover }: {
  items: SearchResult[]
  focusedIndex: number
  focusedId: string | null
  query: string
  scrollRef: React.RefObject<HTMLDivElement | null>
  onPick: (result: SearchResult) => void
  onHover: (id: string | null) => void
}) {
  'use no memo' // useVirtualizer returns unmemoisable functions, so React Compiler skips this component.
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_ESTIMATE,
    overscan: 8,
    getItemKey: index => items[index].id,
  })
  // Keyboard focus may land on a row that isn't rendered yet: scroll it in (which also mounts it,
  // so aria-activedescendant points at a real element).
  useEffect(() => {
    if (focusedIndex >= 0) virtualizer.scrollToIndex(focusedIndex, { align: 'auto' })
  }, [focusedIndex, virtualizer])
  return (
    <div style={{ position: 'relative', width: '100%', height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map(row => {
        const result = items[row.index]
        return (
          <div
            key={row.key}
            data-index={row.index}
            ref={virtualizer.measureElement}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${row.start}px)` }}
          >
            <ResultRow
              result={result}
              focused={focusedId === result.id}
              query={query}
              onClick={() => onPick(result)}
              onHover={onHover}
            />
          </div>
        )
      })}
    </div>
  )
}

// ── GlobalSearchModal ─────────────────────────────────────────────────────────

const SECTION_ORDER: SearchResultType[] = ['chat', 'agent-chat', 'project', 'persona', 'pin', 'page']
const MAX_PER_SECTION = 4

type FilterValue = 'all' | SearchResultType

const FILTER_TABS: { value: FilterValue; label: string }[] = [
  { value: 'all',          label: 'All' },
  { value: 'chat',         label: 'Chats' },
  { value: 'agent-chat',   label: 'Agent Chats' },
  { value: 'project',      label: 'Projects' },
  { value: 'persona',      label: 'Agents' },
  { value: 'pin',          label: 'Pins' },
  { value: 'page',         label: 'Pages' },
]

export function GlobalSearchModal({
  open,
  onClose,
  onSelect,
  onQuery,
  results      = EMPTY_SEARCH_RESULTS,
  recents      = EMPTY_SEARCH_RESULTS,
  defaultQuery = '',
  loading      = false,
  notice,
  noticeAction,
  className,
}: GlobalSearchModalProps) {
  const searchParams = useSearchParams()
  const [query,        setQuery]        = useState(defaultQuery)
  const [focusedId,    setFocusedId]    = useState<string | null>(null)
  // The query the modal opened with (from the URL, e.g. after back/forward), handed to the parent once.
  const [seedQuery,    setSeedQuery]    = useState('')
  const inputRef  = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // The filter lives in the URL (?searchType=) so it survives back/forward; unknown values mean All.
  const rawFilter = searchParams.get(SEARCH_FILTER_PARAM)
  const activeFilter: FilterValue = FILTER_TABS.some(tab => tab.value === rawFilter) ? rawFilter as FilterValue : 'all'
  const setActiveFilter = useCallback((next: FilterValue) => {
    writeSearchParams({ [SEARCH_FILTER_PARAM]: next === 'all' ? null : next })
  }, [])

  // Open edge: adopt the query from the URL (or the fixture default). Close edge: reset.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    setFocusedId(null)
    if (open) {
      const seed = searchParams.get(SEARCH_QUERY_PARAM) ?? defaultQuery
      setQuery(seed)
      setSeedQuery(seed)
    } else {
      setQuery('')
      setSeedQuery('')
    }
  }
  useEffect(() => {
    if (open && seedQuery) onQuery?.(seedQuery)
  }, [open, seedQuery, onQuery])
  // Closed by any route (parent included): drop the modal's params from the URL.
  useEffect(() => {
    if (!open) writeSearchParams({ [SEARCH_QUERY_PARAM]: null, [SEARCH_FILTER_PARAM]: null })
  }, [open])

  // Scroll focused result into view whenever it changes via keyboard
  useEffect(() => {
    if (!focusedId) return
    document
      .getElementById(`search-result-${focusedId}`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [focusedId])

  const handleQueryChange = useCallback((val: string) => {
    setQuery(val)
    setFocusedId(null)
    writeSearchParams({ [SEARCH_QUERY_PARAM]: val })
    onQuery?.(val)
  }, [onQuery])

  const handleClose = useCallback(() => {
    writeSearchParams({ [SEARCH_QUERY_PARAM]: null, [SEARCH_FILTER_PARAM]: null })
    setQuery('')
    setFocusedId(null)
    onClose()
  }, [onClose])

  // ── Derived data ────────────────────────────────────────────────────────────

  const hasQuery = query.trim().length > 0

  const grouped = useMemo(() => {
    const map: Partial<Record<SearchResultType, { shown: SearchResult[]; overflow: number }>> = {}
    for (const type of SECTION_ORDER) {
      const items = results.filter(r => r.type === type)
      if (items.length === 0) continue
      const shown    = items.slice(0, MAX_PER_SECTION)
      const overflow = items.length - shown.length
      map[type] = { shown, overflow }
    }
    return map
  }, [results])

  // Flat ordered list drives keyboard navigation
  const flatList = useMemo<SearchResult[]>(() => {
    if (!hasQuery) return recents
    if (activeFilter === 'all') return SECTION_ORDER.flatMap(t => grouped[t]?.shown ?? [])
    return results.filter(r => r.type === activeFilter)
  }, [hasQuery, recents, activeFilter, grouped, results])

  const focusedIndex = flatList.findIndex(r => r.id === focusedId)

  // ── Keyboard navigation on the input ────────────────────────────────────────

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = focusedIndex < flatList.length - 1 ? focusedIndex + 1 : 0
      setFocusedId(flatList[next]?.id ?? null)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prev = focusedIndex > 0 ? focusedIndex - 1 : flatList.length - 1
      setFocusedId(flatList[prev]?.id ?? null)
      return
    }
    if (e.key === 'Enter' && focusedId) {
      e.preventDefault()
      const hit = flatList.find(r => r.id === focusedId)
      // Close (and strip ?search=/?searchType=) before onSelect navigates: a history.replaceState
      // issued after router.push has started overrides the pending navigation in Next.
      if (hit) { handleClose(); onSelect(hit) }
    }
  }, [focusedIndex, flatList, focusedId, onSelect, handleClose])

  const handleResultClick = useCallback((result: SearchResult) => {
    handleClose()
    onSelect(result)
  }, [onSelect, handleClose])

  const filteredResults = useMemo(
    () => (activeFilter === 'all' ? [] : results.filter(r => r.type === activeFilter)),
    [activeFilter, results],
  )

  const noResults = hasQuery && results.length === 0 && !loading

  return (
    <Dialog open={open} onOpenChange={next => { if (!next) handleClose() }}>
      <DialogContent
        hideClose
        aria-describedby={undefined}
        className={cn(className)}
        // Focus the field rather than the first tabbable; Radix traps focus and returns it on close.
        onOpenAutoFocus={e => { e.preventDefault(); inputRef.current?.focus() }}
        // First Escape clears the query and returns to recents; Escape with no query closes.
        onEscapeKeyDown={e => { if (hasQuery) { e.preventDefault(); handleQueryChange('') } }}
        style={{
          top:             132,
          transform:       'translateX(-50%)',
          width:           560,
          maxHeight:       'none',
          display:         'block',
          backgroundColor: 'var(--modal-bg)',
          boxShadow:       SHADOW_MODAL,
          // The default entrance animates from the vertical centre; this card sits near the top instead.
          animation:       'none',
        }}
      >
        <DialogTitle className="sr-only">Search Souvenir</DialogTitle>
          <m.div
            initial={{ opacity: 0, scale: 0.97, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >

            {/* ── Search header ──────────────────────────────────────────── */}
            <div
              style={{
                display:    'flex',
                alignItems: 'center',
                gap:        8,
                padding:    '14px 12px 12px',
              }}
            >
              <div style={{ flex: 1 }}>
                <InputField
                  ref={inputRef}
                  fluid
                  placeholder="Search chats, agent chats, projects, pins…"
                  leftIcon={<SearchOneIcon size={16} color="var(--neutral-400)" />}
                  value={query}
                  onChange={handleQueryChange}
                  onKeyDown={handleKeyDown}
                  role="combobox"
                  aria-expanded={open}
                  aria-controls="global-search-results"
                  aria-autocomplete="list"
                  aria-activedescendant={focusedId ? `search-result-${focusedId}` : undefined}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <CloseModalButton onClick={handleClose} />
            </div>

            {/* ── Filter tabs — slide in when query is present ───────────── */}
            <AnimatePresence initial={false}>
              {hasQuery && (
                <m.div
                  key="filter-tabs"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  style={{ overflow: 'hidden' }}
                >
                  <div
                    role="tablist"
                    aria-label="Filter results by type"
                    style={{
                      display:    'flex',
                      alignItems: 'center',
                      gap:        2,
                      padding:    '2px 10px 10px',
                    }}
                  >
                    {FILTER_TABS.map(tab => (
                      <TabItem
                        key={tab.value}
                        size="small"
                        selected={activeFilter === tab.value}
                        role="tab"
                        aria-selected={activeFilter === tab.value}
                        onClick={() => { setActiveFilter(tab.value); setFocusedId(null) }}
                      >
                        {tab.label}
                      </TabItem>
                    ))}
                  </div>
                </m.div>
              )}
            </AnimatePresence>

            {/* ── Results list ────────────────────────────────────────────── */}
            <div
              ref={scrollRef}
              id="global-search-results"
              role="listbox"
              className="kaya-scrollbar kaya-no-gutter"
              aria-label={hasQuery ? `Results for "${query}"` : 'Recent items'}
              style={{
                maxHeight: 368,
                overflowY: 'auto',
                padding:   '8px 0 10px',
              }}
            >

              {/* Empty query → recents */}
              {!hasQuery && (
                recents.length > 0 ? (
                  <>
                    <SectionHeader label="Recent" />
                    {recents.map(result => (
                      <ResultRow
                        key={result.id}
                        result={result}
                        focused={focusedId === result.id}
                        query={query}
                        onClick={() => handleResultClick(result)}
                        onHover={setFocusedId}
                      />
                    ))}
                  </>
                ) : (
                  <p style={{
                    margin:     '32px 0',
                    textAlign:  'center',
                    fontFamily: 'var(--font-body)',
                    fontSize:   'var(--font-size-body)',
                    color:      'var(--neutral-400)',
                  }}>
                    Start typing to search
                  </p>
                )
              )}

              {/* Has query + loading */}
              {hasQuery && loading && (
                <p style={{
                  margin:     '32px 0',
                  textAlign:  'center',
                  fontFamily: 'var(--font-body)',
                  fontSize:   'var(--font-size-body)',
                  color:      'var(--neutral-400)',
                }}>
                  Searching…
                </p>
              )}

              {/* Has query + no results */}
              {noResults && (
                <div style={{
                  display:       'flex',
                  flexDirection: 'column',
                  alignItems:    'center',
                  padding:       '32px 24px',
                  gap:           6,
                }}>
                  <p style={{
                    margin:     0,
                    fontFamily: 'var(--font-body)',
                    fontSize:   'var(--font-size-body)',
                    fontWeight: 500,
                    color:      'var(--neutral-700)',
                  }}>
                    No results for &ldquo;{query}&rdquo;
                  </p>
                  <p style={{
                    margin:     0,
                    fontFamily: 'var(--font-body)',
                    fontSize:   'var(--font-size-caption)',
                    color:      'var(--neutral-400)',
                  }}>
                    Try a different word or check your spelling
                  </p>
                </div>
              )}

              {/* Has query + results + All filter → grouped by type */}
              {hasQuery && !loading && activeFilter === 'all' && results.length > 0 && (
                SECTION_ORDER.map(type => {
                  const section = grouped[type]
                  if (!section) return null
                  return (
                    <React.Fragment key={type}>
                      <SectionHeader label={TYPE_LABEL[type]} />
                      {section.shown.map(result => (
                        <ResultRow
                          key={result.id}
                          result={result}
                          focused={focusedId === result.id}
                          query={query}
                          onClick={() => handleResultClick(result)}
                          onHover={setFocusedId}
                        />
                      ))}
                      {section.overflow > 0 && (
                        <button
                          type="button"
                          onClick={() => setActiveFilter(type)}
                          style={{
                            display:    'block',
                            margin:     '2px 16px 4px',
                            padding:    '3px 0',
                            border:     'none',
                            background: 'transparent',
                            fontFamily: 'var(--font-body)',
                            fontSize:   'var(--font-size-caption)',
                            fontWeight: 500,
                            color:      'var(--blue-400)',
                            cursor:     'pointer',
                            textAlign:  'left',
                          }}
                        >
                          +{section.overflow} more
                        </button>
                      )}
                    </React.Fragment>
                  )
                })
              )}

              {/* Has query + results + type filter → flat list */}
              {hasQuery && !loading && activeFilter !== 'all' && (
                filteredResults.length === 0 ? (
                  <p style={{
                    margin:     '32px 0',
                    textAlign:  'center',
                    fontFamily: 'var(--font-body)',
                    fontSize:   'var(--font-size-body)',
                    color:      'var(--neutral-400)',
                  }}>
                    No {TYPE_LABEL[activeFilter].toLowerCase()} match &ldquo;{query}&rdquo;
                  </p>
                ) : (
                  <VirtualResults
                    items={filteredResults}
                    focusedIndex={focusedIndex}
                    focusedId={focusedId}
                    query={query}
                    scrollRef={scrollRef}
                    onPick={handleResultClick}
                    onHover={setFocusedId}
                  />
                )
              )}

            </div>

            {notice && (
              <p role="note" style={{
                margin:     0,
                padding:    '0 16px 6px',
                fontFamily: 'var(--font-body)',
                fontSize:   'var(--font-size-caption)',
                color:      'var(--neutral-500)',
              }}>
                {notice}
                {noticeAction && (
                  <>
                    {' '}
                    <button
                      type="button"
                      onClick={noticeAction.onClick}
                      disabled={noticeAction.busy}
                      aria-busy={noticeAction.busy || undefined}
                      style={{ border: 0, padding: 0, background: 'none', font: 'inherit', color: 'var(--neutral-900)', textDecoration: 'underline', cursor: noticeAction.busy ? 'default' : 'pointer' }}
                    >
                      {noticeAction.busy ? 'Loading…' : noticeAction.label}
                    </button>
                  </>
                )}
              </p>
            )}

            {/* Result count for screen readers; the list itself isn't a live region. */}
            <p aria-live="polite" className="sr-only">
              {resultCountMessage(hasQuery && activeFilter !== 'all' ? flatList.length : results.length, hasQuery, loading)}
            </p>

            {/* ── Footer kbd hints — white bg, no divider ────────────────── */}
            <div
              style={{
                display:         'flex',
                alignItems:      'center',
                gap:             12,
                padding:         '8px 16px 10px',
                backgroundColor: 'var(--neutral-white)',
              }}
            >
              <KbdHint keys={['↑', '↓']} label="navigate" />
              <KbdHint keys={['↵']}       label="open" />
              <KbdHint keys={['Esc']}     label="close" />
            </div>

          </m.div>
      </DialogContent>
    </Dialog>
  )
}

export default GlobalSearchModal
