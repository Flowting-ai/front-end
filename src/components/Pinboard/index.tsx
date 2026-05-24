'use client'

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { createPortal } from 'react-dom'
import { AnimatePresence, m } from 'framer-motion'
import {
  ArrowDownOneIcon,
  ArrowRightOneIcon,
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
import { Pin, type PinProps } from '@/components/Pin'
import { Tooltip } from '@/components/Tooltip'
import { Dropdown } from '@/components/Dropdown'
import { Chip } from '@/components/Chip'
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
 * Selecting a view tells the consumer which pins to display - the Pinboard
 * itself does not filter; it just owns the dropdown UI + selected-id state
 * and emits `onViewChange` so the consumer can swap `pins`.
 */
export interface PinboardView {
  /** Stable identifier - used for selected-state matching. */
  id:    string
  /** Row label (also shown on the trigger when this view is active). */
  label: string
}

/**
 * Default view set: All pins, Current chat pins. Append
 * user folders to this list when constructing the consumer's `views` prop.
 */
export const DEFAULT_PINBOARD_VIEWS: PinboardView[] = [
  { id: 'all',          label: 'All pins'          },
  { id: 'current-chat', label: 'Current chat' },
]

/**
 * Default personal-folder set for the view-filter dropdown's "Your folders"
 * section. Empty by default — the consumer supplies real folders fetched from
 * the API. The section auto-hides when the array is empty.
 */
export const DEFAULT_PINBOARD_PERSONAL_FOLDERS: PinboardExpandedFolder[] = []

/**
 * Default project-folder set. Empty by default — the consumer derives these
 * from the user's projects. The section auto-hides when the array is empty.
 */
export const DEFAULT_PINBOARD_PROJECT_FOLDERS: PinboardExpandedFolder[] = []

// ── Filter / Sort menu data types (Figma 3442:23357 / 3442:23366) ─────────────

/** Single row in the Filter dropdown's Tags submenu (Figma 3442:23350). */
export interface PinboardTag {
  id:    string
  label: string
}
/** Single row in the Filter dropdown's Category submenu (Figma 3442:23377). */
export interface PinboardCategory {
  id:    string
  label: string
}
/** Single row in the Filter dropdown's Content type submenu (Figma 3442:23386). */
export interface PinboardContentType {
  id:    string
  label: string
}
/** Single row in the Sort dropdown (Figma 3442:23366). */
export interface PinboardSortOption {
  id:    string
  label: string
}

// Default content for the Filter / Sort dropdowns. Per the KDS "dropdowns
// at component level" rule, Pinboard ships canonical defaults so a bare
// `<Pinboard />` renders the full menu out of the box. Consumers override
// by passing their own list (or `[]` to opt out per submenu).

const DEFAULT_PINBOARD_TAGS: PinboardTag[] = [
  { id: 'tag-research',  label: 'Research'  },
  { id: 'tag-design',    label: 'Design'    },
  { id: 'tag-launch',    label: 'Launch'    },
  { id: 'tag-archive',   label: 'Archive'   },
  { id: 'tag-followup',  label: 'Follow-up' },
]

const DEFAULT_PINBOARD_CATEGORIES: PinboardCategory[] = [
  { id: 'category-code',     label: 'Code'     },
  { id: 'category-research', label: 'Research' },
  { id: 'category-creative', label: 'Creative' },
  { id: 'category-planning', label: 'Planning' },
  { id: 'category-tasks',    label: 'Tasks'    },
  { id: 'category-quote',    label: 'Quote'    },
  { id: 'category-workflow', label: 'Workflow' },
]

const DEFAULT_PINBOARD_CONTENT_TYPES: PinboardContentType[] = [
  { id: 'content-text',  label: 'Text'  },
  { id: 'content-code',  label: 'Code'  },
  { id: 'content-link',  label: 'Link'  },
  { id: 'content-table', label: 'Table' },
  { id: 'content-image', label: 'Image' },
]

export const DEFAULT_PINBOARD_SORT_OPTIONS: PinboardSortOption[] = [
  { id: 'newest',               label: 'Newest'   },
  { id: 'oldest',               label: 'Oldest'   },
  { id: 'most-used',            label: 'Most used' },
  { id: 'alphabetical',         label: 'A to Z'   },
  { id: 'reverse-alphabetical', label: 'Z to A'   },
]

// ── Tag search input (Figma 3442:23350 - sticky header) ─────────────────────
// Same anatomy as ChatInput's PersonaSearchInput: 10 px radius, KDS field
// shadow stack, padding 7 × 10, body-14 regular text. Lives in the Popover
// `header` slot so it never scrolls out of view. Keystrokes stop-propagate
// so they don't drive the parent dropdown's arrow-key navigation.

function TagSearchInput({
  value,
  onChange,
  inputId,
}: {
  value:    string
  onChange: (next: string) => void
  inputId:  string
}) {
  return (
    <div style={{ padding: 8 }}>
      <input
        id={inputId}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search your tag..."
        autoComplete="off"
        spellCheck={false}
        style={{
          width:        '100%',
          padding:      '7px 10px',
          borderRadius: 10,
          border:       'none',
          outline:      'none',
          background:   'var(--neutral-white)',
          boxShadow:
            '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
          fontFamily:   'var(--font-body)',
          fontWeight:   'var(--font-weight-regular)',
          fontSize:     'var(--font-size-body)',
          lineHeight:   'var(--line-height-body)',
          color:        'var(--neutral-700)',
        }}
        onKeyDown={(e) => { e.stopPropagation() }}
      />
    </div>
  )
}

// ── Tags submenu (Figma 3442:23350) ─────────────────────────────────────────
// Sticky search input + checkbox rows. Multi-select - selecting a row leaves
// the menu open so the user can keep checking tags. Filter is case-insensitive
// substring match on the tag's label.

function TagsSubmenu({
  tags,
  selectedIds,
  onToggle,
}: {
  tags:        PinboardTag[]
  selectedIds: ReadonlySet<string>
  onToggle:    (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const inputId = React.useId()
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tags
    return tags.filter((t) => t.label.toLowerCase().includes(q))
  }, [tags, query])

  return (
    <Dropdown
      header={<TagSearchInput value={query} onChange={setQuery} inputId={inputId} />}
    >
      <Dropdown.Section divider fluid>
        {filtered.map((t) => (
          <Dropdown.Item
            key={t.id}
            label={t.label}
            showCheckbox
            checkboxChecked={selectedIds.has(t.id)}
            onCheckboxChange={() => onToggle(t.id)}
            fluid
          />
        ))}
      </Dropdown.Section>
    </Dropdown>
  )
}

// ── Category / Content type submenus (Figma 3442:23377 / 3442:23386) ────────
// Plain checkbox lists. Multi-select. No header. Same anatomy for both -
// share one helper.

function CheckboxListSubmenu<T extends { id: string; label: string }>({
  items,
  selectedIds,
  onToggle,
}: {
  items:       T[]
  selectedIds: ReadonlySet<string>
  onToggle:    (id: string) => void
}) {
  return (
    <Dropdown>
      <Dropdown.Section fluid>
        {items.map((it) => (
          <Dropdown.Item
            key={it.id}
            label={it.label}
            showCheckbox
            checkboxChecked={selectedIds.has(it.id)}
            onCheckboxChange={() => onToggle(it.id)}
            fluid
          />
        ))}
      </Dropdown.Section>
    </Dropdown>
  )
}

// ── Default Filter menu (Figma 3442:23357) ──────────────────────────────────
// Three rows, each opens a submenu: Tags / Category / Content type.

interface DefaultFilterMenuProps {
  tags:               PinboardTag[]
  categories:         PinboardCategory[]
  contentTypes:       PinboardContentType[]
  selectedTagIds:     ReadonlySet<string>
  selectedCategoryIds:    ReadonlySet<string>
  selectedContentTypeIds: ReadonlySet<string>
  onToggleTag:         (id: string) => void
  onToggleCategory:    (id: string) => void
  onToggleContentType: (id: string) => void
}

function DefaultFilterMenu({
  tags,
  categories,
  contentTypes,
  selectedTagIds,
  selectedCategoryIds,
  selectedContentTypeIds,
  onToggleTag,
  onToggleCategory,
  onToggleContentType,
}: DefaultFilterMenuProps) {
  return (
    <Dropdown>
      <Dropdown.Section fluid>
        <Dropdown.Submenu
          trigger={
            <Dropdown.Item
              label="Tags"
              rightIcon={<ArrowRightOneIcon />}
              fluid
            />
          }
        >
          <TagsSubmenu
            tags={tags}
            selectedIds={selectedTagIds}
            onToggle={onToggleTag}
          />
        </Dropdown.Submenu>
        <Dropdown.Submenu
          trigger={
            <Dropdown.Item
              label="Category"
              rightIcon={<ArrowRightOneIcon />}
              fluid
            />
          }
        >
          <CheckboxListSubmenu
            items={categories}
            selectedIds={selectedCategoryIds}
            onToggle={onToggleCategory}
          />
        </Dropdown.Submenu>
        <Dropdown.Submenu
          trigger={
            <Dropdown.Item
              label="Content type"
              rightIcon={<ArrowRightOneIcon />}
              fluid
            />
          }
        >
          <CheckboxListSubmenu
            items={contentTypes}
            selectedIds={selectedContentTypeIds}
            onToggle={onToggleContentType}
          />
        </Dropdown.Submenu>
      </Dropdown.Section>
    </Dropdown>
  )
}

// ── Default Sort menu (Figma 3442:23366) ────────────────────────────────────
// Plain rows, single-select. Selecting a row updates the active sort and
// closes the menu (single-select dropdowns close on commit; multi-select
// filter dropdowns stay open).

function DefaultSortMenu({
  options,
  selectedId,
  onSelect,
}: {
  options:    PinboardSortOption[]
  selectedId: string | null
  onSelect:   (id: string) => void
}) {
  return (
    <Dropdown size="md">
      <Dropdown.Section fluid>
        {options.map((o) => (
          <Dropdown.Item
            key={o.id}
            label={o.label}
            selected={selectedId === o.id}
            onClick={() => onSelect(o.id)}
            fluid
          />
        ))}
      </Dropdown.Section>
    </Dropdown>
  )
}

// ── Filter chip bar (Figma 2603:16332 - active-filter chips row) ────────────
// Sits in the Pinboard's top overlay BELOW the filter / sort row, between
// the filter trigger and the pin list. Mounts only when at least one filter
// group has a selection. Contents in render order:
//
//   ┌───────────────────────────────────────────────────────────────────┐
//   │  [Clear all]  [× Tag: A ▾]  [× 2 Categories ▾]  [× Content type… │
//   └───────────────────────────────────────────────────────────────────┘
//
//   • Clear all - neutral Chip, no chip buttons; entire body click clears
//     every group.
//   • Tag chip - `Tag: <name>` for 1 selection, `N Tags` for 2+. Body /
//     chevron click opens the Tags submenu anchored bottom-start to the
//     chip; × clears every selected tag.
//   • Category chip / Content type chip - same rule, mirroring the Filter
//     dropdown's submenus.
//
// Overflow follows the Pin labels horizontal scroll strip pattern (single
// row, hidden scrollbar, progressive blur + colour fade on each edge).
// Edge-fade gradient resolves to `var(--neutral-50)` so it bleeds the
// Pinboard root background. The user spec calls this out explicitly:
// "use the same kind of design that we had done for when the tags
// overflowed in the pin component, where it is fading and blurring out."

interface FilterBarProps {
  tags:                   PinboardTag[]
  categories:             PinboardCategory[]
  contentTypes:           PinboardContentType[]
  selectedTagIds:         ReadonlySet<string>
  selectedCategoryIds:    ReadonlySet<string>
  selectedContentTypeIds: ReadonlySet<string>
  onToggleTag:            (id: string) => void
  onToggleCategory:       (id: string) => void
  onToggleContentType:    (id: string) => void
  onClearTags:            () => void
  onClearCategories:      () => void
  onClearContentTypes:    () => void
  onClearAll:             () => void
}

function FilterBar({
  tags,
  categories,
  contentTypes,
  selectedTagIds,
  selectedCategoryIds,
  selectedContentTypeIds,
  onToggleTag,
  onToggleCategory,
  onToggleContentType,
  onClearTags,
  onClearCategories,
  onClearContentTypes,
  onClearAll,
// eslint-disable-next-line react-doctor/prefer-useReducer -- multiple useState calls; useReducer refactor deferred
}: FilterBarProps) {
  const [tagOpen,   setTagOpen]   = useState(false)
  const [catOpen,   setCatOpen]   = useState(false)
  const [ctypeOpen, setCtypeOpen] = useState(false)

  // Chip labels - `1 → "<Type>: <name>"`, `2+ → "N <Type>s"`. Falls back to
  // the id if a label can't be resolved (the consumer passed a stale id).
  const firstTagId   = selectedTagIds.size === 1
    ? Array.from(selectedTagIds)[0]
    : null
  const firstCatId   = selectedCategoryIds.size === 1
    ? Array.from(selectedCategoryIds)[0]
    : null
  const firstCtypeId = selectedContentTypeIds.size === 1
    ? Array.from(selectedContentTypeIds)[0]
    : null
  const tagChipLabel = selectedTagIds.size === 0
    ? null
    : selectedTagIds.size === 1
      ? `Tag: ${tags.find(t => t.id === firstTagId)?.label ?? firstTagId}`
      : `${selectedTagIds.size} Tags`
  const categoryChipLabel = selectedCategoryIds.size === 0
    ? null
    : selectedCategoryIds.size === 1
      ? `Category: ${categories.find(c => c.id === firstCatId)?.label ?? firstCatId}`
      : `${selectedCategoryIds.size} Categories`
  const ctypeChipLabel = selectedContentTypeIds.size === 0
    ? null
    : selectedContentTypeIds.size === 1
      ? `Content type: ${contentTypes.find(c => c.id === firstCtypeId)?.label ?? firstCtypeId}`
      : `${selectedContentTypeIds.size} Content types`

  // ── Horizontal scroll edge-fade state ────────────────────────────────────
  const rowRef = useRef<HTMLDivElement>(null)
  const [overflowing, setOverflowing] = useState(false)
  const [atStart,     setAtStart]     = useState(true)
  const [atEnd,       setAtEnd]       = useState(false)

  const recompute = useCallback(() => {
    const row = rowRef.current
    if (!row) return
    setOverflowing(row.scrollWidth > row.clientWidth + 1)
    setAtStart(row.scrollLeft <= 0)
    setAtEnd(row.scrollLeft + row.clientWidth >= row.scrollWidth - 1)
  }, [])

  useEffect(() => {
    const row = rowRef.current
    if (!row) return
    recompute()
    const ro = new ResizeObserver(recompute)
    ro.observe(row)
    for (const child of Array.from(row.children)) ro.observe(child as Element)
    return () => ro.disconnect()
  }, [recompute, tagChipLabel, categoryChipLabel, ctypeChipLabel])

  // ── Pointer drag-to-scroll (mirrors Pin labels-row, see
  // specs/patterns/horizontal-scroll-strip.md) ───────────────────────────
  // Mouse / pen only - touch keeps native horizontal panning. Below the
  // 4 px threshold a click on an inner ChipButton (× / chevron) still
  // fires; past the threshold the move promotes to a drag and the
  // synthetic click is swallowed in `endDrag` so the underlying chip
  // doesn't activate at release. `data-dragging="true"` on the row is
  // the hook the global `cursor: grabbing !important` rule keys off.
  const dragState = useRef<{
    startX:      number
    startScroll: number
    moved:       boolean
    pointerId:   number
  } | null>(null)
  const [dragging, setDragging] = useState(false)

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!overflowing) return
    if (e.pointerType === 'touch') return
    if (e.button !== 0) return
    // Inputs keep their native text-selection drag (the Tags submenu
    // search input also lives inside chip-anchored Dropdown.Float panels -
    // those are portaled to body, but defensively skip anyway).
    const target = e.target as HTMLElement
    if (target.closest('input, textarea, select')) return
    const row = rowRef.current
    if (!row) return
    dragState.current = {
      startX:      e.clientX,
      startScroll: row.scrollLeft,
      moved:       false,
      pointerId:   e.pointerId,
    }
  }, [overflowing])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const s = dragState.current
    if (!s) return
    const dx = e.clientX - s.startX
    if (!s.moved) {
      if (Math.abs(dx) <= 4) return
      s.moved = true
      setDragging(true)
      try { rowRef.current?.setPointerCapture(s.pointerId) } catch {}
    }
    if (rowRef.current) rowRef.current.scrollLeft = s.startScroll - dx
    e.preventDefault()
  }, [])

  const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const s = dragState.current
    if (!s) return
    const wasDrag = s.moved
    dragState.current = null
    setDragging(false)
    try { rowRef.current?.releasePointerCapture(s.pointerId) } catch {}
    if (wasDrag) {
      // Swallow the synthetic click that follows a drag so an underlying
      // chip body / × / chevron doesn't fire its onClick on release.
      const row = rowRef.current
      if (row) {
        const swallow = (ev: MouseEvent) => { ev.stopPropagation(); ev.preventDefault() }
        row.addEventListener('click', swallow, { capture: true, once: true })
        setTimeout(() => row.removeEventListener('click', swallow, true), 0)
      }
    }
    void e
  }, [])

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={rowRef}
        className="kds-pinboard-filter-bar"
        data-draggable={overflowing || undefined}
        data-dragging={dragging ? 'true' : undefined}
        onScroll={recompute}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          display:              'flex',
          alignItems:           'flex-start',
          gap:                  6,
          flexWrap:             'nowrap',
          overflowX:            'auto',
          overscrollBehaviorX:  'contain',
          scrollbarWidth:       'none',
          touchAction:          'pan-x',
          // Match Figma `3442:25651` - `p-px` on the frame.
          padding:              1,
        }}
      >
        {/* "Clear all" - label-only Small chip (no left/right buttons),
            entire body click fires onClearAll. */}
        <Chip
          size="Small"
          color="Neutral"
          label="Clear all"
          onClick={onClearAll}
        />

        {tagChipLabel !== null && (
          <Dropdown.Float
            open={tagOpen}
            onOpenChange={setTagOpen}
            placement="bottom-start"
            trigger={
              <Chip
                size="Small"
                color="Neutral"
                label={tagChipLabel}
                onRemove={(e) => { e.stopPropagation(); onClearTags() }}
                onExpand={() => {/* wrapper toggles via Dropdown.Float onClick */}}
              />
            }
          >
            <TagsSubmenu
              tags={tags}
              selectedIds={selectedTagIds}
              onToggle={onToggleTag}
            />
          </Dropdown.Float>
        )}

        {categoryChipLabel !== null && (
          <Dropdown.Float
            open={catOpen}
            onOpenChange={setCatOpen}
            placement="bottom-start"
            trigger={
              <Chip
                size="Small"
                color="Neutral"
                label={categoryChipLabel}
                onRemove={(e) => { e.stopPropagation(); onClearCategories() }}
                onExpand={() => {}}
              />
            }
          >
            <CheckboxListSubmenu
              items={categories}
              selectedIds={selectedCategoryIds}
              onToggle={onToggleCategory}
            />
          </Dropdown.Float>
        )}

        {ctypeChipLabel !== null && (
          <Dropdown.Float
            open={ctypeOpen}
            onOpenChange={setCtypeOpen}
            placement="bottom-start"
            trigger={
              <Chip
                size="Small"
                color="Neutral"
                label={ctypeChipLabel}
                onRemove={(e) => { e.stopPropagation(); onClearContentTypes() }}
                onExpand={() => {}}
              />
            }
          >
            <CheckboxListSubmenu
              items={contentTypes}
              selectedIds={selectedContentTypeIds}
              onToggle={onToggleContentType}
            />
          </Dropdown.Float>
        )}
      </div>

      {/* ── Edge fades - same anatomy as Pin labels row.
          4 progressive backdrop-blur strips (widths 24/18/12/8, blur 2/3/5/6)
          + a 24 px colour gradient on each edge. Gradient base is
          `var(--neutral-50)` so it matches the Pinboard root background.
          Opacity gates: left visible when overflowing && !atStart; right
          visible when overflowing && !atEnd. ── */}
      <div
        aria-hidden
        style={{
          position:             'absolute',
          top:                  0,
          bottom:               0,
          left:                 0,
          width:                24,
          backdropFilter:       'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          maskImage:            'linear-gradient(to right, black 0%, transparent 100%)',
          WebkitMaskImage:      'linear-gradient(to right, black 0%, transparent 100%)',
          pointerEvents:        'none',
          zIndex:               1,
          opacity:              !overflowing || atStart ? 0 : 1,
          transition:           'opacity 150ms ease',
        }}
      />
      <div
        aria-hidden
        style={{
          position:      'absolute',
          top:           0,
          bottom:        0,
          left:          0,
          width:         24,
          background:    'linear-gradient(to right, var(--neutral-50) 0%, transparent 100%)',
          pointerEvents: 'none',
          zIndex:        1,
          opacity:       !overflowing || atStart ? 0 : 1,
          transition:    'opacity 150ms ease',
        }}
      />
      <div
        aria-hidden
        style={{
          position:             'absolute',
          top:                  0,
          bottom:               0,
          right:                0,
          width:                24,
          backdropFilter:       'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          maskImage:            'linear-gradient(to left, black 0%, transparent 100%)',
          WebkitMaskImage:      'linear-gradient(to left, black 0%, transparent 100%)',
          pointerEvents:        'none',
          zIndex:               1,
          opacity:              !overflowing || atEnd ? 0 : 1,
          transition:           'opacity 150ms ease',
        }}
      />
      <div
        aria-hidden
        style={{
          position:      'absolute',
          top:           0,
          bottom:        0,
          right:         0,
          width:         24,
          background:    'linear-gradient(to left, var(--neutral-50) 0%, transparent 100%)',
          pointerEvents: 'none',
          zIndex:        1,
          opacity:       !overflowing || atEnd ? 0 : 1,
          transition:    'opacity 150ms ease',
        }}
      />
    </div>
  )
}

