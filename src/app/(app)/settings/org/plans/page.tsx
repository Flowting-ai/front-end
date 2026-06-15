'use client'

import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/Button'
import { CardBrandLogo } from '@/components/CardBrandLogo'
import { useOrg } from '@/context/org-context'
import {
  fetchBilling,
  openBillingPortal,
  chargeTopUp,
  type BillingInfo,
} from '@/lib/api/stripe'

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  action,
  muted,
}: {
  label:   string
  value:   string | number
  sub?:    string
  action?: React.ReactNode
  muted?:  boolean
}) {
  return (
    <div style={{
      flex:            '1 1 160px',
      minWidth:        0,
      background:      'white',
      borderRadius:    12,
      padding:         '16px 18px',
      boxShadow:       '0px 1px 2px 0px rgba(82,75,71,0.08), 0px 0px 0px 1px var(--neutral-100)',
      display:         'flex',
      flexDirection:   'column',
      gap:             3,
    }}>
      <p style={{
        fontFamily:    'var(--font-body)',
        fontWeight:    500,
        fontSize:      11,
        lineHeight:    '16px',
        color:         'var(--neutral-500)',
        margin:        0,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}>
        {label}
      </p>
      <p style={{
        fontFamily: 'var(--font-title)',
        fontWeight: 400,
        fontSize:   26,
        lineHeight: '34px',
        color:      muted ? 'var(--neutral-400)' : 'var(--neutral-900)',
        margin:     0,
      }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {sub && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-400)', margin: 0 }}>
          {sub}
        </p>
      )}
      {action}
    </div>
  )
}

// ── Buy More Credits modal ────────────────────────────────────────────────────

const CREDIT_PACKS = [
  { credits: 1_000,  price: 10 },
  { credits: 5_000,  price: 45 },
  { credits: 10_000, price: 80 },
  { credits: 25_000, price: 175 },
]

