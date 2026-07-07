'use client'

import React, { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { useOrg } from '@/context/org-context'
import { fetchBilling } from '@/lib/api/user'
import { notifyCreditsUpdated } from '@/hooks/use-credit-status'
import { Button } from '@/components/Button'
import { SETTINGS_BILLING_ROUTE, CHAT_ROUTE } from '@/lib/routes'

// ── Design tokens ─────────────────────────────────────────────────────────────
const TITLE = 'var(--font-title)'
const BODY  = 'var(--font-body)'

const C = {
  ink:     'var(--neutral-900)',
  muted:   'var(--neutral-500)',
  green:   '#16A34A',
  greenBg: '#DCFCE7',
} as const

function CheckCircleIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

export default function BillingConfirmationPage() {
  return (
    <Suspense fallback={null}>
      <BillingConfirmationContent />
    </Suspense>
  )
}

function BillingConfirmationContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { refreshUser } = useAuth()
  const { refreshMembers } = useOrg()

  const plan = searchParams.get('plan')
  const type = searchParams.get('type') // 'topup' | 'plan' | null

  const planLabel = plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : null
  const isTopUp   = type === 'topup'

  // Fire-and-forget: refresh auth + billing + org plan once on mount.
  // Empty deps is intentional — refreshUser/refreshMembers are not useCallback-
  // memoised in their contexts, so including them causes an infinite re-run loop.
  useEffect(() => {
    document.cookie = 'souvenir_checkout_complete=; path=/; max-age=0; SameSite=Lax'
    void refreshUser()
    void fetchBilling()
    // Re-fetch the org credit pool so team plan credits land in the UI without
    // waiting for the next org-context mount cycle.
    refreshMembers()
    // Also broadcast so any already-mounted app surfaces (chat gate, banners)
    // refresh their credit balance — covers topups completed via Stripe redirect.
    notifyCreditsUpdated()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const heading = isTopUp ? 'Credits Added!' : 'Payment Successful!'
  const description = isTopUp
    ? 'Your credits have been topped up and are ready to use.'
    : planLabel
      ? `You're now subscribed to the ${planLabel} plan. Your workspace is ready.`
      : 'Your subscription is active. Your workspace is ready.'

  return (
    <div className="kaya-scrollbar" style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      overflow: 'auto',
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 24,
        maxWidth: 480,
        width: '100%',
        textAlign: 'center',
      }}>

        {/* Icon */}
        <div style={{
          width: 96,
          height: 96,
          borderRadius: '50%',
          backgroundColor: C.greenBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <CheckCircleIcon />
        </div>

        {/* Text */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h1 style={{
            fontFamily: TITLE,
            fontSize: 28,
            fontWeight: 400,
            lineHeight: '34px',
            color: C.ink,
            margin: 0,
          }}>
            {heading}
          </h1>
          <p style={{
            fontFamily: BODY,
            fontSize: 15,
            lineHeight: '22px',
            color: C.muted,
            margin: 0,
          }}>
            {description}
          </p>
        </div>

        {/* CTAs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 320 }}>
          <Button fluid onClick={() => router.push(SETTINGS_BILLING_ROUTE)}>
            Go to usage &amp; billing
          </Button>
          <Button variant="ghost" fluid onClick={() => router.push(CHAT_ROUTE)}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}
