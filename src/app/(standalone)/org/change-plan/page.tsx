'use client'

import React, { useState, useEffect, useRef } from 'react'
import { m } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { ArrowDownOneIcon, TickTwoIcon } from '@strange-huge/icons'
import { useAuth } from '@/context/auth-context'
import { useOrg } from '@/context/org-context'
import { createCheckout, updatePlan, type CheckoutPlan } from '@/lib/api/stripe'
import { trackBrowserEvent } from '@/lib/analytics/events'
import { toast } from 'sonner'
import { ContactSalesModal } from '@/components/ContactSalesModal'
import { Dropdown } from '@/components/Dropdown'
import { ORG_PLANS_ROUTE } from '@/lib/routes'

const TITLE = 'var(--font-title)'
const BODY  = 'var(--font-body)'
const MONO  = "'Geist Mono', ui-monospace, monospace"

// Matches what the backend actually grants: services/stripe/catalog.py's
// usageCredits() is a flat 80% of the monthly price, × 1000 for display units
// (see toDisplayCredits in lib/api/organization.ts, and plans.yaml's comment).
// $125 isn't a real plan (not in usageCredits' PLAN_IDS) — 100,000 here is
// just 125 * 0.8 * 1000 for display consistency with the rest of the column,
// not a number the backend can currently produce.
const CREDITS_BY_PRICE: Record<number, number> = {
  50:   40_000,
  100:  80_000,
  125:  100_000,
  250:  200_000,
  500:  400_000,
  1000: 800_000,
  2000: 1_600_000,
}

const WORKSPACE_PLANS: { price: number; credits: number; label: string; planId: CheckoutPlan }[] = [
  { price: 50,   credits: CREDITS_BY_PRICE[50],   label: '$50',  planId: '50'   },
  { price: 100,  credits: CREDITS_BY_PRICE[100],  label: '$100', planId: '100'  },
  { price: 250,  credits: CREDITS_BY_PRICE[250],  label: '$250', planId: '250'  },
  { price: 500,  credits: CREDITS_BY_PRICE[500],  label: '$500', planId: '500'  },
  { price: 1000, credits: CREDITS_BY_PRICE[1000], label: '$1k',  planId: '1000' },
  { price: 2000, credits: CREDITS_BY_PRICE[2000], label: '$2k',  planId: '2000' },
]

// Annual pricing is display-only (matches the 25% discount already shown on
// settings/plans-and-billing) — checkout still runs through the same
// monthly `updatePlan`/`createCheckout` call, there's no separate annual
// planId on the backend yet.
const ANNUAL_MULTIPLIER = 0.75

// Every tier the pricing sheet lists, for the dropdown. $125 has no Stripe
// price configured yet (services/stripe/catalog.py's PLAN_IDS stops at
// 50/100/250/500/1000/2000) — shown so the tier isn't a surprise omission,
// but disabled until the backend actually has a plan for it.
const DROPDOWN_TIER_PRICES = [50, 100, 125, 250, 500, 1000, 2000]

function fmtNum(n: number): string {
  return n.toLocaleString('en-US')
}

function fmtPrice(price: number): string {
  return price >= 1000 ? `$${price / 1000}k` : `$${price}`
}

function Badge({ label, color }: { label: string; color: 'brown' | 'yellow' }) {
  const isBrown = color === 'brown'
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', borderRadius: 6, overflow: 'hidden',
      boxShadow: isBrown
        ? '0px 1px 1.5px 0px rgba(20,12,5,0.2), 0px 0px 0px 1px rgba(126,84,53,0.5)'
        : '0px 1px 1.5px 0px rgba(20,16,5,0.2), 0px 0px 0px 1px rgba(143,116,39,0.5)',
    }}>
      <div style={{ position: 'absolute', inset: 0, backgroundColor: isBrown ? '#e6d5ca' : '#e9dfc9', borderRadius: 6 }} />
      <div style={{ position: 'absolute', inset: 0, borderRadius: 6, pointerEvents: 'none', boxShadow: isBrown
        ? 'inset 0px 1px 0px 0px rgba(250,241,235,0.7), inset 0px -1px 0px 0px rgba(126,84,53,0.1)'
        : 'inset 0px 1px 0px 0px rgba(250,246,235,0.7), inset 0px -1px 0px 0px rgba(143,116,39,0.1)' }} />
      <span style={{ fontFamily: BODY, fontWeight: 500, fontSize: 11, lineHeight: '16px', color: isBrown ? '#683d1b' : '#6d5921', position: 'relative', padding: '2px 6px' }}>
        {label}
      </span>
    </div>
  )
}

