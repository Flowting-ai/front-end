'use client'

import React, { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { fetchBilling } from '@/lib/api/user'

// ── Design tokens ─────────────────────────────────────────────────────────────
const TITLE = 'var(--font-title)'
const BODY  = 'var(--font-body)'

const C = {
  ink:    'var(--neutral-900)',
  muted:  'var(--neutral-500)',
  white:  'var(--neutral-white)',
  green:  '#16A34A',
  greenBg:'#DCFCE7',
} as const

// ── CheckCircle icon (inline, no external dep) ────────────────────────────────
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
  const [syncing, setSyncing] = useState(true)
  const [planLabel, setPlanLabel] = useState<string>('')

  const plan = searchParams.get('plan')
  const type = searchParams.get('type') // 'topup' | 'plan' | null

  useEffect(() => {
    if (plan) {
      setPlanLabel(plan.charAt(0).toUpperCase() + plan.slice(1))
    }
  }, [plan])

  // Re-fetch user + billing to sync the new subscription state
  useEffect(() => {
    let cancelled = false
    const sync = async () => {
      try {
        // Give Stripe webhook a moment to propagate
        await new Promise((r) => setTimeout(r, 1500))
        await Promise.all([refreshUser(), fetchBilling()])
        // Clear the bypass cookie now that sync is complete
        document.cookie = 'souvenir_checkout_complete=; path=/; max-age=0; SameSite=Lax'
        if (!cancelled) setSyncing(false)
      } catch {
        if (!cancelled) setSyncing(false)
      }
    }
    void sync()
    return () => { cancelled = true }
  }, [refreshUser])

  const isTopUp = type === 'topup'

  const heading = isTopUp ? 'Credits Added!' : 'Payment Successful!'
  const description = isTopUp
    ? 'Your credits have been topped up and are ready to use.'
    : planLabel
      ? `You're now subscribed to the ${planLabel} plan. Your workspace is ready.`
      : 'Your subscription is active. Your workspace is ready.'

  return (
    <div style={{
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
          {syncing && (
            <p style={{
              fontFamily: BODY,
              fontSize: 13,
              lineHeight: '18px',
              color: C.muted,
              margin: '8px 0 0',
            }}>
              Syncing your account…
            </p>
          )}
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={() => router.push('/chat')}
          disabled={syncing}
          style={{
            fontFamily: BODY,
            fontSize: 15,
            fontWeight: 500,
            lineHeight: '22px',
            color: C.white,
            backgroundColor: syncing ? '#A3A3A3' : C.ink,
            border: 'none',
            borderRadius: 8,
            padding: '12px 32px',
            cursor: syncing ? 'default' : 'pointer',
            transition: 'background-color 0.15s',
            width: '100%',
            maxWidth: 320,
          }}
        >
          {syncing ? 'Setting up…' : 'Continue to Dashboard'}
        </button>

        {/* Secondary link */}
        <button
          type="button"
          onClick={() => router.push('/settings/billing')}
          style={{
            fontFamily: BODY,
            fontSize: 13,
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
      </div>
    </div>
  )
}
