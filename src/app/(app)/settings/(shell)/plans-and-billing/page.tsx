'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CancelOneIcon, TokenCircleIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { CardBrandLogo, type CardBrand } from '@/components/CardBrandLogo'
import { useAuth } from '@/context/auth-context'
import { useOrg } from '@/context/org-context'
import { useMounted } from '@/hooks/use-mounted'
import {
  fetchBilling,
  openBillingPortal,
  cancelSubscription,
  resumeSubscription,
  startTrial,
  type BillingInfo,
} from '@/lib/api/stripe'
import { setOrgPoolCap } from '@/lib/api/organization'
import { resolveOrgBillingRole } from '@/lib/roles'
import { creditsFromBilling } from '@/lib/credits'
import {
  ORG_CHANGE_PLAN_ROUTE,
  ORG_MEMBERS_ROUTE,
  ORG_ANALYTICS_ROUTE,
  SETTINGS_BILLING_CHANGE_PLAN_ROUTE,
  SETTINGS_USAGE_ROUTE,
} from '@/lib/routes'

// ── Individual plan config (ported from the old /settings/billing page) ───────

const PLAN_PRICES: Record<string, number> = {
  starter: 12,
  pro:     25,
  power:   100,
}

const PLAN_FEATURE_LIST: Record<string, string[]> = {
  starter: ['Basic routing', 'AI Assistants', 'Brain & Automation', 'Connectors', 'Pins', 'Projects'],
  pro:     ['Advanced routing', 'Model compare', 'Unlimited agents', 'Cost savings report', 'Brain & Automation', 'Connectors', 'Pins', 'Projects'],
  power:   ['Advanced routing', 'Model compare', 'Unlimited agents', 'Advanced analytics', 'Brain & Automation', 'Connectors', 'Pins', 'Projects'],
}

// sessionStorage keys — last-known snapshot so returning from Stripe paints
// instantly instead of flashing an empty "No Plan" state while data reloads.
const PERSONAL_SNAP_KEY = 'kaya:billing:snapshot:v3'
const PERSONAL_BILL_KEY = 'kaya:billing:info:v2'

/** Minimal display snapshot persisted across the Stripe round-trip. */
interface PersonalBillingSnapshot {
  planType:         string | null
  creditsTotal:     number
  creditsRemaining: number
  creditsUsed:      number
  chatCredits:      number
  personaCredits:   number
  brainCredits:     number
  nextBilling:      string
  periodEnd:        string | null
  cancelAtPeriodEnd: boolean
}

function isFutureIso(iso: string | null | undefined): boolean {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return !Number.isNaN(t) && t > Date.now()
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

function fmtNum(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('en-US')
}

/*
 * Settings → Organization → Billing ("Plans & Usage")
 * Figma — Kaya Design System:
 *   Teams Owner   6017:30243   Teams Admin   6017:30577
 *   Ent.  Owner   6017:30739   Ent.  Admin   6017:31067
 *   Buy more credits modal     6017:29823
 *   Monthly spend cap modal    6017:30157
 *
 * Tokens (Figma → CSS var): all colors/spacing map onto the existing Kaya vars.
 */

// ── Shared style constants (exact Figma values) ───────────────────────────────

const SHADOW_CARD    = '0px 2px 2.8px 0px rgba(82,75,71,0.12)'                                   // bordered section card
const SHADOW_TILE     = '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)' // white inner tile
const SHADOW_HERO    = '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 1px 0px 1px var(--neutral-100)'  // gradient hero panel
const SHADOW_MODAL   = '0px 19px 32px 0px rgba(18,12,8,0.15), 0px 2px 2.8px 0px rgba(130,122,116,0.1)'
const SHADOW_INPUT   = '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)'
const ENTERPRISE_INTERMAX = 2_147_483_647

// Hero gradient — extracted verbatim from Figma (mauve + gold radial blend, image fill).
const HERO_GRADIENT_TEAMS =
  "url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 1090 372' xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none'><rect x='0' y='0' height='100%' width='100%' fill='url(%23grad)' opacity='0.8'/><defs><radialGradient id='grad' gradientUnits='userSpaceOnUse' cx='0' cy='0' r='10' gradientTransform='matrix(182.6 25.368 -6.6498 62.021 18.115 356.78)'><stop stop-color='rgba(248,236,249,1)' offset='0.14157'/><stop stop-color='rgba(222,208,223,1)' offset='0.41669'/><stop stop-color='rgba(222,208,223,1)' offset='0.5657'/><stop stop-color='rgba(174,156,175,1)' offset='0.746'/><stop stop-color='rgba(149,129,151,1)' offset='0.83615'/><stop stop-color='rgba(125,103,127,1)' offset='0.92631'/></radialGradient></defs></svg>\"), " +
  "url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 1090 372' xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none'><rect x='0' y='0' height='100%' width='100%' fill='url(%23grad)' opacity='1'/><defs><radialGradient id='grad' gradientUnits='userSpaceOnUse' cx='0' cy='0' r='10' gradientTransform='matrix(140.38 29.757 -6.1283 47.447 440.34 312.89)'><stop stop-color='rgba(199,179,135,1)' offset='0.14157'/><stop stop-color='rgba(181,158,103,1)' offset='0.53394'/><stop stop-color='rgba(162,136,71,1)' offset='0.92631'/></radialGradient></defs></svg>\")"

// ── Plan tiers (DECISIONS.md, matches Figma slider markers) ────────────────────

const TIERS = [
  { price: 125,   credits: 60_000 },
  { price: 250,   credits: 125_000 },
  { price: 500,   credits: 250_000 },
  { price: 1_000, credits: 500_000 },
  { price: 1_500, credits: 750_000 },
  { price: 2_000, credits: 1_000_000 },
]

// ── Small primitives ───────────────────────────────────────────────────────────

const fmtUsd = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Credits are USD × 1000. The Enterprise view speaks in credits, so usage/limits
// are displayed via this helper even though the backend stores them in USD.
const CREDITS_PER_USD = 1000
const fmtCredits = (usd: number) => Math.round(usd * CREDITS_PER_USD).toLocaleString()

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Pill badge — blue (info), yellow (note), neutral, green / red (status). */
function Badge({ label, tone }: { label: string; tone: 'blue' | 'yellow' | 'neutral' | 'green' | 'red' }) {
  const map = {
    blue:    { bg: 'var(--blue-100)',    fg: 'var(--blue-700)',    ring: 'rgba(13,110,178,0.5)' },
    yellow:  { bg: 'var(--yellow-100)',  fg: 'var(--yellow-700)',  ring: 'rgba(143,116,39,0.5)' },
    neutral: { bg: 'var(--neutral-100)', fg: 'var(--neutral-700)', ring: 'rgba(106,98,93,0.5)' },
    green:   { bg: 'var(--green-50)',    fg: 'var(--green-800)',   ring: 'rgba(128,183,7,0.5)' },
    red:     { bg: 'var(--red-100)',     fg: 'var(--red-700)',     ring: 'rgba(159,38,35,0.5)' },
  }[tone]
  return (
    <span style={{
      display:        'inline-flex',
      alignItems:     'center',
      padding:        '2px 4px',
      borderRadius:   6,
      background:     map.bg,
      color:          map.fg,
      boxShadow:      `0px 1px 1.5px 0px rgba(2,15,24,0.2), 0px 0px 0px 1px ${map.ring}`,
      fontFamily:     'var(--font-body)',
      fontWeight:     500,
      fontSize:       11,
      lineHeight:     '16px',
      whiteSpace:     'nowrap',
    }}>
      {label}
    </span>
  )
}

/** White stat tile — label / value / sub. */
function StatTile({
  label,
  value,
  sub,
  flex,
  children,
}: {
  label:    string
  value?:   string
  sub?:     string
  flex?:    boolean
  children?: React.ReactNode
}) {
  return (
    <div style={{
      background:    'var(--neutral-white, #fff)',
      borderRadius:  8,
      padding:       12,
      boxShadow:     SHADOW_TILE,
      display:       'flex',
      flexDirection: 'column',
      gap:           6,
      flex:          flex ? '1 1 0' : '1 1 200px',
      minWidth:      160,
    }}>
      <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
        {label}
      </p>
      {value !== undefined && (
        <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
          {value}
        </p>
      )}
      {sub && (
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
          {sub}
        </p>
      )}
      {children}
    </div>
  )
}

/** Bordered section card with a header row (title / subtitle / action). */
function SectionCard({
  title,
  subtitle,
  action,
  children,
  bodyPadding = '12px 24px',
  bodyGap,
  headerDivider = true,
}: {
  title:          string
  subtitle?:      string
  action?:        React.ReactNode
  children:       React.ReactNode
  bodyPadding?:   string
  bodyGap?:       number
  /** Figma 18:24922/18:25080 (Plan / Credits Remaining) have no rule between
   *  title and body — unlike Payment/Invoice history, which do. */
  headerDivider?: boolean
}) {
  return (
    <div style={{
      border:        '1px solid var(--neutral-200)',
      borderRadius:  16,
      boxShadow:     SHADOW_CARD,
      display:       'flex',
      flexDirection: 'column',
      gap:           12,
      paddingTop:    12,
      paddingBottom: 12,
      overflow:      'hidden',
      width:         '100%',
    }}>
      <div style={{
        borderBottom: headerDivider ? '1px solid var(--neutral-100)' : undefined,
        padding:      headerDivider ? '0 24px 24px' : '0 24px',
        display:      'flex',
        alignItems:   'center',
        gap:          12,
      }}>
        <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
            {title}
          </p>
          {subtitle && (
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
              {subtitle}
            </p>
          )}
        </div>
        {action}
      </div>
      <div style={{ flex: '1 0 0', padding: bodyPadding, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: bodyGap }}>
        {children}
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonBlock({ width = '100%', height, radius = 8 }: { width?: string | number; height: number; radius?: number }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'linear-gradient(90deg, var(--neutral-200) 25%, var(--neutral-100) 50%, var(--neutral-200) 75%)',
      backgroundSize: '200% 100%',
      animation: 'plansSkeletonShimmer 1.4s ease-in-out infinite',
      flexShrink: 0,
    }} />
  )
}