function BuyMoreCreditsModal({
  onClose,
  billing,
}: {
  onClose:  () => void
  billing:  BillingInfo | null
}) {
  const [selectedPack,      setSelectedPack]      = useState(1)
  const [useCustom,         setUseCustom]         = useState(false)
  const [customUsd,         setCustomUsd]         = useState('')
  const [rechargeThreshold, setRechargeThreshold] = useState('')
  const [paying,            setPaying]            = useState(false)

  const pack    = CREDIT_PACKS[selectedPack]
  const amtUsd  = useCustom ? (parseFloat(customUsd) || 0) : pack.price
  const pm      = billing?.payment_method

  const handlePay = async () => {
    if (amtUsd < 1) { toast.error('Minimum $1'); return }
    if (!pm)        { toast.error('No payment method on file.'); return }
    setPaying(true)
    try {
      await chargeTopUp({ amount_usd: amtUsd })
      toast.success('Credits added successfully!')
      onClose()
    } catch {
      toast.error('Payment failed. Please try again.')
    } finally {
      setPaying(false)
    }
  }

  return (
    <div
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         1000,
        background:     'rgba(18,12,8,0.5)',
        backdropFilter: 'blur(2px)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        24,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background:   '#f7f2ed',
        borderRadius: 20,
        width:        '100%',
        maxWidth:     460,
        boxShadow:    '0px 8px 32px rgba(18,12,8,0.22)',
        overflow:     'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '24px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 20, color: 'var(--neutral-900)', margin: 0 }}>
            Buy more credits
          </p>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', color: 'var(--neutral-400)', fontSize: 20, lineHeight: 1, borderRadius: 6 }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '18px 24px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Credit pack options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {CREDIT_PACKS.map((p, i) => {
              const active = !useCustom && selectedPack === i
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => { setSelectedPack(i); setUseCustom(false) }}
                  style={{
                    display:         'flex',
                    alignItems:      'center',
                    justifyContent:  'space-between',
                    padding:         '11px 14px',
                    borderRadius:    10,
                    border:          `1.5px solid ${active ? 'var(--neutral-800)' : 'var(--neutral-200)'}`,
                    background:      active ? 'white' : 'transparent',
                    cursor:          'pointer',
                    textAlign:       'left',
                    transition:      'border-color 0.12s, background 0.12s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: 'var(--neutral-900)' }}>
                      {p.credits.toLocaleString()} credits
                    </span>
                    {i === 1 && (
                      <span style={{
                        fontFamily:  'var(--font-body)',
                        fontSize:    11,
                        fontWeight:  600,
                        padding:     '2px 8px',
                        borderRadius: 99,
                        background:  'var(--blue-100)',
                        color:       'var(--blue-700)',
                      }}>
                        Popular
                      </span>
                    )}
                  </div>
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14, color: 'var(--neutral-700)' }}>
                    ${p.price}
                  </span>
                </button>
              )
            })}

            {/* Other / custom */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => setUseCustom(true)}
              onKeyDown={e => e.key === 'Enter' && setUseCustom(true)}
              style={{
                display:     'flex',
                alignItems:  'center',
                gap:         10,
                padding:     '11px 14px',
                borderRadius: 10,
                border:      `1.5px solid ${useCustom ? 'var(--neutral-800)' : 'var(--neutral-200)'}`,
                background:  useCustom ? 'white' : 'transparent',
                cursor:      'pointer',
              }}
            >
              <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: 'var(--neutral-700)', flexShrink: 0 }}>
                Other
              </span>
              <input
                type="text"
                value={customUsd}
                onChange={e => setCustomUsd(e.target.value)}
                onClick={e => e.stopPropagation()}
                placeholder="$  amount in USD"
                style={{
                  flex:       '1 0 0',
                  border:     'none',
                  background: 'transparent',
                  outline:    'none',
                  fontFamily: 'var(--font-body)',
                  fontSize:   14,
                  color:      'var(--neutral-700)',
                }}
              />
            </div>
          </div>

          {/* Auto-recharge threshold */}
          <div>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, color: 'var(--neutral-700)', margin: '0 0 6px' }}>
              Auto-recharge when below
            </p>
            <div style={{
              display:      'flex',
              alignItems:   'center',
              gap:          8,
              border:       '1.5px solid var(--neutral-200)',
              borderRadius: 8,
              padding:      '8px 12px',
              background:   'white',
            }}>
              <input
                type="text"
                value={rechargeThreshold}
                onChange={e => setRechargeThreshold(e.target.value)}
                placeholder="e.g. 2000"
                style={{ flex: '1 0 0', border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-700)' }}
              />
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-400)', flexShrink: 0 }}>credits</span>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--neutral-200)' }} />

          {/* Summary */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, color: 'var(--neutral-700)', margin: 0 }}>
              Summary
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-600)' }}>
                {useCustom
                  ? (customUsd ? `$${customUsd} USD` : '—')
                  : `${pack.credits.toLocaleString()} credits`}
              </span>
              <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14, color: 'var(--neutral-900)' }}>
                {useCustom ? (customUsd ? `$${customUsd}` : '—') : `$${pack.price}`}
              </span>
            </div>

            {pm ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 2 }}>
                <CardBrandLogo brand={(pm.brand ?? 'visa') as Parameters<typeof CardBrandLogo>[0]['brand']} />
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-600)' }}>
                  {pm.brand ? pm.brand.charAt(0).toUpperCase() + pm.brand.slice(1) : 'Card'} ···· {pm.last4 ?? '••••'}
                </span>
              </div>
            ) : (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-400)', margin: 0 }}>
                No payment method on file
              </p>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button variant="default" size="sm" onClick={handlePay} disabled={paying || !pm}>
              {paying ? 'Processing…' : 'Pay now'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Monthly Spend Cap modal ───────────────────────────────────────────────────

function MonthlySpendCapModal({
  onClose,
  currentCap,
  totalCredits,
  onSaved,
}: {
  onClose:      () => void
  currentCap:   number | null
  totalCredits: number
  onSaved:      (cap: number) => void
}) {
  const [capValue, setCapValue] = useState(currentCap != null ? String(currentCap) : '')
  const [saving,   setSaving]   = useState(false)

  const handleSave = async () => {
    const cap = parseInt(capValue.replace(/[^0-9]/g, ''), 10)
    if (!cap || cap < 1) { toast.error('Enter a valid cap amount'); return }
    setSaving(true)
    try {
      await new Promise<void>(r => setTimeout(r, 500))
      onSaved(cap)
      toast.success('Spend cap saved')
      onClose()
    } catch {
      toast.error('Failed to save spend cap')
    } finally {
      setSaving(false)
    }
  }

  const now        = new Date()
  const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const cycleEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const fmt        = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         1000,
        background:     'rgba(18,12,8,0.5)',
        backdropFilter: 'blur(2px)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        24,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background:   '#f7f2ed',
        borderRadius: 20,
        width:        '100%',
        maxWidth:     400,
        boxShadow:    '0px 8px 32px rgba(18,12,8,0.22)',
        overflow:     'hidden',
      }}>
        <div style={{ padding: '24px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 20, color: 'var(--neutral-900)', margin: 0 }}>
            Monthly spend cap
          </p>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', color: 'var(--neutral-400)', fontSize: 20, lineHeight: 1, borderRadius: 6 }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '18px 24px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, color: 'var(--neutral-700)', margin: '0 0 6px' }}>
              Monthly credit cap
            </p>
            <div style={{
              display:      'flex',
              alignItems:   'center',
              gap:          8,
              border:       '1.5px solid var(--neutral-200)',
              borderRadius: 8,
              padding:      '10px 14px',
              background:   'white',
            }}>
              <input
                autoFocus
                type="text"
                value={capValue}
                onChange={e => setCapValue(e.target.value)}
                placeholder="e.g. 50000"
                style={{ flex: '1 0 0', border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--neutral-900)' }}
              />
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-400)', flexShrink: 0 }}>credits</span>
            </div>
          </div>

          {/* Cycle summary */}
          <div style={{
            background:   'white',
            borderRadius: 10,
            padding:      '12px 14px',
            display:      'flex',
            flexDirection: 'column',
            gap:          4,
            boxShadow:    '0px 0px 0px 1px var(--neutral-100)',
          }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-600)', margin: 0 }}>
              Billing cycle: <strong style={{ color: 'var(--neutral-800)' }}>{fmt(cycleStart)} – {fmt(cycleEnd)}</strong>
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-600)', margin: 0 }}>
              Pool size: <strong style={{ color: 'var(--neutral-800)' }}>{totalCredits.toLocaleString()} credits</strong>
            </p>
          </div>

          {/* Info badge */}
          <div style={{
            display:      'flex',
            gap:          8,
            alignItems:   'flex-start',
            background:   'var(--blue-50)',
            borderRadius: 8,
            padding:      '10px 12px',
          }}>
            <span style={{ fontSize: 14, color: 'var(--blue-500)', flexShrink: 0, marginTop: 1 }}>ⓘ</span>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--blue-700)', margin: 0 }}>
              Setting a cap won&apos;t cancel credits already committed in the current cycle.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button variant="default" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save spend cap'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrgPlansPage() {
  const {
    org,
    orgId,
    orgRole,
    plan,
    members: orgMembers,
    membersLoading,
  } = useOrg()

  const isOwner      = orgRole === 'owner'
  const isAdminish   = orgRole === 'owner' || orgRole === 'admin'
  const isEnterprise = org.plan === 'enterprise'

  const [billing,        setBilling]        = useState<BillingInfo | null>(null)
  const [billingLoading, setBillingLoading] = useState(false)
  const [buyCreditsOpen, setBuyCreditsOpen] = useState(false)
  const [spendCapOpen,   setSpendCapOpen]   = useState(false)
  const [spendCap,       setSpendCap]       = useState<number | null>(null)
  const [adminCanBuy,    setAdminCanBuy]    = useState(false)
  const [adminCanSetCap, setAdminCanSetCap] = useState(false)

  useEffect(() => {
    if (!orgId || !isAdminish) return
    setBillingLoading(true)
    fetchBilling()
      .then(setBilling)
      .catch(console.error)
      .finally(() => setBillingLoading(false))
  }, [orgId, isAdminish])

  const totalCredits   = plan?.totalCredits ?? 0
  const usedCredits    = plan?.used         ?? 0
  const remainingCreds = plan?.remaining    ?? 0
  const membersCount   = orgMembers.length
  const usedPct        = totalCredits > 0 ? Math.min(100, Math.round((usedCredits / totalCredits) * 100)) : 0
  const pm             = billing?.payment_method

  const handleStripePortal = async () => {
    const url = await openBillingPortal()
    if (url) window.open(url, '_blank')
    else toast.error('Could not open billing portal.')
  }

  // ── Plan card gradient ───────────────────────────────────────────────────────
  const planGradient = isEnterprise
    ? 'radial-gradient(ellipse 70% 90% at -5% 115%, rgba(15,40,90,0.75) 0%, transparent 60%), radial-gradient(ellipse 55% 55% at 108% -8%, rgba(8,25,65,0.6) 0%, transparent 55%), #0d1520'
    : 'radial-gradient(ellipse 75% 95% at -8% 118%, rgba(130,65,10,0.75) 0%, transparent 62%), radial-gradient(ellipse 55% 55% at 108% -8%, rgba(70,30,8,0.55) 0%, transparent 55%), #1c1208'

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
      <div style={{ width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* ── Page header ── */}
        <div style={{ paddingLeft: 4, marginBottom: 4 }}>
          <h1 style={{
            fontFamily: 'var(--font-title)',
            fontWeight: 400,
            fontSize:   24,
            lineHeight: '32px',
            color:      'var(--neutral-900)',
            margin:     0,
          }}>
            Plans &amp; Usage
          </h1>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize:   14,
            color:      'var(--neutral-500)',
            margin:     0,
          }}>
            {isOwner
              ? 'Manage your plan, credits, and billing details.'
              : 'View workspace plan and credit usage.'}
          </p>
        </div>

        {/* ── Plan card ── */}
        <div style={{
          borderRadius: 16,
          background:   planGradient,
          padding:      '22px 24px 22px',
          boxShadow:    '0px 2px 10px rgba(18,12,8,0.28)',
          overflow:     'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: isEnterprise ? 18 : 16 }}>
            <div style={{ flex: '1 0 0', minWidth: 0 }}>
              <span style={{
                fontFamily:    'var(--font-body)',
                fontWeight:    600,
                fontSize:      11,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                background:    'rgba(255,255,255,0.14)',
                color:         'rgba(255,255,255,0.85)',
                padding:       '3px 9px',
                borderRadius:  6,
                display:       'inline-block',
                marginBottom:  10,
              }}>
                {isEnterprise ? 'Enterprise' : 'Teams'}
              </span>
              <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 26, lineHeight: '34px', color: 'white', margin: 0 }}>
                {isEnterprise ? 'Enterprise plan' : 'Teams plan'}
              </p>
              {!isEnterprise && (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'rgba(255,255,255,0.55)', margin: '3px 0 0' }}>
                  {org.billingCycle === 'annual'
                    ? `$${org.monthlyPrice}/seat · billed annually`
                    : `$${org.monthlyPrice}/seat/month`}
                </p>
              )}
              {isEnterprise && (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'rgba(255,255,255,0.55)', margin: '3px 0 0' }}>
                  Custom pricing · {membersCount} member{membersCount !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            {/* Billing cycle toggle — Teams + Owner */}
            {!isEnterprise && isOwner && (
              <div style={{
                display:    'flex',
                alignItems: 'center',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: 8,
                padding:    3,
                gap:        2,
                flexShrink: 0,
                marginTop:  2,
              }}>
                {(['monthly', 'annual'] as const).map(cycle => (
                  <button
                    key={cycle}
                    onClick={handleStripePortal}
                    style={{
                      fontFamily:  'var(--font-body)',
                      fontSize:    12,
                      fontWeight:  500,
                      padding:     '5px 12px',
                      borderRadius: 6,
                      border:      'none',
                      cursor:      'pointer',
                      background:  org.billingCycle === cycle ? 'rgba(255,255,255,0.18)' : 'transparent',
                      color:       org.billingCycle === cycle ? 'white' : 'rgba(255,255,255,0.5)',
                    }}
                  >
                    {cycle === 'monthly' ? 'Monthly' : 'Yearly'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Enterprise: usage bar + CTAs */}
          {isEnterprise && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                    Credits used this cycle
                  </span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.75)' }}>
                    {usedCredits.toLocaleString()} / {totalCredits.toLocaleString()}
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.14)', overflow: 'hidden' }}>
                  <div style={{
                    height:     '100%',
                    width:      `${usedPct}%`,
                    background: 'white',
                    borderRadius: 99,
                    transition: 'width 0.3s ease',
                    minWidth:   usedPct > 0 ? 6 : 0,
                  }} />
                </div>
              </div>

              {/* Owner CTAs */}
              {isOwner && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Button variant="secondary" size="sm" onClick={() => setBuyCreditsOpen(true)}>
                    Buy more credits
                  </Button>
                  <button
                    onClick={() => setSpendCapOpen(true)}
                    style={{
                      fontFamily:  'var(--font-body)',
                      fontWeight:  500,
                      fontSize:    13,
                      padding:     '6px 14px',
                      borderRadius: 8,
                      border:      '1.5px solid rgba(255,255,255,0.22)',
                      background:  'transparent',
                      color:       'rgba(255,255,255,0.7)',
                      cursor:      'pointer',
                    }}
                  >
                    {spendCap != null ? `Cap: ${spendCap.toLocaleString()} credits` : 'Set monthly cap'}
                  </button>
                </div>
              )}

              {/* Admin can buy (if owner enabled it) */}
              {!isOwner && isAdminish && adminCanBuy && (
                <Button variant="secondary" size="sm" onClick={() => setBuyCreditsOpen(true)} style={{ alignSelf: 'flex-start' }}>
                  Buy more credits
                </Button>
              )}
            </div>
          )}

          {/* Teams: manage plan */}
          {!isEnterprise && isOwner && (
            <div style={{ marginTop: 4 }}>
              <Button variant="secondary" size="sm" onClick={handleStripePortal}>
                Manage plan →
              </Button>
            </div>
          )}
        </div>

        {/* ── Stats grid ── */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {/* Teams shows Total; Enterprise doesn't (usage is on the card) */}
          {!isEnterprise && (
            <StatCard
              label="Total credits"
              value={totalCredits}
              sub={`${usedPct}% used this cycle`}
            />
          )}
          <StatCard label="Credits used"      value={usedCredits}    sub="this billing cycle" />
          <StatCard label="Credits remaining" value={remainingCreds} />
          <StatCard label="Members"           value={membersCount}   sub="in this workspace" />

          {/* Enterprise extra cards */}
          {isEnterprise && (
            <>
              <StatCard
                label="Monthly spend cap"
                value={spendCap != null ? spendCap.toLocaleString() : '—'}
                sub={spendCap != null ? 'credits / month' : 'no cap set'}
                muted={spendCap == null}
                action={isOwner ? (
                  <button
                    onClick={() => setSpendCapOpen(true)}
                    style={{
                      fontFamily:  'var(--font-body)',
                      fontSize:    12,
                      color:       'var(--blue-500)',
                      background:  'none',
                      border:      'none',
                      cursor:      'pointer',
                      padding:     '4px 0 0',
                      textAlign:   'left',
                    }}
                  >
                    {spendCap != null ? 'Edit cap →' : 'Set cap →'}
                  </button>
                ) : (
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-400)', margin: '4px 0 0' }}>
                    Set by owner
                  </p>
                )}
              />
              <StatCard
                label="Auto-recharge"
                value={plan?.poolStatus ?? 'Off'}
                sub="recharge status"
                action={isOwner ? (
                  <button
                    onClick={() => setBuyCreditsOpen(true)}
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize:   12,
                      color:      'var(--blue-500)',
                      background: 'none',
                      border:     'none',
                      cursor:     'pointer',
                      padding:    '4px 0 0',
                      textAlign:  'left',
                    }}
                  >
                    Configure →
                  </button>
                ) : undefined}
              />
            </>
          )}
        </div>

        {/* ── Payment — Owner only ── */}
        {isOwner && (
          <div style={{
            border:       '1px solid var(--neutral-200)',
            borderRadius: 16,
            boxShadow:    '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
            overflow:     'hidden',
          }}>
            <div style={{ borderBottom: '1px solid var(--neutral-100)', padding: '16px 24px' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 15, color: 'var(--neutral-900)', margin: 0 }}>
                Payment
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-500)', margin: '2px 0 0' }}>
                Billing details and subscription.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 24px' }}>
              {billingLoading ? (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0, flex: '1 0 0' }}>
                  Loading…
                </p>
              ) : pm ? (
                <>
                  <CardBrandLogo brand={(pm.brand ?? 'visa') as Parameters<typeof CardBrandLogo>[0]['brand']} />
                  <div style={{ flex: '1 0 0', minWidth: 0 }}>
                    <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: 'var(--neutral-900)', margin: 0 }}>
                      {pm.brand ? pm.brand.charAt(0).toUpperCase() + pm.brand.slice(1) : 'Card'} ···· {pm.last4 ?? '••••'}
                    </p>
                    {pm.exp_month && pm.exp_year && (
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-400)', margin: 0 }}>
                        Expires {String(pm.exp_month).padStart(2, '0')}/{pm.exp_year}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ flex: '1 0 0', minWidth: 0 }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: 'var(--neutral-900)', margin: 0 }}>
                    No payment method on file
                  </p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-400)', margin: 0 }}>
                    Add a card to continue your subscription.
                  </p>
                </div>
              )}
              <Button variant="secondary" size="sm" onClick={handleStripePortal}>
                Manage on Stripe
              </Button>
            </div>

            {billing?.subscription_status && (
              <div style={{ borderTop: '1px solid var(--neutral-100)', padding: '10px 24px', display: 'flex', alignItems: 'center' }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-500)', margin: 0, flex: '1 0 0' }}>
                  Subscription: <strong style={{ color: 'var(--neutral-800)' }}>{billing.subscription_status}</strong>
                  {billing.current_period_end && (
                    <span style={{ color: 'var(--neutral-400)' }}>
                      {' '}· renews {new Date(billing.current_period_end).toLocaleDateString()}
                    </span>
                  )}
                  {billing.cancel_at_period_end && (
                    <span style={{ color: 'var(--red-500)' }}> · cancels at period end</span>
                  )}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Admin permissions — Owner only ── */}
        {isOwner && (
          <div style={{
            border:       '1px solid var(--neutral-200)',
            borderRadius: 16,
            boxShadow:    '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
            overflow:     'hidden',
          }}>
            <div style={{ borderBottom: '1px solid var(--neutral-100)', padding: '16px 24px' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 15, color: 'var(--neutral-900)', margin: 0 }}>
                Admin permissions
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-500)', margin: '2px 0 0' }}>
                Control what workspace admins can do.
              </p>
            </div>

            {[
              {
                label: 'Allow admins to buy more credits',
                sub:   'Admins can purchase additional credits for the workspace.',
                value: adminCanBuy,
                set:   setAdminCanBuy,
              },
              {
                label: 'Allow admins to set monthly spend cap',
                sub:   'Admins can configure the monthly credit spend limit.',
                value: adminCanSetCap,
                set:   setAdminCanSetCap,
              },
            ].map((row, i, arr) => (
              <div
                key={i}
                style={{
                  display:      'flex',
                  alignItems:   'center',
                  gap:          12,
                  padding:      '14px 24px',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--neutral-100)' : undefined,
                }}
              >
                <div style={{ flex: '1 0 0', minWidth: 0 }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: 'var(--neutral-900)', margin: 0 }}>
                    {row.label}
                  </p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-400)', margin: 0 }}>
                    {row.sub}
                  </p>
                </div>
                <button
                  role="switch"
                  aria-checked={row.value}
                  onClick={() => row.set(v => !v)}
                  style={{
                    width:      40,
                    height:     24,
                    borderRadius: 12,
                    border:     'none',
                    cursor:     'pointer',
                    background: row.value ? 'var(--neutral-900)' : 'var(--neutral-200)',
                    position:   'relative',
                    flexShrink: 0,
                    padding:    0,
                    transition: 'background 0.2s',
                  }}
                >
                  <span style={{
                    display:      'block',
                    width:        18,
                    height:       18,
                    borderRadius: '50%',
                    background:   'white',
                    position:     'absolute',
                    top:          3,
                    left:         row.value ? 19 : 3,
                    transition:   'left 0.18s',
                    boxShadow:    '0 1px 3px rgba(0,0,0,0.22)',
                  }} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Invoice history — Adminish ── */}
        {isAdminish && (
          <div style={{
            border:       '1px solid var(--neutral-200)',
            borderRadius: 16,
            boxShadow:    '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
            overflow:     'hidden',
          }}>
            <div style={{ borderBottom: '1px solid var(--neutral-100)', padding: '16px 24px' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 15, color: 'var(--neutral-900)', margin: 0 }}>
                Invoice history
              </p>
            </div>

            {billingLoading ? (
              <div style={{ padding: '24px', textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>
                  Loading invoices…
                </p>
              </div>
            ) : (billing?.invoices ?? []).length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>
                  No invoices yet.
                </p>
              </div>
            ) : (
              (billing?.invoices ?? []).map((inv, i, arr) => (
                <div
                  key={i}
                  style={{
                    display:      'flex',
                    alignItems:   'center',
                    gap:          12,
                    padding:      '12px 24px',
                    borderBottom: i < arr.length - 1 ? '1px solid var(--neutral-100)' : undefined,
                  }}
                >
                  <div style={{ flex: '1 0 0', minWidth: 0 }}>
                    <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: 'var(--neutral-900)', margin: 0 }}>
                      {inv.created
                        ? new Date(inv.created).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                        : '—'}
                    </p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-400)', margin: 0 }}>
                      ${(inv.amount_paid / 100).toFixed(2)}{inv.currency ? ` ${inv.currency.toUpperCase()}` : ''}
                    </p>
                  </div>

                  <span style={{
                    fontFamily:  'var(--font-body)',
                    fontSize:    12,
                    fontWeight:  500,
                    padding:     '3px 10px',
                    borderRadius: 99,
                    background:  inv.status === 'paid' ? 'var(--green-100)' : 'var(--neutral-100)',
                    color:       inv.status === 'paid' ? 'var(--green-700)' : 'var(--neutral-600)',
                  }}>
                    {inv.status ?? '—'}
                  </span>

                  {inv.invoice_pdf && (
                    <a
                      href={inv.invoice_pdf}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-500)', textDecoration: 'none' }}
                    >
                      PDF ↓
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        )}

      </div>

      {/* ── Modals ── */}
      {buyCreditsOpen && (
        <BuyMoreCreditsModal
          onClose={() => setBuyCreditsOpen(false)}
          billing={billing}
        />
      )}
      {spendCapOpen && (
        <MonthlySpendCapModal
          onClose={() => setSpendCapOpen(false)}
          currentCap={spendCap}
          totalCredits={totalCredits}
          onSaved={cap => setSpendCap(cap)}
        />
      )}
    </div>
  )
}
