'use client'

import React, { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { updateOnboarding } from '@/lib/api/user'

// ── Design tokens ──────────────────────────────────────────────────────────────
const TITLE = 'var(--font-title)'
const BODY  = 'var(--font-body)'

const C = {
  ink:        'var(--neutral-900, #26211e)',
  sub:        'var(--neutral-700, #524b47)',
  muted:      'var(--neutral-500, #827a74)',
  bg:         'var(--neutral-50, #f7f2ed)',
  white:      'var(--neutral-white, #fff)',
  green:      '#16A34A',
  greenBg:    '#DCFCE7',
  red:        '#DC2626',
  redBg:      '#FEE2E2',
} as const

// ── Icons ──────────────────────────────────────────────────────────────────────
function CheckCircleIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none"
      stroke={C.green} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

function XCircleIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none"
      stroke={C.red} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  )
}

// ── Shell ──────────────────────────────────────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.bg,
      padding: '40px 16px',
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative background; Next Image doesn't support SVG patterns with embedded raster images */}
      <img src="https://souvenirai-storage.s3.us-east-1.amazonaws.com/public/souvenir-onboarding-bg.svg" alt="Souvenir onboarding background" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', display: 'flex', justifyContent: 'center' }}>
        {children}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PricingConfirmationPage() {
  return (
    <Suspense fallback={
      <Shell>
        <p style={{ fontFamily: BODY, fontSize: '14px', color: C.muted }}>Loading…</p>
      </Shell>
    }>
      <PricingConfirmationContent />
    </Suspense>
  )
}

// ── Content ───────────────────────────────────────────────────────────────────
function PricingConfirmationContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, refreshUser, logout } = useAuth()

  const planParam = searchParams.get('plan') ?? ''
  const billing   = searchParams.get('billing')
  const status    = searchParams.get('status')

  const isFailed    = status === 'failed' || status === 'cancelled'
  const isTeamPlan  = planParam.startsWith('team_')
  const planLabel   = planParam ? planParam.charAt(0).toUpperCase() + planParam.slice(1) : null
  const billingLabel = billing === 'annual' ? 'Annual' : 'Monthly'

  const ownerName = user?.firstName?.trim() || user?.name?.split(' ')[0]?.trim() || ''

  // On successful payment: mark onboarding complete, set bypass cookie, refresh user.
  // Marking onboarding_completed here is essential for team users — they never hit
  // the import page (the only other place that sets this flag), so without this the
  // OnboardingGuard bounces them back to /onboarding/hello after they navigate into
  // the app. Empty deps is intentional — refreshUser is not useCallback-memoised.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isFailed) return
    document.cookie = 'souvenir_checkout_complete=1; path=/; max-age=120; SameSite=Lax'
    void updateOnboarding({ onboarding_completed: true }).then(() => refreshUser())
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const iconBg  = isFailed ? C.redBg   : C.greenBg
  const heading = isFailed ? 'Payment Failed' : 'Payment Successful!'
  const description = isFailed
    ? 'Your payment could not be processed. No charge was made to your account.'
    : planLabel
      ? `You're now on the ${planLabel} plan${billing ? ` (${billingLabel})` : ''}. Your workspace is ready.`
      : 'Your subscription is active. Your workspace is ready.'

  return (
    <Shell>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '24px',
        maxWidth: '440px',
        width: '100%',
        textAlign: 'center',
      }}>

        {/* Icon bubble */}
        <div style={{
          width: 96, height: 96,
          borderRadius: '50%',
          backgroundColor: iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          {isFailed ? <XCircleIcon /> : <CheckCircleIcon />}
        </div>

        {/* Heading + description */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h1 style={{
            fontFamily: TITLE,
            fontWeight: 400,
            fontSize: '28px',
            lineHeight: '34px',
            color: C.ink,
            margin: 0,
          }}>
            {heading}
          </h1>
          <p style={{
            fontFamily: BODY,
            fontSize: '15px',
            lineHeight: '22px',
            color: C.sub,
            margin: 0,
          }}>
            {description}
          </p>
        </div>

        {/* CTAs */}
        {isFailed ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
            <button
              type="button"
              onClick={() => router.back()}
              style={primaryBtn}
            >
              Try again
            </button>
            <a
              href="mailto:support@getsouvenir.com"
              style={secondaryLink}
            >
              Contact support
            </a>
          </div>
        ) : isTeamPlan ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
            <button
              type="button"
              onClick={() => router.push(`/welcome${ownerName ? `?owner=${encodeURIComponent(ownerName)}` : ''}`)}
              style={primaryBtn}
            >
              Open your workspace
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
            <button
              type="button"
              onClick={() => router.push('/settings/billing')}
              style={primaryBtn}
            >
              Go to billing &amp; usage
            </button>
            <button
              type="button"
              onClick={() => router.push('/chat')}
              style={ghostBtn}
            >
              Go to Dashboard
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => void logout()}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: BODY, fontSize: '13px', color: '#0d6eb2', textDecoration: 'underline', marginTop: 4 }}
        >
          Log out
        </button>
      </div>
    </Shell>
  )
}

// ── Shared button styles ───────────────────────────────────────────────────────
const primaryBtn: React.CSSProperties = {
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
}

const ghostBtn: React.CSSProperties = {
  fontFamily: BODY,
  fontSize: '13px',
  color: C.muted,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  textDecoration: 'underline',
  padding: 0,
}

const secondaryLink: React.CSSProperties = {
  fontFamily: BODY,
  fontSize: '13px',
  color: C.muted,
  textDecoration: 'underline',
}
