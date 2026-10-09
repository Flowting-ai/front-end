'use client'

import React, { Suspense, useRef, useState, useCallback, useMemo, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, m } from 'framer-motion'
import { SearchOneIcon, CancelCircleIcon, PlusSignIcon, ArrowDownOneIcon } from '@strange-huge/icons'
import { IconButton } from '@/components/IconButton'
import { Tooltip } from '@/components/Tooltip'
import { toast } from 'sonner'
import { ChatRow } from '@/components/ChatRow'
import { ChatSelectionBar } from '@/components/ChatSelectionBar'
import { MoveToProjectModal } from '@/components/MoveToProjectModal'
import { ConfirmModal } from '@/components/ConfirmModal'
import { Button } from '@/components/Button'
import { InputField } from '@/components/InputField'
import { Dropdown } from '@/components/Dropdown'
import { useChatHistoryContext } from '@/context/chat-history-context'
import { useProjects } from '@/context/projects-context'
import { usePinboard } from '@/context/pinboard-context'
import { PINS_ENABLED } from '@/lib/feature-flags'
import { addChatToProject } from '@/lib/api/projects'
import { listSharedWithMe } from '@/lib/api/chat-shares'
import type { SharedChatItem } from '@/lib/api/chat-shares'
import { CHAT_ROUTE, CHAT_SHARE_ROUTE } from '@/lib/routes'
import { Badge } from '@/components/Badge'
import { Skeleton } from '@/components/Skeleton'
import { formatRelativeTime } from '@/lib/utils/format-utils'
import { openDeleteChatDialog } from '@/components/layout/AppDialogs'

type ChatsTab = 'all' | 'shared' | 'archived'

// ── Tab filter — Dropdown.Float instead of a Tabs bar, same pattern as
// ScopeFilterDropdown on the /projects page (Dropdown.Float + Button
// trigger + Dropdown.Section/Dropdown.Item, see projects/page.tsx). ──

const CHATS_TAB_LABEL: Record<ChatsTab, string> = {
  all:      'All chats',
  shared:   'Shared with me',
  archived: 'Archived chats',
}
// Same wording style as ScopeFilterDropdown's SCOPE_DESCRIPTION on /projects.
const CHATS_TAB_DESCRIPTION: Record<ChatsTab, string> = {
  all:      'Every chat you’ve created.',
  shared:   'Chats other people have shared with you.',
  archived: 'Chats you’ve archived.',
}
const CHATS_TAB_VALUES: readonly ChatsTab[] = ['all', 'shared', 'archived']

