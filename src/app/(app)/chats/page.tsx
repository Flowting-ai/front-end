'use client'

import React, { useRef, useState, useCallback, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRouter } from 'next/navigation'
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
import { listSharedWithMe, forkChatShare } from '@/lib/api/chat-shares'
import type { SharedChatItem } from '@/lib/api/chat-shares'
import { CHAT_ROUTE, CHAT_SHARE_ROUTE } from '@/lib/routes'
import { Tabs, TabsList, TabsTrigger } from '@/components/Tabs'
import { Badge } from '@/components/Badge'
import { Skeleton } from '@/components/Skeleton'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string | undefined | null): string {
  if (!iso) return ''
  const d    = new Date(iso)
  const now  = new Date()
  const diff = (now.getTime() - d.getTime()) / 1000

  if (diff < 60)         return 'Just now'
  if (diff < 3600)       return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)      return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 2)  return 'Yesterday'
  if (diff < 86400 * 7)  return d.toLocaleDateString('en-US', { weekday: 'short' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ChatsPage() {
  const { push }                       = useRouter()
  const { chats, isLoading, rename, remove, removeLocal, star } = useChatHistoryContext()
  const { projects, addChat }                     = useProjects()
  const { pins, isOpen, chatFilter, openForChat } = usePinboard()

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
  const [activeTab,     setActiveTab]     = useState<'my' | 'shared'>('my')
  const [sharedItems,   setSharedItems]   = useState<SharedChatItem[]>([])
  const [sharedLoading, setSharedLoading] = useState(false)
  const [forkingId,     setForkingId]     = useState<string | null>(null)

  // ── Derived ──────────────────────────────────────────────────────────────────

  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats
    const q = searchQuery.toLowerCase()
    return chats.filter((c) => c.title.toLowerCase().includes(q))
  }, [chats, searchQuery])

  const scrollRef = useRef<HTMLDivElement>(null)
  const rowVirtualizer = useVirtualizer({
    count:            filteredChats.length,
    getScrollElement: () => scrollRef.current,
    // Normal mode: ChatRow 68px + wrapper padding 7px = 75px.
    // Selection mode: ChatRow 62px (explicit) + wrapper padding 7px = 69px.
    estimateSize:     () => selectionMode ? 69 : 75,
    overscan:         10,
  })

  const allSelected = selectedIds.size === chats.length && chats.length > 0

  // ── Selection helpers ─────────────────────────────────────────────────────────

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setSelectedIds(allSelected ? new Set() : new Set(chats.map((c) => c.id)))
  }, [allSelected, chats])

  const enterSelection = useCallback(() => {
    setSelectionMode(true)
    setSearchQuery('')
  }, [])

  const exitSelection = useCallback(() => {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }, [])

  // ── Actions ───────────────────────────────────────────────────────────────────

  const handleNewChat = useCallback(() => {
    push(CHAT_ROUTE)
  }, [push])

  const handleOpenChat = useCallback((chatId: string) => {
    push(`${CHAT_ROUTE}?id=${chatId}`)
  }, [push])

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

  const handleTabChange = useCallback((tab: 'my' | 'shared') => {
    setActiveTab(tab)
    if (tab === 'shared' && sharedItems.length === 0) {
      setSharedLoading(true)
      listSharedWithMe()
        .then(setSharedItems)
        .catch(() => toast.error('Failed to load shared chats'))
        .finally(() => setSharedLoading(false))
    }
  }, [sharedItems.length])

  const handleFork = useCallback(async (shareId: string) => {
    setForkingId(shareId)
    try {
      const { chatId } = await forkChatShare(shareId)
      toast.success('Chat copied to your history')
      push(`${CHAT_ROUTE}?id=${chatId}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to copy chat')
    } finally {
      setForkingId(null)
    }
  }, [push])

  const handleOpenShared = useCallback(async (item: SharedChatItem) => {
    if (item.mode === 'read_only') {
      push(CHAT_SHARE_ROUTE(item.shareId))
      return
    }
    await handleFork(item.shareId)
  }, [handleFork, push])

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div
      ref={scrollRef}
      className="kaya-scrollbar"
      style={{
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        width:         '100%',
        height:        '100%',
        overflowY:     'auto',
        overflowX:     'hidden',
        padding:       '0 24px 40px',
        boxSizing:     'border-box',
        backgroundColor: 'var(--neutral-50)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 836, display: 'flex', flexDirection: 'column' }}>

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
                  totalCount={chats.length}
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
                <Button variant="outline" onClick={enterSelection}>
                  Select
                </Button>
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

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        {!selectionMode && (
          <div style={{ padding: '4px 0 12px', borderBottom: '1px solid var(--neutral-100)', marginBottom: 12 }}>
            <Tabs value={activeTab} onValueChange={(v) => handleTabChange(v as 'my' | 'shared')}>
              <TabsList>
                <TabsTrigger value="my">My chats</TabsTrigger>
                <TabsTrigger value="shared">Shared with me</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        )}

        {/* ── Shared with me view ─────────────────────────────────────────── */}
        {activeTab === 'shared' && !selectionMode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sharedLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[...Array(4)].map((_, i) => (
                  // eslint-disable-next-line react/no-array-index-as-key -- fixed-count skeleton placeholders, index is stable
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
                    {item.mode === 'editable'
                      ? <Badge label="Editable" color="Green" />
                      : <Badge label="Read-only" color="Red" />
                    }
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={forkingId === item.shareId}
                  onClick={() => void handleOpenShared(item)}
                >
                  {forkingId === item.shareId ? 'Copying…' : item.mode === 'editable' ? 'Open copy' : 'Open'}
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* ── My chats content (original) ──────────────────────────────────── */}
        {(activeTab === 'my' || selectionMode) && (
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
              // eslint-disable-next-line react/no-array-index-as-key -- fixed-count skeleton placeholders, index is stable
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
            {!selectionMode && !searchQuery && chats.length === 0 && (
              <div role="listitem" style={{ padding: '1px 0' }}>
                <ChatRow isEmpty />
              </div>
            )}

            {/* Selection empty state */}
            {selectionMode && chats.length === 0 && (
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
                        timestamp={formatTimestamp(chat.last_message_at ?? chat.updated_at)}
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
                        onDelete={() => { remove(chat.id); toast.success('Chat deleted') }}
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
        open={moveModalOpen && !isMoving}
        onClose={() => setMoveModalOpen(false)}
        onConfirm={handleMoveToProject}
        projects={projects.map((p) => ({ id: p.id, name: p.name, description: p.description }))}
        chatCount={selectedIds.size}
      />

    </div>
  )
}
