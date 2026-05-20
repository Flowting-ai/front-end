'use client'

import React, { useRef, useState, useCallback, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
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
  const router                         = useRouter()
  const { chats, isLoading, rename, remove, removeLocal, star } = useChatHistoryContext()
  const { projects }                              = useProjects()
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
  const [isDeleting,    setIsDeleting]    = useState(false)
  const [isMoving,      setIsMoving]      = useState(false)

  // ── Derived ──────────────────────────────────────────────────────────────────

  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats
    const q = searchQuery.toLowerCase()
    return chats.filter((c) => c.title.toLowerCase().includes(q))
  }, [chats, searchQuery])

  const scrollRef = useRef<HTMLDivElement>(null)
  const rowVirtualizer = useVirtualizer({
    count:           filteredChats.length,
    getScrollElement: () => scrollRef.current,
    estimateSize:    () => 70,
    overscan:        5,
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
    router.push('/chat')
  }, [router])

  const handleOpenChat = useCallback((chatId: string) => {
    router.push(`/chat?id=${chatId}`)
  }, [router])

  const handleDelete = useCallback(async () => {
    if (selectedIds.size === 0) return
    setIsDeleting(true)
    try {
      await Promise.all([...selectedIds].map((id) => remove(id)))
      toast.success(`Deleted ${selectedIds.size} chat${selectedIds.size > 1 ? 's' : ''}`)
      exitSelection()
    } catch {
      toast.error('Failed to delete some chats')
    } finally {
      setIsDeleting(false)
    }
  }, [selectedIds, remove, exitSelection])

  const handleMoveToProject = useCallback(async (projectId: string) => {
    if (selectedIds.size === 0) return
    setIsMoving(true)
    const ids = [...selectedIds]
    try {
      await Promise.all(ids.map((id) => addChatToProject(projectId, id)))
      // Remove moved chats from the local list — they now live inside the project.
      // We use removeLocal (not remove) to avoid calling the backend delete API,
      // which would destroy the chat data that the project now references.
      removeLocal(...ids)
      const project = projects.find((p) => p.id === projectId)
      toast.success(
        `Moved ${ids.length} chat${ids.length > 1 ? 's' : ''} to "${project?.name ?? 'project'}"`,
      )
      setMoveModalOpen(false)
      exitSelection()
    } catch {
      toast.error('Failed to move some chats')
    } finally {
      setIsMoving(false)
    }
  }, [selectedIds, projects, removeLocal, exitSelection])

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
              <motion.div
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
              </motion.div>
            ) : (
              <motion.div
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Search — hidden in selection mode ───────────────────────────── */}
        <AnimatePresence initial={false}>
          {!selectionMode && (
            <motion.div
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
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Loading skeleton ─────────────────────────────────────────────── */}
        {isLoading && chats.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                style={{
                  height:          62,
                  borderRadius:    12,
                  backgroundColor: 'var(--neutral-100)',
                  opacity:         1 - i * 0.15,
                  animation:       'pulse 1.5s ease-in-out infinite',
                }}
              />
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

            {/* Virtualized rows */}
            {filteredChats.length > 0 && (
              <div style={{ position: 'relative', height: rowVirtualizer.getTotalSize() }}>
                {rowVirtualizer.getVirtualItems().map((vRow) => {
                  const chat = filteredChats[vRow.index]
                  return (
                    <div
                      key={chat.id}
                      role="listitem"
                      data-index={vRow.index}
                      ref={rowVirtualizer.measureElement}
                      style={{
                        position:  'absolute',
                        top:       0,
                        left:      0,
                        width:     '100%',
                        transform: `translateY(${vRow.start}px)`,
                        padding:   '1px 0 6px',
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
                        onSelect={() => toggleSelect(chat.id)}
                        onClick={() => handleOpenChat(chat.id)}
                        onRename={(newTitle) => rename(chat.id, newTitle)}
                        onStar={() => star(chat.id)}
                        onDelete={() => remove(chat.id)}
                      />
                    </div>
                  )
                })}
              </div>
            )}

          </div>
        ) : null}

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
