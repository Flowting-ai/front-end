'use client'

import React, { Suspense, useRef, useState, useCallback, useMemo, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, m } from 'framer-motion'
import { SearchOneIcon, PlusSignIcon } from '@strange-huge/icons'
import { toast } from 'sonner'
import { ChatRow } from '@/components/ChatRow'
import { ChatSelectionBar } from '@/components/ChatSelectionBar'
import { MoveToProjectModal } from '@/components/MoveToProjectModal'
import { Button } from '@/components/Button'
import { InputField } from '@/components/InputField'
import { useChatHistoryContext } from '@/context/chat-history-context'
import { useProjects } from '@/context/projects-context'
import { usePinboard } from '@/context/pinboard-context'
import { addChatToProject } from '@/lib/api/projects'
import { listSharedWithMe } from '@/lib/api/chat-shares'
import type { SharedChatItem } from '@/lib/api/chat-shares'
import { CHAT_ROUTE, CHAT_SHARE_ROUTE, BRAIN_ROUTE } from '@/lib/routes'
import { Tabs, TabsList, TabsTrigger } from '@/components/Tabs'
import { Badge } from '@/components/Badge'
import { Skeleton } from '@/components/Skeleton'
import { formatRelativeTime } from '@/lib/utils/format-utils'
import { LibraryFilterButton, type LibraryMode } from '@/components/LibraryFilterButton'
import {
  listBrainChats,
  renameBrainChat,
  starBrainChat,
  deleteBrainChat,
  type BrainChatListItem,
} from '@/lib/api/brain'
import { openDeleteChatDialog } from '@/components/layout/AppDialogs'
import {
  BRAIN_NEW_THREAD_EVENT,
  BRAIN_THREAD_DELETED_EVENT,
  emitBrainThreadDeleted,
  type BrainThreadDeletedEventDetail,
} from '@/hooks/use-sidebar-events'
import { listAutomations } from '@/lib/api/automations'
import { getAllScheduleLinks } from '@/lib/scheduleLinks'

// ── Library page — merged Chats + Tasks ─────────────────────────────────────
// Was two separate pages (/chats and /brain/threads); merged into one, with
// LibraryFilterButton (same Tooltip+IconButton+Dropdown.Float pattern as
// Pinboard's own Filter button) switching the whole page between:
//   Chats mode → tabs: All chats, Shared with me, Archived chats
//   Tasks mode → tab:  All tasks (brain/threads' content, inlined verbatim)
// /brain/threads is now a redirect stub into Tasks mode (?filter=tasks).

type ChatsTab = 'all' | 'shared' | 'archived'