function LibraryTabDropdown<T extends string>({
  value, values, labels, descriptions, onChange,
}: {
  value: T
  values: readonly T[]
  labels: Record<T, string>
  descriptions: Record<T, string>
  onChange: (v: T) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Dropdown.Float
      open={open}
      onOpenChange={setOpen}
      placement="bottom-start"
      trigger={
        <Button variant="secondary" size="sm" rightIcon={<ArrowDownOneIcon size={16} />}>
          {/* In-place text swap — same transition ScopeFilterDropdown's own
              trigger label uses. */}
          <AnimatePresence mode="popLayout" initial={false}>
            <m.span
              key={value}
              initial={{ scale: 0.75, opacity: 0, filter: 'blur(4px)' }}
              animate={{ scale: 1,    opacity: 1, filter: 'blur(0px)' }}
              exit={{    scale: 0.75, opacity: 0, filter: 'blur(4px)' }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              style={{ display: 'block', transformOrigin: 'left center' }}
            >
              {labels[value]}
            </m.span>
          </AnimatePresence>
        </Button>
      }
    >
      <Dropdown size="md" maxHeight={false}>
        <Dropdown.Section fluid>
          {values.map(v => (
            <Dropdown.Item
              key={v}
              label={labels[v]}
              subLabel={descriptions[v]}
              selected={value === v}
              onClick={() => { onChange(v); setOpen(false) }}
              fluid
            />
          ))}
        </Dropdown.Section>
      </Dropdown>
    </Dropdown.Float>
  )
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
  const { push } = useRouter()
  const searchParams    = useSearchParams()
  const { chats, isLoading, hasMore, loadMore, rename, remove, removeLocal, star, archive } = useChatHistoryContext()
  const { projects, addChat }                     = useProjects()
  const { pins, isOpen, chatFilter, openForChat } = usePinboard()

  // `?tab=archived` — used by the archived-chat page's own back button
  // (TopBar) to land directly on the Archived tab instead of "All chats".
  const [chatsTab, setChatsTab] = useState<ChatsTab>(
    () => (searchParams.get('tab') === 'archived' ? 'archived' : 'all'),
  )

  // Re-sync any time the URL's ?tab= changes from outside this page — a
  // query-only same-route navigation Next doesn't remount for, so the
  // `useState` initializer above would otherwise only ever run once.
  useEffect(() => {
    const urlTab: ChatsTab = searchParams.get('tab') === 'archived' ? 'archived' : 'all'
    setChatsTab(prev => (prev === urlTab ? prev : urlTab))
  }, [searchParams])

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
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [searchQuery,   setSearchQuery]   = useState('')
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

  // ── Tab switching — always leave selection mode behind ──────────────────────

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
    const count = selectedIds.size
    try {
      await Promise.all([...selectedIds].map((id) => remove(id)))
      toast.success(`Deleted ${count} chat${count > 1 ? 's' : ''}`)
      exitSelection()
    } catch {
      toast.error('Failed to delete some chats')
    } finally {
      setBulkDeleteOpen(false)
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
            Chats
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
                  onDelete={() => setBulkDeleteOpen(true)}
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
            <LibraryTabDropdown
              value={chatsTab}
              values={CHATS_TAB_VALUES}
              labels={CHATS_TAB_LABEL}
              descriptions={CHATS_TAB_DESCRIPTION}
              onChange={handleChatsTabChange}
            />
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
                              onClick={() => { setSearchOpen(false); setSearchQuery('') }}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setSearchOpen(false); setSearchQuery('') } }}
                              className="kds-icon-in-field"
                              style={{ display: 'inline-flex', cursor: 'pointer', lineHeight: 0 }}
                            >
                              <CancelCircleIcon size={16} />
                            </span>
                          }
                          placeholder="Search chats…"
                          value={searchQuery}
                          onChange={setSearchQuery}
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

        {/* ── Shared with me view ─────────────────────────────────────────── */}
        {chatsTab === 'shared' && !selectionMode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sharedLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} height={68} radius={12} style={{ opacity: 1 - i * 0.15 }} />
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
                  backgroundColor: 'var(--neutral-white)',
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} height={68} radius={12} style={{ opacity: 1 - i * 0.15 }} />
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
                  pinCount={PINS_ENABLED ? (pinCountMap[chat.id] ?? chat.pins_count ?? 0) : 0}
                  pinBoardOpen={PINS_ENABLED && isOpen && chatFilter === chat.id}
                  onPinClick={PINS_ENABLED && pinCountMap[chat.id] ? () => openForChat(chat.id) : undefined}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {[...Array(7)].map((_, i) => (
              <Skeleton key={i} height={68} radius={12} style={{ opacity: 1 - i * 0.15 }} />
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
                        pinCount={PINS_ENABLED ? (pinCountMap[chat.id] ?? chat.pins_count ?? 0) : 0}
                        pinBoardOpen={PINS_ENABLED && isOpen && chatFilter === chat.id}
                        onPinClick={PINS_ENABLED && pinCountMap[chat.id] ? () => openForChat(chat.id) : undefined}
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

      </div>

      {/* ── Move to project modal ───────────────────────────────────────────── */}
      <MoveToProjectModal
        open={moveModalOpen}
        loading={isMoving}
        onClose={() => setMoveModalOpen(false)}
        onConfirm={handleMoveToProject}
        projects={projects.map((p) => ({ id: p.id, name: p.name, description: p.description }))}
        chatCount={selectedIds.size}
      />

      {/* ── Bulk delete confirm — mirrors the single-chat DeleteChatDialog's
          copy, just pluralized for the selection count. ── */}
      {bulkDeleteOpen && (
        <ConfirmModal
          title={`Delete ${selectedIds.size} chat${selectedIds.size > 1 ? 's' : ''}?`}
          description="This can't be undone."
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onClose={() => setBulkDeleteOpen(false)}
        />
      )}

    </div>
  )
}
