'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence, animate } from 'framer-motion'
import { useOnboarding } from '@/context/onboarding-context'
import { useAuth } from '@/context/auth-context'
import { createCheckout } from '@/lib/api/stripe'
import { ContactSalesModal } from '@/components/ContactSalesModal'
import { Button } from '@/components/Button'
import { InformationCircleIcon } from '@strange-huge/icons'
import { ONBOARDING_TONE_ROUTE, ONBOARDING_ACCOUNT_TYPE_ROUTE, ONBOARDING_PLANS_ROUTE } from '@/lib/routes'

const CANVAS_GRADIENT =
  'linear-gradient(180deg, var(--neutral-50,#f7f2ed) 3.76%, var(--neutral-100,#ede1d7) 75%, var(--neutral-200,#d1c6bd) 116.79%)'

// Figma MCP asset — expires in 7 days; swap to a permanent asset after export
const SOUVENIR_TOKEN_VECTOR = 'https://www.figma.com/api/mcp/asset/9c48f3d1-8a06-4e3a-a0e7-e0effae99e10'

type Billing = 'monthly' | 'annual'
type TeamPlanType = 'team_125' | 'team_250' | 'team_500' | 'team_1000' | 'team_1500' | 'team_2000'

// ── Team tiers ────────────────────────────────────────────────────────────────

interface TeamTier {
  sliderLabel:  string
  monthlyPrice: string
  annualPrice:  string
  annualBilled: string
  creditsLabel: string
  planType:     TeamPlanType
}

const TEAM_TIERS: TeamTier[] = [
  { sliderLabel: '$125',  monthlyPrice: '$125',  annualPrice: '$94',   annualBilled: '$1,125/yr',  creditsLabel: '60,000',    planType: 'team_125'  },
  { sliderLabel: '$250',  monthlyPrice: '$250',  annualPrice: '$188',  annualBilled: '$2,250/yr',  creditsLabel: '125,000',   planType: 'team_250'  },
  { sliderLabel: '$500',  monthlyPrice: '$500',  annualPrice: '$375',  annualBilled: '$4,500/yr',  creditsLabel: '250,000',   planType: 'team_500'  },
  { sliderLabel: '$1k',   monthlyPrice: '$1k',   annualPrice: '$750',  annualBilled: '$9,000/yr',  creditsLabel: '500,000',   planType: 'team_1000' },
  { sliderLabel: '$1.5k', monthlyPrice: '$1.5k', annualPrice: '$1.1k', annualBilled: '$13,500/yr', creditsLabel: '750,000',   planType: 'team_1500' },
  { sliderLabel: '$2k',   monthlyPrice: '$2k',   annualPrice: '$1.5k', annualBilled: '$18,000/yr', creditsLabel: '1,000,000', planType: 'team_2000' },
]

// ── Individual tiers ──────────────────────────────────────────────────────────

interface IndividualTier {
  sliderLabel:  string
  monthlyPrice: string
  annualPrice:  string
  annualBilled: string
  creditsLabel: string
  planType:     string
}

// Credits mirror the backend grants (services/users/settings/plans.yaml, USD × 1000).
const INDIVIDUAL_TIERS: IndividualTier[] = [
  { sliderLabel: '$12',  monthlyPrice: '$12',  annualPrice: '$9',  annualBilled: '$108/yr',  creditsLabel: '4,000',  planType: 'individual_12'  },
  { sliderLabel: '$25',  monthlyPrice: '$25',  annualPrice: '$19', annualBilled: '$225/yr',  creditsLabel: '12,000', planType: 'individual_25'  },
  { sliderLabel: '$100', monthlyPrice: '$100', annualPrice: '$75', annualBilled: '$900/yr',  creditsLabel: '45,000', planType: 'individual_100' },
]

// ── Small shared components ───────────────────────────────────────────────────

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
      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: '#3b3632' }}>
        {label}
      </span>
    </div>
  )
}

// Individual uses the neutral/100 beige dot (per Figma)
function BeigeDot() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: 2, flexShrink: 0 }}>
      <div style={{
        width: 8, height: 8,
        borderRadius: '50%',
        backgroundColor: 'var(--neutral-100,#ede1d7)',
        boxShadow: [
          '0px 1px 1.5px rgba(82,75,71,0.12)',
          '0px 0px 0px 1px rgba(182,172,164,0.4)',
          'inset 0px 1px 0px rgba(247,242,237,0.61)',
          'inset 0px -1px 0px rgba(106,98,93,0.05)',
        ].join(', '),
      }} />
    </div>
  )
}

