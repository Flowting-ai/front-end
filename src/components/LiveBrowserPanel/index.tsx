'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AiWebBrowsingIcon,
  ArrowUpRightOneIcon,
  RedoIcon,
} from '@strange-huge/icons'
import { IconButton } from '@/components/IconButton'
import { Tooltip } from '@/components/Tooltip'
import { ApiError } from '@/lib/api/client'
import {
  getChatBrowserLiveView,
  type BrowserLiveView,
} from '@/lib/api/browser'

interface LiveBrowserPanelProps {
  chatId: string
}

type ViewState =
  | { status: 'loading' }
  | { status: 'ready'; view: BrowserLiveView }
  | { status: 'error'; message: string }

function browserErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 404) {
    return "The live browser hasn't started for this chat yet."
  }
  if (error instanceof Error && error.message) return error.message
  return 'The live browser is unavailable right now.'
}

export function LiveBrowserPanel({ chatId }: LiveBrowserPanelProps) {
  const [state, setState] = useState<ViewState>({ status: 'loading' })
  const requestIdRef = useRef(0)

  const resolveView = useCallback(async (requestId: number) => {
    try {
      const view = await getChatBrowserLiveView(chatId)
      if (requestId !== requestIdRef.current) return
      setState({ status: 'ready', view })
    } catch (error) {
      if (requestId !== requestIdRef.current) return
      setState({ status: 'error', message: browserErrorMessage(error) })
    }
  }, [chatId])

  useEffect(() => {
    const requestId = ++requestIdRef.current
    void resolveView(requestId)
    return () => { requestIdRef.current += 1 }
  }, [resolveView])

  const reload = useCallback(() => {
    const requestId = ++requestIdRef.current
    setState({ status: 'loading' })
    void resolveView(requestId)
  }, [resolveView])

  const liveUrl = state.status === 'ready' ? state.view.url : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%', minHeight: 0 }}>
      {/* Browser chrome — status, current stream host, refresh, and pop-out. */}
      <div
        style={{
          display:         'flex',
          alignItems:      'center',
          gap:             8,
          minHeight:       38,
          padding:         '4px 6px 4px 10px',
          borderRadius:    10,
          border:          '1px solid var(--neutral-200)',
          backgroundColor: 'var(--neutral-white)',
          flexShrink:      0,
        }}
      >
        <span
          aria-hidden
          style={{
            width:           7,
            height:          7,
            borderRadius:    '50%',
            backgroundColor: liveUrl
              ? 'var(--color-tag-Green-text, #1e8a3c)'
              : state.status === 'error'
                ? 'var(--color-tag-Red-text, #c0392b)'
                : 'var(--neutral-300)',
            flexShrink: 0,
          }}
        />
        <span
          title={liveUrl ?? undefined}
          style={{
            flex:         '1 1 0',
            minWidth:     0,
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
            fontFamily:   'var(--font-body)',
            fontSize:     'var(--font-size-caption)',
            lineHeight:   'var(--line-height-caption)',
            color:        liveUrl ? 'var(--neutral-600)' : 'var(--neutral-400)',
          }}
        >
          {liveUrl ? new URL(liveUrl).host : state.status === 'loading' ? 'Connecting…' : 'Browser offline'}
        </span>
        <Tooltip content="Reconnect live browser">
          <IconButton
            variant="ghost"
            size="sm"
            icon={<RedoIcon size={18} />}
            aria-label="Reconnect live browser"
            onClick={reload}
            disabled={state.status === 'loading'}
          />
        </Tooltip>
        <Tooltip content="Open live browser in a new tab">
          <IconButton
            variant="ghost"
            size="sm"
            icon={<ArrowUpRightOneIcon size={18} />}
            aria-label="Open live browser in a new tab"
            disabled={!liveUrl}
            onClick={() => {
              if (liveUrl) window.open(liveUrl, '_blank', 'noopener,noreferrer')
            }}
          />
        </Tooltip>
      </div>

      <div
        style={{
          position:        'relative',
          flex:            '1 1 0',
          minHeight:       0,
          overflow:        'hidden',
          borderRadius:    12,
          border:          '1px solid var(--neutral-200)',
          backgroundColor: 'var(--neutral-white)',
        }}
      >
        {state.status === 'ready' ? (
          <iframe
            key={state.view.url}
            src={state.view.url}
            title="Live browser"
            sandbox="allow-forms allow-pointer-lock allow-same-origin allow-scripts"
            allow="clipboard-read; clipboard-write; fullscreen"
            referrerPolicy="no-referrer"
            style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
          />
        ) : (
          <div
            role={state.status === 'error' ? 'alert' : 'status'}
            style={{
              position:       'absolute',
              inset:          0,
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            10,
              padding:        28,
              textAlign:      'center',
            }}
          >
            <span style={{ color: 'var(--neutral-300)', lineHeight: 0 }}>
              <AiWebBrowsingIcon size={28} />
            </span>
            <p style={{
              margin:     0,
              maxWidth:  300,
              fontFamily: 'var(--font-body)',
              fontSize:   'var(--font-size-body)',
              lineHeight: 'var(--line-height-body)',
              color:      'var(--neutral-500)',
            }}>
              {state.status === 'loading'
                ? 'Connecting to the browser attached to this chat…'
                : state.message}
            </p>
            {state.status === 'error' && (
              <button
                type="button"
                onClick={reload}
                style={{
                  border:          '1px solid var(--neutral-200)',
                  borderRadius:    8,
                  backgroundColor: 'var(--neutral-white)',
                  color:           'var(--neutral-700)',
                  padding:         '7px 10px',
                  fontFamily:      'var(--font-body)',
                  fontSize:        'var(--font-size-caption)',
                  cursor:          'pointer',
                }}
              >
                Try again
              </button>
            )}
          </div>
        )}
      </div>

      <p style={{
        margin:     0,
        fontFamily: 'var(--font-body)',
        fontSize:   'var(--font-size-caption)',
        lineHeight: 'var(--line-height-caption)',
        color:      'var(--neutral-400)',
        flexShrink: 0,
      }}>
        {state.status === 'ready' && !state.view.viewOnly
          ? 'You can control this browser. Agent actions may move the page.'
          : 'Live view is read-only while the agent controls the browser.'}
      </p>
    </div>
  )
}
