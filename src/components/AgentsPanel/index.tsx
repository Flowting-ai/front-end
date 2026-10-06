'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AnimatePresence, m } from 'framer-motion'
import { SearchOneIcon, CancelCircleIcon, ArrowDownOneIcon, ArrowLeftOneIcon, UserAiIcon, PlusSignIcon } from '@strange-huge/icons'
import { InputField } from '@/components/InputField'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { Tooltip } from '@/components/Tooltip'
import { Dropdown } from '@/components/Dropdown'
import { CompactAgentCard } from './CompactAgentCard'
import { TemplateCardList } from '@/components/chat/TemplateCardList'
import { AgentDetailsBody } from '@/components/AgentEditor/AgentDetailsSidebar'
import { useSelectableChatPersonas } from '@/hooks/use-selectable-chat-personas'
import { listShares } from '@/lib/api/persona-shares'
import { useProjectPanel } from '@/context/project-panel-context'
import { AGENTS_ROUTE, AGENTS_NEW_ROUTE } from '@/lib/routes'
import type { SelectedPersonaInfo } from '@/lib/chat-personas'
import { fetchModelsWithCache } from '@/lib/ai-models'
import { buildModelBlockedMap, modelUnavailableReason } from '@/lib/agent-model-health'
import { agentFixModelHref } from '@/lib/notifications/build'
import { useDevNotificationsVersion } from '@/lib/notifications/dev'

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

/** Breathing room (px) around the panel's clipped content for button shadows and focus rings. */
const EDGE = 8

type AgentFilter = 'mine' | 'team' | 'superlink'

const FILTER_LABEL: Record<AgentFilter, string> = {
  mine:      'My Agents',
  team:      'Team Agents',
  superlink: 'Superlink Agents',
}

// "Team Agents" hidden from the selectable dropdown along with the rest of
// the shared-agent UI — `AgentFilter`/`FILTER_LABEL.team`/byFilter's 'team'
// branch below stay intact so this can be re-shown without rebuilding it.
const VISIBLE_FILTERS: AgentFilter[] = ['mine', 'superlink']

