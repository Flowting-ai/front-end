'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { useOrg } from '@/context/org-context'
import { type UserPlanType } from '@/lib/api/user'
import { createCheckout, type CheckoutPlan } from '@/lib/api/stripe'
import { toast } from 'sonner'

const TITLE = 'var(--font-title)'
const BODY  = 'var(--font-body)'
const MONO  = "'Geist Mono', ui-monospace, monospace"

const INDIVIDUAL_PLANS: { id: UserPlanType; price: number; credits: number }[] = [
  { id: 'starter', price: 12,  credits: 5000  },
  { id: 'pro',     price: 25,  credits: 12000 },
  { id: 'power',   price: 100, credits: 50000 },
]

const TEAM_PLANS: { price: number; credits: number; label: string; planType: CheckoutPlan }[] = [
  { price: 125,  credits: 60000,   label: '$125',  planType: 'team_125'  },
  { price: 250,  credits: 120000,  label: '$250',  planType: 'team_250'  },
  { price: 500,  credits: 250000,  label: '$500',  planType: 'team_500'  },
  { price: 1000, credits: 500000,  label: '$1k',   planType: 'team_1000' },
  { price: 1500, credits: 750000,  label: '$1.5k', planType: 'team_1500' },
  { price: 2000, credits: 1000000, label: '$2k',   planType: 'team_2000' },
]

