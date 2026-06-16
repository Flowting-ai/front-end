'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/Button'
import { ApiError } from '@/lib/api/client'
import {
  getTeamInvitePreview,
  acceptTeamInvite,
  type TeamInvitePreview,
} from '@/lib/api/teams'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatExpiry(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day:   'numeric',
    year:  'numeric',
  })
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ width, height, radius = 8 }: { width: number | string; height: number; radius?: number }) {
  return (
    <div style={{ width, height, borderRadius: radius, backgroundColor: 'var(--neutral-100)', flexShrink: 0 }} />
  )
}

// ── Team avatar ───────────────────────────────────────────────────────────────

function TeamAvatar({ name }: { name: string }) {
  const initial = (name || '?').trim()[0]?.toUpperCase() ?? '?'
  return (
    <div
      style={{
        width:           72,
        height:          72,
        borderRadius:    18,
        flexShrink:      0,
        background:      'linear-gradient(135deg, var(--neutral-100) 0%, var(--neutral-200) 100%)',
        boxShadow:       '0px 0px 0px 1px rgba(59,54,50,0.15)',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-title)',
          fontWeight: 400,
          fontSize:   28,
          color:      'var(--neutral-600)',
          lineHeight:  1,
        }}
      >
        {initial}
      </span>
    </div>
  )
}

// ── Main content ──────────────────────────────────────────────────────────────

type PageState = 'loading' | 'preview' | 'expired' | 'not_found' | 'error' | 'accepted'

