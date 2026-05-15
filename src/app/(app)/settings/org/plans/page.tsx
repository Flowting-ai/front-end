'use client'

import React, { useState } from 'react'

// ── Shared buttons ─────────────────────────────────────────────────────────────

function DarkButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         '6px 10px 8px',
        borderRadius:    10,
        border:          'none',
        cursor:          'pointer',
        background:      'linear-gradient(180deg, var(--neutral-700) 0%, var(--neutral-900) 100%)',
        boxShadow:       '0px 1px 1.5px 0px rgba(82,75,71,0.5), 0px 0px 0px 1px var(--neutral-900), inset 0px 1px 0px 0px rgba(255,255,255,0.08)',
        fontFamily:      'var(--font-body)',
        fontWeight:      500,
        fontSize:        14,
        lineHeight:      '22px',
        color:           'white',
        whiteSpace:      'nowrap',
        flexShrink:      0,
      }}
    >
      {children}
    </button>
  )
}

function WhiteButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         '6px 10px 8px',
        borderRadius:    10,
        border:          'none',
        cursor:          'pointer',
        backgroundColor: 'white',
        boxShadow:       '0px 1.091px 1.091px 0px rgba(59,54,50,0.05), 0px 1.455px 3.127px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-100), inset 0px -2.182px 0.364px 0px var(--neutral-100)',
        fontFamily:      'var(--font-body)',
        fontWeight:      500,
        fontSize:        14,
        lineHeight:      '22px',
        color:           'var(--neutral-700)',
        whiteSpace:      'nowrap',
        flexShrink:      0,
      }}
    >
      {children}
    </button>
  )
}

function RedButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         '6px 10px 8px',
        borderRadius:    10,
        border:          'none',
        cursor:          'pointer',
        backgroundColor: 'white',
        boxShadow:       '0px 1px 1.5px 0px rgba(82,75,71,0.08), 0px 0px 0px 1px var(--red-200)',
        fontFamily:      'var(--font-body)',
        fontWeight:      500,
        fontSize:        14,
        lineHeight:      '22px',
        color:           'var(--red-700)',
        whiteSpace:      'nowrap',
        flexShrink:      0,
      }}
    >
      {children}
    </button>
  )
}

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

// ── Visa card SVG ─────────────────────────────────────────────────────────────

function VisaCard() {
  return (
    <div style={{
      width:           63,
      height:          44,
      borderRadius:    6,
      backgroundColor: '#1a1f71',
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      flexShrink:      0,
      boxShadow:       '0px 1px 3px 0px rgba(0,0,0,0.2)',
    }}>
      <svg width="40" height="14" viewBox="0 0 40 14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M15.15 13.2H12.3L14.1 0.8H16.95L15.15 13.2ZM10.05 0.8L7.35 9.2L7.05 7.6L6.15 2C6.15 2 6 0.8 4.5 0.8H0.15L0 0.95C0 0.95 1.35 1.25 2.85 2.15L5.4 13.2H8.4L13.05 0.8H10.05ZM37.5 13.2H40.2L37.8 0.8H35.55C34.2 0.8 33.9 1.8 33.9 1.8L29.55 13.2H32.55L33.15 11.55H36.75L37.5 13.2ZM33.9 9.3L35.4 5.1L36.3 9.3H33.9ZM29.1 3.6L29.55 0.95C29.55 0.95 28.35 0.5 27.15 0.5C25.5 0.5 21.9 1.2 21.9 4.35C21.9 7.35 25.95 7.35 25.95 8.9C25.95 10.5 22.35 10.2 21.15 9.15L20.7 11.9C20.7 11.9 21.9 12.5 23.7 12.5C25.5 12.5 29.85 11.55 29.85 8.1C29.85 4.95 25.65 4.65 25.65 3.3C25.65 1.95 28.35 2.1 29.1 3.6Z" fill="white" />
      </svg>
    </div>
  )
}

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
        fontSize:   11,
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
            <DarkButton>Contact sales</DarkButton>
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
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>
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
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>
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
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>
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
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>
                  Top up anytime. Credits roll over within the billing period and don&apos;t expire mid-month.
                </p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <WhiteButton>Buy more Credits</WhiteButton>
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
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>
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
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>
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
            <VisaCard />
            <div style={{ flex: '1 0 0', minWidth: 0 }}>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
                Card ending in 1234
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>
                Expiry 06/2024
              </p>
            </div>
            <WhiteButton>Manage on Stripe</WhiteButton>
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
            <WhiteButton>Export all</WhiteButton>
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
                      fontSize:   11,
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
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>
                Your workspace will revert to the free tier at the end of the current billing period. All members will lose access to Pro features.
              </p>
            </div>
            <RedButton>Cancel Plan</RedButton>
          </div>
        </Card>

      </div>
    </div>
  )
}