function formatTaskTimestamp(iso: string | undefined | null): string {
  if (!iso) return ''
  const d    = new Date(iso)
  const now  = new Date()
  const diff = (now.getTime() - d.getTime()) / 1000

  if (diff < 60)        return 'Just now'
  if (diff < 3600)      return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)     return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 2) return 'Yesterday'
  if (diff < 86400 * 7) return d.toLocaleDateString('en-US', { weekday: 'short' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Page wrapper — Suspense required for useSearchParams ────────────────────

export default function ChatsPage() {
  return (
    <Suspense fallback={null}>
      <ChatsPageInner />
    </Suspense>
  )
}

function ChatsPageInner() {
  const { push }        = useRouter()
  const searchParams    = useSearchParams()
  const { chats, isLoading, hasMore, loadMore, rename, remove, removeLocal, star, archive } = useChatHistoryContext()
  const { projects, addChat }                     = useProjects()
  const { pins, isOpen, chatFilter, openForChat } = usePinboard()

  // ── Chats mode / Tasks mode ────────────────────────────────────────────────
  const [libraryMode, setLibraryMode] = useState<LibraryMode>(
    () => (searchParams.get('filter') === 'tasks' ? 'tasks' : 'chats'),
  )
  const [chatsTab, setChatsTab] = useState<ChatsTab>('all')

  const pinCountMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const pin of pins) {
      if (pin.chatId) map[pin.chatId] = (map[pin.chatId] ?? 0) + 1
    }
    return map
  }, [pins])

  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set())
  const [moveModalOpen, setMoveModalOpen] = useState(false)
  const [searchQuery,   setSearchQuery]   = useState('')
  const [isMoving,      setIsMoving]      = useState(false)
  const [sharedItems,   setSharedItems]   = useState<SharedChatItem[]>([])
  const [sharedLoading, setSharedLoading] = useState(false)

  // ── Derived ──────────────────────────────────────────────────────────────────

  // Archived chats live in their own tab, not "All chats".
  const activeChats = useMemo(() => chats.filter((c) => c.visibility !== 'archived'), [chats])
  const archivedChats = useMemo(() => chats.filter((c) => c.visibility === 'archived'), [chats])

  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return activeChats
    const q = searchQuery.toLowerCase()
    return activeChats.filter((c) => c.title.toLowerCase().includes(q))
  }, [activeChats, searchQuery])

  const scrollRef = useRef<HTMLDivElement>(null)
  const rowVirtualizer = useVirtualizer({
    count:            filteredChats.length,
    getScrollElement: () => scrollRef.current,
    // Normal mode: ChatRow 68px + wrapper padding 7px = 75px.
    // Selection mode: ChatRow 62px (explicit) + wrapper padding 7px = 69px.
    estimateSize:     () => selectionMode ? 69 : 75,
    overscan:         10,
  })

  const allSelected = selectedIds.size === activeChats.length && activeChats.length > 0

  // ── Selection helpers ─────────────────────────────────────────────────────────

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setSelectedIds(allSelected ? new Set() : new Set(activeChats.map((c) => c.id)))
  }, [allSelected, activeChats])

  const enterSelection = useCallback(() => {
    setSelectionMode(true)
    setSearchQuery('')
  }, [])

  const exitSelection = useCallback(() => {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }, [])

  // ── Mode / tab switching — always leave selection mode behind ───────────────

  const handleLibraryModeChange = useCallback((mode: LibraryMode) => {
    setLibraryMode(mode)
    exitSelection()
  }, [exitSelection])

  const handleChatsTabChange = useCallback((tab: ChatsTab) => {
    setChatsTab(tab)
    if (tab !== 'all') exitSelection()
    if (tab === 'shared' && sharedItems.length === 0) {
      setSharedLoading(true)
      listSharedWithMe()
        .then(setSharedItems)
        .catch(() => toast.error('Failed to load shared chats'))
        .finally(() => setSharedLoading(false))
    }
  }, [exitSelection, sharedItems.length])

  // ── Chats actions ─────────────────────────────────────────────────────────────

  const handleNewChat = useCallback(() => {
    push(CHAT_ROUTE)
  }, [push])

  const handleOpenChat = useCallback((chatId: string) => {
    push(`${CHAT_ROUTE}?id=${chatId}`)
  }, [push])

  // Infinite scroll: fetch the next cursor-based page once the user nears the
  // bottom of the virtualized list. loadMore's own loadingRef guard (inside
  // use-chat-history) dedupes overlapping calls, so hasMore is the only guard
  // needed here to avoid firing once there is nothing left to fetch.
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el || !hasMore || isLoading) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distanceFromBottom < 400) loadMore()
  }, [hasMore, isLoading, loadMore])

  const handleDelete = useCallback(async () => {
    if (selectedIds.size === 0) return
    try {
      await Promise.all([...selectedIds].map((id) => remove(id)))
      toast.success(`Deleted ${selectedIds.size} chat${selectedIds.size > 1 ? 's' : ''}`)
      exitSelection()
    } catch {
      toast.error('Failed to delete some chats')
    }
  }, [selectedIds, remove, exitSelection])

  const handleMoveToProject = useCallback(async (projectId: string) => {
    if (selectedIds.size === 0) return
    setIsMoving(true)
    const ids = [...selectedIds]
    try {
      const results = await Promise.allSettled(ids.map((id) => addChatToProject(projectId, id)))
      const succeeded = ids.filter((_, i) => results[i].status === 'fulfilled')
      const failCount = ids.length - succeeded.length

      for (const id of succeeded) {
        const title = chats.find(c => c.id === id)?.title ?? ''
        addChat(projectId, id, title)
      }

      if (succeeded.length > 0) {
        // Remove moved chats from local list — they now live inside the project.
        // Use removeLocal (not remove) to avoid calling the backend delete API.
        removeLocal(...succeeded)
        const project = projects.find((p) => p.id === projectId)
        const baseMsg = `Moved ${succeeded.length} chat${succeeded.length > 1 ? 's' : ''} to "${project?.name ?? 'project'}"`
        if (failCount > 0) {
          toast.warning(`${baseMsg} (${failCount} failed)`)
        } else {
          toast.success(baseMsg)
        }
        setMoveModalOpen(false)
        exitSelection()
      } else {
        toast.error('Failed to move chats to project')
      }
    } finally {
      setIsMoving(false)
    }
  }, [selectedIds, projects, chats, removeLocal, exitSelection, addChat])

  // Viewing a share is always read-only-in-place now — forking into your own
  // copy is a separate, explicit action from inside that view (there's no
  // "editable" mode any more to skip straight past it for).
  const handleOpenShared = useCallback((item: SharedChatItem) => {
    push(CHAT_SHARE_ROUTE(item.shareId))
  }, [push])

  // ── Tasks mode state (brain/threads' content, inlined verbatim) ─────────────

  const [threads,     setThreads]     = useState<BrainChatListItem[]>([])
  const [tasksLoading, setTasksLoading] = useState(true)
  const [tasksSearchQuery, setTasksSearchQuery] = useState('')
  // Chat ids that are linked to a still-existing schedule — drives the
  // "Scheduled" tag on each thread row. Cross-referenced against the live
  // task list since scheduleLinks is a local-only map that isn't cleaned up
  // when a schedule is deleted.
  const [scheduledChatIds, setScheduledChatIds] = useState<Set<string>>(new Set())
  const tasksLoadedRef = useRef(false)

  // Lazily load tasks the first time Tasks mode is actually opened, matching
  // how the Shared tab above lazy-loads on first visit.
  useEffect(() => {
    if (libraryMode !== 'tasks' || tasksLoadedRef.current) return
    tasksLoadedRef.current = true
    setTasksLoading(true)
    listBrainChats()
      .then(setThreads)
      .catch(() => toast.error('Failed to load tasks'))
      .finally(() => setTasksLoading(false))
    listAutomations()
      .then(tasks => {
        const links = getAllScheduleLinks()
        const chatIds = tasks.map(t => links[t.id]).filter((id): id is string => !!id)
        setScheduledChatIds(new Set(chatIds))
      })
      .catch(() => {})
  }, [libraryMode])

  // Navigate to /brain when sidebar "New thread" button fires the event.
  useEffect(() => {
    const handler = () => push(BRAIN_ROUTE)
    window.addEventListener(BRAIN_NEW_THREAD_EVENT, handler)
    return () => window.removeEventListener(BRAIN_NEW_THREAD_EVENT, handler)
  }, [push])

  // Keep the list in sync when a thread is deleted elsewhere (e.g. the sidebar),
  // so it disappears here without a manual refresh.
  useEffect(() => {
    const handleDeleted = (e: Event) => {
      const { chatId } = (e as CustomEvent<BrainThreadDeletedEventDetail>).detail
      setThreads(prev => prev.filter(t => t.id !== chatId))
    }
    window.addEventListener(BRAIN_THREAD_DELETED_EVENT, handleDeleted)
    return () => window.removeEventListener(BRAIN_THREAD_DELETED_EVENT, handleDeleted)
  }, [])

  const filteredThreads = useMemo(() => {
    if (!tasksSearchQuery.trim()) return threads
    const q = tasksSearchQuery.toLowerCase()
    return threads.filter(t => (t.chat_title || '').toLowerCase().includes(q))
  }, [threads, tasksSearchQuery])

  const handleTaskRename = useCallback((id: string, title: string) => {
    setThreads(prev => prev.map(t => t.id === id ? { ...t, chat_title: title } : t))
    void renameBrainChat(id, title).catch(() => toast.error('Failed to rename thread'))
  }, [])

  const handleTaskStar = useCallback((id: string) => {
    setThreads(prev => prev.map(t => t.id === id ? { ...t, starred: !t.starred } : t))
    void starBrainChat(id).catch(() => {
      setThreads(prev => prev.map(t => t.id === id ? { ...t, starred: !t.starred } : t))
    })
  }, [])

  const handleTaskDelete = useCallback((id: string, title: string) => {
    openDeleteChatDialog({
      chatId:    id,
      chatTitle: title,
      onConfirm: async () => {
        await deleteBrainChat(id)
        setThreads(prev => prev.filter(t => t.id !== id))
        emitBrainThreadDeleted({ chatId: id })
        toast.success('Task deleted')
      },
    })
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div
      ref={scrollRef}
      className="kaya-scrollbar"
      onScroll={handleScroll}
      style={{
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        width:         '100%',
        height:        '100%',
        overflowY:     'auto',
        overflowX:     'hidden',
        paddingBottom: 40,
        boxSizing:     'border-box',
        backgroundColor: 'var(--neutral-50)',
      }}
    >
      {/* Horizontal padding lives here, not on the scrolling element above —
          keeps the scrollbar flush with the container's edge. */}
      <div style={{ width: '100%', maxWidth: 884, padding: '0 24px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            padding:        '20px 0 14px',
            minHeight:      60,
          }}
        >
          {/* Title */}
          <h1
            style={{
              margin:     0,
              fontFamily: 'var(--font-title)',
              fontSize:   24,
              fontWeight: 400,
              lineHeight: '32px',
              color:      'var(--neutral-900)',
              flexShrink: 0,
            }}
          >
            {libraryMode === 'chats' ? 'Chats' : 'Tasks'}
          </h1>

          {/* Right controls — animates between normal ↔ selection */}
          <AnimatePresence mode="wait" initial={false}>
            {selectionMode ? (
              <m.div
                key="selection"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              >
                <ChatSelectionBar
                  selectedCount={selectedIds.size}
                  totalCount={activeChats.length}
                  onToggleAll={toggleAll}
                  onMoveToProject={() => setMoveModalOpen(true)}
                  onDelete={handleDelete}
                  onCancel={exitSelection}
                />
              </m.div>
            ) : (
              <m.div
                key="normal"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                {libraryMode === 'chats' ? (
                  <>
                    {chatsTab === 'all' && (
                      <Button variant="outline" onClick={enterSelection}>
                        Select
                      </Button>
                    )}
                    <Button
                      variant="default"
                      leftIcon={<PlusSignIcon animated />}
                      onClick={handleNewChat}
                    >
                      New chat
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="default"
                    leftIcon={<PlusSignIcon animated />}
                    onClick={() => push(BRAIN_ROUTE)}
                  >
                    New task
                  </Button>
                )}
              </m.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Tabs + filter button ─────────────────────────────────────────── */}
        {!selectionMode && (
          <div
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'space-between',
              gap:            12,
              padding:        '4px 0 12px',
              borderBottom:   '1px solid var(--neutral-100)',
              marginBottom:   12,
            }}
          >
            {libraryMode === 'chats' ? (
              <Tabs value={chatsTab} onValueChange={(v) => handleChatsTabChange(v as ChatsTab)}>
                <TabsList>
                  <TabsTrigger value="all">All chats</TabsTrigger>
                  <TabsTrigger value="shared">Shared with me</TabsTrigger>
                  <TabsTrigger value="archived">Archived chats</TabsTrigger>
                </TabsList>
              </Tabs>
            ) : (
              <Tabs value="all">
                <TabsList>
                  <TabsTrigger value="all">All tasks</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
            <LibraryFilterButton value={libraryMode} onChange={handleLibraryModeChange} />
          </div>
        )}

        {/* ══════════════════════════ Chats mode ══════════════════════════ */}
        {libraryMode === 'chats' && (
          <>

        {/* ── Shared with me view ─────────────────────────────────────────── */}
        {chatsTab === 'shared' && !selectionMode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sharedLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} height={62} radius={12} style={{ opacity: 1 - i * 0.15 }} />
                ))}
              </div>
            )}
            {!sharedLoading && sharedItems.length === 0 && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: '32px 0', textAlign: 'center' }}>No chats have been shared with you yet.</p>
            )}
            {sharedItems.map(item => (
              <div
                key={item.shareId}
                style={{
                  display:         'flex',
                  alignItems:      'center',
                  gap:             12,
                  padding:         '12px 16px',
                  borderRadius:    12,
                  backgroundColor: 'white',
                  boxShadow:       '0px 1px 2px rgba(18,12,8,0.08), 0px 0px 0px 1px var(--neutral-100)',
                }}
              >
                <div style={{ flex: '1 0 0', minWidth: 0 }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.chatTitle || 'Untitled chat'}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-400)' }}>
                      Shared by <span style={{ fontWeight: 700, color: 'var(--neutral-700)' }}>{item.sharedByName ?? 'someone'}</span>
                    </span>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-300)' }}>·</span>
                    <Badge label="Read-only" color="Red" />
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenShared(item)}
                >
                  Open
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* ── Archived chats view ──────────────────────────────────────────── */}
        {chatsTab === 'archived' && !selectionMode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }} role="list" aria-label="Archived chats">
            {isLoading && chats.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} height={62} radius={12} style={{ opacity: 1 - i * 0.15 }} />
                ))}
              </div>
            )}
            {!isLoading && archivedChats.length === 0 && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: '32px 0', textAlign: 'center' }}>No archived chats.</p>
            )}
            {archivedChats.map((chat) => (
              <div key={chat.id} role="listitem" style={{ padding: '1px 0 6px' }}>
                <ChatRow
                  title={chat.title}
                  timestamp={formatRelativeTime(chat.last_message_at ?? chat.updated_at)}
                  pinCount={pinCountMap[chat.id] ?? chat.pins_count ?? 0}
                  pinBoardOpen={isOpen && chatFilter === chat.id}
                  onPinClick={pinCountMap[chat.id] ? () => openForChat(chat.id) : undefined}
                  starred={chat.starred}
                  archived
                  onClick={() => handleOpenChat(chat.id)}
                  onMoveToProject={() => { setSelectedIds(new Set([chat.id])); setMoveModalOpen(true) }}
                  onDelete={async () => { if (await remove(chat.id)) toast.success('Chat deleted') }}
                />
              </div>
            ))}
          </div>
        )}

        {/* ── All chats content (original) ─────────────────────────────────── */}
        {(chatsTab === 'all' || selectionMode) && (
          <>

        {/* ── Search — hidden in selection mode ───────────────────────────── */}
        <AnimatePresence initial={false}>
          {!selectionMode && (
            <m.div
              key="search"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              style={{ overflow: 'hidden', marginBottom: 16, marginTop: 4, padding: '4px' }}
            >
              <InputField
                fluid
                placeholder="Search chats…"
                leftIcon={<SearchOneIcon size={16} color="var(--neutral-400)" />}
                value={searchQuery}
                onChange={setSearchQuery}
              />
            </m.div>
          )}
        </AnimatePresence>

        {/* ── Loading skeleton ─────────────────────────────────────────────── */}
        {isLoading && chats.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} height={62} radius={12} style={{ opacity: 1 - i * 0.15 }} />
            ))}
          </div>
        )}

        {/* ── Chat list ────────────────────────────────────────────────────── */}
        {!isLoading || chats.length > 0 ? (
          <div role="list" aria-label="Chats">

            {/* No results */}
            {filteredChats.length === 0 && searchQuery && (
              <p
                style={{
                  margin:     '32px 0',
                  textAlign:  'center',
                  fontFamily: 'var(--font-body)',
                  fontSize:   'var(--font-size-body)',
                  color:      'var(--neutral-400)',
                }}
              >
                No chats match &ldquo;{searchQuery}&rdquo;
              </p>
            )}

            {/* Empty slot — only when no chats exist and not searching/selecting */}
            {!selectionMode && !searchQuery && activeChats.length === 0 && (
              <div role="listitem" style={{ padding: '1px 0' }}>
                <ChatRow isEmpty />
              </div>
            )}

            {/* Selection empty state */}
            {selectionMode && activeChats.length === 0 && (
              <p
                style={{
                  margin:     '32px 0',
                  textAlign:  'center',
                  fontFamily: 'var(--font-title)',
                  fontSize:   24,
                  fontWeight: 400,
                  lineHeight: '32px',
                  color:      'var(--neutral-400)',
                }}
              >
                No chats yet to select
              </p>
            )}

            {/* Virtualized rows */}
            {filteredChats.length > 0 && (
              <div style={{ position: 'relative', height: rowVirtualizer.getTotalSize() }}>
                {rowVirtualizer.getVirtualItems().map((vRow) => {
                  const chat = filteredChats[vRow.index]
                  return (
                    <div
                      key={chat.id}
                      role="listitem"
                      style={{
                        position:  'absolute',
                        top:       0,
                        left:      0,
                        width:     '100%',
                        height:    selectionMode ? 69 : 75,
                        boxSizing: 'border-box',
                        padding:   '1px 0 6px',
                        transform: `translateY(${vRow.start}px)`,
                      }}
                    >
                      <ChatRow
                        title={chat.title}
                        timestamp={formatRelativeTime(chat.last_message_at ?? chat.updated_at)}
                        pinCount={pinCountMap[chat.id] ?? chat.pins_count ?? 0}
                        pinBoardOpen={isOpen && chatFilter === chat.id}
                        onPinClick={pinCountMap[chat.id] ? () => openForChat(chat.id) : undefined}
                        starred={chat.starred}
                        selectionMode={selectionMode}
                        selected={selectedIds.has(chat.id)}
                        readOnly={chat.can_edit === false && chat.visibility === 'team'}
                        onSelect={() => toggleSelect(chat.id)}
                        onClick={() => handleOpenChat(chat.id)}
                        onRename={(newTitle) => rename(chat.id, newTitle)}
                        onStar={() => star(chat.id)}
                        onMoveToProject={() => { setSelectedIds(new Set([chat.id])); setMoveModalOpen(true) }}
                        onDelete={async () => { if (await remove(chat.id)) toast.success('Chat deleted') }}
                        onArchive={() => void archive(chat.id)}
                      />
                    </div>
                  )
                })}
              </div>
            )}

          </div>
        ) : null}

          </>
        )}

          </>
        )}

        {/* ══════════════════════════ Tasks mode ══════════════════════════ */}
        {libraryMode === 'tasks' && (
          <>

            {/* ── Search ── */}
            <div style={{ marginBottom: 16, marginTop: 4, padding: '4px' }}>
              <InputField
                fluid
                placeholder="Search tasks…"
                leftIcon={<SearchOneIcon size={16} color="var(--neutral-400)" />}
                value={tasksSearchQuery}
                onChange={setTasksSearchQuery}
              />
            </div>

            {/* ── Loading skeleton ── */}
            {tasksLoading && threads.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} height={62} radius={12} style={{ opacity: 1 - i * 0.15 }} />
                ))}
              </div>
            )}

            {/* ── Thread list ── */}
            {(!tasksLoading || threads.length > 0) && (
              <div role="list" aria-label="Tasks">

                {filteredThreads.length === 0 && tasksSearchQuery && (
                  <p style={{
                    margin:     '32px 0',
                    textAlign:  'center',
                    fontFamily: 'var(--font-body)',
                    fontSize:   'var(--font-size-body)',
                    color:      'var(--neutral-400)',
                  }}>
                    No tasks match &ldquo;{tasksSearchQuery}&rdquo;
                  </p>
                )}

                {!tasksSearchQuery && threads.length === 0 && !tasksLoading && (
                  <div role="listitem" style={{ padding: '1px 0' }}>
                    <ChatRow isEmpty />
                  </div>
                )}

                {filteredThreads.map(thread => (
                  <div key={thread.id} role="listitem" style={{ padding: '1px 0 6px' }}>
                    <ChatRow
                      title={thread.chat_title || 'Untitled'}
                      timestamp={formatTaskTimestamp(thread.updated_at ?? thread.created_at)}
                      starred={thread.starred}
                      scheduled={scheduledChatIds.has(thread.id)}
                      onClick={() => push(`${BRAIN_ROUTE}?id=${thread.id}`)}
                      onRename={(title) => handleTaskRename(thread.id, title)}
                      onStar={() => handleTaskStar(thread.id)}
                      onDelete={() => handleTaskDelete(thread.id, thread.chat_title)}
                    />
                  </div>
                ))}

              </div>
            )}

          </>
        )}

      </div>

      {/* ── Move to project modal ───────────────────────────────────────────── */}
      <MoveToProjectModal
        open={moveModalOpen && !isMoving}
        onClose={() => setMoveModalOpen(false)}
        onConfirm={handleMoveToProject}
        projects={projects.map((p) => ({ id: p.id, name: p.name, description: p.description }))}
        chatCount={selectedIds.size}
      />

    </div>
  )
}