function TeamInviteContent() {
  const params           = useParams<{ inviteId: string }>()
  const { push }         = useRouter()
  const inviteId         = params.inviteId

  const [state,       setState]       = useState<PageState>('loading')
  const [preview,     setPreview]     = useState<TeamInvitePreview | null>(null)
  const [errorMsg,    setErrorMsg]    = useState('')
  const [isAccepting, setIsAccepting] = useState(false)

  useEffect(() => {
    if (!inviteId) return
    getTeamInvitePreview(inviteId)
      .then(data => { setPreview(data); setState('preview') })
      .catch((err: unknown) => {
        if (err instanceof ApiError) {
          if (err.status === 404) setState('not_found')
          else if (err.status === 410) setState('expired')
          else { setErrorMsg(err.message); setState('error') }
        } else {
          setErrorMsg('Something went wrong. Please try again.')
          setState('error')
        }
      })
  }, [inviteId])

  async function handleAccept() {
    if (!inviteId || !preview) return
    setIsAccepting(true)
    try {
      await acceptTeamInvite(inviteId)
      setState('accepted')
      toast.success(`You've joined ${preview.teamName}`)
      setTimeout(() => push('/org/teams'), 1400)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 410) setState('expired')
        else toast.error(err.message)
      } else {
        toast.error('Failed to accept invite. Please try again.')
      }
    } finally {
      setIsAccepting(false)
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <Skeleton width={72} height={72} radius={18} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <Skeleton width={220} height={28} radius={8} />
            <Skeleton width={180} height={16} radius={6} />
          </div>
          <Skeleton width="100%" height={56} radius={10} />
        </div>
        <div style={footerStyle}>
          <Skeleton width={90} height={40} radius={10} />
          <Skeleton width={140} height={40} radius={10} />
        </div>
      </div>
    )
  }

  // ── Expired / not found ────────────────────────────────────────────────────────
  if (state === 'expired' || state === 'not_found') {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '8px 0' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            backgroundColor: 'var(--neutral-100)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28,
          }}>
            🔗
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <p style={headingStyle}>
              {state === 'expired' ? 'This invite has expired' : 'Invite not found'}
            </p>
            <p style={subtextStyle}>
              {state === 'expired'
                ? 'This invite link has expired or been revoked. Ask your admin to send a new one.'
                : "This invite link doesn't exist or has already been used."}
            </p>
          </div>
        </div>
        <div style={footerStyle}>
          <Button variant="outline" size="md" onClick={() => push('/chat')}>Go home</Button>
        </div>
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <p style={headingStyle}>Something went wrong</p>
          <p style={subtextStyle}>{errorMsg}</p>
        </div>
        <div style={footerStyle}>
          <Button variant="outline" size="md" onClick={() => window.location.reload()}>Try again</Button>
        </div>
      </div>
    )
  }

  // ── Accepted ───────────────────────────────────────────────────────────────────
  if (state === 'accepted') {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '8px 0' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            backgroundColor: 'var(--neutral-100)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28,
          }}>
            ✓
          </div>
          <p style={headingStyle}>You&apos;re in!</p>
          <p style={subtextStyle}>Taking you to your team…</p>
        </div>
      </div>
    )
  }

  // ── Preview ────────────────────────────────────────────────────────────────────
  if (!preview) return null

  return (
    <div style={cardStyle}>

      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <TeamAvatar name={preview.teamName} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <p style={{
            fontFamily: 'var(--font-title)',
            fontWeight: 400,
            fontSize:   24,
            lineHeight: '32px',
            color:      '#1a1916',
            margin:     0,
            textAlign:  'center',
          }}>
            Join <em style={{ fontStyle: 'normal' }}>{preview.teamName}</em>
          </p>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize:   13,
            lineHeight: '18px',
            color:      'var(--neutral-500)',
            margin:     0,
            textAlign:  'center',
          }}>
            {preview.invitedByName} invited you to this team
          </p>
        </div>
      </div>

      {/* Meta */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <MetaRow label="Team"    value={preview.teamName} />
        <MetaRow label="Invited by" value={preview.invitedByName} />
        <MetaRow label="Expires" value={formatExpiry(preview.expiresAt)} />
      </div>

      {/* Info banner */}
      <div style={{
        backgroundColor: 'rgba(13,110,178,0.06)',
        borderRadius:    10,
        padding:         '10px 14px',
        boxShadow:       '0px 0px 0px 1px rgba(13,110,178,0.15)',
      }}>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 400,
          fontSize:   12,
          lineHeight: '18px',
          color:      '#135487',
          margin:     0,
        }}>
          Accepting adds you to this team. You&apos;ll get access to the team&apos;s projects and shared agents.
        </p>
      </div>

      {/* Footer */}
      <div style={footerStyle}>
        <Button variant="outline" size="md" onClick={() => push('/chat')}>Decline</Button>
        <Button
          variant="default"
          size="md"
          loading={isAccepting}
          disabled={isAccepting}
          onClick={handleAccept}
        >
          Accept &amp; join team
        </Button>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        fontFamily: 'var(--font-body)',
        fontWeight: 500,
        fontSize:   13,
        lineHeight: '18px',
        color:      'var(--neutral-500)',
        minWidth:   100,
        flexShrink: 0,
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: 'var(--font-body)',
        fontWeight: 400,
        fontSize:   13,
        lineHeight: '18px',
        color:      'var(--neutral-800)',
      }}>
        {value}
      </span>
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  display:         'flex',
  flexDirection:   'column',
  gap:             20,
  backgroundColor: 'var(--neutral-white)',
  borderRadius:    18,
  padding:         '28px 24px',
  width:           '100%',
  maxWidth:        480,
  boxShadow:
    '0px 12px 16px -4px rgba(130,122,116,0.12), 0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
}

const footerStyle: React.CSSProperties = {
  display:        'flex',
  gap:            10,
  justifyContent: 'flex-end',
  paddingTop:     4,
}

const headingStyle: React.CSSProperties = {
  fontFamily: 'var(--font-title)',
  fontWeight: 400,
  fontSize:   20,
  lineHeight: '28px',
  color:      '#1a1916',
  margin:     0,
  textAlign:  'center',
}

const subtextStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontWeight: 400,
  fontSize:   14,
  lineHeight: '22px',
  color:      'var(--neutral-500)',
  margin:     0,
  textAlign:  'center',
  maxWidth:   340,
}

// ── Page export ────────────────────────────────────────────────────────────────

export default function TeamInvitePage() {
  return (
    <div style={{
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      minHeight:       '100%',
      padding:         '32px 16px',
    }}>
      <Suspense>
        <TeamInviteContent />
      </Suspense>
    </div>
  )
}
