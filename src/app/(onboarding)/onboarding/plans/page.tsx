'use client'

import React, { useState } from 'react'
import { useOnboarding } from '@/context/onboarding-context'
import { useAuth } from '@/context/auth-context'
import { apiFetch } from '@/lib/api/client'
import { SouvenirGlyph } from '../_components/onboarding-shell'

const CANVAS_GRADIENT =
  'linear-gradient(180deg, var(--neutral-50,#f7f2ed) 3.76%, var(--neutral-100,#ede1d7) 75%, var(--neutral-200,#d1c6bd) 116.79%)'

type Billing = 'monthly' | 'annual'
type TeamPlanType = 'team_125' | 'team_250' | 'team_500' | 'team_1000' | 'team_1500' | 'team_2000'

interface Tier {
  sliderLabel:  string
  monthlyPrice: string
  annualPrice:  string   // monthly equivalent at 25% off
  annualBilled: string   // total billed annually
  creditsLabel: string
  planType:     TeamPlanType
}

const TIERS: Tier[] = [
  { sliderLabel: '$125',  monthlyPrice: '$125',  annualPrice: '$94',   annualBilled: '$1,125/yr',  creditsLabel: '60,000',    planType: 'team_125'  },
  { sliderLabel: '$250',  monthlyPrice: '$250',  annualPrice: '$188',  annualBilled: '$2,250/yr',  creditsLabel: '125,000',   planType: 'team_250'  },
  { sliderLabel: '$500',  monthlyPrice: '$500',  annualPrice: '$375',  annualBilled: '$4,500/yr',  creditsLabel: '250,000',   planType: 'team_500'  },
  { sliderLabel: '$1k',   monthlyPrice: '$1k',   annualPrice: '$750',  annualBilled: '$9,000/yr',  creditsLabel: '500,000',   planType: 'team_1000' },
  { sliderLabel: '$1.5k', monthlyPrice: '$1.5k', annualPrice: '$1.1k', annualBilled: '$13,500/yr', creditsLabel: '750,000',   planType: 'team_1500' },
  { sliderLabel: '$2k',   monthlyPrice: '$2k',   annualPrice: '$1.5k', annualBilled: '$18,000/yr', creditsLabel: '1,000,000', planType: 'team_2000' },
]

// ── Small components ──────────────────────────────────────────────────────────

function GreenDot() {
  return (
    <div style={{
      width: 8, height: 8,
      borderRadius: '50%',
      backgroundColor: 'var(--green-300,#bfda84)',
      flexShrink: 0,
      marginTop: 7,
      boxShadow: '0px 1px 1.5px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(182,172,164,0.4), inset 0px 1px 0px rgba(247,242,237,0.61), inset 0px -1px 0px rgba(106,98,93,0.05)',
    }} />
  )
}

function FeatureItem({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <GreenDot />
      <span style={{
        fontFamily: 'var(--font-body)',
        fontWeight: 400,
        fontSize: 14,
        lineHeight: '22px',
        color: '#3b3632',
      }}>
        {label}
      </span>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontFamily: 'var(--font-body)',
      fontWeight: 400,
      fontSize: 13,
      lineHeight: '16px',
      color: 'var(--neutral-500,#827a74)',
      margin: '0 0 4px 0',
    }}>
      {children}
    </p>
  )
}

function YellowBadge({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 6px',
      borderRadius: 6,
      backgroundColor: 'var(--yellow-100,#e9dfc9)',
      color: 'var(--yellow-700,#6d5921)',
      fontFamily: 'var(--font-body)',
      fontWeight: 500,
      fontSize: 11,
      lineHeight: '16px',
      whiteSpace: 'nowrap',
      boxShadow: '0px 1px 1.5px rgba(20,16,5,0.2), 0px 0px 0px 1px rgba(143,116,39,0.5), inset 0px 1px 0px rgba(250,246,235,0.7), inset 0px -1px 0px rgba(143,116,39,0.1)',
    }}>
      {children}
    </span>
  )
}

// ── Billing toggle ─────────────────────────────────────────────────────────────