export interface PinboardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  pins?: PinboardPin[]
  /**
   * Available views for the filter dropdown (Figma 3139:36399). Defaults to
   * `DEFAULT_PINBOARD_VIEWS` (All pins / Current chat pins). Spread user folders
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
   * Project folders - derived from the user's projects in the Sidebar. See
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
  /**
   * Legacy callback fired when the bare Filter `IconButton` is clicked.
   * Only used when `filterMenu` is explicitly passed `null` (opt-out of the
   * canonical Filter dropdown). With the default menu this is a no-op.
   */
  onOptionsClick?:  () => void
  onCollapseAll?:   () => void
  /**
   * Legacy callback fired when the bare Sort `IconButton` is clicked.
   * Only used when `sortMenu` is explicitly passed `null` (opt-out of the
   * canonical Sort dropdown). With the default menu this is a no-op.
   */
  onSortClick?:     () => void
  onExport?:        () => void
  onOrganize?:      () => void
  onClose?:         () => void
  onSearch?:        (q: string) => void
  /** Called when the user clicks "New folder" in the expanded sidebar. */
  onNewFolderClick?: () => void
  /** Called when the user moves selected pins to a folder in organize mode. */
  onMoveToFolder?: (pinIds: string[], folderId: string, folderLabel: string) => void
  /** Called when the user deletes selected pins in organize mode. */
  onDeleteSelected?: (pinIds: string[]) => void
  /** Called when the user exports selected pins in organize mode. */
  onExportSelected?: (pinIds: string[]) => void
  /** Label shown next to pin count in expanded header (e.g. "Updated 2 minutes ago"). */
  updatedLabel?: string
  /** Called when user clicks Rename on a folder in the expanded sidebar. */
  onFolderRename?: (folderId: string, currentLabel: string) => void
  /** Called when user clicks Delete on a folder in the expanded sidebar. */
  onFolderDelete?: (folderId: string) => void
  fluid?: boolean
  /**
   * Controlled expanded state. When `true`, the Pinboard morphs into the
   * full-panel `PinboardExpanded` view via Framer's layout animation.
   * When omitted the component manages its own expanded state - clicking
   * "Organize" toggles to expanded and the close button on the expanded
   * view returns to the compact layout.
   */
  expanded?:        boolean
  /** Called whenever the expanded state changes (on Organize click or Close click) */
  onExpandedChange?: (expanded: boolean) => void
  /** Default expanded state for uncontrolled usage. Defaults to `false`. */
  defaultExpanded?: boolean
  /**
   * Width (px) of the expanded variant. Defaults to **924** - the Figma hug-
   * width 916 (outer px-8 + sidebar 240 + Content Wrapper p-12 + Pin Grid 636)
   * plus 8px: 4px so the Pin's 1px outer ring isn't clipped, plus 4px so the
   * thin (3px) `kaya-scrollbar` reserves space without overlapping pins.
   */
  expandedWidth?:   number
  /** Height (px) of the expanded variant. Defaults to 817 (Figma sidebar h-817). */
  expandedHeight?:  number
  /**
   * Backdrop fill - any CSS color (alpha included). Defaults to `var(--overlay-bg)`,
   * the universal KDS overlay token (`rgba(18,12,8,0.5)` per Figma 2893:57254).
   * **Do not override** without a strong reason - the rule is enforced by
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
   * First-paint stagger config - controls how the top overlay, each Pin, and
   * the bottom toolbar fade in on mount. Defaults to
   * `PINBOARD_COMPACT_ENTER_DEFAULT`. Pass `{ enabled: false }` to disable.
   */
  enterAnimation?: PinboardEnterAnimation
  /**
   * Contents of the Filter dropdown (Figma 3442:23357). Defaults to the
   * canonical KDS filter menu - `Tags` / `Category` / `Content type` rows,
   * each opening a checkbox submenu. Pass a custom `<Dropdown>` to override,
   * or `null` to opt out and revert to the bare-button + `onOptionsClick`
   * callback. Mirrors the `addMenu` / `modelMenu` pattern in `ChatInput`.
   */
  filterMenu?: React.ReactNode | null
  /**
   * Tag rows rendered in the Filter menu's "Tags" submenu (Figma 3442:23350).
   * The submenu always shows a sticky search input above the rows so the
   * user can filter by name. Pass `[]` to render an empty list. Defaults to
   * a small placeholder set so the canonical preview shows the full layout.
   * Ignored when `filterMenu` is overridden with a custom node.
   */
  tags?: PinboardTag[]
  /**
   * Category rows rendered in the Filter menu's "Category" submenu
   * (Figma 3442:23377). Defaults to the canonical KDS list (Code / Research /
   * Creative / Planning / Tasks / Quote / Workflow). Ignored when
   * `filterMenu` is overridden.
   */
  categories?: PinboardCategory[]
  /**
   * Content-type rows rendered in the Filter menu's "Content type" submenu
   * (Figma 3442:23386). Defaults to Text / Code / Link / Table / Image.
   * Ignored when `filterMenu` is overridden.
   */
  contentTypes?: PinboardContentType[]
  // ── Filter selection state (controlled-or-uncontrolled) ────────────────
  /** Selected tag ids. Pair with `onSelectedTagIdsChange`. */
  selectedTagIds?:        ReadonlyArray<string>
  defaultSelectedTagIds?: ReadonlyArray<string>
  onSelectedTagIdsChange?: (next: ReadonlyArray<string>) => void
  /** Selected category ids. Pair with `onSelectedCategoryIdsChange`. */
  selectedCategoryIds?:        ReadonlyArray<string>
  defaultSelectedCategoryIds?: ReadonlyArray<string>
  onSelectedCategoryIdsChange?: (next: ReadonlyArray<string>) => void
  /** Selected content-type ids. Pair with `onSelectedContentTypeIdsChange`. */
  selectedContentTypeIds?:        ReadonlyArray<string>
  defaultSelectedContentTypeIds?: ReadonlyArray<string>
  onSelectedContentTypeIdsChange?: (next: ReadonlyArray<string>) => void
  /**
   * Contents of the Sort dropdown (Figma 3442:23366). Defaults to the
   * canonical KDS sort menu - Newest / Oldest / Most used / Alphabetical /
   * Reverse alphabetical. Pass a custom `<Dropdown>` to override, or `null`
   * to opt out and revert to the bare-button + `onSortClick` callback.
   */
  sortMenu?: React.ReactNode | null
  /**
   * Sort options rendered in the Sort dropdown. Defaults to
   * `DEFAULT_PINBOARD_SORT_OPTIONS`. Ignored when `sortMenu` is overridden.
   */
  sortOptions?: PinboardSortOption[]
  /** Selected sort id (or `null` for none). Pair with `onSelectedSortIdChange`. */
  selectedSortId?:        string | null
  defaultSelectedSortId?: string | null
  onSelectedSortIdChange?: (next: string | null) => void
  /** When `true`, renders the Filter button disabled instead of opening the filter dropdown. */
  filterDisabled?: boolean
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_PINS: PinboardPin[] = Array.from({ length: 7 }, (_, i) => ({
  id: `pin-${i}`,
}))

