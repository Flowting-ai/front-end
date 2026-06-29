'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { m } from 'framer-motion'
import { toast } from 'sonner'
import { SidebarMenuItem } from '@/components/SidebarMenuItem'
import { SidebarMenuSkeleton } from '@/components/SidebarMenuSkeleton'
import {
  listBrainChats,
  renameBrainChat,
  starBrainChat,
  deleteBrainChat,
  type BrainChatListItem,
} from '@/lib/api/brain'
import { stripDocumentBlocks } from '@/lib/brain-file-extract'
import { openDeleteChatDialog } from '@/components/layout/AppDialogs'
import {
  BRAIN_THREAD_CREATED_EVENT,
  BRAIN_THREAD_TITLE_UPDATED_EVENT,
  BRAIN_THREAD_DELETED_EVENT,
  emitBrainThreadDeleted,
  type BrainThreadEventDetail,
  type BrainThreadDeletedEventDetail,
} from '@/hooks/use-sidebar-events'

// ── Dropdown styles — match ChatHistoryItem / ProjectChatItem exactly ─────────

const menuItemStyle: React.CSSProperties = {
  display:    'flex',
  alignItems: 'center',
  gap:        '8px',
  padding:    '7px 10px',
  borderRadius: '8px',
  cursor:     'pointer',
  fontFamily: 'var(--font-body)',
  fontWeight: 'var(--font-weight-medium)',
  fontSize:   'var(--font-size-body)',
  lineHeight: 'var(--line-height-body)',
  color:      'var(--neutral-700)',
  outline:    'none',
  userSelect: 'none',
}

const menuItemDestructiveStyle: React.CSSProperties = {
  ...menuItemStyle,
  color: 'var(--red-500)',
}

// ── Section collapse animation — matches LeftSidebar pattern ──────────────────

const sectionHeightVariants = {
  open: {
    height: 'auto' as const,
    transition: { duration: 0.28, ease: [0.4, 0, 0.2, 1] as const },
  },
  closed: {
    height: 0,
    transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] as const, delay: 0.14 },
  },
}


// ── Thread item with rename / star / delete dropdown ─────────────────────────

interface BrainThreadItemProps {
  thread:   BrainChatListItem
  isActive: boolean
  onSelect: () => void
  onRename: (id: string, title: string) => Promise<void>
  onStar:   (id: string) => Promise<void>
  onDelete: (id: string, title: string) => void
}

function BrainThreadItem({
  thread,
  isActive,
  onSelect,
  onRename,
  onStar,
  onDelete,
}: BrainThreadItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [menuOpen,  setMenuOpen]  = useState(false)
  const triggerRef       = useRef<HTMLButtonElement>(null)
  const pendingRenameRef = useRef(false)

  const handleCommit = (value: string) => {
    const trimmed = value.trim()
    if (trimmed && trimmed !== thread.chat_title) void onRename(thread.id, trimmed)
    setIsEditing(false)
  }

  const handleMoreClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    e.stopPropagation()
    setMenuOpen(true)
  }

  return (
    <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen}>
      <div style={{ position: 'relative', width: '100%' }}>
        <SidebarMenuItem
          fluid
          variant={isEditing ? 'chat-item-edit' : 'chat-item'}
          label={stripDocumentBlocks(thread.chat_title) || 'Untitled'}
          selected={isActive}
          href={isEditing ? undefined : `/brain?id=${thread.id}`}
          onClick={() => { if (!isEditing) onSelect() }}
          onMoreClick={handleMoreClick}
          onRename={() => setIsEditing(true)}
          onCommit={handleCommit}
          onCancel={() => setIsEditing(false)}
        />
        {/* Zero-size Radix trigger anchored to the right edge — same pattern as ChatHistoryItem */}
        <DropdownMenu.Trigger
          ref={triggerRef}
          style={{
            position:      'absolute',
            right:         '8px',
            top:           '50%',
            width:         1,
            height:        1,
            opacity:       0,
            pointerEvents: 'none',
            border:        'none',
            background:    'none',
            padding:       0,
          }}
        />
      </div>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="bottom"
          align="end"
          sideOffset={4}
          onCloseAutoFocus={(e) => {
            if (pendingRenameRef.current) {
              e.preventDefault()
              pendingRenameRef.current = false
            }
          }}
          style={{
            backgroundColor: 'var(--neutral-white)',
            borderRadius:    '12px',
            padding:         '4px',
            boxShadow:       '0 4px 16px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
            zIndex:          5,
            minWidth:        '168px',
            outline:         'none',
          }}
        >
          <DropdownMenu.Item
            style={menuItemStyle}
            onSelect={() => { pendingRenameRef.current = true; setIsEditing(true) }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--neutral-50)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
          >
            Rename
          </DropdownMenu.Item>

          <DropdownMenu.Item
            style={menuItemStyle}
            onSelect={() => void onStar(thread.id)}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--neutral-50)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
          >
            {thread.starred ? 'Unstar' : 'Star'}
          </DropdownMenu.Item>

          <DropdownMenu.Separator style={{ height: '1px', backgroundColor: 'var(--neutral-100)', margin: '4px 0' }} />

          <DropdownMenu.Item
            style={menuItemDestructiveStyle}
            onSelect={() => onDelete(thread.id, stripDocumentBlocks(thread.chat_title) || thread.chat_title)}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--red-50, #fff5f5)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
          >
            Delete
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

