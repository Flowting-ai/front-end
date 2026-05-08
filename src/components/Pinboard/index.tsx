'use client'

import React, { useRef, useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowDownOneIcon,
  ArrowUpDownIcon,
  FilterMailIcon,
  DownloadThreeIcon,
  FolderLibraryIcon,
  FolderOneIcon,
  UnfoldLessIcon,
} from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { PinboardHeader } from '@/components/PinboardHeader'
import { Pin, type PinProps, type PinLabel } from '@/components/Pin'
import type { BadgeColor } from '@/components/Badge'
import { Tooltip } from '@/components/Tooltip'
import { Dropdown } from '@/components/Dropdown'
import { PinboardExpanded, type PinboardExpandedFolder } from '@/components/PinboardExpanded'
import { EnterChunk, PINBOARD_COMPACT_ENTER_DEFAULT, type PinboardEnterAnimation } from './enterAnimation'

export {
  PINBOARD_COMPACT_ENTER_DEFAULT,
  PINBOARD_EXPANDED_ENTER_DEFAULT,
  type PinboardEnterAnimation,
} from './enterAnimation'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PinboardPin extends Omit<PinProps, 'fluid'> {
  id: string
}

/**
 * Item in the Pinboard view-filter dropdown (Figma 3139:36399).
 * Selecting a view tells the consumer which pins to display — the Pinboard
 * itself does not filter; it just owns the dropdown UI + selected-id state
 * and emits `onViewChange` so the consumer can swap `pins`.
 */
export interface PinboardView {
  /** Stable identifier — used for selected-state matching. */
  id:    string
  /** Row label (also shown on the trigger when this view is active). */
  label: string
}

/**
 * Default view set: All pins, Recent pins, Unorganized pins. The "Recent pins"
 * view shows the user's most recently created or interacted-with pins. Append
 * user folders to this list when constructing the consumer's `views` prop.
 */
export const DEFAULT_PINBOARD_VIEWS: PinboardView[] = [
  { id: 'all',         label: 'All pins' },
  { id: 'recent',      label: 'Recent pins' },
  { id: 'unorganized', label: 'Unorganized pins' },
]

