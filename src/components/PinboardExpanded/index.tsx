'use client'

import React, { useRef, useState, useEffect } from 'react'
import { m, AnimatePresence } from 'framer-motion'
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
  MoreVerticalIcon,
  FilterMailIcon,
  ArrowUpDownIcon,
  PenOneIcon,
} from '@strange-huge/icons'
import { InputField } from '@/components/InputField'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { Badge } from '@/components/Badge'
import { Pin, type PinProps } from '@/components/Pin'
import { Tooltip } from '@/components/Tooltip'
import { Dropdown } from '@/components/Dropdown'
import { SidebarMenuItem } from '@/components/SidebarMenuItem'
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
  onClose?:         () => void
  onOrganize?:      () => void
  /**
   * Called when the user clicks a sidebar item (All pins, This chat, or a
   * folder row). Receives the item's id so the parent can update the active
   * view and re-filter `pins` accordingly.
   */
  onSidebarItemClick?: (id: string) => void
  /**
   * Called when the user clicks the "New folder" sidebar item. The parent is
   * responsible for prompting the user for a name and creating the folder.
   */
  onNewFolderClick?: () => void
  /**
   * Called when the user confirms a "Move to folder" action in organize mode.
   * Receives the selected pin ids, target folder id, and folder label so the
   * parent can persist the move and show a toast.
   */
  onMoveToFolder?: (pinIds: string[], folderId: string, folderLabel: string) => void
  /**
   * Called when the user clicks Delete in organize mode with pins selected.
   * The parent is responsible for removing the pins and showing a toast.
   */
  onDeleteSelected?: (pinIds: string[]) => void
  /**
   * Legacy callback fired when the bare Filter `IconButton` is clicked.
   * Only used when `filterMenu` is explicitly passed `null` (opt-out of the
   * canonical Filter dropdown). With the default menu this is a no-op.
   */
  onOptionsClick?:   () => void
  /** Called when the user clicks the Export button in the search row. */
  onExport?:         () => void
  /**
   * Called when the user clicks Export in organize mode with pins selected.
   */
  onExportSelected?: (pinIds: string[]) => void
  /**
   * Called when the user clicks Rename on a folder's context menu.
   * The parent is responsible for prompting for the new name and persisting.
   */
  onFolderRename?: (folderId: string, currentLabel: string) => void
  /**
   * Called when the user clicks Delete on a folder's context menu.
   * The parent is responsible for removing the folder and showing a toast.
   */
  onFolderDelete?: (folderId: string) => void
  /**
   * First-paint stagger config - controls how the sidebar, header, tabs/cluster
   * row, and each pin-row in the grid fade in on mount. Defaults to
   * `PINBOARD_EXPANDED_ENTER_DEFAULT`. Pass `{ enabled: false }` to disable.
   */
  enterAnimation?:  PinboardEnterAnimation
  /**
   * Called when the user types in the expanded search bar. The parent
   * is responsible for filtering `pins` and passing the result back.
   */
  onSearch?: (q: string) => void
  /**
   * Contents of the Filter dropdown (Figma 3442:23357). Pass the same
   * computed `filterMenu` node used in the compact Pinboard so the two
   * views share filter state. Pass `null` to hide the filter button.
   */
  filterMenu?: React.ReactNode | null
  /** When `true`, renders the Filter button disabled instead of opening the dropdown. */
  filterDisabled?: boolean
  /**
   * Contents of the Sort dropdown (Figma 3442:23366). Same sharing
   * rationale as `filterMenu`. Pass `null` to hide the sort button.
   */
  sortMenu?: React.ReactNode | null
  /**
   * Pre-rendered active-filter chip bar (Figma 2603:16332). When present,
   * mounts between the header and the pin grid. State lives in the
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
          fontSize: 12,
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

export function PinboardExpanded(
  {
    pins             = DEFAULT_PINS,
    title            = 'All pins',
    pinCount         = 32,
    updatedLabel     = '',
    personalFolders  = DEFAULT_PERSONAL_FOLDERS,
    projectFolders   = DEFAULT_PROJECT_FOLDERS,
    activeSidebarId  = 'all-pins',
    onClose,
    onOrganize,
    filterBar,
    hasActiveFilters = false,
    onSidebarItemClick,
    onNewFolderClick,
    onMoveToFolder,
    onDeleteSelected,
    onExport,
    onExportSelected,
    onFolderRename,
    onFolderDelete,
    onSearch,
    onOptionsClick,
    filterMenu,
    filterDisabled = false,
    sortMenu,
    enterAnimation = PINBOARD_EXPANDED_ENTER_DEFAULT,
    style,
    className,
    ref,
    ...props
  }: PinboardExpandedProps & { ref?: React.Ref<HTMLDivElement> },
// eslint-disable-next-line react-doctor/prefer-useReducer -- multiple useState calls; useReducer refactor deferred
) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const [atTop, setAtTop]       = useState(true)
    const [atBottom, setAtBottom] = useState(false)
    const [openFolderMenuId,  setOpenFolderMenuId]  = useState<string | null>(null)
    const [hoveredFolderId,   setHoveredFolderId]   = useState<string | null>(null)
    const [expandedSearch,    setExpandedSearch]    = useState('')
    // Single state for the four mutually-exclusive header dropdowns/panels.
    // Previously 4 separate booleans; each toggle caused its own re-render.
    type OpenPanel = 'search' | 'filter' | 'sort' | 'moveToFolder' | null
    const [openPanel, setOpenPanel] = useState<OpenPanel>(null)

    const folderListRef = useRef<HTMLDivElement>(null)
    const [showFolderBlur, setShowFolderBlur] = useState(false)
    useEffect(() => {
      const el = folderListRef.current
      if (!el) return
      const update = () => setShowFolderBlur(el.scrollHeight - el.clientHeight > 4)
      update()
      const ro = new ResizeObserver(update)
      ro.observe(el)
      return () => ro.disconnect()
    }, [personalFolders])

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
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget
      setAtTop(el.scrollTop < 8)
      setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 8)
    }

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

    const viewTitle =
      activeSidebarId === 'all-pins' || activeSidebarId === 'all' ? 'All pins' :
      activeSidebarId === 'current-chat' ? 'Current chat' :
      [...personalFolders, ...projectFolders].find(f => f.id === activeSidebarId)?.label ?? title

    return (
      <div
        ref={ref}
        className={cn(className)}
        style={{
          // Outer pinboard - matches Figma node 2603:15826 exactly:
          //   bg neutral-50, flex row, items-center, overflow-clip,
          //   px-8, rounded-28 (set on parent m.div), shadow set on parent.
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
              style={{
                display:       'flex',
                flexDirection: 'column',
                gap:           4,
                height:        '100%',
                width:         240,
                padding:       '8px 0',
                overflowX:     'hidden',
                overflowY:     'hidden',
                flexShrink:    0,
              }}
            >
              {/* Pinboard section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 8, width: '100%', flexShrink: 0 }}>
                <SectionLabel>Pinboard</SectionLabel>
                <SidebarMenuItem
                  label="All pins"
                  fluid
                  icon={<DashboardSquareOneIcon size={20} />}
                  selected={activeSidebarId === 'all-pins' || activeSidebarId === 'all'}
                  onClick={() => onSidebarItemClick?.('all-pins')}
                />
                <SidebarMenuItem
                  label="Current chat"
                  fluid
                  icon={<ShapesOneIcon size={20} />}
                  selected={activeSidebarId === 'current-chat'}
                  onClick={() => onSidebarItemClick?.('current-chat')}
                />
              </div>

              {/* Your folders */}
              <div style={{ display: 'flex', flexDirection: 'column', flex: '1 0 0', minHeight: 0, width: '100%' }}>
                <div style={{ flexShrink: 0, padding: '8px 8px 4px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <SectionLabel>Your folders</SectionLabel>
                  <SidebarMenuItem
                    label="New folder"
                    fluid
                    icon={<FolderAddIcon size={20} />}
                    onClick={onNewFolderClick}
                  />
                </div>
                <div style={{ position: 'relative', flex: '1 0 0', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <div
                    ref={folderListRef}
                    className="kaya-scrollbar"
                    style={{
                      flex:                '1 0 0',
                      minHeight:           0,
                      overflowY:           'auto',
                      overflowX:           'hidden',
                      overscrollBehaviorY: 'contain',
                      display:             'flex',
                      flexDirection:       'column',
                      gap:                 4,
                      padding:             '0 8px 8px',
                    }}
                    onScroll={(e) => {
                      const el = e.currentTarget
                      setShowFolderBlur(el.scrollHeight - el.scrollTop - el.clientHeight > 4)
                    }}
                  >
                {personalFolders.map((f) => (
                  <div
                    key={f.id}
                    style={{ position: 'relative', width: '100%' }}
                    onMouseEnter={() => setHoveredFolderId(f.id)}
                    onMouseLeave={() => setHoveredFolderId(null)}
                  >
                    <SidebarMenuItem
                      label={f.label.length > 20 ? f.label.slice(0, 20) + '…' : f.label}
                      fluid
                      icon={<FolderOneIcon size={20} variant="static" animated />}
                      selected={activeSidebarId === f.id}
                      onClick={() => onSidebarItemClick?.(f.id)}
                    />
                    {/* eslint-disable-next-line click-events-have-key-events, no-static-element-interactions -- interactive div; keyboard handling delegated to inner elements */}
                    <div
                      style={{
                        position:      'absolute',
                        right:         4,
                        top:           '50%',
                        transform:     'translateY(-50%)',
                        zIndex:        1,
                        opacity:       hoveredFolderId === f.id || openFolderMenuId === f.id ? 1 : 0,
                        pointerEvents: hoveredFolderId === f.id || openFolderMenuId === f.id ? 'auto' : 'none',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Dropdown.Float
                        open={openFolderMenuId === f.id}
                        onOpenChange={(open) => setOpenFolderMenuId(open ? f.id : null)}
                        placement="bottom-end"
                        trigger={
                          <IconButton
                            variant="ghost"
                            size="sm"
                            icon={<MoreVerticalIcon size={16} animated />}
                            aria-label={`Options for ${f.label}`}
                          />
                        }
                      >
                        <Dropdown>
                          <Dropdown.Section fluid>
                            <Dropdown.Item
                              label="Rename"
                              icon={<PenOneIcon size={16} animated />}
                              onClick={() => {
                                setOpenFolderMenuId(null)
                                onFolderRename?.(f.id, f.label)
                              }}
                              fluid
                            />
                            <Dropdown.Item
                              label="Delete"
                              icon={<DeleteTwoIcon size={16} animated />}
                              onClick={() => {
                                setOpenFolderMenuId(null)
                                onFolderDelete?.(f.id)
                              }}
                              fluid
                            />
                          </Dropdown.Section>
                        </Dropdown>
                      </Dropdown.Float>
                    </div>
                  </div>
                ))}
                  </div>
                  {showFolderBlur && (
                    <div style={{
                      position:      'absolute',
                      bottom:        0,
                      left:          0,
                      right:         0,
                      height:        40,
                      background:    'linear-gradient(to bottom, transparent, var(--color-surface-glass))',
                      pointerEvents: 'none',
                      zIndex:        1,
                    }} />
                  )}
                </div>
              </div>

              {/* Project folders */}
              {projectFolders.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 8, width: '100%', flexShrink: 0 }}>
                <SectionLabel>Project folders</SectionLabel>
                {projectFolders.map((f) => (
                  <div
                    key={f.id}
                    style={{ position: 'relative', width: '100%' }}
                    onMouseEnter={() => setHoveredFolderId(f.id)}
                    onMouseLeave={() => setHoveredFolderId(null)}
                  >
                    <SidebarMenuItem
                      label={f.label}
                      fluid
                      icon={<FolderOneIcon size={20} variant="static" animated />}
                      selected={activeSidebarId === f.id}
                      onClick={() => onSidebarItemClick?.(f.id)}
                    />
                    {/* eslint-disable-next-line click-events-have-key-events, no-static-element-interactions -- interactive div; keyboard handling delegated to inner elements */}
                    <div
                      style={{
                        position:      'absolute',
                        right:         4,
                        top:           '50%',
                        transform:     'translateY(-50%)',
                        zIndex:        1,
                        opacity:       hoveredFolderId === f.id || openFolderMenuId === f.id ? 1 : 0,
                        pointerEvents: hoveredFolderId === f.id || openFolderMenuId === f.id ? 'auto' : 'none',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Dropdown.Float
                        open={openFolderMenuId === f.id}
                        onOpenChange={(open) => setOpenFolderMenuId(open ? f.id : null)}
                        placement="bottom-end"
                        trigger={
                          <IconButton
                            variant="ghost"
                            size="sm"
                            icon={<MoreVerticalIcon size={16} animated />}
                            aria-label={`Options for ${f.label}`}
                          />
                        }
                      >
                        <Dropdown>
                          <Dropdown.Section fluid>
                            <Dropdown.Item
                              label="Rename"
                              onClick={() => {
                                setOpenFolderMenuId(null)
                                onFolderRename?.(f.id, f.label)
                              }}
                              fluid
                            />
                            <Dropdown.Item
                              label="Delete"
                              onClick={() => {
                                setOpenFolderMenuId(null)
                                onFolderDelete?.(f.id)
                              }}
                              fluid
                            />
                          </Dropdown.Section>
                        </Dropdown>
                      </Dropdown.Float>
                    </div>
                  </div>
                ))}
              </div>
              )}
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
                  <div style={{ display: 'flex', alignItems: 'flex-start', paddingLeft: 4, width: '100%', overflow: 'hidden' }}>
                    <p
                      style={{
                        flex:       '1 0 0',
                        minWidth:   1,
                        margin:     0,
                        fontFamily: 'var(--font-title)',
                        fontWeight: 400,
                        fontSize:   24,
                        lineHeight: '32px',
                        color:      'var(--neutral-900)',
                        overflow:   'hidden',
                      }}
                    >
                      <AnimatePresence mode="popLayout" initial={false}>
                        <m.span
                          key={activeSidebarId}
                          initial={{ opacity: 0, filter: 'blur(4px)' }}
                          animate={{ opacity: 1, filter: 'blur(0px)' }}
                          exit={{    opacity: 0, filter: 'blur(4px)' }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                        >
                          {viewTitle}
                        </m.span>
                      </AnimatePresence>
                    </p>
                  </div>
                  {/* Pin count + update info - Figma 2579:35146 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                    <Badge color="Neutral" label={`${pinCount} pins`} />
                    {updatedLabel && <Badge color="Neutral" label={updatedLabel} />}
                  </div>
                </div>

                {/* Actions - Figma 2565:34109. gap-[12px] between Organise and Close.
                    Organise button fades out when isOrganizing - the Done button
                    inside the action row replaces it functionally. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <AnimatePresence initial={false} mode="popLayout">
                    {!isOrganizing && (
                      <m.span
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
                      </m.span>
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
                {/* ── Search + Filter + Sort row (EnterChunk index 1.5) ──
                    Sits where the tab bar previously lived, above the
                    organize-mode action row. Search calls `onSearch` so the
                    parent can re-filter `pins`; filter/sort menus are the
                    same nodes used in compact Pinboard (shared state).
                    Order (KDS): Search → Export → Filter → Sort. ── */}
                <EnterChunk
                  cfg={enterAnimation}
                  index={1.5}
                  style={{
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'flex-end',
                    gap:            4,
                    width:          '100%',
                    flexShrink:     0,
                  }}
                >
                  {/* Search slot - snaps from 32px (icon button) to
                      full-flex (InputField) on toggle, matching the
                      compact PinboardHeader pattern from KDS. */}
                  <Tooltip content="Search" disabled={openPanel === 'search'}>
                    <m.div
                      layout
                      transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                      style={{
                        display:    'flex',
                        alignItems: 'center',
                        flexShrink: openPanel === 'search' ? 1 : 0,
                        flex:       openPanel === 'search' ? '1 0 0' : undefined,
                        minWidth:   0,
                        width:      openPanel === 'search' ? undefined : 32,
                      }}
                    >
                      <AnimatePresence initial={false} mode="popLayout">
                        {openPanel !== 'search' ? (
                          <m.span
                            key="search-btn"
                            layout
                            initial={{ opacity: 0, y: 4, filter: 'blur(4px)' }}
                            animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transition: { type: 'spring', duration: 0.3, bounce: 0 } }}
                            exit={{    opacity: 0, scale: 0.25, filter: 'blur(4px)', transition: { type: 'spring', duration: 0.2, bounce: 0 } }}
                            style={{ display: 'inline-flex', flexShrink: 0 }}
                          >
                            <IconButton
                              variant="secondary"
                              size="sm"
                              icon={<SearchOneIcon size={20} />}
                              aria-label="Open search"
                              onClick={() => setOpenPanel('search')}
                            />
                          </m.span>
                        ) : (
                          <m.div
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
                                  className="kds-icon-in-field"
                                  onClick={() => {
                                    setOpenPanel(null)
                                    setExpandedSearch('')
                                    onSearch?.('')
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      setOpenPanel(null)
                                      setExpandedSearch('')
                                      onSearch?.('')
                                    }
                                  }}
                                  style={{ display: 'inline-flex', cursor: 'pointer', lineHeight: 0 }}
                                >
                                  <CancelCircleIcon size={16} />
                                </span>
                              }
                              placeholder="Search by chat name…"
                              value={expandedSearch}
                              onChange={(v) => {
                                setExpandedSearch(v)
                                onSearch?.(v)
                              }}
                              // eslint-disable-next-line jsx-a11y/no-autofocus, react-doctor/no-autofocus -- focus moves into search on user-triggered open
                              autoFocus
                              aria-label="Search pins"
                            />
                          </m.div>
                        )}
                      </AnimatePresence>
                    </m.div>
                  </Tooltip>

                  {/* Export - second slot per KDS order */}
                  {onExport && (
                    <m.div layout style={{ display: 'inline-flex' }} transition={{ type: 'spring', stiffness: 500, damping: 32 }}>
                      <Tooltip content="Export">
                        <IconButton
                          variant="secondary"
                          size="sm"
                          icon={<DownloadThreeIcon size={20} />}
                          aria-label="Export pins"
                          onClick={onExport}
                        />
                      </Tooltip>
                    </m.div>
                  )}

                  {/* Filter dropdown */}
                  <m.div layout style={{ display: 'inline-flex' }} transition={{ type: 'spring', stiffness: 500, damping: 32 }}>
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
                      <Dropdown.Float
                        open={openPanel === 'filter'}
                        onOpenChange={(open) => setOpenPanel(open ? 'filter' : null)}
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

                  {/* Sort dropdown */}
                  {sortMenu !== null && (
                    <m.div layout style={{ display: 'inline-flex' }} transition={{ type: 'spring', stiffness: 500, damping: 32 }}>
                      {sortMenu != null ? (
                        <Dropdown.Float
                          open={openPanel === 'sort'}
                          onOpenChange={(open) => setOpenPanel(open ? 'sort' : null)}
                          placement="bottom-end"
                          trigger={
                            <Tooltip content="Sort">
                              <IconButton
                                variant="secondary"
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
                            variant="secondary"
                            size="sm"
                            icon={<ArrowUpDownIcon size={20} />}
                            aria-label="Sort pins"
                          />
                        </Tooltip>
                      )}
                    </m.div>
                  )}
                </EnterChunk>

                {/* Organize action row — mounts only during organize mode. */}
                <EnterChunk
                  cfg={enterAnimation}
                  index={2}
                  style={{
                    display:    'flex',
                    alignItems: 'center',
                    width:      '100%',
                    flexShrink: 0,
                    position:   'relative',
                  }}
                >
                  <AnimatePresence initial={false} mode="popLayout">

                  {/* Organize action row - fades in when isOrganizing.
                      Figma 3457:24212. Move to folder + Export + Delete on
                      the left, Done on the right. */}
                  {isOrganizing && (
                    <m.div
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
                          open={openPanel === 'moveToFolder'}
                          onOpenChange={(open) => setOpenPanel(open ? 'moveToFolder' : null)}
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
                                    onClick={() => {
                                      onMoveToFolder?.([...selectedPinIds], f.id, f.label)
                                      setOpenPanel(null)
                                      setSelectedPinIds(new Set())
                                    }}
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
                                    onClick={() => {
                                      onMoveToFolder?.([...selectedPinIds], f.id, f.label)
                                      setOpenPanel(null)
                                      setSelectedPinIds(new Set())
                                    }}
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
                          onClick={() => onExportSelected?.([...selectedPinIds])}
                        >
                          Export
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          leftIcon={<DeleteTwoIcon size={16} />}
                          disabled={selectedPinIds.size === 0}
                          onClick={() => {
                            onDeleteSelected?.([...selectedPinIds])
                            handleOrganizeDone()
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                      {/* eslint-disable-next-line react-doctor/design-no-vague-button-label -- "Done" exits organize mode; context from organize toolbar makes action clear */}
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleOrganizeDone}
                      >
                        Done
                      </Button>
                    </m.div>
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
                      <m.div
                        key="expanded-filter-bar"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{    height: 0, opacity: 0 }}
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        style={{ overflow: 'hidden', width: '100%' }}
                      >
                        {filterBar}
                      </m.div>
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
                      // eslint-disable-next-line react-doctor/no-outline-none -- browser outline suppressed; :focus-visible handled by container or global styles
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
                                  selectable={isOrganizing}
                                  selected={selectedPinIds.has(id)}
                                  onSelectedChange={(next) => togglePinSelected(id, next)}
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
}

PinboardExpanded.displayName = 'PinboardExpanded'
export default PinboardExpanded
