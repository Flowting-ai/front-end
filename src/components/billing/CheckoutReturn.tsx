'use client'

import React, { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { notifyCreditsUpdated } from '@/hooks/use-credit-status'
import { Button } from '@/components/ui/button'
import { CLEAR_CHECKOUT_COOKIE, checkoutReturnCopy } from '@/lib/billing/checkout-return'
import { CHAT_ROUTE, ORG_PLANS_ROUTE } from '@/lib/routes'

function CheckCircleIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--success-600)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

/**
 * The page Stripe returns to after a successful checkout or top-up. One
 * component for both settings return routes (`/settings/billing/confirmation`
 * and `/settings/plans-and-billing/confirmation`), which Stripe success URLs
 * point at. Onboarding has its own return page (it creates the workspace).
 */
export function CheckoutReturn({ backLabel }: { backLabel: string }) {
  return (
    <Suspense fallback={null}>
      <CheckoutReturnContent backLabel={backLabel} />
    </Suspense>
  )
}

function CheckoutReturnContent({ backLabel }: { backLabel: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { heading, description } = checkoutReturnCopy(searchParams.get('type'), searchParams.get('plan'))

  // Once on arrival: clear the checkout hint cookie and refetch the profile,
  // billing and the org pool (here and in other tabs) so the new plan or
  // credits show everywhere without a reload.
  useEffect(() => {
    document.cookie = CLEAR_CHECKOUT_COOKIE
    notifyCreditsUpdated()
  }, [])

  return (
    <div className="kaya-scrollbar flex h-full w-full items-center justify-center overflow-auto p-8">
      <div role="status" className="flex w-full max-w-[480px] flex-col items-center gap-6 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--green-50)]">
          <CheckCircleIcon />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="m-0 font-[family-name:var(--font-title)] text-[28px] leading-[34px] font-normal text-[var(--neutral-900)]">{heading}</h1>
          <p className="m-0 text-[15px] leading-[22px] text-[var(--neutral-500)]">{description}</p>
        </div>
        <div className="flex w-full max-w-[320px] flex-col gap-3">
          <Button fluid onClick={() => router.push(ORG_PLANS_ROUTE)}>{backLabel}</Button>
          <Button variant="ghost" fluid onClick={() => router.push(CHAT_ROUTE)}>Go to Dashboard</Button>
        </div>
      </div>
    </div>
  )
}