function BillingToggle({ billing, onChange }: { billing: Billing; onChange: (b: Billing) => void }) {
  const activeStyle: React.CSSProperties = {
    background: 'linear-gradient(180deg, var(--neutral-700,#524b47) 0%, var(--neutral-900,#26211e) 100%)',
    color: 'var(--neutral-50,#f7f2ed)',
    boxShadow: [
      '0px 0px 0px 1px black',
      '0px 1.091px 1.091px rgba(59,54,50,0.1)',
      '0px 1.455px 3.127px rgba(59,54,50,0.4)',
      'inset 0px 1px 0.364px rgba(247,242,237,0.3)',
      'inset 0px -2.182px 0.364px #120c08',
      'inset 0px -2.545px 4px -2.182px rgba(247,242,237,0.5)',
    ].join(', '),
  }
  const inactiveStyle: React.CSSProperties = {
    background: 'none',
    color: 'var(--neutral-500,#827a74)',
    boxShadow: 'none',
  }

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: 2,
      paddingRight: 6,
      borderRadius: 10,
      backgroundColor: 'rgba(247,242,237,0.5)',
      boxShadow: [
        'inset 0px -1px 0px rgba(255,255,255,0.9)',
        'inset 0px 1px 0px var(--neutral-100,#ede1d7)',
        'inset 0px 0px 4px rgba(209,198,189,0.5)',
      ].join(', '),
    }}>
      <button
        type="button"
        onClick={() => onChange('monthly')}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '6px 10px 8px',
          borderRadius: 10, border: 'none', cursor: 'pointer',
          fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px',
          transition: 'background 150ms, box-shadow 150ms',
          ...(billing === 'monthly' ? activeStyle : inactiveStyle),
        }}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => onChange('annual')}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '7px 8px',
          borderRadius: 10, border: 'none', cursor: 'pointer',
          fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px',
          transition: 'background 150ms, box-shadow 150ms',
          ...(billing === 'annual' ? activeStyle : inactiveStyle),
        }}
      >
        Yearly
      </button>
      <YellowBadge>Save 25%</YellowBadge>
    </div>
  )
}

// ── Slack logo ────────────────────────────────────────────────────────────────

