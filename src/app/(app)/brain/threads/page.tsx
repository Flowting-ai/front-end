'use client'

import { Suspense, useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { LeftSidebar } from '@/components/layout/LeftSidebar'
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

  useEffect(() => {
    setIsLoading(true)
    listBrainChats()
      .then(setThreads)
      .catch(() => toast.error('Failed to load brain threads'))
      .finally(() => setIsLoading(false))
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
        toast.success('Thread deleted')
      },
    })
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{
      display:         'flex',
      alignItems:      'stretch',
      width:           '100%',
      height:          '100svh',
      backgroundColor: 'var(--neutral-white)',
    }}>

      {/* ── Left sidebar ── */}
      <LeftSidebar />

      {/* ── Main content ── */}
      <div
        className="kaya-scrollbar"
        style={{
          flex:            '1 0 0',
          minWidth:        0,
          height:          '100%',
          overflowY:       'auto',
          overflowX:       'hidden',
          display:         'flex',
          flexDirection:   'column',
          alignItems:      'center',
          padding:         '0 24px 40px',
          boxSizing:       'border-box',
          backgroundColor: 'var(--neutral-50)',
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
              onClick={() => push('/brain')}
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
                    onClick={() => push(`/brain?id=${thread.id}`)}
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
  )
}
