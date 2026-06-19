'use client'

import React, { Suspense, useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  getSharedChatView,
  forkChatShare,
  type SharedChatView,
} from '@/lib/api/chat-shares'
import { Button } from '@/components/Button'
import { ArrowLeftOneIcon } from '@strange-huge/icons'

function SharedChatContent() {
  const params   = useParams()
  const shareId  = typeof params.shareId === 'string' ? params.shareId : ''
  const router   = useRouter()

  const [view,    setView]    = useState<SharedChatView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [forking, setForking] = useState(false)

  useEffect(() => {
    if (!shareId) return
    setLoading(true)
    getSharedChatView(shareId)
      .then(setView)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load shared chat'))
      .finally(() => setLoading(false))
  }, [shareId])

  async function handleFork() {
    if (!shareId) return
    setForking(true)
    try {
      const { chatId } = await forkChatShare(shareId)
      router.push(`/chat?id=${chatId}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to copy chat')
    } finally {
      setForking(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 48, fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)' }}>
        Loading…
      </div>
    )
  }

  if (error || !view) {
    return (
      <div style={{ padding: 48, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start' }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-700)', margin: 0 }}>
          {error ?? 'This shared chat could not be found.'}
        </p>
        <Button variant="outline" size="sm" onClick={() => router.back()}>Go back</Button>
      </div>
    )
  }

  return (
    <div
      style={{
        display:       'flex',
        flexDirection: 'column',
        height:        '100%',
        overflowY:     'auto',
      }}
      className="kaya-scrollbar"
    >
      <div
        style={{
          maxWidth:    760,
          margin:      '0 auto',
          width:       '100%',
          padding:     '24px 24px 64px',
          display:     'flex',
          flexDirection: 'column',
          gap:         24,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<ArrowLeftOneIcon size={16} animated />}
            onClick={() => router.back()}
            style={{ flexShrink: 0 }}
          >
            Back
          </Button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1
              style={{
                fontFamily:     'var(--font-title)',
                fontWeight:     400,
                fontSize:       22,
                lineHeight:     '30px',
                color:          'var(--neutral-900)',
                margin:         0,
                overflow:       'hidden',
                textOverflow:   'ellipsis',
                whiteSpace:     'nowrap',
              }}
            >
              {view.chatTitle}
            </h1>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-500)', margin: '2px 0 0' }}>
              Shared chat · {view.mode === 'editable' ? 'You can make a copy' : 'Read only'}
            </p>
          </div>
          {view.mode === 'editable' && (
            <Button
              variant="default"
              size="sm"
              onClick={() => void handleFork()}
              loading={forking}
              disabled={forking}
              style={{ flexShrink: 0 }}
            >
              {forking ? 'Copying…' : 'Make a copy'}
            </Button>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, backgroundColor: 'var(--neutral-100)' }} />

        {/* Messages */}
        {view.messages.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', textAlign: 'center', paddingTop: 48, margin: 0 }}>
            No messages in this chat.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {view.messages.map(msg => (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {msg.input && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div
                      style={{
                        maxWidth:        '78%',
                        backgroundColor: 'var(--neutral-100)',
                        borderRadius:    '16px 16px 4px 16px',
                        padding:         '10px 14px',
                      }}
                    >
                      <p
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize:   14,
                          lineHeight: '22px',
                          color:      'var(--neutral-800)',
                          margin:     0,
                          whiteSpace: 'pre-wrap',
                          wordBreak:  'break-word',
                        }}
                      >
                        {msg.input}
                      </p>
                    </div>
                  </div>
                )}
                {msg.output && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingRight: '10%' }}>
                    <p
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize:   14,
                        lineHeight: '22px',
                        color:      'var(--neutral-800)',
                        margin:     0,
                        whiteSpace: 'pre-wrap',
                        wordBreak:  'break-word',
                      }}
                    >
                      {msg.output}
                    </p>
                    {msg.modelName && (
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--neutral-400)' }}>
                        {msg.modelName}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function SharedChatPage() {
  return (
    <Suspense>
      <SharedChatContent />
    </Suspense>
  )
}