function SlackLogo() {
  return (
    <svg width="48" height="48" viewBox="0 0 54 54" fill="none" style={{ flexShrink: 0 }}>
      <path d="M19.712.133a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386h5.376V5.52A5.381 5.381 0 0 0 19.712.133m0 14.365H5.376A5.381 5.381 0 0 0 0 19.884a5.381 5.381 0 0 0 5.376 5.387h14.336a5.381 5.381 0 0 0 5.376-5.387 5.381 5.381 0 0 0-5.376-5.386" fill="#36C5F0"/>
      <path d="M53.76 19.884a5.381 5.381 0 0 0-5.376-5.386 5.381 5.381 0 0 0-5.376 5.386v5.387h5.376a5.381 5.381 0 0 0 5.376-5.387m-14.336 0V5.52A5.381 5.381 0 0 0 34.048.133a5.381 5.381 0 0 0-5.376 5.387v14.364a5.381 5.381 0 0 0 5.376 5.387 5.381 5.381 0 0 0 5.376-5.387" fill="#2EB67D"/>
      <path d="M34.048 54a5.381 5.381 0 0 0 5.376-5.387 5.381 5.381 0 0 0-5.376-5.386h-5.376v5.386A5.381 5.381 0 0 0 34.048 54m0-14.365h14.336a5.381 5.381 0 0 0 5.376-5.386 5.381 5.381 0 0 0-5.376-5.387H34.048a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386" fill="#ECB22E"/>
      <path d="M0 34.249a5.381 5.381 0 0 0 5.376 5.386 5.381 5.381 0 0 0 5.376-5.386v-5.387H5.376A5.381 5.381 0 0 0 0 34.249m14.336 0v14.364A5.381 5.381 0 0 0 19.712 54a5.381 5.381 0 0 0 5.376-5.387V34.249a5.381 5.381 0 0 0-5.376-5.387 5.381 5.381 0 0 0-5.376 5.387" fill="#E01E5A"/>
    </svg>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OnboardingPlansPage() {
  const { data } = useOnboarding()
  const { logout } = useAuth()
  const [tierIndex, setTierIndex] = useState(0)
  const [billing,   setBilling]   = useState<Billing>('monthly')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  const tier      = TIERS[tierIndex]!
  const fillPct   = tierIndex === 0 ? 0 : Math.round((tierIndex / (TIERS.length - 1)) * 100)
  const firstName = data.firstName.trim() || 'your team'

  const displayPrice  = billing === 'monthly' ? tier.monthlyPrice : tier.annualPrice
  const sliderBg      = `linear-gradient(to right, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.9) ${fillPct}%, rgba(255,255,255,0.28) ${fillPct}%, rgba(255,255,255,0.28) 100%)`

  const handleTeamPlan = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/api/stripe/checkout', {
        method: 'POST',
        body: JSON.stringify({
          plan_type:      tier.planType,
          billing,
          checkout_flow:  'onboarding',
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? 'Checkout failed')
      }
      const { checkout_url } = await res.json() as { checkout_url: string }
      window.location.href = checkout_url
    } catch (err) {
      console.error('Checkout error:', err)
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        .sv-volume-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 4px;
          border-radius: 2px;
          outline: none;
          cursor: pointer;
        }
        .sv-volume-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #fff;
          border: none;
          cursor: pointer;
          box-shadow: 0 1px 4px rgba(0,0,0,0.22), 0 0 0 2px rgba(255,255,255,0.3);
        }
        .sv-volume-slider::-moz-range-thumb {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #fff;
          border: none;
          cursor: pointer;
          box-shadow: 0 1px 4px rgba(0,0,0,0.22);
        }
      `}</style>

      <div style={{
        minHeight: '100vh',
        width: '100%',
        background: CANVAS_GRADIENT,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '48px 24px 64px',
        boxSizing: 'border-box',
        gap: 32,
      }}>

        {/* ── Page header ── */}
        <div style={{ width: '100%', maxWidth: 1060 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
            <SouvenirGlyph size={44} />
            <button
              type="button"
              onClick={() => void logout()}
              style={{ background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 14, color: '#0d6eb2', textDecoration: 'underline' }}
            >
              Log out
            </button>
          </div>
          <h1 style={{
            fontFamily: 'var(--font-title)',
            fontWeight: 400,
            fontSize: 24,
            lineHeight: '32px',
            color: 'var(--neutral-800,#3b3632)',
            margin: '0 0 8px 0',
          }}>
            Set up your team workspace, {firstName}.
          </h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              fontSize: 16,
              lineHeight: '22px',
              color: 'var(--neutral-800,#3b3632)',
              margin: 0,
            }}>
              Pick a plan to power your Brain, agents, and automations across the team.
            </p>
            <YellowBadge>Shared credits · unlimited members · cancel anytime</YellowBadge>
          </div>
        </div>

        {/* ── Billing toggle ── */}
        <BillingToggle billing={billing} onChange={setBilling} />

        {/* ── Plan cards ── */}
        <div style={{
          display: 'flex',
          gap: 32,
          width: '100%',
          maxWidth: 1060,
          alignItems: 'flex-start',
        }}>

          {/* ── Team card ── */}
          <div style={{
            flex: '0 0 523px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            backgroundColor: 'var(--neutral-white,#fff)',
            borderRadius: 18,
            border: '1px solid var(--neutral-200,#e5e5e5)',
            padding: 12,
            boxShadow: '0px 1px 1px rgba(0,0,0,0.05)',
            boxSizing: 'border-box',
          }}>

            {/* Card header */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{
                  fontFamily: 'var(--font-title)',
                  fontWeight: 400,
                  fontSize: 24,
                  lineHeight: '32px',
                  color: 'var(--neutral-black,black)',
                  margin: 0,
                }}>
                  Team
                </h2>
                <YellowBadge>Most popular</YellowBadge>
              </div>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize: 14,
                lineHeight: '22px',
                color: 'var(--neutral-500,#827a74)',
                margin: 0,
              }}>
                Shared credits across unlimited members. No per-seat fees.
              </p>
            </div>

            {/* Slack Manager highlight */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 16px 12px 12px',
              borderRadius: 12,
              backgroundColor: 'var(--neutral-50,#f7f2ed)',
              boxShadow: '0px 1.091px 1.091px rgba(59,54,50,0.05), 0px 1.455px 3.127px rgba(38,33,30,0.15), inset 0px -2.182px 0.364px var(--neutral-100,#ede1d7)',
            }}>
              <SlackLogo />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 400,
                  fontSize: 13,
                  lineHeight: '16px',
                  color: 'var(--neutral-600,#6a625d)',
                }}>
                  Team-exclusive
                </span>
                <div>
                  <p style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 600,
                    fontSize: 16,
                    lineHeight: '22px',
                    color: 'var(--neutral-black,black)',
                    margin: 0,
                  }}>
                    Souvenir Slack Manager
                  </p>
                  <p style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 400,
                    fontSize: 11,
                    lineHeight: '15px',
                    color: 'var(--neutral-600,#6a625d)',
                    margin: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    One bot in Slack &amp; Microsoft Teams, by @-mention.
                  </p>
                </div>
              </div>
            </div>

            {/* Volume pricing panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{
                backgroundColor: 'var(--neutral-700,#524b47)',
                borderRadius: 16,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                overflow: 'hidden',
              }}>
                <p style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 400,
                  fontSize: 13,
                  lineHeight: '16px',
                  color: 'white',
                  margin: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  Pick your team&apos;s volume
                </p>

                {/* Price display */}
                <p style={{ margin: 0, lineHeight: 0 }}>
                  <span style={{
                    fontFamily: 'var(--font-title)',
                    fontWeight: 400,
                    fontSize: 40,
                    lineHeight: '48px',
                    color: '#fff',
                  }}>
                    {displayPrice}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 400,
                    fontSize: 14,
                    lineHeight: '22px',
                    color: 'var(--neutral-100,#ede1d7)',
                  }}>
                    /mo{billing === 'annual' && ` · billed ${tier.annualBilled}`}
                  </span>
                </p>

                {/* Credits card */}
                <div style={{
                  position: 'relative',
                  backgroundColor: 'var(--neutral-50,#f7f2ed)',
                  borderRadius: 12,
                  padding: '12px 12px',
                  width: '100%',
                  boxSizing: 'border-box',
                  boxShadow: '0px 1.091px 1.091px rgba(59,54,50,0.05), 0px 1.455px 3.127px rgba(38,33,30,0.15), inset 0px -2.182px 0.364px var(--neutral-100,#ede1d7)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{
                      fontFamily: 'var(--font-title)',
                      fontWeight: 400,
                      fontSize: 24,
                      lineHeight: '32px',
                      color: 'var(--neutral-black,black)',
                    }}>
                      {tier.creditsLabel}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-body)',
                      fontWeight: 400,
                      fontSize: 11,
                      lineHeight: '15px',
                      color: 'var(--neutral-600,#6a625d)',
                    }}>
                      credits / month
                    </span>
                  </div>
                </div>

                {/* Slider + tier labels */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    type="range"
                    min={0}
                    max={TIERS.length - 1}
                    step={1}
                    value={tierIndex}
                    onChange={(e) => setTierIndex(Number(e.target.value))}
                    className="sv-volume-slider"
                    style={{ display: 'block', width: '100%', padding: 0, background: sliderBg }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    {TIERS.map((t, i) => (
                      <button
                        key={t.sliderLabel}
                        type="button"
                        style={{
                          background: 'none', border: 'none', padding: 0,
                          fontFamily: 'var(--font-body)',
                          fontWeight: i === tierIndex ? 600 : 400,
                          fontSize: 14,
                          lineHeight: '22px',
                          color: i === tierIndex ? 'var(--neutral-50,#f7f2ed)' : 'rgba(255,255,255,0.38)',
                          cursor: 'pointer',
                        }}
                        onClick={() => setTierIndex(i)}
                      >
                        {t.sliderLabel}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Feature columns */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {/* Team collaboration */}
                <div style={{ display: 'flex', gap: 78, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <SectionLabel>Team collaboration</SectionLabel>
                    <FeatureItem label="Unlimited members" />
                    <FeatureItem label="Shared Pins &amp; Highlights" />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 24 }}>
                    <FeatureItem label="Shared AI assistants" />
                    <FeatureItem label="Shared project folders" />
                  </div>
                </div>

                <div style={{ height: 1, backgroundColor: 'var(--neutral-100,#ede1d7)', width: '100%' }} />

                {/* Governance */}
                <div style={{ display: 'flex', gap: 78, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <SectionLabel>Governance &amp; guardrails · org panel</SectionLabel>
                    <FeatureItem label="Data ownership &amp; scope" />
                    <FeatureItem label="Per-member credit caps" />
                    <FeatureItem label="Full audit trail" />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 24 }}>
                    <FeatureItem label="Roles · Admin / Editor / Member" />
                    <FeatureItem label="Approval gates" />
                    <FeatureItem label="Slack &amp; Teams manager bot" />
                  </div>
                </div>
              </div>
            </div>

            {/* CTA */}
            {error && (
              <p style={{
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                color: 'var(--color-tag-Red-text,#dc2626)',
                margin: 0,
              }}>
                {error}
              </p>
            )}
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleTeamPlan()}
              style={{
                width: '100%',
                padding: '6px 20px 8px',
                borderRadius: 10,
                border: 'none',
                cursor: loading ? 'default' : 'pointer',
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize: 14,
                lineHeight: '22px',
                color: 'var(--neutral-50,#f7f2ed)',
                background: loading
                  ? 'var(--neutral-500,#827a74)'
                  : 'linear-gradient(180deg, var(--neutral-700,#524b47) 0%, var(--neutral-900,#26211e) 100%)',
                boxShadow: loading ? 'none' : [
                  '0px 0px 0px 1px black',
                  '0px 1.091px 1.091px rgba(59,54,50,0.1)',
                  '0px 1.455px 3.127px rgba(59,54,50,0.4)',
                  'inset 0px 1px 0.364px rgba(247,242,237,0.3)',
                  'inset 0px -2.182px 0.364px #120c08',
                  'inset 0px -2.545px 4px -2.182px rgba(247,242,237,0.5)',
                ].join(', '),
                transition: 'background 0.15s',
              }}
            >
              {loading ? 'Setting up…' : 'Start a Team Workspace'}
            </button>
          </div>

          {/* ── Custom card ── */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            backgroundColor: 'var(--neutral-white,#fff)',
            borderRadius: 18,
            border: '1px solid var(--neutral-200,#e5e5e5)',
            padding: 12,
            boxShadow: '0px 1px 1px rgba(0,0,0,0.05)',
            boxSizing: 'border-box',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <h2 style={{
                fontFamily: 'var(--font-title)',
                fontWeight: 400,
                fontSize: 24,
                lineHeight: '32px',
                color: 'var(--neutral-black,black)',
                margin: 0,
              }}>
                Custom
              </h2>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize: 14,
                lineHeight: '22px',
                color: 'var(--neutral-500,#827a74)',
                margin: 0,
              }}>
                For organizations running Souvenir at scale.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* Team collaboration */}
              <div style={{ display: 'flex', gap: 92, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <SectionLabel>Team collaboration</SectionLabel>
                  <FeatureItem label="Custom credit volume" />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 24 }}>
                  <FeatureItem label="Volume discounts" />
                </div>
              </div>

              <div style={{ height: 1, backgroundColor: 'var(--neutral-100,#ede1d7)', width: '100%' }} />

              {/* Enterprise security */}
              <div style={{ display: 'flex', gap: 53, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <SectionLabel>Enterprise security</SectionLabel>
                  <FeatureItem label="SSO &amp; SAML" />
                  <FeatureItem label="DPA &amp; SLA" />
                  <FeatureItem label="Slack &amp; Teams manager bot" />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 24 }}>
                  <FeatureItem label="SCIM provisioning" />
                  <FeatureItem label="Data residency" />
                </div>
              </div>

              <div style={{ height: 1, backgroundColor: 'var(--neutral-100,#ede1d7)', width: '100%' }} />

              {/* White-glove & support */}
              <div style={{ display: 'flex', gap: 78, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <SectionLabel>White-glove &amp; support</SectionLabel>
                  <FeatureItem label="Onboarding &amp; training" />
                  <FeatureItem label="Monthly strategy review" />
                  <FeatureItem label="Priority email support" />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 24 }}>
                  <FeatureItem label="Dedicated success manager" />
                  <FeatureItem label="Learning workspace" />
                  <FeatureItem label="Online meeting support" />
                </div>
              </div>
            </div>

            {/* CTA */}
            <a
              href="mailto:sales@souvenir.ai"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                width: '100%',
                padding: '6px 20px 8px',
                borderRadius: 10,
                border: 'none',
                backgroundColor: 'white',
                color: 'var(--neutral-700,#524b47)',
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize: 14,
                lineHeight: '22px',
                textDecoration: 'none',
                boxSizing: 'border-box',
                boxShadow: '0px 1.091px 1.091px rgba(59,54,50,0.05), 0px 1.455px 3.127px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-100,#ede1d7), inset 0px -2.182px 0.364px var(--neutral-100,#ede1d7)',
              }}
            >
              Talk to sales
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M2.5 8h11M9.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>

        </div>
      </div>
    </>
  )
}