function FeatureDot() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: 2, flexShrink: 0 }}>
      <div style={{
        width: 8, height: 8, borderRadius: 19,
        backgroundColor: '#ede1d7',
        boxShadow: '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(182,172,164,0.4), inset 0px 1px 0px 0px rgba(247,242,237,0.61), inset 0px -1px 0px 0px rgba(106,98,93,0.05)',
      }} />
    </div>
  )
}

function FeatureLine({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <FeatureDot />
      <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: 14, lineHeight: '22px', color: '#3b3632', margin: 0 }}>
        {text}
      </p>
    </div>
  )
}

function FeatureGroup({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ fontFamily: MONO, fontWeight: 400, fontSize: 13, lineHeight: '16px', color: '#827a74', margin: 0 }}>
        {title}
      </p>
      {items.map(item => <FeatureLine key={item} text={item} />)}
    </div>
  )
}

function Hairline() {
  return <div style={{ height: 1, width: '100%', backgroundColor: '#e5e5e5' }} />
}

export default function OrgChangePlanPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { org, orgId, orgRole, orgReady, refreshMembers } = useOrg()
  const [workspaceIdx,     setWorkspaceIdx]     = useState(1)
  const [billing,          setBilling]          = useState<'monthly' | 'annual'>('monthly')
  const [tierMenuOpen,     setTierMenuOpen]     = useState(false)
  const [changingTo,       setChangingTo]       = useState<CheckoutPlan | null>(null)
  const [contactSalesOpen, setContactSalesOpen] = useState(false)

  const currentPlan        = user?.planType ?? null
  const selectedWorkspace  = WORKSPACE_PLANS[workspaceIdx]!

  // `orgId`/`orgRole` are already required just to render this page (the admin
  // gate below), so `Boolean(user?.orgId || orgId)` is always true here — it
  // was conflating "is an org member" with "org has a paid workspace plan",
  // which made the button/label logic below think every org already had a
  // plan even when org.monthlyPrice was 0. The real signal is whether the
  // org's current price actually matches one of the real tiers.
  const currentWorkspacePrice   = org.monthlyPrice ?? 0
  const currentWorkspaceTierIdx = WORKSPACE_PLANS.findIndex(p => p.price === currentWorkspacePrice)
  const hasWorkspacePlan        = currentWorkspaceTierIdx >= 0
  // No backend field distinguishes "org is on a free/trial plan" from "org has
  // no plan yet" — the only trial mechanism that exists (services/stripe/account.py
  // startTrial) is individual-only and 403s for org members, so this can never
  // be true for anything reachable on this page. Hidden until an org-level
  // trial state actually exists on the backend — see
  // docs v1.5/free-trial-onboarding-plan.md §3.
  const isOnFreePlan = false

  // Sync tier picker to the org's current tier on load
  useEffect(() => {
    if (hasWorkspacePlan) {
      setWorkspaceIdx(currentWorkspaceTierIdx)
    }
  }, [hasWorkspacePlan, currentWorkspaceTierIdx])

  useEffect(() => {
    if (orgReady && orgRole !== 'admin') {
      router.replace(ORG_PLANS_ROUTE)
    }
  }, [orgReady, orgRole, router])

  // Announce the org's current plan once data is ready — green for an actual
  // plan, blue for "nothing selected yet" — and stays put until the user
  // closes it themselves (no auto-dismiss).
  const currentPlanToastShown = useRef(false)
  useEffect(() => {
    if (currentPlanToastShown.current || !orgReady) return
    if (org.plan === 'enterprise') {
      currentPlanToastShown.current = true
      toast.success("You're on the Pro (Enterprise) plan", { duration: Infinity })
    } else if (hasWorkspacePlan) {
      const p = WORKSPACE_PLANS[currentWorkspaceTierIdx]!
      currentPlanToastShown.current = true
      toast.success(`You're on the Workspace plan — ${fmtPrice(p.price)}/mo · ${fmtNum(p.credits)} credits`, { duration: Infinity })
    } else {
      currentPlanToastShown.current = true
      toast.info("You don't have a plan yet — pick one to get started.", { duration: Infinity })
    }
  }, [orgReady, org.plan, hasWorkspacePlan, currentWorkspaceTierIdx])

  const handleSelectTier = (idx: number) => {
    setWorkspaceIdx(idx)
    setTierMenuOpen(false)
    const p = WORKSPACE_PLANS[idx]!
    const detail = `${fmtPrice(p.price)}/mo · ${fmtNum(p.credits)} credits`
    if (!hasWorkspacePlan) {
      toast.info('Upgrade to Workspace', { description: detail })
    } else if (idx === currentWorkspaceTierIdx) {
      toast.info('This is your current plan', { description: detail })
    } else if (idx < currentWorkspaceTierIdx) {
      toast.info("Can't downgrade", { description: detail })
    } else {
      toast.info('Upgrade Workspace plan', { description: detail })
    }
  }

  const handleSelectWorkspace = async () => {
    if (workspaceButtonDisabled) return
    const planId = selectedWorkspace.planId
    setChangingTo(planId)
    try {
      if (hasWorkspacePlan) {
        await updatePlan(planId)
        trackBrowserEvent('checkout_started', { from_plan: currentPlan ?? undefined, to_plan: planId })
        // See the matching comment in settings/billing/change-plan/page.tsx —
        // without this the plans-and-billing page would show the OLD tier/price
        // right after an upgrade, until some unrelated remount refetched it.
        refreshMembers()
        router.replace(ORG_PLANS_ROUTE)
        return
      }
      const checkout = await createCheckout({ planId })
      trackBrowserEvent('checkout_started', { from_plan: currentPlan ?? undefined, to_plan: planId })
      document.cookie = 'souvenir_checkout_complete=1; path=/; max-age=3600; SameSite=Lax'
      try { sessionStorage.setItem('souvenir_checkout_source', 'billing') } catch { /* sessionStorage may be unavailable */ }
      window.location.href = checkout.checkout_url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start checkout')
      setChangingTo(null)
    }
  }

  const workspaceIsCurrent      = hasWorkspacePlan && workspaceIdx === currentWorkspaceTierIdx
  const workspaceIsDowngrade    = hasWorkspacePlan && workspaceIdx < currentWorkspaceTierIdx
  const workspaceButtonDisabled = workspaceIsCurrent || workspaceIsDowngrade || !!changingTo

  const workspaceButtonLabel = (() => {
    if (workspaceIsCurrent)                       return 'Current plan'
    if (workspaceIsDowngrade)                     return "Can't downgrade"
    if (changingTo === selectedWorkspace.planId)  return 'Redirecting…'
    if (hasWorkspacePlan)                         return 'Upgrade Workspace plan'
    return 'Upgrade to Workspace'
  })()

  const displayedPrice = billing === 'annual'
    ? Math.round(selectedWorkspace.price * ANNUAL_MULTIPLIER)
    : selectedWorkspace.price
  const workspacePriceLabel = fmtPrice(displayedPrice)

  if (!orgReady || orgRole !== 'admin') return null

  return (
    <>
      <div
        className="kaya-scrollbar"
        style={{
          minHeight: '100vh', overflowX: 'hidden',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '24px 24px 48px',
          background: 'linear-gradient(to bottom, #f7f2ed 0%, #ede1d7 65%, #d1c6bd 100%)',
        }}
      >
        <div style={{ width: '100%', maxWidth: 1200, display: 'flex', flexDirection: 'column', gap: 32, alignItems: 'center' }}>

          {/* ── Header ── */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' }}>
            <button
              type="button"
              onClick={() => router.push(ORG_PLANS_ROUTE)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 10px 8px 10px', borderRadius: 10,
                border: 'none', backgroundColor: 'rgba(0,0,0,0)', cursor: 'pointer',
                fontFamily: BODY, fontWeight: 500, fontSize: 14, lineHeight: '16px',
                color: '#524b47', transition: 'background-color 120ms ease, color 120ms ease',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(0,0,0,0.05)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(0,0,0,0)' }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back to billing
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <p style={{ fontFamily: TITLE, fontWeight: 400, fontSize: 24, lineHeight: '32px', color: '#26211e', margin: 0 }}>
                Pricing
              </p>
              <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: 16, lineHeight: '22px', color: '#827a74', margin: 0 }}>
                Choose the plan that works for your workspace. Shared credits across unlimited members. No per-seat fees.
              </p>
            </div>

            {/* Invisible mirror of the back button, keeps the title centered */}
            <div style={{ padding: '6px 10px 8px 10px', opacity: 0, pointerEvents: 'none' }}>
              <span style={{ fontFamily: BODY, fontWeight: 500, fontSize: 14 }}>Back to billing</span>
            </div>
          </div>

          {/* ── Monthly / Yearly tab ── */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: 4,
            borderRadius: 10, backgroundColor: 'rgba(247,242,237,0.5)',
            boxShadow: 'inset 0px -1px 0px 0px rgba(255,255,255,0.9), inset 0px 1px 0px 0px #ede1d7, inset 0px 0px 4px 0px rgba(209,198,189,0.5)',
          }}>
            <button
              type="button"
              onClick={() => setBilling('monthly')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '6px 10px 8px', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontFamily: BODY, fontWeight: 500, fontSize: 14, lineHeight: '22px',
                ...(billing === 'monthly'
                  ? {
                      background: 'linear-gradient(to bottom, #524b47, #26211e)',
                      boxShadow: '0px 0px 0px 1px black, 0px 1.091px 1.091px 0px rgba(59,54,50,0.1), 0px 1.455px 3.127px 0px rgba(59,54,50,0.4)',
                      color: '#f7f2ed',
                      textShadow: '0px -0.727px 0.364px rgba(0,0,0,0.25), 0px 0.364px 0.364px rgba(255,255,255,0.25)',
                    }
                  : { backgroundColor: 'transparent', color: '#827a74' }),
              }}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBilling('annual')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '6px 8px 8px', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontFamily: BODY, fontWeight: 500, fontSize: 14, lineHeight: '22px',
                ...(billing === 'annual'
                  ? {
                      background: 'linear-gradient(to bottom, #524b47, #26211e)',
                      boxShadow: '0px 0px 0px 1px black, 0px 1.091px 1.091px 0px rgba(59,54,50,0.1), 0px 1.455px 3.127px 0px rgba(59,54,50,0.4)',
                      color: '#f7f2ed',
                      textShadow: '0px -0.727px 0.364px rgba(0,0,0,0.25), 0px 0.364px 0.364px rgba(255,255,255,0.25)',
                    }
                  : { backgroundColor: 'transparent', color: '#827a74' }),
              }}
            >
              Yearly
            </button>
            <Badge label="Save 25%" color="yellow" />
          </div>

          {/* ── Cards Row ── */}
          <div style={{ display: 'flex', gap: 32, alignItems: 'stretch', width: '100%', flexWrap: 'wrap', justifyContent: 'center' }}>

            {/* ── Workspace (Core) ── */}
            <div style={{ flex: '0 0 400px', maxWidth: 400, display: 'flex', flexDirection: 'column' }}>
              <div style={{
                backgroundColor: 'white',
                border: '2px solid #683d1b',
                borderRadius: 24,
                padding: 32,
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 28,
                boxShadow: '0px 1px 1px rgba(0,0,0,0.05)',
                height: '100%',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <p style={{ fontFamily: TITLE, fontWeight: 400, fontSize: 24, lineHeight: '32px', color: '#26211e', margin: 0 }}>
                      Workspace
                    </p>
                    <Badge label="Recommended" color="brown" />
                  </div>

                  {/* Free-plan status — Figma 85:22256. Only renders while
                      isOnFreePlan is real (currently never, see its definition
                      above) — never show "$20 free credits" to an org that
                      isn't actually on a free plan. */}
                  {isOnFreePlan && (
                    <div style={{
                      position: 'relative',
                      backgroundColor: 'white', border: '1px solid rgba(13,110,178,0.5)', borderRadius: 10,
                      padding: '24px 16px 16px', display: 'flex', flexDirection: 'column', gap: 16,
                    }}>
                      <div style={{
                        position: 'absolute', top: -11, left: 16,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: 6, overflow: 'hidden', backgroundColor: '#cadcf1',
                        boxShadow: '0px 1px 1.5px 0px rgba(2,15,24,0.2), 0px 0px 0px 1px rgba(13,110,178,0.5), inset 0px 1px 0px 0px rgba(231,244,253,0.7), inset 0px -1px 0px 0px rgba(13,110,178,0.1)',
                      }}>
                        <span style={{ fontFamily: BODY, fontWeight: 500, fontSize: 11, lineHeight: '16px', color: '#135487', padding: '2px 6px' }}>
                          FREE PLAN ACTIVE
                        </span>
                      </div>
                      <div style={{ fontFamily: TITLE, fontWeight: 500, fontSize: 20, lineHeight: '24px', color: '#524b47' }}>
                        <p style={{ margin: 0 }}>You have been assigned</p>
                        <p style={{ margin: 0 }}>$20 worth of free credits</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => router.push(ORG_PLANS_ROUTE)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: '100%', padding: '6px 10px 8px', borderRadius: 10, border: 'none',
                          backgroundColor: 'rgba(255,255,255,0)', boxShadow: '0px 0px 0px 1px rgba(59,54,50,0.3)',
                          cursor: 'pointer', fontFamily: BODY, fontWeight: 500, fontSize: 14, lineHeight: '16px', color: '#524b47',
                        }}
                      >
                        View usage
                      </button>
                    </div>
                  )}

                  {/* Price + tier picker */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Dropdown.Float
                        open={tierMenuOpen}
                        onOpenChange={setTierMenuOpen}
                        placement="bottom-start"
                        trigger={
                          <button
                            type="button"
                            style={{
                              display: 'flex', alignItems: 'center', gap: 2,
                              padding: '6px 10px 8px', borderRadius: 10, border: 'none',
                              backgroundColor: 'rgba(255,255,255,0)', boxShadow: '0px 0px 0px 1px rgba(59,54,50,0.3)',
                              cursor: 'pointer', fontFamily: BODY, fontWeight: 500, fontSize: 14, lineHeight: '16px', color: '#524b47',
                            }}
                          >
                            {workspacePriceLabel}
                            <ArrowDownOneIcon size={16} color="#524b47" />
                          </button>
                        }
                      >
                        <Dropdown size="md">
                          <Dropdown.Section>
                            {DROPDOWN_TIER_PRICES.map(price => {
                              const i = WORKSPACE_PLANS.findIndex(p => p.price === price)
                              const available = i !== -1
                              const p = available ? WORKSPACE_PLANS[i]! : null
                              const displayPrice = available && billing === 'annual'
                                ? Math.round(p!.price * ANNUAL_MULTIPLIER)
                                : price
                              return (
                                <Dropdown.Item
                                  key={price}
                                  label={fmtPrice(displayPrice)}
                                  subLabel={available
                                    ? `${fmtNum(p!.credits)} credits/mo`
                                    : `${fmtNum(CREDITS_BY_PRICE[price])} credits/mo · Coming soon`}
                                  selected={available && i === workspaceIdx}
                                  rightIcon={available && i === workspaceIdx ? <TickTwoIcon size={16} color="#524b47" /> : undefined}
                                  disabled={!available}
                                  onClick={available ? () => handleSelectTier(i) : undefined}
                                  fluid
                                />
                              )
                            })}
                          </Dropdown.Section>
                        </Dropdown>
                      </Dropdown.Float>
                      <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: 14, lineHeight: '22px', color: '#3b3632', margin: 0 }}>
                        /month
                      </p>
                    </div>
                    <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: 14, lineHeight: '22px', color: '#3b3632', margin: 0 }}>
                      {fmtNum(selectedWorkspace.credits)} credits
                    </p>
                  </div>

                  <Hairline />

                  {/* Features — everything Individual used to cover, now baseline on Workspace */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <FeatureGroup
                      title="Plan includes:"
                      items={['Cross-model memory that compounds', 'Unlimited Pins & Project folders', 'Every major AI model, auto-routed or manual', 'Unlimited web search · 250+ connectors']}
                    />
                    <Hairline />
                    <FeatureGroup
                      title="Team collaboration"
                      items={['Slack manager bot', 'Unlimited members · no per-seat', 'Shared agents, Pins & Project folders']}
                    />
                    <Hairline />
                    <FeatureGroup
                      title="Governance & control"
                      items={['Admin controls + per-member caps', 'Approval gates', 'Full audit trail']}
                    />
                  </div>
                </div>

                <button
                  onClick={() => { void handleSelectWorkspace() }}
                  disabled={workspaceButtonDisabled}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '100%', padding: '6px 2px 8px', borderRadius: 10, border: 'none',
                    cursor: workspaceButtonDisabled ? 'default' : 'pointer',
                    opacity: workspaceButtonDisabled ? 0.55 : 1,
                    background: 'linear-gradient(to bottom, #524b47, #26211e)',
                    boxShadow: '0px 0px 0px 1px black, 0px 1.091px 1.091px 0px rgba(59,54,50,0.1), 0px 1.455px 3.127px 0px rgba(59,54,50,0.4), inset 0px 1px 0.364px 0px rgba(247,242,237,0.3), inset 0px -2.182px 0.364px 0px #120c08, inset 0px -2.545px 4px -2.182px rgba(247,242,237,0.5)',
                    fontFamily: BODY, fontWeight: 500, fontSize: 14, lineHeight: '22px', color: '#f7f2ed',
                    textShadow: '0px -0.727px 0.364px rgba(0,0,0,0.25), 0px 0.364px 0.364px rgba(255,255,255,0.25)',
                  }}
                >
                  {workspaceButtonLabel}
                </button>
              </div>
            </div>

            {/* ── Enterprise (Pro) ── */}
            <div style={{ flex: '0 0 400px', maxWidth: 400, display: 'flex', flexDirection: 'column' }}>
              <div style={{
                backgroundColor: 'white',
                border: '1px solid #e5e5e5',
                borderRadius: 24,
                padding: 32,
                display: 'flex', flexDirection: 'column', gap: 28,
                boxShadow: '0px 1px 1px rgba(0,0,0,0.05)',
                height: '100%',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <p style={{ fontFamily: TITLE, fontWeight: 400, fontSize: 24, lineHeight: '32px', color: '#26211e', margin: 0 }}>
                    Pro
                  </p>
                  <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: 14, lineHeight: '22px', color: '#827a74', margin: 0 }}>
                    $250/month with $125 of provider usage included.
                  </p>
                </div>

                <m.button
                  type="button"
                  onClick={() => { if (!changingTo && org.plan !== 'enterprise') setContactSalesOpen(true) }}
                  disabled={!!changingTo || org.plan === 'enterprise'}
                  whileTap={(!!changingTo || org.plan === 'enterprise') ? undefined : { scale: 0.98 }}
                  transition={{ duration: 0.1, ease: 'easeOut' }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                    width: '100%', padding: '6px 2px 8px', borderRadius: 10, border: 'none',
                    backgroundColor: 'white', cursor: changingTo ? 'wait' : 'pointer',
                    boxShadow: '0px 1.091px 1.091px 0px rgba(59,54,50,0.05), 0px 1.455px 3.127px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px #ede1d7, inset 0px -2.182px 0.364px 0px #ede1d7',
                    fontFamily: BODY, fontWeight: 500, fontSize: 14, lineHeight: '22px', color: '#524b47',
                  }}
                >
                  {org.plan === 'enterprise' ? 'Current plan' : 'Get in touch'}
                  {org.plan !== 'enterprise' && (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path d="M3.5 8h9M9 4.5l3.5 3.5L9 11.5" stroke="#524b47" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </m.button>

                <Hairline />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 24, flex: 1 }}>
                  <FeatureGroup
                    title="Everything in Workspace, plus"
                    items={['Unlimited usage', 'Overage billed at exact provider cost']}
                  />
                  <Hairline />
                  <FeatureGroup
                    title="Enterprise security"
                    items={['SSO', 'DPA & SLA', 'Private deployment options']}
                  />
                  <Hairline />
                  <FeatureGroup
                    title="White-glove service"
                    items={['Onboarding & training', 'Dedicated success manager', 'Monthly strategy review']}
                  />
                  <Hairline />
                  <FeatureGroup
                    title="Support"
                    items={['Priority email support', 'Online meeting support']}
                  />
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {contactSalesOpen && <ContactSalesModal onClose={() => setContactSalesOpen(false)} />}
    </>
  )
}
