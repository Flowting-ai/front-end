'use client'

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CancelOneIcon,
  SearchOneIcon,
  CancelCircleIcon,
  FilterMailIcon,
  ArrowUpDownIcon,
  FolderAddIcon,
  FolderOneIcon,
  DownloadThreeIcon,
  TickTwoIcon,
  UnfoldLessIcon,
} from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { InputField } from '@/components/InputField'
import { Tabs, TabsList, TabsTrigger } from '@/components/Tabs'
import { Pin } from '@/components/Pin'
import { Tooltip } from '@/components/Tooltip'
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

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PinFolder {
  id: string
  name: string
  type?: 'personal' | 'project'
}

type FolderFilter = 'all' | 'unorganized' | string
type SortField = 'date_created' | 'title' | 'category'
type SortDirection = 'asc' | 'desc'

interface SortConfig {
  field: SortField
  direction: SortDirection
}

export interface PinboardExpandedProps {
  onClose: () => void
  onExport?: (pinIds?: string[]) => void
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_TABS = [
  { value: 'all',      label: 'All' },
  { value: 'Favorites', label: 'Favorites' },
  { value: 'Code',      label: 'Code' },
  { value: 'Research',  label: 'Research' },
  { value: 'Creative',  label: 'Creative' },
  { value: 'Planning',  label: 'Planning' },
  { value: 'Tasks',     label: 'Tasks' },
  { value: 'Quote',     label: 'Quote' },
  { value: 'Workflow',  label: 'Workflow' },
] as const

// ── Category → badge color ────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<PinCategory, BadgeColor> = {
  Code:     'Green',
  Research: 'Blue',
  Creative: 'Purple',
  Planning: 'Yellow',
  Tasks:    'Red',
  Quote:    'Brown',
  Workflow: 'Neutral',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pinItemToKDS(item: PinItem): PinboardPin {
  return {
    id:          item.id,
    category:    item.category,
    pinTitle:    item.title,
    description: item.content,
    chatName:    item.chatName ?? '',
    labels: [
      { color: CATEGORY_COLOR[item.category], text: item.category },
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

// ── TODO(kds): FilterMenu — pending KDS component ─────────────────────────────
function FilterMenuPlaceholder({ trigger }: { trigger: React.ReactNode }) {
  return <>{trigger}</>
}

// ── TODO(kds): SortMenu — pending KDS component ──────────────────────────────
function SortMenuPlaceholder({ trigger }: { trigger: React.ReactNode }) {
  return <>{trigger}</>
}

// ── TODO(kds): EmptyState — pending KDS component ────────────────────────────
function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div
      style={{
        gridColumn:     '1 / -1',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            8,
        padding:        '48px 24px',
        textAlign:      'center',
      }}
    >
      <p
        style={{
          margin:     0,
          fontFamily: 'var(--font-body)',
          fontWeight: 'var(--font-weight-medium)',
          fontSize:   'var(--font-size-body)',
          lineHeight: 'var(--line-height-body)',
          color:      'var(--neutral-700)',
        }}
      >
        {title}
      </p>
      {description && (
        <p
          style={{
            margin:     0,
            fontFamily: 'var(--font-body)',
            fontWeight: 'var(--font-weight-regular)',
            fontSize:   'var(--font-size-caption)',
            lineHeight: 'var(--line-height-caption)',
            color:      'var(--neutral-500)',
          }}
        >
          {description}
        </p>
      )}
      {action && (
        <Button variant="ghost" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PinboardExpanded({ onClose, onExport }: PinboardExpandedProps) {
  const { pins, removePin } = usePinboard()

  // ── Folder state ──────────────────────────────────────────────────────────
  const [folders,          setFolders]          = useState<PinFolder[]>([])
  const [activeFolderId,   setActiveFolderId]   = useState<FolderFilter>('all')
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [newFolderName,    setNewFolderName]    = useState('')
  const [editingFolderId,  setEditingFolderId]  = useState<string | null>(null)
  const [editingFolderName, setEditingFolderName] = useState('')
  const newFolderInputRef  = useRef<HTMLInputElement>(null)

  // ── View state ────────────────────────────────────────────────────────────
  const [activeTab,     setActiveTab]     = useState('all')
  const [rawSearch,     setRawSearch]     = useState('')
  const [isSearchOpen,  setIsSearchOpen]  = useState(false)
  const [sortConfig,    setSortConfig]    = useState<SortConfig>({ field: 'date_created', direction: 'desc' })
  const searchQuery = useDebounce(rawSearch, 150)

  // ── Organize mode ─────────────────────────────────────────────────────────
  const [isOrganizing,    setIsOrganizing]    = useState(false)
  const [selectedPinIds,  setSelectedPinIds]  = useState<Set<string>>(new Set())
  const [collapseSignal,  setCollapseSignal]  = useState(0)

  // ── Expanded pin tracking — mirrors DS Pinboard pattern ──────────────────
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const hasExpanded = expandedIds.size > 0

  const handleCollapseAll = () => {
    setCollapseSignal((s) => s + 1)
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

  // ── Fetch folders on mount ────────────────────────────────────────────────
  useEffect(() => {
    apiFetch(PIN_FOLDERS_ENDPOINT)
      .then((data: unknown) => {
        if (Array.isArray(data)) setFolders(data as PinFolder[])
        // API may return { data: [...] } — handle both shapes
        else if (data && Array.isArray((data as { data?: unknown }).data))
          setFolders((data as { data: PinFolder[] }).data)
      })
      .catch(() => {
        // Folders API not yet live — silently skip
      })
  }, [])

  // Focus new-folder input when shown
  useEffect(() => {
    if (isCreatingFolder) newFolderInputRef.current?.focus()
  }, [isCreatingFolder])

  // ── Folder operations ─────────────────────────────────────────────────────

  const handleCreateFolder = async () => {
    const name = newFolderName.trim()
    if (!name) { setIsCreatingFolder(false); setNewFolderName(''); return }
    const optimisticId = `folder-${Date.now()}`
    const optimistic: PinFolder = { id: optimisticId, name, type: 'personal' }
    setFolders(prev => [...prev, optimistic])
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
    } catch {
      // revert not implemented — refetch would be the correct fix
    }
  }

  const handleDeleteFolder = async (folderId: string) => {
    setFolders(prev => prev.filter(f => f.id !== folderId))
    if (activeFolderId === folderId) setActiveFolderId('all')
    try {
      await apiFetch(`${PIN_FOLDERS_CREATE_ENDPOINT}/${folderId}`, { method: 'DELETE' })
    } catch {
      // optimistic delete stands — not rolling back since folder content is preserved
    }
  }

  // ── Pin operations ────────────────────────────────────────────────────────

  const handleMoveToFolder = async (folderId: string | null) => {
    for (const pinId of selectedPinIds) {
      try {
        await apiFetch(PIN_MOVE_ENDPOINT(pinId), {
          method: 'PATCH',
          body:   JSON.stringify({ folder_id: folderId }),
        })
      } catch {
        // individual failure — continue with others
      }
    }
    setSelectedPinIds(new Set())
  }

  const handleDeleteSelected = async () => {
    const ids = Array.from(selectedPinIds)
    // Optimistic
    ids.forEach(id => removePin(id))
    setSelectedPinIds(new Set())
    for (const id of ids) {
      try {
        await apiFetch(PIN_DETAIL_ENDPOINT(id), { method: 'DELETE' })
      } catch {
        // optimistic delete stands
      }
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

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filteredPins = (() => {
    let result: PinItem[] = pins

    // Folder filter
    if (activeFolderId === 'unorganized') {
      // TODO(api): filter by no folder_id once that field is in PinItem
    } else if (activeFolderId !== 'all') {
      // TODO(api): filter by folder_id once that field is in PinItem
    }

    // Tab filter — category match or special cases
    if (activeTab !== 'all' && activeTab !== 'Favorites') {
      result = result.filter(p => p.category === activeTab)
    }
    // TODO: Favorites tab — filter by is_favorite when that field is added to PinItem

    // Search filter (title + content)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        p => p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q),
      )
    }

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0
      if (sortConfig.field === 'date_created') {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      } else if (sortConfig.field === 'title') {
        cmp = a.title.localeCompare(b.title)
      } else if (sortConfig.field === 'category') {
        cmp = a.category.localeCompare(b.category)
      }
      return sortConfig.direction === 'asc' ? cmp : -cmp
    })

    return result
  })()

  const visiblePins = filteredPins.map(pinItemToKDS)

  // ── Empty state message ───────────────────────────────────────────────────
  const emptyState = (() => {
    if (pins.length === 0) {
      return { title: 'No pins yet', description: 'Pin any chat message to save it here.' }
    }
    if (searchQuery.trim() && filteredPins.length === 0) {
      return { title: `No results for "${searchQuery}"` }
    }
    if (filteredPins.length === 0) {
      return {
        title:  'No pins match these filters',
        action: { label: 'Clear filters', onClick: () => { setActiveTab('all'); setRawSearch(''); setActiveFolderId('all') } },
      }
    }
    return null
  })()

  // ── Pin selection toggle ──────────────────────────────────────────────────
  const togglePin = useCallback((id: string) => {
    setSelectedPinIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // ── Keyboard: Escape exits organize or closes ─────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (isOrganizing) handleExitOrganize()
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOrganizing, onClose])

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
      {/* ── Modal panel ── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{   opacity: 0, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 260, damping: 32 }}
        style={{
          width:           924,
          height:          817,
          maxWidth:        'calc(100vw - 32px)',
          maxHeight:       'calc(100vh - 32px)',
          borderRadius:    20,
          backgroundColor: 'var(--neutral-white)',
          boxShadow:       '0px 24px 48px -12px rgba(38,33,30,0.24), 0px 0px 0px 1px var(--neutral-100)',
          display:         'flex',
          overflow:        'hidden',
        }}
      >
        {/* ══ Left sidebar (240px) ══ */}
        <div
          style={{
            width:           240,
            flexShrink:      0,
            borderRight:     '1px solid var(--neutral-100)',
            display:         'flex',
            flexDirection:   'column',
            padding:         '24px 0 16px',
            gap:             4,
            overflowY:       'auto',
            overscrollBehaviorY: 'contain',
          }}
          className="kaya-scrollbar"
        >
          {/* Title */}
          <p
            style={{
              margin:     '0 0 16px',
              padding:    '0 16px',
              fontFamily: 'var(--font-title)',
              fontWeight: 'var(--font-weight-regular)',
              fontSize:   'var(--font-size-heading)',
              lineHeight: 'var(--line-height-heading)',
              color:      'var(--neutral-700)',
            }}
          >
            Pinboard
          </p>

          {/* All pins */}
          <SidebarNavItem
            label="All pins"
            count={pins.length}
            active={activeFolderId === 'all'}
            onClick={() => setActiveFolderId('all')}
          />

          {/* Unorganized */}
          <SidebarNavItem
            label="Unorganized"
            active={activeFolderId === 'unorganized'}
            onClick={() => setActiveFolderId('unorganized')}
          />

          {/* Personal folders */}
          {folders.filter(f => !f.type || f.type === 'personal').length > 0 && (
            <>
              <div style={{ height: 1, background: 'var(--neutral-100)', margin: '8px 16px' }} />
              <p style={{
                margin: '0 0 2px',
                padding: '0 16px',
                fontFamily: 'var(--font-body)',
                fontWeight: 'var(--font-weight-medium)',
                fontSize: 'var(--font-size-caption)',
                lineHeight: 'var(--line-height-caption)',
                color: 'var(--neutral-400)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}>
                Personal
              </p>
              {folders.filter(f => !f.type || f.type === 'personal').map(folder =>
                editingFolderId === folder.id ? (
                  <div key={folder.id} style={{ padding: '0 12px' }}>
                    <InputField
                      value={editingFolderName}
                      onChange={setEditingFolderName}
                      onBlur={() => handleRenameFolder(folder.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRenameFolder(folder.id)
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
            </>
          )}

          {/* Project folders */}
          {folders.filter(f => f.type === 'project').length > 0 && (
            <>
              <div style={{ height: 1, background: 'var(--neutral-100)', margin: '8px 16px' }} />
              <p style={{
                margin: '0 0 2px',
                padding: '0 16px',
                fontFamily: 'var(--font-body)',
                fontWeight: 'var(--font-weight-medium)',
                fontSize: 'var(--font-size-caption)',
                lineHeight: 'var(--line-height-caption)',
                color: 'var(--neutral-400)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}>
                Projects
              </p>
              {folders.filter(f => f.type === 'project').map(folder =>
                editingFolderId === folder.id ? (
                  <div key={folder.id} style={{ padding: '0 12px' }}>
                    <InputField
                      value={editingFolderName}
                      onChange={setEditingFolderName}
                      onBlur={() => handleRenameFolder(folder.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRenameFolder(folder.id)
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
            </>
          )}

          {/* New folder input */}
          {isCreatingFolder ? (
            <div style={{ padding: '0 12px' }}>
              <InputField
                ref={newFolderInputRef}
                value={newFolderName}
                onChange={setNewFolderName}
                onBlur={handleCreateFolder}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreateFolder()
                  if (e.key === 'Escape') { setIsCreatingFolder(false); setNewFolderName('') }
                }}
                placeholder="Folder name"
                fluid
                size="small"
                aria-label="New folder name"
              />
            </div>
          ) : (
            <button
              onClick={() => setIsCreatingFolder(true)}
              style={{
                display:     'flex',
                alignItems:  'center',
                gap:         8,
                padding:     '6px 16px',
                background:  'transparent',
                border:      'none',
                cursor:      'pointer',
                color:       'var(--neutral-500)',
                fontFamily:  'var(--font-body)',
                fontWeight:  'var(--font-weight-medium)',
                fontSize:    'var(--font-size-caption)',
                lineHeight:  'var(--line-height-caption)',
                width:       '100%',
                textAlign:   'left',
                marginTop:   4,
              }}
            >
              <FolderAddIcon size={16} />
              New folder
            </button>
          )}
        </div>

        {/* ══ Right content ══ */}
        <div
          style={{
            flex:          '1 1 0',
            minWidth:      0,
            display:       'flex',
            flexDirection: 'column',
            overflow:      'hidden',
          }}
        >
          {/* ── Header row ── */}
          <div
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'space-between',
              padding:        '20px 24px 0',
              flexShrink:     0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <p
                style={{
                  margin:     0,
                  fontFamily: 'var(--font-body)',
                  fontWeight: 'var(--font-weight-medium)',
                  fontSize:   'var(--font-size-body)',
                  lineHeight: 'var(--line-height-body)',
                  color:      'var(--neutral-700)',
                }}
              >
                {visiblePins.length} {visiblePins.length === 1 ? 'pin' : 'pins'}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AnimatePresence initial={false}>
                {hasExpanded && !isOrganizing && (
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
              <Button
                variant={isOrganizing ? 'default' : 'secondary'}
                size="sm"
                onClick={() => isOrganizing ? handleExitOrganize() : setIsOrganizing(true)}
              >
                {isOrganizing ? 'Done' : 'Organize'}
              </Button>
              <Tooltip content="Close">
                <IconButton
                  variant="ghost"
                  size="sm"
                  icon={<CancelOneIcon size={20} />}
                  aria-label="Close organize view"
                  onClick={onClose}
                />
              </Tooltip>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div style={{ padding: '16px 24px 0', flexShrink: 0 }}>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList scrollable style={{ width: '100%' }}>
                {CATEGORY_TABS.map(tab => (
                  <TabsTrigger key={tab.value} value={tab.value}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {/* ── Toolbar row (search + filter + sort) ── */}
          <div
            style={{
              display:    'flex',
              alignItems: 'center',
              gap:        8,
              padding:    '12px 24px',
              flexShrink: 0,
            }}
          >
            {/* Search — expands to 276px */}
            <AnimatePresence initial={false} mode="popLayout">
              {isSearchOpen ? (
                <motion.div
                  key="search-open"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 276 }}
                  exit={{   opacity: 0, width: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  style={{ overflow: 'hidden', flexShrink: 0 }}
                >
                  <InputField
                    value={rawSearch}
                    onChange={setRawSearch}
                    leftIcon={<SearchOneIcon size={16} />}
                    rightIcon={
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label="Close search"
                        onClick={() => { setIsSearchOpen(false); setRawSearch('') }}
                        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (setIsSearchOpen(false), setRawSearch(''))}
                        style={{ display: 'inline-flex', cursor: 'pointer', lineHeight: 0 }}
                      >
                        <CancelCircleIcon size={16} />
                      </span>
                    }
                    placeholder="Search pins..."
                    fluid
                    size="small"
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                    aria-label="Search pins"
                  />
                </motion.div>
              ) : (
                <motion.span
                  key="search-closed"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{   opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  style={{ display: 'inline-flex', flexShrink: 0 }}
                >
                  <Tooltip content="Search">
                    <IconButton
                      variant="secondary"
                      size="sm"
                      icon={<SearchOneIcon size={20} />}
                      aria-label="Open search"
                      onClick={() => setIsSearchOpen(true)}
                    />
                  </Tooltip>
                </motion.span>
              )}
            </AnimatePresence>

            {/* TODO(kds): FilterMenu — pending KDS component */}
            <FilterMenuPlaceholder
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
            />

            {/* TODO(kds): SortMenu — pending KDS component */}
            <SortMenuPlaceholder
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
            />
          </div>

          {/* ── Pin grid ── */}
          <div
            className="kaya-scrollbar"
            style={{
              flex:                '1 1 0',
              minHeight:           0,
              overflowY:           'auto',
              overscrollBehaviorY: 'contain',
              padding:             '0 24px',
            }}
          >
            <div
              style={{
                display:             'grid',
                gridTemplateColumns: '1fr 1fr',
                gap:                 12,
                alignItems:          'start',
                paddingBottom:       24,
              }}
            >
              {visiblePins.length === 0 && emptyState ? (
                <EmptyState
                  title={emptyState.title}
                  description={'description' in emptyState ? emptyState.description : undefined}
                  action={'action' in emptyState ? emptyState.action : undefined}
                />
              ) : (
                visiblePins.map(pin => (
                  <PinGridCell
                    key={pin.id}
                    pin={pin}
                    isOrganizing={isOrganizing}
                    isSelected={selectedPinIds.has(pin.id)}
                    collapseSignal={collapseSignal}
                    onToggle={() => togglePin(pin.id)}
                    onExpandedChange={handlePinExpandedChange(pin.id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* ── Bulk action toolbar (organize mode + selection) ── */}
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
                  padding:         '12px 24px',
                  borderTop:       '1px solid var(--neutral-100)',
                  backgroundColor: 'var(--neutral-white)',
                }}
              >
                {/* Selected count */}
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

                {/* Move to folder */}
                <Tooltip content="Move to folder">
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<FolderOneIcon size={16} />}
                    disabled={selectedPinIds.size === 0}
                    onClick={() => {
                      // TODO: open folder picker dropdown — use first folder for now
                      if (folders.length > 0) handleMoveToFolder(folders[0].id)
                    }}
                  >
                    Move to folder
                  </Button>
                </Tooltip>

                {/* Export */}
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<DownloadThreeIcon size={16} />}
                  onClick={handleExport}
                >
                  Export
                </Button>

                {/* Delete */}
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<CancelOneIcon size={16} />}
                  disabled={selectedPinIds.size === 0}
                  onClick={handleDeleteSelected}
                >
                  Delete
                </Button>

                {/* Divider */}
                <div style={{ width: 1, height: 20, background: 'var(--neutral-200)', flexShrink: 0 }} />

                {/* Done */}
                <Button variant="secondary" size="sm" onClick={handleExitOrganize}>
                  Done
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}

// ── SidebarNavItem ────────────────────────────────────────────────────────────

function SidebarNavItem({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count?: number
  active: boolean
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'space-between',
        width:           '100%',
        padding:         '6px 16px',
        background:      active
          ? 'var(--neutral-100)'
          : hovered
            ? 'var(--neutral-50)'
            : 'transparent',
        border:          'none',
        cursor:          'pointer',
        borderRadius:    8,
        transition:      'background 100ms',
      }}
    >
      <span
        style={{
          fontFamily:  'var(--font-body)',
          fontWeight:  active ? 'var(--font-weight-medium)' : 'var(--font-weight-regular)',
          fontSize:    'var(--font-size-caption)',
          lineHeight:  'var(--line-height-caption)',
          color:       active ? 'var(--neutral-900)' : 'var(--neutral-600)',
          textAlign:   'left',
        }}
      >
        {label}
      </span>
      {count !== undefined && (
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 'var(--font-weight-regular)',
            fontSize:   'var(--font-size-caption)',
            lineHeight: 'var(--line-height-caption)',
            color:      'var(--neutral-400)',
          }}
        >
          {count}
        </span>
      )}
    </button>
  )
}

// ── SidebarFolderItem ─────────────────────────────────────────────────────────

function SidebarFolderItem({
  folder,
  active,
  onClick,
  onRename,
  onDelete,
}: {
  folder: PinFolder
  active: boolean
  onClick: () => void
  onRename: () => void
  onDelete: () => void
}) {
  const [hovered,      setHovered]      = useState(false)
  const [menuOpen,     setMenuOpen]     = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setMenuOpen(false) }}
    >
      <button
        onClick={onClick}
        onDoubleClick={onRename}
        style={{
          display:     'flex',
          alignItems:  'center',
          gap:         8,
          width:       '100%',
          padding:     '6px 16px',
          background:  active ? 'var(--neutral-100)' : hovered ? 'var(--neutral-50)' : 'transparent',
          border:      'none',
          cursor:      'pointer',
          borderRadius: 8,
          transition:  'background 100ms',
          textAlign:   'left',
        }}
      >
        <FolderOneIcon size={16} color="var(--neutral-500)" />
        <span
          style={{
            flex:       '1 1 0',
            fontFamily: 'var(--font-body)',
            fontWeight: active ? 'var(--font-weight-medium)' : 'var(--font-weight-regular)',
            fontSize:   'var(--font-size-caption)',
            lineHeight: 'var(--line-height-caption)',
            color:      active ? 'var(--neutral-900)' : 'var(--neutral-600)',
            overflow:   'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {folder.name}
        </span>
      </button>

      {/* Inline delete confirm — shows on hover */}
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
              right:     12,
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
  pin: PinboardPin
  isOrganizing: boolean
  isSelected: boolean
  collapseSignal: number
  onToggle: () => void
  onExpandedChange?: (expanded: boolean) => void
}) {
  const { id, ...pinProps } = pin

  return (
    <div
      style={{
        position:      'relative',
        borderRadius:  '16px',
        // Outline lives on the wrapper, not Pin — Pin's overflow:clip would clip it
        outline:       isSelected ? `2px solid var(--focus-ring)` : undefined,
        outlineOffset: isSelected ? 2 : undefined,
      }}
    >
      <Pin
        fluid
        collapseSignal={collapseSignal}
        onExpandedChange={onExpandedChange}
        style={{
          // Disable drag-expand in organize mode so the whole card acts as a checkbox target
          pointerEvents: isOrganizing ? 'none' : 'auto',
        }}
        {...pinProps}
      />

      {/* ── Organize mode overlay ── */}
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
              position:  'absolute',
              inset:     0,
              borderRadius: 16,
              cursor:    'pointer',
              // Transparent overlay to capture clicks on the whole card
              backgroundColor: isSelected
                ? 'var(--neutral-900-08, rgba(38,33,30,0.08))'
                : 'transparent',
            }}
          >
            {/* Checkbox — top-left corner */}
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
