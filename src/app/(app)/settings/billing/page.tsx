'use client'

import React from 'react'
import { useAuth } from '@/context/auth-context'
import { Button } from '@/components/Button'

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
        display:      'flex',
        flexDirection:'column',
        padding:      `${padTop}px 24px ${padBottom}px`,
        borderBottom: divider ? '1px solid var(--neutral-100)' : undefined,
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
        height:       4,
        borderRadius: 99,
        backgroundColor: 'var(--neutral-100)',
        overflow:     'hidden',
        position:     'relative',
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
        fontSize:        11,
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
        fontSize:        11,
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
  label: string
  value: string
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
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return '—'
  }
}

function fmtAmount(cents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style:    'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100)
}

function fmtNum(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('en-US')
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const { user } = useAuth()

  const planName         = user?.planName ?? 'Starter'
  const nextBilling      = fmtDate(user?.nextBillingDate ?? user?.currentPeriodEnd)
  const creditsTotal     = user?.creditsTotal     ?? 0
  const creditsRemaining = user?.creditsRemaining ?? 0
  const creditsUsed      = user?.creditsUsed      ?? 0
  const invoices         = user?.invoices         ?? []
  const pm               = user?.defaultPaymentMethod ?? null
  const billingPortalUrl = user?.billingPortalUrl ?? '#'
  const usage            = user?.usage            ?? null

  const chatUsed     = usage?.by_category?.chat     ?? 0
  const personaUsed  = usage?.by_category?.persona  ?? 0
  const workflowUsed = usage?.by_category?.workflow ?? 0
  const monthlyLimit = usage?.monthly_limit ?? creditsTotal

  const storageUsedGB  = 0
  const storageLimit   = 10

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
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize:   12,
                lineHeight: '18px',
                color:      'rgba(255,255,255,0.7)',
                margin:     0,
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
              {nextBilling !== '—' && (
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

            {/* Price badge */}
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
                $25 / month
              </span>
            </div>
          </div>

          {/* Feature list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              '12,000 monthly credits',
              'Unlimited personas',
              'Advanced AI models',
              'Priority support',
            ].map(feat => (
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

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button variant="default" size="sm" onClick={() => {}}>
              Change Plan
            </Button>
            <button
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
          </div>
        </div>

        {/* ── Credit stats row ── */}
        <div style={{ display: 'flex', gap: 10 }}>
          <StatBox
            label="Monthly Credits"
            value={fmtNum(creditsTotal)}
          />
          <StatBox
            label="Credits Remaining"
            value={fmtNum(creditsRemaining)}
          />
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

          {/* Monthly limits section */}
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
              {[
                { label: 'Chat Board',    used: chatUsed,     limit: monthlyLimit },
                { label: 'AI Assistants', used: personaUsed,  limit: Math.round(monthlyLimit / 3) },
                { label: 'Workflows',     used: workflowUsed, limit: Math.round(monthlyLimit / 20) },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
                      {fmtNum(row.used)} / {fmtNum(row.limit)}
                    </span>
                  </div>
                  <ProgressBar used={row.used} total={row.limit} />
                </div>
              ))}
            </div>
          </CardSection>

          {/* Storage section */}
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
                  {storageUsedGB.toFixed(1)} / {storageLimit} GB
                </span>
              </div>
              <ProgressBar used={storageUsedGB} total={storageLimit} />
            </div>
          </CardSection>
        </SettingsCard>

        {/* ── Payment method ── */}
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              {pm ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {/* Card brand icon */}
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
                      fontFamily: 'var(--font-body)',
                      fontWeight: 700,
                      fontSize:   10,
                      color:      'var(--neutral-600)',
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
                  flexShrink:     0,
                  display:        'inline-flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  padding:        '5px 10px',
                  borderRadius:   8,
                  textDecoration: 'none',
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
                Manage on Stripe
              </a>
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
                display:     'grid',
                gridTemplateColumns: '1fr 100px 90px 60px',
                gap:         8,
                padding:     '4px 0 8px',
                borderBottom:'1px solid var(--neutral-100)',
                marginBottom: 4,
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

              {/* Rows */}
              {invoices.slice(0, 10).map(inv => (
                <div
                  key={inv.id}
                  style={{
                    display:     'grid',
                    gridTemplateColumns: '1fr 100px 90px 60px',
                    gap:         8,
                    alignItems:  'center',
                    padding:     '8px 0',
                    borderBottom:'1px solid var(--neutral-50)',
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
                    href={inv.invoice_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontFamily:     'var(--font-body)',
                      fontWeight:     400,
                      fontSize:       13,
                      lineHeight:     '20px',
                      color:          'var(--neutral-600)',
                      textDecoration: 'underline',
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
  )
}
