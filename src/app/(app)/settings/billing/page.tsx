'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useMounted } from '@/hooks/use-mounted'
import { createPortal } from 'react-dom'
import { useAuth } from '@/context/auth-context'
import {
  cancelSubscription,
  createCheckoutSession,
  createTopUpSession,
  fetchBilling,
  openBillingPortal,
  type BillingInfo,
  type UserPlanType,
} from '@/lib/api/user'
import { Button } from '@/components/Button'
import { toast } from 'sonner'

// ── Design tokens ─────────────────────────────────────────────────────────────
// Kaya design system. Besley (serif) for headings + regular body; Geist for
// medium labels and buttons.
const TITLE = 'var(--font-title)' // Besley
const BODY  = 'var(--font-body)'  // Geist

const C = {
  ink:    'var(--neutral-900)',  // #26211E
  muted:  'var(--neutral-500)',  // #827A74
  border: 'var(--neutral-200)',  // #D1C6BD
  hair:   'var(--neutral-100)',  // #EDE1D7  (dividers / progress track / skeleton)
  white:  'var(--neutral-white)',
  blue:   'var(--blue-600)',     // #0D6EB2  progress fill
} as const

const CARD_RING      = '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)'
const SECTION_SHADOW = '0px 2px 2.8px 0px rgba(82,75,71,0.12)'
const PLAN_GRADIENT  = 'radial-gradient(120% 140% at 5% 95%, #FFFFFF 12%, #E9DFC9 42%, #C7B387 70%, #B59E68 83%, #A28847 95%)'

// ── Plan config ───────────────────────────────────────────────────────────────

const PLAN_PRICES: Record<string, number> = {
  starter: 12,
  pro:     25,
  power:   100,
}

const PLAN_FEATURE_LIST: Record<string, string[]> = {
  starter: ['Standard models', 'Basic routing', '3 agents', '3 workflows'],
  pro:     ['Advanced models', 'Advanced routing', 'Model compare', '25 agents', '10 workflows', 'Cost savings report'],
  power:   ['Advanced models', 'Advanced routing', 'Model compare', 'Unlimited agents', 'Unlimited workflows', 'Advanced analytics'],
}

const PLAN_OPTIONS: { id: UserPlanType; label: string; price: number }[] = [
  { id: 'starter', label: 'Starter', price: 12  },
  { id: 'pro',     label: 'Pro',     price: 25  },
  { id: 'power',   label: 'Power',   price: 100 },
]

const TOP_UP_USD = 10

// sessionStorage keys — last-known snapshot so returning from Stripe paints
// instantly instead of flashing an empty "No Plan" state while data reloads.
const SNAP_KEY = 'kaya:billing:snapshot:v1'
const BILL_KEY = 'kaya:billing:info:v1'

/** Minimal display snapshot persisted across the Stripe round-trip. */
interface BillingSnapshot {
  planType:         UserPlanType | null
  creditsTotal:     number
  creditsRemaining: number
  creditsUsed:      number
  chatCredits:      number
  personaCredits:   number
  nextBilling:      string
  periodEnd:        string | null
  cancelAtPeriodEnd: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return '-'
  }
}

const _fmtAmountCache = new Map<string, Intl.NumberFormat>()
function fmtAmount(value: number, currency = 'usd'): string {
  const key = currency.toUpperCase()
  let fmt = _fmtAmountCache.get(key)
  if (!fmt) {
    // eslint-disable-next-line react-doctor/js-hoist-intl -- lazy-cached by currency key in module-level Map
    fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: key })
    _fmtAmountCache.set(key, fmt)
  }
  return fmt.format(value / 100) // Stripe reports minor units (cents)
}

function fmtNum(n: number | null | undefined): string {
  if (n == null) return '-'
  return n.toLocaleString('en-US')
}

/** True if we appear to have just returned from a Stripe-hosted page. */
function isStripeReturn(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (document.referrer && /stripe\.com/i.test(document.referrer)) return true
    const p = new URLSearchParams(window.location.search)
    return p.has('session_id') || p.has('checkout') || p.has('portal') || p.has('billing') || p.has('success')
  } catch {
    return false
  }
}

function readCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeCache(key: string, value: unknown): void {
  if (typeof window === 'undefined') return
  try { window.sessionStorage.setItem(key, JSON.stringify(value)) } catch { /* quota / private mode */ }
}

// ── Local components ────────────────────────────────────────────────────────

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: '100%', display: 'flex', flexDirection: 'column',
        border: `1px solid ${C.border}`, borderRadius: 16,
        boxShadow: SECTION_SHADOW, overflow: 'hidden', paddingTop: 12, paddingBottom: 12,
      }}
    >
      {children}
    </div>
  )
}

const titleH = (size: number): React.CSSProperties => ({
  fontFamily: TITLE, fontWeight: 400, fontSize: size, lineHeight: '32px', color: C.ink, margin: 0,
})
const medLabel = (size: number): React.CSSProperties => ({
  fontFamily: BODY, fontWeight: 500, fontSize: size, lineHeight: '22px', color: C.ink, margin: 0,
})
const regMuted: React.CSSProperties = {
  fontFamily: TITLE, fontWeight: 400, fontSize: 14, lineHeight: '22px', color: C.muted, margin: 0,
}

function Skel({ w = '100%', h = 14, r = 6 }: { w?: number | string; h?: number; r?: number }) {
  return <div aria-hidden style={{ width: w, height: h, borderRadius: r, backgroundColor: C.hair, flexShrink: 0 }} />
}

function ProgressBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.max(0, (used / total) * 100)) : 0
  return (
    <div style={{ height: 4, width: '100%', borderRadius: 2, backgroundColor: C.hair, overflow: 'hidden', position: 'relative' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, height: 4, width: `${pct}%`, borderRadius: 2, backgroundColor: C.blue }} />
    </div>
  )
}

