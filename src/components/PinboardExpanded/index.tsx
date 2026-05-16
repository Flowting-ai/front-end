'use client'

import React, { useRef, useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DashboardSquareOneIcon,
  ShapesOneIcon,
  FolderAddIcon,
  FolderOneIcon,
  FolderLibraryIcon,
  DeleteTwoIcon,
  CancelOneIcon,
  CancelCircleIcon,
  SearchOneIcon,
  DownloadThreeIcon,
  FilterMailIcon,
  ArrowUpDownIcon,
  UnfoldLessIcon,
  // Same tab roster + icons as ModelSelector - kept identical so the two
  // components stay visually consistent across the app.
  TextIcon,
  SourceCodeSquareIcon,
  AiVisionRecognitionIcon,
  ImageTwoIcon,
  AudioWaveOneIcon,
  GlobalSearchIcon,
} from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { Badge } from '@/components/Badge'
import { Pin, type PinProps, type PinLabel } from '@/components/Pin'
import type { BadgeColor } from '@/components/Badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/Tabs'
import { Tooltip } from '@/components/Tooltip'
import { Dropdown } from '@/components/Dropdown'
import { SidebarMenuItem } from '@/components/SidebarMenuItem'
import { InputField } from '@/components/InputField'
import { EnterChunk, PINBOARD_EXPANDED_ENTER_DEFAULT, type PinboardEnterAnimation } from '@/components/Pinboard/enterAnimation'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PinboardExpandedPin extends Omit<PinProps, 'fluid'> {
  id: string
}

export interface PinboardExpandedFolder {
  id:    string
  label: string
}

export interface PinboardExpandedProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSelect' | 'title'> {
  pins?:           PinboardExpandedPin[]
  title?:          string
  pinCount?:       number
  updatedLabel?:   string
  personalFolders?: PinboardExpandedFolder[]
  projectFolders?:  PinboardExpandedFolder[]
  activeSidebarId?: string
  activeTab?:       string
  onClose?:         () => void
  onOrganize?:      () => void
  onCollapseAll?:   () => void
  onSearchClick?:   () => void
  onExportClick?:   () => void
  onFilterClick?:   () => void
  onSortClick?:     () => void
  /**
   * First-paint stagger config - controls how the sidebar, header, tabs/cluster
   * row, and each pin-row in the grid fade in on mount. Defaults to
   * `PINBOARD_EXPANDED_ENTER_DEFAULT`. Pass `{ enabled: false }` to disable.
   */
  enterAnimation?:  PinboardEnterAnimation
  /**
   * Per-pin user-added tags, keyed by pin id. Lifted from Pinboard so the
   * tags survive the compact ↔ expanded transition. Pin instances inside
   * this view are rendered with `userTags={userTagsById[id] ?? []}` and
   * `onAddTag` routed back through `onPinAddTag`.
   */
  userTagsById?:    Record<string, PinLabel[]>
  /**
   * Per-pin set of original-array indices deleted from `labels`. Same lifting
   * rationale as `userTagsById`. Threaded into Pin's `deletedLabelIndices`
   * controlled prop.
   */
  deletedLabelsById?: Record<string, Set<number>>
  /** Forwards to Pin's `onAddTag`. Receives the pin id as the first arg. */
  onPinAddTag?:     (pinId: string, text: string, color: BadgeColor) => void
  /** Forwards to Pin's `onDeleteTag`. Receives the pin id as the first arg. */
  onPinDeleteTag?:  (pinId: string, index: number, source: 'label' | 'user') => void
  /**
   * Pre-rendered active-filter chip bar (Figma 2603:16332). When present,
   * mounts between the Tabs strip and the pin grid. State lives in the
   * parent `Pinboard` so toggles in compact persist into expanded and back.
   * Pass `null` / omit to suppress the bar.
   */
  filterBar?:       React.ReactNode
  /**
   * `true` whenever any filter group has a selection. Drives the empty-
   * state copy: when `pins.length === 0 && hasActiveFilters`, the grid is
   * replaced with "No pin match" centred copy instead of an empty grid.
   */
  hasActiveFilters?: boolean
  /**
   * Pre-rendered Filter dropdown contents. Pinboard owns the dropdown's
   * data + selection state and threads the menu node here so the same
   * `Tags / Category / Content type` submenus mount in the expanded
   * variant. Pass `null` to opt out and revert to the bare-button +
   * `onFilterClick` callback.
   */
  filterMenu?:      React.ReactNode | null
  /**
   * Pre-rendered Sort dropdown contents. Same threading rationale as
   * `filterMenu`. Pass `null` to revert to the bare-button + `onSortClick`
   * callback.
   */
  sortMenu?:        React.ReactNode | null
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_PINS: PinboardExpandedPin[] = Array.from({ length: 24 }, (_, i) => ({
  id: `expanded-pin-${i}`,
}))

const DEFAULT_PERSONAL_FOLDERS: PinboardExpandedFolder[] = [
  { id: 'personal-1', label: 'Personal 1' },
  { id: 'personal-2', label: 'Personal 2' },
  { id: 'personal-3', label: 'Personal 3' },
]

const DEFAULT_PROJECT_FOLDERS: PinboardExpandedFolder[] = [
  { id: 'project-a', label: 'Project A' },
  { id: 'project-c', label: 'Project C' },
  { id: 'project-b', label: 'Project B' },
]

