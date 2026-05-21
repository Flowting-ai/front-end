'use client'

import React, { useState } from 'react'
import { useMounted } from '@/hooks/use-mounted'
import { createPortal } from 'react-dom'
import { useAuth } from '@/context/auth-context'
import {
  createCheckoutSession,
  cancelSubscription,
  type UserPlanType,
} from '@/lib/api/user'
import { Button } from '@/components/Button'
import { toast } from 'sonner'

// ── Plan config ───────────────────────────────────────────────────────────────

const PLAN_PRICES: Record<string, number> = {
  starter: 12,
  pro:     25,
  power:   100,
}

const PLAN_FEATURE_LIST: Record<string, string[]> = {
  starter: [
    '5,000 monthly credits',
    '3 personas',
    'Basic AI models',
    'Standard support',
  ],
  pro: [
    '12,000 monthly credits',
    'Unlimited personas',
    'Advanced AI models',
    'Priority support',
  ],
  power: [
    '60,000 monthly credits',
    'Unlimited personas',
    'Advanced AI models',
    'Priority support',
    'Advanced analytics',
  ],
}

const PLAN_OPTIONS: { id: UserPlanType; label: string; price: number }[] = [
  { id: 'starter', label: 'Starter', price: 12  },
  { id: 'pro',     label: 'Pro',     price: 25  },
  { id: 'power',   label: 'Power',   price: 100 },
]

// ── Local helpers ─────────────────────────────────────────────────────────────

function SettingsCard({
  children,
  danger,
}: {
  children: React.ReactNode
  danger?: boolean
}) {
  return (
    <div
      style={{
        border:        `1px solid ${danger ? 'var(--red-400)' : 'var(--neutral-200)'}`,
        borderRadius:  16,
        boxShadow:     '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
        display:       'flex',
        flexDirection: 'column',
        overflow:      'hidden',
        paddingTop:    12,
        paddingBottom: 12,
      }}
    >
      {children}
    </div>
  )
}

function CardSection({
  children,
  divider,
  padTop = 12,
  padBottom = 24,
}: {
  children: React.ReactNode
  divider?: boolean
  padTop?: number
  padBottom?: number
}) {
  return (
    <div
      style={{
        display:       'flex',
        flexDirection: 'column',
        padding:       `${padTop}px 24px ${padBottom}px`,
        borderBottom:  divider ? '1px solid var(--neutral-100)' : undefined,
      }}
    >
      {children}
    </div>
  )
}

function ProgressBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0
  return (
    <div
      style={{
        height:          4,
        borderRadius:    99,
        backgroundColor: 'var(--neutral-100)',
        overflow:        'hidden',
        position:        'relative',
      }}
    >
      <div
        style={{
          position:        'absolute',
          top:             0,
          left:            0,
          height:          '100%',
          width:           `${pct}%`,
          borderRadius:    'inherit',
          backgroundColor: 'var(--blue-600)',
        }}
      />
    </div>
  )
}

function BlueBadge({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        padding:         '1px 8px',
        borderRadius:    99,
        backgroundColor: 'var(--blue-100)',
        border:          '1px solid var(--blue-200)',
        fontFamily:      'var(--font-body)',
        fontWeight:      500,
        fontSize: 12,
        lineHeight:      '18px',
        color:           'var(--blue-700)',
        whiteSpace:      'nowrap',
      }}
    >
      {children}
    </span>
  )
}

function GreenBadge({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        padding:         '1px 8px',
        borderRadius:    99,
        backgroundColor: 'var(--green-50)',
        border:          '1px solid var(--green-200)',
        fontFamily:      'var(--font-body)',
        fontWeight:      500,
        fontSize: 12,
        lineHeight:      '18px',
        color:           'var(--green-800)',
        whiteSpace:      'nowrap',
      }}
    >
      {children}
    </span>
  )
}

