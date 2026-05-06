'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CancelOneIcon,
  SearchOneIcon,
  CancelCircleIcon,
  FilterMailIcon,
  ArrowUpDownIcon,
  FolderAddIcon,
  FolderOneIcon,
  FolderLibraryIcon,
  DownloadThreeIcon,
  TickTwoIcon,
  UnfoldLessIcon,
  DashboardSquareOneIcon,
  ShapesOneIcon,
  StarIcon,
  SourceCodeSquareIcon,
} from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { InputField } from '@/components/InputField'
import { Tabs, TabsList, TabsTrigger } from '@/components/Tabs'
import { Pin } from '@/components/Pin'
import { Tooltip } from '@/components/Tooltip'
import { Badge } from '@/components/Badge'
import { SidebarMenuItem } from '@/components/SidebarMenuItem'
import { type PinboardPin } from '@/components/Pinboard'
import { usePinboard, type PinItem, type PinCategory } from '@/context/pinboard-context'
import type { BadgeColor } from '@/components/Badge'
import { apiFetch, apiFetchJson } from '@/lib/api/client'
import {
  PIN_FOLDERS_ENDPOINT,
  PIN_FOLDERS_CREATE_ENDPOINT,
  PIN_DETAIL_ENDPOINT,
  PIN_MOVE_ENDPOINT,
} from '@/lib/config'
import { EnterChunk, PINBOARD_EXPANDED_ENTER_DEFAULT } from './pinboardEnterAnimation'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PinFolder {
  id:    string
  name:  string
  type?: 'personal' | 'project'
}

type FolderFilter  = 'all' | 'unorganized' | string
type SortField     = 'date_created' | 'title' | 'category'
type SortDirection = 'asc' | 'desc'

interface SortConfig {
  field:     SortField
  direction: SortDirection
}

export interface PinboardExpandedProps {
  onClose:   () => void
  onExport?: (pinIds?: string[]) => void
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_TABS: Array<{ value: string; label: string; icon?: React.ReactNode }> = [
  { value: 'all',      label: 'All' },
  { value: 'Favorites', label: 'Favorites', icon: <StarIcon size={16} /> },
  { value: 'Code',     label: 'Code',       icon: <SourceCodeSquareIcon size={16} /> },
  { value: 'Research', label: 'Research' },
  { value: 'Creative', label: 'Creative' },
  { value: 'Planning', label: 'Planning' },
  { value: 'Tasks',    label: 'Tasks' },
  { value: 'Quote',    label: 'Quote' },
  { value: 'Workflow', label: 'Workflow' },
]

const CATEGORY_COLOR: Record<PinCategory, BadgeColor> = {
  Code:     'Green',
  Research: 'Blue',
  Creative: 'Purple',
  Planning: 'Yellow',
  Tasks:    'Red',
  Quote:    'Brown',
  Workflow: 'Neutral',
}

const TAG_COLORS: BadgeColor[] = ['Blue', 'Green', 'Purple', 'Yellow', 'Red', 'Neutral', 'Brown']

// Width math mirrors DS PinboardExpanded exactly
const CVW_WIDTH       = 644
const ICON_BUTTON_W   = 32
const ICON_BUTTON_GAP = 4
const ROW_GAP         = 32
const SEARCH_OPEN_W   = 276

// ── Helpers ───────────────────────────────────────────────────────────────────

function pinItemToKDS(item: PinItem): PinboardPin {
  const tagLabels: { color: BadgeColor; text: string }[] =
    item.tags && item.tags.length > 0
      ? item.tags.map((tag, i) => ({ color: TAG_COLORS[i % TAG_COLORS.length], text: tag }))
      : [{ color: CATEGORY_COLOR[item.category], text: item.category }];

  return {
    id:          item.id,
    category:    item.category,
    pinTitle:    item.title || item.content.split("\n")[0].slice(0, 120) || "Untitled Pin",
    description: item.content,
    chatName:    item.chatName ?? '',
    labels: [
      ...tagLabels,
      ...(item.modelName ? [{ color: 'Neutral' as BadgeColor, text: item.modelName }] : []),
    ],
  }
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

// ── SectionLabel — matches DS PinboardExpanded's SectionLabel ─────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'space-between',
      padding:        '5px 6px',
      borderRadius:   10,
      width:          '100%',
    }}>
      <span style={{
        fontFamily: 'var(--font-body)',
        fontWeight: 500,
        fontSize:   11,
        lineHeight: '16px',
        color:      'var(--neutral-500)',
        whiteSpace: 'nowrap',
      }}>
        {children}
      </span>
    </div>
  )
}