function PlansPageSkeleton() {
  return (
    <>
      <style>{`@keyframes plansSkeletonShimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
      <div style={{ width: '100%', maxWidth: 1080, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Page header */}
        <div style={{ paddingLeft: 4, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SkeletonBlock width={80} height={24} radius={6} />
          <SkeletonBlock width={240} height={14} radius={4} />
        </div>

        {/* Hero panel skeleton */}
        <div style={{ borderRadius: 8, padding: 24, display: 'flex', flexDirection: 'column', gap: 16, background: 'var(--neutral-100)', boxShadow: SHADOW_HERO }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SkeletonBlock width={120} height={24} radius={6} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <SkeletonBlock width={150} height={14} radius={4} />
              <SkeletonBlock width={80} height={22} radius={6} />
            </div>
            <SkeletonBlock width={300} height={14} radius={4} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
            <SkeletonBlock width={110} height={32} radius={6} />
            <SkeletonBlock width={140} height={14} radius={4} />
          </div>
          <SkeletonBlock width="100%" height={4} radius={2} />
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <SkeletonBlock width={150} height={13} radius={4} />
            <div style={{ display: 'flex', gap: 10 }}>
              <SkeletonBlock width={130} height={32} radius={8} />
              <SkeletonBlock width={110} height={32} radius={8} />
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ background: 'var(--neutral-white, #fff)', borderRadius: 8, padding: 12, boxShadow: SHADOW_TILE, flex: '1 1 200px', minWidth: 160, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <SkeletonBlock width={110} height={14} radius={4} />
              <SkeletonBlock width={60} height={24} radius={6} />
              <SkeletonBlock width={130} height={13} radius={4} />
            </div>
          ))}
        </div>

        {/* Payment section card */}
        <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 16, boxShadow: SHADOW_CARD, display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 12, paddingBottom: 12, overflow: 'hidden', width: '100%' }}>
          <div style={{ borderBottom: '1px solid var(--neutral-100)', padding: '0 24px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: '1 0 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <SkeletonBlock width={80} height={16} radius={4} />
              <SkeletonBlock width={210} height={14} radius={4} />
            </div>
          </div>
          <div style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <SkeletonBlock width={44} height={28} radius={6} />
            <div style={{ flex: '1 0 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <SkeletonBlock width={180} height={16} radius={4} />
              <SkeletonBlock width={100} height={14} radius={4} />
            </div>
            <SkeletonBlock width={150} height={32} radius={8} />
          </div>
        </div>

        {/* Invoice history section card */}
        <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 16, boxShadow: SHADOW_CARD, display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 12, paddingBottom: 12, overflow: 'hidden', width: '100%' }}>
          <div style={{ borderBottom: '1px solid var(--neutral-100)', padding: '0 24px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: '1 0 0' }}><SkeletonBlock width={120} height={16} radius={4} /></div>
            <SkeletonBlock width={100} height={32} radius={8} />
          </div>
          <div style={{ padding: '0 24px 12px' }}>
            <div style={{ background: 'var(--neutral-white, #fff)', borderRadius: 8, padding: 12, boxShadow: SHADOW_TILE }}>
              <div style={{ display: 'flex', gap: 24, padding: '0 12px 12px', borderBottom: '1px solid var(--neutral-100)' }}>
                {['Date', 'Amount', 'Status'].map(k => <SkeletonBlock key={k} width={55} height={13} radius={4} />)}
                <div style={{ width: 200, display: 'flex', justifyContent: 'center' }}><SkeletonBlock width={55} height={13} radius={4} /></div>
              </div>
              {[0, 1, 2].map((i, idx) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 24, padding: 12, borderBottom: idx < 2 ? '1px solid var(--neutral-100)' : undefined }}>
                  <SkeletonBlock width={80} height={14} radius={4} />
                  <SkeletonBlock width={60} height={14} radius={4} />
                  <SkeletonBlock width={45} height={20} radius={6} />
                  <div style={{ width: 200, display: 'flex', justifyContent: 'center' }}><SkeletonBlock width={36} height={14} radius={4} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────────

// ── Page — branches on account type ────────────────────────────────────────────
// One route for everyone (individual, org member, org admin). `orgReady`
// gates the branch so an org account never flashes the personal view while its
// org id is still resolving (see org-context.tsx).
export default function PlansAndBillingPage() {
  const { orgId, orgReady } = useOrg()
  if (!orgReady) {
    return (
      <div className="kaya-scrollbar" style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '64px 24px 48px' }}>
        <PlansPageSkeleton />
      </div>
    )
  }
  return orgId ? <OrgBillingView /> : <PersonalBillingView />
}

function OrgBillingView() {
  const router = useRouter()
  const { org, orgId, orgRole, plan, members: orgMembers, refreshMembers } = useOrg()

  const isEnterprise = org.plan === 'enterprise'

  const [billing,        setBilling]        = useState<BillingInfo | null>(null)
  const [billingLoading, setBillingLoading] = useState(true)
  const [capModalOpen,      setCapModalOpen]      = useState(false)
  const [savingCap,         setSavingCap]         = useState(false)
  const [showCancelDialog,  setShowCancelDialog]  = useState(false)
  const [isCanceling,       setIsCanceling]       = useState(false)
  const [isResuming,        setIsResuming]        = useState(false)

  // Prefer the role resolved for the billing entity itself. This is the role
  // the Stripe endpoints authorize; orgRole is only the loading fallback.
  const billingRole = resolveOrgBillingRole({
    orgRole,
    billingRole: billing?.entity === 'org' ? billing.role : null,
    activeOrgId: orgId,
    billingOrgId: billing?.entity === 'org' ? billing.org_id : null,
  })
  const isAdmin = billingRole === 'admin'
  const effectivePlan = plan

  const membersCount = orgMembers.length

  // Everything below comes straight from the plan endpoint (getOrgPlan, validated
  // by planResponseSchema) — the single source of truth. No merge with
  // /stripe/billing and no business-default fallbacks; the `?? 0`/`?? null` here
  // is only null-safety while the plan loads. USD fields stay in USD; the credit
  // view converts via `toCredits` (credits = USD × 1000).
  const toCredits = (usd: number) => Math.round(usd * 1000)

  const providerUsage     = effectivePlan?.providerUsageUsd ?? 0
  const includedUsage     = effectivePlan?.includedUsageUsd ?? 0
  const projectedInvoice  = effectivePlan?.projectedInvoiceUsd ?? 0
  const poolCapUsd        = effectivePlan?.poolCapUsd ?? null
  // The backend's own overage_usd is capped at the admin-set overage limit (it's
  // used server-side to derive the invoice), so it silently under-reports once
  // usage actually exceeds that limit. Recompute the true, uncapped overage
  // client-side and use that everywhere in this UI instead — the backend field
  // is only used below to back out baseFeeUsd, matching how the backend itself
  // derived projectedInvoiceUsd (base fee + capped overage).
  const backendOverageUsd = effectivePlan?.overageUsd ?? 0
  const trueOverageUsd    = Math.max(providerUsage - includedUsage, 0)
  const baseFeeUsd        = Math.max(projectedInvoice - backendOverageUsd, 0)

  const hasUnlimitedEnterpriseCap = poolCapUsd == null || poolCapUsd >= ENTERPRISE_INTERMAX
  // Owner-set ceiling on overage spend *above* the included allowance (backend
  // overage_limit / pool_cap). Usage up to the included amount is always
  // permitted; this only caps metered overage beyond it. `null` ⇒ unlimited.
  const overageCapUsd = hasUnlimitedEnterpriseCap ? null : poolCapUsd
  const overageUsedPct = overageCapUsd && overageCapUsd > 0
    ? Math.min(100, (trueOverageUsd / overageCapUsd) * 100)
    : 0

  // Credit view. Teams: the prepaid shared pool (already credits from the plan).
  // Enterprise: total/remaining reflect the TRUE ceiling — included allowance
  // plus the overage cap when one is set — not just the included allowance.
  // Otherwise "Credits Remaining" reads as 0 (and the progress bar as 100%)
  // the moment usage crosses the included amount, even with plenty of overage
  // budget still left. Falls back to the included-only view when the cap is
  // unlimited, since there's no finite ceiling to measure against there.
  const enterpriseCeilingUsd = overageCapUsd != null ? includedUsage + overageCapUsd : null
  const totalCredits   = isEnterprise
    ? toCredits(enterpriseCeilingUsd ?? includedUsage)
    : (effectivePlan?.totalCredits ?? 0)
  const remainingCreds = isEnterprise
    ? toCredits(Math.max((enterpriseCeilingUsd ?? includedUsage) - providerUsage, 0))
    : (effectivePlan?.remaining ?? 0)
  const usedCredits    = isEnterprise ? toCredits(providerUsage) : (effectivePlan?.used ?? 0)

  // The interactive tier slider/annual toggle used to live inline here — moved
  // entirely to ORG_CHANGE_PLAN_ROUTE, so this page just displays the current
  // plan's real price rather than previewing a hypothetical one.
  //
  // A brand-new org has never had any credits granted at all — plan_credits,
  // topup_credits, and used are all 0, so totalCredits is 0 — until an admin
  // actually completes a Stripe checkout (there's no backend signal to check
  // instead: GET /organizations/{id}/plan's plan_type defaults to "teams"
  // unconditionally for any non-enterprise org, whether or not one was ever
  // purchased). Previously `TIERS.findIndex` returning -1 for "no match"
  // silently fell back to TIERS[0] ($125/mo), presenting the cheapest paid
  // tier as the org's "Active" plan for anyone who hadn't chosen one yet.
  const hasPlan = isEnterprise || totalCredits > 0
  const currentTierIdx = useMemo(() => TIERS.findIndex(t => t.credits === totalCredits), [totalCredits])
  const tier        = TIERS[currentTierIdx] ?? TIERS[0]
  const tierMonthly  = org.billingCycle === 'annual' ? Math.round(tier.price * 0.75) : tier.price

  // Fetch billing data. Payment/Invoices below are admin-only (the backend's
  // visiblePlan() zeroes billing/usage fields for any non-admin — see ST2/ST3
  // in the spec tracker), but the Plan card's cancel/next-billing state is
  // shown to everyone, so this fetches regardless of role.
  useEffect(() => {
    if (!orgId) return
    fetchBilling()
      .then(setBilling)
      .catch(console.error)
      .finally(() => setBillingLoading(false))
  }, [orgId])

  const pm = billing?.payment_method
  const cardBrand = (pm?.brand ?? 'visa') as CardBrand

  const handleStripePortal = async () => {
    if (!isAdmin) {
      toast.error('Only an organization admin can manage billing.')
      return
    }
    const url = await openBillingPortal()
    if (url) window.open(url, '_blank')
    else toast.error('Could not open billing portal.')
  }

  const handleExportAllInvoices = () => {
    const urls = (billing?.invoices ?? [])
      .map(inv => inv.invoice_pdf ?? inv.invoice_url)
      .filter((url): url is string => !!url)
    if (urls.length === 0) {
      toast.error('No invoices to export.')
      return
    }
    urls.forEach(url => window.open(url, '_blank', 'noopener,noreferrer'))
    toast.success(urls.length === 1 ? 'Opened 1 invoice' : `Opened ${urls.length} invoices`)
  }

  const reloadBilling = () => fetchBilling().then(setBilling).catch(console.error)

  // Cancel / resume the organization subscription — same flow as Settings → Billing.
  const handleCancelSubscription = async () => {
    if (!isAdmin) {
      toast.error('Only an organization admin can manage billing.')
      return
    }
    setIsCanceling(true)
    try {
      await cancelSubscription()
      setShowCancelDialog(false)
      toast.success(`Plan canceled — access continues until ${nextBilling}`)
      await reloadBilling()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel subscription')
    } finally {
      setIsCanceling(false)
    }
  }

  const handleResumeSubscription = async () => {
    if (!isAdmin) {
      toast.error('Only an organization admin can manage billing.')
      return
    }
    setIsResuming(true)
    try {
      await resumeSubscription()
      toast.success('Subscription resumed successfully')
      await reloadBilling()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to resume subscription')
    } finally {
      setIsResuming(false)
    }
  }

  const handleRequestPlanChange = () => {
    toast.info('Contact an organization admin to change the plan.')
  }

  const handleRequestCapChange = () => {
    toast.info('Contact an organization admin to change the spend limit.')
  }

  // Persist the overage limit. `null` ⇒ unlimited (sent as the INTERMAX sentinel).
  const handleSaveCap = async (valueUsd: number | null) => {
    if (!orgId) return
    setSavingCap(true)
    try {
      await setOrgPoolCap(orgId, valueUsd == null ? ENTERPRISE_INTERMAX : valueUsd)
      refreshMembers() // re-fetch the shared plan so usage stays live instead of freezing this snapshot
      setCapModalOpen(false)
      toast.success('Spend limit updated.')
    } catch {
      toast.error('Failed to update spend limit.')
    } finally {
      setSavingCap(false)
    }
  }

  // Billing-cycle dates.
  const now          = new Date()
  const cycleStart   = new Date(now.getFullYear(), now.getMonth(), 1)
  const cycleEnd     = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const fmtShort     = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const nextBilling  = fmtDate(billing?.current_period_end) !== '—'
    ? fmtDate(billing?.current_period_end)
    : fmtShort(cycleEnd)

  if (billingLoading) {
    return (
      <div className="kaya-scrollbar" style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '64px 24px 48px' }}>
        <PlansPageSkeleton />
      </div>
    )
  }

  // ── Hero (Enterprise only — see the Teams-case rewrite below) ────────────────
  const hero = isEnterprise ? (
    <EnterpriseHero
      nextBilling={nextBilling}
      usageAsOf={fmtDate(now.toISOString())}
      totalCredits={totalCredits}
      usedCredits={usedCredits}
      remainingCredits={remainingCreds}
      providerUsage={providerUsage}
      includedUsage={includedUsage}
      overageUsd={trueOverageUsd}
      projectedInvoice={projectedInvoice}
      baseFeeUsd={baseFeeUsd}
      cycleLabel={`${fmtShort(cycleStart)} – ${fmtShort(cycleEnd)}`}
    />
  ) : null
  const cancelAtPeriodEnd = billing?.cancel_at_period_end ?? false

  return (
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
        padding:        '64px 24px 48px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 1080, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Page header */}
        <div style={{ paddingLeft: 4 }}>
          <h1 style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
            Plan &amp; Billing
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
            {isEnterprise
              ? '$250 monthly platform fee with $125 of provider usage included.'
              // Figma 18:24652's exact text — same subtitle the Members page
              // uses (a copy-paste there), kept verbatim per "match 1:1,
              // all text".
              : 'Manage who has access to your workspace and what they can do.'}
          </p>
        </div>

        {isEnterprise ? (
          <>
            {hero}
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
              <StatTile label="Shared credits"    value={totalCredits.toLocaleString()}   sub={`Resets ${nextBilling}`} />
              <StatTile
                label="Credits Remaining"
                value={remainingCreds.toLocaleString()}
                sub={usedCredits > totalCredits
                  ? `${(usedCredits - totalCredits).toLocaleString()} credits over plan`
                  : `${usedCredits.toLocaleString()} used this month`}
              />
              <StatTile label="Seats used"        value={String(membersCount)}            sub="Unlimited seats" />
              <div style={{
                background:    'var(--neutral-white, #fff)',
                borderRadius:  8,
                padding:       12,
                boxShadow:     SHADOW_TILE,
                display:       'flex',
                flexDirection: 'column',
                gap:           6,
                flex:          '1 1 220px',
                minWidth:      200,
              }}>
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
                  Monthly caps
                </p>
                <p style={{ flex: '1 0 0', fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
                  Set per-member credit caps for this organization.
                </p>
                {isAdmin && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button variant="secondary" onClick={() => router.push(ORG_MEMBERS_ROUTE)}>Manage caps</Button>
                  </div>
                )}
              </div>
            </div>

            <SpendLimitCard
              overageCapUsd={overageCapUsd}
              overage={trueOverageUsd}
              overageUsedPct={overageUsedPct}
              includedUsage={includedUsage}
              isAdmin={isAdmin}
              onEdit={() => setCapModalOpen(true)}
              onRequest={handleRequestCapChange}
            />
          </>
        ) : (
          /* Figma 18:25119: two compact cards side by side — Plan, and Credits
             Remaining. The old inline tier slider/annual toggle moved entirely
             to ORG_CHANGE_PLAN_ROUTE (what "Upgrade Plan" already opens) rather
             than living here too. */
          <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 0 0', minWidth: 280, display: 'flex' }}>
            <SectionCard
              title="Plan"
              action={
                hasPlan
                  ? <Badge label={cancelAtPeriodEnd ? 'Canceling' : 'Active'} tone={cancelAtPeriodEnd ? 'red' : 'green'} />
                  : <Badge label="No plan selected" tone="neutral" />
              }
              headerDivider={false}
            >
              {hasPlan ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: '1 0 0', minWidth: 0 }}>
                    <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
                      {org.name} · ${tierMonthly}/mo
                    </p>
                    <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
                      {cancelAtPeriodEnd ? `Access ends ${nextBilling}` : `Next billing date: ${nextBilling}`}
                    </p>
                  </div>
                  {isAdmin ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                      {/* Not in Figma's static frame, but cancel/resume needs to stay
                          reachable now that it no longer lives in a hero footer. */}
                      {cancelAtPeriodEnd ? (
                        <button
                          type="button"
                          onClick={() => { void handleResumeSubscription() }}
                          disabled={isResuming}
                          style={{ background: 'none', border: 'none', padding: 0, cursor: isResuming ? 'default' : 'pointer', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--blue-700)', textDecoration: 'underline', opacity: isResuming ? 0.6 : 1, whiteSpace: 'nowrap' }}
                        >
                          {isResuming ? 'Resuming…' : 'Resume plan'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowCancelDialog(true)}
                          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--red-700)', textDecoration: 'underline', whiteSpace: 'nowrap' }}
                        >
                          Cancel plan
                        </button>
                      )}
                      <Button variant="default" onClick={() => router.push(ORG_CHANGE_PLAN_ROUTE)}>Upgrade Plan</Button>
                    </div>
                  ) : (
                    <Button variant="secondary" onClick={handleRequestPlanChange}>Request plan change</Button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: '1 0 0', minWidth: 0 }}>
                    <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
                      {org.name}
                    </p>
                    <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
                      Choose a plan to start using paid credits.
                    </p>
                  </div>
                  {isAdmin ? (
                    <Button variant="default" onClick={() => router.push(ORG_CHANGE_PLAN_ROUTE)}>Choose a plan</Button>
                  ) : (
                    <Button variant="secondary" onClick={handleRequestPlanChange}>Request plan change</Button>
                  )}
                </div>
              )}
            </SectionCard>
            </div>

            <div style={{ flex: '1 0 0', minWidth: 280, display: 'flex' }}>
            <SectionCard title="Credits Remaining" headerDivider={false}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                  <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0, whiteSpace: 'nowrap' }}>
                    {usedCredits.toLocaleString()}/{totalCredits.toLocaleString()}
                  </p>
                  <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
                    credits consumed
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <Button variant="secondary" onClick={() => router.push(ORG_ANALYTICS_ROUTE)}>View usage</Button>
                </div>
              </div>
            </SectionCard>
            </div>
          </div>
        )}

        {/* Payment — admin-only; the backend returns empty billing info to anyone else */}
        {isAdmin && (
          <SectionCard title="Payment" subtitle="Manage your billing details.">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <CardBrandLogo brand={cardBrand} />
              <div style={{ flex: '1 0 0', minWidth: 0 }}>
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
                  {billingLoading ? 'Loading…' : pm ? `Card ending in ${pm.last4 ?? '••••'}` : 'No payment method on file'}
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
                  {pm?.exp_month && pm?.exp_year
                    ? `Expiry ${String(pm.exp_month).padStart(2, '0')}/${pm.exp_year}`
                    : 'Add a card to continue.'}
                </p>
              </div>
              <Button variant="secondary" onClick={handleStripePortal}>Manage on Stripe</Button>
            </div>
          </SectionCard>
        )}

        {/* Invoice history — admin-only; the backend returns empty billing info to anyone else */}
        {isAdmin && (
          <SectionCard
            title="Invoice history"
            action={<Button variant="secondary" onClick={handleExportAllInvoices}>Export all</Button>}
            bodyPadding="0 24px 12px"
          >
            <InvoiceTable billing={billing} loading={billingLoading} />
          </SectionCard>
        )}
      </div>

      {/* Modals */}
      {showCancelDialog && (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
        <div
          onClick={() => { if (!isCanceling) setShowCancelDialog(false) }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.28)',
            backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
        >
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--neutral-white, #fff)', borderRadius: 16, padding: 24, width: 400, maxWidth: 'calc(100vw - 32px)',
              boxShadow: SHADOW_MODAL, display: 'flex', flexDirection: 'column', gap: 20,
            }}
          >
            <div>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 16, lineHeight: '24px', color: 'var(--neutral-900)', margin: 0 }}>
                Cancel subscription?
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: '8px 0 0' }}>
                Your plan stays active until <strong style={{ color: 'var(--neutral-900)' }}>{nextBilling}</strong>. After that you lose access to paid features.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button variant="secondary" disabled={isCanceling} onClick={() => setShowCancelDialog(false)}>
                Keep plan
              </Button>
              <Button variant="danger" loading={isCanceling} onClick={() => { void handleCancelSubscription() }}>
                Yes, cancel
              </Button>
            </div>
          </div>
        </div>
      )}
      {isAdmin && isEnterprise && capModalOpen && (
        <SpendCapModal
          currentCapUsd={overageCapUsd}
          includedUsage={includedUsage}
          saving={savingCap}
          onSave={handleSaveCap}
          onClose={() => setCapModalOpen(false)}
        />
      )}
    </div>
  )
}

// ── Personal (individual, non-org) view ────────────────────────────────────────
// Ported from the retired src/app/(app)/settings/(shell)/billing/page.tsx.
// Reuses this file's own SectionCard/StatTile/Badge/InvoiceTable/ModalShell/
// BuyMoreCreditsModal rather than that page's separate components, so both
// account types share one visual language. Unlike the org view above, an
// individual account has no admin/member distinction — the equivalents of
// isAdmin/canSeeCredits/canSeePayment/canSeeInvoices are all unconditionally
// true here, and isEnterprise is always false (individuals are never on an
// Enterprise contract).

function PersonalUsageRow({ label, used, total }: { label: string; used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.max(0, (used / total) * 100)) : 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, width: '100%' }}>
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0, flex: '1 0 0', minWidth: 0 }}>
          {label}
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0, whiteSpace: 'nowrap' }}>
          {fmtNum(used)} / {fmtNum(total)}
        </p>
      </div>
      <div style={{ position: 'relative', height: 4, borderRadius: 2, background: 'var(--neutral-100)', width: '100%' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: 4, borderRadius: 2, background: 'var(--neutral-900)', width: `${pct}%`, transition: 'width 0.3s ease' }} />
      </div>
    </div>
  )
}

function PersonalBillingView() {
  const router = useRouter()
  const { user, refreshUser, isHydrated, jwtToken } = useAuth()
  const portalMounted = useMounted()

  // Lazy-init from the cached snapshot (runs once; SSR-safe) so returning from
  // Stripe paints instantly instead of flashing an empty "No Plan" state.
  const [billing,       setBilling]       = useState<BillingInfo | null>(() => readCache<BillingInfo>(PERSONAL_BILL_KEY))
  const [billingLoaded, setBillingLoaded] = useState(false)
  const [snap]                            = useState<PersonalBillingSnapshot | null>(() => readCache<PersonalBillingSnapshot>(PERSONAL_SNAP_KEY))
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [isCanceling,      setIsCanceling]      = useState(false)
  const [isResuming,       setIsResuming]       = useState(false)
  const [isClaimingTrial,  setIsClaimingTrial]  = useState(false)

  const didInit = useRef(false)

  const reload = useCallback(async () => {
    await Promise.all([
      refreshUser(),
      fetchBilling()
        .then(b => { if (b) { setBilling(b); writeCache(PERSONAL_BILL_KEY, b) } })
        .catch(() => {})
        .finally(() => setBillingLoaded(true)),
    ])
  }, [refreshUser])

  // First real load — only once auth is hydrated and a token is available.
  useEffect(() => {
    if (!isHydrated || !jwtToken || didInit.current) return
    didInit.current = true
    void reload()
  }, [isHydrated, jwtToken, reload])

  // Returning from Stripe: the webhook may lag a beat, so re-fetch a few times.
  useEffect(() => {
    if (!isHydrated || !jwtToken || !isStripeReturn()) return
    const timers = [1200, 3000, 6000].map(ms => window.setTimeout(() => { void reload() }, ms))
    return () => timers.forEach(t => window.clearTimeout(t))
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

  // Refresh on any balance change (e.g. a topup).
  useEffect(() => {
    const onCreditsUpdated = () => { void reload() }
    window.addEventListener('credits:updated', onCreditsUpdated)
    return () => window.removeEventListener('credits:updated', onCreditsUpdated)
  }, [reload])

  const liveReady = isHydrated && !!user && billingLoaded
  const nextBillingRaw = billing?.upcoming_invoice?.next_payment_date ?? user?.nextBillingDate ?? user?.currentPeriodEnd
  const nextBillingLive = isFutureIso(nextBillingRaw) ? fmtDate(nextBillingRaw) : '—'
  const billingBalance = creditsFromBilling(billing?.credits ?? null)
  const billingPerCategory = billing?.credits?.by_category ?? { chat: 0, persona: 0, brain: 0 }

  const liveSnap: PersonalBillingSnapshot | null = liveReady
    ? {
        planType:         billing?.plan_type ?? user?.planType ?? null,
        creditsTotal:     (billing?.credits ? billingBalance.total : null) ?? user?.creditsTotal ?? snap?.creditsTotal ?? 0,
        creditsRemaining: (billing?.credits ? billingBalance.remaining : null) ?? user?.creditsRemaining ?? 0,
        creditsUsed:      billingBalance.used ?? user?.creditsUsed ?? 0,
        chatCredits:      Math.round((billingPerCategory.chat ?? 0) * 1000),
        personaCredits:   Math.round((billingPerCategory.persona ?? 0) * 1000),
        brainCredits:     Math.round((billingPerCategory.brain ?? 0) * 1000),
        nextBilling:      nextBillingLive,
        periodEnd:        billing?.current_period_end ?? user?.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: billing?.cancel_at_period_end ?? user?.cancelAtPeriodEnd ?? false,
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
  const individualPlan   = planType && planType in PLAN_PRICES ? planType : null
  const isTrialUser      = !planType && creditsTotal > 0
  const planName         = individualPlan ? individualPlan.charAt(0).toUpperCase() + individualPlan.slice(1) : (isTrialUser ? 'Trial' : null)
  const planPrice        = individualPlan ? (PLAN_PRICES[individualPlan] ?? 0) : 0
  const planFeatures     = individualPlan ? (PLAN_FEATURE_LIST[individualPlan] ?? []) : []
  const hasActiveSub     = Boolean(individualPlan)
  const hasPlan          = hasActiveSub || isTrialUser
  const chatCredits      = display?.chatCredits    ?? 0
  const personaCredits   = display?.personaCredits ?? 0
  const brainCredits     = display?.brainCredits   ?? 0
  const nextBilling      = display?.nextBilling    ?? '—'
  const periodEnd        = display?.periodEnd      ?? null
  const cancelAtPeriodEnd = display?.cancelAtPeriodEnd ?? false

  const pm        = billing?.payment_method ?? null
  const cardBrand = (pm?.brand ?? 'unknown') as CardBrand
  const invoices  = billing?.invoices ?? []
  const billingPending = !billing && !billingLoaded

  const now          = new Date()
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const resetDate     = nextBilling !== '—' ? nextBilling : fmtDate(nextMonthStart.toISOString())

  const handleStripePortal = async () => {
    const url = await openBillingPortal()
    if (url) window.open(url, '_blank')
    else toast.error('Could not open billing portal.')
  }

  const handleExportAllInvoices = () => {
    const urls = invoices.map(inv => inv.invoice_pdf ?? inv.invoice_url).filter((u): u is string => !!u)
    if (urls.length === 0) { toast.error('No invoices to export.'); return }
    urls.forEach(url => window.open(url, '_blank', 'noopener,noreferrer'))
    toast.success(urls.length === 1 ? 'Opened 1 invoice' : `Opened ${urls.length} invoices`)
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

  const handleResumeSubscription = async () => {
    setIsResuming(true)
    try {
      await resumeSubscription()
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
      await startTrial()
      toast.success('1,000 free trial credits added to your account.')
      await reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not claim free credits')
    } finally {
      setIsClaimingTrial(false)
    }
  }

  if (showSkeleton) {
    return (
      <div className="kaya-scrollbar" style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '64px 24px 48px' }}>
        <PlansPageSkeleton />
      </div>
    )
  }

  return (
    <div className="kaya-scrollbar" style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '64px 24px 48px' }}>
      <div style={{ width: '100%', maxWidth: 1080, display: 'flex', flexDirection: 'column', gap: 12 }}>

        <div style={{ paddingLeft: 4 }}>
          <h1 style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
            Plan &amp; Billing
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
            Manage your plan, monitor credit consumption, and download invoices.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 0 0', minWidth: 280 }}>
            <SectionCard
              title="Plan"
              action={
                hasPlan
                  ? <Badge label={cancelAtPeriodEnd ? 'Canceling' : (isTrialUser ? 'Free Trial' : 'Active')} tone={cancelAtPeriodEnd ? 'red' : (isTrialUser ? 'blue' : 'green')} />
                  : <Badge label="No plan selected" tone="neutral" />
              }
              headerDivider={false}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: '1 0 0', minWidth: 0 }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
                    {hasPlan ? `${planName} Plan${planPrice > 0 ? ` · $${planPrice}/mo` : ''}` : 'No plan selected'}
                  </p>
                  <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
                    {isTrialUser
                      ? `${fmtNum(creditsRemaining)} of ${fmtNum(creditsTotal)} trial credits remaining`
                      : cancelAtPeriodEnd
                        ? `Access ends ${fmtDate(periodEnd)}`
                        : hasPlan
                          ? `Next billing date: ${nextBilling}`
                          : 'Choose a plan to start using paid credits.'}
                  </p>
                  {planFeatures.length > 0 && (
                    <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-500)', margin: '4px 0 0' }}>
                      {planFeatures.join(' · ')}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  {hasActiveSub && !cancelAtPeriodEnd && (
                    <button
                      type="button"
                      onClick={() => setShowCancelDialog(true)}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--red-700)', textDecoration: 'underline', whiteSpace: 'nowrap' }}
                    >
                      Cancel plan
                    </button>
                  )}
                  {hasActiveSub && cancelAtPeriodEnd && (
                    <button
                      type="button"
                      onClick={() => { void handleResumeSubscription() }}
                      disabled={isResuming}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: isResuming ? 'default' : 'pointer', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--blue-700)', textDecoration: 'underline', opacity: isResuming ? 0.6 : 1, whiteSpace: 'nowrap' }}
                    >
                      {isResuming ? 'Resuming…' : 'Resume plan'}
                    </button>
                  )}
                  {isTrialUser && billingLoaded && !billing?.credits?.trial && (
                    <Button variant="secondary" leftIcon={<TokenCircleIcon size={16} animated />} loading={isClaimingTrial} onClick={() => { void handleClaimTrial() }}>
                      Claim free 1,000 credits
                    </Button>
                  )}
                  <Button variant="default" onClick={() => router.push(SETTINGS_BILLING_CHANGE_PLAN_ROUTE)}>
                    {hasPlan ? 'Change Plan' : 'Choose a plan'}
                  </Button>
                </div>
              </div>
            </SectionCard>
          </div>

          <div style={{ flex: '1 0 0', minWidth: 280 }}>
            <SectionCard title="Credits Remaining" headerDivider={false}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                  <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0, whiteSpace: 'nowrap' }}>
                    {fmtNum(creditsUsed)}/{fmtNum(creditsTotal)}
                  </p>
                  <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
                    credits consumed
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <Button variant="secondary" onClick={() => router.push(SETTINGS_USAGE_ROUTE)}>View usage</Button>
                </div>
              </div>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-500)', margin: '6px 0 0' }}>
                {cancelAtPeriodEnd ? 'No further resets' : `Resets ${resetDate}`}
              </p>
            </SectionCard>
          </div>
        </div>

        <SectionCard title="This month's usage" subtitle={cancelAtPeriodEnd ? 'No further resets' : `Resets ${resetDate}`} bodyGap={16}>
          <PersonalUsageRow label="Chat"      used={chatCredits}    total={creditsTotal} />
          <PersonalUsageRow label="AI Agents" used={personaCredits} total={creditsTotal} />
          <PersonalUsageRow label="Brain"     used={brainCredits}   total={creditsTotal} />
        </SectionCard>

        <SectionCard title="Payment" subtitle="Manage your billing details.">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <CardBrandLogo brand={cardBrand} />
            <div style={{ flex: '1 0 0', minWidth: 0 }}>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
                {billingPending ? 'Loading…' : pm && pm.last4 ? `Card ending in ${pm.last4}` : 'No payment method on file'}
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
                {pm?.exp_month && pm?.exp_year ? `Expiry ${String(pm.exp_month).padStart(2, '0')}/${pm.exp_year}` : 'Add a card to continue.'}
              </p>
            </div>
            <Button variant="secondary" onClick={() => { void handleStripePortal() }}>Manage on Stripe</Button>
          </div>
        </SectionCard>

        <SectionCard
          title="Invoice history"
          action={<Button variant="secondary" onClick={handleExportAllInvoices}>Export all</Button>}
          bodyPadding="0 24px 12px"
        >
          <InvoiceTable billing={billing} loading={billingPending} />
        </SectionCard>
      </div>

      {showCancelDialog && (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
        <div
          onClick={() => { if (!isCanceling) setShowCancelDialog(false) }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.28)',
            backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
        >
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--neutral-white, #fff)', borderRadius: 16, padding: 24, width: 400, maxWidth: 'calc(100vw - 32px)',
              boxShadow: SHADOW_MODAL, display: 'flex', flexDirection: 'column', gap: 20,
            }}
          >
            <div>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 16, lineHeight: '24px', color: 'var(--neutral-900)', margin: 0 }}>
                Cancel subscription?
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: '8px 0 0' }}>
                Your plan stays active until <strong style={{ color: 'var(--neutral-900)' }}>{fmtDate(periodEnd)}</strong>. After that you lose access to paid features.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button variant="secondary" disabled={isCanceling} onClick={() => setShowCancelDialog(false)}>
                Keep plan
              </Button>
              <Button variant="danger" loading={isCanceling} onClick={() => { void handleCancelSubscription() }}>
                Yes, cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Admin permissions panel (admin view) ──────────────────────────────────────

function PermToggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      style={{
        position:   'relative',
        width:      34,
        height:     20,
        borderRadius: 20,
        border:     'none',
        padding:    0,
        cursor:     'pointer',
        flexShrink: 0,
        background: checked ? 'var(--blue-400, #6e98cb)' : 'var(--neutral-100, #ede1d7)',
        boxShadow:  checked
          ? '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(19,84,135,0.7)'
          : '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(182,172,164,0.4)',
        transition: 'background 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      <span style={{
        position:     'absolute',
        top:          2,
        left:         checked ? 16 : 2,
        width:        16,
        height:       16,
        borderRadius: '50%',
        background:   'white',
        boxShadow:    checked
          ? '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(19,84,135,0.4), inset 0px -1px 0px 0px rgba(18,60,95,0.15)'
          : '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(182,172,164,0.4), inset 0px -1px 0px 0px rgba(106,98,93,0.05)',
        transition:   'left 0.15s ease',
      }} />
    </button>
  )
}

// ── Enterprise hero ───────────────────────────────────────────────────────────

function EnterpriseHero({
  nextBilling,
  usageAsOf,
  totalCredits,
  usedCredits,
  remainingCredits,
  providerUsage,
  includedUsage,
  overageUsd,
  projectedInvoice,
  baseFeeUsd,
  cycleLabel,
}: {
  nextBilling:    string
  usageAsOf:      string
  totalCredits: number
  usedCredits: number
  remainingCredits: number
  providerUsage: number
  includedUsage: number
  overageUsd: number
  projectedInvoice: number
  baseFeeUsd: number
  cycleLabel:     string
}) {
  const pct = totalCredits > 0 ? Math.min(100, (usedCredits / totalCredits) * 100) : 0
  return (
    <HeroShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
          Enterprise Plan
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
            Next billing: {nextBilling}
          </p>
          <Badge label={`$${Math.round(baseFeeUsd)}/month`} tone="blue" />
        </div>
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
          Shared credits · Unlimited seats · {fmtCredits(includedUsage)} included credits · Usage as of {usageAsOf}
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
        <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
          {remainingCredits.toLocaleString()}
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
          credits remaining
        </p>
      </div>

      <ProgressBar pct={pct} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-600)' }}>
          Cycle: {cycleLabel}
        </span>
        <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-white, #fff)' }}>
          {usedCredits.toLocaleString()} of {totalCredits.toLocaleString()} credits used
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Badge
          label={overageUsd > 0
            ? `${fmtCredits(overageUsd)} credits overage`
            : `${fmtCredits(Math.max(includedUsage - providerUsage, 0))} included credits left`}
          tone={overageUsd > 0 ? 'red' : 'green'}
        />
        <Badge label={`${fmtUsd(projectedInvoice)} projected invoice`} tone="neutral" />
      </div>
    </HeroShell>
  )
}

/** Gradient hero panel shell. The Figma fill uses preserveAspectRatio=none → stretch. */
function HeroShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      borderRadius:    8,
      padding:         24,
      display:         'flex',
      flexDirection:   'column',
      gap:             16,
      boxShadow:       SHADOW_HERO,
      backgroundImage: HERO_GRADIENT_TEAMS,
      backgroundSize:  '100% 100%',
      backgroundRepeat: 'no-repeat',
      overflow:        'hidden',
    }}>
      {children}
    </div>
  )
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div style={{ position: 'relative', height: 4, borderRadius: 2, background: 'white', width: '100%' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, height: 4, borderRadius: 2, background: 'var(--neutral-900)', width: `${pct}%`, transition: 'width 0.3s ease' }} />
      <div style={{ position: 'absolute', left: `calc(${pct}% - 5px)`, top: '50%', transform: 'translateY(-50%)', width: 10, height: 10, borderRadius: '50%', background: 'var(--neutral-900)', boxShadow: '0 0 0 2px white' }} />
    </div>
  )
}

// ── Invoice table ─────────────────────────────────────────────────────────────

function InvoiceTable({ billing, loading }: { billing: BillingInfo | null; loading: boolean }) {
  const invoices = billing?.invoices ?? []

  const cellHead: React.CSSProperties = { flex: '1 0 0', minWidth: 0, fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)' }
  const cellBody: React.CSSProperties = { flex: '1 0 0', minWidth: 0, fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)' }

  return (
    <div style={{
      background:   'var(--neutral-white, #fff)',
      borderRadius: 8,
      padding:      12,
      boxShadow:    SHADOW_TILE,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', gap: 24, padding: '0 12px 12px', borderBottom: '1px solid var(--neutral-100)' }}>
        <span style={cellHead}>Date</span>
        <span style={cellHead}>Amount</span>
        <span style={cellHead}>Status</span>
        <span style={{ width: 200, textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)' }}>Actions</span>
      </div>

      {loading ? (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-500)', textAlign: 'center', padding: 24, margin: 0 }}>Loading invoices…</p>
      ) : invoices.length === 0 ? (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-500)', textAlign: 'center', padding: 24, margin: 0 }}>No invoices yet.</p>
      ) : (
        invoices.map((inv, i) => {
          const paid = inv.status === 'paid'
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 24, padding: 12, borderBottom: i < invoices.length - 1 ? '1px solid var(--neutral-100)' : undefined }}>
              <span style={cellBody}>{fmtDate(inv.created)}</span>
              <span style={cellBody}>{fmtUsd(inv.amount_paid ?? 0)}</span>
              <div style={{ flex: '1 0 0', minWidth: 0 }}>
                <Badge label={paid ? 'Paid' : (inv.status ?? 'Open')} tone={paid ? 'green' : 'red'} />
              </div>
              <div style={{ width: 200, display: 'flex', justifyContent: 'center' }}>
                {inv.invoice_pdf || inv.invoice_url ? (
                  <a
                    href={(inv.invoice_pdf ?? inv.invoice_url)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-700)', textDecoration: 'underline' }}
                  >
                    View
                  </a>
                ) : (
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: 'var(--neutral-400)' }}>View</span>
                )}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

// ── Modal shell ───────────────────────────────────────────────────────────────

function ModalShell({
  title,
  subtitle,
  maxWidth,
  onClose,
  children,
  footer,
  footerNote,
}: {
  title:       string
  subtitle:    string
  maxWidth:    number
  onClose:     () => void
  children:    React.ReactNode
  footer:      React.ReactNode
  footerNote:  string
}) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(18,12,8,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div style={{ background: 'var(--neutral-50, #f7f2ed)', borderRadius: 20, padding: 8, boxShadow: SHADOW_MODAL, width: '100%', maxWidth, maxHeight: 'calc(100dvh - 48px)', overflow: 'auto' }} className="kaya-scrollbar">
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Header */}
          <div style={{ borderBottom: '1px solid var(--neutral-100)', padding: '0 12px 24px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <p style={{ flex: '1 0 0', fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>{title}</p>
            <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, display: 'flex', color: 'var(--neutral-700)' }}>
              <CancelOneIcon size={20} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Subtitle */}
            <div style={{ padding: '0 12px 24px' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>{subtitle}</p>
            </div>
            {children}
            {/* Footer */}
            <div style={{ padding: '24px 0 12px', display: 'flex', flexDirection: 'column', gap: 9 }}>
              {footer}
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>{footerNote}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function InputField({
  label,
  value,
  onChange,
  prefix,
  placeholder,
}: {
  label:        string
  value:        string
  onChange:     (v: string) => void
  prefix?:      string
  placeholder?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
      <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-700)', margin: 0 }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'white', borderRadius: 10, padding: '7px 10px', boxShadow: SHADOW_INPUT }}>
        {prefix && <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-600)', padding: '0 2px' }}>{prefix}</span>}
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ flex: '1 0 0', minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', padding: '0 2px' }}
        />
      </div>
    </div>
  )
}

// ── Overage spend limit (Enterprise) ──────────────────────────────────────────
//
// Enterprise usage is unlimited by default and billed in arrears. An admin can
// cap the *overage* — usage billed beyond the $125 included each month. The cap
// never restricts the included allowance, only spend past it (backend
// EnterpriseContract.overage_limit; `null` here ⇒ the INTERMAX "unlimited" sentinel).

function SpendLimitCard({
  overageCapUsd,
  overage,
  overageUsedPct,
  includedUsage,
  isAdmin,
  onEdit,
  onRequest,
}: {
  overageCapUsd:  number | null
  overage:        number
  overageUsedPct: number
  includedUsage:  number
  isAdmin:        boolean
  onEdit:         () => void
  onRequest:      () => void
}) {
  const unlimited = overageCapUsd == null
  return (
    <SectionCard
      title="Overage spend limit"
      subtitle={`Caps usage billed beyond the ${fmtCredits(includedUsage)} included credits each month. Usage up to the included amount is always allowed.`}
      action={
        isAdmin
          ? <Button variant="secondary" onClick={onEdit}>Edit limit</Button>
          : <Button variant="secondary" onClick={onRequest}>Request change</Button>
      }
    >
      {unlimited ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: '1 0 0', minWidth: 0 }}>
            <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
              Unlimited
            </p>
          </div>
          <Badge label="No cap" tone="neutral" />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
            <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
              {fmtCredits(overageCapUsd)}
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
              credits / month overage cap
            </p>
          </div>
          <div style={{ position: 'relative', height: 4, borderRadius: 2, background: 'var(--neutral-100)', width: '100%' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, height: 4, borderRadius: 2, background: overageUsedPct >= 100 ? 'var(--red-700)' : 'var(--neutral-900)', width: `${overageUsedPct}%`, transition: 'width 0.3s ease' }} />
          </div>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
            {fmtCredits(overage)} of {fmtCredits(overageCapUsd)} credits used · {Math.round(overageUsedPct)}% of limit
          </p>
        </div>
      )}
    </SectionCard>
  )
}

function SpendCapModal({
  currentCapUsd,
  includedUsage,
  saving,
  onSave,
  onClose,
}: {
  currentCapUsd: number | null
  includedUsage: number
  saving:        boolean
  onSave:        (valueUsd: number | null) => void
  onClose:       () => void
}) {
  // Edited in credits; the backend stores the limit in USD, so convert on save.
  const [unlimited, setUnlimited] = useState(currentCapUsd == null)
  const [value,     setValue]     = useState(
    currentCapUsd != null ? String(Math.round(currentCapUsd * CREDITS_PER_USD)) : '',
  )

  const parsedCredits = parseFloat(value)
  const valid  = unlimited || (!isNaN(parsedCredits) && parsedCredits >= 0)

  const handleSave = () => {
    if (!valid) { toast.error('Enter a valid amount.'); return }
    onSave(unlimited ? null : parsedCredits / CREDITS_PER_USD)
  }

  return (
    <ModalShell
      title="Overage spend limit"
      subtitle={`Set the maximum usage billed beyond the ${fmtCredits(includedUsage)} included credits each month. The included allowance is never restricted — only spend past it.`}
      maxWidth={560}
      onClose={onClose}
      footer={
        <Button variant="default" fluid onClick={handleSave} loading={saving} disabled={!valid}>
          Save limit
        </Button>
      }
      footerNote="Usage that would exceed the limit is paused until the next cycle or until the limit is raised."
    >
      <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 16, padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: '1 0 0', minWidth: 0 }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
              No limit
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
              Allow unlimited overage, billed at exact provider cost.
            </p>
          </div>
          <PermToggle checked={unlimited} onChange={() => setUnlimited(u => !u)} />
        </div>
        {!unlimited && (
          <InputField label="Cap overage at (credits, above included)" value={value} onChange={setValue} placeholder="e.g. 500,000" />
        )}
      </div>
    </ModalShell>
  )
}
