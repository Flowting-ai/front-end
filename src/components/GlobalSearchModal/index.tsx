'use client'

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import {
  SearchOneIcon,
  CancelOneIcon,
  FolderOneIcon,
  PinIcon,
  UserAiIcon,
  MessagePreviewOneIcon,
  DashboardSquareOneIcon,
} from '@strange-huge/icons'
import { InputField } from '@/components/InputField'
import { TabItem }    from '@/components/TabItem'
import { cn } from '@/lib/utils'

// ── Shadows ───────────────────────────────────────────────────────────────────

const SHADOW_MODAL   = '0px 8px 32px 0px rgba(82,75,71,0.18), 0px 0px 0px 1px var(--neutral-100)'
const SHADOW_FOCUSED = '0px 0px 0px 1.5px var(--blue-400)'

// ── Types ─────────────────────────────────────────────────────────────────────

export type SearchResultType = 'chat' | 'project' | 'persona' | 'pin' | 'page'

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
  className?:    string
}

// ── Color system — mirrors KDS tag palette (Chip, Badge) ─────────────────────
// Tokens live in aliases.css under `--color-tag-{Color}-{prop}`.

const EMPTY_SEARCH_RESULTS: SearchResult[] = []

const TYPE_ICON_BG: Record<SearchResultType, string> = {
  chat:    'var(--color-tag-Blue-bg)',
  project: 'var(--color-tag-Purple-bg)',
  persona: 'var(--color-tag-Green-bg-soft)',
  pin:     'var(--color-tag-Yellow-bg)',
  page:    'var(--color-tag-Neutral-bg)',
}

const TYPE_ICON_COLOR: Record<SearchResultType, string> = {
  chat:    'var(--color-tag-Blue-text)',
  project: 'var(--color-tag-Purple-text)',
  persona: 'var(--color-tag-Green-text)',
  pin:     'var(--color-tag-Yellow-text)',
  page:    'var(--color-tag-Neutral-text)',
}

// ── Icon map by type ──────────────────────────────────────────────────────────

const TYPE_ICON: Record<SearchResultType, React.ComponentType<{ size: number; color: string }>> = {
  chat:    MessagePreviewOneIcon,
  project: FolderOneIcon,
  persona: UserAiIcon,
  pin:     PinIcon,
  page:    DashboardSquareOneIcon,
}

const TYPE_LABEL: Record<SearchResultType, string> = {
  chat:    'Chats',
  project: 'Projects',
  persona: 'Personas',
  pin:     'Pins',
  page:    'Pages',
}

// ── highlightMatch ────────────────────────────────────────────────────────────
// Splits `text` on the first case-insensitive occurrence of `query` and
// returns a React node with the matched segment bolded in neutral-900.
// Returns plain text when query is empty or has no match.

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text
  const lower      = text.toLowerCase()
  const lowerQuery = query.toLowerCase().trim()
  const idx        = lower.indexOf(lowerQuery)
  if (idx === -1) return text

  return (
    <>
      {text.slice(0, idx)}
      <strong style={{ fontWeight: 600, color: 'var(--neutral-900)' }}>
        {text.slice(idx, idx + lowerQuery.length)}
      </strong>
      {text.slice(idx + lowerQuery.length)}
    </>
  )
}

// ── SectionHeader ─────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <p
      style={{
        margin:        '8px 16px 2px',
        fontFamily:    'var(--font-body)',
        fontSize:      'var(--font-size-caption)',
        fontWeight:    600,
        lineHeight:    'var(--line-height-caption)',
        color:         'var(--neutral-400)',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </p>
  )
}

// ── ResultRow ─────────────────────────────────────────────────────────────────

interface ResultRowProps {
  result:  SearchResult
  focused: boolean
  query:   string
  onClick: () => void
  onHover: (id: string | null) => void
}