function UsageRow({ label, used, total, value }: { label: string; used: number; total: number; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, width: '100%' }}>
        <p style={{ ...medLabel(16), flex: '1 0 0', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </p>
        <p style={{ ...regMuted, whiteSpace: 'nowrap' }}>{value}</p>
      </div>
      <ProgressBar used={used} total={total} />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const { user, refreshUser, isHydrated, jwtToken } = useAuth()

  const portalMounted = useMounted()
  // Lazy-init from the cached snapshot (runs once; SSR-safe — readCache returns
  // null on the server). The render is gated on `portalMounted` below so the
  // server HTML and first client paint match before cached data shows.
  const [billing,             setBilling]             = useState<BillingInfo | null>(() => readCache<BillingInfo>(BILL_KEY))
  const [billingLoaded,       setBillingLoaded]       = useState(false)
  const [snap]                                        = useState<BillingSnapshot | null>(() => readCache<BillingSnapshot>(SNAP_KEY))
  const [showChangePlanDialog, setShowChangePlanDialog] = useState(false)
  const [changingToPlan,       setChangingToPlan]       = useState<UserPlanType | null>(null)
  const [isBuyingCredits,      setIsBuyingCredits]      = useState(false)
  const [openingPortal,        setOpeningPortal]        = useState(false)
  const [showCancelDialog,     setShowCancelDialog]     = useState(false)
  const [isCanceling,          setIsCanceling]          = useState(false)

  const didInit = useRef(false)

  // ── Data loading ─────────────────────────────────────────────────────────

  const reload = useCallback(async () => {
    await Promise.all([
      refreshUser(),
      fetchBilling()
        .then((b) => {
          if (b) { setBilling(b); writeCache(BILL_KEY, b) }
        })
        .catch(() => {})
        .finally(() => setBillingLoaded(true)),
    ])
  }, [refreshUser])

  // First real load — only once auth is hydrated and a token is available, so
  // the request actually carries credentials (avoids the empty "No Plan" flash).
  useEffect(() => {
    if (!isHydrated || !jwtToken || didInit.current) return
    didInit.current = true
    void reload()
  }, [isHydrated, jwtToken, reload])

  // Returning from Stripe: the webhook may lag a beat, so re-fetch a few times.
  useEffect(() => {
    if (!isHydrated || !jwtToken || !isStripeReturn()) return
    const timers = [1200, 3000, 6000].map((ms) => window.setTimeout(() => { void reload() }, ms))
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [isHydrated, jwtToken, reload])

  // Keep fresh when the tab regains focus/visibility.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') void reload() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [reload])

  // ── Derived data ──────────────────────────────────────────────────────────

  const liveReady = isHydrated && !!user

  const nextBillingLive = fmtDate(
    billing?.upcoming_invoice?.next_payment_date ?? user?.nextBillingDate ?? user?.currentPeriodEnd,
  )

  // Live snapshot (when the profile is loaded) or fall back to the cached one.
  const liveSnap: BillingSnapshot | null = liveReady
    ? {
        planType:         user?.planType ?? null,
        creditsTotal:     user?.creditsTotal     ?? 0,
        creditsRemaining: user?.creditsRemaining ?? 0,
        creditsUsed:      user?.creditsUsed      ?? 0,
        chatCredits:      Math.round((user?.usage?.by_category?.chat    ?? 0) * 1000),
        personaCredits:   Math.round((user?.usage?.by_category?.persona ?? 0) * 1000),
        nextBilling:      nextBillingLive,
        periodEnd:        billing?.current_period_end ?? user?.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: billing?.cancel_at_period_end ?? user?.cancelAtPeriodEnd ?? false,
      }
    : null

  // Persist the snapshot whenever fresh data is available.
  useEffect(() => {
    if (liveSnap) writeCache(SNAP_KEY, liveSnap)
  }, [liveReady, user, billing]) // eslint-disable-line react-hooks/exhaustive-deps

  const display = liveSnap ?? snap
  // Gate on mount so SSR/first-paint render the skeleton (matching), then cached
  // or live data appears. Never render the misleading "No Plan" empty state
  // until the profile has actually loaded.
  const showSkeleton = !portalMounted || !display

  const planType         = display?.planType ?? null
  const planName         = planType ? planType.charAt(0).toUpperCase() + planType.slice(1) : 'No'
  const planPrice        = planType ? (PLAN_PRICES[planType] ?? 0) : 0
  const planFeatures     = planType ? (PLAN_FEATURE_LIST[planType] ?? []) : []
  const creditsTotal     = display?.creditsTotal     ?? 0
  const creditsRemaining = display?.creditsRemaining ?? 0
  const creditsUsed      = display?.creditsUsed      ?? 0
  const chatCredits      = display?.chatCredits      ?? 0
  const personaCredits   = display?.personaCredits   ?? 0
  const nextBilling      = display?.nextBilling      ?? '-'
  const periodEnd        = display?.periodEnd        ?? null
  const cancelAtPeriodEnd = display?.cancelAtPeriodEnd ?? false
  const hasActiveSub      = Boolean(planType)

  const pm        = billing?.payment_method ?? null
  const invoices  = billing?.invoices ?? []
  // Payment / invoice cards: cached billing paints instantly; show skeleton only
  // when we have nothing cached and the first fetch hasn't returned yet.
  const billingPending = !billing && !billingLoaded

  const now            = new Date()
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const resetDate      = nextBilling !== '-' ? nextBilling : fmtDate(nextMonthStart.toISOString())

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleBuyCredits = async () => {
    setIsBuyingCredits(true)
    try {
      const session = await createTopUpSession(TOP_UP_USD)
      window.location.href = session.checkout_url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start credit purchase')
      setIsBuyingCredits(false)
    }
  }

  const handleChangePlan = async (targetPlan: UserPlanType) => {
    if (targetPlan === planType || changingToPlan) return
    setChangingToPlan(targetPlan)
    try {
      const checkout = await createCheckoutSession(targetPlan, 'monthly', { checkoutFlow: 'settings_change_plan' })
      window.location.href = checkout.checkout_url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update plan')
      setChangingToPlan(null)
    }
  }

  const handleOpenPortal = async () => {
    if (openingPortal) return
    setOpeningPortal(true)
    try {
      const url = await openBillingPortal()
      if (url) window.location.href = url
      else toast.error('Could not open the billing portal')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not open the billing portal')
    } finally {
      setOpeningPortal(false)
    }
  }

  const handleCancelSubscription = async () => {
    setIsCanceling(true)
    try {
      await cancelSubscription()
      setShowCancelDialog(false)
      toast.success(`Plan canceled — access continues until ${fmtDate(periodEnd)}`)
      await reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel subscription')
    } finally {
      setIsCanceling(false)
    }
  }

  // ── Dialogs ─────────────────────────────────────────────────────────────────

  const dialogCardStyle: React.CSSProperties = {
    backgroundColor: C.white, borderRadius: 16, padding: 24, width: 400, maxWidth: 'calc(100vw - 32px)',
    boxShadow: '0px 8px 32px 0px rgba(82,75,71,0.18), 0px 0px 0px 1px var(--neutral-100)',
    display: 'flex', flexDirection: 'column', gap: 20,
  }
  const backdropStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 9998, backgroundColor: 'rgba(0,0,0,0.28)',
    backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  }

  const changePlanDialog = portalMounted && showChangePlanDialog
    ? createPortal(
        // eslint-disable-next-line click-events-have-key-events, no-static-element-interactions -- interactive div; keyboard handling delegated to inner elements
        <div style={backdropStyle} onClick={() => { if (!changingToPlan) setShowChangePlanDialog(false) }}>
          {/* eslint-disable-next-line click-events-have-key-events, no-static-element-interactions -- interactive div; keyboard handling delegated to inner elements */}
          <div style={dialogCardStyle} onClick={e => e.stopPropagation()}>
            <div>
              <p style={{ fontFamily: BODY, fontWeight: 600, fontSize: 16, lineHeight: '24px', color: C.ink, margin: 0 }}>Change plan</p>
              <p style={{ ...regMuted, margin: '8px 0 0' }}>You will be redirected to Stripe to complete the change.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {PLAN_OPTIONS.map(plan => {
                const isCurrent = planType === plan.id
                const isLoading = changingToPlan === plan.id
                return (
                  <button
                    key={plan.id}
                    disabled={isCurrent || changingToPlan !== null}
                    onClick={() => { void handleChangePlan(plan.id) }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', borderRadius: 10,
                      border: isCurrent ? `1.5px solid ${C.ink}` : `1px solid ${C.border}`,
                      backgroundColor: isCurrent ? 'var(--neutral-50)' : C.white,
                      cursor: isCurrent || changingToPlan !== null ? 'default' : 'pointer',
                      opacity: changingToPlan !== null && !isLoading ? 0.5 : 1, textAlign: 'left',
                    }}
                  >
                    <div>
                      <p style={{ ...medLabel(14) }}>{plan.label}</p>
                      <p style={{ ...regMuted, fontSize: 13, lineHeight: '20px' }}>${plan.price}/mo</p>
                    </div>
                    {isCurrent && !isLoading && <span style={{ fontFamily: BODY, fontWeight: 500, fontSize: 12, color: C.muted }}>Current</span>}
                    {isLoading && <span style={{ fontFamily: BODY, fontWeight: 400, fontSize: 12, color: C.muted }}>Redirecting…</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>,
        document.body,
      )
    : null

  const cancelDialog = portalMounted && showCancelDialog
    ? createPortal(
        // eslint-disable-next-line click-events-have-key-events, no-static-element-interactions -- interactive div; keyboard handling delegated to inner elements
        <div style={backdropStyle} onClick={() => { if (!isCanceling) setShowCancelDialog(false) }}>
          {/* eslint-disable-next-line click-events-have-key-events, no-static-element-interactions -- interactive div; keyboard handling delegated to inner elements */}
          <div style={dialogCardStyle} onClick={e => e.stopPropagation()}>
            <div>
              <p style={{ fontFamily: BODY, fontWeight: 600, fontSize: 16, lineHeight: '24px', color: C.ink, margin: 0 }}>Cancel subscription?</p>
              <p style={{ ...regMuted, margin: '8px 0 0' }}>
                Your plan stays active until <strong style={{ color: C.ink }}>{fmtDate(periodEnd)}</strong>. After that you lose access to paid features.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button variant="secondary" size="sm" disabled={isCanceling} onClick={() => setShowCancelDialog(false)}>
                Keep plan
              </Button>
              <Button variant="danger" size="sm" loading={isCanceling} onClick={() => { void handleCancelSubscription() }}>
                Yes, cancel
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {changePlanDialog}
      {cancelDialog}

      <div
        className="kaya-scrollbar"
        style={{
          flex: '1 0 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden',
          display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '96px 155px 48px',
        }}
      >
        <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* ── Page header (static) ── */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ paddingLeft: 4 }}>
              <h1 style={{ ...titleH(24), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Usage &amp; Billing
              </h1>
            </div>
            <div style={{ padding: '4px 6px' }}>
              <p style={{ fontFamily: BODY, fontWeight: 500, fontSize: 14, lineHeight: '22px', color: C.muted, margin: 0 }}>
                Manage your plan, monitor credit consumption, and download invoices.
              </p>
            </div>
          </div>

          {showSkeleton ? (
            /* ── Loading skeleton (never the misleading "No Plan" state) ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} aria-busy>
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12, border: `1px solid ${C.border}`, borderRadius: 16, padding: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 24, borderRadius: 8, background: PLAN_GRADIENT, boxShadow: CARD_RING }}>
                  <Skel w={140} h={28} />
                  <Skel w={260} h={18} />
                  <Skel w="70%" h={16} />
                  <div style={{ paddingTop: 12 }}><Skel w={120} h={34} r={10} /></div>
                </div>
                <div style={{ display: 'flex', gap: 9 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 8, backgroundColor: C.white, boxShadow: CARD_RING }}>
                      <Skel w={100} h={14} /><Skel w={80} h={26} /><Skel w={120} h={12} />
                    </div>
                  ))}
                </div>
              </div>
              {[0, 1].map(i => (
                <SectionCard key={i}>
                  <div style={{ padding: '12px 24px 24px', borderBottom: `1px solid ${C.hair}` }}><Skel w={160} h={18} /></div>
                  <div style={{ padding: '12px 24px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <Skel w="100%" h={12} /><Skel w="100%" h={12} />
                  </div>
                </SectionCard>
              ))}
            </div>
          ) : (
          <>
            {/* ── Plan card ── */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12, border: `1px solid ${C.border}`, borderRadius: 16, padding: 12 }}>
              {/* Gradient banner */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 24, borderRadius: 8, background: PLAN_GRADIENT, boxShadow: CARD_RING }}>
                <p style={titleH(24)}>{planName} Plan</p>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <p style={medLabel(14)}>{nextBilling !== '-' ? `Next billing: ${nextBilling}` : 'No upcoming billing'}</p>
                  {planPrice > 0 && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', padding: '2px 4px', borderRadius: 6,
                      backgroundColor: 'var(--blue-100)',
                      boxShadow: '0px 1px 1.5px 0px rgba(2,15,24,0.2), 0px 0px 0px 1px rgba(13,110,178,0.5)',
                      fontFamily: BODY, fontWeight: 500, fontSize: 11, lineHeight: '16px', color: 'var(--blue-700)', whiteSpace: 'nowrap',
                    }}>
                      {planPrice}$/month
                    </span>
                  )}
                </div>

                {planFeatures.length > 0 && (
                  <p style={{ fontFamily: TITLE, fontWeight: 400, fontSize: 14, lineHeight: '22px', color: C.ink, margin: 0 }}>
                    {planFeatures.join(' · ')}
                  </p>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 12 }}>
                  <Button variant="default" size="md" onClick={() => setShowChangePlanDialog(true)}>
                    Change Plan
                  </Button>
                  {hasActiveSub && !cancelAtPeriodEnd && (
                    <button
                      onClick={() => setShowCancelDialog(true)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        padding: '6px 10px 8px', borderRadius: 10, cursor: 'pointer',
                        backgroundColor: C.white, border: 'none',
                        boxShadow: '0px 1.091px 1.091px 0px rgba(24,2,2,0.05), 0px 1.455px 3.127px 0px rgba(24,2,2,0.15), 0px 0px 0px 1px var(--red-100), inset 0px -2.182px 0.364px 0px var(--red-100)',
                        fontFamily: BODY, fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--red-700)', whiteSpace: 'nowrap',
                      }}
                    >
                      Cancel Plan
                    </button>
                  )}
                  {cancelAtPeriodEnd && (
                    <span style={{ fontFamily: TITLE, fontWeight: 400, fontSize: 14, lineHeight: '22px', color: C.ink }}>
                      Cancels on {fmtDate(periodEnd)}
                    </span>
                  )}
                </div>
              </div>

              {/* Stat cards */}
              <div style={{ display: 'flex', gap: 9, alignItems: 'stretch' }}>
                <div style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6, padding: 12, borderRadius: 8, backgroundColor: C.white, boxShadow: CARD_RING }}>
                  <p style={medLabel(14)}>Monthly Credits</p>
                  <p style={titleH(24)}>{fmtNum(creditsTotal)}</p>
                  <p style={regMuted}>Resets {resetDate}</p>
                </div>
                <div style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6, padding: 12, borderRadius: 8, backgroundColor: C.white, boxShadow: CARD_RING }}>
                  <p style={medLabel(14)}>Credits Remaining</p>
                  <p style={titleH(24)}>{fmtNum(creditsRemaining)}</p>
                  <p style={regMuted}>{fmtNum(creditsUsed)} used this month</p>
                </div>
                <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12, padding: 12, borderRadius: 8, backgroundColor: C.white, boxShadow: CARD_RING }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <p style={medLabel(14)}>Need more credits ?</p>
                    <p style={regMuted}>Top-up packs. Unused credits roll 1 billing cycle.</p>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button variant="secondary" size="md" loading={isBuyingCredits} onClick={() => { void handleBuyCredits() }}>
                      Buy more Credits
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* ── This month's usage ── */}
            <SectionCard>
              <div style={{ display: 'flex', alignItems: 'center', padding: '12px 24px 24px', borderBottom: `1px solid ${C.hair}` }}>
                <p style={{ ...medLabel(16), flex: '1 0 0', minWidth: 0 }}>This month&apos;s usage</p>
                <p style={{ ...regMuted, whiteSpace: 'nowrap' }}>Resets {resetDate}</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '12px 24px 24px' }}>
                <p style={{ fontFamily: TITLE, fontWeight: 400, fontSize: 16, lineHeight: '22px', color: C.ink, margin: 0 }}>
                  Monthly Limits
                </p>
                <UsageRow label="Chat Board"    used={chatCredits}    total={creditsTotal} value={`${fmtNum(chatCredits)}/${fmtNum(creditsTotal)}`} />
                <UsageRow label="AI Assistants" used={personaCredits} total={creditsTotal} value={`${fmtNum(personaCredits)}/${fmtNum(creditsTotal)}`} />
              </div>
            </SectionCard>

            {/* ── Payment ── */}
            <SectionCard>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 24px 24px', borderBottom: `1px solid ${C.hair}` }}>
                <p style={medLabel(16)}>Payment</p>
                <p style={regMuted}>Manage your billing details.</p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 24px' }}>
                <div style={{
                  width: 46, height: 32, borderRadius: 6, flexShrink: 0,
                  backgroundColor: 'var(--neutral-50)', border: `1px solid ${C.hair}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: 10, letterSpacing: '0.02em', textTransform: 'uppercase', color: C.muted }}>
                    {pm?.brand ? pm.brand.slice(0, 4) : 'Card'}
                  </span>
                </div>
                <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: billingPending ? 6 : 0 }}>
                  {billingPending ? (
                    <><Skel w={180} h={16} /><Skel w={120} h={12} /></>
                  ) : pm && pm.last4 ? (
                    <>
                      <p style={medLabel(16)}>
                        {pm.brand ? pm.brand.charAt(0).toUpperCase() + pm.brand.slice(1) : 'Card'} ending in {pm.last4}
                      </p>
                      <p style={regMuted}>
                        {pm.exp_month && pm.exp_year ? `Expiry ${String(pm.exp_month).padStart(2, '0')}/${pm.exp_year}` : 'No expiry on file'}
                      </p>
                    </>
                  ) : (
                    <p style={medLabel(16)}>No payment method on file</p>
                  )}
                </div>
                <Button variant="secondary" size="md" loading={openingPortal} onClick={() => { void handleOpenPortal() }}>
                  Manage on Stripe
                </Button>
              </div>
            </SectionCard>

            {/* ── Invoice history ── */}
            <SectionCard>
              <div style={{ display: 'flex', alignItems: 'center', padding: '12px 24px 24px', borderBottom: `1px solid ${C.hair}` }}>
                <p style={{ ...medLabel(16), flex: '1 0 0', minWidth: 0 }}>Invoice history</p>
                <Button variant="secondary" size="md" loading={openingPortal} onClick={() => { void handleOpenPortal() }}>
                  Export all
                </Button>
              </div>

              <div style={{ padding: '0 24px 12px' }}>
                <div style={{ borderRadius: 8, backgroundColor: C.white, boxShadow: CARD_RING, padding: 12 }}>
                  {/* Table header */}
                  <div style={{ display: 'flex', gap: 24, alignItems: 'center', padding: '0 12px 12px', borderBottom: `1px solid ${C.hair}` }}>
                    <span style={{ ...regMuted, color: C.ink, flex: '1 0 0', minWidth: 0 }}>Date</span>
                    <span style={{ ...regMuted, color: C.ink, flex: '1 0 0', minWidth: 0 }}>Amount</span>
                    <span style={{ ...regMuted, color: C.ink, flex: '1 0 0', minWidth: 0 }}>Status</span>
                    <span style={{ ...regMuted, color: C.ink, width: 200, textAlign: 'center' }}>Actions</span>
                  </div>

                  {billingPending ? (
                    [0, 1, 2].map(i => (
                      <div key={i} style={{ display: 'flex', gap: 24, alignItems: 'center', padding: 12, borderBottom: i < 2 ? `1px solid ${C.hair}` : 'none' }}>
                        <span style={{ flex: '1 0 0', minWidth: 0 }}><Skel w={90} h={14} /></span>
                        <span style={{ flex: '1 0 0', minWidth: 0 }}><Skel w={60} h={14} /></span>
                        <span style={{ flex: '1 0 0', minWidth: 0 }}><Skel w={44} h={16} /></span>
                        <span style={{ width: 200, display: 'flex', justifyContent: 'center' }}><Skel w={40} h={14} /></span>
                      </div>
                    ))
                  ) : invoices.length === 0 ? (
                    <div style={{ padding: '16px 12px' }}>
                      <p style={regMuted}>No invoices yet.</p>
                    </div>
                  ) : (
                    invoices.slice(0, 10).map((inv, i) => {
                      const isPaid = inv.status === 'paid'
                      const href = inv.invoice_pdf || inv.invoice_url
                      const isLast = i === Math.min(invoices.length, 10) - 1
                      return (
                        <div
                          key={`${inv.created ?? 'inv'}-${i}`}
                          style={{ display: 'flex', gap: 24, alignItems: 'center', padding: 12, borderBottom: isLast ? 'none' : `1px solid ${C.hair}` }}
                        >
                          <span style={{ ...medLabel(14), flex: '1 0 0', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {fmtDate(inv.created)}
                          </span>
                          <span style={{ ...medLabel(14), flex: '1 0 0', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {fmtAmount(inv.amount_paid, inv.currency)}
                          </span>
                          <span style={{ flex: '1 0 0', minWidth: 0 }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', padding: '2px 4px', borderRadius: 6,
                              backgroundColor: isPaid ? 'var(--green-50)' : 'var(--neutral-50)',
                              boxShadow: isPaid
                                ? '0px 1px 1.5px 0px rgba(17,25,1,0.2), 0px 0px 0px 1px rgba(128,183,7,0.5)'
                                : `0px 0px 0px 1px ${C.hair}`,
                              fontFamily: BODY, fontWeight: 500, fontSize: 11, lineHeight: '16px',
                              color: isPaid ? 'var(--green-800)' : C.muted, whiteSpace: 'nowrap', textTransform: 'capitalize',
                            }}>
                              {inv.status ?? 'unknown'}
                            </span>
                          </span>
                          <span style={{ width: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {href ? (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  fontFamily: BODY, fontWeight: 500, fontSize: 14, lineHeight: '22px',
                                  color: 'var(--neutral-700)', textDecoration: 'underline', textUnderlineOffset: 2, padding: '6px 10px',
                                }}
                              >
                                View
                              </a>
                            ) : (
                              <span style={regMuted}>—</span>
                            )}
                          </span>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </SectionCard>
          </>
          )}

        </div>
      </div>
    </>
  )
}
