'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/Button'
import { disconnectSlackIdentity } from '@/lib/api/slack'
import { ROOT_ROUTE } from '@/lib/routes'

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
  const { push }                    = useRouter()
  const [disconnected, setDisconnected] = useState(false)
  const [busy,         setBusy]         = useState(false)

  async function handleDisconnect() {
    if (busy) return
    setBusy(true)
    try {
      await disconnectSlackIdentity()
      setDisconnected(true)
      toast.success('Slack disconnected')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not disconnect')
    } finally {
      setBusy(false)
    }
  }

  if (disconnected) {
    return (
      <div style={cardStyle}>
        <h1 style={titleStyle}>Slack disconnected</h1>
        <p style={bodyStyle}>
          Your Slack identity is no longer linked. Message Souvenir in Slack to connect again.
        </p>
        <Button variant="default" size="sm" onClick={() => push(ROOT_ROUTE)}>
          Go to Souvenir
        </Button>
      </div>
    )
  }

  return (
    <div style={cardStyle}>
      <h1 style={titleStyle}>Your Slack</h1>
      <p style={bodyStyle}>
        Connecting happens from Slack: message Souvenir there and use the Connect button.
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        <Button variant="outline" size="sm" loading={busy} onClick={handleDisconnect}>
          Disconnect
        </Button>
        <Button variant="default" size="sm" onClick={() => push(ROOT_ROUTE)}>
          Go to Souvenir
        </Button>
      </div>
    </div>
  )
}

export default function SlackLinkPage() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', minHeight: '100dvh', padding: 24 }}>
      <SlackLinkContent />
    </div>
  )
}