function fmtNum(n: number): string {
  return n.toLocaleString('en-US')
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
  const { org, orgId, orgRole, orgReady } = useOrg()
  const [individualIdx, setIndividualIdx] = useState(1)
  const [teamIdx,       setTeamIdx]       = useState(1)
  const [changingTo,    setChangingTo]    = useState<CheckoutPlan | null>(null)

  const currentPlan      = user?.planType ?? null
  const firstName        = user?.name?.split(' ')[0] ?? 'there'
  const selectedIndividual = INDIVIDUAL_PLANS[individualIdx]!
  const selectedTeam       = TEAM_PLANS[teamIdx]!

  const isOnTeamPlan       = Boolean(user?.orgId || orgId)
  const currentTeamPrice   = isOnTeamPlan ? (org.monthlyPrice ?? 0) : 0
  const currentTeamTierIdx = TEAM_PLANS.findIndex(p => p.price === currentTeamPrice)

  // Sync individual slider to user's current plan on load
  useEffect(() => {
    if (currentPlan) {
      const idx = INDIVIDUAL_PLANS.findIndex(p => p.id === currentPlan)
      if (idx >= 0) setIndividualIdx(idx)
    }
  }, [currentPlan])

  // Sync team slider to user's current tier on load
  useEffect(() => {
    if (isOnTeamPlan && currentTeamTierIdx >= 0) {
      setTeamIdx(currentTeamTierIdx)
    }
  }, [isOnTeamPlan, currentTeamTierIdx])

  useEffect(() => {
    if (orgReady && orgRole !== 'owner') {
      router.replace('/org/plans')
    }
  }, [orgReady, orgRole, router])

  const handleSelectIndividual = async () => {
    if (changingTo) return
    const plan = selectedIndividual.id
    if (plan === currentPlan) return
    setChangingTo(plan)
    try {
      const checkout = await createCheckout({ plan, billing: 'monthly' })
      document.cookie = 'souvenir_checkout_complete=1; path=/; max-age=3600; SameSite=Lax'
      window.location.href = checkout.checkout_url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update plan')
      setChangingTo(null)
    }
  }

  const handleSelectTeam = async () => {
    if (teamButtonDisabled) return
    const plan = selectedTeam.planType
    setChangingTo(plan)
    try {
      const checkout = await createCheckout({ plan, billing: 'monthly' })
      document.cookie = 'souvenir_checkout_complete=1; path=/; max-age=3600; SameSite=Lax'
      window.location.href = checkout.checkout_url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start checkout')
      setChangingTo(null)
    }
  }

  const isCurrent          = selectedIndividual.id === currentPlan
  const teamIsCurrent      = isOnTeamPlan && teamIdx === currentTeamTierIdx
  const teamIsDowngrade    = isOnTeamPlan && teamIdx < currentTeamTierIdx
  const teamButtonDisabled = teamIsCurrent || teamIsDowngrade || !!changingTo

  const teamButtonLabel = (() => {
    if (teamIsCurrent)                          return 'Current plan'
    if (teamIsDowngrade)                        return "Can't downgrade"
    if (changingTo === selectedTeam.planType)   return 'Redirecting…'
    if (isOnTeamPlan)                           return 'Upgrade team plan'
    return 'Start a Team Workspace'
  })()

  const teamPriceLabel = selectedTeam.price >= 1000
    ? `$${selectedTeam.price / 1000}k`
    : `$${selectedTeam.price}`

  if (!orgReady || orgRole !== 'owner') return null

  return (
    <>
      <style>{`
        .cp-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 4px;
          border-radius: 2px;
          outline: none;
          cursor: pointer;
          background: white;
        }
        .cp-slider.dark { background: rgba(255,255,255,0.25); }
        .cp-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 12px; height: 12px;
          border-radius: 50%;
          background: white;
          border: 1.5px solid #b6aca4;
          box-shadow: 0px 1px 2px rgba(0,0,0,0.2);
          cursor: pointer;
        }
        .cp-slider::-moz-range-thumb {
          width: 12px; height: 12px;
          border-radius: 50%;
          background: white;
          border: 1.5px solid #b6aca4;
          box-shadow: 0px 1px 2px rgba(0,0,0,0.2);
          cursor: pointer;
        }
        .cp-slider::-webkit-slider-runnable-track { border-radius: 2px; }
        .cp-slider::-moz-range-track { border-radius: 2px; height: 4px; }
      `}</style>

      <div
        className="kaya-scrollbar"
        style={{
          flex: '1 0 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '0 24px 48px',
          backgroundColor: '#f7f2ed',
        }}
      >
        {/* Back button */}
        <div style={{
          width: '100%', maxWidth: 1200,
          paddingTop: 24, paddingBottom: 0,
          flexShrink: 0,
        }}>
          <button
            type="button"
            onClick={() => router.push('/org/plans')}
            style={{
              display:         'inline-flex',
              alignItems:      'center',
              gap:             6,
              padding:         '6px 12px 6px 8px',
              borderRadius:    8,
              border:          'none',
              backgroundColor: 'rgba(0,0,0,0)',
              cursor:          'pointer',
              fontFamily:      BODY,
              fontWeight:      500,
              fontSize:        13,
              lineHeight:      '18px',
              color:           '#7a6e68',
              transition:      'background-color 120ms ease, color 120ms ease',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(0,0,0,0.05)'; (e.currentTarget as HTMLButtonElement).style.color = '#3b3632' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(0,0,0,0)'; (e.currentTarget as HTMLButtonElement).style.color = '#7a6e68' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to Plans
          </button>
        </div>

        <div style={{ width: '100%', maxWidth: 1200, display: 'flex', flexDirection: 'column', gap: 64, alignItems: 'center', paddingTop: 40 }}>

          {/* ── Header ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
            {/* Badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', borderRadius: 6, overflow: 'hidden',
              boxShadow: '0px 1.476px 2.214px 0px rgba(20,12,5,0.2), 0px 0px 0px 1px rgba(126,84,53,0.5)',
            }}>
              <div style={{ position: 'absolute', inset: 0, backgroundColor: '#e6d5ca', borderRadius: 6 }} />
              <div style={{ position: 'absolute', inset: 0, borderRadius: 6, pointerEvents: 'none', boxShadow: 'inset 0px 1.476px 0px 0px rgba(250,241,235,0.7), inset 0px -1.476px 0px 0px rgba(126,84,53,0.1)' }} />
              <span style={{ fontFamily: BODY, fontWeight: 500, fontSize: 11, lineHeight: '16px', color: '#683d1b', position: 'relative', padding: '2.952px 5.904px' }}>
                Multi-agent workforce
              </span>
            </div>

            {/* Title */}
            <h1 style={{ fontFamily: TITLE, fontWeight: 400, fontSize: 48, lineHeight: '56px', color: 'black', margin: 0, textAlign: 'center', maxWidth: 977 }}>
              Choose your plan,{' '}
              <span style={{ color: '#6a625d' }}>{firstName}.</span>
            </h1>

            {/* Subtitle */}
            <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: 16, lineHeight: '22px', color: 'black', margin: 0, textAlign: 'center', maxWidth: 977 }}>
              Pick a plan to keep your Brain, agents, and automations running.
            </p>
          </div>

          {/* ── Plan cards ── */}
          <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', width: '100%', flexWrap: 'wrap', justifyContent: 'center' }}>

            {/* ── Individual ── */}
            <div style={{ flex: '0 0 370px', maxWidth: 370, display: 'flex', flexDirection: 'column', opacity: isOnTeamPlan ? 0.45 : 1, pointerEvents: isOnTeamPlan ? 'none' : undefined }}>
              <div style={{
                backgroundColor: 'white',
                border: '1px solid #e5e5e5',
                borderRadius: 18,
                padding: 12,
                display: 'flex', flexDirection: 'column', gap: 8,
                boxShadow: '0px 1px 1px rgba(0,0,0,0.05)',
              }}>
                {/* Header */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <p style={{ fontFamily: TITLE, fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'black', margin: 0 }}>
                    Individual
                  </p>
                  <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: 14, lineHeight: '22px', color: '#827a74', margin: 0 }}>
                    For prosumers, creators, and solo operators.
                  </p>
                </div>

                {/* Welcome gift card */}
                <div style={{
                  backgroundColor: '#f7f2ed', borderRadius: 12, padding: '12px 16px',
                  display: 'flex', gap: 8, alignItems: 'flex-start',
                  boxShadow: '0px 1.091px 1.091px 0px rgba(59,54,50,0.05), 0px 1.455px 3.127px 0px rgba(38,33,30,0.15), inset 0px -2.182px 0.364px 0px #ede1d7',
                }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 12, flexShrink: 0,
                    backgroundColor: '#3b3632',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                      <path d="M8 8h16v4H8zM8 14h8v10H8zM16 14h8v10h-8z" fill="rgba(255,255,255,0.15)" />
                      <rect x="6" y="6" width="20" height="20" rx="2" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" fill="none" />
                      <path d="M16 6v20M6 12h20" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                    </svg>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <p style={{ fontFamily: MONO, fontWeight: 400, fontSize: 13, lineHeight: '16px', color: '#6a625d', margin: 0 }}>
                      Welcome gift
                    </p>
                    <p style={{ fontFamily: BODY, fontWeight: 600, fontSize: 16, lineHeight: '22px', color: 'black', margin: 0 }}>
                      1,000 free credits
                    </p>
                    <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: 11, lineHeight: '19px', color: '#6a625d', margin: 0 }}>
                      No credit card required. Try every feature with real workloads before you pay.
                    </p>
                  </div>
                </div>

                {/* Price slider box */}
                <div style={{
                  backgroundColor: '#ede1d7', borderRadius: 16, padding: 16,
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  <p style={{ fontFamily: MONO, fontWeight: 400, fontSize: 13, lineHeight: '16px', color: '#6a625d', margin: 0 }}>
                    Pick your monthly credits
                  </p>
                  <div>
                    <span style={{ fontFamily: TITLE, fontWeight: 400, fontSize: 40, lineHeight: '48px', color: 'black' }}>
                      ${selectedIndividual.price}
                    </span>
                    <span style={{ fontFamily: BODY, fontWeight: 400, fontSize: 14, lineHeight: '22px', color: '#827a74' }}>
                      /mo
                    </span>
                  </div>

                  {/* Credits card */}
                  <div style={{
                    backgroundColor: '#f7f2ed', borderRadius: 12, padding: '12px 16px',
                    boxShadow: '0px 1.091px 1.091px 0px rgba(59,54,50,0.05), 0px 1.455px 3.127px 0px rgba(38,33,30,0.15), inset 0px -2.182px 0.364px 0px #ede1d7',
                    display: 'flex', alignItems: 'flex-end', gap: 4,
                  }}>
                    <span style={{ fontFamily: TITLE, fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'black' }}>
                      {fmtNum(selectedIndividual.credits)}
                    </span>
                    <span style={{ fontFamily: BODY, fontWeight: 400, fontSize: 11, lineHeight: '19px', color: '#6a625d', paddingBottom: 2 }}>
                      credits / month
                    </span>
                  </div>

                  {/* Slider */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ paddingLeft: 4 }}>
                      <input
                        type="range"
                        min={0}
                        max={INDIVIDUAL_PLANS.length - 1}
                        step={1}
                        value={individualIdx}
                        onChange={e => {
                          const idx = Number(e.target.value)
                          setIndividualIdx(idx)
                          const p = INDIVIDUAL_PLANS[idx]!
                          const name = p.id.charAt(0).toUpperCase() + p.id.slice(1)
                          const detail = `$${p.price}/mo · ${fmtNum(p.credits)} credits`
                          const currentPriceIdx = INDIVIDUAL_PLANS.findIndex(x => x.id === currentPlan)
                          if (p.id === currentPlan) {
                            toast.info(`${name} is your current plan — ${detail}`)
                          } else if (currentPriceIdx >= 0 && idx > currentPriceIdx) {
                            toast.info(`Upgrade to ${name} — ${detail}`)
                          } else if (currentPriceIdx >= 0 && idx < currentPriceIdx) {
                            toast.info(`Downgrade to ${name} — ${detail}`)
                          } else {
                            toast.info(`${name} — ${detail}`)
                          }
                        }}
                        className="cp-slider"
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      {INDIVIDUAL_PLANS.map(p => (
                        <span key={p.id} style={{ fontFamily: BODY, fontWeight: 400, fontSize: 14, lineHeight: '22px', color: '#3b3632' }}>
                          ${p.price}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '4px 0' }}>
                  <FeatureGroup
                    title="Memory & Organization"
                    items={['Cross-model memory that compounds', 'Unlimited Pins', 'Project folders', 'Highlights from any answer']}
                  />
                  <Hairline />
                  <FeatureGroup
                    title="Your AI workforce"
                    items={['Unlimited AI Assistants', 'Unlimited Brain & Automation', 'Scheduled tasks & triggers']}
                  />
                  <Hairline />
                  <FeatureGroup
                    title="Models & tools"
                    items={['Every major AI model', 'Auto-route or pick manually', 'Model Compare side-by-side', 'Unlimited web search', '250+ connectors']}
                  />

                  <button
                    onClick={() => { void handleSelectIndividual() }}
                    disabled={isOnTeamPlan || isCurrent || !!changingTo}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '100%', padding: '6px 2px 8px', borderRadius: 10, border: 'none',
                      cursor: isOnTeamPlan || isCurrent || changingTo ? 'default' : 'pointer',
                      opacity: changingTo && changingTo !== selectedIndividual.id ? 0.5 : 1,
                      backgroundColor: 'white',
                      boxShadow: '0px 1.091px 1.091px 0px rgba(59,54,50,0.05), 0px 1.455px 3.127px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px #ede1d7, inset 0px -2.182px 0.364px 0px #ede1d7',
                      fontFamily: BODY, fontWeight: 500, fontSize: 14, lineHeight: '22px', color: '#524b47',
                    }}
                  >
                    {isCurrent
                      ? 'Current plan'
                      : changingTo === selectedIndividual.id
                        ? 'Redirecting…'
                        : 'Change plan'}
                  </button>
                </div>
              </div>
            </div>

            {/* ── Team ── */}
            <div style={{ flex: '0 0 370px', maxWidth: 370, display: 'flex', flexDirection: 'column' }}>
              <div style={{
                backgroundColor: 'white',
                borderRadius: 18,
                padding: 12,
                display: 'flex', flexDirection: 'column', gap: 8,
                boxShadow: '0px 1px 1px rgba(0,0,0,0.05)',
              }}>
                {/* Header */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <p style={{ fontFamily: TITLE, fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'black', margin: 0 }}>
                      Team
                    </p>
                    {/* Most popular badge */}
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      position: 'relative', borderRadius: 6, overflow: 'hidden',
                      boxShadow: '0px 1px 1.5px 0px rgba(20,16,5,0.2), 0px 0px 0px 1px rgba(143,116,39,0.5)',
                    }}>
                      <div style={{ position: 'absolute', inset: 0, backgroundColor: '#e9dfc9', borderRadius: 6 }} />
                      <div style={{ position: 'absolute', inset: 0, borderRadius: 6, pointerEvents: 'none', boxShadow: 'inset 0px 1px 0px 0px rgba(250,246,235,0.7), inset 0px -1px 0px 0px rgba(143,116,39,0.1)' }} />
                      <span style={{ fontFamily: BODY, fontWeight: 500, fontSize: 11, lineHeight: '16px', color: '#6d5921', position: 'relative', padding: '2px 4px' }}>
                        Most popular
                      </span>
                    </div>
                  </div>
                  <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: 14, lineHeight: '22px', color: '#827a74', margin: 0 }}>
                    Shared credits across unlimited members. No per-seat fees.
                  </p>
                </div>

                {/* Team-exclusive card */}
                <div style={{
                  backgroundColor: '#f7f2ed', borderRadius: 12, padding: '12px 16px',
                  display: 'flex', gap: 8, alignItems: 'flex-start',
                  boxShadow: '0px 1.091px 1.091px 0px rgba(59,54,50,0.05), 0px 1.455px 3.127px 0px rgba(38,33,30,0.15), inset 0px -2.182px 0.364px 0px #ede1d7',
                }}>
                  <div style={{
                    width: 60, height: 60, borderRadius: 12, flexShrink: 0,
                    background: 'linear-gradient(135deg, #4A154B 0%, #2EB67D 50%, #ECB22E 75%, #E01E5A 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
                  }}>
                    #
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <p style={{ fontFamily: MONO, fontWeight: 400, fontSize: 13, lineHeight: '16px', color: '#6a625d', margin: 0 }}>
                      Team-exclusive
                    </p>
                    <p style={{ fontFamily: BODY, fontWeight: 600, fontSize: 16, lineHeight: '22px', color: 'black', margin: 0 }}>
                      Souvenir Slack Manager
                    </p>
                    <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: 11, lineHeight: '19px', color: '#6a625d', margin: 0 }}>
                      One bot in Slack & Microsoft Teams. The entire AI workforce, accessible by @-mention.
                    </p>
                  </div>
                </div>

                {/* Dark price slider box */}
                <div style={{
                  backgroundColor: '#524b47', borderRadius: 16, padding: 16,
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  <p style={{ fontFamily: MONO, fontWeight: 400, fontSize: 13, lineHeight: '16px', color: 'white', margin: 0 }}>
                    {"Pick your team's volume"}
                  </p>
                  <div>
                    <span style={{ fontFamily: TITLE, fontWeight: 400, fontSize: 40, lineHeight: '48px', color: 'white' }}>
                      {teamPriceLabel}
                    </span>
                    <span style={{ fontFamily: BODY, fontWeight: 400, fontSize: 14, lineHeight: '22px', color: '#ede1d7' }}>
                      /mo
                    </span>
                  </div>

                  {/* Credits card */}
                  <div style={{
                    backgroundColor: '#f7f2ed', borderRadius: 12, padding: '12px 16px',
                    boxShadow: '0px 1.091px 1.091px 0px rgba(59,54,50,0.05), 0px 1.455px 3.127px 0px rgba(38,33,30,0.15), inset 0px -2.182px 0.364px 0px #ede1d7',
                    display: 'flex', alignItems: 'flex-end', gap: 4,
                  }}>
                    <span style={{ fontFamily: TITLE, fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'black' }}>
                      {fmtNum(selectedTeam.credits)}
                    </span>
                    <span style={{ fontFamily: BODY, fontWeight: 400, fontSize: 11, lineHeight: '19px', color: '#6a625d', paddingBottom: 2 }}>
                      credits / month
                    </span>
                  </div>

                  {/* Slider */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ paddingLeft: 4 }}>
                      <input
                        type="range"
                        min={0}
                        max={TEAM_PLANS.length - 1}
                        step={1}
                        value={teamIdx}
                        onChange={e => {
                          const idx = Number(e.target.value)
                          setTeamIdx(idx)
                          const p = TEAM_PLANS[idx]!
                          const detail = `${p.label}/mo · ${fmtNum(p.credits)} credits`
                          if (!isOnTeamPlan) {
                            toast.info(`Upgrade to teams — ${detail}`)
                          } else if (idx === currentTeamTierIdx) {
                            toast.info(`This is your current plan — ${detail}`)
                          } else if (idx < currentTeamTierIdx) {
                            toast.info(`Can't downgrade — ${detail}`)
                          } else {
                            toast.info(`Upgrade team plan — ${detail}`)
                          }
                        }}
                        className="cp-slider dark"
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      {TEAM_PLANS.map(p => (
                        <span key={p.price} style={{ fontFamily: BODY, fontWeight: 400, fontSize: 14, lineHeight: '22px', color: '#f7f2ed' }}>
                          {p.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '4px 0' }}>
                  <FeatureGroup
                    title="Everything in Individual, plus"
                    items={['Slack & Teams manager bot']}
                  />
                  <Hairline />
                  <FeatureGroup
                    title="Team collaboration"
                    items={['Unlimited members · no per-seat', 'Shared AI Assistants', 'Shared Pins & Highlights', 'Shared Project folders']}
                  />
                  <Hairline />
                  <FeatureGroup
                    title="Governance & control"
                    items={['Admin controls + per-member caps', 'Approval gates', 'Full audit trail']}
                  />
                  <Hairline />
                  <FeatureGroup
                    title="Support"
                    items={['Priority email support', 'Online meeting support']}
                  />

                  <button
                    onClick={() => { void handleSelectTeam() }}
                    disabled={teamButtonDisabled}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '100%', padding: '6px 2px 8px', borderRadius: 10, border: 'none',
                      cursor: teamButtonDisabled ? 'default' : 'pointer',
                      opacity: teamButtonDisabled ? 0.55 : 1,
                      background: 'linear-gradient(to bottom, #524b47, #26211e)',
                      boxShadow: '0px 0px 0px 1px black, 0px 1.091px 1.091px 0px rgba(59,54,50,0.1), 0px 1.455px 3.127px 0px rgba(59,54,50,0.4), inset 0px 1px 0.364px 0px rgba(247,242,237,0.3), inset 0px -2.182px 0.364px 0px #120c08, inset 0px -2.545px 4px -2.182px rgba(247,242,237,0.5)',
                      fontFamily: BODY, fontWeight: 500, fontSize: 14, lineHeight: '22px', color: '#f7f2ed',
                      textShadow: '0px -0.727px 0.364px rgba(0,0,0,0.25), 0px 0.364px 0.364px rgba(255,255,255,0.25)',
                    }}
                  >
                    {teamButtonLabel}
                  </button>
                </div>
              </div>
            </div>

            {/* ── Custom ── */}
            <div style={{ flex: '0 0 370px', maxWidth: 370, display: 'flex', flexDirection: 'column' }}>
              <div style={{
                backgroundColor: 'white',
                border: '1px solid #e5e5e5',
                borderRadius: 18,
                padding: 12,
                display: 'flex', flexDirection: 'column', gap: 8,
                boxShadow: '0px 1px 1px rgba(0,0,0,0.05)',
                height: '100%',
              }}>
                {/* Header */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <p style={{ fontFamily: TITLE, fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'black', margin: 0 }}>
                    Custom
                  </p>
                  <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: 14, lineHeight: '22px', color: '#827a74', margin: 0 }}>
                    For organizations running Souvenir at scale.
                  </p>
                </div>

                {/* Features */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '4px 0', flex: 1 }}>
                  <FeatureGroup
                    title="Everything in Team, plus"
                    items={['Custom credit volume', 'Volume discounts']}
                  />
                  <Hairline />
                  <FeatureGroup
                    title="Enterprise security"
                    items={['SSO', 'Shared AI Assistants', 'DPA & SLA', 'Private deployment options']}
                  />
                  <Hairline />
                  <FeatureGroup
                    title="White-glove service"
                    items={['Onboarding & training', 'Dedicated success manager', 'Monthly strategy review', 'Learning workspace']}
                  />
                  <Hairline />
                  <FeatureGroup
                    title="Support"
                    items={['Priority email support', 'Online meeting support']}
                  />

                  <div style={{ flex: 1 }} />

                  <a
                    href="mailto:contact@getsouvenir.com"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                      width: '100%', padding: '6px 2px 8px', borderRadius: 10, textDecoration: 'none',
                      backgroundColor: 'white',
                      boxShadow: '0px 1.091px 1.091px 0px rgba(59,54,50,0.05), 0px 1.455px 3.127px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px #ede1d7, inset 0px -2.182px 0.364px 0px #ede1d7',
                      fontFamily: BODY, fontWeight: 500, fontSize: 14, lineHeight: '22px', color: '#524b47',
                    }}
                  >
                    Talk to sales
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path d="M3.5 8h9M9 4.5l3.5 3.5L9 11.5" stroke="#524b47" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}