function IndFeatureItem({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <BeigeDot />
      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: '#3b3632' }}>
        {label}
      </span>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontFamily: 'var(--font-code,\'Geist Mono\',monospace)',
      fontWeight: 400, fontSize: 13, lineHeight: '16px',
      color: 'var(--neutral-500,#827a74)', margin: '0 0 4px 0',
    }}>
      {children}
    </p>
  )
}

function YellowBadge({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 6px', borderRadius: 6,
      backgroundColor: 'var(--yellow-100,#e9dfc9)', color: 'var(--yellow-700,#6d5921)',
      fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11, lineHeight: '16px', whiteSpace: 'nowrap',
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
  const inactiveStyle: React.CSSProperties = { background: 'none', color: 'var(--neutral-500,#827a74)', boxShadow: 'none' }

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: 2, borderRadius: 10,
      backgroundColor: 'rgba(247,242,237,0.5)',
      boxShadow: 'inset 0px -1px 0px rgba(255,255,255,0.9), inset 0px 1px 0px var(--neutral-100,#ede1d7), inset 0px 0px 4px rgba(209,198,189,0.5)',
    }}>
      <button type="button" onClick={() => onChange('monthly')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 10px 8px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', transition: 'background 150ms, box-shadow 150ms', ...(billing === 'monthly' ? activeStyle : inactiveStyle) }}>Monthly</button>
      <button type="button" onClick={() => onChange('annual')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '7px 8px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', transition: 'background 150ms, box-shadow 150ms', ...(billing === 'annual' ? activeStyle : inactiveStyle) }}>Yearly</button>
    </div>
  )
}

// ── Slack logo ─────────────────────────────────────────────────────────────────

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

// ── Token square icon (welcome gift card) ─────────────────────────────────────

function TokenSquare() {
  return (
    <div style={{
      width: 56, height: 56, flexShrink: 0,
      backgroundColor: 'var(--neutral-800,#3b3632)',
      borderRadius: 12, overflow: 'hidden', position: 'relative',
    }}>
      <img
        alt=""
        src={SOUVENIR_TOKEN_VECTOR}
        style={{ position: 'absolute', inset: '7.29%', width: '85.42%', height: '85.42%', display: 'block' }}
      />
    </div>
  )
}

// ── Divider ───────────────────────────────────────────────────────────────────

function Divider() {
  return <div style={{ height: 1, backgroundColor: 'var(--neutral-100,#ede1d7)', width: '100%' }} />
}

// ── Animated number counter hook ──────────────────────────────────────────────

function useCountAnimation(target: number, duration = 0.45): number {
  const [display, setDisplay] = useState(target)
  const displayRef = useRef(target)
  const animRef = useRef<{ stop: () => void } | null>(null)

  useEffect(() => {
    if (displayRef.current === target) return
    animRef.current?.stop()
    const from = displayRef.current
    animRef.current = animate(from, target, {
      duration,
      ease: 'easeOut',
      onUpdate: (v: number) => {
        const rounded = Math.round(v)
        displayRef.current = rounded
        setDisplay(rounded)
      },
    })
    return () => { animRef.current?.stop() }
  }, [target, duration])

  return display
}

// ── Individual plan custom animated slider ────────────────────────────────────