// ── Threads — starred + all, with optimistic mutations ────────────────────────

interface BrainThreadsSectionProps {
  activeChatId:  string | null
  onThreadClick: (id: string) => void
}

function BrainThreadsSection({ activeChatId, onThreadClick }: BrainThreadsSectionProps) {
  const { push } = useRouter()

  const [threads,        setThreads]        = useState<BrainChatListItem[]>([])
  const [isLoading,      setIsLoading]      = useState(true)
  const [shownStarred,   setShownStarred]   = useState(true)
  const [overflowStar,   setOverflowStar]   = useState<'visible' | 'hidden'>('visible')
  const [shownAll,       setShownAll]       = useState(true)
  const [overflowAll,    setOverflowAll]    = useState<'visible' | 'hidden'>('visible')

  useEffect(() => {
    setIsLoading(true)
    listBrainChats()
      .then(setThreads)
      .catch(() => setThreads([]))
      .finally(() => setIsLoading(false))
  }, [])

  // Keep the list in sync when a thread is created / titled elsewhere on the
  // page, so a new brain thread appears without a manual refresh — mirrors the
  // persona-chat event flow.
  useEffect(() => {
    const handleCreated = (e: Event) => {
      const { chatId, title } = (e as CustomEvent<BrainThreadEventDetail>).detail
      setThreads(prev =>
        prev.some(t => t.id === chatId)
          ? prev
          : [{ id: chatId, chat_title: title || 'New thread', starred: false }, ...prev],
      )
    }
    const handleTitleUpdated = (e: Event) => {
      const { chatId, title } = (e as CustomEvent<BrainThreadEventDetail>).detail
      if (!title) return
      setThreads(prev =>
        prev.some(t => t.id === chatId)
          ? prev.map(t => (t.id === chatId ? { ...t, chat_title: title } : t))
          : [{ id: chatId, chat_title: title, starred: false }, ...prev],
      )
    }
    const handleDeleted = (e: Event) => {
      const { chatId } = (e as CustomEvent<BrainThreadDeletedEventDetail>).detail
      setThreads(prev => prev.filter(t => t.id !== chatId))
    }
    window.addEventListener(BRAIN_THREAD_CREATED_EVENT, handleCreated)
    window.addEventListener(BRAIN_THREAD_TITLE_UPDATED_EVENT, handleTitleUpdated)
    window.addEventListener(BRAIN_THREAD_DELETED_EVENT, handleDeleted)
    return () => {
      window.removeEventListener(BRAIN_THREAD_CREATED_EVENT, handleCreated)
      window.removeEventListener(BRAIN_THREAD_TITLE_UPDATED_EVENT, handleTitleUpdated)
      window.removeEventListener(BRAIN_THREAD_DELETED_EVENT, handleDeleted)
    }
  }, [])

  const handleRename = async (id: string, title: string) => {
    // Optimistic update
    setThreads(prev => prev.map(t => t.id === id ? { ...t, chat_title: title } : t))
    try {
      await renameBrainChat(id, title)
    } catch {
      // Revert isn't critical — next fetch will correct it
    }
  }

  const handleStar = async (id: string) => {
    // Optimistic toggle
    setThreads(prev => prev.map(t => t.id === id ? { ...t, starred: !t.starred } : t))
    try {
      await starBrainChat(id)
    } catch {
      // Revert on failure
      setThreads(prev => prev.map(t => t.id === id ? { ...t, starred: !t.starred } : t))
    }
  }

  const handleDelete = (id: string, title: string) => {
    openDeleteChatDialog({
      chatId:    id,
      chatTitle: stripDocumentBlocks(title) || title,
      onConfirm: async () => {
        await deleteBrainChat(id)
        setThreads(prev => prev.filter(t => t.id !== id))
        emitBrainThreadDeleted({ chatId: id })
        toast.success('Brain chat deleted')
        if (id === activeChatId) push('/brain')
      },
    })
  }

  const starredThreads = threads.filter(t => t.starred)

  const emptyRow = (
    <div style={{
      padding:    '8px 6px',
      fontFamily: 'var(--font-body)',
      fontSize:   'var(--font-size-caption)',
      color:      'var(--neutral-400)',
    }}>
      No threads yet
    </div>
  )

  return (
    <>
      {/* ── Starred Threads — self-hides when empty ── */}
      {starredThreads.length > 0 && (
        <>
          <SidebarMenuItem
            fluid
            variant="header"
            label="Starred Threads"
            shown={shownStarred}
            onShowClick={() => setShownStarred(s => !s)}
          />
          <m.div
            animate={shownStarred ? 'open' : 'closed'}
            initial={false}
            variants={sectionHeightVariants}
            style={{ overflow: overflowStar }}
            onAnimationStart={(def) => { if (def === 'closed') setOverflowStar('hidden') }}
            onAnimationComplete={(def) => { if (def === 'open') setOverflowStar('visible') }}
          >
            <div style={{ paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {starredThreads.map(thread => (
                <BrainThreadItem
                  key={thread.id}
                  thread={thread}
                  isActive={thread.id === activeChatId}
                  onSelect={() => onThreadClick(thread.id)}
                  onRename={handleRename}
                  onStar={handleStar}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </m.div>
        </>
      )}

      {/* ── All Threads ── */}
      <SidebarMenuItem
        fluid
        variant="header"
        label="Threads"
        shown={shownAll}
        onShowClick={() => setShownAll(s => !s)}
      />
      <m.div
        animate={shownAll ? 'open' : 'closed'}
        initial={false}
        variants={sectionHeightVariants}
        style={{ overflow: overflowAll }}
        onAnimationStart={(def) => { if (def === 'closed') setOverflowAll('hidden') }}
        onAnimationComplete={(def) => { if (def === 'open') setOverflowAll('visible') }}
      >
        <div style={{ paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {isLoading && Array.from({ length: 3 }).map((_, i) => (
            <SidebarMenuSkeleton key={i} index={i} fluid />
          ))}

          {!isLoading && threads.length === 0 && emptyRow}

          {!isLoading && threads.map(thread => (
            <BrainThreadItem
              key={thread.id}
              thread={thread}
              isActive={thread.id === activeChatId}
              onSelect={() => onThreadClick(thread.id)}
              onRename={handleRename}
              onStar={handleStar}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </m.div>
    </>
  )
}

// ── Combined export ───────────────────────────────────────────────────────────

export interface BrainSidebarSectionsProps {
  activeChatId:  string | null
  onThreadClick: (id: string) => void
}

export function BrainSidebarSections({
  activeChatId,
  onThreadClick,
}: BrainSidebarSectionsProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <BrainThreadsSection activeChatId={activeChatId} onThreadClick={onThreadClick} />
    </div>
  )
}
