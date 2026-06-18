'use client'

import React, { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/Button'
import { ApiError } from '@/lib/api/client'
import { linkSlackIdentity, disconnectSlackIdentity } from '@/lib/api/slack'

type PageState = 'linking' | 'linked' | 'missing' | 'error' | 'disconnected'

const cardStyle: React.CSSProperties = {
  display:         'flex',
  flexDirection:   'column',
  alignItems:      'center',
  gap:             20,
  width:           480,
  maxWidth:        'calc(100vw - 48px)',
  margin:          '0 auto',
  padding:         '40px 44px',
  borderRadius:    24,
  boxSizing:       'border-box',
  backgroundColor: 'var(--neutral-white)',
  boxShadow:       '0px 12px 16px -4px rgba(130,122,116,0.12), 0px 0px 0px 1px var(--neutral-100)',
  textAlign:       'center',
}

const titleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-title)',
  fontWeight: 400,
  fontSize:   26,
  lineHeight: '32px',
  color:      'var(--neutral-900)',
  margin:     0,
}

const bodyStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontWeight: 400,
  fontSize:   16,
  lineHeight: '24px',
  color:      'var(--neutral-500)',
  margin:     0,
  maxWidth:   360,
}

function SlackLinkContent() {
  const search        = useSearchParams()
  const { push }      = useRouter()
  const state         = search.get('state')

  // 'missing' is decided at first render (no state param) so the effect never
  // has to setState synchronously.
  const [pageState,  setPageState]  = useState<PageState>(() => (state ? 'linking' : 'missing'))
  const [errorMsg,   setErrorMsg]   = useState('')
  const [busy,       setBusy]       = useState(false)
  // The link POST runs once; React 18 StrictMode double-invokes effects in dev.
  const linkedOnce    = useRef(false)

  useEffect(() => {
    if (linkedOnce.current || !state) return
    linkedOnce.current = true

    linkSlackIdentity(state)
      .then(() => setPageState('linked'))
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 400) {
          setErrorMsg('This link is invalid or has expired. Run `/connect` in Slack to get a fresh one.')
        } else {
          setErrorMsg(err instanceof Error ? err.message : 'Something went wrong linking your account.')
        }
        setPageState('error')
      })
  }, [state])

  async function handleDisconnect() {
    if (busy) return
    setBusy(true)
    try {
      await disconnectSlackIdentity()
      setPageState('disconnected')
      toast.success('Slack disconnected')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not disconnect')
    } finally {
      setBusy(false)
    }
  }

  if (pageState === 'linking') {
    return (
      <div style={cardStyle}>
        <h1 style={titleStyle}>Linking your Slack…</h1>
        <p style={bodyStyle}>One moment while we connect this Slack identity to your account.</p>
      </div>
    )
  }

  if (pageState === 'linked') {
    return (
      <div style={cardStyle}>
        <h1 style={titleStyle}>Slack connected 🎉</h1>
        <p style={bodyStyle}>
          You&apos;re all set. Head back to Slack — mentions, threads and slash commands
          now run as you.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button variant="outline" size="sm" loading={busy} onClick={handleDisconnect}>
            Disconnect
          </Button>
          <Button variant="default" size="sm" onClick={() => push('/')}>
            Go to Souvenir
          </Button>
        </div>
      </div>
    )
  }

  if (pageState === 'disconnected') {
    return (
      <div style={cardStyle}>
        <h1 style={titleStyle}>Slack disconnected</h1>
        <p style={bodyStyle}>Your Slack identity is no longer linked. Run `/connect` in Slack to relink anytime.</p>
        <Button variant="default" size="sm" onClick={() => push('/')}>
          Go to Souvenir
        </Button>
      </div>
    )
  }

  // missing / error
  return (
    <div style={cardStyle}>
      <h1 style={titleStyle}>Couldn&apos;t link Slack</h1>
      <p style={bodyStyle}>
        {pageState === 'missing'
          ? 'This page expects a connect link from Slack. Run `/connect` in Slack to get one.'
          : errorMsg}
      </p>
      <Button variant="default" size="sm" onClick={() => push('/')}>
        Go to Souvenir
      </Button>
    </div>
  )
}

export default function SlackLinkPage() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', minHeight: '100dvh', padding: 24 }}>
      <Suspense fallback={null}>
        <SlackLinkContent />
      </Suspense>
    </div>
  )
}