function ResultRow({ result, focused, query, onClick, onHover }: ResultRowProps) {
  const [hovered, setHovered] = useState(false)
  const Icon = TYPE_ICON[result.type]

  return (
    <button
      type="button"
      id={`search-result-${result.id}`}
      role="option"
      aria-selected={focused}
      aria-label={[
        // "Chat: Onboarding flow redesign, Today"
        // "Project: Souvenir V2, 18 components"
        `${TYPE_LABEL[result.type].slice(0, -1)}: ${result.title}`,
        result.meta      ?? result.subtitle,
      ].filter(Boolean).join(', ')}
      onClick={onClick}
      onMouseEnter={() => { setHovered(true);  onHover(result.id) }}
      onMouseLeave={() => { setHovered(false); onHover(null) }}
      style={{
        display:         'flex',
        alignItems:      'center',
        gap:             10,
        padding:         '8px 8px',
        margin:          '1px 8px',
        borderRadius:    10,
        border:          'none',
        width:           'calc(100% - 16px)',
        textAlign:       'left',
        backgroundColor: focused
          ? 'var(--neutral-100)'
          : hovered
            ? 'var(--neutral-50)'
            : 'transparent',
        boxShadow:       focused ? SHADOW_FOCUSED : 'none',
        cursor:          'pointer',
        outline:         'none',
        transition:      'background-color 100ms, box-shadow 100ms',
        flexShrink:      0,
      }}
    >
      {/* Colour-coded icon container */}
      <div
        style={{
          display:         'inline-flex',
          alignItems:      'center',
          justifyContent:  'center',
          width:           28,
          height:          28,
          borderRadius:    8,
          backgroundColor: TYPE_ICON_BG[result.type],
          flexShrink:      0,
        }}
      >
        <Icon size={14} color={TYPE_ICON_COLOR[result.type]} />
      </div>

      {/* Text */}
      <div style={{ flex: '1 1 0', minWidth: 0 }}>
        <p
          style={{
            margin:       0,
            fontFamily:   'var(--font-body)',
            fontSize:     'var(--font-size-body)',
            fontWeight:   500,
            lineHeight:   'var(--line-height-body)',
            color:        'var(--neutral-800)',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}
        >
          {highlightMatch(result.title, query)}
        </p>
        {result.subtitle && (
          <p
            style={{
              margin:       '2px 0 0',
              fontFamily:   'var(--font-body)',
              fontSize:     'var(--font-size-caption)',
              fontWeight:   400,
              lineHeight:   'var(--line-height-caption)',
              color:        'var(--neutral-400)',
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}
          >
            {highlightMatch(result.subtitle, query)}
          </p>
        )}
      </div>

      {/* Meta (timestamp, count, etc.) */}
      {result.meta && (
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-caption)',
            fontWeight: 400,
            lineHeight: 'var(--line-height-caption)',
            color:      'var(--neutral-400)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {result.meta}
        </span>
      )}
    </button>
  )
}

// ── CloseModalButton ──────────────────────────────────────────────────────────

function CloseModalButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      aria-label="Close search"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        justifyContent:  'center',
        width:           32,
        height:          32,
        borderRadius:    8,
        border:          'none',
        backgroundColor: hovered ? 'var(--neutral-100)' : 'transparent',
        cursor:          'pointer',
        flexShrink:      0,
        transition:      'background-color 120ms',
      }}
    >
      <CancelOneIcon size={16} color="var(--neutral-500)" />
    </button>
  )
}

// ── KbdHint ───────────────────────────────────────────────────────────────────

function KbdHint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span
      style={{
        display:    'inline-flex',
        alignItems: 'center',
        gap:        4,
        fontFamily: 'var(--font-body)',
        fontSize:   'var(--font-size-caption)',
        color:      'var(--neutral-400)',
      }}
    >
      {keys.map(k => (
        <kbd
          key={k}
          style={{
            display:         'inline-flex',
            alignItems:      'center',
            justifyContent:  'center',
            minWidth:        20,
            padding:         '1px 5px',
            borderRadius:    5,
            backgroundColor: 'var(--neutral-100)',
            boxShadow:       '0px 0px 0px 1px var(--neutral-200)',
            fontFamily:      'var(--font-code)',
            fontSize: 12,
            color:           'var(--neutral-600)',
          }}
        >
          {k}
        </kbd>
      ))}
      <span>{label}</span>
    </span>
  )
}

// ── GlobalSearchModal ─────────────────────────────────────────────────────────

