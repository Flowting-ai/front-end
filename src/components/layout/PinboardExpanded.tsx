'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useSearchParams } from 'next/navigation'
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
  MessagePreviewOneIcon,
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
import { useChatHistoryContext } from '@/context/chat-history-context'
import { exportSinglePin } from '@/lib/export-pins'
import type { BadgeColor } from '@/components/Badge'
import { listPinFolders, createPinFolder, movePinToFolder, validateFolderName } from '@/lib/api/pins'
import { toast } from 'sonner'
import { EnterChunk, PINBOARD_EXPANDED_ENTER_DEFAULT } from './pinboardEnterAnimation'
import { PinboardExpandedSkeleton } from '@/components/PinboardExpandedSkeleton'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PinFolder {
  id:    string
  name:  string
  type?: 'personal' | 'project'
}

type FolderFilter  = 'all' | 'unorganized' | 'this-chat' | string
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

const ICON_BUTTON_W  = 32
const ROW_GAP        = 32
const SEARCH_OPEN_W  = 276

const EMPTY_TAGS: { color: BadgeColor; text: string }[] = []
const EMPTY_SET  = new Set<number>()

// ── Helpers ───────────────────────────────────────────────────────────────────

function pinItemToKDS(
  item: PinItem,
  chatNameById: Map<string, string>,
  onExport: () => void,
  onDelete: () => void,
  onDuplicate: () => void,
): PinboardPin {
  const tagLabels: { color: BadgeColor; text: string }[] =
    item.tags && item.tags.length > 0
      ? item.tags.map((tag, i) => ({ color: TAG_COLORS[i % TAG_COLORS.length], text: tag }))
      : [{ color: CATEGORY_COLOR[item.category], text: item.category }];

  const chatName = (item.chatId ? chatNameById.get(item.chatId) : undefined)
    ?? item.chatName
    ?? ''

  return {
    id:          item.id,
    category:    item.category,
    pinTitle:    item.title || item.content.split("\n")[0].slice(0, 120) || "Untitled Pin",
    description: item.content,
    chatName,
    labels: [
      ...tagLabels,
      ...(item.modelName ? [{ color: 'Neutral' as BadgeColor, text: item.modelName }] : []),
    ],
    onExport,
    onDelete,
    onDuplicate,
    onInsert: () => window.dispatchEvent(
      new CustomEvent('pin:insert', { detail: { content: item.content } })
    ),
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

// ── SectionLabel - matches DS PinboardExpanded's SectionLabel ─────────────────

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
  const { pins, removePin, clonePin, updatePinTags, updatePinFolder, addFolder, removeFolder, renameFolder } = usePinboard()
  const { chats } = useChatHistoryContext()
  const searchParams  = useSearchParams()
  const activeChatId  = searchParams.get('id')
  const chatNameById = useMemo((): Map<string, string> => {
    const map = new Map<string, string>()
    for (const chat of chats) map.set(chat.id, chat.title)
    return map
  }, [chats])
  const enterAnimation = PINBOARD_EXPANDED_ENTER_DEFAULT

  // ── Loading state - show skeleton until first folder fetch settles ───────
  const [foldersLoaded, setFoldersLoaded] = useState(false)

  // ── Folder state ──────────────────────────────────────────────────────────
  const [folders,           setFolders]           = useState<PinFolder[]>([])
  const [activeFolderId,    setActiveFolderId]    = useState<FolderFilter>('all')
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false)
  const [modalFolderName,       setModalFolderName]       = useState('')
  const [editingFolderId,       setEditingFolderId]       = useState<string | null>(null)
  const [editingFolderName,     setEditingFolderName]     = useState('')

  // ── View state ────────────────────────────────────────────────────────────
  const [activeTab,    setActiveTab]    = useState('all')
  const [rawSearch,    setRawSearch]    = useState('')
  const [searchOpen,   setSearchOpen]   = useState(false)
  const [sortConfig,   setSortConfig]   = useState<SortConfig>({ field: 'date_created', direction: 'desc' })
  const searchQuery = useDebounce(rawSearch, 150)

  // ── Organize mode ─────────────────────────────────────────────────────────
  const [isOrganizing,     setIsOrganizing]     = useState(false)
  const [selectedPinIds,   setSelectedPinIds]   = useState<Set<string>>(new Set())
  const [collapseSignal,   setCollapseSignal]   = useState(0)
  const [showFolderPicker, setShowFolderPicker] = useState(false)
  const folderPickerRef = useRef<HTMLDivElement>(null)

  // ── Expanded pin tracking ─────────────────────────────────────────────────
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const hasExpanded = expandedIds.size > 0

  // ── Per-pin tag state ─────────────────────────────────────────────────────
  // Lifted here so tag edits survive re-renders and the organize-mode overlay.
  // userTagsById: user-added tags keyed by pin id.
  // deletedLabelsById: indices into the `labels` prop deleted by the user.
  const [userTagsById,    setUserTagsById]    = useState<Record<string, { color: BadgeColor; text: string }[]>>({})
  const [deletedLabelsById, setDeletedLabelsById] = useState<Record<string, Set<number>>>({})

  // ── Search slot width (collapses to icon, expands to input) ─────────────────
  const tabsContainerRef = useRef<HTMLDivElement>(null)
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
    (id: string, expanded: boolean) => {
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
    listPinFolders()
      .then((apiFolders) => {
        setFolders(apiFolders.map(f => ({ id: f.id, name: f.name, type: 'personal' as const })))
        setFoldersLoaded(true)
      })
      .catch(() => { setFoldersLoaded(true) })
  }, [])

  // ── Folder operations ─────────────────────────────────────────────────────

  const handleCreateFolder = async () => {
    const name = modalFolderName.trim()
    setShowCreateFolderModal(false)
    setModalFolderName('')
    if (!name) return
    const error = validateFolderName(name, folders.map(f => f.name))
    if (error) { toast.error(error); return }
    const optimisticId = `folder-${Date.now()}`
    setFolders(prev => [...prev, { id: optimisticId, name, type: 'personal' as const }])
    try {
      const created = await createPinFolder(name)
      const folder = { id: created.id, name: created.name, type: 'personal' as const }
      setFolders(prev => prev.map(f => f.id === optimisticId ? folder : f))
      addFolder({ id: created.id, label: created.name })
    } catch {
      setFolders(prev => prev.filter(f => f.id !== optimisticId))
      toast.error('Failed to create folder.')
    }
  }

  const handleRenameFolder = (folderId: string) => {
    const name = editingFolderName.trim()
    setEditingFolderId(null)
    if (!name) return
    const otherNames = folders.filter(f => f.id !== folderId).map(f => f.name)
    const error = validateFolderName(name, otherNames)
    if (error) { toast.error(error); return }
    setFolders(prev => prev.map(f => f.id === folderId ? { ...f, name } : f))
    renameFolder(folderId, name)
  }

  const handleDeleteFolder = (folderId: string) => {
    setFolders(prev => prev.filter(f => f.id !== folderId))
    if (activeFolderId === folderId) setActiveFolderId('all')
    removeFolder(folderId)
  }

  // ── Pin tag operations ────────────────────────────────────────────────────

  const handlePinAddTag = useCallback((pinId: string, text: string, color: BadgeColor) => {
    const item = pins.find(p => p.id === pinId)
    const backendTags = item?.tags ?? []
    const deletedSet  = deletedLabelsById[pinId] ?? new Set<number>()
    const remaining   = backendTags.filter((_, i) => !deletedSet.has(i))
    const existing    = userTagsById[pinId] ?? []
    const newUser     = [...existing, { color, text }]
    const allTags     = [...remaining, ...newUser.map(t => t.text)]
    setUserTagsById(prev => ({ ...prev, [pinId]: newUser }))
    updatePinTags(pinId, allTags)
  }, [pins, deletedLabelsById, userTagsById, updatePinTags])

  const handlePinDeleteTag = useCallback((pinId: string, index: number, source: 'label' | 'user') => {
    const item = pins.find(p => p.id === pinId)
    const backendTags = item?.tags ?? []
    let newDeletedSet = deletedLabelsById[pinId] ?? new Set<number>()
    let newUser       = userTagsById[pinId] ?? []

    if (source === 'label') {
      // Skip if the deleted label index points to the model-name badge (past real tags).
      if (index >= backendTags.length) return
      newDeletedSet = new Set([...newDeletedSet, index])
      setDeletedLabelsById(prev => ({ ...prev, [pinId]: newDeletedSet }))
    } else {
      newUser = newUser.filter((_, i) => i !== index)
      setUserTagsById(prev => ({ ...prev, [pinId]: newUser }))
    }

    const remaining = backendTags.filter((_, i) => !newDeletedSet.has(i))
    updatePinTags(pinId, [...remaining, ...newUser.map(t => t.text)])
  }, [pins, deletedLabelsById, userTagsById, updatePinTags])

  // ── Pin operations ────────────────────────────────────────────────────────

  const handleMoveToFolder = async (folderId: string) => {
    const folderName = folders.find(f => f.id === folderId)?.name
    const ids = Array.from(selectedPinIds)
    setSelectedPinIds(new Set())
    await Promise.all(
      ids.map(async (pinId) => {
        try {
          await movePinToFolder(pinId, folderId)
          updatePinFolder(pinId, folderId, folderName)
        } catch (err) {
          console.error('[PinboardExpanded] Failed to move pin', pinId, err)
        }
      }),
    )
  }

  const handleDeleteSelected = () => {
    selectedPinIds.forEach(id => removePin(id))
    setSelectedPinIds(new Set())
  }

  const handleExport = () => {
    const ids = selectedPinIds.size > 0 ? Array.from(selectedPinIds) : undefined
    onExport?.(ids)
  }

  const handleExitOrganize = () => {
    setIsOrganizing(false)
    setSelectedPinIds(new Set())
    setShowFolderPicker(false)
  }

  useEffect(() => {
    if (!showFolderPicker) return
    const handler = (e: MouseEvent) => {
      if (!folderPickerRef.current?.contains(e.target as Node)) setShowFolderPicker(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showFolderPicker])

  // ── Filtering & sorting ───────────────────────────────────────────────────

  const filteredPins = useMemo(() => {
    let result: PinItem[] = pins

    // View/folder filtering
    if (activeFolderId === 'this-chat') {
      result = activeChatId ? result.filter(p => p.chatId === activeChatId) : []
    } else if (activeFolderId === 'unorganized') {
      result = result.filter(p => !p.folderId)
    } else if (activeFolderId !== 'all') {
      result = result.filter(p => p.folderId === activeFolderId)
    }

    if (activeTab !== 'all' && activeTab !== 'Favorites') {
      result = result.filter(p => p.category === activeTab)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        p => p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q),
      )
    }

    return [...result].sort((a, b) => {
      let cmp = 0
      if      (sortConfig.field === 'date_created') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      else if (sortConfig.field === 'title')        cmp = a.title.localeCompare(b.title)
      else if (sortConfig.field === 'category')     cmp = a.category.localeCompare(b.category)
      return sortConfig.direction === 'asc' ? cmp : -cmp
    })
  }, [pins, activeFolderId, activeChatId, activeTab, searchQuery, sortConfig])

  const visiblePins = filteredPins.map(p =>
    pinItemToKDS(
      p,
      chatNameById,
      () => exportSinglePin(p, chatNameById),
      () => removePin(p.id),
      () => clonePin(p),
    )
  )

  const emptyState = (() => {
    if (searchQuery.trim() && filteredPins.length === 0)
      return { title: `No results for "${searchQuery}"` }
    if (activeFolderId === 'this-chat' && filteredPins.length === 0)
      return { title: 'No pins yet', description: 'Pin any message in this chat to save it here.' }
    if (activeFolderId !== 'all' && activeFolderId !== 'this-chat' && filteredPins.length === 0)
      return { title: 'No pins yet', description: 'Move pins to this folder to see them here.' }
    if (pins.length === 0)
      return { title: 'No pins yet', description: 'Pin any chat message to save it here.' }
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
      if (showCreateFolderModal) { setShowCreateFolderModal(false); setModalFolderName('') }
      else if (isOrganizing) handleExitOrganize()
      else                   onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showCreateFolderModal, isOrganizing, onClose])

  const personalFolders = folders.filter(f => !f.type || f.type === 'personal')
  const projectFolders  = folders.filter(f => f.type === 'project')

  const lastUpdatedLabel = (() => {
    if (filteredPins.length === 0) return null
    const latest = filteredPins.reduce((max, p) => {
      const t = new Date(p.createdAt).getTime()
      return t > max ? t : max
    }, 0)
    if (!latest) return null
    const diff  = Date.now() - latest
    const mins  = Math.floor(diff / 60_000)
    const hours = Math.floor(diff / 3_600_000)
    const days  = Math.floor(diff / 86_400_000)
    if (mins  <  1) return 'Updated just now'
    if (mins  < 60) return `Updated ${mins}m ago`
    if (hours < 24) return `Updated ${hours}h ago`
    return `Updated ${days}d ago`
  })()

  const activeTitle = activeFolderId === 'all'         ? 'All pins'
                    : activeFolderId === 'this-chat'    ? 'This chat'
                    : activeFolderId === 'unorganized'  ? 'Unorganized pins'
                    : folders.find(f => f.id === activeFolderId)?.name ?? 'Pins'

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
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
          width:        'min(1280px, calc(100vw - 32px))',
          height:       'min(817px, 98vh)',
          maxHeight:    '98vh',
          borderRadius: 28,
          boxShadow:    '0px 24px 48px -12px rgba(38,33,30,0.18), 0px 0px 0px 1px rgba(82,75,71,0.12)',
          display:      'flex',
          overflow:     'hidden',
        }}
      >
        {/* ── Loading skeleton - shown until first folder fetch settles ── */}
        {!foldersLoaded ? (
          <PinboardExpandedSkeleton
            width={924}
            style={{ width: '100%', height: '100%', maxWidth: 'calc(100vw - 32px)', maxHeight: '98vh', borderRadius: 28, boxShadow: 'none' }}
          />
        ) : (
        /* ── Outer flex row - matches DS PinboardExpanded outer container ── */
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
              {/* Sidebar inner - scrollable */}
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
                  {activeChatId && (
                    <SidebarMenuItem
                      variant="default"
                      fluid
                      label="This chat"
                      icon={<MessagePreviewOneIcon size={20} />}
                      selected={activeFolderId === 'this-chat'}
                      onClick={() => setActiveFolderId('this-chat')}
                    />
                  )}
                </div>

                {/* Your folders */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 8, width: '100%', overflow: 'hidden' }}>
                  <SectionLabel>Your folders</SectionLabel>
                  <SidebarMenuItem
                    variant="default"
                    fluid
                    label="New folder"
                    icon={<FolderAddIcon size={20} />}
                    onClick={() => { setModalFolderName(''); setShowCreateFolderModal(true) }}
                  />
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
            {/* Content wrapper - no alignItems so children stretch vertically */}
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
              {/* Content vertical wrapper - stretches to fill wrapper height via default alignItems:stretch */}
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
                      {lastUpdatedLabel && <Badge color="Neutral" label={lastUpdatedLabel} />}
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
                    {/* Tabs strip - takes all remaining space left by the action cluster */}
                    <div
                      ref={tabsContainerRef}
                      style={{
                        flex:     '1 1 0',
                        minWidth: 0,
                        padding:  '1px 0 1px 1px',
                        overflow: 'hidden',
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

                    {/* Secondary actions cluster - right-anchored, gap-4 */}
                    <div
                      style={{
                        display:        'flex',
                        alignItems:     'center',
                        justifyContent: 'flex-end',
                        gap:            4,
                        flexShrink:     0,
                      }}
                    >
                      {/* Search slot - snaps 32px ↔ 276px on toggle */}
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

                      {/* Collapse all - conditional, hides in organize mode */}
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
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%', alignItems: 'start' }}>
                          {visiblePins.map((p, i) => {
                            const { id } = p
                            const chunkIndex = i + 3
                            return (
                              <EnterChunk key={id} cfg={enterAnimation} index={chunkIndex} style={{ minWidth: 0 }}>
                                <PinGridCell
                                  pin={p}
                                  userTags={userTagsById[id] ?? EMPTY_TAGS}
                                  deletedLabelIndices={deletedLabelsById[id] ?? EMPTY_SET}
                                  onAddTag={handlePinAddTag}
                                  onDeleteTag={handlePinDeleteTag}
                                  isOrganizing={isOrganizing}
                                  isSelected={selectedPinIds.has(id)}
                                  collapseSignal={collapseSignal}
                                  onToggle={togglePin}
                                  onExpandedChange={handlePinExpandedChange}
                                />
                              </EnterChunk>
                            )
                          })}
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

            {/* ── Organize bulk toolbar - below content wrapper, slides in on organize ── */}
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
                  <div ref={folderPickerRef} style={{ position: 'relative' }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<FolderOneIcon size={16} />}
                      disabled={selectedPinIds.size === 0 || folders.length === 0}
                      onClick={() => setShowFolderPicker(v => !v)}
                    >
                      Move to folder
                    </Button>
                    <AnimatePresence>
                      {showFolderPicker && (
                        <motion.div
                          key="folder-picker"
                          initial={{ opacity: 0, y: 6, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{   opacity: 0, y: 6, scale: 0.97 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                          style={{
                            position:  'absolute',
                            bottom:    'calc(100% + 6px)',
                            left:      0,
                            background: 'var(--neutral-white, #fff)',
                            border:    '1px solid var(--neutral-200)',
                            borderRadius: 12,
                            boxShadow: '0px 8px 24px -4px rgba(38,33,30,0.14), 0px 0px 0px 1px var(--neutral-100)',
                            padding:   4,
                            minWidth:  192,
                            zIndex:    20,
                          }}
                        >
                          {personalFolders.map(folder => (
                            <button
                              key={folder.id}
                              onClick={() => {
                                handleMoveToFolder(folder.id)
                                setShowFolderPicker(false)
                              }}
                              style={{
                                display:      'flex',
                                alignItems:   'center',
                                gap:          8,
                                width:        '100%',
                                padding:      '6px 10px',
                                background:   'transparent',
                                border:       'none',
                                cursor:       'pointer',
                                borderRadius: 8,
                                textAlign:    'left',
                                fontFamily:   'var(--font-body)',
                                fontWeight:   'var(--font-weight-medium)',
                                fontSize:     'var(--font-size-body)',
                                lineHeight:   'var(--line-height-body)',
                                color:        'var(--neutral-800)',
                                transition:   'background 100ms',
                              }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--neutral-100)' }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                            >
                              <FolderOneIcon size={16} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {folder.name}
                              </span>
                            </button>
                          ))}
                          {projectFolders.length > 0 && (
                            <>
                              <div style={{ height: 1, background: 'var(--neutral-100)', margin: '4px 10px' }} />
                              {projectFolders.map(folder => (
                                <button
                                  key={folder.id}
                                  onClick={() => {
                                    handleMoveToFolder(folder.id)
                                    setShowFolderPicker(false)
                                  }}
                                  style={{
                                    display:      'flex',
                                    alignItems:   'center',
                                    gap:          8,
                                    width:        '100%',
                                    padding:      '6px 10px',
                                    background:   'transparent',
                                    border:       'none',
                                    cursor:       'pointer',
                                    borderRadius: 8,
                                    textAlign:    'left',
                                    fontFamily:   'var(--font-body)',
                                    fontWeight:   'var(--font-weight-medium)',
                                    fontSize:     'var(--font-size-body)',
                                    lineHeight:   'var(--line-height-body)',
                                    color:        'var(--neutral-800)',
                                    transition:   'background 100ms',
                                  }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--neutral-100)' }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                                >
                                  <FolderOneIcon size={16} />
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {folder.name}
                                  </span>
                                </button>
                              ))}
                            </>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
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
        )}
      </motion.div>
    </div>

    {/* ── Create folder modal ─────────────────────────────────────────────── */}
    {createPortal(
      <AnimatePresence>
        {showCreateFolderModal && (
          <motion.div
            key="create-folder-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => { setShowCreateFolderModal(false); setModalFolderName('') }}
            style={{
              position:        'fixed',
              inset:           0,
              zIndex:          9999,
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              backgroundColor: 'rgba(26,23,20,0.4)',
              backdropFilter:  'blur(2px)',
            }}
          >
            <motion.div
              key="create-folder-dialog"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1,    y: 0 }}
              exit={{    opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 32, mass: 0.8 }}
              onClick={e => e.stopPropagation()}
              style={{
                background:    'var(--neutral-white)',
                borderRadius:  '20px',
                boxShadow:     '0px 8px 32px 0px rgba(26,23,20,0.24), 0px 0px 0px 1px rgba(59,54,50,0.12)',
                width:         '360px',
                maxWidth:      'calc(100vw - 32px)',
                display:       'flex',
                flexDirection: 'column',
                overflow:      'hidden',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 16px' }}>
                <p style={{ margin: 0, fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 18, lineHeight: '26px', color: 'var(--neutral-900)' }}>
                  New folder
                </p>
                <IconButton
                  variant="ghost"
                  size="sm"
                  icon={<CancelOneIcon size={20} />}
                  aria-label="Close"
                  onClick={() => { setShowCreateFolderModal(false); setModalFolderName('') }}
                />
              </div>
              {/* Body */}
              <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <InputField
                  label="Folder name"
                  showLabel
                  placeholder="e.g. Research notes"
                  value={modalFolderName}
                  onChange={setModalFolderName}
                  fluid
                  autoFocus
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === 'Enter')  handleCreateFolder()
                    if (e.key === 'Escape') { setShowCreateFolderModal(false); setModalFolderName('') }
                  }}
                  aria-label="Folder name"
                />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setShowCreateFolderModal(false); setModalFolderName('') }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    disabled={!modalFolderName.trim()}
                    onClick={handleCreateFolder}
                  >
                    Create folder
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    )}
    </>
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
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setConfirmDelete(false) }}>
                  Cancel
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onDelete(); setConfirmDelete(false) }}
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

      {/* Inner shadow - matches SidebarMenuItem active state */}
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
// Memoized so that scroll-induced parent re-renders (atTop/atBottom state)
// don't cascade into every pin card.

const PinGridCell = React.memo(function PinGridCell({
  pin,
  userTags,
  deletedLabelIndices,
  onAddTag,
  onDeleteTag,
  isOrganizing,
  isSelected,
  collapseSignal,
  onToggle,
  onExpandedChange,
}: {
  pin:                 PinboardPin
  userTags:            { color: BadgeColor; text: string }[]
  deletedLabelIndices: Set<number>
  onAddTag:            (pinId: string, text: string, color: BadgeColor) => void
  onDeleteTag:         (pinId: string, index: number, source: 'label' | 'user') => void
  isOrganizing:        boolean
  isSelected:          boolean
  collapseSignal:      number
  onToggle:            (pinId: string) => void
  onExpandedChange?:   (pinId: string, expanded: boolean) => void
}) {
  const { id, ...pinProps } = pin

  const handleAddTag    = useCallback((text: string, color: BadgeColor) => onAddTag(id, text, color), [id, onAddTag])
  const handleDeleteTag = useCallback((index: number, source: 'label' | 'user') => onDeleteTag(id, index, source), [id, onDeleteTag])
  const handleToggle    = useCallback(() => onToggle(id), [id, onToggle])
  const handleExpChange = useCallback((expanded: boolean) => onExpandedChange?.(id, expanded), [id, onExpandedChange])

  return (
    <div
      style={{
        position:      'relative',
        borderRadius:  16,
        width:         '100%',
        minWidth:      0,
        outline:       isSelected ? `2px solid var(--focus-ring)` : undefined,
        outlineOffset: isSelected ? 2 : undefined,
      }}
    >
      <Pin
        fluid
        collapseSignal={collapseSignal}
        onExpandedChange={handleExpChange}
        tagsEditable
        userTags={userTags}
        deletedLabelIndices={deletedLabelIndices}
        onAddTag={handleAddTag}
        onDeleteTag={handleDeleteTag}
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
            onClick={handleToggle}
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
})

export default PinboardExpanded
