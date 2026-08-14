'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as VisuallyHidden from '@radix-ui/react-visually-hidden'
import { toast } from 'sonner'
import { ArrowDownOneIcon, LinkSixIcon, MessagePreviewOneIcon, UserIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { getOrgSlackStatus, getSlackInstallUrl, getSlackStatus } from '@/lib/api/slack'

// ── Shadows ───────────────────────────────────────────────────────────────────
const SHADOW_MODAL = '0px 12px 16px -4px rgba(130,122,116,0.12), 0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)'
const SHADOW_CARD_BORDER = '0px 1px 1.5px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-200)'

// Poll the Slack status after the install tab opens, until the bot reports
// installed or we give up. 3s cadence keeps it responsive without hammering.
const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS   = 3 * 60 * 1000

// ── Permission rows (Figma 136:53621 "Permissions Section") ──────────────────

interface Permission {
  icon: React.ReactNode
  text: string
}

const PERMISSIONS: Permission[] = [
  {
    icon: <LinkSixIcon size={20} color="var(--neutral-700)" />,
    text: 'Establish a connection between your Souvenir workspace and Slack.',
  },
  {
    icon: <MessagePreviewOneIcon size={20} color="var(--neutral-700)" />,
    text: 'Send scheduled summaries, notifications, and AI-generated content to channels.',
  },
  {
    icon: <UserIcon size={20} color="var(--neutral-700)" />,
    text: 'Read channel names and members for message routing and @mentions.',
  },
]

function SectionDivider() {
  return <div style={{ width: '100%', height: 1, backgroundColor: 'var(--neutral-100)', flexShrink: 0 }} />
}

// ── "#" ↔ link ↔ "S" logo bridge ──────────────────────────────────────────────

function LogoBridge() {
  const tileStyle: React.CSSProperties = {
    width: 48,
    height: 48,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ ...tileStyle, backgroundColor: 'var(--neutral-white)', boxShadow: SHADOW_CARD_BORDER }}>
        <span style={{ fontFamily: 'var(--font-title)', fontWeight: 600, fontSize: 22, lineHeight: '28px', color: '#570B7A' }}>#</span>
      </div>
      <LinkSixIcon size={20} color="var(--neutral-500)" />
      <div style={{ ...tileStyle, backgroundColor: 'var(--neutral-800)' }}>
        <span style={{ fontFamily: 'var(--font-title)', fontWeight: 600, fontSize: 22, lineHeight: '28px', color: 'var(--neutral-white)' }}>S</span>
      </div>
    </div>
  )
}

// ── Card ───────────────────────────────────────────────────────────────────────

interface SlackConnectModalProps {
  isOpen:       boolean
  onClose:      () => void
  orgId?:       string | null
  /** Fired once the bot reports installed (status poll succeeds). */
  onConnected?: () => void
}

