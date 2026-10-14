'use client'

// Personal plan, usage, top-ups and the Stripe-return confirmation poll. Part of plans-and-billing/page.tsx.

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { type CardBrand } from '@/components/CardBrandLogo'
import { useAuth, useAuthReady } from '@/context/auth-context'
import { useOrg } from '@/context/org-context'
import { useMounted } from '@/hooks/use-mounted'
import {
  Usage,
  TeamsTier,
  openBillingPortal,
  cancelSubscription,
  resumeSubscription,
} from '@/lib/api/stripe'
import { trackBrowserEvent } from '@/lib/analytics/events'
import { billingErrorMessage, pollUntilChanged } from '@/lib/billing/billing-actions'
import { billingInfoQuery, personalBillingFingerprint, usageQuery } from '@/lib/billing/billing-queries'
import { orgScope } from '@/lib/query-keys'
import {
  PERSONAL_SNAP_KEY,
  type PersonalBillingSnapshot,
  isFutureIso,
  isStripeReturn,
  readCache,
  writeCache,
  fmtDate,
} from './billing-primitives'


/** State and actions for PersonalBillingView (moved out of the view unchanged). */
export function usePersonalBillingView() {
  const router = useRouter()
  const { user, refreshUser, isHydrated, jwtToken } = useAuth()
  const portalMounted = useMounted()

  // Lazy-init from the cached snapshot (runs once; SSR-safe) so returning from
  // Stripe paints instantly instead of flashing an empty "No Plan" state.
  const queryClient = useQueryClient()
  const { orgId } = useOrg()
  const billingScope = orgScope(orgId)
  const authed = useAuthReady()
  const billingQ = useQuery(billingInfoQuery(billingScope, authed))
  const usageQ = useQuery(usageQuery(billingScope, authed))
  const billing = billingQ.data ?? null
  const usage = usageQ.data ?? null
  const billingLoaded = billingQ.isFetched
  const [snap]                            = useState<PersonalBillingSnapshot | null>(() => readCache<PersonalBillingSnapshot>(PERSONAL_SNAP_KEY))
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [isCanceling,      setIsCanceling]      = useState(false)
  const [isResuming,       setIsResuming]       = useState(false)
  const [isClaimingTrial,  setIsClaimingTrial]  = useState(false)
  const [openingPortal,    setOpeningPortal]    = useState(false)
  const [confirmState,     setConfirmState]     = useState<'idle' | 'confirming' | 'confirmed' | 'slow'>('idle')

  // Refetches profile, usage and billing; resolves to a billing fingerprint
  // (null if usage failed) so the Stripe return poll can tell when the webhook
  // has applied the purchase. fetchQuery with staleTime 0 also updates the
  // cached data the queries above render.
  const reload = useCallback(async (): Promise<string | null> => {
    const [, nextUsage, nextBilling] = await Promise.all([
      refreshUser(),
      queryClient.fetchQuery({ ...usageQuery(billingScope), staleTime: 0 }).catch(() => null),
      queryClient.fetchQuery({ ...billingInfoQuery(billingScope), staleTime: 0 }).catch(() => null),
    ])
    return personalBillingFingerprint(nextUsage, nextBilling)
  }, [refreshUser, queryClient, billingScope])

  // Returning from Stripe: the webhook may lag, so poll with backoff until the
  // plan/credits change (or ~45 s pass) and show a "confirming" state meanwhile.
  useEffect(() => {
    if (!isHydrated || !jwtToken || !isStripeReturn()) return
    const controller = new AbortController()
    void (async () => {
      const initial = await reload().catch(() => null)
      if (controller.signal.aborted) return
      setConfirmState('confirming')
      const outcome = await pollUntilChanged({ initial: initial ?? '', check: reload, signal: controller.signal })
      if (outcome === 'aborted') return
      setConfirmState(outcome === 'changed' ? 'confirmed' : 'slow')
      if (outcome === 'changed') trackBrowserEvent('checkout_confirmed', { source: 'settings' })
    })()
    return () => controller.abort()
  }, [isHydrated, jwtToken, reload])

  // Usage and billing refetch on focus through React Query, and on any balance
  // change through notifyCreditsUpdated → invalidateCredits. The profile is not
  // a query yet, so refresh it on focus here.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') void refreshUser() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [refreshUser])

  const liveReady = isHydrated && !!user && billingLoaded && usage !== null
  const nextBillingRaw = billing?.upcomingInvoice?.nextPaymentDate ?? user?.nextBillingDate ?? billing?.plan?.cycleEnd?.toISOString() ?? null
  const nextBillingLive = isFutureIso(nextBillingRaw) ? fmtDate(nextBillingRaw) : '—'

  const liveSnap: PersonalBillingSnapshot | null = liveReady && usage
    ? {
        planType:         billing?.plan?.planId ?? null,
        creditsTotal:     usage.totalCredits,
        creditsRemaining: usage.remainingCredits,
        creditsUsed:      usage.ownSpendCredits,
        chatCredits:      usage.byCategory.chatCredits,
        slackCredits:     usage.byCategory.slackCredits,
        automationCredits: usage.byCategory.automationCredits,
        nextBilling:      nextBillingLive,
        periodEnd:        billing?.plan?.cycleEnd?.toISOString() ?? user?.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: billing?.plan?.cancelAtPeriodEnd ?? false,
      }
    : null

  useEffect(() => {
    if (liveSnap) writeCache(PERSONAL_SNAP_KEY, liveSnap)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveReady, user, billing])

  const display = liveSnap ?? snap
  const showSkeleton = !portalMounted || !display

  const planType         = display?.planType ?? null
  const creditsTotal     = display?.creditsTotal     ?? 0
  const creditsRemaining = display?.creditsRemaining ?? 0
  const creditsUsed      = display?.creditsUsed      ?? 0
  const teamsTier        = TeamsTier.fromPlanId(planType) ?? TeamsTier.fromCredits(creditsTotal)
  const isTrialUser      = Boolean(usage?.isTrial || (!planType && creditsTotal > 0 && !teamsTier))
  const planName         = teamsTier ? `Teams · $${teamsTier.price}` : (isTrialUser ? 'Trial' : null)
  const planPrice        = teamsTier?.price ?? 0
  const planFeatures     = teamsTier ? ['Shared workspace', 'Chat, Slack, and Automations', 'Admin billing'] : []
  const hasActiveSub     = Boolean(teamsTier)
  const hasPlan          = hasActiveSub || isTrialUser
  const chatCredits      = display?.chatCredits    ?? 0
  const slackCredits     = display?.slackCredits   ?? 0
  const automationCredits = display?.automationCredits ?? 0
  const nextBilling      = display?.nextBilling    ?? '—'
  const periodEnd        = display?.periodEnd      ?? null
  const cancelAtPeriodEnd = display?.cancelAtPeriodEnd ?? false

  const pm        = billing?.paymentMethod ?? null
  const cardBrand = (pm?.brand ?? 'unknown') as CardBrand
  // Real, issued invoices only — the upcoming invoice (never downloadable)
  // is shown separately as the card's subtitle, not merged into this list.
  const invoices  = billing?.invoices ?? []
  const hasDownloadableInvoice = invoices.some(inv => !!inv.viewUrl)
  const billingPending = !billing && !billingLoaded

  const now          = new Date()
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const resetDate     = nextBilling !== '—' ? nextBilling : fmtDate(nextMonthStart.toISOString())

  const handleStripePortal = async () => {
    if (openingPortal) return
    setOpeningPortal(true)
    try {
      const url = await openBillingPortal()
      trackBrowserEvent('billing_portal_opened', {})
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      toast.error(billingErrorMessage(err, 'Could not open billing portal.'))
    } finally {
      setOpeningPortal(false)
    }
  }

  const handleExportAllInvoices = () => {
    const urls = invoices.map(inv => inv.viewUrl).filter((u): u is string => !!u)
    if (urls.length === 0) { toast.error('No invoices to export.'); return }
    urls.forEach(url => window.open(url, '_blank', 'noopener,noreferrer'))
    toast.success(urls.length === 1 ? 'Opened 1 invoice' : `Opened ${urls.length} invoices`)
  }

  const handleCancelSubscription = async () => {
    if (isCanceling) return
    setIsCanceling(true)
    try {
      await cancelSubscription()
      trackBrowserEvent('subscription_canceled', {})
      setShowCancelDialog(false)
      toast.success(`Plan canceled — access continues until ${fmtDate(periodEnd)}`)
      await reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel subscription')
    } finally {
      setIsCanceling(false)
    }
  }

  const handleResumeSubscription = async () => {
    if (isResuming) return
    setIsResuming(true)
    try {
      await resumeSubscription()
      trackBrowserEvent('subscription_resumed', {})
      toast.success('Subscription resumed successfully')
      await reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to resume subscription')
    } finally {
      setIsResuming(false)
    }
  }

  const handleClaimTrial = async () => {
    if (isClaimingTrial) return
    setIsClaimingTrial(true)
    try {
      await Usage.startTrial()
      trackBrowserEvent('trial_claimed', {})
      toast.success('1,000 free trial credits added to your account.')
      await reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not claim free credits')
    } finally {
      setIsClaimingTrial(false)
    }
  }


  return { router, billing, usage, billingLoaded, showCancelDialog, setShowCancelDialog, isCanceling, isResuming, isClaimingTrial, openingPortal, confirmState, showSkeleton, creditsTotal, creditsRemaining, creditsUsed, isTrialUser, planName, planPrice, planFeatures, hasActiveSub, hasPlan, chatCredits, slackCredits, automationCredits, nextBilling, periodEnd, cancelAtPeriodEnd, pm, cardBrand, invoices, hasDownloadableInvoice, billingPending, resetDate, handleStripePortal, handleExportAllInvoices, handleCancelSubscription, handleResumeSubscription, handleClaimTrial }
}