// ── EmptyState ────────────────────────────────────────────────────────────────

function EmptyState({ title, description, action }: {
  title:        string
  description?: string
  action?:      { label: string; onClick: () => void }
}) {
  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            8,
      padding:        '48px 24px',
      textAlign:      'center',
      width:          '100%',
    }}>
      <p style={{
        margin:     0,
        fontFamily: 'var(--font-body)',
        fontWeight: 'var(--font-weight-medium)',
        fontSize:   'var(--font-size-body)',
        lineHeight: 'var(--line-height-body)',
        color:      'var(--neutral-700)',
      }}>
        {title}
      </p>
      {description && (
        <p style={{
          margin:     0,
          fontFamily: 'var(--font-body)',
          fontWeight: 'var(--font-weight-regular)',
          fontSize:   'var(--font-size-caption)',
          lineHeight: 'var(--line-height-caption)',
          color:      'var(--neutral-500)',
        }}>
          {description}
        </p>
      )}
      {action && (
        <Button variant="ghost" size="sm" onClick={action.onClick}>{action.label}</Button>
      )}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PinboardExpanded({ onClose, onExport }: PinboardExpandedProps) {
  const { pins, removePin } = usePinboard()
  const enterAnimation = PINBOARD_EXPANDED_ENTER_DEFAULT

  // ── Folder state ──────────────────────────────────────────────────────────
  const [folders,           setFolders]           = useState<PinFolder[]>([])
  const [activeFolderId,    setActiveFolderId]    = useState<FolderFilter>('all')
  const [isCreatingFolder,  setIsCreatingFolder]  = useState(false)
  const [newFolderName,     setNewFolderName]     = useState('')
  const [editingFolderId,   setEditingFolderId]   = useState<string | null>(null)
  const [editingFolderName, setEditingFolderName] = useState('')
  const newFolderInputRef = useRef<HTMLInputElement>(null)

  // ── View state ────────────────────────────────────────────────────────────
  const [activeTab,    setActiveTab]    = useState('all')
  const [rawSearch,    setRawSearch]    = useState('')
  const [searchOpen,   setSearchOpen]   = useState(false)
  const [sortConfig,   setSortConfig]   = useState<SortConfig>({ field: 'date_created', direction: 'desc' })
  const searchQuery = useDebounce(rawSearch, 150)

  // ── Organize mode ─────────────────────────────────────────────────────────
  const [isOrganizing,   setIsOrganizing]   = useState(false)
  const [selectedPinIds, setSelectedPinIds] = useState<Set<string>>(new Set())
  const [collapseSignal, setCollapseSignal] = useState(0)

  // ── Expanded pin tracking ─────────────────────────────────────────────────
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const hasExpanded = expandedIds.size > 0

  // ── Tabs + search width math (mirrors DS PinboardExpanded) ────────────────
  const tabsContainerRef = useRef<HTMLDivElement>(null)
  const buttonCount      = hasExpanded ? 5 : 4
  const baseClusterWidth = buttonCount * ICON_BUTTON_W + (buttonCount - 1) * ICON_BUTTON_GAP
  const clusterWidth     = searchOpen
    ? baseClusterWidth + (SEARCH_OPEN_W - ICON_BUTTON_W)
    : baseClusterWidth
  const tabsAreaWidth    = CVW_WIDTH - ROW_GAP - clusterWidth
  const searchSlotWidth  = searchOpen ? SEARCH_OPEN_W : ICON_BUTTON_W

  useEffect(() => {
    const root = tabsContainerRef.current
    if (!root) return
    const active = root.querySelector<HTMLElement>('[data-state="active"]')
    if (!active) return
    active.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' })
  }, [searchOpen, hasExpanded])

  // ── Scroll edge fades ─────────────────────────────────────────────────────
  const scrollRef  = useRef<HTMLDivElement>(null)
  const [atTop,    setAtTop]    = useState(true)
  const [atBottom, setAtBottom] = useState(false)

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    setAtTop(el.scrollTop < 8)
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 8)
  }

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

  // ── Collapse all ──────────────────────────────────────────────────────────
  const handleCollapseAll = () => setCollapseSignal((s) => s + 1)

  const handlePinExpandedChange = useCallback(
    (id: string) => (expanded: boolean) => {
      setExpandedIds((prev) => {
        const has = prev.has(id)
        if (expanded === has) return prev
        const next = new Set(prev)
        if (expanded) next.add(id)
        else          next.delete(id)
        return next
      })
    },
    [],
  )

  // ── Fetch folders on mount ────────────────────────────────────────────────
  useEffect(() => {
    apiFetch(PIN_FOLDERS_ENDPOINT)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: unknown) => {
        if (Array.isArray(data))
          setFolders(data as PinFolder[])
        else if (data && Array.isArray((data as { data?: unknown }).data))
          setFolders((data as { data: PinFolder[] }).data)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (isCreatingFolder) newFolderInputRef.current?.focus()
  }, [isCreatingFolder])

  // ── Folder operations ─────────────────────────────────────────────────────

  const handleCreateFolder = async () => {
    const name = newFolderName.trim()
    if (!name) { setIsCreatingFolder(false); setNewFolderName(''); return }
    const optimisticId = `folder-${Date.now()}`
    setFolders(prev => [...prev, { id: optimisticId, name, type: 'personal' }])
    setIsCreatingFolder(false)
    setNewFolderName('')
    try {
      const created = await apiFetchJson<PinFolder>(PIN_FOLDERS_CREATE_ENDPOINT, {
        method: 'POST',
        body:   JSON.stringify({ name }),
      })
      setFolders(prev => prev.map(f => f.id === optimisticId ? created : f))
    } catch {
      setFolders(prev => prev.filter(f => f.id !== optimisticId))
    }
  }

  const handleRenameFolder = async (folderId: string) => {
    const name = editingFolderName.trim()
    setEditingFolderId(null)
    if (!name) return
    setFolders(prev => prev.map(f => f.id === folderId ? { ...f, name } : f))
    try {
      await apiFetch(`${PIN_FOLDERS_CREATE_ENDPOINT}/${folderId}`, {
        method: 'PATCH',
        body:   JSON.stringify({ name }),
      })
    } catch {}
  }

  const handleDeleteFolder = async (folderId: string) => {
    setFolders(prev => prev.filter(f => f.id !== folderId))
    if (activeFolderId === folderId) setActiveFolderId('all')
    try {
      await apiFetch(`${PIN_FOLDERS_CREATE_ENDPOINT}/${folderId}`, { method: 'DELETE' })
    } catch {}
  }

  // ── Pin operations ────────────────────────────────────────────────────────

  const handleMoveToFolder = async (folderId: string | null) => {
    for (const pinId of selectedPinIds) {
      try {
        await apiFetch(PIN_MOVE_ENDPOINT(pinId), {
          method: 'PATCH',
          body:   JSON.stringify({ folder_id: folderId }),
        })
      } catch {}
    }
    setSelectedPinIds(new Set())
  }

  const handleDeleteSelected = async () => {
    const ids = Array.from(selectedPinIds)
    ids.forEach(id => removePin(id))
    setSelectedPinIds(new Set())
    for (const id of ids) {
      try {
        await apiFetch(PIN_DETAIL_ENDPOINT(id), { method: 'DELETE' })
      } catch {}
    }
  }

  const handleExport = () => {
    const ids = selectedPinIds.size > 0 ? Array.from(selectedPinIds) : undefined
    onExport?.(ids)
  }

  const handleExitOrganize = () => {
    setIsOrganizing(false)
    setSelectedPinIds(new Set())
  }

  // ── Filtering & sorting ───────────────────────────────────────────────────

  const filteredPins = (() => {
    let result: PinItem[] = pins

    if (activeTab !== 'all' && activeTab !== 'Favorites') {
      result = result.filter(p => p.category === activeTab)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        p => p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q),
      )
    }

    result = [...result].sort((a, b) => {
      let cmp = 0
      if      (sortConfig.field === 'date_created') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      else if (sortConfig.field === 'title')        cmp = a.title.localeCompare(b.title)
      else if (sortConfig.field === 'category')     cmp = a.category.localeCompare(b.category)
      return sortConfig.direction === 'asc' ? cmp : -cmp
    })

    return result
  })()

  const visiblePins = filteredPins.map(pinItemToKDS)

  const emptyState = (() => {
    if (pins.length === 0)
      return { title: 'No pins yet', description: 'Pin any chat message to save it here.' }
    if (searchQuery.trim() && filteredPins.length === 0)
      return { title: `No results for "${searchQuery}"` }
    if (filteredPins.length === 0)
      return {
        title:  'No pins match these filters',
        action: {
          label:   'Clear filters',
          onClick: () => { setActiveTab('all'); setRawSearch(''); setActiveFolderId('all') },
        },
      }
    return null
  })()

  // ── Pin selection ─────────────────────────────────────────────────────────
  const togglePin = useCallback((id: string) => {
    setSelectedPinIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else              next.add(id)
      return next
    })
  }, [])

  // ── Keyboard: Escape exits organize or closes ─────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (isOrganizing) handleExitOrganize()
      else              onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOrganizing, onClose])

  const personalFolders = folders.filter(f => !f.type || f.type === 'personal')
  const projectFolders  = folders.filter(f => f.type === 'project')

  const activeTitle = activeFolderId === 'all'         ? 'All pins'
                    : activeFolderId === 'unorganized'  ? 'Unorganized pins'
                    : folders.find(f => f.id === activeFolderId)?.name ?? 'Pins'

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pinboard"
      style={{
        position:        'fixed',
        inset:           0,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        zIndex:          50,
        backgroundColor: 'var(--neutral-900-40, rgba(38,33,30,0.4))',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{   opacity: 0, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 260, damping: 32 }}
        style={{
          width:        924,
          height:       817,
          maxWidth:     'calc(100vw - 32px)',
          maxHeight:    'calc(100vh - 32px)',
          borderRadius: 28,
          boxShadow:    '0px 24px 48px -12px rgba(38,33,30,0.18), 0px 0px 0px 1px rgba(82,75,71,0.12)',
          display:      'flex',
          overflow:     'hidden',
        }}
      >
        {/* ── Outer flex row — matches DS PinboardExpanded outer container ── */}
        <div
          style={{
            display:      'flex',
            alignItems:   'center',
            width:        '100%',
            height:       '100%',
            padding:      '0 8px',
            background:   'var(--neutral-50)',
            borderRadius: 'inherit',
            isolation:    'isolate',
            overflow:     'hidden',
          }}
        >
          {/* ══ Sidebar (EnterChunk 0) ══ */}
          <EnterChunk
            cfg={enterAnimation}
            index={0}
            style={{
              display:       'flex',
              flexDirection: 'column',
              height:        '100%',
              padding:       '8px 0',
              flexShrink:    0,
              zIndex:        2,
              background:    'var(--neutral-50)',
            }}
          >
            {/* Sidebar card */}
            <div
              style={{
                display:     'flex',
                alignItems:  'flex-start',
                flex:        '1 0 0',
                minHeight:   0,
                borderRadius: 20,
                background:  'rgba(255, 255, 255, 0.2)',
                boxShadow:   '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-200)',
                overflow:    'hidden',
              }}
            >
              {/* Sidebar inner — scrollable */}
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
                    variant="default"
                    fluid
                    label="All pins"
                    icon={<DashboardSquareOneIcon size={20} />}
                    selected={activeFolderId === 'all'}
                    onClick={() => setActiveFolderId('all')}
                  />
                  <SidebarMenuItem
                    variant="default"
                    fluid
                    label="Unorganized pins"
                    icon={<ShapesOneIcon size={20} />}
                    selected={activeFolderId === 'unorganized'}
                    onClick={() => setActiveFolderId('unorganized')}
                  />
                </div>

                {/* Your folders */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 8, width: '100%', overflow: 'hidden' }}>
                  <SectionLabel>Your folders</SectionLabel>
                  {isCreatingFolder ? (
                    <div style={{ padding: '0 2px' }}>
                      <InputField
                        ref={newFolderInputRef}
                        value={newFolderName}
                        onChange={setNewFolderName}
                        onBlur={handleCreateFolder}
                        onKeyDown={e => {
                          if (e.key === 'Enter')  handleCreateFolder()
                          if (e.key === 'Escape') { setIsCreatingFolder(false); setNewFolderName('') }
                        }}
                        placeholder="Folder name"
                        fluid
                        size="small"
                        aria-label="New folder name"
                      />
                    </div>
                  ) : (
                    <SidebarMenuItem
                      variant="default"
                      fluid
                      label="New folder"
                      icon={<FolderAddIcon size={20} />}
                      onClick={() => setIsCreatingFolder(true)}
                    />
                  )}
                  {personalFolders.map(folder =>
                    editingFolderId === folder.id ? (
                      <div key={folder.id} style={{ padding: '0 2px' }}>
                        <InputField
                          value={editingFolderName}
                          onChange={setEditingFolderName}
                          onBlur={() => handleRenameFolder(folder.id)}
                          onKeyDown={e => {
                            if (e.key === 'Enter')  handleRenameFolder(folder.id)
                            if (e.key === 'Escape') setEditingFolderId(null)
                          }}
                          fluid
                          size="small"
                          autoFocus
                          aria-label="Rename folder"
                        />
                      </div>
                    ) : (
                      <SidebarFolderItem
                        key={folder.id}
                        folder={folder}
                        active={activeFolderId === folder.id}
                        onClick={() => setActiveFolderId(folder.id)}
                        onRename={() => { setEditingFolderId(folder.id); setEditingFolderName(folder.name) }}
                        onDelete={() => handleDeleteFolder(folder.id)}
                      />
                    )
                  )}
                </div>

                {/* Project folders */}
                {projectFolders.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 8, width: '100%', overflow: 'hidden' }}>
                    <SectionLabel>Project folders</SectionLabel>
                    {projectFolders.map(folder =>
                      editingFolderId === folder.id ? (
                        <div key={folder.id} style={{ padding: '0 2px' }}>
                          <InputField
                            value={editingFolderName}
                            onChange={setEditingFolderName}
                            onBlur={() => handleRenameFolder(folder.id)}
                            onKeyDown={e => {
                              if (e.key === 'Enter')  handleRenameFolder(folder.id)
                              if (e.key === 'Escape') setEditingFolderId(null)
                            }}
                            fluid
                            size="small"
                            autoFocus
                            aria-label="Rename folder"
                          />
                        </div>
                      ) : (
                        <SidebarFolderItem
                          key={folder.id}
                          folder={folder}
                          active={activeFolderId === folder.id}
                          onClick={() => setActiveFolderId(folder.id)}
                          onRename={() => { setEditingFolderId(folder.id); setEditingFolderName(folder.name) }}
                          onDelete={() => handleDeleteFolder(folder.id)}
                        />
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          </EnterChunk>

          {/* ══ Right content column ══ */}
          <div
            style={{
              display:       'flex',
              flexDirection: 'column',
              flex:          '1 1 0',
              minWidth:      0,
              height:        '100%',
              paddingTop:    8,
              background:    'var(--neutral-50)',
              zIndex:        1,
            }}
          >
            {/* Content wrapper — no alignItems so children stretch vertically */}
            <div
              style={{
                display:      'flex',
                flex:         '1 0 0',
                minHeight:    1,
                padding:      12,
                borderRadius: 20,
                overflow:     'hidden',
              }}
            >
              {/* Content vertical wrapper — stretches to fill wrapper height via default alignItems:stretch */}
              <div
                style={{
                  display:       'flex',
                  flexDirection: 'column',
                  alignItems:    'flex-start',
                  gap:           24,
                  flex:          '1 0 0',
                  minHeight:     0,
                }}
              >
                {/* ── Header (EnterChunk 1) ── */}
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
                  {/* Pins info */}
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
                        {activeTitle}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                      <Badge color="Neutral" label={`${visiblePins.length} pins`} />
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    {isOrganizing ? (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleExitOrganize}
                      >
                        Done
                      </Button>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        leftIcon={<FolderLibraryIcon size={16} />}
                        onClick={() => setIsOrganizing(true)}
                      >
                        Organise
                      </Button>
                    )}
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

                {/* ── Pin Cards Container ── */}
                <div
                  style={{
                    display:       'flex',
                    flexDirection: 'column',
                    gap:           12,
                    flex:          '1 0 0',
                    minHeight:     1,
                    width:         '100%',
                  }}
                >
                  {/* Tabs + secondary actions cluster (EnterChunk 2) */}
                  <EnterChunk
                    cfg={enterAnimation}
                    index={2}
                    style={{
                      display:    'flex',
                      alignItems: 'center',
                      gap:        ROW_GAP,
                      width:      '100%',
                      flexShrink: 0,
                    }}
                  >
                    {/* Tabs strip — width snaps via style.width matching DS behavior */}
                    <div
                      ref={tabsContainerRef}
                      style={{
                        flex:     '0 0 auto',
                        minWidth: 1,
                        padding:  '1px 0 1px 1px',
                        overflow: 'hidden',
                        width:    tabsAreaWidth,
                      }}
                    >
                      <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList size="small" scrollable>
                          {CATEGORY_TABS.map(t => (
                            <TabsTrigger key={t.value} value={t.value} icon={t.icon}>
                              {t.label}
                            </TabsTrigger>
                          ))}
                        </TabsList>
                      </Tabs>
                    </div>

                    {/* Secondary actions cluster — right-anchored, gap-4 */}
                    <div
                      style={{
                        display:        'flex',
                        alignItems:     'center',
                        justifyContent: 'flex-end',
                        gap:            4,
                        flexShrink:     0,
                      }}
                    >
                      {/* Search slot — snaps 32px ↔ 276px on toggle */}
                      <Tooltip content="Search" disabled={searchOpen}>
                        <motion.div
                          layout
                          layoutDependency={hasExpanded}
                          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                          style={{
                            display:    'flex',
                            alignItems: 'center',
                            flexShrink: 0,
                            minWidth:   0,
                            width:      searchSlotWidth,
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
                                  onClick={() => setSearchOpen(true)}
                                />
                              </motion.span>
                            ) : (
                              <motion.div
                                key="search-input"
                                initial={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
                                animate={{ opacity: 1, scale: 1,    filter: 'blur(0px)', transition: { type: 'spring', duration: 0.3, bounce: 0 } }}
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
                                      onClick={() => { setSearchOpen(false); setRawSearch('') }}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                          setSearchOpen(false)
                                          setRawSearch('')
                                        }
                                      }}
                                      style={{ display: 'inline-flex', cursor: 'pointer', lineHeight: 0 }}
                                    >
                                      <CancelCircleIcon size={16} />
                                    </span>
                                  }
                                  placeholder="Search for your pin..."
                                  value={rawSearch}
                                  onChange={setRawSearch}
                                  autoFocus
                                  aria-label="Search pins"
                                />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      </Tooltip>

                      {/* Export */}
                      <motion.div
                        layout
                        style={{ display: 'inline-flex' }}
                        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                      >
                        <Tooltip content="Export">
                          <IconButton
                            variant="ghost"
                            size="sm"
                            icon={<DownloadThreeIcon size={20} />}
                            aria-label="Export pins"
                            onClick={handleExport}
                          />
                        </Tooltip>
                      </motion.div>

                      {/* Collapse all — conditional, hides in organize mode */}
                      <AnimatePresence initial={false} mode="popLayout">
                        {hasExpanded && !isOrganizing && (
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

                      {/* Filter */}
                      <motion.span
                        layout
                        style={{ display: 'inline-flex' }}
                        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                      >
                        <Tooltip content="Filter">
                          <IconButton
                            variant="ghost"
                            size="sm"
                            icon={<FilterMailIcon size={20} />}
                            aria-label="Filter pins"
                          />
                        </Tooltip>
                      </motion.span>

                      {/* Sort */}
                      <motion.span
                        layout
                        style={{ display: 'inline-flex' }}
                        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                      >
                        <Tooltip content="Sort">
                          <IconButton
                            variant="ghost"
                            size="sm"
                            icon={<ArrowUpDownIcon size={20} />}
                            aria-label="Sort pins"
                          />
                        </Tooltip>
                      </motion.span>
                    </div>
                  </EnterChunk>

                  {/* ── Scrollable pin grid ── */}
                  <div
                    style={{
                      position:  'relative',
                      flex:      '1 0 0',
                      minHeight: 1,
                      width:     '100%',
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
                        padding:             '2px',
                        outline:             'none',
                      }}
                    >
                      {visiblePins.length === 0 && emptyState ? (
                        <EmptyState
                          title={emptyState.title}
                          description={'description' in emptyState ? emptyState.description : undefined}
                          action={'action' in emptyState ? emptyState.action : undefined}
                        />
                      ) : (
                        // Masonry: 2 flex columns split by index parity — each column
                        // packs independently so short pins don't leave dead space.
                        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                          {[0, 1].map(col => (
                            <div
                              key={col}
                              style={{
                                display:       'flex',
                                flexDirection: 'column',
                                gap:           8,
                                flex:          '1 1 0',
                                minWidth:      0,
                              }}
                            >
                              {visiblePins.map((p, i) => {
                                if (i % 2 !== col) return null
                                const { id, ...pinProps } = p
                                const chunkIndex = Math.floor(i / 2) + 3
                                return (
                                  <EnterChunk key={id} cfg={enterAnimation} index={chunkIndex}>
                                    <PinGridCell
                                      pin={p}
                                      isOrganizing={isOrganizing}
                                      isSelected={selectedPinIds.has(id)}
                                      collapseSignal={collapseSignal}
                                      onToggle={() => togglePin(id)}
                                      onExpandedChange={handlePinExpandedChange(id)}
                                    />
                                  </EnterChunk>
                                )
                              })}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Top edge fade */}
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

                    {/* Bottom edge fade */}
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

            {/* ── Organize bulk toolbar — below content wrapper, slides in on organize ── */}
            <AnimatePresence initial={false}>
              {isOrganizing && (
                <motion.div
                  key="bulk-toolbar"
                  initial={{ y: 8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{   y: 8, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                  style={{
                    flexShrink:      0,
                    display:         'flex',
                    alignItems:      'center',
                    gap:             8,
                    padding:         '12px',
                    borderTop:       '1px solid var(--neutral-100)',
                    backgroundColor: 'var(--neutral-50)',
                    width:           '100%',
                  }}
                >
                  <p
                    style={{
                      margin:     0,
                      fontFamily: 'var(--font-body)',
                      fontWeight: 'var(--font-weight-medium)',
                      fontSize:   'var(--font-size-caption)',
                      lineHeight: 'var(--line-height-caption)',
                      color:      'var(--neutral-500)',
                      flexShrink: 0,
                    }}
                  >
                    {selectedPinIds.size > 0
                      ? `${selectedPinIds.size} selected`
                      : 'Select pins to bulk-edit'}
                  </p>
                  <div style={{ flex: '1 1 0' }} />
                  <Tooltip content="Move to folder">
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<FolderOneIcon size={16} />}
                      disabled={selectedPinIds.size === 0}
                      onClick={() => { if (folders.length > 0) handleMoveToFolder(folders[0].id) }}
                    >
                      Move to folder
                    </Button>
                  </Tooltip>
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<DownloadThreeIcon size={16} />}
                    onClick={handleExport}
                  >
                    Export
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<CancelOneIcon size={16} />}
                    disabled={selectedPinIds.size === 0}
                    onClick={handleDeleteSelected}
                  >
                    Delete
                  </Button>
                  <div style={{ width: 1, height: 20, background: 'var(--neutral-200)', flexShrink: 0 }} />
                  <Button variant="secondary" size="sm" onClick={handleExitOrganize}>
                    Done
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ── SidebarFolderItem ─────────────────────────────────────────────────────────
// Styled to match SidebarMenuItem variant="default" visually.

function SidebarFolderItem({
  folder,
  active,
  onClick,
  onRename,
  onDelete,
}: {
  folder:   PinFolder
  active:   boolean
  onClick:  () => void
  onRename: () => void
  onDelete: () => void
}) {
  const [hovered,       setHovered]       = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setConfirmDelete(false) }}
    >
      <button
        onClick={onClick}
        onDoubleClick={onRename}
        style={{
          display:         'flex',
          alignItems:      'center',
          gap:             8,
          width:           '100%',
          paddingLeft:     6,
          paddingRight:    6,
          paddingTop:      5,
          paddingBottom:   5,
          background:      active || hovered
            ? 'var(--sidebar-menu-item-hover-bg)'
            : 'transparent',
          border:          'none',
          cursor:          'pointer',
          borderRadius:    10,
          transition:      'background 150ms',
          textAlign:       'left',
          boxShadow:       active || hovered
            ? 'var(--shadow-sidebar-item-hover)'
            : undefined,
        }}
      >
        <div style={{ color: 'var(--sidebar-menu-item-text)', flexShrink: 0, lineHeight: 0 }}>
          <FolderOneIcon size={20} />
        </div>
        <span
          style={{
            flex:         '1 1 0',
            minWidth:     0,
            fontFamily:   'var(--font-body)',
            fontWeight:   'var(--font-weight-medium)',
            fontSize:     'var(--font-size-body)',
            lineHeight:   'var(--line-height-body)',
            color:        'var(--sidebar-menu-item-text)',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}
        >
          {folder.name}
        </span>
      </button>

      {/* Hover delete overlay */}
      <AnimatePresence initial={false}>
        {hovered && (
          <motion.div
            key="folder-actions"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{   opacity: 0 }}
            transition={{ duration: 0.1 }}
            style={{
              position:  'absolute',
              right:     6,
              top:       '50%',
              transform: 'translateY(-50%)',
              display:   'flex',
              gap:       4,
            }}
          >
            {confirmDelete ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { onDelete(); setConfirmDelete(false) }}
                >
                  Delete
                </Button>
              </>
            ) : (
              <IconButton
                variant="ghost"
                size="sm"
                icon={<CancelOneIcon size={16} />}
                aria-label={`Delete folder ${folder.name}`}
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(true) }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inner shadow — matches SidebarMenuItem active state */}
      {(active || hovered) && (
        <div
          aria-hidden
          style={{
            position:      'absolute',
            inset:         0,
            pointerEvents: 'none',
            borderRadius:  10,
            boxShadow:     'var(--shadow-item-inner)',
          }}
        />
      )}
    </div>
  )
}

// ── PinGridCell ───────────────────────────────────────────────────────────────
// Wraps a DS Pin with the organize-mode checkbox overlay.

function PinGridCell({
  pin,
  isOrganizing,
  isSelected,
  collapseSignal,
  onToggle,
  onExpandedChange,
}: {
  pin:              PinboardPin
  isOrganizing:     boolean
  isSelected:       boolean
  collapseSignal:   number
  onToggle:         () => void
  onExpandedChange?: (expanded: boolean) => void
}) {
  const { id, ...pinProps } = pin

  return (
    <div
      style={{
        position:      'relative',
        borderRadius:  16,
        outline:       isSelected ? `2px solid var(--focus-ring)` : undefined,
        outlineOffset: isSelected ? 2 : undefined,
      }}
    >
      <Pin
        fluid
        collapseSignal={collapseSignal}
        onExpandedChange={onExpandedChange}
        style={{ pointerEvents: isOrganizing ? 'none' : 'auto' }}
        {...pinProps}
      />

      <AnimatePresence initial={false}>
        {isOrganizing && (
          <motion.div
            key="organize-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{   opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onToggle}
            style={{
              position:        'absolute',
              inset:           0,
              borderRadius:    16,
              cursor:          'pointer',
              backgroundColor: isSelected
                ? 'var(--neutral-900-08, rgba(38,33,30,0.08))'
                : 'transparent',
            }}
          >
            {/* Checkbox */}
            <div
              style={{
                position:        'absolute',
                top:             12,
                left:            12,
                width:           20,
                height:          20,
                borderRadius:    6,
                border:          isSelected ? 'none' : '2px solid var(--neutral-300)',
                backgroundColor: isSelected ? 'var(--neutral-900)' : 'var(--neutral-white)',
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
                boxShadow:       '0px 1px 2px 0px var(--neutral-700-12)',
                transition:      'background 100ms, border 100ms',
              }}
            >
              {isSelected && <TickTwoIcon size={16} color="var(--neutral-white)" />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default PinboardExpanded
