'use client'

import React, { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { fetchBilling } from '@/lib/api/user'

// ── Design tokens ─────────────────────────────────────────────────────────────
const TITLE = 'var(--font-title)'
const BODY = 'var(--font-body)'

const C = {
  ink:     'var(--neutral-900, #26211e)',
  muted:   'var(--neutral-500, #827a74)',
  sub:     'var(--neutral-700, #524b47)',
  border:  'var(--neutral-100, #ede1d7)',
  white:   'var(--neutral-white, #fff)',
  bg:      'var(--neutral-50, #f7f2ed)',
  green:   '#16A34A',
  greenBg: '#DCFCE7',
  red:     '#DC2626',
  redBg:   '#FEE2E2',
  amber:   '#92400E',
  amberBg: '#FFFBEB',
  amberBorder: '#FDE68A',
} as const

// ── Icons ──────────────────────────────────────────────────────────────────────
function CheckCircleIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

function XCircleIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke={C.red} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={C.muted}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </svg>
  )
}

// ── Page shell ─────────────────────────────────────────────────────────────────
export default function PricingConfirmationPage() {
  return (
    <Suspense fallback={<ConfirmationShell><LoadingState /></ConfirmationShell>}>
      <PricingConfirmationContent />
    </Suspense>
  )
}

function ConfirmationShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: C.bg,
        backgroundImage: "url('/icons/souvenir-bg.svg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
        padding: '40px 16px',
      }}
    >
      {children}
    </div>
  )
}

function LoadingState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
      <SpinnerIcon />
      <p style={{ fontFamily: BODY, fontSize: '14px', color: C.muted, margin: 0 }}>
        Loading…
      </p>
    </div>
  )
}

// ── Main content (reads search params) ────────────────────────────────────────
function PricingConfirmationContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { refreshUser } = useAuth()

  const planParam = searchParams.get('plan') ?? ''
  const billing = searchParams.get('billing')
  const status = searchParams.get('status') // 'failed' | 'cancelled' | null (null = success)

  const isFailed = status === 'failed' || status === 'cancelled'

  const planLabel = planParam
    ? planParam.charAt(0).toUpperCase() + planParam.slice(1)
    : null
  const billingLabel = billing === 'annual' ? 'Annual' : 'Monthly'

  // ── Success sync state ─────────────────────────────────────────────────────
  const [syncing, setSyncing] = useState(!isFailed)
  const [syncDone, setSyncDone] = useState(isFailed)
  const [showDeferredHint, setShowDeferredHint] = useState(false)
  const [continuing, setContinuing] = useState(false)

  useEffect(() => {
    if (isFailed) return
    let cancelled = false

    const sync = async () => {
      try {
        // Give Stripe webhook a moment to propagate before re-fetching.
        await new Promise<void>((r) => setTimeout(r, 1500))
        await Promise.all([refreshUser(), fetchBilling()])
        // Clear any stale bypass cookie, then set the fresh one so middleware
        // won't redirect the user away from /chat before the webhook lands.
        document.cookie = 'souvenir_checkout_complete=; path=/; max-age=0; SameSite=Lax'
        document.cookie = 'souvenir_checkout_complete=1; path=/; max-age=120; SameSite=Lax'
        if (!cancelled) {
          setSyncing(false)
          setSyncDone(true)
        }
      } catch {
        if (!cancelled) {
          setSyncing(false)
          setSyncDone(true)
          setShowDeferredHint(true)
        }
      }
    }

    void sync()
    return () => { cancelled = true }
  }, [isFailed, refreshUser])

  const handleContinue = useCallback(async () => {
    setContinuing(true)
    try {
      await refreshUser()
      router.push('/chat?welcome=1')
    } finally {
      setContinuing(false)
    }
  }, [refreshUser, router])

  return (
    <ConfirmationShell>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
          maxWidth: '440px',
          width: '100%',
          textAlign: 'center',
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: '50%',
            backgroundColor: isFailed ? C.redBg : C.greenBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {isFailed ? <XCircleIcon /> : <CheckCircleIcon />}
        </div>

        {/* Heading + description */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h1
            style={{
              fontFamily: TITLE,
              fontWeight: 400,
              fontSize: '28px',
              lineHeight: '34px',
              color: C.ink,
              margin: 0,
            }}
          >
            {isFailed ? 'Payment Failed' : 'Payment Successful!'}
          </h1>

          <p
            style={{
              fontFamily: BODY,
              fontSize: '15px',
              lineHeight: '22px',
              color: C.sub,
              margin: 0,
            }}
          >
            {isFailed
              ? 'Your payment could not be processed. No charge was made to your account.'
              : planLabel
                ? `You're now on the ${planLabel} plan${billing ? ` (${billingLabel})` : ''}. Your workspace is ready.`
                : 'Your subscription is active. Your workspace is ready.'}
          </p>

          {/* Syncing indicator */}
          {!isFailed && syncing && (
            <p
              style={{
                fontFamily: BODY,
                fontSize: '13px',
                lineHeight: '18px',
                color: C.muted,
                margin: '8px 0 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <SpinnerIcon />
              Activating your subscription…
            </p>
          )}

          {/* Deferred sync hint */}
          {showDeferredHint && (
            <p
              style={{
                fontFamily: BODY,
                fontSize: '13px',
                lineHeight: '20px',
                color: C.amber,
                backgroundColor: C.amberBg,
                border: `1px solid ${C.amberBorder}`,
                borderRadius: '10px',
                padding: '10px 14px',
                margin: '8px 0 0',
                textAlign: 'left',
              }}
            >
              Payment received. If your plan hasn't updated yet, wait a moment and refresh after continuing.
            </p>
          )}
        </div>

        {/* Primary CTA */}
        {isFailed ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
            <button
              type="button"
              onClick={() => router.back()}
              style={{
                fontFamily: BODY,
                fontSize: '15px',
                fontWeight: 500,
                color: C.white,
                backgroundColor: C.ink,
                border: 'none',
                borderRadius: '8px',
                padding: '12px 32px',
                cursor: 'pointer',
                transition: 'opacity 0.15s',
                width: '100%',
              }}
            >
              Try again
            </button>
            <a
              href="mailto:support@getsouvenir.com"
              style={{
                fontFamily: BODY,
                fontSize: '13px',
                lineHeight: '18px',
                color: C.muted,
                textDecoration: 'underline',
              }}
            >
              Contact support
            </a>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
            <button
              type="button"
              onClick={() => void handleContinue()}
              disabled={!syncDone || continuing}
              style={{
                fontFamily: BODY,
                fontSize: '15px',
                fontWeight: 500,
                color: C.white,
                backgroundColor: !syncDone || continuing ? '#A3A3A3' : C.ink,
                border: 'none',
                borderRadius: '8px',
                padding: '12px 32px',
                cursor: !syncDone || continuing ? 'default' : 'pointer',
                transition: 'background-color 0.15s',
                width: '100%',
              }}
            >
              {continuing
                ? 'Setting up your workspace…'
                : !syncDone
                  ? 'Activating…'
                  : 'Continue to Dashboard'}
            </button>

            {syncDone && (
              <button
                type="button"
                onClick={() => router.push('/settings/billing')}
                style={{
                  fontFamily: BODY,
                  fontSize: '13px',
                  color: C.muted,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                View billing details
              </button>
            )}
          </div>
        )}
      </div>
    </ConfirmationShell>
  )
}