// Pin filter tabs - Pinboard's own taxonomy (independent of ModelSelector).
const CATEGORY_TABS = [
  { value: 'text',   label: 'Text',   icon: <TextIcon                size={16} /> },
  { value: 'code',   label: 'Code',   icon: <SourceCodeSquareIcon    size={16} /> },
  { value: 'vision', label: 'Vision', icon: <AiVisionRecognitionIcon size={16} /> },
  { value: 'image',  label: 'Image',  icon: <ImageTwoIcon            size={16} /> },
  { value: 'audio',  label: 'Audio',  icon: <AudioWaveOneIcon        size={16} /> },
  { value: 'search', label: 'Search', icon: <GlobalSearchIcon        size={16} /> },
]

// ── Sidebar section header ────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '5px 6px',
        borderRadius:   10,
        width:          '100%',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 500,
          fontSize:   11,
          lineHeight: '16px',
          color:      'var(--neutral-500)',
          whiteSpace: 'nowrap',
        }}
      >
        {children}
      </span>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export const PinboardExpanded = React.forwardRef<HTMLDivElement, PinboardExpandedProps>(
  function PinboardExpanded(
    {
      pins             = DEFAULT_PINS,
      title            = 'All pins',
      pinCount         = 32,
      updatedLabel     = 'Updated 1 hour ago',
      personalFolders  = DEFAULT_PERSONAL_FOLDERS,
      projectFolders   = DEFAULT_PROJECT_FOLDERS,
      activeSidebarId  = 'all-pins',
      activeTab        = 'text',
      onClose,
      onOrganize,
      onCollapseAll,
      onSearchClick,
      onExportClick,
      onFilterClick,
      filterBar,
      hasActiveFilters = false,
      filterMenu,
      sortMenu,
      onSortClick,
      enterAnimation = PINBOARD_EXPANDED_ENTER_DEFAULT,
      userTagsById,
      deletedLabelsById,
      onPinAddTag,
      onPinDeleteTag,
      style,
      className,
      ...props
    },
    ref,
  ) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const [atTop, setAtTop]       = useState(true)
    const [atBottom, setAtBottom] = useState(false)
    const [searchOpen, setSearchOpen] = useState(false)
    const [searchValue, setSearchValue] = useState('')

    // NOTE: cluster siblings (search slot, Export, Filter, Sort) carry
    // `layout` so they slide via Framer's projection system when
    // collapse-all enters/exits or when the search slot opens/closes.
    // The Tabs strip wrapper animates `width` directly (not `layout`) so
    // its inner pills aren't transform-squeezed during the shrink. The
    // earlier "no layout in this subtree" rule was tied to the
    // compact↔expanded `transform: scale()` morph, which has been
    // replaced with the portal modal's enter/exit zoom - that zoom
    // settles before any pin interaction can flip `hasExpanded`, so
    // layout projection here is safe again.

    // Tabs strip ref - declared here, the effect that drives auto-scroll is
    // defined below `hasExpanded` so it can depend on both signals.
    const tabsContainerRef = useRef<HTMLDivElement>(null)
    const [collapseSignal, setCollapseSignal] = useState(0)
    const [expandedIds, setExpandedIds]       = useState<Set<string>>(() => new Set())
    // Open state for the Filter / Sort dropdowns. Mirrors the compact
    // `Pinboard`'s wiring so the same `Tags / Category / Content type`
    // submenus and Sort options surface in this variant.
    const [filterMenuOpen, setFilterMenuOpen] = useState(false)
    const [sortMenuOpen,   setSortMenuOpen]   = useState(false)
    const [moveToFolderOpen, setMoveToFolderOpen] = useState(false)

    // ── Organize mode (Figma 3457:24212) ───────────────────────────────────
    // Click "Organise" → enter Organize mode: tabs + secondary actions row
    // crossfades to a Move/Export/Delete + Done action bar, all pins switch
    // to selectable. Click "Done" → exit. Selected pin ids tracked locally.
    const [isOrganizing,   setIsOrganizing]   = useState(false)
    const [selectedPinIds, setSelectedPinIds] = useState<Set<string>>(() => new Set())
    const handleOrganizeStart = () => {
      setIsOrganizing(true)
      onOrganize?.()
    }
    const handleOrganizeDone = () => {
      setIsOrganizing(false)
      setSelectedPinIds(new Set())
    }
    const togglePinSelected = (id: string, next: boolean) => {
      setSelectedPinIds((prev) => {
        const out = new Set(prev)
        if (next) out.add(id); else out.delete(id)
        return out
      })
    }
    const hasExpanded = expandedIds.size > 0

    // Scroll the active tab into view whenever the Tabs wrapper width changes
    // (i.e. when search opens/closes, or when the cluster grows because
    // collapse-all entered). Without this the scrollLeft is technically
    // preserved, but because the visible viewport shrinks/grows the active
    // tab can fall out of view.
    //
    // We DON'T use `Element.scrollIntoView` here - it walks every scrolling
    // ancestor up to the document, which means a docs page hosting multiple
    // Pinboard stories visibly scrolled the whole page on mount whenever the
    // active tab landed below the fold. Compute the offset against the strip
    // and scroll the strip directly so the side-effect is fully contained.
    useEffect(() => {
      const root = tabsContainerRef.current
      if (!root) return
      // The actual horizontally-scrolling element is the TabsList (rendered
      // inside the Tabs root). We find it via the closest scrollable ancestor
      // of the active tab within `root`.
      const active = root.querySelector<HTMLElement>('[data-state="active"]')
      if (!active) return
      let strip: HTMLElement | null = active.parentElement
      while (strip && strip !== root && strip.scrollWidth <= strip.clientWidth) {
        strip = strip.parentElement
      }
      if (!strip || strip === root.parentElement) strip = root
      const stripRect = strip.getBoundingClientRect()
      const tabRect   = active.getBoundingClientRect()
      const overflowLeft  = stripRect.left  - tabRect.left
      const overflowRight = tabRect.right   - stripRect.right
      if (overflowLeft <= 0 && overflowRight <= 0) return
      const target = overflowLeft > 0
        ? strip.scrollLeft - overflowLeft
        : strip.scrollLeft + overflowRight
      strip.scrollTo({ left: target, behavior: 'smooth' })
    }, [searchOpen, hasExpanded])

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget
      setAtTop(el.scrollTop < 8)
      setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 8)
    }

    // ── Width animation - direct (NOT via transform) ──
    //
    // When the search button is clicked the search slot in the cluster
    // expands to **276px** (the same width the compact PinboardHeader's
    // search wrapper takes - `316 header - 32 close - 8 gap`). The slot is
    // right-anchored within the cluster, so it grows LEFTWARD; Export,
    // Filter and Sort stay put. The Tabs strip wrapper shrinks by the same
    // amount, animated via `motion.div animate.width` so its descendants
    // aren't scaled.
    const CVW_WIDTH          = 644
    const ICON_BUTTON_W      = 32
    const ICON_BUTTON_GAP    = 4
    const ROW_GAP            = 32
    const SEARCH_OPEN_WIDTH  = 276
    const buttonCount        = hasExpanded ? 5 : 4
    const baseClusterWidth   = buttonCount * ICON_BUTTON_W + (buttonCount - 1) * ICON_BUTTON_GAP
    const clusterWidth       = searchOpen
      ? baseClusterWidth + (SEARCH_OPEN_WIDTH - ICON_BUTTON_W)
      : baseClusterWidth
    const tabsAreaWidth      = CVW_WIDTH - ROW_GAP - clusterWidth
    const searchSlotWidth    = searchOpen ? SEARCH_OPEN_WIDTH : ICON_BUTTON_W

    // Recompute atTop / atBottom whenever the scroll container OR its content
    // changes size - same fix as compact Pinboard. Prevents the bottom edge
    // fade from being absent on first paint when content lays out late
    // (staggered enter, async font/icon load).
    useEffect(() => {
      const el = scrollRef.current
      if (!el) return
      const update = () => {
        setAtTop(el.scrollTop < 8)
        setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 8)
      }
      update()
      const ro = new ResizeObserver(update)
      ro.observe(el)
      const inner = el.firstElementChild
      if (inner instanceof Element) ro.observe(inner)
      return () => ro.disconnect()
    }, [pins.length])

    const handleCollapseAll = () => {
      setCollapseSignal((s) => s + 1)
      onCollapseAll?.()
    }

    const handlePinExpandedChange = useCallback(
      (id: string) => (expanded: boolean) => {
        setExpandedIds((prev) => {
          const has = prev.has(id)
          if (expanded === has) return prev
          const next = new Set(prev)
          if (expanded) next.add(id)
          else next.delete(id)
          return next
        })
      },
      [],
    )

    return (
      <div
        ref={ref}
        className={cn(className)}
        style={{
          // Outer pinboard - matches Figma node 2603:15826 exactly:
          //   bg neutral-50, flex row, items-center, overflow-clip,
          //   px-8, rounded-28 (set on parent motion.div), shadow set on parent.
          display:        'flex',
          alignItems:     'center',
          width:          '100%',
          height:         '100%',
          padding:        '0 8px',
          background:     'var(--neutral-50)',
          borderRadius:   'inherit',
          isolation:      'isolate',
          overflow:       'hidden',
          ...style,
        }}
        {...props}
      >
        {/* ── Sidebar Container - Figma 2565:32601 ──
            Wrapped in <EnterChunk index={0}> so it staggers in as the first
            chunk on first paint. ── */}
        <EnterChunk
          cfg={enterAnimation}
          index={0}
          style={{
            display:        'flex',
            flexDirection:  'column',
            height:         '100%',
            padding:        '8px 0',
            flexShrink:     0,
            zIndex:         2,
            background:     'var(--neutral-50)',
          }}
        >
          {/* Sidebar Wrapper - Figma 2565:32602 */}
          <div
            style={{
              display:        'flex',
              alignItems:     'flex-start',
              flex:           '1 0 0',
              minHeight:      0,
              borderRadius:   20,
              background:     'var(--color-surface-glass)',
              boxShadow:      '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-200)',
              overflow:       'hidden',
            }}
          >
            {/* Sidebar inner - Figma 2565:35085 */}
            <div
              className="kaya-scrollbar"
              style={{
                display:             'flex',
                flexDirection:       'column',
                gap:                 4,
                height:              '100%',
                width:               240,
                padding:             '8px 0',
                overflowX:           'hidden',
                overflowY:           'auto',
                overscrollBehaviorY: 'contain',
                flexShrink:          0,
              }}
            >
              {/* Pinboard section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 8, width: '100%', overflow: 'hidden' }}>
                <SectionLabel>Pinboard</SectionLabel>
                <SidebarMenuItem
                  label="All pins"
                  icon={<DashboardSquareOneIcon size={20} />}
                  data-active={activeSidebarId === 'all-pins'}
                />
                <SidebarMenuItem
                  label="This chat pins"
                  icon={<ShapesOneIcon size={20} />}
                  data-active={activeSidebarId === 'this-chat'}
                />
              </div>

              {/* Your folders */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 8, width: '100%', overflow: 'hidden' }}>
                <SectionLabel>Your folders</SectionLabel>
                <SidebarMenuItem
                  label="New folder"
                  icon={<FolderAddIcon size={20} />}
                />
                {personalFolders.map((f) => (
                  <SidebarMenuItem
                    key={f.id}
                    label={f.label}
                    icon={<FolderOneIcon size={20} variant="static" animated />}
                    data-active={activeSidebarId === f.id}
                  />
                ))}
              </div>

              {/* Project folders */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 8, width: '100%', overflow: 'hidden' }}>
                <SectionLabel>Project folders</SectionLabel>
                {projectFolders.map((f) => (
                  <SidebarMenuItem
                    key={f.id}
                    label={f.label}
                    icon={<FolderOneIcon size={20} variant="static" animated />}
                    data-active={activeSidebarId === f.id}
                  />
                ))}
              </div>
            </div>
          </div>
        </EnterChunk>

        {/* ── Content Container - Figma 2565:34101 ──
            shrink-0 (hug), h-817, items-start, pt-[8px], z-[1].
            Width is determined by inner Content Wrapper which hugs the
            Pin Grid (2 × 314 + 8 gap = 636 + p-12 = 660). */}
        <div
          style={{
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'flex-start',
            flexShrink:     0,
            height:         '100%',
            paddingTop:     8,
            background:     'var(--neutral-50)',
            zIndex:         1,
          }}
        >
          {/* Content Wrapper - Figma 2565:34102. flex-[1_0_0] (fills column
              vertically), items-start, min-h-px, overflow-clip, p-12,
              rounded-20. Width hugs to Content Vertical Wrapper. */}
          <div
            style={{
              display:        'flex',
              alignItems:     'flex-start',
              flex:           '1 0 0',
              minHeight:      1,
              padding:        12,
              borderRadius:   20,
              overflow:       'hidden',
            }}
          >
            {/* Content Vertical Wrapper - Figma 2565:34103. shrink-0,
                items-start, h-788, gap-24. Width = Pin Grid 636 + 4 ring
                buffer + 4 scrollbar buffer = 644 so the Pin's 1px outer
                ring isn't clipped on top/left/right AND the 3px
                kaya-scrollbar overlays only the rightmost few pixels. */}
            <div
              style={{
                display:        'flex',
                flexDirection:  'column',
                alignItems:     'flex-start',
                gap:            24,
                flexShrink:     0,
                width:          644,
                height:         '100%',
              }}
            >
              {/* ── Header - Figma 2565:34104 ──
                  EnterChunk index={1} - staggers in after the sidebar. ── */}
              <EnterChunk
                cfg={enterAnimation}
                index={1}
                style={{
                  display:    'flex',
                  gap:        8,
                  alignItems: 'flex-start',
                  width:      '100%',
                  flexShrink: 0,
                }}
              >
                {/* Pins Info - Figma 2565:34105 */}
                <div
                  style={{
                    display:        'flex',
                    flex:           '1 0 0',
                    flexDirection:  'column',
                    gap:            8,
                    alignItems:     'flex-start',
                    justifyContent: 'center',
                    minWidth:       1,
                  }}
                >
                  {/* Title - Figma 2579:35173. pl-[4px], font Besley regular 24/32 */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', paddingLeft: 4, width: '100%' }}>
                    <p
                      style={{
                        flex:         '1 0 0',
                        minWidth:     1,
                        margin:       0,
                        fontFamily:   'var(--font-title)',
                        fontWeight:   400,
                        fontSize:     24,
                        lineHeight:   '32px',
                        color:        'var(--neutral-900)',
                        whiteSpace:   'nowrap',
                        overflow:     'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {title}
                    </p>
                  </div>
                  {/* Pin count + update info - Figma 2579:35146 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                    <Badge color="Neutral" label={`${pinCount} pins`} />
                    <Badge color="Neutral" label={updatedLabel} />
                  </div>
                </div>

                {/* Actions - Figma 2565:34109. gap-[12px] between Organise and Close.
                    Organise button fades out when isOrganizing - the Done button
                    inside the action row replaces it functionally. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <AnimatePresence initial={false} mode="popLayout">
                    {!isOrganizing && (
                      <motion.span
                        key="organise-btn"
                        initial={{ opacity: 0, scale: 0.85, filter: 'blur(4px)' }}
                        animate={{ opacity: 1, scale: 1,    filter: 'blur(0px)' }}
                        exit={{    opacity: 0, scale: 0.85, filter: 'blur(4px)' }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        style={{ display: 'inline-flex' }}
                      >
                        <Button
                          variant="default"
                          size="sm"
                          leftIcon={<FolderLibraryIcon size={16} />}
                          onClick={handleOrganizeStart}
                        >
                          Organise
                        </Button>
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <Tooltip content="Close">
                    <IconButton
                      variant="ghost"
                      size="sm"
                      icon={<CancelOneIcon size={20} />}
                      aria-label="Close expanded pinboard"
                      onClick={onClose}
                    />
                  </Tooltip>
                </div>
              </EnterChunk>

              {/* ── Pin Cards Container - Figma 2579:35310 ── */}
              <div
                style={{
                  display:        'flex',
                  flexDirection:  'column',
                  gap:            12,
                  flex:           '1 0 0',
                  minHeight:      1,
                  width:          '100%',
                }}
              >
                {/* Tabs Container - Figma 2565:34112. gap-[100px] (constant,
                    so the wrapper width stays the same whether search is
                    open or not - matches compact PinboardHeader's search
                    width).
                    EnterChunk index={2} - staggers in after the header. */}
                <EnterChunk
                  cfg={enterAnimation}
                  index={2}
                  style={{
                    display:        'flex',
                    alignItems:     'center',
                    gap:            ROW_GAP,
                    width:          '100%',
                    flexShrink:     0,
                    position:       'relative',
                  }}
                >
                  {/* Tabs / secondary-actions row - fades out when isOrganizing.
                      Wrapped so the Organize action row (Move/Export/Delete +
                      Done) can crossfade into the same slot. KDS standard
                      preset: scale 0.95 + opacity + blur, spring 500/30. */}
                  <AnimatePresence initial={false} mode="popLayout">
                  {!isOrganizing && (
                  <motion.div
                    key="tabs-row"
                    initial={{ opacity: 0, scale: 0.97, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, scale: 1,    filter: 'blur(0px)' }}
                    exit={{    opacity: 0, scale: 0.97, filter: 'blur(4px)' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    style={{
                      display:    'flex',
                      alignItems: 'center',
                      gap:        ROW_GAP,
                      width:      '100%',
                      flexShrink: 0,
                    }}
                  >
                  {/* Tabs / Search input - Figma 2565:34113.
                      Width snaps via `style.width`; no projection - Tabs sits
                      at row-start and its position is invariant on every
                      toggle (`searchOpen`, `hasExpanded`). The visual softness
                      of the search-open transition is carried entirely by the
                      button↔input cross-fade inside the search slot, matching
                      compact `PinboardHeader`. */}
                  <div
                    ref={tabsContainerRef}
                    style={{
                      // Hug the Tabs content. Cap at `tabsAreaWidth` so the
                      // strip can scroll if it ever overflows the available
                      // row space, but at rest the wrapper sits at content
                      // width - no empty trailing area.
                      flex:       '0 0 auto',
                      minWidth:   1,
                      maxWidth:   tabsAreaWidth,
                      padding:    '1px 0 1px 1px',
                      overflow:   'hidden',
                      width:      'fit-content',
                    }}
                  >
                    <Tabs defaultValue={activeTab}>
                      <TabsList size="small" scrollable>
                        {CATEGORY_TABS.map((t) => (
                          <TabsTrigger key={t.value} value={t.value} icon={t.icon}>
                            {t.label}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </Tabs>
                  </div>

                  {/* Secondary Actions - Figma 2565:34115. gap-[4px], 4 ghost
                      icon buttons at sm (32x32) with 20px icons.

                      Order: Search → Export → [collapse-all conditional] →
                      Filter → Sort.

                      Layout pattern: the cluster uses `justify-content:
                      flex-end` so it's right-anchored. Each wrapper is a
                      `motion.span/div layout` - when collapse-all enters
                      or exits (`hasExpanded` toggles), Framer's projection
                      system slides the siblings to their new flex-flow
                      positions via a spring (stiffness 500, damping 32).
                      The Search-slot wrapper additionally carries
                      `layoutDependency={hasExpanded}` so the 32→276 px
                      width change on `searchOpen` toggle SNAPS via
                      `style.width` (not projected as a transform), matching
                      compact `PinboardHeader`'s flex-driven snap. Tabs to
                      the left snaps too - see plain `<div>` above. */}
                  <div
                    style={{
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'flex-end',
                      gap:            4,
                      flexShrink:     0,
                      marginLeft:     'auto',
                    }}
                  >
                    {/* Search slot - snaps from 32 px (button) to 276 px
                        (input) on `searchOpen` toggle (matches compact
                        PinboardHeader's flex-driven snap). The button↔input
                        cross-fade inside is what carries the visual
                        transition. Cluster reflow on collapse-all
                        (`hasExpanded` toggle) still slides via `layout`
                        projection at spring(500, 32) - gated by
                        `layoutDependency={hasExpanded}` so the search-width
                        change is invisible to the projection system and
                        does NOT animate as a transform. */}
                    <Tooltip content="Search" disabled={searchOpen}>
                      <motion.div
                        layout
                        layoutDependency={hasExpanded}
                        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                        style={{
                          display:     'flex',
                          alignItems:  'center',
                          flexShrink:  0,
                          minWidth:    0,
                          width:       searchSlotWidth,
                        }}
                      >
                        <AnimatePresence initial={false} mode="popLayout">
                          {!searchOpen ? (
                            <motion.span
                              key="search-btn"
                              layout
                              initial={{ opacity: 0, y: 4, filter: 'blur(4px)' }}
                              animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transition: { type: 'spring', duration: 0.3, bounce: 0 } }}
                              exit={{    opacity: 0, scale: 0.25, filter: 'blur(4px)', transition: { type: 'spring', duration: 0.2, bounce: 0 } }}
                              style={{ display: 'inline-flex', flexShrink: 0 }}
                            >
                              <IconButton
                                variant="ghost"
                                size="sm"
                                icon={<SearchOneIcon size={20} />}
                                aria-label="Open search"
                                onClick={() => {
                                  setSearchOpen(true)
                                  onSearchClick?.()
                                }}
                              />
                            </motion.span>
                          ) : (
                            <motion.div
                              key="search-input"
                              initial={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
                              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', transition: { type: 'spring', duration: 0.3, bounce: 0 } }}
                              exit={{    opacity: 0, scale: 0.95, filter: 'blur(4px)', transition: { duration: 0.15, ease: 'easeIn' } }}
                              style={{ flex: '1 0 0', minWidth: 0 }}
                            >
                              <InputField
                                fluid
                                size="small"
                                showLabel={false}
                                showSubtitle={false}
                                label="Search pins"
                                leftIcon={<SearchOneIcon size={16} />}
                                rightIcon={
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    aria-label="Close search"
                                    onClick={() => {
                                      setSearchOpen(false)
                                      setSearchValue('')
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        setSearchOpen(false)
                                        setSearchValue('')
                                      }
                                    }}
                                    style={{ display: 'inline-flex', cursor: 'pointer', lineHeight: 0 }}
                                  >
                                    <CancelCircleIcon size={16} />
                                  </span>
                                }
                                placeholder="Search for your pin..."
                                value={searchValue}
                                onChange={setSearchValue}
                                autoFocus
                                aria-label="Search pins"
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    </Tooltip>
                    <motion.div layout style={{ display: 'inline-flex' }} transition={{ type: 'spring', stiffness: 500, damping: 32 }}>
                      <Tooltip content="Export">
                        <IconButton
                          variant="ghost"
                          size="sm"
                          icon={<DownloadThreeIcon size={20} />}
                          aria-label="Export pins"
                          onClick={onExportClick}
                        />
                      </Tooltip>
                    </motion.div>
                    <AnimatePresence initial={false} mode="popLayout">
                      {hasExpanded && (
                        <motion.span
                          key="collapse-all"
                          initial={{ opacity: 0, scale: 0.6 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{    opacity: 0, scale: 0.6 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                          style={{ display: 'inline-flex' }}
                        >
                          <Tooltip content="Collapse all Pins">
                            <IconButton
                              variant="ghost"
                              size="sm"
                              icon={<UnfoldLessIcon size={20} />}
                              aria-label="Collapse open pins"
                              onClick={handleCollapseAll}
                            />
                          </Tooltip>
                        </motion.span>
                      )}
                    </AnimatePresence>
                    <motion.span layout style={{ display: 'inline-flex' }} transition={{ type: 'spring', stiffness: 500, damping: 32 }}>
                      {filterMenu != null ? (
                        // Filter dropdown - same content as the compact
                        // variant (Pinboard threads the menu down via the
                        // `filterMenu` prop). `bottom-end` so the panel
                        // opens below and right-aligns with the trigger.
                        <Dropdown.Float
                          open={filterMenuOpen}
                          onOpenChange={setFilterMenuOpen}
                          placement="bottom-end"
                          trigger={
                            <Tooltip content="Filter">
                              <IconButton
                                variant="ghost"
                                size="sm"
                                icon={<FilterMailIcon size={20} />}
                                aria-label="Filter pins"
                              />
                            </Tooltip>
                          }
                        >
                          {filterMenu}
                        </Dropdown.Float>
                      ) : (
                        <Tooltip content="Filter">
                          <IconButton
                            variant="ghost"
                            size="sm"
                            icon={<FilterMailIcon size={20} />}
                            aria-label="Filter pins"
                            onClick={onFilterClick}
                          />
                        </Tooltip>
                      )}
                    </motion.span>
                    <motion.span layout style={{ display: 'inline-flex' }} transition={{ type: 'spring', stiffness: 500, damping: 32 }}>
                      {sortMenu != null ? (
                        <Dropdown.Float
                          open={sortMenuOpen}
                          onOpenChange={setSortMenuOpen}
                          placement="bottom-end"
                          trigger={
                            <Tooltip content="Sort">
                              <IconButton
                                variant="ghost"
                                size="sm"
                                icon={<ArrowUpDownIcon size={20} />}
                                aria-label="Sort pins"
                              />
                            </Tooltip>
                          }
                        >
                          {sortMenu}
                        </Dropdown.Float>
                      ) : (
                        <Tooltip content="Sort">
                          <IconButton
                            variant="ghost"
                            size="sm"
                            icon={<ArrowUpDownIcon size={20} />}
                            aria-label="Sort pins"
                            onClick={onSortClick}
                          />
                        </Tooltip>
                      )}
                    </motion.span>
                  </div>
                  </motion.div>
                  )}

                  {/* Organize action row - fades in when isOrganizing.
                      Figma 3457:24212. Move to folder + Export + Delete on
                      the left, Done on the right. */}
                  {isOrganizing && (
                    <motion.div
                      key="organize-row"
                      initial={{ opacity: 0, scale: 0.97, filter: 'blur(4px)' }}
                      animate={{ opacity: 1, scale: 1,    filter: 'blur(0px)' }}
                      exit={{    opacity: 0, scale: 0.97, filter: 'blur(4px)' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      style={{
                        display:        'flex',
                        alignItems:     'center',
                        justifyContent: 'space-between',
                        width:          '100%',
                        flexShrink:     0,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Dropdown.Float
                          open={moveToFolderOpen}
                          onOpenChange={setMoveToFolderOpen}
                          placement="bottom-start"
                          trigger={
                            <Button
                              variant="secondary"
                              size="sm"
                              leftIcon={<FolderAddIcon size={16} />}
                              disabled={selectedPinIds.size === 0}
                            >
                              Move to folder
                            </Button>
                          }
                        >
                          {/* Same structure as ChatInput's Pin folders submenu
                              and Pinboard's view-filter Project folders section
                              - single source of truth via personalFolders /
                              projectFolders props. Folder icon is the
                              declared sidebar exception per CLAUDE.md. */}
                          <Dropdown size="md">
                            {personalFolders.length > 0 && (
                              <Dropdown.Section label="Your folders" fluid>
                                {personalFolders.map((f) => (
                                  <Dropdown.Item
                                    key={f.id}
                                    label={f.label}
                                    icon={<FolderOneIcon variant="static" animated />}
                                    onClick={() => setMoveToFolderOpen(false)}
                                    fluid
                                  />
                                ))}
                              </Dropdown.Section>
                            )}
                            {projectFolders.length > 0 && (
                              <Dropdown.Section label="Project folders" divider={personalFolders.length > 0} fluid>
                                {projectFolders.map((f) => (
                                  <Dropdown.Item
                                    key={f.id}
                                    label={f.label}
                                    icon={<FolderOneIcon variant="static" animated />}
                                    onClick={() => setMoveToFolderOpen(false)}
                                    fluid
                                  />
                                ))}
                              </Dropdown.Section>
                            )}
                          </Dropdown>
                        </Dropdown.Float>
                        <Button
                          variant="secondary"
                          size="sm"
                          leftIcon={<DownloadThreeIcon size={16} />}
                          disabled={selectedPinIds.size === 0}
                        >
                          Export
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          leftIcon={<DeleteTwoIcon size={16} />}
                          disabled={selectedPinIds.size === 0}
                        >
                          Delete
                        </Button>
                      </div>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleOrganizeDone}
                      >
                        Done
                      </Button>
                    </motion.div>
                  )}
                  </AnimatePresence>
                </EnterChunk>

                {/* ── Active-filter chip bar (Figma 2603:16332) ──
                    Pre-rendered by the parent Pinboard so state stays in
                    one place across the compact ↔ expanded morph.

                    Two animations stack here:
                    • First-paint cascade - `EnterChunk index={2.5}` slots
                      the bar between the Tabs row (index 2) and the first
                      pin pair (index 3) so it fades in (opacity + y + blur)
                      as part of the expanded variant's stagger when the
                      panel mounts with filters already active.
                    • Toggle on / off - the inner `AnimatePresence` runs
                      a height collapse + opacity fade when filters are
                      added or removed during a session. `initial={false}`
                      keeps the toggle from double-firing on first paint
                      (EnterChunk handles that). ── */}
                <EnterChunk cfg={enterAnimation} index={2.5} style={{ width: '100%' }}>
                  <AnimatePresence initial={false}>
                    {filterBar && hasActiveFilters && (
                      <motion.div
                        key="expanded-filter-bar"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{    height: 0, opacity: 0 }}
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        style={{ overflow: 'hidden', width: '100%' }}
                      >
                        {filterBar}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </EnterChunk>

                {/* ── Scrollable Pin Cards Grid - Figma 2565:34119 ──
                    Figma applies no overflow on the grid itself. The KDS
                    Scrollbar Styling Rule + Scroll Edge Fade pattern requires
                    a thin scrollbar and a top/bottom blur+colour fade on
                    every vertical scroll container, so we wrap the inline-
                    grid in a positioned viewport that:
                      • scrolls vertically (kaya-scrollbar)
                      • holds the four progressive blur strips + colour fade
                        at top and bottom (z-index 1)
                      • leaves 2px of inner padding so the Pin's 1px outer
                        ring isn't clipped on top/left/right.
                */}
                <div
                  style={{
                    position:   'relative',
                    flex:       '1 0 0',
                    minHeight:  1,
                    width:      '100%',
                  }}
                >
                  <div
                    ref={scrollRef}
                    tabIndex={-1}
                    className="kaya-scrollbar"
                    onScroll={handleScroll}
                    style={{
                      width:               '100%',
                      height:              '100%',
                      overflowY:           'auto',
                      overflowX:           'hidden',
                      overscrollBehaviorY: 'contain',
                      // 2px padding on every side for the Pin's 1px outer
                      // ring. The 3px webkit scrollbar overlays the right
                      // edge - no gutter is reserved, so layout dimensions
                      // stay exactly as specified in Figma.
                      padding:             '2px 2px 2px 2px',
                      outline:             'none',
                    }}
                  >
                    {/* Two-column masonry. CSS Grid keeps rows aligned, so
                        a short pin next to a tall one leaves dead space below
                        it until the tallest pin's row finishes. We instead
                        split pins by index parity into two flex-column lists
                        rendered side by side - each column packs vertically
                        and independently. Reading order stays row-major
                        (pin 0 → left, pin 1 → right, pin 2 → left, …) so the
                        list still scans the way users expect. */}
                    {pins.length === 0 && hasActiveFilters ? (
                      // Empty result - filters returned no pins. Mirrors the
                      // compact-variant empty state. Centered in the grid
                      // viewport so the message reads regardless of grid
                      // height.
                      <div
                        role="status"
                        aria-live="polite"
                        style={{
                          display:        'flex',
                          alignItems:     'center',
                          justifyContent: 'center',
                          width:          '100%',
                          padding:        '64px 8px',
                          fontFamily:     'var(--font-body)',
                          fontWeight:     'var(--font-weight-regular)',
                          fontSize:       'var(--font-size-body)',
                          lineHeight:     'var(--line-height-body)',
                          color:          'var(--neutral-600)',
                          textAlign:      'center',
                        }}
                      >
                        No pin match
                      </div>
                    ) : null}
                    <div
                      style={{
                        display:    pins.length === 0 && hasActiveFilters ? 'none' : 'flex',
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        gap:        8,
                      }}
                    >
                      {[0, 1].map((col) => (
                        <div
                          key={col}
                          style={{
                            display:       'flex',
                            flexDirection: 'column',
                            gap:           8,
                            flex:          '0 0 auto',
                          }}
                        >
                          {pins.map((p, originalIndex) => {
                            if (originalIndex % 2 !== col) return null
                            const { id, ...pinRest } = p
                            // Pair-row stagger: pins originalIndex 0 & 1 share
                            // chunk 3, originalIndex 2 & 3 share chunk 4, etc.
                            // Visual: each grid row lights up left-and-right
                            // together rather than column-by-column.
                            const chunkIndex = Math.floor(originalIndex / 2) + 3
                            return (
                              <EnterChunk key={id} cfg={enterAnimation} index={chunkIndex}>
                                <Pin
                                  collapseSignal={collapseSignal}
                                  onExpandedChange={handlePinExpandedChange(id)}
                                  tagsEditable
                                  userTags={userTagsById?.[id] ?? []}
                                  deletedLabelIndices={deletedLabelsById?.[id]}
                                  selectable={isOrganizing}
                                  selected={selectedPinIds.has(id)}
                                  onSelectedChange={(next) => togglePinSelected(id, next)}
                                  onAddTag={
                                    onPinAddTag
                                      ? (text, color) => onPinAddTag(id, text, color)
                                      : undefined
                                  }
                                  onDeleteTag={
                                    onPinDeleteTag
                                      ? (index, source) => onPinDeleteTag(id, index, source)
                                      : undefined
                                  }
                                  {...pinRest}
                                />
                              </EnterChunk>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Top edge fade - progressive blur + colour gradient,
                      shown only when not at top. */}
                  {[
                    { height: 40, blur: 2 },
                    { height: 28, blur: 3 },
                    { height: 18, blur: 5 },
                    { height: 10, blur: 6 },
                  ].map(({ height, blur }) => (
                    <div
                      key={`top-blur-${blur}`}
                      aria-hidden
                      style={{
                        position:             'absolute',
                        top:                  0,
                        left:                 0,
                        right:                0,
                        height,
                        backdropFilter:       `blur(${blur}px)`,
                        WebkitBackdropFilter: `blur(${blur}px)`,
                        maskImage:            'linear-gradient(to bottom, black 0%, transparent 100%)',
                        WebkitMaskImage:      'linear-gradient(to bottom, black 0%, transparent 100%)',
                        pointerEvents:        'none',
                        zIndex:               1,
                        opacity:              atTop ? 0 : 1,
                        transition:           'opacity 150ms ease',
                      }}
                    />
                  ))}
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

                  {/* Bottom edge fade - same pattern, anchored to bottom. */}
                  {[
                    { height: 40, blur: 2 },
                    { height: 28, blur: 3 },
                    { height: 18, blur: 5 },
                    { height: 10, blur: 6 },
                  ].map(({ height, blur }) => (
                    <div
                      key={`bottom-blur-${blur}`}
                      aria-hidden
                      style={{
                        position:             'absolute',
                        bottom:               0,
                        left:                 0,
                        right:                0,
                        height,
                        backdropFilter:       `blur(${blur}px)`,
                        WebkitBackdropFilter: `blur(${blur}px)`,
                        maskImage:            'linear-gradient(to top, black 0%, transparent 100%)',
                        WebkitMaskImage:      'linear-gradient(to top, black 0%, transparent 100%)',
                        pointerEvents:        'none',
                        zIndex:               1,
                        opacity:              atBottom ? 0 : 1,
                        transition:           'opacity 150ms ease',
                      }}
                    />
                  ))}
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
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  },
)

PinboardExpanded.displayName = 'PinboardExpanded'
export default PinboardExpanded