// Loading placeholder shaped like a CompactAgentCard (a colour tile, the name and one description
// line, and the pill) so the list doesn't jump when real cards swap in. Uses the shared
// .kaya-skeleton pulse utility (globals.css).
function PersonaCardSkeleton() {
  return (
    <div
      aria-hidden
      style={{
        width: '100%', boxSizing: 'border-box', padding: 8, borderRadius: 16, display: 'flex', alignItems: 'center', gap: 10,
        backgroundColor: 'var(--neutral-white)',
        boxShadow: '0px 1px 2px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-100)',
      }}
    >
      <div className="kaya-skeleton" style={{ width: 52, height: 52, borderRadius: 12, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div className="kaya-skeleton" style={{ height: 13, width: '50%', borderRadius: 6 }} />
        <div className="kaya-skeleton" style={{ height: 11, width: '80%', borderRadius: 6 }} />
      </div>
      <div className="kaya-skeleton" style={{ height: 28, width: 80, borderRadius: 14, flexShrink: 0 }} />
    </div>
  )
}

/** Quick-add-an-agent-to-this-chat panel — same list this app already shows
 *  in the chat input's "Add agent" submenu (useSelectableChatPersonas), just
 *  surfaced as a full Pinboard-style side panel instead of a dropdown. */
export function AgentsPanelContent({ inProject = false }: { inProject?: boolean } = {}) {
  const [search, setSearch] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [filter, setFilter] = useState<AgentFilter>('mine')
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  // The agent whose details are showing (slides in over the list); null = the list.
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const { personas, loading } = useSelectableChatPersonas(true)
  const { setPanel } = useProjectPanel()
  const router = useRouter()

  function closeSearch() {
    setIsSearchOpen(false)
    setSearch('')
  }

  // Active-link Super Link ids, keyed by persona repo id — shares are
  // repo-scoped (a later publish moves an existing link with it), same as
  // agents/page.tsx's activeShareRepoIds.
  const [activeSuperlinkRepoIds, setActiveSuperlinkRepoIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    listShares()
      .then(shares => {
        if (cancelled) return
        const ids = shares
          .filter(share => share.is_active && share.share_type === 'link')
          .map(share => share.persona_repo_id)
        setActiveSuperlinkRepoIds(new Set(ids))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const isSuperlink = (p: SelectedPersonaInfo) => activeSuperlinkRepoIds.has(p.id)

  // Full model catalog (blocked models included) so an agent whose model was
  // retired or turned off fades out here exactly as its card does on /agents.
  // Empty until loaded, which modelUnavailableReason treats as "all fine".
  const [modelBlockedMap, setModelBlockedMap] = useState<Map<string, boolean>>(() => new Map())
  useEffect(() => {
    let cancelled = false
    fetchModelsWithCache()
      .then(models => { if (!cancelled) setModelBlockedMap(buildModelBlockedMap(models)) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])
  // Dev builds only: re-render when the notifications playground simulates
  // a model outage. Always 0 in production.
  useDevNotificationsVersion()

  const byFilter = useMemo(() => {
    if (filter === 'team') return personas.filter(p => p.visibility === 'team')
    if (filter === 'superlink') return personas.filter(isSuperlink)
    return personas.filter(p => p.ownedByViewer)
  }, [personas, filter, activeSuperlinkRepoIds])

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
    toast.success(inProject ? `Using “${persona.name}” in this project chat` : `Using “${persona.name}” in this chat`)
  }

  const handleManageAgents = () => {
    setPanel(null)
    router.push(AGENTS_ROUTE)
  }

  const handleCreateNew = () => {
    setPanel(null)
    router.push(AGENTS_NEW_ROUTE)
  }

  // Same destination as the sidebar bell's "needs attention" row: /agents
  // opens the Change model modal for this agent.
  const handleFixModel = (persona: SelectedPersonaInfo) => {
    setPanel(null)
    router.push(agentFixModelHref(persona.id))
  }

  const listView = (
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
                <Dropdown size="md" maxHeight={false}>
                  <Dropdown.Section fluid>
                    {VISIBLE_FILTERS.map(f => (
                      <Dropdown.Item
                        key={f}
                        label={FILTER_LABEL[f]}
                        selected={f === filter}
                        onClick={() => {
                          setFilter(f)
                          setFilterMenuOpen(false)
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
              Array.from({ length: 3 }).map((_, i) => <PersonaCardSkeleton key={i} />)
            ) : filtered.length > 0 ? (
              <TemplateCardList>
                {filtered.map(p => (
                  <CompactAgentCard
                    key={p.id}
                    agent={p}
                    superlink={isSuperlink(p)}
                    useLabel={inProject ? 'Use agent in project' : 'Use agent'}
                    onOpen={() => setDetailsId(p.id)}
                    onUse={() => handleSelect(p)}
                    modelUnavailable={modelUnavailableReason(p.modelId, modelBlockedMap)}
                    onFixModel={() => handleFixModel(p)}
                  />
                ))}
              </TemplateCardList>
            ) : search ? (
              <p style={{ margin: 0, padding: '8px 10px', fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-body)', color: 'var(--neutral-500)' }}>
                No agents matching &quot;{search}&quot;
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '32px 16px', textAlign: 'center' }}>
                <div
                  aria-hidden
                  style={{
                    width: 48, height: 48, borderRadius: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'var(--neutral-100)',
                  }}
                >
                  <UserAiIcon size={22} color="var(--neutral-400)" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <p style={{ margin: 0, fontFamily: 'var(--font-title)', fontWeight: 'var(--font-weight-regular)', fontSize: 16, lineHeight: '22px', color: 'var(--neutral-700)' }}>
                    No agents yet
                  </p>
                  <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', lineHeight: 'var(--line-height-caption)', color: 'var(--neutral-500)' }}>
                    {filter === 'team'
                      ? 'No agents have been shared with your team yet.'
                      : filter === 'superlink'
                        ? "None of your agents have an active Superlink yet."
                        : 'Create an agent to use it in this chat.'}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<PlusSignIcon size={16} />}
                  onClick={handleCreateNew}
                >
                  Create new agent
                </Button>
              </div>
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

  const detailsAgent = detailsId ? personas.find(p => p.id === detailsId) : undefined

  return (
    // overflow:hidden is needed to clip the sliding layers, but it also clips the buttons' own
    // shadows / focus rings at the edges. So the clip box is grown by EDGE px on every side
    // (negative margin) and the content gets the same padding back — nothing moves, nothing is cut.
    <div style={{ position: 'relative', height: `calc(100% + ${EDGE * 2}px)`, margin: -EDGE, overflow: 'hidden' }}>
      {/* The list stays mounted underneath (keeps its search / filter / scroll) and drifts
          left while the details slide in from the right. */}
      <m.div
        animate={{ x: detailsId ? -32 : 0, opacity: detailsId ? 0 : 1 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        style={{ height: '100%', boxSizing: 'border-box', padding: EDGE, pointerEvents: detailsId ? 'none' : undefined }}
        aria-hidden={detailsId ? true : undefined}
      >
        {listView}
      </m.div>

      <AnimatePresence initial={false}>
        {detailsId && (
          <m.div
            key="agent-details"
            initial={{ x: '100%', opacity: 0.4 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.4 }}
            transition={{ type: 'spring', stiffness: 340, damping: 36 }}
            style={{ position: 'absolute', inset: 0, boxSizing: 'border-box', padding: EDGE, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--neutral-50)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, paddingBottom: 12 }}>
              <Tooltip content="Back to agents">
                <IconButton variant="ghost" size="sm" icon={<ArrowLeftOneIcon size={20} />} aria-label="Back to agents" onClick={() => setDetailsId(null)} />
              </Tooltip>
              <p style={{ margin: 0, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 20, lineHeight: '28px', color: 'var(--neutral-700)' }}>
                {detailsAgent?.name ?? 'Agent details'}
              </p>
            </div>
            <div className="kaya-scrollbar" style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: 3 }}>
              <AgentDetailsBody
                key={detailsId}
                repoId={detailsId}
                canEdit={detailsAgent ? detailsAgent.ownedByViewer : false}
                onClose={() => setDetailsId(null)}
              />
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}