export function SlackConnectModal({ isOpen, onClose, orgId, onConnected }: SlackConnectModalProps) {
  const [connecting, setConnecting] = useState(false)
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stopPolling = () => {
    if (pollRef.current)    { clearInterval(pollRef.current); pollRef.current = null }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
  }

  // Stop polling whenever the modal closes or the component unmounts.
  useEffect(() => {
    if (isOpen) return stopPolling
    stopPolling()
    const reset = window.setTimeout(() => setConnecting(false), 0)
    return () => {
      window.clearTimeout(reset)
      stopPolling()
    }
  }, [isOpen])

  const handleConnect = async () => {
    if (connecting) return
    setConnecting(true)
    try {
      const url = await getSlackInstallUrl()
      // Open Slack's install flow in a new tab so the app (and this poll) stay alive.
      window.open(url, '_blank', 'noopener,noreferrer')
      toast.info('Continue in the new tab to authorize Slack…')

      stopPolling()
      pollRef.current = setInterval(async () => {
        try {
          const status = orgId ? await getOrgSlackStatus(orgId) : await getSlackStatus()
          if (status.connected) {
            stopPolling()
            setConnecting(false)
            toast.success('Slack connected')
            onConnected?.()
            onClose()
          }
        } catch { /* transient — keep polling */ }
      }, POLL_INTERVAL_MS)

      timeoutRef.current = setTimeout(() => {
        stopPolling()
        setConnecting(false)
        toast.info('Still waiting on Slack. Finish authorizing, then try again.')
      }, POLL_TIMEOUT_MS)
    } catch (err) {
      setConnecting(false)
      toast.error(err instanceof Error ? err.message : 'Could not start Slack install')
    }
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={open => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(18,12,8,0.52)', zIndex: 1100 }}
        />
        <Dialog.Content
          aria-label="Connect Souvenir to Slack"
          style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1101, outline: 'none' }}
        >
          <VisuallyHidden.Root asChild>
            <Dialog.Title>Connect Souvenir to Slack</Dialog.Title>
          </VisuallyHidden.Root>

          <div
            style={{
              display:         'flex',
              flexDirection:   'column',
              width:           520,
              maxWidth:        'calc(100vw - 48px)',
              maxHeight:       'calc(100vh - 48px)',
              overflowY:       'auto',
              borderRadius:    18,
              boxSizing:       'border-box',
              backgroundColor: 'var(--neutral-white)',
              boxShadow:       SHADOW_MODAL,
            }}
          >
            {/* ── Header — title + "#" / link / "S" logo bridge ── */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '28px 28px 24px' }}>
              <h2 style={{
                fontFamily: 'var(--font-title)',
                fontWeight: 600,
                fontSize:   18,
                lineHeight: '24px',
                color:      'var(--neutral-800)',
                margin:     0,
                textAlign:  'center',
              }}>
                Connect Souvenir to Slack
              </h2>
              <LogoBridge />
            </div>

            <SectionDivider />

            {/* ── Workspace — the workspace you connect is chosen inside Slack's own
                authorization screen, so there's nothing to pick here yet; this just
                previews where it'll show up once `getOrgSlackStatus`/`getSlackStatus`
                reports it back. ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '24px 28px' }}>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize:   13,
                lineHeight: '18px',
                color:      'var(--neutral-600)',
                margin:     0,
              }}>
                Select a Slack workspace
              </p>
              <div style={{
                display:         'flex',
                alignItems:      'center',
                gap:             12,
                padding:         '13px 14px',
                borderRadius:    12,
                backgroundColor: 'var(--neutral-white)',
                boxShadow:       SHADOW_CARD_BORDER,
              }}>
                <span aria-hidden style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: 'var(--neutral-200)', flexShrink: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: '1 0 0' }}>
                  <p style={{
                    fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14, lineHeight: '20px',
                    color: 'var(--neutral-800)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    Chosen in Slack
                  </p>
                  <p style={{
                    fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px',
                    color: 'var(--neutral-500)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    You'll pick the workspace on Slack's authorization screen
                  </p>
                </div>
                <span aria-hidden style={{ display: 'inline-flex', flexShrink: 0, color: 'var(--neutral-700)' }}>
                  <ArrowDownOneIcon size={16} />
                </span>
              </div>
            </div>

            <SectionDivider />

            {/* ── Permissions ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '24px 28px 20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 20, borderRadius: 14, backgroundColor: 'var(--neutral-50)' }}>
                <p style={{
                  fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, lineHeight: '18px',
                  color: 'var(--neutral-700)', margin: 0,
                }}>
                  Souvenir will be able to:
                </p>
                {PERMISSIONS.map(p => (
                  <div key={p.text} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <span aria-hidden style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, flexShrink: 0 }}>
                      {p.icon}
                    </span>
                    <p style={{
                      fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 13, lineHeight: '18px',
                      color: 'var(--neutral-700)', margin: 0,
                    }}>
                      {p.text}
                    </p>
                  </div>
                ))}
              </div>
              <p style={{
                fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px',
                color: 'var(--neutral-500)', margin: 0,
              }}>
                Slack will share your name, email, and workspace ID with Souvenir. By connecting, you agree to Souvenir's privacy policy and terms of service.
              </p>
            </div>

            <SectionDivider />

            {/* ── Footer ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '16px 28px' }}>
              <Button variant="ghost" size="sm" onClick={onClose} disabled={connecting}>
                Cancel
              </Button>
              <Button variant="default" size="sm" loading={connecting} onClick={handleConnect}>
                Accept and Connect
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
