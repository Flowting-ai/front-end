'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AnimatePresence, m } from 'framer-motion'
import { SearchOneIcon, CancelCircleIcon, ArrowDownOneIcon, UserAiIcon, PlusSignIcon } from '@strange-huge/icons'
import { InputField } from '@/components/InputField'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { Tooltip } from '@/components/Tooltip'
import { Dropdown } from '@/components/Dropdown'
import { PersonaCard } from '@/components/PersonaCard'
import { useSelectableChatPersonas } from '@/hooks/use-selectable-chat-personas'
import { listShares } from '@/lib/api/persona-shares'
import { useProjectPanel } from '@/context/project-panel-context'
import { AGENTS_ROUTE, AGENTS_TEMPLATES_ROUTE } from '@/lib/routes'
import type { SelectedPersonaInfo } from '@/lib/chat-personas'

export const AGENT_SELECT_EVENT = 'agent:select'

/** Fired when a row is picked — the current page (e.g. /chat) listens for
 *  this instead of receiving a prop, since the panel is rendered by the
 *  shared AppLayout tree (via ProjectPanelSidebar), outside the page's own
 *  component tree. Same cross-tree pattern Pinboard uses for "pin:insert". */
export function emitAgentSelect(persona: SelectedPersonaInfo) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<SelectedPersonaInfo>(AGENT_SELECT_EVENT, { detail: persona }))
  }
}

type AgentFilter = 'mine' | 'team' | 'superlink'

const FILTER_LABEL: Record<AgentFilter, string> = {
  mine:      'My Agents',
  team:      'Team Agents',
  superlink: 'Superlink Agents',
}

/** Quick-add-an-agent-to-this-chat panel — same list this app already shows
 *  in the chat input's "Add agent" submenu (useSelectableChatPersonas), just
 *  surfaced as a full Pinboard-style side panel instead of a dropdown. */
