'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  getSharePreview,
  acceptShare,
  type PersonaSharePreview,
} from '@/lib/api/persona-shares'
import { ApiError } from '@/lib/api/client'
import { Button } from '@/components/Button'

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatExpiry(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function truncatePrompt(text: string, max = 200): string {
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '…'
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function Skeleton({ width, height, radius = 8 }: { width: number | string; height: number; radius?: number }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        backgroundColor: 'var(--neutral-100)',
        flexShrink: 0,
      }}
    />
  )
}

// ── Main page inner ────────────────────────────────────────────────────────────

function ShareAcceptContent() {
  const params = useParams<{ id: string }>()
  const { push } = useRouter()

  type PageState = 'loading' | 'preview' | 'expired' | 'not_found' | 'error' | 'accepted'
  const [state, setState] = useState<PageState>('loading')
  const [preview, setPreview] = useState<PersonaSharePreview | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [isAccepting, setIsAccepting] = useState(false)

  useEffect(() => {
    if (!params.id) return
    getSharePreview(params.id)
      .then(data => {
        setPreview(data)
        setState('preview')
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError) {
          if (err.status === 404) {
            setState('not_found')
          } else if (err.status === 410) {
            setState('expired')
          } else {
            setErrorMessage(err.message)
            setState('error')
          }
        } else {
          setErrorMessage('Something went wrong. Please try again.')
          setState('error')
        }
      })
  }, [params.id])

  async function handleAccept() {
    if (!params.id || !preview) return
    setIsAccepting(true)
    try {
      const result = await acceptShare(params.id)
      setState('accepted')
      toast.success(`"${result.name}" added to your personas`)
      // Navigate to the new persona's instructions page
      setTimeout(() => {
        push(
          `/persona/configure/instructions?repoId=${result.persona_repo_id}&versionId=${result.persona_version_id}&name=${encodeURIComponent(result.name)}`,
        )
      }, 1200)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 410) {
          setState('expired')
        } else if (err.status === 402) {
          toast.error('This share has no credits remaining — the persona can no longer be accepted.')
        } else {
          toast.error(err.message)
        }
      } else {
        toast.error('Failed to accept persona. Please try again.')
      }
    } finally {
      setIsAccepting(false)
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <Skeleton width={72} height={72} radius={16} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <Skeleton width={220} height={28} radius={8} />
            <Skeleton width={160} height={16} radius={6} />
          </div>
          <Skeleton width="100%" height={72} radius={10} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
            <Skeleton width={200} height={16} radius={6} />
            <Skeleton width={140} height={16} radius={6} />
          </div>
        </div>
        <div style={footerStyle}>
          <Skeleton width={100} height={40} radius={10} />
          <Skeleton width={160} height={40} radius={10} />
        </div>
      </div>
    )
  }

  // ── Expired / revoked ────────────────────────────────────────────────────────
  if (state === 'expired' || state === 'not_found') {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '8px 0' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              backgroundColor: 'var(--neutral-100)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
            }}
          >
            🔗
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <p style={headingStyle}>
              {state === 'expired' ? 'This link has expired' : 'Link not found'}
            </p>
            <p style={subtextStyle}>
              {state === 'expired'
                ? 'The share was revoked or expired. Ask the owner for a new link.'
                : 'This share link doesn\'t exist or has already been used.'}
            </p>
          </div>
        </div>
        <div style={footerStyle}>
          <Button variant="outline" size="md" onClick={() => push('/')}>
            Go home
          </Button>
        </div>
      </div>
    )
  }

  // ── Generic error ────────────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <p style={headingStyle}>Something went wrong</p>
          <p style={subtextStyle}>{errorMessage}</p>
        </div>
        <div style={footerStyle}>
          <Button variant="outline" size="md" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  // ── Accepted ─────────────────────────────────────────────────────────────────
  if (state === 'accepted') {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '8px 0' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              backgroundColor: 'var(--neutral-100)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
            }}
          >
            ✓
          </div>
          <p style={headingStyle}>Persona added!</p>
          <p style={subtextStyle}>Redirecting to your new persona…</p>
        </div>
      </div>
    )
  }

  // ── Preview ───────────────────────────────────────────────────────────────────
  if (!preview) return null

  const creditsRemaining =
    preview.credit_limit !== null ? preview.credit_limit - preview.credit_used : null

  return (
    <div style={cardStyle}>

      {/* Header: avatar + name */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 18,
            flexShrink: 0,
            overflow: 'hidden',
            backgroundColor: 'var(--neutral-100)',
            boxShadow: '0px 0px 0px 1px rgba(59,54,50,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {preview.persona_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- persona image from trusted backend URL
            <img
              src={preview.persona_image_url}
              alt={preview.persona_name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                fontSize: 26,
                color: 'var(--neutral-500)',
                lineHeight: 1,
              }}
            >
              {(preview.persona_name || '?').trim()[0].toUpperCase()}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <p
            style={{
              fontFamily: 'var(--font-title)',
              fontWeight: 400,
              fontSize: 24,
              lineHeight: '32px',
              color: '#1a1916',
              margin: 0,
              textAlign: 'center',
            }}
          >
            {preview.persona_name}
          </p>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              fontSize: 13,
              lineHeight: '18px',
              color: 'var(--neutral-500)',
              margin: 0,
              textAlign: 'center',
            }}
          >
            Shared by {preview.shared_by_name} ({preview.shared_by_email})
          </p>
        </div>
      </div>

      {/* Prompt preview */}
      {preview.persona_prompt && (
        <div
          style={{
            backgroundColor: 'var(--neutral-50)',
            borderRadius: 10,
            padding: '12px 14px',
            boxShadow: '0px 0px 0px 1px var(--neutral-100)',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              fontSize: 13,
              lineHeight: '20px',
              color: 'var(--neutral-700)',
              margin: 0,
              whiteSpace: 'pre-line',
            }}
          >
            {truncatePrompt(preview.persona_prompt)}
          </p>
        </div>
      )}

      {/* Meta row: model, temperature, credits, expiry */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {preview.persona_model && (
          <MetaRow label="Model" value={preview.persona_model} />
        )}
        {preview.persona_temperature !== null && (
          <MetaRow label="Temperature" value={String(preview.persona_temperature)} />
        )}
        {creditsRemaining !== null ? (
          <MetaRow
            label="Credits available"
            value={`${creditsRemaining.toLocaleString()} tokens`}
          />
        ) : (
          <MetaRow label="Credits" value="No limit" />
        )}
        {preview.expires_at && (
          <MetaRow label="Expires" value={formatExpiry(preview.expires_at)} />
        )}
      </div>

      {/* What you get */}
      <div
        style={{
          backgroundColor: 'rgba(13,110,178,0.06)',
          borderRadius: 10,
          padding: '10px 14px',
          boxShadow: '0px 0px 0px 1px rgba(13,110,178,0.15)',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize: 12,
            lineHeight: '18px',
            color: '#135487',
            margin: 0,
          }}
        >
          Accepting adds a copy of this persona to your account. Usage is billed to the sharer up to their credit limit — you won&apos;t be charged.
        </p>
      </div>

      {/* Footer actions */}
      <div style={footerStyle}>
        <Button variant="outline" size="md" onClick={() => push('/')}>
          Decline
        </Button>
        <Button
          variant="default"
          size="md"
          onClick={handleAccept}
          loading={isAccepting}
          disabled={isAccepting}
        >
          Accept &amp; copy persona
        </Button>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 500,
          fontSize: 13,
          lineHeight: '18px',
          color: 'var(--neutral-500)',
          minWidth: 120,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 400,
          fontSize: 13,
          lineHeight: '18px',
          color: 'var(--neutral-800)',
        }}
      >
        {value}
      </span>
    </div>
  )
}

// ── Shared styles ──────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
  backgroundColor: 'var(--neutral-white)',
  borderRadius: 18,
  padding: '28px 24px',
  width: '100%',
  maxWidth: 480,
  boxShadow:
    '0px 12px 16px -4px rgba(130,122,116,0.12), 0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
}

const footerStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  justifyContent: 'flex-end',
  paddingTop: 4,
}

const headingStyle: React.CSSProperties = {
  fontFamily: 'var(--font-title)',
  fontWeight: 400,
  fontSize: 20,
  lineHeight: '28px',
  color: '#1a1916',
  margin: 0,
  textAlign: 'center',
}

const subtextStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontWeight: 400,
  fontSize: 14,
  lineHeight: '22px',
  color: 'var(--neutral-500)',
  margin: 0,
  textAlign: 'center',
  maxWidth: 340,
}

// ── Page export ────────────────────────────────────────────────────────────────

export default function ShareAcceptPage() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100%',
        padding: '32px 16px',
      }}
    >
      <Suspense>
        <ShareAcceptContent />
      </Suspense>
    </div>
  )
}
