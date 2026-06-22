'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as VisuallyHidden from '@radix-ui/react-visually-hidden'
import { toast } from 'sonner'
import { RadarThreeIcon, CalendarThreeIcon } from '@strange-huge/icons'
import { ViewIcon } from '@/components/ViewIcon'
import { Button } from '@/components/Button'
import { getOrgSlackStatus, getSlackInstallUrl, getSlackStatus } from '@/lib/api/slack'

// ── Shadows ───────────────────────────────────────────────────────────────────
const SHADOW_MODAL = '0px 12px 16px -4px rgba(130,122,116,0.12), 0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)'

// Poll the Slack status after the install tab opens, until the bot reports
// installed or we give up. 3s cadence keeps it responsive without hammering.
const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS   = 3 * 60 * 1000

// ── Feature rows ───────────────────────────────────────────────────────────────

interface Feature {
  icon:     React.ReactNode
  title:    string
  subtitle: string
}

const FEATURES: Feature[] = [
  {
    icon:     <ViewIcon size={20} color="var(--neutral-700)" variant="visible" />,
    title:    'Reads only mapped channels',
    subtitle: 'Nothing else is touched until you map it.',
  },
  {
    icon:     <RadarThreeIcon size={20} color="var(--neutral-700)" />,
    title:    'Corporate accounts only',
    subtitle: 'Personal-account links are blocked automatically.',
  },
  {
    icon:     <CalendarThreeIcon size={20} color="var(--neutral-700)" />,
    title:    'Revoke anytime',
    subtitle: 'Disconnect the workspace whenever you want.',
  },
]

// ── Brand mark row ───────────────────────────────────────────────────────────────

function BrandMarks() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <div style={{
        width:           72,
        height:          72,
        borderRadius:    '50%',
        border:          '1.5px solid var(--neutral-900)',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        flexShrink:      0,
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand logo asset */}
        <img src="/icons/souvenir-logo-gray.svg" alt="Souvenir" width={36} height={36} style={{ display: 'block' }} />
      </div>
      <div style={{ width: 28, height: 2, backgroundColor: 'var(--neutral-300)', flexShrink: 0 }} />
      <div style={{
        width:           72,
        height:          72,
        borderRadius:    16,
        backgroundColor: '#2d0b2e',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        flexShrink:      0,
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand logo asset */}
        <img src="/connector-logos/slack.svg" alt="" width={38} height={38} style={{ display: 'block', objectFit: 'contain' }} />
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
          aria-label="Connect Slack to Souvenir"
          style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1101, outline: 'none' }}
        >
          <VisuallyHidden.Root asChild>
            <Dialog.Title>Connect Slack to Souvenir</Dialog.Title>
          </VisuallyHidden.Root>

          <div
            style={{
              display:         'flex',
              flexDirection:   'column',
              alignItems:      'center',
              gap:             20,
              width:           560,
              maxWidth:        'calc(100vw - 48px)',
              padding:         '36px 44px',
              borderRadius:    24,
              boxSizing:       'border-box',
              backgroundColor: 'var(--neutral-white)',
              boxShadow:       SHADOW_MODAL,
            }}
          >
            <BrandMarks />

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
              <h2 style={{
                fontFamily: 'var(--font-title)',
                fontWeight: 400,
                fontSize:   28,
                lineHeight: '34px',
                color:      'var(--neutral-900)',
                margin:     0,
              }}>
                Connect Slack to Souvenir
              </h2>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize:   16,
                lineHeight: '24px',
                color:      'var(--neutral-500)',
                margin:     0,
                maxWidth:   400,
              }}>
                One secure connection for the whole workspace. You stay in control.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
              {FEATURES.map(f => (
                <div
                  key={f.title}
                  style={{
                    display:         'flex',
                    alignItems:      'flex-start',
                    gap:             14,
                    padding:         '16px 18px',
                    borderRadius:    14,
                    backgroundColor: 'var(--neutral-50)',
                  }}
                >
                  <span style={{ flexShrink: 0, lineHeight: 0, marginTop: 1 }}>{f.icon}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <p style={{
                      fontFamily: 'var(--font-body)',
                      fontWeight: 600,
                      fontSize:   15,
                      lineHeight: '22px',
                      color:      'var(--neutral-900)',
                      margin:     0,
                    }}>
                      {f.title}
                    </p>
                    <p style={{
                      fontFamily: 'var(--font-body)',
                      fontWeight: 400,
                      fontSize:   14,
                      lineHeight: '20px',
                      color:      'var(--neutral-500)',
                      margin:     0,
                    }}>
                      {f.subtitle}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, width: '100%' }}>
              <Button variant="outline" size="sm" onClick={onClose} disabled={connecting}>
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                loading={connecting}
                onClick={handleConnect}
                leftIcon={<img src="/connector-logos/slack.svg" alt="" width={14} height={14} style={{ objectFit: 'contain', display: 'block' }} />}
              >
                Connect Slack workspace
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