function StatBox({
  label,
  value,
  action,
}: {
  label:   string
  value:   string
  action?: React.ReactNode
}) {
  return (
    <div
      style={{
        flex:            '1 0 0',
        minWidth:        0,
        display:         'flex',
        flexDirection:   'column',
        gap:             4,
        padding:         '16px 20px',
        borderRadius:    12,
        border:          '1px solid var(--neutral-200)',
        backgroundColor: 'var(--neutral-white)',
        boxShadow:       '0px 1px 2px 0px rgba(82,75,71,0.08)',
      }}
    >
      <p style={{
        fontFamily: 'var(--font-body)',
        fontWeight: 400,
        fontSize:   13,
        lineHeight: '20px',
        color:      'var(--neutral-500)',
        margin:     0,
      }}>
        {label}
      </p>
      <p style={{
        fontFamily: 'var(--font-title)',
        fontWeight: 400,
        fontSize:   28,
        lineHeight: '36px',
        color:      'var(--neutral-900)',
        margin:     0,
      }}>
        {value}
      </p>
      {action}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day:   'numeric',
      year:  'numeric',
    })
  } catch {
    return '-'
  }
}

const _fmtAmountCache = new Map<string, Intl.NumberFormat>()
function fmtAmount(cents: number, currency = 'usd'): string {
  const key = currency.toUpperCase()
  let fmt = _fmtAmountCache.get(key)
  if (!fmt) {
    // eslint-disable-next-line react-doctor/js-hoist-intl -- lazy-cached by currency key in module-level Map
    fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: key })
    _fmtAmountCache.set(key, fmt)
  }
  return fmt.format(cents / 100)
}

function fmtNum(n: number | null | undefined): string {
  if (n == null) return '-'
  return n.toLocaleString('en-US')
}

// ── Dialog styles ─────────────────────────────────────────────────────────────

const dialogCardStyle: React.CSSProperties = {
  backgroundColor: 'var(--neutral-white)',
  borderRadius:    16,
  padding:         '24px',
  width:           400,
  maxWidth:        'calc(100vw - 32px)',
  boxShadow:       '0px 8px 32px 0px rgba(82,75,71,0.18), 0px 0px 0px 1px var(--neutral-100)',
  display:         'flex',
  flexDirection:   'column',
  gap:             20,
}

const ghostButtonStyle: React.CSSProperties = {
  padding:         '8px 16px',
  borderRadius:    10,
  border:          'none',
  backgroundColor: 'transparent',
  boxShadow:       '0px 0px 0px 1px rgba(59,54,50,0.2)',
  fontFamily:      'var(--font-body)',
  fontWeight:      500,
  fontSize:        14,
  lineHeight:      '22px',
  color:           'var(--neutral-700)',
  cursor:          'pointer',
}