export interface PinboardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  pins?: PinboardPin[]
  /**
   * Available views for the filter dropdown (Figma 3139:36399). Defaults to
   * `DEFAULT_PINBOARD_VIEWS` (All / Chat / Unorganized). Spread user folders
   * onto this list to add them under the defaults.
   */
  views?: PinboardView[]
  /**
   * Personal folders (user-created from the "+ New folder" affordance in the
   * expanded sidebar). Forwarded to `PinboardExpanded.personalFolders` AND
   * appended to the compact view-filter dropdown under a "Your folders"
   * divided section.
   */
  personalFolders?: PinboardExpandedFolder[]
  /**
   * Project folders — derived from the user's projects in the Sidebar. See
   * `specs/patterns/project-pinboard-folder-sync.md`: every project the user
   * creates auto-creates a corresponding folder in PinboardExpanded and a
   * filter row in the Pinboard's view dropdown. The consumer owns the
   * mapping (Sidebar `projects` → Pinboard `projectFolders`); the rule
   * keeps the two surfaces in lockstep.
   */
  projectFolders?:  PinboardExpandedFolder[]
  /** Controlled selected-view id. */
  view?: string
  /** Default selected-view id for uncontrolled use. Defaults to the first view's id. */
  defaultView?: string
  /** Fires when the user picks a view from the filter dropdown. */
  onViewChange?: (viewId: string, view: PinboardView) => void
  onOptionsClick?:  () => void
  onCollapseAll?:   () => void
  onSortClick?:     () => void
  onExport?:        () => void
  onOrganize?:      () => void
  onClose?:         () => void
  onSearch?:        (q: string) => void
  fluid?: boolean
  /**
   * Controlled expanded state. When `true`, the Pinboard morphs into the
   * full-panel `PinboardExpanded` view via Framer's layout animation.
   * When omitted the component manages its own expanded state — clicking
   * "Organize" toggles to expanded and the close button on the expanded
   * view returns to the compact layout.
   */
  expanded?:        boolean
  /** Called whenever the expanded state changes (on Organize click or Close click) */
  onExpandedChange?: (expanded: boolean) => void
  /** Default expanded state for uncontrolled usage. Defaults to `false`. */
  defaultExpanded?: boolean
  /**
   * Width (px) of the expanded variant. Defaults to **924** — the Figma hug-
   * width 916 (outer px-8 + sidebar 240 + Content Wrapper p-12 + Pin Grid 636)
   * plus 8px: 4px so the Pin's 1px outer ring isn't clipped, plus 4px so the
   * thin (3px) `kaya-scrollbar` reserves space without overlapping pins.
   */
  expandedWidth?:   number
  /** Height (px) of the expanded variant. Defaults to 817 (Figma sidebar h-817). */
  expandedHeight?:  number
  /**
   * Backdrop fill — any CSS color (alpha included). Defaults to `var(--overlay-bg)`,
   * the universal KDS overlay token (`rgba(18,12,8,0.5)` per Figma 2893:57254).
   * **Do not override** without a strong reason — the rule is enforced by
   * `specs/patterns/overlay-backdrop.md`.
   */
  overlayBackdrop?: string
  /**
   * Backdrop blur radius (CSS length, e.g. `'2px'`). Defaults to
   * `var(--overlay-blur)` (`2px`). Same universality rule applies.
   */
  overlayBackdropBlur?: string
  /** Click-to-close on backdrop. Defaults to `true`. ESC always closes. */
  overlayCloseOnBackdrop?: boolean
  /**
   * First-paint stagger config — controls how the top overlay, each Pin, and
   * the bottom toolbar fade in on mount. Defaults to
   * `PINBOARD_COMPACT_ENTER_DEFAULT`. Pass `{ enabled: false }` to disable.
   */
  enterAnimation?: PinboardEnterAnimation
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_PINS: PinboardPin[] = Array.from({ length: 7 }, (_, i) => ({
  id: `pin-${i}`,
}))

// ── Component ─────────────────────────────────────────────────────────────────