function IndSlider({ value, onChange }: { value: number; onChange: (i: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [trackW, setTrackW] = useState(0)
  const THUMB = 10
  const count = INDIVIDUAL_TIERS.length
  const spring = { type: 'spring' as const, stiffness: 400, damping: 35 }

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setTrackW(entry.contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const usable = Math.max(0, trackW - THUMB)
  const thumbX = count > 1 ? (value / (count - 1)) * usable : 0
  const fillW  = thumbX + THUMB / 2

  return (
    <div ref={trackRef} style={{ position: 'relative', height: THUMB }}>
      {/* Track background */}
      <div style={{ position: 'absolute', top: 3, left: 0, right: 0, height: 4, backgroundColor: 'white', borderRadius: 2 }} />
      {/* Animated fill */}
      <motion.div
        animate={{ width: trackW > 0 ? fillW : 0 }}
        transition={spring}
        style={{ position: 'absolute', top: 3, left: 0, height: 4, backgroundColor: 'rgba(59,54,50,0.5)', borderRadius: 2 }}
      />
      {/* Animated thumb */}
      <motion.div
        animate={{ x: trackW > 0 ? thumbX : 0 }}
        transition={spring}
        style={{ position: 'absolute', top: 0, left: 0, width: THUMB, height: THUMB, borderRadius: '50%', backgroundColor: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.22), 0 0 0 1px rgba(59,54,50,0.2)' }}
      />
      {/* Invisible native range — handles drag */}
      <input
        type="range" min={0} max={count - 1} step={1} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', margin: 0, width: '100%', height: '100%' }}
      />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OnboardingPlansPage() {
  return (
    <React.Suspense fallback={
      <div style={{ minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--neutral-50,#f7f2ed)' }} />
    }>
      <OnboardingPlansContent />
    </React.Suspense>
  )
}

function OnboardingPlansContent() {
  const { push, replace } = useRouter()
  const searchParams       = useSearchParams()
  const { data }           = useOnboarding()
  const { logout }         = useAuth()

  // Extract URL params first so lazy state initializers can read them.
  // ?plan= and ?billing= are written by handleTeamPlan into the Stripe cancel_url
  // so the user's exact selection is restored when they hit "Back" on the Stripe page.
  const typeParam    = searchParams.get('type')
  const planParam    = searchParams.get('plan')
  const billingParam = searchParams.get('billing')

  // Context is the source of truth; fall back to ?type= for Stripe cancel returns
  const isTeam = data.accountType != null ? data.accountType === 'team' : typeParam === 'team'

  // Billing — lazy init restores from Stripe cancel URL if present
  const [billing, setBilling] = useState<Billing>(() =>
    billingParam === 'annual' ? 'annual' : 'monthly'
  )
  const [contactSalesOpen, setContactSalesOpen] = useState(false)

  // Team plan state — tier restored from Stripe cancel URL if present
  const [teamTierIndex, setTeamTierIndex] = useState(() => {
    if (planParam) {
      const idx = TEAM_TIERS.findIndex(t => t.planType === planParam)
      if (idx >= 0) return idx
    }
    return 0
  })
  const [teamSlideDir,  setTeamSlideDir]  = useState<1 | -1>(1)
  const [teamLoading,   setTeamLoading]   = useState(false)
  const [teamError,     setTeamError]     = useState<string | null>(null)

  // Individual plan state — tier restored from Stripe cancel URL if present
  const [indTierIndex, setIndTierIndex] = useState(() => {
    if (planParam) {
      const idx = INDIVIDUAL_TIERS.findIndex(t => t.planType === planParam)
      if (idx >= 0) return idx
    }
    return 0
  })
  const [indSlideDir,  setIndSlideDir]  = useState<1 | -1>(1)

  // Keep the URL in sync so the Stripe cancel_url always lands on the right variant
  useEffect(() => {
    const type = isTeam ? 'team' : 'individual'
    if (typeParam !== type) {
      replace(`${ONBOARDING_PLANS_ROUTE}?type=${type}`)
    }
  }, [isTeam]) // eslint-disable-line react-hooks/exhaustive-deps

  // Team computed
  const teamTier    = TEAM_TIERS[teamTierIndex]!
  const teamFillPct = teamTierIndex === 0 ? 0 : Math.round((teamTierIndex / (TEAM_TIERS.length - 1)) * 100)
  const teamPrice   = billing === 'monthly' ? teamTier.monthlyPrice : teamTier.annualPrice
  const teamSliderBg = `linear-gradient(to right, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.9) ${teamFillPct}%, rgba(255,255,255,0.28) ${teamFillPct}%, rgba(255,255,255,0.28) 100%)`

  // Individual computed
  const indTier      = INDIVIDUAL_TIERS[indTierIndex]!
  const indPrice     = billing === 'monthly' ? indTier.monthlyPrice : indTier.annualPrice
  const indPriceNum  = parseInt(indPrice.replace(/[^0-9]/g, ''), 10)
  const animPriceNum = useCountAnimation(indPriceNum)

  // Batched setters — set direction + index in one render so exit animation gets the right dir
  const setIndTier  = (i: number) => { setIndSlideDir(i > indTierIndex ? 1 : -1); setIndTierIndex(i) }
  const setTeamTier = (i: number) => { setTeamSlideDir(i > teamTierIndex ? 1 : -1); setTeamTierIndex(i) }

  const ctaShadow = [
    '0px 0px 0px 1px black',
    '0px 1.091px 1.091px rgba(59,54,50,0.1)',
    '0px 1.455px 3.127px rgba(59,54,50,0.4)',
    'inset 0px 1px 0.364px rgba(247,242,237,0.3)',
    'inset 0px -2.182px 0.364px #120c08',
    'inset 0px -2.545px 4px -2.182px rgba(247,242,237,0.5)',
  ].join(', ')

  const handleTeamPlan = async () => {
    setTeamLoading(true)
    setTeamError(null)
    try {
      const { checkout_url } = await createCheckout({ plan: teamTier.planType, billing })
      window.location.href = checkout_url
    } catch (err) {
      setTeamError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setTeamLoading(false)
    }
  }

  const handleIndividualPlan = () => {
    push(ONBOARDING_TONE_ROUTE)
  }

  return (
    <>
      <style>{`
        .sv-team-slider {
          -webkit-appearance: none; appearance: none;
          height: 4px; border-radius: 2px; outline: none; cursor: pointer;
        }
        .sv-team-slider::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 10px; height: 10px; border-radius: 50%;
          background: #fff; border: none; cursor: pointer;
          box-shadow: 0 1px 4px rgba(0,0,0,0.22), 0 0 0 2px rgba(255,255,255,0.3);
        }
        .sv-team-slider::-moz-range-thumb {
          width: 10px; height: 10px; border-radius: 50%;
          background: #fff; border: none; cursor: pointer;
          box-shadow: 0 1px 4px rgba(0,0,0,0.22);
        }
        .sv-ind-slider {
          -webkit-appearance: none; appearance: none;
          height: 4px; border-radius: 2px; outline: none; cursor: pointer;
        }
        .sv-ind-slider::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 10px; height: 10px; border-radius: 50%;
          background: #fff; border: none; cursor: pointer;
          box-shadow: 0 1px 4px rgba(0,0,0,0.22), 0 0 0 1px rgba(59,54,50,0.2);
        }
        .sv-ind-slider::-moz-range-thumb {
          width: 10px; height: 10px; border-radius: 50%;
          background: #fff; border: none; cursor: pointer;
          box-shadow: 0 1px 4px rgba(0,0,0,0.22);
        }
      `}</style>

      <div style={{
        minHeight: '100vh', width: '100%', background: CANVAS_GRADIENT,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '48px 24px 64px', boxSizing: 'border-box', gap: 32,
      }}>

        {/* Top bar */}
        <div style={{ width: '100%', maxWidth: 1060, display: 'flex', alignItems: 'center', justifyContent: 'space-evenly' }}>
          <Button variant="outline" size="sm" onClick={() => push(ONBOARDING_ACCOUNT_TYPE_ROUTE)} leftIcon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}>
            Back
          </Button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BillingToggle billing={billing} onChange={setBilling} />
            <YellowBadge>Save 25%</YellowBadge>
          </div>
          <Button variant="default" size="sm" onClick={() => void logout()} leftIcon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M13 3v10M6.5 10.5 3.5 8l3-2.5M3.5 8H11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}>
            Log out
          </Button>
        </div>

        {isTeam ? (
          /* ══════════════════════════════════════════════════════════════════
             TEAMS & ENTERPRISE VARIANT — Team card + Custom/Enterprise card
             ══════════════════════════════════════════════════════════════════ */
          <div style={{ display: 'flex', gap: 32, width: '100%', maxWidth: 1060, alignItems: 'flex-start' }}>

            {/* Team card */}
            <div style={{ flex: '0 0 523px', display: 'flex', flexDirection: 'column', gap: 8, backgroundColor: 'white', borderRadius: 18, border: '1px solid var(--neutral-200,#e5e5e5)', padding: 12, boxShadow: '0px 1px 1px rgba(0,0,0,0.05)', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h2 style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'black', margin: 0 }}>Team</h2>
                  <YellowBadge>Most popular</YellowBadge>
                </div>
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500,#827a74)', margin: 0 }}>
                  Shared credits across unlimited members. No per-seat fees.
                </p>
              </div>

              {/* Slack highlight */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px 12px 12px', borderRadius: 12, backgroundColor: 'var(--neutral-50,#f7f2ed)', boxShadow: '0px 1.091px 1.091px rgba(59,54,50,0.05), 0px 1.455px 3.127px rgba(38,33,30,0.15), inset 0px -2.182px 0.364px var(--neutral-100,#ede1d7)' }}>
                <SlackLogo />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 13, lineHeight: '16px', color: 'var(--neutral-600,#6a625d)' }}>Team-exclusive</span>
                  <div>
                    <p style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 16, lineHeight: '22px', color: 'black', margin: 0 }}>Souvenir Slack Manager</p>
                    <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '15px', color: 'var(--neutral-600,#6a625d)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Bot in Slack, by @-mention.</p>
                  </div>
                </div>
              </div>

              {/* Volume pricing */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ backgroundColor: 'var(--neutral-700,#524b47)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 13, lineHeight: '16px', color: 'white', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Pick your team&apos;s volume</p>
                  <div style={{ overflow: 'hidden' }}>
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={`team-price-${teamTierIndex}-${billing}`}
                        initial={{ opacity: 0, y: teamSlideDir * 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: teamSlideDir * -12 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        style={{ margin: 0, lineHeight: 0 }}
                      >
                        <span style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 40, lineHeight: '48px', color: '#fff' }}>{teamPrice}</span>
                        <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-100,#ede1d7)' }}>/mo{billing === 'annual' && ` · billed ${teamTier.annualBilled}`}</span>
                      </motion.p>
                    </AnimatePresence>
                  </div>
                  <div style={{ position: 'relative', backgroundColor: 'var(--neutral-50,#f7f2ed)', borderRadius: 12, padding: '12px', width: '100%', boxSizing: 'border-box', boxShadow: '0px 1.091px 1.091px rgba(59,54,50,0.05), 0px 1.455px 3.127px rgba(38,33,30,0.15), inset 0px -2.182px 0.364px var(--neutral-100,#ede1d7)', overflow: 'hidden' }}>
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={`team-credits-${teamTierIndex}`}
                        initial={{ opacity: 0, y: teamSlideDir * 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: teamSlideDir * -12 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}
                      >
                        <span style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'black' }}>{teamTier.creditsLabel}</span>
                        <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '15px', color: 'var(--neutral-600,#6a625d)' }}>credits / month</span>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input type="range" min={0} max={TEAM_TIERS.length - 1} step={1} value={teamTierIndex} onChange={(e) => setTeamTier(Number(e.target.value))} className="sv-team-slider" style={{ display: 'block', width: '100%', padding: 0, background: teamSliderBg }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      {TEAM_TIERS.map((t, i) => (
                        <button key={t.sliderLabel} type="button" style={{ background: 'none', border: 'none', padding: 0, fontFamily: 'var(--font-body)', fontWeight: i === teamTierIndex ? 600 : 400, fontSize: 14, lineHeight: '22px', color: i === teamTierIndex ? 'var(--neutral-50,#f7f2ed)' : 'rgba(255,255,255,0.38)', cursor: 'pointer' }} onClick={() => setTeamTier(i)}>
                          {t.sliderLabel}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Team features */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
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
                  <Divider />
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

              {teamError && <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-tag-Red-text,#dc2626)', margin: 0 }}>{teamError}</p>}
              <button type="button" disabled={teamLoading} onClick={() => void handleTeamPlan()} style={{ width: '100%', padding: '6px 20px 8px', borderRadius: 10, border: 'none', cursor: teamLoading ? 'default' : 'pointer', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-50,#f7f2ed)', background: teamLoading ? 'var(--neutral-500,#827a74)' : 'linear-gradient(180deg, var(--neutral-700,#524b47) 0%, var(--neutral-900,#26211e) 100%)', boxShadow: teamLoading ? 'none' : ctaShadow, transition: 'background 0.15s' }}>
                {teamLoading ? 'Setting up…' : 'Start a Team Workspace'}
              </button>
            </div>

            {/* Custom / Enterprise card */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, backgroundColor: 'white', borderRadius: 18, border: '1px solid var(--neutral-200,#e5e5e5)', padding: 12, boxShadow: '0px 1px 1px rgba(0,0,0,0.05)', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <h2 style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'black', margin: 0 }}>Custom</h2>
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500,#827a74)', margin: 0 }}>Unlimited postpaid usage with a predictable monthly platform fee.</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ display: 'flex', gap: 92, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <SectionLabel>Team collaboration</SectionLabel>
                    <FeatureItem label="$250 monthly platform fee" />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 24 }}>
                    <FeatureItem label="$125 provider usage included" />
                    <FeatureItem label="Additional usage billed at exact provider cost" />
                  </div>
                </div>
                <Divider />
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
                <Divider />
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
              <button type="button" onClick={() => setContactSalesOpen(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: '6px 20px 8px', borderRadius: 10, border: 'none', backgroundColor: 'white', color: 'var(--neutral-700,#524b47)', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', cursor: 'pointer', boxSizing: 'border-box', boxShadow: '0px 1.091px 1.091px rgba(59,54,50,0.05), 0px 1.455px 3.127px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-100,#ede1d7), inset 0px -2.182px 0.364px var(--neutral-100,#ede1d7)' }}>
                Contact Sales
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M2.5 8h11M9.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
          </div>

        ) : (
          /* ══════════════════════════════════════════════════════════════════
             INDIVIDUAL VARIANT — 2-column card: left = pricing, right = features
             ══════════════════════════════════════════════════════════════════ */
          <div style={{ display: 'flex', justifyContent: 'center', width: '100%', maxWidth: 1060 }}>
            <div style={{
              width: '100%', maxWidth: 860,
              display: 'flex', flexDirection: 'row',
              backgroundColor: 'var(--general-input,white)',
              borderRadius: 18,
              border: '1px solid var(--general-border,var(--neutral-200,#e5e5e5))',
              boxShadow: '0px 1px 1px rgba(0,0,0,0.05)',
              boxSizing: 'border-box',
              padding: 15,
            }}>

              {/* ── LEFT COLUMN: header + welcome gift + pricing slider + CTA ── */}
              <div style={{ flex: '0 0 380px', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 12, justifyContent: 'space-between' }}>

                {/* Header */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <h2 style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'black', margin: 0, whiteSpace: 'nowrap' }}>
                    Individual
                  </h2>
                  <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500,#827a74)', margin: 0 }}>
                    For prosumers, creators, and solo operators.
                  </p>
                </div>

                {/* Welcome gift card */}
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '12px 16px 12px 12px', borderRadius: 12, backgroundColor: 'var(--neutral-50,#f7f2ed)', boxShadow: '0px 1.091px 1.091px rgba(59,54,50,0.05), 0px 1.455px 3.127px rgba(38,33,30,0.15)' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <TokenSquare />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <p style={{ fontFamily: 'var(--font-code,\'Geist Mono\',monospace)', fontWeight: 400, fontSize: 13, lineHeight: '16px', color: 'var(--neutral-600,#6a625d)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        Welcome gift
                      </p>
                      <div>
                        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 16, lineHeight: '22px', color: 'black', margin: 0, whiteSpace: 'nowrap' }}>
                          1,000 free credits
                        </p>
                        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '19px', color: 'var(--neutral-600,#6a625d)', margin: 0 }}>
                          No credit card required. Try every feature with real workloads before you pay.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div style={{ position: 'absolute', inset: 0, borderRadius: 12, pointerEvents: 'none', boxShadow: 'inset 0px -2.182px 0.364px 0px var(--neutral-100,#ede1d7)' }} />
                </div>

                {/* Volume pricing panel — flex: 1 fills remaining height */}
                <div style={{ flex: 1, minHeight: 0, backgroundColor: 'var(--neutral-100,#ede1d7)', borderRadius: 16, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontFamily: 'var(--font-code,\'Geist Mono\',monospace)', fontWeight: 400, fontSize: 13, lineHeight: '16px', color: 'var(--neutral-600,#6a625d)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Pick your monthly credits
                  </p>

                  {/* Price — counter animation */}
                  <p style={{ margin: 0, lineHeight: 0 }}>
                    <span style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 40, lineHeight: '48px', color: 'black' }}>${animPriceNum}</span>
                    <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: '#827a74' }}>/mo{billing === 'annual' ? ` billed annually (${indTier.annualBilled})` : ''}</span>
                  </p>

                  {/* Credits display — directional slide animation */}
                  <div style={{ backgroundColor: 'var(--neutral-50,#f7f2ed)', borderRadius: 12, padding: '10px 12px', boxSizing: 'border-box', boxShadow: '0px 1.091px 1.091px rgba(59,54,50,0.05), 0px 1.455px 3.127px rgba(38,33,30,0.15), inset 0px -2.182px 0.364px var(--neutral-100,#ede1d7)', overflow: 'hidden' }}>
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={indTierIndex}
                        initial={{ opacity: 0, y: indSlideDir * 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: indSlideDir * -12 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}
                      >
                        <span style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'black' }}>{indTier.creditsLabel}</span>
                        <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '15px', color: 'var(--neutral-600,#6a625d)' }}>credits / month</span>
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  {/* Animated slider + tier buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <IndSlider value={indTierIndex} onChange={setIndTier} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
                      {INDIVIDUAL_TIERS.map((t, i) => {
                        const isActive = i === indTierIndex
                        const isAnnual = billing === 'annual'
                        const label    = isAnnual ? t.annualBilled.replace('/yr', '') : t.sliderLabel
                        return (
                          <Button
                            key={t.sliderLabel}
                            variant={isActive ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setIndTier(i)}
                          >
                            <AnimatePresence mode="wait" initial={false}>
                              <motion.span
                                key={label}
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                                transition={{ duration: 0.14, ease: 'easeOut' }}
                                style={isAnnual && !isActive ? { color: 'var(--yellow-700,#6d5921)' } : undefined}
                              >
                                {label}
                              </motion.span>
                            </AnimatePresence>
                          </Button>
                        )
                      })}
                    </div>
                    <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-500,#827a74)', textAlign: 'center', margin: 0 }}>
                      Click a plan above to preview its credit value.
                    </p>
                  </div>
                </div>

                {/* CTA + hint */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Button variant="secondary" fluid onClick={handleIndividualPlan}>
                    Start for free
                  </Button>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <InformationCircleIcon animated size={13} color="var(--neutral-400,#a09890)" />
                    <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-400,#a09890)' }}>
                      No payment needed now — upgrade anytime inside the app.
                    </span>
                  </div>
                </div>
              </div>

              {/* Column separator */}
              <div style={{ width: 1, backgroundColor: 'var(--neutral-100,#ede1d7)', flexShrink: 0, alignSelf: 'stretch' }} />

              {/* ── RIGHT COLUMN: feature sections ── */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, paddingLeft: 12 }}>

                {/* Memory & Organization */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <SectionLabel>Memory &amp; Organization</SectionLabel>
                  <IndFeatureItem label="Cross-model memory that compounds" />
                  <IndFeatureItem label="Unlimited Pins" />
                  <IndFeatureItem label="Project folders" />
                  <IndFeatureItem label="Highlights from any answer" />
                </div>

                <Divider />

                {/* Your AI workforce */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <SectionLabel>Your AI workforce</SectionLabel>
                  <IndFeatureItem label="Unlimited AI Assistants" />
                  <IndFeatureItem label="Unlimited Brain &amp; Automation" />
                  <IndFeatureItem label="Scheduled tasks &amp; triggers" />
                </div>

                <Divider />

                {/* Models & tools */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <SectionLabel>Models &amp; tools</SectionLabel>
                  <IndFeatureItem label="Every major AI model" />
                  <IndFeatureItem label="Auto-route or pick manually" />
                  <IndFeatureItem label="Model Compare side-by-side" />
                  <IndFeatureItem label="Unlimited web search" />
                  <IndFeatureItem label="250+ connectors" />
                </div>
              </div>

            </div>
          </div>
        )}
      </div>

      {contactSalesOpen && <ContactSalesModal onClose={() => setContactSalesOpen(false)} />}
    </>
  )
}
