'use client'

import React, { Suspense, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { fetchBilling } from '@/lib/api/user'
import { notifyCreditsUpdated } from '@/hooks/use-credit-status'
import { createOrganization } from '@/lib/api/organization'

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
  const { user, logout, refreshUser, isHydrated } = useAuth()

  const planParam = searchParams.get('plan') ?? ''
  const billing   = searchParams.get('billing')
  const status    = searchParams.get('status')

  const isFailed    = status === 'failed' || status === 'cancelled'
  const isTeamPlan  = planParam.startsWith('team_') || planParam === 'teams'
  const planLabel   = planParam ? planParam.charAt(0).toUpperCase() + planParam.slice(1) : null
  const billingLabel = billing === 'annual' ? 'Annual' : 'Monthly'

  const ownerName = user?.firstName?.trim() || user?.name?.split(' ')[0]?.trim() || ''

  // ── Flow decision ────────────────────────────────────────────────────────────
  // An already-onboarded user is upgrading, not signing up.
  const isExistingUser = !!user?.onboardingCompleted
  // A team/org plan with no org yet still needs the workspace-setup onboarding so
  // we can collect workspace details — this covers both first-time team signups
  // and an existing individual user upgrading to a team plan.
  const needsWorkspaceSetup = isTeamPlan && !user?.orgId
  // Simple upgrade = existing user who does NOT need workspace setup (individual→
  // individual, or team→team where the org already exists). These go straight back
  // into the app with a "plan upgraded" toast instead of any onboarding screen.
  const isSimpleUpgrade = !isFailed && isExistingUser && !needsWorkspaceSetup
  // Prefer the plan from the URL; fall back to the refreshed user plan_type.
  const refreshedPlanLabel = user?.planType
    ? user.planType.charAt(0).toUpperCase() + user.planType.slice(1)
    : null
  const effectivePlanLabel = planLabel ?? refreshedPlanLabel

  // Run org creation + refresh once, after auth has hydrated so user.orgId is
  // accurate. The ref prevents double-invocation from React StrictMode and from
  // isHydrated flipping more than once.
  const hasRunRef = useRef(false)
  useEffect(() => {
    if (!isHydrated || isFailed || hasRunRef.current) return
    hasRunRef.current = true

    document.cookie = 'souvenir_checkout_complete=1; path=/; max-age=600; SameSite=Lax'
    const run = async () => {
      // For team plans, create the org after payment — only if it doesn't already
      // exist. Checking user.orgId here is reliable because isHydrated=true.
      if (isTeamPlan && !user?.orgId) {
        const name = ownerName ? `${ownerName}'s workspace` : 'My workspace'
        await createOrganization({ name }).catch(() => {/* org may already exist */})
      }
      await refreshUser()
      void fetchBilling()
      notifyCreditsUpdated()
    }
    void run()
  }, [isHydrated]) // eslint-disable-line react-hooks/exhaustive-deps

  // Existing user, simple upgrade → skip the onboarding confirmation screen
  // entirely. Stash the new plan for a toast and drop them back into the app.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isHydrated || !isSimpleUpgrade) return
    try {
      sessionStorage.setItem('souvenir_plan_upgraded', JSON.stringify({
        plan:    effectivePlanLabel,
        billed:  !!billing,
        billing: billingLabel,
      }))
    } catch { /* sessionStorage may be unavailable */ }
    router.replace('/chat')
  }, [isHydrated, isSimpleUpgrade])

  // Wait for auth to hydrate before deciding which flow to show — otherwise an
  // existing user can briefly see the first-time "Continue with onboarding" CTA.
  // Simple upgrades render the same spinner while the redirect above fires.
  if (!isHydrated || isSimpleUpgrade) {
    return (
      <Shell>
        <p style={{ fontFamily: BODY, fontSize: '14px', color: C.muted }}>Loading…</p>
      </Shell>
    )
  }

  const iconBg  = isFailed ? C.redBg   : C.greenBg
  const heading = isFailed ? 'Payment Failed' : 'Payment Successful!'
  const description = isFailed
    ? 'Your payment could not be processed. No charge was made to your account.'
    : isTeamPlan
      ? "You've subscribed to a Team plan. Your workspace is ready."
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
              onClick={() => router.push('/onboarding/workspace')}
              style={primaryBtn}
            >
              Continue with onboarding
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
            <button
              type="button"
              onClick={() => router.push('/onboarding/import')}
              style={primaryBtn}
            >
              Continue with onboarding
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
