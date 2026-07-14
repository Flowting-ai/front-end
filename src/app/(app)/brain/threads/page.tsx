'use client'

import { Suspense, useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ChatRow } from '@/components/ChatRow'
import { Button } from '@/components/Button'
import { InputField } from '@/components/InputField'
import { SearchOneIcon, PlusSignIcon } from '@strange-huge/icons'
import { toast } from 'sonner'
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
import { BRAIN_ROUTE } from '@/lib/routes'
import { listTasks } from '@/lib/api/tasks'
import { getAllScheduleLinks } from '@/lib/scheduleLinks'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string | undefined | null): string {
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

// ── Page wrapper ──────────────────────────────────────────────────────────────

export default function BrainThreadsPage() {
  return (
    <Suspense fallback={null}>
      <BrainThreadsPageInner />
    </Suspense>
  )
}

// ── Inner page ────────────────────────────────────────────────────────────────

function BrainThreadsPageInner() {
  const { push } = useRouter()

  // ── Thread list state ─────────────────────────────────────────────────────

  const [threads,     setThreads]     = useState<BrainChatListItem[]>([])
  const [isLoading,   setIsLoading]   = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  // Chat ids that are linked to a still-existing schedule — drives the
  // "Scheduled" tag on each thread row. Cross-referenced against the live
  // task list since scheduleLinks is a local-only map that isn't cleaned up
  // when a schedule is deleted.
  const [scheduledChatIds, setScheduledChatIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    setIsLoading(true)
    listBrainChats()
      .then(setThreads)
      .catch(() => toast.error('Failed to load brain threads'))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    listTasks()
      .then(tasks => {
        const links = getAllScheduleLinks()
        const chatIds = tasks.map(t => links[t.id]).filter((id): id is string => !!id)
        setScheduledChatIds(new Set(chatIds))
      })
      .catch(() => {})
  }, [])

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
    if (!searchQuery.trim()) return threads
    const q = searchQuery.toLowerCase()
    return threads.filter(t => (t.chat_title || '').toLowerCase().includes(q))
  }, [threads, searchQuery])

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleRename = useCallback((id: string, title: string) => {
    setThreads(prev => prev.map(t => t.id === id ? { ...t, chat_title: title } : t))
    void renameBrainChat(id, title).catch(() => toast.error('Failed to rename thread'))
  }, [])

  const handleStar = useCallback((id: string) => {
    setThreads(prev => prev.map(t => t.id === id ? { ...t, starred: !t.starred } : t))
    void starBrainChat(id).catch(() => {
      setThreads(prev => prev.map(t => t.id === id ? { ...t, starred: !t.starred } : t))
    })
  }, [])

  const handleDelete = useCallback((id: string, title: string) => {
    openDeleteChatDialog({
      chatId:    id,
      chatTitle: title,
      onConfirm: async () => {
        await deleteBrainChat(id)
        setThreads(prev => prev.filter(t => t.id !== id))
        emitBrainThreadDeleted({ chatId: id })
        toast.success('Brain chat deleted')
      },
    })
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{
      position:        'relative',
      flex:            '1 0 0',
      minWidth:        0,
      display:         'flex',
      flexDirection:   'column',
      backgroundColor: 'var(--neutral-50)',
      padding:         '10px 0',
    }}>
      <div style={{
        position:        'relative',
        flex:            '1 0 0',
        minHeight:       0,
        display:         'flex',
        flexDirection:   'column',
        borderRadius:    '22px',
        border:          '1px solid var(--neutral-200)',
        backgroundColor: 'var(--color-surface-glass)',
        overflow:        'hidden',
      }}>
      <div
        className="kaya-scrollbar"
        style={{
          flex:            '1 0 0',
          minWidth:        0,
          minHeight:       0,
          overflowY:       'auto',
          overflowX:       'hidden',
          display:         'flex',
          flexDirection:   'column',
          alignItems:      'center',
          padding:         '0 24px 40px',
          boxSizing:       'border-box',
        }}
      >
        <div style={{ width: '100%', maxWidth: 836, display: 'flex', flexDirection: 'column' }}>

          {/* ── Header ── */}
          <div style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            padding:        '20px 0 14px',
            minHeight:      60,
          }}>
            <h1 style={{
              margin:     0,
              fontFamily: 'var(--font-title)',
              fontSize:   24,
              fontWeight: 400,
              lineHeight: '32px',
              color:      'var(--neutral-900)',
              flexShrink: 0,
            }}>
              Brain Threads
            </h1>
            <Button
              variant="default"
              leftIcon={<PlusSignIcon animated />}
              onClick={() => push(BRAIN_ROUTE)}
            >
              New brain thread
            </Button>
          </div>

          {/* ── Search ── */}
          <div style={{ marginBottom: 16, marginTop: 4, padding: '4px' }}>
            <InputField
              fluid
              placeholder="Search brain threads…"
              leftIcon={<SearchOneIcon size={16} color="var(--neutral-400)" />}
              value={searchQuery}
              onChange={setSearchQuery}
            />
          </div>

          {/* ── Loading skeleton ── */}
          {isLoading && threads.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  style={{
                    height:          62,
                    borderRadius:    12,
                    backgroundColor: 'var(--neutral-100)',
                    opacity:         1 - i * 0.15,
                    animation:       'pulse 0.9s ease-in-out infinite',
                  }}
                />
              ))}
            </div>
          )}

          {/* ── Thread list ── */}
          {(!isLoading || threads.length > 0) && (
            <div role="list" aria-label="Brain threads">

              {filteredThreads.length === 0 && searchQuery && (
                <p style={{
                  margin:     '32px 0',
                  textAlign:  'center',
                  fontFamily: 'var(--font-body)',
                  fontSize:   'var(--font-size-body)',
                  color:      'var(--neutral-400)',
                }}>
                  No brain threads match &ldquo;{searchQuery}&rdquo;
                </p>
              )}

              {!searchQuery && threads.length === 0 && !isLoading && (
                <div role="listitem" style={{ padding: '1px 0' }}>
                  <ChatRow isEmpty />
                </div>
              )}

              {filteredThreads.map(thread => (
                <div key={thread.id} role="listitem" style={{ padding: '1px 0 6px' }}>
                  <ChatRow
                    title={thread.chat_title || 'Untitled'}
                    timestamp={formatTimestamp(thread.updated_at ?? thread.created_at)}
                    starred={thread.starred}
                    scheduled={scheduledChatIds.has(thread.id)}
                    onClick={() => push(`${BRAIN_ROUTE}?id=${thread.id}`)}
                    onRename={(title) => handleRename(thread.id, title)}
                    onStar={() => handleStar(thread.id)}
                    onDelete={() => handleDelete(thread.id, thread.chat_title)}
                  />
                </div>
              ))}

            </div>
          )}

        </div>
      </div>
      </div>
    </div>
  )
}
