'use client'

import React, { useState } from 'react'
import { Button } from '@/components/Button'
import { CardBrandLogo } from '@/components/CardBrandLogo'

// ── Text input ────────────────────────────────────────────────────────────────

function TextInput({
  value,
  onChange,
  placeholder,
  style,
}: {
  value:        string
  onChange?:    (v: string) => void
  placeholder?: string
  style?:       React.CSSProperties
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      style={{
        height:          36,
        backgroundColor: 'white',
        borderRadius:    10,
        boxShadow:       '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
        border:          'none',
        padding:         '7px 10px',
        fontFamily:      'var(--font-body)',
        fontWeight:      400,
        fontSize:        14,
        lineHeight:      '22px',
        color:           'var(--neutral-900)',
        boxSizing:       'border-box',
        outline:         'none',
        ...style,
      }}
    />
  )
}

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
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
        }}>
          {title}
        </p>
        {subtitle && (
          <p style={{
            fontFamily:   'var(--font-body)',
            fontWeight:   400,
            fontSize:     14,
            lineHeight:   '22px',
            color:        'var(--neutral-500)',
            margin:       0,
          }}>
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}

// ── Card brand logo (now uses shared CardBrandLogo component) ─────────────────
// Kept for quick reference: brand can be 'visa' | 'mastercard' | 'amex' | 'discover' | 'diners' | 'jcb' | 'unionpay' | 'unknown'

// ── Paid status badge ─────────────────────────────────────────────────────────

function PaidBadge() {
  return (
    <div style={{
      display:         'inline-flex',
      alignItems:      'center',
      justifyContent:  'center',
      padding:         '2px 6px',
      borderRadius:    6,
      backgroundColor: 'var(--green-50)',
      boxShadow:       '0px 1px 1.5px 0px rgba(17,25,1,0.2), 0px 0px 0px 1px rgba(128,183,7,0.5), inset 0px 1px 0px 0px rgba(247,254,230,0.7), inset 0px -1px 0px 0px rgba(128,183,7,0.1)',
      flexShrink:      0,
    }}>
      <span style={{
        fontFamily: 'var(--font-body)',
        fontWeight: 500,
        fontSize: 12,
        lineHeight: '16px',
        color:      'var(--green-800)',
        whiteSpace: 'nowrap',
      }}>
        Paid
      </span>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const INVOICES = [
  { date: 'Jan 1, 2026', amount: '$150.00', seats: '6' },
  { date: 'Dec 1, 2025', amount: '$150.00', seats: '6' },
  { date: 'Nov 1, 2025', amount: '$120.00', seats: '5' },
]

export default function OrgPlansPage() {
  const [adminCap,  setAdminCap]  = useState('20,000 credits')
  const [memberCap, setMemberCap] = useState('8,000 credits')

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
            Manage your subscription, credits, and payment details.
          </p>
        </div>

        {/* ── Pro Plan card ── */}
        <Card>
          {/* Banner */}
          <div style={{
            background:    'radial-gradient(ellipse at 30% 50%, rgba(120,80,180,0.35) 0%, rgba(180,140,200,0.15) 50%, transparent 100%), linear-gradient(135deg, #2a1a3e 0%, #1a0f2e 40%, #0f0a1e 100%)',
            padding:       '24px',
            display:       'flex',
            alignItems:    'flex-start',
            gap:           16,
          }}>
            <div style={{ flex: '1 0 0', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <p style={{
                  fontFamily:   'var(--font-title)',
                  fontWeight:   400,
                  fontSize:     24,
                  lineHeight:   '32px',
                  color:        'white',
                  margin:       0,
                }}>
                  Pro Plan
                </p>
                {/* Blue price badge */}
                <div style={{
                  display:         'inline-flex',
                  alignItems:      'center',
                  justifyContent:  'center',
                  padding:         '2px 8px',
                  borderRadius:    8,
                  backgroundColor: 'rgba(59,130,246,0.2)',
                  boxShadow:       '0px 0px 0px 1px rgba(59,130,246,0.5)',
                  flexShrink:      0,
                }}>
                  <span style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 600,
                    fontSize:   14,
                    lineHeight: '22px',
                    color:      '#93c5fd',
                    whiteSpace: 'nowrap',
                  }}>
                    $150/month
                  </span>
                </div>
              </div>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize:   13,
                lineHeight: '20px',
                color:      'rgba(255,255,255,0.6)',
                margin:     '0 0 4px',
              }}>
                Next billing: Mar 1, 2026
              </p>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize:   13,
                lineHeight: '20px',
                color:      'rgba(255,255,255,0.5)',
                margin:     0,
              }}>
                Unlimited seats · 84,000 shared credits/mo · Priority support · Advanced AI models
              </p>
            </div>
            <Button variant="default" size="sm">Contact sales</Button>
          </div>

          {/* Stats row */}
          <div style={{
            padding: 12,
            display: 'flex',
            gap:     9,
          }}>
            {/* Shared credits */}
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
                Shared credits
              </p>
              <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
                84,000
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>
                Resets Mar 1, 2026
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
                76,340
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>
                720 used this month
              </p>
            </div>

            {/* Seats used */}
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
                Seats used
              </p>
              <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
                6
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>
                Unlimited seats
              </p>
            </div>

            {/* Need more credits */}
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
                  Top up anytime. Credits roll over within the billing period and don&apos;t expire mid-month.
                </p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="secondary" size="sm">Buy more Credits</Button>
              </div>
            </div>
          </div>
        </Card>

        {/* ── Per-member credit caps card ── */}
        <Card>
          <CardHeader
            title="Per-member credit caps"
            subtitle="Set monthly credit limits per role to control spending. Members see their remaining balance in-app."
          />

          {/* Admin cap */}
          <div style={{
            display:      'flex',
            alignItems:   'center',
            gap:          12,
            padding:      '12px 24px',
            borderBottom: '1px solid var(--neutral-100)',
          }}>
            <div style={{ flex: '1 0 0', minWidth: 0 }}>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
                Admin cap
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>
                Monthly limit per admin
              </p>
            </div>
            <TextInput
              value={adminCap}
              onChange={setAdminCap}
              style={{ width: 327 }}
            />
          </div>

          {/* File retention / member cap */}
          <div style={{
            display:    'flex',
            alignItems: 'center',
            gap:        12,
            padding:    '12px 24px',
          }}>
            <div style={{ flex: '1 0 0', minWidth: 0 }}>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
                Member cap
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>
                Monthly limit per member
              </p>
            </div>
            <TextInput
              value={memberCap}
              onChange={setMemberCap}
              style={{ width: 327 }}
            />
          </div>
        </Card>

        {/* ── Payment card ── */}
        <Card>
          <CardHeader
            title="Payment"
            subtitle="Manage your billing details."
          />
          <div style={{
            display:    'flex',
            alignItems: 'center',
            gap:        12,
            padding:    '12px 24px',
          }}>
            <CardBrandLogo brand="visa" />
            <div style={{ flex: '1 0 0', minWidth: 0 }}>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
                Card ending in 1234
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>
                Expiry 06/2024
              </p>
            </div>
            <Button variant="secondary" size="sm">Manage on Stripe</Button>
          </div>
        </Card>

        {/* ── Invoice history card ── */}
        <Card>
          <div style={{
            borderBottom: '1px solid var(--neutral-100)',
            padding:      '12px 24px',
            display:      'flex',
            alignItems:   'center',
            gap:          12,
          }}>
            <div style={{ flex: '1 0 0', minWidth: 0 }}>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: '0 0 6px' }}>
                Invoice history
              </p>
            </div>
            <Button variant="secondary" size="sm">Export all</Button>
          </div>

          {/* Inner white table */}
          <div style={{ padding: '12px 24px' }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius:    8,
              boxShadow:       '0px 1px 2px 0px rgba(82,75,71,0.08), 0px 0px 0px 1px var(--neutral-100)',
              overflow:        'hidden',
            }}>
              {/* Table header */}
              <div style={{
                display:      'flex',
                alignItems:   'center',
                padding:      '6px 16px',
                borderBottom: '1px solid var(--neutral-100)',
                gap:          12,
              }}>
                {['Date', 'Amount', 'Seats', 'Status', 'Actions'].map((col, i) => (
                  <p
                    key={col}
                    style={{
                      flex:       i === 0 ? '1 0 0' : undefined,
                      width:      i === 0 ? undefined : i === 4 ? 60 : 80,
                      fontFamily: 'var(--font-body)',
                      fontWeight: 500,
                      fontSize: 12,
                      lineHeight: '16px',
                      color:      'var(--neutral-500)',
                      margin:     0,
                    }}
                  >
                    {col}
                  </p>
                ))}
              </div>

              {/* Invoice rows */}
              {INVOICES.map((inv, index) => (
                <div
                  key={inv.date}
                  style={{
                    display:      'flex',
                    alignItems:   'center',
                    padding:      '10px 16px',
                    gap:          12,
                    borderBottom: index < INVOICES.length - 1 ? '1px solid var(--neutral-100)' : undefined,
                  }}
                >
                  <p style={{ flex: '1 0 0', fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
                    {inv.date}
                  </p>
                  <p style={{ width: 80, fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
                    {inv.amount}
                  </p>
                  <p style={{ width: 80, fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
                    {inv.seats}
                  </p>
                  <div style={{ width: 80 }}>
                    <PaidBadge />
                  </div>
                  <div style={{ width: 60 }}>
                    <button style={{
                      background:     'none',
                      border:         'none',
                      cursor:         'pointer',
                      padding:        0,
                      fontFamily:     'var(--font-body)',
                      fontWeight:     500,
                      fontSize:       14,
                      lineHeight:     '22px',
                      color:          'var(--neutral-700)',
                      textDecoration: 'underline',
                    }}>
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* ── Danger Zone card ── */}
        <Card style={{ border: '1px solid var(--red-400)' }}>
          <div style={{
            borderBottom: '1px solid var(--red-100)',
            padding:      '12px 24px 24px',
          }}>
            <p style={{
              fontFamily:   'var(--font-body)',
              fontWeight:   500,
              fontSize:     16,
              lineHeight:   '22px',
              color:        'var(--red-400)',
              margin:       '0 0 6px',
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
                Your workspace will revert to the free tier at the end of the current billing period. All members will lose access to Pro features.
              </p>
            </div>
            <Button variant="danger" size="sm">Cancel Plan</Button>
          </div>
        </Card>

      </div>
    </div>
  )
}