export const Pinboard = React.forwardRef<HTMLDivElement, PinboardProps>(
  function Pinboard(
    {
      pins          = DEFAULT_PINS,
      views         = DEFAULT_PINBOARD_VIEWS,
      personalFolders,
      projectFolders,
      view,
      defaultView,
      onViewChange,
      onOptionsClick,
      onCollapseAll,
      onSortClick,
      onExport,
      onOrganize,
      onClose,
      onSearch,
      fluid         = false,
      expanded:        controlledExpanded,
      onExpandedChange,
      defaultExpanded  = false,
      expandedWidth    = 924,
      expandedHeight   = 817,
      overlayBackdrop        = 'var(--overlay-bg)',
      overlayBackdropBlur    = 'var(--overlay-blur)',
      overlayCloseOnBackdrop = true,
      enterAnimation = PINBOARD_COMPACT_ENTER_DEFAULT,
      style,
      ...props
    },
    ref,
  ) {
    const [uncontrolledExpanded, setUncontrolledExpanded] = useState(defaultExpanded)
    const isControlled = controlledExpanded !== undefined
    const isExpanded   = isControlled ? !!controlledExpanded : uncontrolledExpanded

    const setExpanded = (next: boolean) => {
      if (!isControlled) setUncontrolledExpanded(next)
      onExpandedChange?.(next)
    }

    const handleOrganizeClick = () => {
      onOrganize?.()
      setExpanded(true)
    }

    const handleExpandedClose = () => {
      setExpanded(false)
      onClose?.()
    }

    const scrollRef    = useRef<HTMLDivElement>(null)
    const bottomBarRef = useRef<HTMLDivElement>(null)
    // Top overlay intrinsic height (bar bottom edge). Scroll reserve adds 8 px
    // so pins don't sit flush under the filter bar.
    const TOP_BAR_H = 110
    const topH = 118
    const [bottomH, setBottomH] = useState(68)
    const [atTop,    setAtTop]    = useState(true)
    const [atBottom, setAtBottom] = useState(false)
    // Incremented on "collapse all" click — every Pin watches this and folds.
    const [collapseSignal, setCollapseSignal] = useState(0)
    // Set of pin IDs currently expanded — drives visibility of the
    // "collapse all" IconButton.
    const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
    const hasExpanded = expandedIds.size > 0

    // ── Lifted per-pin tag state ───────────────────────────────────────────
    // User-added tags + deleted backend-label indices live HERE, keyed by
    // pin id, so they survive the compact ↔ expanded transition (each view
    // mounts its own Pin instances; without lifting, those instances would
    // boot with empty internal state every time the user clicks Organize).
    // Pinboard threads these maps + handlers down to every Pin instance —
    // both compact (rendered inline below) and expanded (rendered inside
    // PinboardExpanded). Tag deletion in PinboardExpanded therefore sticks
    // when the user closes back to compact, and tags added in compact show
    // up in PinboardExpanded.
    const [userTagsById, setUserTagsById] = useState<Record<string, PinLabel[]>>({})
    const [deletedLabelsById, setDeletedLabelsById] = useState<Record<string, Set<number>>>({})

    const handlePinAddTag = useCallback(
      (pinId: string, text: string, color: BadgeColor) => {
        setUserTagsById(prev => ({
          ...prev,
          [pinId]: [{ color, text }, ...(prev[pinId] ?? [])],
        }))
      },
      [],
    )
    const handlePinDeleteTag = useCallback(
      (pinId: string, index: number, source: 'label' | 'user') => {
        if (source === 'label') {
          setDeletedLabelsById(prev => {
            const existing = prev[pinId] ?? new Set<number>()
            if (existing.has(index)) return prev
            const next = new Set(existing); next.add(index)
            return { ...prev, [pinId]: next }
          })
        } else {
          setUserTagsById(prev => {
            const list = prev[pinId] ?? []
            return { ...prev, [pinId]: list.filter((_, i) => i !== index) }
          })
        }
      },
      [],
    )

    // ── View filter (header "All pins" Button + Dropdown) ─────────────────
    // The Pinboard owns the dropdown UI + selected-view id. The consumer is
    // responsible for filtering `pins` based on `onViewChange`. Figma
    // 3139:36399.
    const [viewMenuOpen, setViewMenuOpen] = useState(false)
    const [internalViewId, setInternalViewId] = useState(
      defaultView ?? views[0]?.id ?? 'all',
    )
    const currentViewId = view ?? internalViewId
    // Selection can land on a default view OR a folder row (personal /
    // project). The trigger button shows the corresponding label, so the
    // resolver must look across all three lists.
    const allViewItems: PinboardView[] = [
      ...views,
      ...(personalFolders ?? []).map(f => ({ id: f.id, label: f.label })),
      ...(projectFolders  ?? []).map(f => ({ id: f.id, label: f.label })),
    ]
    const currentView = allViewItems.find(v => v.id === currentViewId) ?? views[0]
    const handleViewSelect = (id: string, item: PinboardView) => {
      setViewMenuOpen(false)
      if (view === undefined) setInternalViewId(id)
      onViewChange?.(id, item)
    }

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

    // Measure the bottom toolbar so the scroll area reserves correct space.
    useEffect(() => {
      if (!bottomBarRef.current) return
      const ro = new ResizeObserver(() => {
        if (bottomBarRef.current) setBottomH(bottomBarRef.current.offsetHeight)
      })
      ro.observe(bottomBarRef.current)
      return () => ro.disconnect()
    }, [])

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget
      setAtTop(el.scrollTop < 8)
      setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 8)
    }

    // Recompute atTop / atBottom whenever the scroll container OR its content
    // changes size. The previous useEffect only ran on prop changes, so the
    // bottom edge fade was missing on first paint when pins laid out late
    // (staggered enter animation, async font/icon load) — atBottom defaulted
    // false but never re-evaluated until the user actually scrolled. With a
    // ResizeObserver on both the viewport and the inner content div, the
    // fades reflect overflow state from the very first paint after layout.
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
    }, [pins.length, topH, bottomH])

    // ── Modal overlay: ESC closes ──
    useEffect(() => {
      if (!isExpanded) return
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') handleExpandedClose()
      }
      window.addEventListener('keydown', onKey)
      return () => window.removeEventListener('keydown', onKey)
    }, [isExpanded])

    // ── Compact (always inline) ────────────────────────────────────────────────
    const compactNode = (
      <div
        ref={ref}
        style={{
          position:       'relative',
          display:        'flex',
          flexDirection:  'column',
          flexShrink:     0,
          width:          fluid ? '100%' : 332,
          height:         '100%',
          background:     'var(--neutral-50)',
          overflow:       'hidden',
          paddingBottom:  8,
          borderRadius:   'inherit',
          ...style,
        }}
        {...props}
      >
        {/* ── Top overlay — header + filter bar ──
            Rendered FIRST in DOM so tab order matches visual order:
            close/search → filter → sort/options → pins → Export → Organize.
            Wrapped in <EnterChunk index={0}> so it staggers in as the first
            chunk on first paint (see ./enterAnimation.tsx). ── */}
        <EnterChunk
          cfg={enterAnimation}
          index={0}
          style={{
            position:      'absolute',
            top:           0,
            left:          0,
            right:         0,
            display:       'flex',
            flexDirection: 'column',
            gap:           12,
            padding:       '0 8px 8px 8px',
            background:    'var(--neutral-50)',
            zIndex:        2,
          }}
        >
          <PinboardHeader fluid onClose={onClose} onSearch={onSearch} />

          <div
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'space-between',
              width:          '100%',
            }}
          >
            {/* View filter — opens a Dropdown anchored to the trigger's
                left edge (bottom-start). Selecting a view updates the
                trigger label and emits onViewChange. Figma 3139:36399. */}
            <Dropdown.Float
              open={viewMenuOpen}
              onOpenChange={setViewMenuOpen}
              placement="bottom-start"
              trigger={
                <Button
                  variant="secondary"
                  size="sm"
                  rightIcon={<ArrowDownOneIcon size={16} />}
                >
                  {/* In-place text swap — see specs/patterns/in-place-text-swap.md.
                      The button width auto-adjusts because `popLayout` removes
                      the exiting span from layout flow as soon as exit starts,
                      so the new label drives layout immediately. */}
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={currentViewId}
                      initial={{ scale: 0.75, opacity: 0, filter: 'blur(4px)' }}
                      animate={{ scale: 1,    opacity: 1, filter: 'blur(0px)' }}
                      exit={{    scale: 0.75, opacity: 0, filter: 'blur(4px)' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      style={{ display: 'block', transformOrigin: 'left center' }}
                    >
                      {currentView?.label ?? 'All pins'}
                    </motion.span>
                  </AnimatePresence>
                </Button>
              }
            >
              <Dropdown size="md">
                <Dropdown.Section fluid>
                  {views.map(v => (
                    <Dropdown.Item
                      key={v.id}
                      label={v.label}
                      selected={v.id === currentViewId}
                      onClick={() => handleViewSelect(v.id, v)}
                      fluid
                    />
                  ))}
                </Dropdown.Section>
                {personalFolders && personalFolders.length > 0 && (
                  <Dropdown.Section label="Your folders" divider fluid>
                    {personalFolders.map(f => (
                      <Dropdown.Item
                        key={f.id}
                        label={f.label}
                        icon={<FolderOneIcon />}
                        selected={f.id === currentViewId}
                        onClick={() => handleViewSelect(f.id, { id: f.id, label: f.label })}
                        fluid
                      />
                    ))}
                  </Dropdown.Section>
                )}
                {projectFolders && projectFolders.length > 0 && (
                  <Dropdown.Section label="Project folders" divider fluid>
                    {projectFolders.map(f => (
                      <Dropdown.Item
                        key={f.id}
                        label={f.label}
                        icon={<FolderOneIcon />}
                        selected={f.id === currentViewId}
                        onClick={() => handleViewSelect(f.id, { id: f.id, label: f.label })}
                        fluid
                      />
                    ))}
                  </Dropdown.Section>
                )}
              </Dropdown>
            </Dropdown.Float>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AnimatePresence initial={false}>
                {hasExpanded && (
                  <motion.div
                    key="collapse-all"
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{    opacity: 0, scale: 0.6 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                    style={{ display: 'inline-flex', transformOrigin: 'center' }}
                  >
                    <Tooltip content="Collapse all Pins">
                      <IconButton
                        variant="secondary"
                        size="sm"
                        icon={<UnfoldLessIcon size={20} />}
                        aria-label="Collapse open pins"
                        onClick={handleCollapseAll}
                      />
                    </Tooltip>
                  </motion.div>
                )}
              </AnimatePresence>
              <motion.div
                layout
                transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                style={{ display: 'inline-flex' }}
              >
                <Tooltip content="Filter">
                  <IconButton
                    variant="secondary"
                    size="sm"
                    icon={<FilterMailIcon size={20} />}
                    aria-label="Filter pins"
                    onClick={onOptionsClick}
                  />
                </Tooltip>
              </motion.div>
              <motion.div
                layout
                transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                style={{ display: 'inline-flex' }}
              >
                <Tooltip content="Sort">
                  <IconButton
                    variant="secondary"
                    size="sm"
                    icon={<ArrowUpDownIcon size={20} />}
                    aria-label="Sort pins"
                    onClick={onSortClick}
                  />
                </Tooltip>
              </motion.div>
            </div>
          </div>
        </EnterChunk>

        {/* ── Scrollable pin list ──
            tabIndex={-1} keeps the scroller out of the tab sequence (Chrome
            auto-focuses keyboard-scrollable elements) while its children
            (pins) remain individually focusable. ── */}
        <div
          ref={scrollRef}
          tabIndex={-1}
          className="kaya-scrollbar"
          onScroll={handleScroll}
          style={{
            flex:                '1 1 0',
            minHeight:            0,
            overflowY:            'auto',
            overflowX:            'hidden',
            overscrollBehaviorY:  'contain',
            paddingTop:           topH,
            // bottomH is measured from the toolbar so pins can scroll under
            // it without being hidden; +4px adds a small resting gap so the
            // last pin doesn't sit flush against the toolbar's bleed edge.
            paddingBottom:        bottomH + 4,
            paddingLeft:          8,
            paddingRight:         8,
            outline:              'none',
          }}
        >
          <div
            style={{
              display:       'flex',
              flexDirection: 'column',
              gap:           8,
              alignItems:    'stretch',
              width:         '100%',
            }}
          >
            {pins.map((p, i) => {
              const { id, ...pinRest } = p
              return (
                <EnterChunk key={id} cfg={enterAnimation} index={i + 1} style={{ width: '100%' }}>
                  <Pin
                    fluid
                    collapseSignal={collapseSignal}
                    onExpandedChange={handlePinExpandedChange(id)}
                    userTags={userTagsById[id] ?? []}
                    onAddTag={(text, color) => handlePinAddTag(id, text, color)}
                    deletedLabelIndices={deletedLabelsById[id]}
                    onDeleteTag={(index, source) => handlePinDeleteTag(id, index, source)}
                    {...pinRest}
                  />
                </EnterChunk>
              )
            })}
          </div>
        </div>

        {/* ── Top edge fade — progressive blur (behind) + color fade (in front) ──
            Sits at the bottom edge of the top overlay, softening pins scrolling
            up underneath the filter bar. Hidden when scroll is at top.           ── */}
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
              top:                  TOP_BAR_H,
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
            top:           TOP_BAR_H,
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

        {/* ── Bottom edge fade — progressive blur (behind) + color fade (in front) ──
            Sits just above the toolbar, softening pins scrolling down
            underneath it. Hidden when scroll is at bottom.                       ── */}
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
              bottom:               bottomH,
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
            bottom:        bottomH,
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

        {/* ── Bottom overlay — toolbar ──
            Last chunk in the cascade — fires after all pins. ref is forwarded
            through EnterChunk so bottomH measurement still works. ── */}
        <EnterChunk
          ref={bottomBarRef}
          cfg={enterAnimation}
          index={pins.length + 1}
          style={{
            position:      'absolute',
            bottom:        0,
            left:          0,
            right:         0,
            display:       'flex',
            gap:           8,
            alignItems:    'stretch',
            padding:       '16px 8px',
            background:    'var(--neutral-50)',
            zIndex:        2,
          }}
        >
          <Button
            variant="ghost"
            size="md"
            fluid
            leftIcon={<DownloadThreeIcon size={16} />}
            onClick={onExport}
          >
            Export
          </Button>
          <Button
            variant="secondary"
            size="md"
            fluid
            leftIcon={<FolderLibraryIcon size={16} />}
            onClick={handleOrganizeClick}
          >
            Organize
          </Button>
        </EnterChunk>
      </div>
    )

    // ── Expanded modal overlay (portal) ────────────────────────────────────────
    // AnimatePresence pattern used here:
    //   - Two sibling children inside one <AnimatePresence>, returned as an
    //     array. Each is a keyed motion element with its own initial/animate/
    //     exit so AnimatePresence can track and animate both independently on
    //     mount AND unmount (the previous structure wrapped them in a plain
    //     <div>, which made AnimatePresence's exit a no-op — close = instant).
    //   - mode is left at the default (sync). backdrop and panel enter/exit
    //     together so the close reads as a single coordinated motion.
    //   - Panel uses fixed positioning with top/left/width/height (no
    //     translate centering). Avoids fighting the panel's scale transform.
    const overlayNode = typeof document !== 'undefined' ? createPortal(
      <AnimatePresence>
        {isExpanded ? [
          <motion.div
            key="pinboard-backdrop"
            aria-hidden
            onClick={overlayCloseOnBackdrop ? handleExpandedClose : undefined}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{    opacity: 0, transition: { type: 'spring', stiffness: 360, damping: 27, mass: 1 } }}
            transition={{ type: 'spring', stiffness: 330, damping: 25, mass: 1 }}
            style={{
              position:             'fixed',
              inset:                0,
              zIndex:               1000,
              // Token-driven overlay — see specs/patterns/overlay-backdrop.md.
              // The token already encodes alpha; the motion.div's `opacity`
              // animates 0→1 to fade the whole layer in/out.
              background:           overlayBackdrop,
              backdropFilter:       `blur(${overlayBackdropBlur})`,
              WebkitBackdropFilter: `blur(${overlayBackdropBlur})`,
              cursor:               overlayCloseOnBackdrop ? 'pointer' : 'default',
            }}
          />,
          <motion.div
            key="pinboard-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Pinboard"
            initial={{ opacity: 0, scale: 0.85, filter: 'blur(16px)' }}
            animate={{ opacity: 1, scale: 1,    filter: 'blur(0px)' }}
            exit={{    opacity: 0, scale: 0.85, filter: 'blur(16px)' }}
            transition={{ type: 'spring', stiffness: 380, damping: 24, mass: 0.9 }}
            style={{
              position:        'fixed',
              top:             `calc(50% - ${expandedHeight / 2}px)`,
              left:            `calc(50% - ${expandedWidth / 2}px)`,
              width:           expandedWidth,
              height:          expandedHeight,
              zIndex:          1001,
              background:      'var(--neutral-50)',
              borderRadius:    28,
              overflow:        'hidden',
              transformOrigin: '100% 50%',
              boxShadow:
                '0 19px 32px 8px rgba(18,12,8,0.15), 0 2px 2.8px 0 rgba(130,122,116,0.10), 0 0 0 1px var(--neutral-100)',
            }}
          >
            <PinboardExpanded
              pins={pins}
              onClose={handleExpandedClose}
              onOrganize={onOrganize}
              personalFolders={personalFolders}
              projectFolders={projectFolders}
              activeSidebarId={currentViewId}
              userTagsById={userTagsById}
              deletedLabelsById={deletedLabelsById}
              onPinAddTag={handlePinAddTag}
              onPinDeleteTag={handlePinDeleteTag}
            />
          </motion.div>,
        ] : null}
      </AnimatePresence>,
      document.body,
    ) : null

    return (
      <>
        {compactNode}
        {overlayNode}
      </>
    )
  },
)

Pinboard.displayName = 'Pinboard'
export default Pinboard