const EMPTY_FOLDERS: PinboardExpandedFolder[] = []
const EMPTY_STRING_IDS: string[] = []

// ── Component ─────────────────────────────────────────────────────────────────

export function Pinboard(
  {
    ref,
    pins            = DEFAULT_PINS,
    views           = DEFAULT_PINBOARD_VIEWS,
    personalFolders = EMPTY_FOLDERS,
    projectFolders  = EMPTY_FOLDERS,
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
    onNewFolderClick,
    onMoveToFolder,
    onDeleteSelected,
    onExportSelected,
    updatedLabel,
    onFolderRename,
    onFolderDelete,
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
    filterMenu:                  filterMenuProp,
    tags                       = DEFAULT_PINBOARD_TAGS,
    categories                 = DEFAULT_PINBOARD_CATEGORIES,
    contentTypes               = DEFAULT_PINBOARD_CONTENT_TYPES,
    selectedTagIds:                 selectedTagIdsProp,
    defaultSelectedTagIds      = EMPTY_STRING_IDS,
    onSelectedTagIdsChange,
    selectedCategoryIds:            selectedCategoryIdsProp,
    defaultSelectedCategoryIds = EMPTY_STRING_IDS,
    onSelectedCategoryIdsChange,
    selectedContentTypeIds:         selectedContentTypeIdsProp,
    defaultSelectedContentTypeIds = EMPTY_STRING_IDS,
    onSelectedContentTypeIdsChange,
    sortMenu:                    sortMenuProp,
    sortOptions                = DEFAULT_PINBOARD_SORT_OPTIONS,
    selectedSortId:                 selectedSortIdProp,
    defaultSelectedSortId      = null,
    onSelectedSortIdChange,
    filterDisabled = false,
    style,
    ...props
  }: PinboardProps & { ref?: React.Ref<HTMLDivElement> },
// eslint-disable-next-line react-doctor/prefer-useReducer -- multiple useState calls; useReducer refactor deferred
) {
    // eslint-disable-next-line react-doctor/no-derived-useState -- intentional draft-state pattern; reset handled by key prop or effect
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
    }

    const scrollRef    = useRef<HTMLDivElement>(null)
    const pinVirtualizer = useVirtualizer({
      count:            pins.length,
      getScrollElement: () => scrollRef.current,
      estimateSize:     () => 120,
      overscan:         4,
    })
    const bottomBarRef = useRef<HTMLDivElement>(null)
    const topOverlayRef = useRef<HTMLDivElement>(null)
    // Top overlay measured height (bar bottom edge). Scroll reserve adds 8 px
    // so pins don't sit flush under the filter bar. Default 110 px (header +
    // filter row), bumps to ~150 px when the active-filter chip bar is shown.
    // ResizeObserver below tracks the live value so the bar enter/exit
    // animation pushes / pulls the pin list smoothly.
    const [TOP_BAR_H, setTopBarH] = useState(110)
    const topH = TOP_BAR_H + 8
    const [bottomH, setBottomH] = useState(68)
    const [atTop,    setAtTop]    = useState(true)
    const [atBottom, setAtBottom] = useState(false)
    // Incremented on "collapse all" click - every Pin watches this and folds.
    const [collapseSignal, setCollapseSignal] = useState(0)
    // Set of pin IDs currently expanded - drives visibility of the
    // "collapse all" IconButton.
    const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
    const hasExpanded = expandedIds.size > 0

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

    // ── Filter dropdown (Figma 3442:23357) ─────────────────────────────────
    // Component-level menu, mirroring ChatInput's `addMenu` pattern. Three
    // controlled-or-uncontrolled multi-select pairs (tags / categories /
    // content types), all kept as Sets internally for O(1) toggle. The Set
    // hands out a ReadonlyArray<string> on every change so consumers don't
    // see a Set in their callback signature.
    const [filterMenuOpen, setFilterMenuOpen] = useState(false)
    const isTagsControlled    = selectedTagIdsProp         !== undefined
    const isCatsControlled    = selectedCategoryIdsProp    !== undefined
    const isCtypesControlled  = selectedContentTypeIdsProp !== undefined
    const [internalTagIds,   setInternalTagIds]   = useState<ReadonlySet<string>>(
      () => new Set(defaultSelectedTagIds),
    )
    const [internalCatIds,   setInternalCatIds]   = useState<ReadonlySet<string>>(
      () => new Set(defaultSelectedCategoryIds),
    )
    const [internalCtypeIds, setInternalCtypeIds] = useState<ReadonlySet<string>>(
      () => new Set(defaultSelectedContentTypeIds),
    )
    const tagIdSet = useMemo(
      () => isTagsControlled ? new Set(selectedTagIdsProp) : internalTagIds,
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [isTagsControlled, selectedTagIdsProp, internalTagIds],
    )
    const categoryIdSet = useMemo(
      () => isCatsControlled ? new Set(selectedCategoryIdsProp) : internalCatIds,
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [isCatsControlled, selectedCategoryIdsProp, internalCatIds],
    )
    const ctypeIdSet = useMemo(
      () => isCtypesControlled ? new Set(selectedContentTypeIdsProp) : internalCtypeIds,
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [isCtypesControlled, selectedContentTypeIdsProp, internalCtypeIds],
    )

    const toggleInSet = (
      set: ReadonlySet<string>,
      id:  string,
    ): ReadonlySet<string> => {
      const next = new Set(set)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    }
    const handleToggleTag = (id: string) => {
      const next = toggleInSet(tagIdSet, id)
      if (!isTagsControlled) setInternalTagIds(next)
      onSelectedTagIdsChange?.(Array.from(next))
    }
    const handleToggleCategory = (id: string) => {
      const next = toggleInSet(categoryIdSet, id)
      if (!isCatsControlled) setInternalCatIds(next)
      onSelectedCategoryIdsChange?.(Array.from(next))
    }
    const handleToggleContentType = (id: string) => {
      const next = toggleInSet(ctypeIdSet, id)
      if (!isCtypesControlled) setInternalCtypeIds(next)
      onSelectedContentTypeIdsChange?.(Array.from(next))
    }

    const filterMenu = filterMenuProp === undefined ? (
      <DefaultFilterMenu
        tags={tags}
        categories={categories}
        contentTypes={contentTypes}
        selectedTagIds={tagIdSet}
        selectedCategoryIds={categoryIdSet}
        selectedContentTypeIds={ctypeIdSet}
        onToggleTag={handleToggleTag}
        onToggleCategory={handleToggleCategory}
        onToggleContentType={handleToggleContentType}
      />
    ) : filterMenuProp

    // ── Filter chip bar - bulk-clear handlers + active-filter signal ───────
    // The bar mounts only when at least one group has a selection. Clearing
    // a chip's × clears that group; the "Clear all" chip clears all three.
    const hasActiveFilters =
      tagIdSet.size > 0 || categoryIdSet.size > 0 || ctypeIdSet.size > 0
    const clearTags = () => {
      if (!isTagsControlled) setInternalTagIds(new Set())
      onSelectedTagIdsChange?.([])
    }
    const clearCategories = () => {
      if (!isCatsControlled) setInternalCatIds(new Set())
      onSelectedCategoryIdsChange?.([])
    }
    const clearContentTypes = () => {
      if (!isCtypesControlled) setInternalCtypeIds(new Set())
      onSelectedContentTypeIdsChange?.([])
    }
    const clearAllFilters = () => {
      clearTags()
      clearCategories()
      clearContentTypes()
    }

    // Shared FilterBar JSX - rendered once in the compact top overlay and
    // once passed into `PinboardExpanded` so the same selection state
    // surfaces in both variants. Two FilterBar instances mean independent
    // scroll / dropdown-open state per bar (correct: each surface tracks
    // its own scroll position), but the lifted tag / category / content-type
    // selection state is shared so toggles persist across the morph.
    const filterBarNode = (
      <FilterBar
        tags={tags}
        categories={categories}
        contentTypes={contentTypes}
        selectedTagIds={tagIdSet}
        selectedCategoryIds={categoryIdSet}
        selectedContentTypeIds={ctypeIdSet}
        onToggleTag={handleToggleTag}
        onToggleCategory={handleToggleCategory}
        onToggleContentType={handleToggleContentType}
        onClearTags={clearTags}
        onClearCategories={clearCategories}
        onClearContentTypes={clearContentTypes}
        onClearAll={clearAllFilters}
      />
    )

    // ── Sort dropdown (Figma 3442:23366) ───────────────────────────────────
    const [sortMenuOpen, setSortMenuOpen] = useState(false)
    const isSortControlled = selectedSortIdProp !== undefined
    // eslint-disable-next-line react-doctor/no-derived-useState -- intentional draft-state pattern; reset handled by key prop or effect
    const [internalSortId, setInternalSortId] = useState<string | null>(defaultSelectedSortId)
    const selectedSortId = isSortControlled ? (selectedSortIdProp ?? null) : internalSortId
    const handleSortSelect = (id: string) => {
      if (!isSortControlled) setInternalSortId(id)
      onSelectedSortIdChange?.(id)
      // Keep the menu open after selection - same interaction model as the
      // multi-select Filter submenus. The user explicitly requested that
      // dropdowns don't auto-close on commit; close happens on click-outside
      // or Escape per the standard `Dropdown.Float` behaviour.
    }
    const sortMenu = sortMenuProp === undefined ? (
      <DefaultSortMenu
        options={sortOptions}
        selectedId={selectedSortId}
        onSelect={handleSortSelect}
      />
    ) : sortMenuProp

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

    // Measure the top overlay so the filter chip bar's enter / exit animation
    // pushes / pulls the pin list smoothly. The overlay's intrinsic height
    // grows by ~30 px when the bar mounts (Small chip 20 + 12 row gap) and
    // shrinks back when the last filter is cleared.
    useEffect(() => {
      if (!topOverlayRef.current) return
      const ro = new ResizeObserver(() => {
        if (topOverlayRef.current) setTopBarH(topOverlayRef.current.offsetHeight)
      })
      ro.observe(topOverlayRef.current)
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
    // (staggered enter animation, async font/icon load) - atBottom defaulted
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
        {/* ── Top overlay - header + filter bar ──
            Rendered FIRST in DOM so tab order matches visual order:
            close/search → filter → sort/options → pins → Export → Organize.
            Wrapped in <EnterChunk index={0}> so it staggers in as the first
            chunk on first paint (see ./enterAnimation.tsx). ── */}
        <EnterChunk
          ref={topOverlayRef}
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
            {/* View filter - opens a Dropdown anchored to the trigger's
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
                  {/* In-place text swap - see specs/patterns/in-place-text-swap.md.
                      The button width auto-adjusts because `popLayout` removes
                      the exiting span from layout flow as soon as exit starts,
                      so the new label drives layout immediately. */}
                  <AnimatePresence mode="popLayout" initial={false}>
                    <m.span
                      key={currentViewId}
                      initial={{ scale: 0.75, opacity: 0, filter: 'blur(4px)' }}
                      animate={{ scale: 1,    opacity: 1, filter: 'blur(0px)' }}
                      exit={{    scale: 0.75, opacity: 0, filter: 'blur(4px)' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      style={{ display: 'block', transformOrigin: 'left center' }}
                    >
                      {(() => { const l = currentView?.label ?? 'All pins'; return l.length > 20 ? l.slice(0, 20) + '…' : l })()}
                    </m.span>
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
                {/* Folders block - isolated KDS scrollbar so long folder
                    lists don't overflow the dropdown. Max-height caps at
                    ~6 items (32 px each + 4 px gap). */}
                {((personalFolders && personalFolders.length > 0) || (projectFolders && projectFolders.length > 0)) && (
                  <div
                    className="kaya-scrollbar"
                    style={{
                      maxHeight:           192,
                      overflowY:           'auto',
                      overflowX:           'hidden',
                      overscrollBehaviorY: 'contain',
                    }}
                  >
                    {personalFolders && personalFolders.length > 0 && (
                      <Dropdown.Section label="Your folders" divider fluid>
                        {personalFolders.map(f => (
                          <Dropdown.Item
                            key={f.id}
                            label={f.label}
                            icon={<FolderOneIcon variant="static" animated />}
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
                            icon={<FolderOneIcon variant="static" animated />}
                            selected={f.id === currentViewId}
                            onClick={() => handleViewSelect(f.id, { id: f.id, label: f.label })}
                            fluid
                          />
                        ))}
                      </Dropdown.Section>
                    )}
                  </div>
                )}
              </Dropdown>
            </Dropdown.Float>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AnimatePresence initial={false}>
                {hasExpanded && (
                  <m.div
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
                  </m.div>
                )}
              </AnimatePresence>
              <m.div
                layout
                transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                style={{ display: 'inline-flex' }}
              >
                {filterDisabled ? (
                  <Tooltip content="Filter">
                    <IconButton
                      variant="secondary"
                      size="sm"
                      icon={<FilterMailIcon size={20} />}
                      aria-label="Filter pins"
                      disabled
                    />
                  </Tooltip>
                ) : filterMenu != null ? (
                  // Filter dropdown (Figma 3442:23357). bottom-end so the
                  // panel opens below the trigger, right-aligned with the
                  // button cluster.
                  <Dropdown.Float
                    open={filterMenuOpen}
                    onOpenChange={setFilterMenuOpen}
                    placement="bottom-end"
                    trigger={
                      <Tooltip content="Filter">
                        <IconButton
                          variant="secondary"
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
                      variant="secondary"
                      size="sm"
                      icon={<FilterMailIcon size={20} />}
                      aria-label="Filter pins"
                      onClick={onOptionsClick}
                    />
                  </Tooltip>
                )}
              </m.div>
              <m.div
                layout
                transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                style={{ display: 'inline-flex' }}
              >
                {sortMenu != null ? (
                  // Sort dropdown (Figma 3442:23366). bottom-end so the
                  // panel opens below the trigger.
                  <Dropdown.Float
                    open={sortMenuOpen}
                    onOpenChange={setSortMenuOpen}
                    placement="bottom-end"
                    trigger={
                      <IconButton
                        variant="secondary"
                        size="sm"
                        icon={<ArrowUpDownIcon size={20} />}
                        aria-label="Sort pins"
                      />
                    }
                  >
                    {sortMenu}
                  </Dropdown.Float>
                ) : (
                  <Tooltip content="Sort">
                    <IconButton
                      variant="secondary"
                      size="sm"
                      icon={<ArrowUpDownIcon size={20} />}
                      aria-label="Sort pins"
                      onClick={onSortClick}
                    />
                  </Tooltip>
                )}
              </m.div>
            </div>
          </div>

          {/* ── Active-filter chip bar (Figma 2603:16332) ──
              Mounts only when at least one filter group has a selection.
              Animates height + opacity on enter / exit; the top overlay's
              ResizeObserver pushes the pin list down by the bar's measured
              height. ── */}
          <AnimatePresence initial={false}>
            {hasActiveFilters && (
              <m.div
                key="filter-bar"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{    height: 0, opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                style={{ overflow: 'hidden' }}
              >
                {filterBarNode}
              </m.div>
            )}
          </AnimatePresence>
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
            // eslint-disable-next-line react-doctor/no-outline-none -- browser outline suppressed; :focus-visible handled by container or global styles
            outline:              'none',
          }}
        >
          <div style={{ width: '100%' }}>
            {pins.length === 0 && hasActiveFilters ? (
              // Empty result - filters returned no pins. Per user spec:
              // "no pin match" copy in place of the list. The hasActiveFilters
              // gate keeps the message off the screen when the consumer
              // simply hasn't passed any pins yet (vacant pinboard).
              <div
                role="status"
                aria-live="polite"
                style={{
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  width:          '100%',
                  padding:        '40px 8px',
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
            ) : (
              <div style={{ position: 'relative', width: '100%', height: pinVirtualizer.getTotalSize() }}>
                {pinVirtualizer.getVirtualItems().map((vRow) => {
                  const p = pins[vRow.index]
                  const { id, ...pinRest } = p
                  return (
                    <div
                      key={id}
                      data-index={vRow.index}
                      ref={pinVirtualizer.measureElement}
                      style={{
                        position:  'absolute',
                        top:       0,
                        left:      0,
                        width:     '100%',
                        transform: `translateY(${vRow.start}px)`,
                        paddingBottom: 8,
                      }}
                    >
                      <Pin
                        fluid
                        collapseSignal={collapseSignal}
                        onExpandedChange={handlePinExpandedChange(id)}
                        {...pinRest}
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Top edge fade - progressive blur (behind) + color fade (in front) ──
            Sits at the bottom edge of the top overlay, softening pins scrolling
            up underneath the filter bar. Hidden when scroll is at top.           ── */}
        <div
          aria-hidden
          style={{
            position:             'absolute',
            top:                  TOP_BAR_H,
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

        {/* ── Bottom edge fade - progressive blur (behind) + color fade (in front) ──
            Sits just above the toolbar, softening pins scrolling down
            underneath it. Hidden when scroll is at bottom.                       ── */}
        <div
          aria-hidden
          style={{
            position:             'absolute',
            bottom:               bottomH,
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

        {/* ── Bottom overlay - toolbar ──
            Last chunk in the cascade - fires after all pins. ref is forwarded
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
    //     <div>, which made AnimatePresence's exit a no-op - close = instant).
    //   - mode is left at the default (sync). backdrop and panel enter/exit
    //     together so the close reads as a single coordinated motion.
    //   - Panel uses fixed positioning with top/left/width/height (no
    //     translate centering). Avoids fighting the panel's scale transform.
    const overlayNode = typeof document !== 'undefined' ? createPortal(
      <AnimatePresence>
        {isExpanded ? [
          <m.div
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
              zIndex:               20,
              // Token-driven overlay - see specs/patterns/overlay-backdrop.md.
              // The token already encodes alpha; the m.div's `opacity`
              // animates 0→1 to fade the whole layer in/out.
              background:           overlayBackdrop,
              backdropFilter:       `blur(${overlayBackdropBlur})`,
              WebkitBackdropFilter: `blur(${overlayBackdropBlur})`,
              cursor:               overlayCloseOnBackdrop ? 'pointer' : 'default',
            }}
          />,
          <m.div
            key="pinboard-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Pinboard"
            initial={{ opacity: 0, scale: 0.85, filter: 'blur(8px)' }}
            animate={{ opacity: 1, scale: 1,    filter: 'blur(0px)' }}
            exit={{    opacity: 0, scale: 0.85, filter: 'blur(8px)' }}
            transition={{ type: 'spring', stiffness: 380, damping: 24, mass: 0.9 }}
            style={{
              position:        'fixed',
              top:             '50%',
              left:            '50%',
              x:               '-50%',
              y:               '-50%',
              width:           expandedWidth,
              maxWidth:        'calc(100vw - 32px)',
              height:          expandedHeight,
              maxHeight:       '98vh',
              zIndex:          21,
              background:      'var(--neutral-50)',
              borderRadius:    28,
              overflow:        'hidden',
              transformOrigin: '50% 50%',
              boxShadow:
                '0 19px 32px 8px rgba(18,12,8,0.15), 0 2px 2.8px 0 rgba(130,122,116,0.10), 0 0 0 1px var(--neutral-100)',
            }}
          >
            <PinboardExpanded
              pins={pins}
              pinCount={pins.length}
              onClose={handleExpandedClose}
              onOrganize={onOrganize}
              personalFolders={personalFolders}
              projectFolders={projectFolders}
              activeSidebarId={currentViewId}
              filterBar={filterBarNode}
              hasActiveFilters={hasActiveFilters}
              filterMenu={filterMenu}
              filterDisabled={filterDisabled}
              sortMenu={sortMenu}
              onSearch={onSearch}
              onSidebarItemClick={(id) => {
                const item = allViewItems.find((v) => v.id === id) ?? { id, label: id }
                handleViewSelect(id, item)
              }}
              onNewFolderClick={onNewFolderClick}
              onMoveToFolder={onMoveToFolder}
              onDeleteSelected={onDeleteSelected}
              onExport={onExport}
              onExportSelected={onExportSelected}
              updatedLabel={updatedLabel}
              onFolderRename={onFolderRename}
              onFolderDelete={onFolderDelete}
            />
          </m.div>,
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
}

Pinboard.displayName = 'Pinboard'
export default Pinboard
