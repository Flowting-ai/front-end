'use client'

import React, { Suspense, useRef, useState, useCallback, useMemo, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, m } from 'framer-motion'
import { SearchOneIcon, CancelCircleIcon, PlusSignIcon, AiWebBrowsingIcon, BubbleChatIcon } from '@strange-huge/icons'
import { IconButton } from '@/components/IconButton'
import { Tooltip } from '@/components/Tooltip'
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
import type { LibraryMode } from '@/components/LibraryFilterButton'
import { useBrainThreadContext } from '@/context/brain-thread-context'
import { openDeleteChatDialog } from '@/components/layout/AppDialogs'
import { BRAIN_NEW_THREAD_EVENT } from '@/hooks/use-sidebar-events'
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
  const { push, replace } = useRouter()
  const searchParams    = useSearchParams()
  const { chats, isLoading, hasMore, loadMore, rename, remove, removeLocal, star, archive } = useChatHistoryContext()
  const { projects, addChat }                     = useProjects()
  const { pins, isOpen, chatFilter, openForChat } = usePinboard()

  // ── Chats mode / Tasks mode ────────────────────────────────────────────────
  const [libraryMode, setLibraryMode] = useState<LibraryMode>(
    () => (searchParams.get('filter') === 'tasks' ? 'tasks' : 'chats'),
  )
  // `?tab=archived` — used by the archived-chat page's own back button
  // (TopBar) to land directly on the Archived tab instead of "All chats".
  const [chatsTab, setChatsTab] = useState<ChatsTab>(
    () => (searchParams.get('tab') === 'archived' ? 'archived' : 'all'),
  )

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
  // Shared by both Chats and Tasks mode — only one of their search inputs is
  // ever mounted at a time (gated by `libraryMode`), so one toggle is enough.
  const [searchOpen,    setSearchOpen]    = useState(false)
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
    // Sync to the URL — this used to be read-once (the useState initializer
    // above), so LeftSidebar's own useSearchParams() never saw a mode change
    // made after the page loaded, and kept showing Recent Chats/Tasks whether
    // or not it matched. Query-only, so it doesn't add a history entry per toggle.
    replace(mode === 'tasks' ? '?filter=tasks' : '?', { scroll: false })
  }, [exitSelection, replace])

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
        addChat(projectId, id, title, { skipLink: true })
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

  // ── Tasks mode state ─────────────────────────────────────────────────────────
  // Brain threads are shared app-wide via BrainThreadContext (mounted in
  // (app)/layout.tsx) — the same state the left sidebar's Tasks section reads
  // (src/app/(app)/brain/BrainSidebarSections.tsx), so a rename/pin/delete on
  // either surface is reflected on the other immediately, no reload needed.
  const { threads, isLoading: tasksLoading, rename: renameTask, star: starTask, remove: removeTask } = useBrainThreadContext()
  const [tasksSearchQuery, setTasksSearchQuery] = useState('')
  const [tasksTab, setTasksTab] = useState<'all' | 'scheduled'>('all')
  // Chat ids that are linked to a still-existing schedule — drives the
  // "Scheduled" tag on each thread row. Cross-referenced against the live
  // task list since scheduleLinks is a local-only map that isn't cleaned up
  // when a schedule is deleted.
  const [scheduledChatIds, setScheduledChatIds] = useState<Set<string>>(new Set())
  const scheduleLinksLoadedRef = useRef(false)

  // Lazily load schedule-link info the first time Tasks mode is actually
  // opened, matching how the Shared tab above lazy-loads on first visit.
  useEffect(() => {
    if (libraryMode !== 'tasks' || scheduleLinksLoadedRef.current) return
    scheduleLinksLoadedRef.current = true
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

  const filteredThreads = useMemo(() => {
    const scoped = tasksTab === 'scheduled' ? threads.filter(t => scheduledChatIds.has(t.id)) : threads
    if (!tasksSearchQuery.trim()) return scoped
    const q = tasksSearchQuery.toLowerCase()
    return scoped.filter(t => (t.chat_title || '').toLowerCase().includes(q))
  }, [threads, tasksSearchQuery, tasksTab, scheduledChatIds])

  const handleTaskDelete = useCallback((id: string, title: string) => {
    openDeleteChatDialog({
      chatId:    id,
      chatTitle: title,
      onConfirm: async () => { await removeTask(id) },
    })
  }, [removeTask])

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

        {/* ── Task/Chat tab strip — same Tabs used on the new-chat landing page
            (src/app/(app)/chat/page.tsx, Figma 136:53294), reused here in place
            of the old LibraryFilterButton dropdown. */}
        {!selectionMode && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 20 }}>
            <div style={{ width: 171 }}>
              <Tabs
                value={libraryMode === 'chats' ? 'chat' : 'task'}
                onValueChange={(v) => handleLibraryModeChange(v === 'task' ? 'tasks' : 'chats')}
              >
                <TabsList fluid>
                  <TabsTrigger value="task" icon={<AiWebBrowsingIcon size={16} animated />}>Task</TabsTrigger>
                  <TabsTrigger value="chat" icon={<BubbleChatIcon size={16} />}>Chat</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        )}

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            padding:        '16px 0 14px',
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
                        Move to project
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

        {/* ── Selection-mode helper copy — guides the user into the flow the
            "Move to project" button above just started. */}
        {selectionMode && (
          <p
            style={{
              margin:     '0 0 12px',
              fontFamily: 'var(--font-body)',
              fontSize:   'var(--font-size-body)',
              color:      'var(--neutral-400)',
            }}
          >
            Select the chats you&rsquo;d like to move to a project.
          </p>
        )}

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
              <Tabs value={tasksTab} onValueChange={(v) => setTasksTab(v as 'all' | 'scheduled')}>
                <TabsList>
                  <TabsTrigger value="all">All tasks</TabsTrigger>
                  <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: searchOpen ? '1 0 0' : undefined, minWidth: 0 }}>
              {/* Search — same morph-in-place pattern as PinboardHeader's own
                  search button: a ghost IconButton that turns into an inline
                  InputField (with its close icon embedded in the field
                  itself), not a separate button that swaps icon/opens a
                  second search bar elsewhere on the page. */}
              <Tooltip content="Search" disabled={searchOpen} side="bottom">
                <div style={{ display: 'flex', alignItems: 'center', flex: searchOpen ? '1 0 0' : undefined, minWidth: 0 }}>
                  <AnimatePresence initial={false} mode="popLayout">
                    {!searchOpen ? (
                      <m.span
                        key="search-btn"
                        layout
                        initial={{ opacity: 0, y: 4, filter: 'blur(4px)' }}
                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transition: { type: 'spring', duration: 0.3, bounce: 0 } }}
                        exit={{ opacity: 0, scale: 0.25, filter: 'blur(4px)', transition: { type: 'spring', duration: 0.2, bounce: 0 } }}
                        style={{ display: 'inline-flex', flexShrink: 0 }}
                      >
                        <IconButton
                          variant="ghost"
                          size="sm"
                          icon={<SearchOneIcon size={20} />}
                          aria-label="Open search"
                          onClick={() => setSearchOpen(true)}
                        />
                      </m.span>
                    ) : (
                      <m.div
                        key="search-input"
                        initial={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
                        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', transition: { type: 'spring', duration: 0.3, bounce: 0 } }}
                        exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)', transition: { duration: 0.15, ease: 'easeIn' } }}
                        style={{ flex: '1 0 0', minWidth: 0 }}
                      >
                        <InputField
                          label="Search"
                          showLabel={false}
                          leftIcon={<SearchOneIcon size={16} />}
                          rightIcon={
                            <span
                              role="button"
                              tabIndex={0}
                              aria-label="Close search"
                              onClick={() => { setSearchOpen(false); setSearchQuery(''); setTasksSearchQuery('') }}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setSearchOpen(false); setSearchQuery(''); setTasksSearchQuery('') } }}
                              className="kds-icon-in-field"
                              style={{ display: 'inline-flex', cursor: 'pointer', lineHeight: 0 }}
                            >
                              <CancelCircleIcon size={16} />
                            </span>
                          }
                          placeholder={libraryMode === 'chats' ? 'Search chats…' : 'Search tasks…'}
                          value={libraryMode === 'chats' ? searchQuery : tasksSearchQuery}
                          onChange={libraryMode === 'chats' ? setSearchQuery : setTasksSearchQuery}
                          fluid
                          autoFocus
                          aria-label="Search"
                        />
                      </m.div>
                    )}
                  </AnimatePresence>
                </div>
              </Tooltip>
            </div>
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
                />
              </div>
            ))}
          </div>
        )}

        {/* ── All chats content (original) ─────────────────────────────────── */}
        {(chatsTab === 'all' || selectionMode) && (
          <>

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
                        onShare={() => push(`/chat?id=${chat.id}&share=1`)}
                        onStar={() => star(chat.id)}
                        onMoveToProject={() => { setSelectedIds(new Set([chat.id])); setMoveModalOpen(true) }}
                        onDelete={() => openDeleteChatDialog({
                          chatId:    chat.id,
                          chatTitle: chat.title,
                          onConfirm: async () => { if (await remove(chat.id)) toast.success('Chat deleted') },
                        })}
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

                {!tasksSearchQuery && tasksTab === 'scheduled' && filteredThreads.length === 0 && threads.length > 0 && (
                  <p style={{
                    margin:     '32px 0',
                    textAlign:  'center',
                    fontFamily: 'var(--font-body)',
                    fontSize:   'var(--font-size-body)',
                    color:      'var(--neutral-400)',
                  }}>
                    No scheduled tasks yet
                  </p>
                )}

                {filteredThreads.map(thread => (
                  <div key={thread.id} role="listitem" style={{ padding: '1px 0 6px' }}>
                    <ChatRow
                      title={thread.chat_title || 'Untitled'}
                      timestamp={formatTaskTimestamp(thread.updated_at ?? thread.created_at)}
                      starred={thread.starred}
                      taskMode
                      scheduled={scheduledChatIds.has(thread.id)}
                      onClick={() => push(`${BRAIN_ROUTE}?id=${thread.id}`)}
                      onRename={(title) => renameTask(thread.id, title)}
                      onStar={() => starTask(thread.id)}
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