export function AgentsPanelContent() {
  const [search, setSearch] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [filter, setFilter] = useState<AgentFilter>('mine')
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  const { personas, loading } = useSelectableChatPersonas(true)
  const { setPanel } = useProjectPanel()
  const router = useRouter()

  function closeSearch() {
    setIsSearchOpen(false)
    setSearch('')
  }

  // Active-link Super Link ids, keyed by the persona VERSION they were shared
  // from — mirrors agents/page.tsx's activeShareRepoIds, but matched directly
  // against each persona's current activeVersionId instead of resolving back
  // to a repo id, since that's all we have available in this simpler flow.
  const [activeSuperlinkVersionIds, setActiveSuperlinkVersionIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    listShares()
      .then(shares => {
        if (cancelled) return
        const ids = shares
          .filter(share => share.is_active && share.share_type === 'link')
          .map(share => share.persona_id)
        setActiveSuperlinkVersionIds(new Set(ids))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const isSuperlink = (p: SelectedPersonaInfo) =>
    !!p.activeVersionId && activeSuperlinkVersionIds.has(p.activeVersionId)

  const byFilter = useMemo(() => {
    if (filter === 'team') return personas.filter(p => p.visibility === 'team')
    if (filter === 'superlink') return personas.filter(isSuperlink)
    return personas.filter(p => p.ownedByViewer)
  }, [personas, filter, activeSuperlinkVersionIds])

  const filtered = search.trim()
    ? byFilter.filter(p => p.name.toLowerCase().includes(search.trim().toLowerCase()))
    : byFilter

  // Top/bottom edge fade - same progressive blur + colour fade Pinboard uses
  // to signal the list overflows. Hidden at the scroll extremes.
  const scrollRef = useRef<HTMLDivElement>(null)
  const [atTop, setAtTop] = useState(true)
  const [atBottom, setAtBottom] = useState(false)

  const updateScrollEdges = () => {
    const el = scrollRef.current
    if (!el) return
    setAtTop(el.scrollTop < 8)
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 8)
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setAtTop(e.currentTarget.scrollTop < 8)
    setAtBottom(e.currentTarget.scrollHeight - e.currentTarget.scrollTop - e.currentTarget.clientHeight < 8)
  }

  // Recompute after the list renders/resizes (e.g. filter change, async
  // persona load) so the bottom fade reflects overflow from first paint.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    updateScrollEdges()
    const ro = new ResizeObserver(updateScrollEdges)
    ro.observe(el)
    const inner = el.firstElementChild
    if (inner instanceof Element) ro.observe(inner)
    return () => ro.disconnect()
  }, [filtered.length])

  const handleSelect = (persona: SelectedPersonaInfo) => {
    emitAgentSelect(persona)
    setPanel(null)
  }

  const handleManageAgents = () => {
    setPanel(null)
    router.push(AGENTS_ROUTE)
  }

  const handleCreateNew = () => {
    setPanel(null)
    router.push(AGENTS_TEMPLATES_ROUTE)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', flexShrink: 0 }}>
        {/* Filter dropdown - same "view filter" pattern as Pinboard's
            "All pins" trigger: a Button + chevron opening a Dropdown of
            selectable rows. */}
        <AnimatePresence initial={false}>
          {!isSearchOpen && (
            <m.div
              key="filter-trigger"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              style={{ display: 'inline-flex', flexShrink: 0 }}
            >
              <Dropdown.Float
                open={filterMenuOpen}
                onOpenChange={setFilterMenuOpen}
                placement="bottom-start"
                trigger={
                  <Button variant="secondary" size="sm" rightIcon={<ArrowDownOneIcon size={16} />}>
                    {FILTER_LABEL[filter]}
                  </Button>
                }
              >
                <Dropdown size="md">
                  <Dropdown.Section fluid>
                    {(Object.keys(FILTER_LABEL) as AgentFilter[]).map(f => (
                      <Dropdown.Item
                        key={f}
                        label={FILTER_LABEL[f]}
                        selected={f === filter}
                        onClick={() => {
                          setFilter(f)
                          setFilterMenuOpen(false)
                          toast.info(`Showing ${FILTER_LABEL[f]}`)
                        }}
                        fluid
                      />
                    ))}
                  </Dropdown.Section>
                </Dropdown>
              </Dropdown.Float>
            </m.div>
          )}
        </AnimatePresence>

        {/* Search - icon button that expands into an inline input, same
            toggle behaviour as PinboardHeader's search. */}
        <div style={{ display: 'flex', alignItems: 'center', flex: isSearchOpen ? '1 0 0' : undefined, minWidth: 0, justifyContent: 'flex-end' }}>
          <AnimatePresence initial={false} mode="popLayout">
            {!isSearchOpen ? (
              <m.span
                key="search-btn"
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                style={{ display: 'inline-flex', flexShrink: 0 }}
              >
                <Tooltip content="Search">
                  <IconButton
                    variant="ghost"
                    size="sm"
                    icon={<SearchOneIcon size={20} />}
                    aria-label="Search agents"
                    onClick={() => setIsSearchOpen(true)}
                  />
                </Tooltip>
              </m.span>
            ) : (
              <m.div
                key="search-input"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                style={{ flex: '1 0 0', minWidth: 0 }}
              >
                <InputField
                  label="Search agents"
                  showLabel={false}
                  leftIcon={<SearchOneIcon size={16} />}
                  rightIcon={
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="Close search"
                      onClick={closeSearch}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && closeSearch()}
                      className="kds-icon-in-field"
                      style={{ display: 'inline-flex', cursor: 'pointer', lineHeight: 0 }}
                    >
                      <CancelCircleIcon size={16} />
                    </span>
                  }
                  placeholder="Search your agents…"
                  value={search}
                  onChange={setSearch}
                  fluid
                  // eslint-disable-next-line jsx-a11y/no-autofocus -- focus moves into search on user-triggered open
                  autoFocus
                  aria-label="Search agents"
                />
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Scrollable middle region - flex-grows to fill whatever space the
          header + footer don't use, so the footer always sits at the true
          bottom of the panel (short lists included), and only this region
          scrolls once the list overflows. Ditto Pinboard's own pin-list /
          bottom-toolbar split. position:relative + the two edge-fade overlays
          below are siblings of the actual scrolling div so they stay pinned
          to the viewport instead of scrolling away with the list. */}
      <div style={{ position: 'relative', flex: '1 1 0', minHeight: 0, marginTop: 12 }}>
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="kaya-scrollbar"
          style={{ position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden', padding: 3 }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loading ? (
              <p style={{ margin: 0, padding: '8px 10px', fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-body)', color: 'var(--neutral-500)' }}>
                Loading…
              </p>
            ) : filtered.length > 0 ? (
              filtered.map(p => (
                <PersonaCard
                  key={p.id}
                  variant="default"
                  name={p.name}
                  handle={p.handle}
                  avatarUrl={p.imageUrl ?? undefined}
                  avatarSeed={p.id}
                  visibility={p.visibility}
                  superlink={isSuperlink(p)}
                  onUseInChat={() => handleSelect(p)}
                  style={{ width: '100%' }}
                />
              ))
            ) : (
              <p style={{ margin: 0, padding: '8px 10px', fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-body)', color: 'var(--neutral-500)' }}>
                {search ? `No agents matching "${search}"` : 'No agents in this filter'}
              </p>
            )}
          </div>
        </div>

        {/* Top edge fade - progressive blur (behind) + colour fade (in front),
            same treatment as Pinboard's top/bottom overlays. */}
        <div
          aria-hidden
          style={{
            position:             'absolute',
            top:                  0,
            left:                 0,
            right:                0,
            height:               40,
            backdropFilter:       'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            maskImage:            'linear-gradient(to bottom, black 0%, transparent 100%)',
            WebkitMaskImage:      'linear-gradient(to bottom, black 0%, transparent 100%)',
            pointerEvents:        'none',
            zIndex:               1,
            opacity:              atTop ? 0 : 1,
            transition:           'opacity 150ms ease',
          }}
        />
        <div
          aria-hidden
          style={{
            position:      'absolute',
            top:           0,
            left:          0,
            right:         0,
            height:        40,
            background:    'linear-gradient(to bottom, var(--neutral-50) 0%, transparent 100%)',
            pointerEvents: 'none',
            zIndex:        1,
            opacity:       atTop ? 0 : 1,
            transition:    'opacity 150ms ease',
          }}
        />

        {/* Bottom edge fade - same treatment, hidden when scrolled to the end. */}
        <div
          aria-hidden
          style={{
            position:             'absolute',
            bottom:               0,
            left:                 0,
            right:                0,
            height:               40,
            backdropFilter:       'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            maskImage:            'linear-gradient(to top, black 0%, transparent 100%)',
            WebkitMaskImage:      'linear-gradient(to top, black 0%, transparent 100%)',
            pointerEvents:        'none',
            zIndex:               1,
            opacity:              atBottom ? 0 : 1,
            transition:           'opacity 150ms ease',
          }}
        />
        <div
          aria-hidden
          style={{
            position:      'absolute',
            bottom:        0,
            left:          0,
            right:         0,
            height:        40,
            background:    'linear-gradient(to top, var(--neutral-50) 0%, transparent 100%)',
            pointerEvents: 'none',
            zIndex:        1,
            opacity:       atBottom ? 0 : 1,
            transition:    'opacity 150ms ease',
          }}
        />
      </div>

      {/* Footer - Create New + Manage Agents, ditto Pinboard's Export /
          Organize bottom toolbar: no divider, always at the panel's bottom
          regardless of list length (the scroll region above absorbs any
          extra space when the list is short). */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', paddingTop: 12, flexShrink: 0 }}>
        <Button
          variant="ghost"
          size="md"
          fluid
          leftIcon={<PlusSignIcon size={16} />}
          onClick={handleCreateNew}
        >
          Create New
        </Button>
        <Button
          variant="secondary"
          size="md"
          fluid
          leftIcon={<UserAiIcon size={16} />}
          onClick={handleManageAgents}
        >
          Manage Agents
        </Button>
      </div>
    </div>
  )
}
