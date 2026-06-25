'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CancelOneIcon, PenOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { CardBrandLogo, type CardBrand } from '@/components/CardBrandLogo'
import { useOrg } from '@/context/org-context'
import {
  fetchBilling,
  openBillingPortal,
  chargeTopUp,
  type BillingInfo,
} from '@/lib/api/stripe'
import { getOrgSettings, setOrgPoolCap, updateOrgSettings } from '@/lib/api/organization'
import type { AdminBillingPerms, OrgPlan } from '@/types/teams'

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

// Top-up packs (DECISIONS.md) — labels/prices per Figma "Buy more credits".
const TOP_UPS = [
  { badge: 'Small',    credits: 1_000,  price: 2 },
  { badge: 'Save 7%',  credits: 5_000,  price: 10 },
  { badge: 'Save 10%', credits: 15_000, price: 30 },
  { badge: 'Save 15%', credits: 50_000, price: 100 },
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
}: {
  title:        string
  subtitle?:    string
  action?:      React.ReactNode
  children:     React.ReactNode
  bodyPadding?: string
  bodyGap?:     number
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
        borderBottom: '1px solid var(--neutral-100)',
        padding:      '0 24px 24px',
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
      <div style={{ padding: bodyPadding, display: 'flex', flexDirection: 'column', gap: bodyGap }}>
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

export default function OrgBillingPage() {
  const router = useRouter()
  const { org, orgId, orgRole, plan, members: orgMembers } = useOrg()

  const isOwner      = orgRole === 'owner'
  const isEnterprise = org.plan === 'enterprise'

  const [billing,        setBilling]        = useState<BillingInfo | null>(null)
  const [billingLoading, setBillingLoading] = useState(true)
  const [buyCreditsOpen, setBuyCreditsOpen] = useState(false)
  const [localPlan,      setLocalPlan]      = useState<OrgPlan | null>(null)
  const [capModalOpen,      setCapModalOpen]      = useState(false)
  const [savingCap,         setSavingCap]         = useState(false)
  const [contactSalesOpen,  setContactSalesOpen]  = useState(false)

  const [adminBillingPerms, setAdminBillingPerms] = useState<AdminBillingPerms>({
    canTopUp:         true,
    canManagePayment: true,
    canViewInvoices:  true,
  })
  const [settingsLoading, setSettingsLoading] = useState(true)
  const effectivePlan = localPlan ?? plan

  const membersCount = orgMembers.length

  // Everything below comes straight from the plan endpoint (getOrgPlan, validated
  // by planResponseSchema) — the single source of truth. No merge with
  // /stripe/billing and no business-default fallbacks; the `?? 0`/`?? null` here
  // is only null-safety while the plan loads. USD fields stay in USD; the credit
  // view converts via `toCredits` (credits = USD × 1000).
  const toCredits = (usd: number) => Math.round(usd * 1000)

  const providerUsage     = effectivePlan?.providerUsageUsd ?? 0
  const includedUsage     = effectivePlan?.includedUsageUsd ?? 0
  const includedRemaining = effectivePlan?.includedUsageRemainingUsd ?? 0
  const overage           = effectivePlan?.overageUsd ?? 0
  const projectedInvoice  = effectivePlan?.projectedInvoiceUsd ?? 0
  const poolCapUsd        = effectivePlan?.poolCapUsd ?? null
  // base fee = projected invoice − overage (compute_enterprise_billing).
  const baseFeeUsd        = Math.max(projectedInvoice - overage, 0)

  // Credit view. Teams: the prepaid shared pool (already credits from the plan).
  // Enterprise: the included allowance / provider usage, expressed in credits.
  const totalCredits   = isEnterprise ? toCredits(includedUsage)        : (effectivePlan?.totalCredits ?? 0)
  const remainingCreds = isEnterprise ? toCredits(includedRemaining)    : (effectivePlan?.remaining ?? 0)
  const usedCredits    = isEnterprise ? toCredits(providerUsage)        : (effectivePlan?.used ?? 0)

  const hasUnlimitedEnterpriseCap = poolCapUsd == null || poolCapUsd >= ENTERPRISE_INTERMAX
  // Owner-set ceiling on overage spend *above* the included allowance (backend
  // overage_limit / pool_cap). Usage up to the included amount is always
  // permitted; this only caps metered overage beyond it. `null` ⇒ unlimited.
  const overageCapUsd = hasUnlimitedEnterpriseCap ? null : poolCapUsd
  const overageUsedPct = overageCapUsd && overageCapUsd > 0
    ? Math.min(100, (overage / overageCapUsd) * 100)
    : 0

  const currentTierIdx = useMemo(() => {
    const i = TIERS.findIndex(t => t.credits === totalCredits)
    return i >= 0 ? i : 0
  }, [totalCredits])

  const [tierIdx,  setTierIdx]  = useState(currentTierIdx)
  const [annual,   setAnnual]   = useState(org.billingCycle === 'annual')
  // Resync the slider when the backend plan tier resolves (render-phase reset).
  const [seenTierIdx, setSeenTierIdx] = useState(currentTierIdx)
  if (seenTierIdx !== currentTierIdx) {
    setSeenTierIdx(currentTierIdx)
    setTierIdx(currentTierIdx)
  }

  const tier        = TIERS[tierIdx] ?? TIERS[0]
  const tierMonthly = annual ? Math.round(tier.price * 0.75) : tier.price

  // Fetch admin billing permissions from org settings (needed by both roles).
  useEffect(() => {
    if (!orgId) return
    setSettingsLoading(true)
    getOrgSettings(orgId)
      .then(s => setAdminBillingPerms(s.adminBillingPerms))
      .catch(console.error)
      .finally(() => setSettingsLoading(false))
  }, [orgId])

  // Fetch billing data. Owner always fetches; admins fetch once we know their
  // perms — if none of the three billing sections are enabled we skip the call.
  useEffect(() => {
    if (!orgId) return
    if (!isOwner && settingsLoading) return
    if (
      !isOwner &&
      !adminBillingPerms.canTopUp &&
      !adminBillingPerms.canManagePayment &&
      !adminBillingPerms.canViewInvoices
    ) {
      setBillingLoading(false)
      return
    }
    fetchBilling()
      .then(setBilling)
      .catch(console.error)
      .finally(() => setBillingLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, isOwner, settingsLoading])

  const pm = billing?.payment_method
  const cardBrand = (pm?.brand ?? 'visa') as CardBrand

  const handleStripePortal = async () => {
    if (!isOwner) {
      toast.error('Only the organization owner can manage billing.')
      return
    }
    const url = await openBillingPortal()
    if (url) window.open(url, '_blank')
    else toast.error('Could not open billing portal.')
  }

  const handlePermToggle = async (key: keyof AdminBillingPerms) => {
    if (!orgId) return
    const prev = adminBillingPerms
    const next: AdminBillingPerms = { ...prev, [key]: !prev[key] }
    setAdminBillingPerms(next) // optimistic
    try {
      const updated = await updateOrgSettings(orgId, { adminBillingPerms: next })
      setAdminBillingPerms(updated.adminBillingPerms)
    } catch {
      setAdminBillingPerms(prev) // revert on error
      toast.error('Failed to save permission.')
    }
  }

  const handleRequestPlanChange = () => {
    toast.info('Contact your organization owner to change the plan.')
  }

  const handleRequestCapChange = () => {
    toast.info('Contact your organization owner to change the spend limit.')
  }

  // Persist the overage limit. `null` ⇒ unlimited (sent as the INTERMAX sentinel).
  const handleSaveCap = async (valueUsd: number | null) => {
    if (!orgId) return
    setSavingCap(true)
    try {
      const updated = await setOrgPoolCap(orgId, valueUsd == null ? ENTERPRISE_INTERMAX : valueUsd)
      setLocalPlan(updated)
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

  if (settingsLoading || (isOwner && billingLoading)) {
    return (
      <div className="kaya-scrollbar" style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '64px 24px 48px' }}>
        <PlansPageSkeleton />
      </div>
    )
  }

  // Effective per-section visibility for the current user.
  const canSeeCredits  = isOwner || adminBillingPerms.canTopUp
  const canSeePayment  = isOwner || adminBillingPerms.canManagePayment
  const canSeeInvoices = isOwner || adminBillingPerms.canViewInvoices

  // ── Hero ──────────────────────────────────────────────────────────────────────
  const hero = isEnterprise ? (
    <EnterpriseHero
      nextBilling={nextBilling}
      usageAsOf={fmtDate(now.toISOString())}
      totalCredits={totalCredits}
      usedCredits={usedCredits}
      remainingCredits={remainingCreds}
      providerUsage={providerUsage}
      includedUsage={includedUsage}
      overage={overage}
      projectedInvoice={projectedInvoice}
      baseFeeUsd={baseFeeUsd}
      cycleLabel={`${fmtShort(cycleStart)} – ${fmtShort(cycleEnd)}`}
    />
  ) : (
    <TeamsHero
      isOwner={isOwner}
      nextBilling={nextBilling}
      monthlyPrice={tierMonthly}
      tierIdx={tierIdx}
      onTierChange={setTierIdx}
      annual={annual}
      onAnnualChange={setAnnual}
      onContactSales={() => setContactSalesOpen(true)}
      onUpgrade={() => router.push('/org/change-plan')}
      onRequestPlanChange={handleRequestPlanChange}
    />
  )

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
            Billing
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
            {isEnterprise
              ? '$250 monthly platform fee with $125 of provider usage included.'
              : 'Shared prepaid usage for your organization.'}
          </p>
        </div>

        {hero}

        {isEnterprise ? (
          <>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
              <StatTile label="Shared credits"    value={totalCredits.toLocaleString()}   sub={`Resets ${nextBilling}`} />
              <StatTile label="Credits Remaining" value={remainingCreds.toLocaleString()} sub={`${usedCredits.toLocaleString()} used this month`} />
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
                {canSeeCredits && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button variant="secondary" onClick={() => router.push('/org/members')}>Manage caps</Button>
                  </div>
                )}
              </div>
            </div>

            <SpendLimitCard
              overageCapUsd={overageCapUsd}
              overage={overage}
              overageUsedPct={overageUsedPct}
              includedUsage={includedUsage}
              isOwner={isOwner}
              onEdit={() => setCapModalOpen(true)}
              onRequest={handleRequestCapChange}
            />
          </>
        ) : (
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            <StatTile label="Shared credits"    value={totalCredits.toLocaleString()}   sub={`Resets ${nextBilling}`} />
            <StatTile label="Credits Remaining" value={remainingCreds.toLocaleString()} sub={`${usedCredits.toLocaleString()} used this month`} />
            <StatTile label="Seats used"        value={String(membersCount)}            sub="Unlimited seats" />
            {/* Need more credits */}
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
                Need more credits ?
              </p>
              <p style={{ flex: '1 0 0', fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
                Top-up packs. Unused credits roll 1 billing cycle.
              </p>
              {canSeeCredits && (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button variant="secondary" onClick={() => setBuyCreditsOpen(true)}>Buy more Credits</Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Payment — visible when owner OR admin with canManagePayment */}
        {canSeePayment && (
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

        {/* Admin permissions — owner control panel */}
        {isOwner && !isEnterprise && (
          <AdminPermissionsPanel
            perms={adminBillingPerms}
            onToggle={handlePermToggle}
          />
        )}

        {/* Invoice history — visible when owner OR admin with canViewInvoices */}
        {canSeeInvoices && (
          <SectionCard
            title="Invoice history"
            action={<Button variant="secondary" onClick={() => toast.success('Exporting all invoices…')}>Export all</Button>}
            bodyPadding="0 24px 12px"
          >
            <InvoiceTable billing={billing} loading={billingLoading} />
          </SectionCard>
        )}
      </div>

      {/* Modals */}
      {canSeeCredits && !isEnterprise && buyCreditsOpen && (
        <BuyMoreCreditsModal onClose={() => setBuyCreditsOpen(false)} billing={billing} cardBrand={cardBrand} />
      )}
      {contactSalesOpen && (
        <ContactSalesModal onClose={() => setContactSalesOpen(false)} />
      )}
      {isOwner && isEnterprise && capModalOpen && (
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

// ── Admin permissions panel (owner view) ──────────────────────────────────────

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

const PERM_ROWS: Array<{
  key:      keyof AdminBillingPerms
  title:    string
  subtitle: string
}> = [
  { key: 'canTopUp',         title: 'Add credits / top up',  subtitle: 'Buy credits, within the spend cap.' },
  { key: 'canManagePayment', title: 'Manage payment method', subtitle: 'View and update the card on file.' },
  { key: 'canViewInvoices',  title: 'View invoices',         subtitle: 'See and download billing history.' },
]

function AdminPermissionsPanel({
  perms,
  onToggle,
}: {
  perms:    AdminBillingPerms
  onToggle: (key: keyof AdminBillingPerms) => void
}) {
  return (
    <SectionCard
      title="Admin permissions"
      subtitle="Applies to everyone with the Admin role."
      bodyPadding="12px 24px"
      bodyGap={12}
    >
      {PERM_ROWS.map(({ key, title, subtitle }) => (
        <div
          key={key}
          style={{
            background:    'white',
            borderRadius:  16,
            padding:       12,
            boxShadow:     SHADOW_TILE,
            display:       'flex',
            alignItems:    'center',
            gap:           8,
          }}
        >
          <div style={{ flex: '1 0 0', minWidth: 0 }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
              {title}
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
              {subtitle}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <PermToggle checked={perms[key]} onChange={() => onToggle(key)} />
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', minWidth: 24 }}>
              {perms[key] ? 'On' : 'Off'}
            </span>
          </div>
        </div>
      ))}

      {/* Change plan — always owner-only, no toggle */}
      <div
        style={{
          background:    'white',
          borderRadius:  16,
          padding:       12,
          boxShadow:     SHADOW_TILE,
          display:       'flex',
          alignItems:    'center',
          gap:           8,
        }}
      >
        <div style={{ flex: '1 0 0', minWidth: 0 }}>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
            Change plan
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
            Switch tiers or cancel the subscription.
          </p>
        </div>
        <Badge label="Owner only" tone="yellow" />
      </div>
    </SectionCard>
  )
}

// ── Teams hero ──────────────────────────────────────────────────────────────────

function TeamsHero({
  isOwner,
  nextBilling,
  monthlyPrice,
  tierIdx,
  onTierChange,
  annual,
  onAnnualChange,
  onContactSales,
  onUpgrade,
  onRequestPlanChange,
}: {
  isOwner:             boolean
  nextBilling:         string
  monthlyPrice:        number
  tierIdx:             number
  onTierChange:        (i: number) => void
  annual:              boolean
  onAnnualChange:      (v: boolean) => void
  onContactSales:      () => void
  onUpgrade:           () => void
  onRequestPlanChange: () => void
}) {
  const tier = TIERS[tierIdx] ?? TIERS[0]
  return (
    <HeroShell>
      {/* Header block */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
          Team Plan
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
            Next billing: {nextBilling}
          </p>
          <Badge label={`${monthlyPrice}$/month`} tone="blue" />
        </div>
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
          Shared credits · Unlimited seats · Admin controls · Audit trail
        </p>
      </div>

      {/* Owner: cycle toggle */}
      {isOwner && (
        <div style={{
          display:      'inline-flex',
          alignSelf:    'flex-start',
          alignItems:   'center',
          gap:          4,
          padding:      4,
          borderRadius: 10,
          background:   'rgba(247,242,237,0.5)',
          boxShadow:    'inset 0px -1px 0px 0px rgba(255,255,255,0.9), inset 0px 1px 0px 0px var(--neutral-100), inset 0px 0px 4px 0px rgba(209,198,189,0.5)',
        }}>
          <CycleTab active={!annual} onClick={() => onAnnualChange(false)}>Monthly</CycleTab>
          <CycleTab active={annual}  onClick={() => onAnnualChange(true)}>Yearly</CycleTab>
          <Badge label="Save 25%" tone="yellow" />
        </div>
      )}

      {/* Price */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
        <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
          ${monthlyPrice}/month
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
          {tier.credits.toLocaleString()} credits/month
        </p>
      </div>

      {isOwner ? (
        <>
          <TierSlider tierIdx={tierIdx} onChange={onTierChange} />
          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
            <p style={{ fontFamily: 'var(--font-code)', fontWeight: 400, fontSize: 13, lineHeight: '16px', color: 'var(--neutral-500)', margin: 0 }}>
              Need an extra discount to join the Enterprise plan.{' '}
              <button
                type="button"
                onClick={onContactSales}
                style={{ fontFamily: 'var(--font-code)', fontSize: 13, color: 'var(--neutral-black, #000)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Contact us →
              </button>
            </p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Button variant="secondary" onClick={onContactSales}>Contact Sales Team</Button>
              <Button variant="default" onClick={onUpgrade}>Upgrade plan</Button>
            </div>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex' }}>
          <Button variant="secondary" onClick={onRequestPlanChange}>Request plan change</Button>
        </div>
      )}
    </HeroShell>
  )
}

function CycleTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  if (active) {
    return <Button variant="default" onClick={onClick}>{children}</Button>
  }
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontFamily:   'var(--font-body)',
        fontWeight:   500,
        fontSize:     14,
        lineHeight:   '22px',
        color:        'var(--neutral-500)',
        background:   'none',
        border:       'none',
        cursor:       'pointer',
        padding:      '7px 10px',
        borderRadius: 10,
      }}
    >
      {children}
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
  overage,
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
  overage: number
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
          label={overage > 0
            ? `${fmtCredits(overage)} credits overage`
            : `${fmtCredits(Math.max(includedUsage - providerUsage, 0))} included credits left`}
          tone={overage > 0 ? 'red' : 'green'}
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

// ── Tier slider (interactive) ─────────────────────────────────────────────────

function TierSlider({ tierIdx, onChange }: { tierIdx: number; onChange: (i: number) => void }) {
  const n   = TIERS.length
  const pct = n > 1 ? (tierIdx / (n - 1)) * 100 : 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        role="slider"
        aria-valuemin={0}
        aria-valuemax={n - 1}
        aria-valuenow={tierIdx}
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp')   onChange(Math.min(n - 1, tierIdx + 1))
          if (e.key === 'ArrowLeft'  || e.key === 'ArrowDown') onChange(Math.max(0, tierIdx - 1))
        }}
        onClick={e => {
          const rect = e.currentTarget.getBoundingClientRect()
          const ratio = (e.clientX - rect.left) / rect.width
          onChange(Math.max(0, Math.min(n - 1, Math.round(ratio * (n - 1)))))
        }}
        style={{ position: 'relative', height: 14, display: 'flex', alignItems: 'center', cursor: 'pointer', outline: 'none' }}
      >
        <div style={{ position: 'relative', height: 4, borderRadius: 2, background: 'white', width: '100%' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, height: 4, borderRadius: 2, background: 'var(--neutral-900)', width: `${pct}%` }} />
          <div style={{ position: 'absolute', left: `calc(${pct}% - 5px)`, top: '50%', transform: 'translateY(-50%)', width: 10, height: 10, borderRadius: '50%', background: 'var(--neutral-900)', boxShadow: '0 0 0 2px white' }} />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {TIERS.map((t, i) => (
          <button
            key={t.price}
            type="button"
            onClick={() => onChange(i)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
          >
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: i === tierIdx ? 600 : 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-900)' }}>
              ${t.price}/mo
            </span>
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-600)' }}>
              {(t.credits / 1000).toFixed(0)}k
            </span>
          </button>
        ))}
      </div>
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

// ── Buy more credits modal ───────────────────────────────────────────────────

function BuyMoreCreditsModal({
  onClose,
  billing,
  cardBrand,
}: {
  onClose:   () => void
  billing:   BillingInfo | null
  cardBrand: CardBrand
}) {
  const [selected,  setSelected]  = useState(1)
  const [custom,    setCustom]    = useState('')
  const [threshold, setThreshold] = useState('100')
  const [paying,    setPaying]    = useState(false)

  const pm        = billing?.payment_method
  const usingCustom = custom.trim() !== ''
  const amountUsd = usingCustom ? (parseFloat(custom) || 0) : TOP_UPS[selected]!.price
  const credits   = usingCustom ? Math.round(amountUsd * 1000) : TOP_UPS[selected]!.credits
  const tax       = +(amountUsd * 0.0).toFixed(2)
  const total     = amountUsd + tax

  const handlePay = async () => {
    if (amountUsd < 1) { toast.error('Minimum $1'); return }
    if (!pm)           { toast.error('No payment method on file.'); return }
    setPaying(true)
    try {
      await chargeTopUp({ amount_usd: amountUsd })
      toast.success('Credits added successfully!')
      onClose()
    } catch {
      toast.error('Payment failed. Please try again.')
    } finally {
      setPaying(false)
    }
  }

  return (
    <ModalShell
      title="Buy more credits"
      subtitle="Top up automatically when your balance runs low, so usage never pauses."
      maxWidth={720}
      onClose={onClose}
      footer={
        <Button variant="default" fluid onClick={handlePay} loading={paying} disabled={!pm}>
          {`Pay ${fmtUsd(total)} now`}
        </Button>
      }
      footerNote="By clicking Pay now, you allow Souvenir to charge your card in the amount above."
    >
      {/* Packs + inputs */}
      <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 16, padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {TOP_UPS.map((p, i) => {
            const active = !usingCustom && selected === i
            return (
              <button
                key={p.badge}
                type="button"
                onClick={() => { setSelected(i); setCustom('') }}
                style={{
                  flex: '1 1 120px', minWidth: 110,
                  background: 'white', borderRadius: 8, padding: 12,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9,
                  cursor: 'pointer', border: 'none',
                  boxShadow: active
                    ? `${SHADOW_CARD}, 0px 0px 0px 1.5px var(--blue-400)`
                    : SHADOW_TILE,
                }}
              >
                <Badge label={p.badge} tone="neutral" />
                <span style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--blue-700)' }}>${p.price}</span>
                <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)' }}>{p.credits.toLocaleString()} credits</span>
              </button>
            )
          })}
        </div>
        <InputField label="Other" value={custom} onChange={setCustom} placeholder="Amount" />
        <InputField label="Recharge when balance falls below" value={threshold} onChange={setThreshold} prefix="$" />
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
          We&apos;ll add the recharge amount automatically whenever your balance drops under this.
        </p>
      </div>

      {/* Summary */}
      <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ borderBottom: '1px solid var(--neutral-100)', padding: 24, display: 'flex', flexDirection: 'column', gap: 9 }}>
          <SummaryRow label="Extra credits" value={`${credits.toLocaleString()} credits`} />
          <SummaryRow label="Estimated tax" value={fmtUsd(tax)} />
        </div>
        <div style={{ padding: 24 }}>
          <SummaryRow label="Total due" value={fmtUsd(total)} />
        </div>
      </div>

      {/* Payment method */}
      <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 16, padding: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <p style={{ flex: '1 0 0', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>Payment method</p>
        <CardBrandLogo brand={cardBrand} />
        <div>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
            {pm ? `Card ending in ${pm.last4 ?? '••••'}` : 'No card on file'}
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
            {pm?.exp_month && pm?.exp_year ? `Expiry ${String(pm.exp_month).padStart(2, '0')}/${pm.exp_year}` : '—'}
          </p>
        </div>
        <button aria-label="Edit payment method" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 10, display: 'flex', color: 'var(--neutral-700)' }}>
          <PenOneIcon size={20} />
        </button>
      </div>
    </ModalShell>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ flex: '1 0 0', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)' }}>{value}</span>
    </div>
  )
}

// ── Contact sales modal ───────────────────────────────────────────────────────

function ContactSalesModal({ onClose }: { onClose: () => void }) {
  const [email,    setEmail]    = useState('')
  const [name,     setName]     = useState('')
  const [company,  setCompany]  = useState('')
  const [teamSize, setTeamSize] = useState('1-5')
  const [message,  setMessage]  = useState('')
  const [sending,  setSending]  = useState(false)

  const handleSubmit = async () => {
    setSending(true)
    try {
      // TODO: wire up real sales API / CRM endpoint
      await new Promise<void>(r => setTimeout(r, 800))
      toast.success("We'll be in touch within one business day.")
      onClose()
    } finally {
      setSending(false)
    }
  }

  return (
    <ModalShell
      title="Contact sales"
      subtitle="Deploy the Autonomous Company Brain to your team. We'll scope seats, governance, and rollout."
      maxWidth={738}
      onClose={onClose}
      footer={
        <Button variant="default" fluid onClick={handleSubmit} loading={sending}>
          Contact sales
        </Button>
      }
      footerNote="Response within one business day."
    >
      <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 16, padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Row 1 */}
        <div style={{ display: 'flex', gap: 12 }}>
          <InputField label="Work email"  value={email}   onChange={setEmail}   placeholder="you@company.com" />
          <InputField label="Full name"   value={name}    onChange={setName}    placeholder="Jane Smith" />
        </div>
        {/* Row 2 */}
        <div style={{ display: 'flex', gap: 12 }}>
          <InputField label="Company" value={company} onChange={setCompany} placeholder="Acme Inc." />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-700)', margin: 0 }}>
              Team size
            </p>
            <div style={{ display: 'flex', alignItems: 'center', background: 'white', borderRadius: 10, padding: '7px 10px', boxShadow: SHADOW_INPUT }}>
              <select
                value={teamSize}
                onChange={e => setTeamSize(e.target.value)}
                style={{ flex: '1 0 0', minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', cursor: 'pointer' }}
              >
                <option value="1-5">1 – 5</option>
                <option value="6-20">6 – 20</option>
                <option value="21-50">21 – 50</option>
                <option value="51-200">51 – 200</option>
                <option value="201+">201+</option>
              </select>
            </div>
          </div>
        </div>
        {/* Textarea */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-700)', margin: 0 }}>
            What are you trying to solve?
          </p>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Tell us about your use case…"
            rows={4}
            style={{ width: '100%', boxSizing: 'border-box', border: 'none', outline: 'none', background: 'white', borderRadius: 10, padding: '9px 12px', boxShadow: SHADOW_INPUT, fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', resize: 'none' }}
          />
        </div>
      </div>
    </ModalShell>
  )
}

// ── Overage spend limit (Enterprise) ──────────────────────────────────────────
//
// Enterprise usage is unlimited by default and billed in arrears. The owner can
// cap the *overage* — usage billed beyond the $125 included each month. The cap
// never restricts the included allowance, only spend past it (backend
// EnterpriseContract.overage_limit; `null` here ⇒ the INTERMAX "unlimited" sentinel).

function SpendLimitCard({
  overageCapUsd,
  overage,
  overageUsedPct,
  includedUsage,
  isOwner,
  onEdit,
  onRequest,
}: {
  overageCapUsd:  number | null
  overage:        number
  overageUsedPct: number
  includedUsage:  number
  isOwner:        boolean
  onEdit:         () => void
  onRequest:      () => void
}) {
  const unlimited = overageCapUsd == null
  return (
    <SectionCard
      title="Overage spend limit"
      subtitle={`Caps usage billed beyond the ${fmtCredits(includedUsage)} included credits each month. Usage up to the included amount is always allowed.`}
      action={
        isOwner
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