const destructiveButtonStyle: React.CSSProperties = {
  padding:         '8px 16px',
  borderRadius:    10,
  border:          'none',
  backgroundColor: 'var(--red-500)',
  fontFamily:      'var(--font-body)',
  fontWeight:      500,
  fontSize:        14,
  lineHeight:      '22px',
  color:           'var(--neutral-white)',
  cursor:          'pointer',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const { user, refreshUser } = useAuth()

  const portalMounted = useMounted()
  const [showCancelDialog,     setShowCancelDialog]     = useState(false)
  const [isCanceling,          setIsCanceling]          = useState(false)
  const [showChangePlanDialog, setShowChangePlanDialog] = useState(false)
  const [changingToPlan,       setChangingToPlan]       = useState<UserPlanType | null>(null)

  // ── Derived data ──────────────────────────────────────────────────────────

  const planType          = user?.planType ?? null
  const planName          = planType
    ? planType.charAt(0).toUpperCase() + planType.slice(1)
    : 'No Plan'
  const planPrice         = planType ? (PLAN_PRICES[planType] ?? 0) : 0
  const planFeatures      = planType ? (PLAN_FEATURE_LIST[planType] ?? []) : []
  const nextBilling       = fmtDate(user?.nextBillingDate ?? user?.currentPeriodEnd)
  const creditsTotal      = user?.creditsTotal      ?? 0
  const creditsRemaining  = user?.creditsRemaining  ?? 0
  const creditsUsed       = user?.creditsUsed       ?? 0
  const invoices          = (user?.invoices ?? []).toSorted(
    (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime(),
  )
  const pm                = user?.defaultPaymentMethod ?? null
  const billingPortalUrl  = user?.billingPortalUrl  ?? '#'
  const usage             = user?.usage             ?? null
  const cancelAtPeriodEnd = user?.cancelAtPeriodEnd ?? false
  const subscriptionStatus = user?.subscriptionStatus ?? null
  const hasActiveSub      = Boolean(planType) && subscriptionStatus === 'active'

  // Category usage — API units → credits (multiply by 1000)
  const chatCredits    = Math.round((usage?.by_category?.chat    ?? 0) * 1000)
  const personaCredits = Math.round((usage?.by_category?.persona ?? 0) * 1000)

  // Reset date: prefer next billing date, fall back to 1st of next month
  const now            = new Date()
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const resetDate      = nextBilling !== '-'
    ? nextBilling
    : fmtDate(nextMonthStart.toISOString())

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleCancelSubscription = async () => {
    setIsCanceling(true)
    try {
      await cancelSubscription()
      setShowCancelDialog(false)
      toast.success(
        `Plan canceled — access continues until ${fmtDate(user?.currentPeriodEnd ?? null)}`
      )
      await refreshUser()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel subscription')
    } finally {
      setIsCanceling(false)
    }
  }

  const handleChangePlan = async (targetPlan: UserPlanType) => {
    if (targetPlan === planType || changingToPlan) return
    setChangingToPlan(targetPlan)
    try {
      const checkout = await createCheckoutSession(targetPlan, 'monthly', {
        checkoutFlow: 'settings_change_plan',
      })
      window.location.href = checkout.checkout_url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update plan')
      setChangingToPlan(null)
    }
  }

  // ── Portaled dialogs ──────────────────────────────────────────────────────

  const backdropStyle: React.CSSProperties = {
    position:        'fixed',
    inset:           0,
    zIndex:          9998,
    backgroundColor: 'rgba(0,0,0,0.28)',
    backdropFilter:  'blur(2px)',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
  }

  const cancelDialog = portalMounted && showCancelDialog
    ? createPortal(
        // eslint-disable-next-line click-events-have-key-events, no-static-element-interactions -- interactive div; keyboard handling delegated to inner elements
        <div style={backdropStyle} onClick={() => { if (!isCanceling) setShowCancelDialog(false) }}>
          {/* eslint-disable-next-line click-events-have-key-events, no-static-element-interactions -- interactive div; keyboard handling delegated to inner elements */}
          <div style={dialogCardStyle} onClick={e => e.stopPropagation()}>
            <div>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 16, lineHeight: '24px', color: 'var(--neutral-900)', margin: 0 }}>
                Cancel subscription?
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: '8px 0 0' }}>
                Your plan will stay active until{' '}
                <strong style={{ color: 'var(--neutral-900)' }}>
                  {fmtDate(user?.currentPeriodEnd ?? null)}
                </strong>
                . After that, you will lose access to paid features.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                style={{ ...ghostButtonStyle, opacity: isCanceling ? 0.5 : 1, cursor: isCanceling ? 'not-allowed' : 'pointer' }}
                disabled={isCanceling}
                onClick={() => setShowCancelDialog(false)}
              >
                Keep plan
              </button>
              <button
                style={{ ...destructiveButtonStyle, opacity: isCanceling ? 0.7 : 1, cursor: isCanceling ? 'not-allowed' : 'pointer' }}
                disabled={isCanceling}
                onClick={() => { void handleCancelSubscription() }}
              >
                {isCanceling ? 'Canceling…' : 'Yes, cancel'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null

  const changePlanDialog = portalMounted && showChangePlanDialog
    ? createPortal(
        // eslint-disable-next-line click-events-have-key-events, no-static-element-interactions -- interactive div; keyboard handling delegated to inner elements
        <div
          style={backdropStyle}
          onClick={() => { if (!changingToPlan) setShowChangePlanDialog(false) }}
        >
          {/* eslint-disable-next-line click-events-have-key-events, no-static-element-interactions -- interactive div; keyboard handling delegated to inner elements */}
          <div style={dialogCardStyle} onClick={e => e.stopPropagation()}>
            <div>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 16, lineHeight: '24px', color: 'var(--neutral-900)', margin: 0 }}>
                Change plan
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: '8px 0 0' }}>
                You will be redirected to Stripe to complete the change.
              </p>
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
                      display:         'flex',
                      alignItems:      'center',
                      justifyContent:  'space-between',
                      padding:         '12px 16px',
                      borderRadius:    10,
                      border:          isCurrent
                        ? '1.5px solid var(--neutral-900)'
                        : '1px solid var(--neutral-200)',
                      backgroundColor: isCurrent ? 'var(--neutral-50)' : 'var(--neutral-white)',
                      cursor:          isCurrent || changingToPlan !== null ? 'default' : 'pointer',
                      opacity:         changingToPlan !== null && !isLoading ? 0.5 : 1,
                      textAlign:       'left',
                    }}
                  >
                    <div>
                      <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
                        {plan.label}
                      </p>
                      <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-500)', margin: 0 }}>
                        ${plan.price}/mo
                      </p>
                    </div>
                    {isCurrent && !isLoading && (
                      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12, color: 'var(--neutral-400)' }}>
                        Current
                      </span>
                    )}
                    {isLoading && (
                      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, color: 'var(--neutral-500)' }}>
                        Redirecting…
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>,
        document.body,
      )
    : null

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {cancelDialog}
      {changePlanDialog}

      <div
        className="kaya-scrollbar"
        style={{
          flex:           '1 0 0',
          minHeight:      0,
          overflowY:      'auto',
          overflowX:      'hidden',
          display:        'flex',
          alignItems:     'flex-start',
          justifyContent: 'center',
          padding:        '96px 155px 48px',
        }}
      >
        <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* ── Page header ── */}
          <div style={{ paddingLeft: 4, marginBottom: 4 }}>
            <h1 style={{
              fontFamily:   'var(--font-title)',
              fontWeight:   400,
              fontSize:     24,
              lineHeight:   '32px',
              color:        'var(--neutral-900)',
              margin:       0,
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}>
              Usage &amp; Billing
            </h1>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              fontSize:   14,
              lineHeight: '22px',
              color:      'var(--neutral-500)',
              margin:     0,
            }}>
              Manage your plan, credits, payment method, and invoices.
            </p>
          </div>

          {/* ── Plan card ── */}
          <div
            style={{
              borderRadius:  16,
              overflow:      'hidden',
              boxShadow:     '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
              position:      'relative',
              padding:       '24px',
              background:    'radial-gradient(118% 141% at 0% 100%, #F7C948 0%, #E8882E 32%, #C4551A 62%, #7B2D10 100%)',
              display:       'flex',
              flexDirection: 'column',
              gap:           16,
            }}
          >
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <p style={{
                  fontFamily:    'var(--font-body)',
                  fontWeight:    500,
                  fontSize:      12,
                  lineHeight:    '18px',
                  color:         'rgba(255,255,255,0.7)',
                  margin:        0,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}>
                  Current Plan
                </p>
                <h2 style={{
                  fontFamily: 'var(--font-title)',
                  fontWeight: 400,
                  fontSize:   28,
                  lineHeight: '36px',
                  color:      'var(--neutral-white)',
                  margin:     0,
                }}>
                  {planName}
                </h2>
                {nextBilling !== '-' && (
                  <p style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 400,
                    fontSize:   13,
                    lineHeight: '20px',
                    color:      'rgba(255,255,255,0.75)',
                    margin:     0,
                  }}>
                    Next billing: {nextBilling}
                  </p>
                )}
              </div>

              {/* Dynamic price badge */}
              {planPrice > 0 && (
                <div style={{
                  display:         'flex',
                  alignItems:      'center',
                  padding:         '6px 14px',
                  borderRadius:    99,
                  backgroundColor: 'rgba(202,220,241,0.25)',
                  border:          '1px solid rgba(202,220,241,0.4)',
                  backdropFilter:  'blur(4px)',
                  flexShrink:      0,
                }}>
                  <span style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 600,
                    fontSize:   16,
                    lineHeight: '24px',
                    color:      'var(--neutral-white)',
                  }}>
                    ${planPrice} / month
                  </span>
                </div>
              )}
            </div>

            {/* Feature list */}
            {planFeatures.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {planFeatures.map(feat => (
                  <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width:           16,
                      height:          16,
                      borderRadius:    99,
                      backgroundColor: 'rgba(255,255,255,0.25)',
                      flexShrink:      0,
                      display:         'flex',
                      alignItems:      'center',
                      justifyContent:  'center',
                    }}>
                      <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                        <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <span style={{
                      fontFamily: 'var(--font-body)',
                      fontWeight: 400,
                      fontSize:   13,
                      lineHeight: '20px',
                      color:      'rgba(255,255,255,0.85)',
                    }}>
                      {feat}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Button variant="default" size="sm" onClick={() => setShowChangePlanDialog(true)}>
                Change Plan
              </Button>
              {hasActiveSub && !cancelAtPeriodEnd && (
                <button
                  onClick={() => setShowCancelDialog(true)}
                  style={{
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    padding:        '6px 10px 8px',
                    borderRadius:   10,
                    border:         'none',
                    cursor:         'pointer',
                    backgroundColor:'rgba(255,255,255,0.15)',
                    boxShadow:      '0px 0px 0px 1px rgba(255,255,255,0.3)',
                    fontFamily:     'var(--font-body)',
                    fontWeight:     500,
                    fontSize:       14,
                    lineHeight:     '22px',
                    color:          'var(--neutral-white)',
                    whiteSpace:     'nowrap',
                    backdropFilter: 'blur(4px)',
                  }}
                >
                  Cancel Plan
                </button>
              )}
              {cancelAtPeriodEnd && (
                <span style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 400,
                  fontSize:   13,
                  lineHeight: '20px',
                  color:      'rgba(255,255,255,0.7)',
                }}>
                  Cancels on {fmtDate(user?.currentPeriodEnd ?? null)}
                </span>
              )}
            </div>
          </div>

          {/* ── Credit stats row ── */}
          <div style={{ display: 'flex', gap: 10 }}>
            <StatBox
              label="Monthly Credits"
              value={fmtNum(creditsTotal)}
              action={
                <p style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 400,
                  fontSize:   12,
                  lineHeight: '18px',
                  color:      'var(--neutral-400)',
                  margin:     0,
                }}>
                  Resets on {resetDate}
                </p>
              }
            />
            <StatBox
              label="Credits Remaining"
              value={fmtNum(creditsRemaining)}
              action={
                <p style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 400,
                  fontSize:   12,
                  lineHeight: '18px',
                  color:      'var(--neutral-400)',
                  margin:     0,
                }}>
                  {fmtNum(creditsUsed)} used this month
                </p>
              }
            />
            {/* Need more credits */}
            <div
              style={{
                flex:            '1 0 0',
                minWidth:        0,
                display:         'flex',
                flexDirection:   'column',
                gap:             4,
                padding:         '16px 20px',
                borderRadius:    12,
                border:          '1px solid var(--neutral-200)',
                backgroundColor: 'var(--neutral-white)',
                boxShadow:       '0px 1px 2px 0px rgba(82,75,71,0.08)',
                justifyContent:  'space-between',
              }}
            >
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize:   13,
                lineHeight: '20px',
                color:      'var(--neutral-500)',
                margin:     0,
              }}>
                Need more credits?
              </p>
              <div>
                <button
                  style={{
                    display:        'inline-flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    padding:        '5px 10px',
                    borderRadius:   8,
                    border:         'none',
                    cursor:         'pointer',
                    backgroundColor:'transparent',
                    boxShadow:      '0px 0px 0px 1px rgba(59,54,50,0.3)',
                    fontFamily:     'var(--font-body)',
                    fontWeight:     500,
                    fontSize:       13,
                    lineHeight:     '20px',
                    color:          'var(--neutral-700)',
                    whiteSpace:     'nowrap',
                  }}
                >
                  Buy more Credits
                </button>
              </div>
            </div>
          </div>

          {/* ── This month's usage ── */}
          <SettingsCard>
            <CardSection divider padTop={6} padBottom={12}>
              <h2 style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize:   16,
                lineHeight: '22px',
                color:      'var(--neutral-900)',
                margin:     0,
              }}>
                This Month&apos;s Usage
              </h2>
            </CardSection>

            {/* Monthly limits */}
            <CardSection divider padTop={12} padBottom={16}>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize:   13,
                lineHeight: '20px',
                color:      'var(--neutral-600)',
                margin:     '0 0 12px',
              }}>
                Monthly Limits
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {([
                  { label: 'Chat Board',    used: chatCredits,    total: creditsTotal, disabled: false },
                  { label: 'AI Assistants', used: personaCredits, total: creditsTotal, disabled: false },
                  { label: 'Workflows',     used: 0,              total: creditsTotal, disabled: true  },
                ] as const).map(row => (
                  <div
                    key={row.label}
                    style={{
                      display:       'flex',
                      flexDirection: 'column',
                      gap:           6,
                      opacity:       row.disabled ? 0.4 : 1,
                      pointerEvents: row.disabled ? 'none' : undefined,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        fontFamily: 'var(--font-body)',
                        fontWeight: 400,
                        fontSize:   13,
                        lineHeight: '20px',
                        color:      'var(--neutral-700)',
                      }}>
                        {row.label}
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-body)',
                        fontWeight: 400,
                        fontSize:   12,
                        lineHeight: '18px',
                        color:      'var(--neutral-500)',
                      }}>
                        {fmtNum(row.total)}
                      </span>
                    </div>
                    <ProgressBar used={row.used} total={row.total} />
                  </div>
                ))}
              </div>
            </CardSection>

            {/* Storage */}
            <CardSection padTop={12} padBottom={16}>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize:   13,
                lineHeight: '20px',
                color:      'var(--neutral-600)',
                margin:     '0 0 12px',
              }}>
                Storage
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 400,
                    fontSize:   13,
                    lineHeight: '20px',
                    color:      'var(--neutral-700)',
                  }}>
                    File storage
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 400,
                    fontSize:   12,
                    lineHeight: '18px',
                    color:      'var(--neutral-500)',
                  }}>
                    10 GB
                  </span>
                </div>
                <ProgressBar used={0} total={10} />
              </div>
            </CardSection>
          </SettingsCard>

          {/* ── Payment method (disabled) ── */}
          <SettingsCard>
            <CardSection divider padTop={6} padBottom={12}>
              <h2 style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize:   16,
                lineHeight: '22px',
                color:      'var(--neutral-900)',
                margin:     0,
              }}>
                Payment Method
              </h2>
            </CardSection>

            <CardSection padTop={12} padBottom={12}>
              <div style={{ opacity: 0.4, pointerEvents: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  {pm ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{
                        width:           44,
                        height:          28,
                        borderRadius:    6,
                        backgroundColor: 'var(--neutral-100)',
                        border:          '1px solid var(--neutral-200)',
                        display:         'flex',
                        alignItems:      'center',
                        justifyContent:  'center',
                        flexShrink:      0,
                      }}>
                        <span style={{
                          fontFamily:    'var(--font-body)',
                          fontWeight:    700,
                          fontSize: 12,
                          color:         'var(--neutral-600)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.02em',
                        }}>
                          {pm.brand.slice(0, 4)}
                        </span>
                      </div>
                      <div>
                        <p style={{
                          fontFamily: 'var(--font-body)',
                          fontWeight: 500,
                          fontSize:   14,
                          lineHeight: '22px',
                          color:      'var(--neutral-900)',
                          margin:     0,
                        }}>
                          {pm.brand.charAt(0).toUpperCase() + pm.brand.slice(1)} ending {pm.last4}
                        </p>
                        <p style={{
                          fontFamily: 'var(--font-body)',
                          fontWeight: 400,
                          fontSize:   13,
                          lineHeight: '20px',
                          color:      'var(--neutral-500)',
                          margin:     0,
                        }}>
                          Expires {String(pm.exp_month).padStart(2, '0')}/{pm.exp_year}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p style={{
                      fontFamily: 'var(--font-body)',
                      fontWeight: 400,
                      fontSize:   14,
                      lineHeight: '22px',
                      color:      'var(--neutral-500)',
                      margin:     0,
                    }}>
                      No payment method on file.
                    </p>
                  )}
                  <a
                    href={billingPortalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flexShrink:          0,
                      display:             'inline-flex',
                      alignItems:          'center',
                      justifyContent:      'center',
                      padding:             '5px 10px',
                      borderRadius:        8,
                      textDecoration:      'none',
                      cursor:              'pointer',
                      backgroundColor:     'transparent',
                      boxShadow:           '0px 0px 0px 1px rgba(59,54,50,0.3)',
                      fontFamily:          'var(--font-body)',
                      fontWeight:          500,
                      fontSize:            13,
                      lineHeight:          '20px',
                      color:               'var(--neutral-700)',
                      whiteSpace:          'nowrap',
                    }}
                  >
                    Manage on Stripe
                  </a>
                </div>
              </div>
            </CardSection>
          </SettingsCard>

          {/* ── Invoice history ── */}
          {invoices.length > 0 && (
            <SettingsCard>
              <CardSection divider padTop={6} padBottom={12}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h2 style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 500,
                    fontSize:   16,
                    lineHeight: '22px',
                    color:      'var(--neutral-900)',
                    margin:     0,
                  }}>
                    Invoice History
                  </h2>
                  <button
                    style={{
                      display:        'inline-flex',
                      alignItems:     'center',
                      padding:        '3px 8px',
                      borderRadius:   6,
                      border:         'none',
                      cursor:         'pointer',
                      backgroundColor:'transparent',
                      boxShadow:      '0px 0px 0px 1px rgba(59,54,50,0.25)',
                      fontFamily:     'var(--font-body)',
                      fontWeight:     400,
                      fontSize:       12,
                      lineHeight:     '18px',
                      color:          'var(--neutral-600)',
                    }}
                  >
                    Export all
                  </button>
                </div>
              </CardSection>

              <CardSection padTop={0} padBottom={4}>
                {/* Column headers */}
                <div style={{
                  display:             'grid',
                  gridTemplateColumns: '1fr 100px 90px 60px',
                  gap:                 8,
                  padding:             '4px 0 8px',
                  borderBottom:        '1px solid var(--neutral-100)',
                  marginBottom:        4,
                }}>
                  {['Date', 'Amount', 'Status', ''].map(col => (
                    <span key={col} style={{
                      fontFamily: 'var(--font-body)',
                      fontWeight: 500,
                      fontSize:   12,
                      lineHeight: '18px',
                      color:      'var(--neutral-400)',
                    }}>
                      {col}
                    </span>
                  ))}
                </div>

                {/* Invoice rows */}
                {invoices.slice(0, 10).map(inv => (
                  <div
                    key={inv.id}
                    style={{
                      display:             'grid',
                      gridTemplateColumns: '1fr 100px 90px 60px',
                      gap:                 8,
                      alignItems:          'center',
                      padding:             '8px 0',
                      borderBottom:        '1px solid var(--neutral-50)',
                    }}
                  >
                    <span style={{
                      fontFamily: 'var(--font-body)',
                      fontWeight: 400,
                      fontSize:   13,
                      lineHeight: '20px',
                      color:      'var(--neutral-700)',
                    }}>
                      {fmtDate(inv.created)}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-body)',
                      fontWeight: 500,
                      fontSize:   13,
                      lineHeight: '20px',
                      color:      'var(--neutral-900)',
                    }}>
                      {fmtAmount(inv.amount_paid, inv.currency)}
                    </span>
                    <div>
                      {inv.paid || inv.status === 'paid' ? (
                        <GreenBadge>Paid</GreenBadge>
                      ) : (
                        <BlueBadge>{inv.status}</BlueBadge>
                      )}
                    </div>
                    <a
                      href={inv.invoice_pdf || inv.invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontFamily:          'var(--font-body)',
                        fontWeight:          400,
                        fontSize:            13,
                        lineHeight:          '20px',
                        color:               'var(--neutral-600)',
                        textDecoration:      'underline',
                        textUnderlineOffset: 2,
                      }}
                    >
                      View
                    </a>
                  </div>
                ))}
              </CardSection>
            </SettingsCard>
          )}

        </div>
      </div>
    </>
  )
}