const SECTION_ORDER: SearchResultType[] = ['chat', 'project', 'persona', 'pin', 'page']
const MAX_PER_SECTION = 4

type FilterValue = 'all' | SearchResultType

const FILTER_TABS: { value: FilterValue; label: string }[] = [
  { value: 'all',     label: 'All' },
  { value: 'chat',    label: 'Chats' },
  { value: 'project', label: 'Projects' },
  { value: 'persona', label: 'Personas' },
  { value: 'pin',     label: 'Pins' },
  { value: 'page',    label: 'Pages' },
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
  className,
}: GlobalSearchModalProps) {
  // eslint-disable-next-line react-doctor/no-derived-useState -- intentional draft-state pattern; reset handled by key prop or effect
  const [query,        setQuery]        = useState(defaultQuery)
  const [activeFilter, setActiveFilter] = useState<FilterValue>('all')
  const [focusedId,    setFocusedId]    = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Reset state on close; focus input on open
  // eslint-disable-next-line react-doctor/no-cascading-set-state -- React 18+ batches these; useReducer refactor tracked separately
  useEffect(() => {
    if (!open) {
      setQuery('')
      setActiveFilter('all')
      setFocusedId(null)
      return
    }
    const id = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(id)
  }, [open])

  // Focus trap — keep Tab / Shift+Tab cycling inside the modal card.
  // Restores focus to the previously focused element on close.
  useEffect(() => {
    if (!open) return

    const previouslyFocused = document.activeElement as HTMLElement | null

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const modal = modalRef.current
      if (!modal) return

      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      )
      if (focusable.length === 0) return

      const first = focusable[0]
      const last  = focusable[focusable.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleTab)
    return () => {
      document.removeEventListener('keydown', handleTab)
      previouslyFocused?.focus()
    }
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
    onQuery?.(val)
  }, [onQuery])

  const handleClose = useCallback(() => {
    setQuery('')
    setActiveFilter('all')
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
    if (e.key === 'Escape') {
      e.preventDefault()
      // First Escape clears the query and returns to recents.
      // Second Escape (or Escape with no query) closes the modal.
      if (hasQuery) {
        handleQueryChange('')
      } else {
        handleClose()
      }
      return
    }
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
      if (hit) { onSelect(hit); handleClose() }
    }
  }, [focusedIndex, flatList, focusedId, onSelect, handleClose])

  const handleResultClick = useCallback((result: SearchResult) => {
    onSelect(result)
    handleClose()
  }, [onSelect, handleClose])

  const noResults = hasQuery && results.length === 0 && !loading

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <m.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={handleClose}
            style={{
              position:        'fixed',
              inset:           0,
              backgroundColor: 'rgba(0,0,0,0.18)',
              backdropFilter:  'blur(2px)',
              zIndex:          20,
            }}
          />

          {/* Modal card */}
          <m.div
            ref={modalRef}
            key="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Search Souvenir"
            initial={{ opacity: 0, scale: 0.97, y: -6, x: '-50%' }}
            animate={{ opacity: 1, scale: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, scale: 0.97, y: -6, x: '-50%' }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={cn(className)}
            style={{
              position:        'fixed',
              top:             132,
              left:            '50%',
              zIndex:          21,
              width:           560,
              maxWidth:        'calc(100vw - 32px)',
              borderRadius:    16,
              backgroundColor: 'var(--neutral-white)',
              boxShadow:       SHADOW_MODAL,
              overflow:        'hidden',
            }}
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
                  placeholder="Search chats, projects, personas, pins, pages…"
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
              id="global-search-results"
              role="listbox"
              className="kaya-scrollbar"
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
                results.filter(r => r.type === activeFilter).length === 0 ? (
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
                  results
                    .flatMap(result => result.type === activeFilter ? [(
                      <ResultRow
                        key={result.id}
                        result={result}
                        focused={focusedId === result.id}
                        query={query}
                        onClick={() => handleResultClick(result)}
                        onHover={setFocusedId}
                      />
                    )] : [])
                )
              )}

            </div>

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
        </>
      )}
    </AnimatePresence>
  )
}

export default GlobalSearchModal
