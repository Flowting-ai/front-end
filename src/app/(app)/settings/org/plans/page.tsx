'use client'

import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/Button'
import { CardBrandLogo } from '@/components/CardBrandLogo'
import { Avatar } from '@/components/Avatar'
import { useOrg } from '@/context/org-context'
import { setMemberCap } from '@/lib/api/organization'
import {
  fetchBilling,
  openBillingPortal,
  createTopUp,
  cancelSubscription,
  type BillingInfo,
} from '@/lib/api/stripe'
import type { OrgMember } from '@/types/teams'

// ── Card shell ────────────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      border:       '1px solid var(--neutral-200)',
      borderRadius: 16,
      boxShadow:    '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
      overflow:     'hidden',
      ...style,
    }}>
      {children}
    </div>
  )
}

function CardHeader({
  title,
  subtitle,
  action,
}: {
  title:     string
  subtitle?: string
  action?:   React.ReactNode
}) {
  return (
    <div style={{
      borderBottom: '1px solid var(--neutral-100)',
      padding:      '12px 24px 24px',
      display:      'flex',
      alignItems:   'flex-start',
      gap:          12,
    }}>
      <div style={{ flex: '1 0 0', minWidth: 0 }}>
        <p style={{
          fontFamily:   'var(--font-body)',
          fontWeight:   500,
          fontSize:     16,
          lineHeight:   '22px',
          color:        'var(--neutral-900)',
          margin:       '0 0 6px',
        }}>
          {title}
        </p>
        {subtitle && (
          <p style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize:   14,
            lineHeight: '22px',
            color:      'var(--neutral-500)',
            margin:     0,
          }}>
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}

// ── Credit cap input ──────────────────────────────────────────────────────────

function CapInput({
  memberId,
  currentCap,
  orgId,
  onSaved,
}: {
  memberId:   string
  currentCap?: number
  orgId:      string
  onSaved:    (newCap: number | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [value,   setValue]   = useState(currentCap != null ? String(currentCap) : '')
  const [saving,  setSaving]  = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const parsed = value.trim() === '' ? null : Number(value.replace(/[^0-9]/g, ''))
    try {
      await setMemberCap(orgId, memberId, parsed)
      onSaved(parsed)
      setEditing(false)
      toast.success('Credit cap updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update cap')
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        style={{
          background:     'none',
          border:         'none',
          cursor:         'pointer',
          fontFamily:     'var(--font-body)',
          fontSize:       14,
          color:          currentCap != null ? 'var(--neutral-900)' : 'var(--neutral-400)',
          textDecoration: 'underline',
          padding:        0,
        }}
      >
        {currentCap != null ? currentCap.toLocaleString() : 'Set cap'}
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input
        autoFocus
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="e.g. 5000"
        style={{
          width:        90,
          height:       28,
          border:       'none',
          borderRadius: 6,
          padding:      '0 8px',
          fontFamily:   'var(--font-body)',
          fontSize:     14,
          boxShadow:    '0px 0px 0px 1px var(--neutral-200)',
          outline:      'none',
        }}
      />
      <Button variant="default" size="sm" onClick={handleSave} disabled={saving}>
        {saving ? '…' : 'Save'}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
        Cancel
      </Button>
    </div>
  )
}

// ── Top-up amount selector ────────────────────────────────────────────────────

const TOPUP_PRESETS = [25, 50, 100, 200]

function TopUpSelector({ onClose }: { onClose: () => void }) {
  const [amount,  setAmount]  = useState(50)
  const [loading, setLoading] = useState(false)

  const handleBuy = async () => {
    setLoading(true)
    try {
      const res = await createTopUp({ amount_usd: amount })
      window.location.href = res.checkout_url
    } catch {
      toast.error('Failed to start top-up. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      gap:          8,
      padding:      '12px 24px',
      borderTop:    '1px solid var(--neutral-100)',
      flexWrap:     'wrap',
    }}>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-600)', margin: 0, flexShrink: 0 }}>
        Amount (USD):
      </p>
      {TOPUP_PRESETS.map(p => (
        <button
          key={p}
          type="button"
          onClick={() => setAmount(p)}
          style={{
            height:          28,
            padding:         '0 12px',
            borderRadius:    6,
            border:          `1px solid ${amount === p ? 'var(--neutral-900)' : 'var(--neutral-200)'}`,
            backgroundColor: amount === p ? 'var(--neutral-900)' : 'transparent',
            color:           amount === p ? 'var(--neutral-white)' : 'var(--neutral-700)',
            fontFamily:      'var(--font-body)',
            fontSize:        13,
            fontWeight:      500,
            cursor:          'pointer',
          }}
        >
          ${p}
        </button>
      ))}
      <Button variant="default" size="sm" onClick={handleBuy} disabled={loading}>
        {loading ? 'Redirecting…' : 'Buy credits →'}
      </Button>
      <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrgPlansPage() {
  const {
    orgId,
    orgRole,
    plan,
    members: orgMembers,
    membersLoading,
    refreshMembers,
  } = useOrg()

  const isOwner    = orgRole === 'owner'
  const isAdminish = orgRole === 'owner' || orgRole === 'admin'

  const [members,        setMembers]        = useState<OrgMember[]>([])
  const [billing,        setBilling]        = useState<BillingInfo | null>(null)
  const [billingLoading, setBillingLoading] = useState(false)
  const [topupOpen,       setTopupOpen]       = useState(false)
  const [cancelConfirm,   setCancelConfirm]   = useState(false)
  const [cancelLoading,   setCancelLoading]   = useState(false)

  useEffect(() => {
    setMembers(orgMembers)
  }, [orgMembers])

  // Only owner/admin see billing data — members see caps only
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
  const poolStatus     = plan?.poolStatus   ?? '—'

  const handleCapSaved = (memberId: string, newCap: number | null) => {
    setMembers(ms => ms.map(m => m.id === memberId ? { ...m, creditCap: newCap ?? undefined } : m))
  }

  const handleStripePortal = async () => {
    const url = await openBillingPortal()
    if (url) window.open(url, '_blank')
    else toast.error('Could not open billing portal.')
  }

  const handleCancelPlan = async () => {
    if (!cancelConfirm) { setCancelConfirm(true); return }
    setCancelLoading(true)
    try {
      await cancelSubscription()
      toast.success('Plan cancelled. Access continues until the period end.')
      setCancelConfirm(false)
      refreshMembers()
    } catch {
      toast.error('Failed to cancel plan.')
    } finally {
      setCancelLoading(false)
    }
  }

  const pm = billing?.payment_method

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
            Plans &amp; Billing
          </h1>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize:   14,
            lineHeight: '22px',
            color:      'var(--neutral-500)',
            margin:     0,
          }}>
            {isOwner
              ? 'Manage your subscription, credits, and payment details.'
              : 'View workspace credits and per-member usage.'}
          </p>
        </div>

        {/* ── Credit pool card ── */}
        <Card>
          <div style={{ padding: 12, display: 'flex', gap: 9, opacity: membersLoading ? 0.6 : 1 }}>
            {/* Total credits */}
            <div style={{
              width:           200,
              flexShrink:      0,
              backgroundColor: 'var(--neutral-50)',
              borderRadius:    12,
              padding:         12,
              display:         'flex',
              flexDirection:   'column',
              gap:             2,
            }}>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-500)', margin: 0 }}>
                Total credits
              </p>
              <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
                {totalCredits.toLocaleString()}
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>
                Status: {poolStatus}
              </p>
            </div>

            {/* Credits remaining */}
            <div style={{
              width:           200,
              flexShrink:      0,
              backgroundColor: 'white',
              borderRadius:    12,
              padding:         12,
              display:         'flex',
              flexDirection:   'column',
              gap:             2,
              boxShadow:       '0px 1px 2px 0px rgba(82,75,71,0.08), 0px 0px 0px 1px var(--neutral-100)',
            }}>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-500)', margin: 0 }}>
                Credits Remaining
              </p>
              <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
                {remainingCreds.toLocaleString()}
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>
                {usedCredits.toLocaleString()} used
              </p>
            </div>

            {/* Members */}
            <div style={{
              width:           200,
              flexShrink:      0,
              backgroundColor: 'white',
              borderRadius:    12,
              padding:         12,
              display:         'flex',
              flexDirection:   'column',
              gap:             2,
              boxShadow:       '0px 1px 2px 0px rgba(82,75,71,0.08), 0px 0px 0px 1px var(--neutral-100)',
            }}>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-500)', margin: 0 }}>
                Members
              </p>
              <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
                {members.length}
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>
                in this workspace
              </p>
            </div>

            {/* Buy credits — Owner + Admin only */}
            {isAdminish && (
              <div style={{
                flex:            '1 0 0',
                minWidth:        0,
                backgroundColor: 'white',
                borderRadius:    12,
                padding:         12,
                display:         'flex',
                flexDirection:   'column',
                gap:             6,
                boxShadow:       '0px 1px 2px 0px rgba(82,75,71,0.08), 0px 0px 0px 1px var(--neutral-100)',
              }}>
                <div style={{ flex: '1 0 0', minHeight: 0 }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-900)', margin: '0 0 4px' }}>
                    Need more credits?
                  </p>
                  <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>
                    Top up anytime. Credits roll over within the billing period.
                  </p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setTopupOpen(v => !v)}
                  >
                    Buy more credits
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Top-up amount selector — inline, shown on demand */}
          {topupOpen && isAdminish && (
            <TopUpSelector onClose={() => setTopupOpen(false)} />
          )}
        </Card>

        {/* ── Per-member credit caps ── */}
        <Card>
          <CardHeader
            title="Per-member credit caps"
            subtitle="Set monthly credit limits per member to control spending. Members see their remaining balance in-app."
            action={
              <Button variant="ghost" size="sm" onClick={refreshMembers}>
                Refresh
              </Button>
            }
          />

          {membersLoading ? (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>
                Loading members…
              </p>
            </div>
          ) : members.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>
                No members found.
              </p>
            </div>
          ) : members.map((member, i) => (
            <div
              key={member.id}
              style={{
                display:      'flex',
                alignItems:   'center',
                gap:          12,
                padding:      '12px 24px',
                borderBottom: i < members.length - 1 ? '1px solid var(--neutral-100)' : undefined,
              }}
            >
              <Avatar name={member.name} size="sm" />
              <div style={{ flex: '1 0 0', minWidth: 0 }}>
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {member.name || member.email}
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>
                  {member.creditUsed.toLocaleString()} credits used
                </p>
              </div>
              {/* Cap editing: Owner + Admin only */}
              {isAdminish && orgId ? (
                <CapInput
                  memberId={member.id}
                  currentCap={member.creditCap}
                  orgId={orgId}
                  onSaved={(cap) => handleCapSaved(member.id, cap)}
                />
              ) : (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-400)', margin: 0 }}>
                  {member.creditCap != null ? `${member.creditCap.toLocaleString()} cap` : 'No cap'}
                </p>
              )}
            </div>
          ))}
        </Card>

        {/* ── Payment method — Owner only ── */}
        {isOwner && (
          <Card>
            <CardHeader
              title="Payment"
              subtitle="Manage your billing details and subscription."
            />
            <div style={{
              display:    'flex',
              alignItems: 'center',
              gap:        12,
              padding:    '12px 24px',
            }}>
              {billingLoading ? (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>
                  Loading billing info…
                </p>
              ) : pm ? (
                <>
                  <CardBrandLogo brand={(pm.brand ?? 'visa') as Parameters<typeof CardBrandLogo>[0]['brand']} />
                  <div style={{ flex: '1 0 0', minWidth: 0 }}>
                    <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
                      {pm.brand ? pm.brand.charAt(0).toUpperCase() + pm.brand.slice(1) : 'Card'} ···· {pm.last4 ?? '••••'}
                    </p>
                    {pm.exp_month && pm.exp_year && (
                      <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>
                        Expires {String(pm.exp_month).padStart(2, '0')}/{pm.exp_year}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ flex: '1 0 0', minWidth: 0 }}>
                    <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
                      No payment method on file
                    </p>
                    <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>
                      Add a card to continue your subscription.
                    </p>
                  </div>
                </>
              )}
              <Button variant="secondary" size="sm" onClick={handleStripePortal}>
                Manage on Stripe
              </Button>
            </div>

            {/* Subscription status row */}
            {billing?.subscription_status && (
              <div style={{
                padding:   '10px 24px',
                borderTop: '1px solid var(--neutral-100)',
                display:   'flex',
                gap:       8,
                alignItems: 'center',
              }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-500)', margin: 0, flex: '1 0 0' }}>
                  Subscription: <strong style={{ color: 'var(--neutral-800)' }}>{billing.subscription_status}</strong>
                  {billing.current_period_end && (
                    <span style={{ color: 'var(--neutral-400)' }}>
                      {' '}· renews {new Date(billing.current_period_end).toLocaleDateString()}
                    </span>
                  )}
                  {billing.cancel_at_period_end && (
                    <span style={{ color: 'var(--color-tag-Red-text)' }}> · cancels at period end</span>
                  )}
                </p>
              </div>
            )}
          </Card>
        )}

        {/* ── Danger Zone — Owner only ── */}
        {isOwner && (
          <Card style={{ border: '1px solid var(--red-400)' }}>
            <div style={{
              borderBottom: '1px solid var(--red-100)',
              padding:      '12px 24px 24px',
            }}>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize:   16,
                lineHeight: '22px',
                color:      'var(--red-400)',
                margin:     '0 0 6px',
              }}>
                Danger Zone
              </p>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize:   14,
                lineHeight: '22px',
                color:      'var(--neutral-500)',
                margin:     0,
              }}>
                Actions here are permanent and cannot be undone.
              </p>
            </div>

            <div style={{
              display:    'flex',
              alignItems: 'center',
              gap:        12,
              padding:    '12px 24px',
            }}>
              <div style={{ flex: '1 0 0', minWidth: 0 }}>
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
                  Cancel Plan
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>
                  {cancelConfirm
                    ? 'Your workspace will continue until the end of the billing period, then revert to free.'
                    : 'Your workspace will revert to the free tier. All members lose access to paid features.'}
                </p>
              </div>
              {cancelConfirm ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button variant="ghost" size="sm" onClick={() => setCancelConfirm(false)}>
                    Keep plan
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleCancelPlan}
                    disabled={cancelLoading}
                  >
                    {cancelLoading ? 'Cancelling…' : 'Yes, cancel'}
                  </Button>
                </div>
              ) : (
                <Button variant="danger" size="sm" onClick={handleCancelPlan}>
                  Cancel Plan
                </Button>
              )}
            </div>
          </Card>
        )}

      </div>
    </div>
  )
}
