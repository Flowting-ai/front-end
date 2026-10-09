'use client'

import React, { useEffect, useState } from 'react'
import { Usage } from '@/lib/api/billing'
import { useAuth } from '@/context/auth-context'

// Settings → PERSONAL → Usage. Everyone sees their own Slack / Automations / Chat
// spend plus remaining credits on GET /stripe/usage.

const C = {
  ink:    'var(--neutral-900)',
  muted:  'var(--neutral-600)',
  border: 'var(--border-default)',
  hair:   'var(--neutral-100)',
  white:  'var(--card-bg)',
} as const
const TITLE = 'var(--font-title)'
const BODY  = 'var(--font-body)'
const CARD_RING = '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)'
const SECTION_SHADOW = '0px 2px 2.8px 0px rgba(82,75,71,0.12)'

// Chat includes subtask spend (agents a chat turn hands work to). Order is
// Slack > Automations > Chat throughout this page.
const CATEGORIES = [
  { key: 'slack', label: 'Slack', chipColor: 'blue',   subtitle: 'Messages and actions in Slack' },
  { key: 'automation', label: 'Automations', chipColor: 'yellow', subtitle: 'Scheduled and automated runs' },
  { key: 'chat',  label: 'Chat',  chipColor: 'red',    subtitle: 'Direct conversations' },
] as const

const CHIP_TOKENS: Record<string, { bg: string; text: string; ring: string }> = {
  yellow: { bg: 'var(--yellow-100)', text: 'var(--yellow-700,#6d5921)', ring: 'color-mix(in srgb, var(--yellow-600) 50%, transparent)' },
  blue:   { bg: 'var(--blue-100,#cadcf1)',   text: 'var(--blue-700,#135487)',   ring: 'var(--blue-600-50)' },
  red:    { bg: 'var(--red-100,#ffbfb6)',    text: 'var(--red-700,#7a201c)',    ring: 'var(--red-600-51)' },
}
const BAR_TOKENS: Record<string, string> = {
  yellow: 'var(--yellow-300,#c7b387)',
  blue:   'var(--accent,#0485f7)',
  red:    'var(--red-400,#ee3030)',
}

function fmtNum(n: number): string {
  return n.toLocaleString('en-US')
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return '—'
  }
}

function Chip({ label, color }: { label: string; color: string }) {
  const t = CHIP_TOKENS[color]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 6px', borderRadius: 6,
      backgroundColor: t.bg, boxShadow: `0px 1px 1.5px 0px rgba(20,16,5,0.2), 0px 0px 0px 1px ${t.ring}`,
      fontFamily: BODY, fontWeight: 500, fontSize: 11, lineHeight: '16px', color: t.text, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

function StackedProgressBar({ segments }: { segments: { color: string; value: number }[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  return (
    <div style={{ display: 'flex', height: 4, width: '100%', borderRadius: 2, overflow: 'hidden', backgroundColor: C.hair }}>
      {total > 0 && segments.map((s, i) => (
        s.value > 0 ? (
          <div key={i} style={{ height: '100%', width: `${(s.value / total) * 100}%`, backgroundColor: BAR_TOKENS[s.color] }} />
        ) : null
      ))}
    </div>
  )
}

// Fill = this category's credits against the plan's total credits. A non-zero
// category always gets a minimum sliver so small spend on a large plan still shows.
function ProgressBar({ used, total, color }: { used: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(100, Math.max(0, (used / total) * 100)) : 0
  return (
    <div style={{ height: 4, width: '100%', borderRadius: 2, backgroundColor: C.border, overflow: 'hidden', position: 'relative' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, height: 4, width: `${pct}%`, minWidth: pct > 0 ? 4 : 0, borderRadius: 2, backgroundColor: BAR_TOKENS[color] }} />
    </div>
  )
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      width: '100%', display: 'flex', flexDirection: 'column',
      border: `1px solid ${C.border}`, borderRadius: 16, boxShadow: SECTION_SHADOW, backgroundColor: 'var(--surface-cream)',
      overflow: 'hidden', paddingTop: 12, paddingBottom: 12,
    }}>
      {children}
    </div>
  )
}

export default function UsagePage() {
  const { user } = useAuth()
  const [usage, setUsage] = useState<Usage | null>(null)

  useEffect(() => {
    let cancelled = false
    Usage.fetch()
      .then(next => { if (!cancelled) setUsage(next) })
      .catch(console.error)
    return () => { cancelled = true }
  }, [])

  if (!usage) {
    // Mirrors the loaded page: heading block, "Personal summary" card (239px) and
    // "This period's usage" card (360px) with its three category rows.
    const bone = (w: number | string, h: number, r = 6, extra: React.CSSProperties = {}) => (
      <div className="kaya-skeleton" style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...extra }} />
    )
    const card = (h: number, children: React.ReactNode) => (
      <div style={{ height: h, boxSizing: 'border-box', borderRadius: 16, border: '1px solid var(--border-default)', boxShadow: SECTION_SHADOW, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    )
    const cardHead = (w: number) => (
      <div style={{ height: 72, boxSizing: 'border-box', padding: '12px 24px 24px', borderBottom: '1px solid var(--neutral-100)', flexShrink: 0 }}>
        <div style={{ height: 22, display: 'flex', alignItems: 'center' }}>{bone(w, 16)}</div>
      </div>
    )
    return (
      <div style={{ flex: '1 0 0', minHeight: 0, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '64px 24px 48px' }}>
        <div style={{ width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 12 }} aria-busy>
          <div style={{ paddingLeft: 4, marginBottom: 4 }}>
            <div style={{ height: 32, display: 'flex', alignItems: 'center' }}>{bone(90, 24)}</div>
            <div style={{ height: 22, display: 'flex', alignItems: 'center' }}>{bone(380, 14, 4)}</div>
          </div>

          {card(239, <>
            {cardHead(130)}
            <div style={{ padding: '12px 24px 16px' }}>
              <div style={{ height: 128, boxSizing: 'border-box', padding: 12, borderRadius: 8, boxShadow: CARD_RING, display: 'flex', flexDirection: 'column', gap: 9 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 22 }}>{bone(80, 14, 4)}{bone(140, 14, 4)}</div>
                <div style={{ height: 34, display: 'flex', alignItems: 'center' }}>{bone(190, 24)}</div>
                {bone('100%', 4, 2)}
                <div style={{ display: 'flex', gap: 6 }}>{bone(54, 20)}{bone(90, 20)}{bone(76, 20)}</div>
              </div>
            </div>
          </>)}

          {card(360, <>
            {cardHead(150)}
            {[0, 1, 2].map(i => (
              <div key={i} style={{ height: 73, boxSizing: 'border-box', padding: '12px 24px', display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center', flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{bone(90 + i * 10, 14, 4)}{bone(170, 12, 4)}</div>
                  {bone(70, 14, 4)}
                </div>
                {bone('100%', 4, 2)}
              </div>
            ))}
          </>)}
        </div>
      </div>
    )
  }

  const categoryCredits = CATEGORIES.map(c => ({
    ...c,
    credits: c.key === 'chat' ? usage.byCategory.chatCredits
      : c.key === 'slack' ? usage.byCategory.slackCredits
      : usage.byCategory.automationCredits,
  }))
  // Unlimited (Enterprise) plans have no real total to measure against, so their
  // bars fall back to each category's share of the period's spend.
  const barTotalCredits = usage.isUnlimited
    ? categoryCredits.reduce((sum, c) => sum + c.credits, 0)
    : usage.totalCredits
  // "This period's usage" said that repeatedly with no date to anchor it to
  // for anyone not on a trial — `nextBillingDate` (from the user's own
  // profile, already loaded by AuthProvider, same field plans-and-billing's
  // Personal view uses for "Resets"/"Next billing date") fills that in
  // whenever there's a real subscription cycle to report.
  const trialEndDate = fmtDate(usage.trialExpiresAt)
  const isTrial       = trialEndDate !== '—'
  const billingResetDate = fmtDate(user?.nextBillingDate)
  const periodLabel = isTrial
    ? `Trial ends ${trialEndDate}`
    : billingResetDate !== '—'
      ? `Resets ${billingResetDate}`
      : null

  return (
    <div className="kaya-scrollbar" style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '64px 24px 48px' }}>
      <div style={{ width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 12 }}>

        <div style={{ paddingLeft: 4, marginBottom: 4 }}>
          <h1 style={{ fontFamily: TITLE, fontWeight: 400, fontSize: 24, lineHeight: '32px', color: C.ink, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Usage
          </h1>
          <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: 14, lineHeight: '22px', color: C.muted, margin: 0 }}>
            Your spend this period, split by Slack, Automations, and Chat.
          </p>
        </div>

        <SectionCard>
          <div style={{ padding: '12px 24px 24px', borderBottom: `1px solid ${C.hair}` }}>
            <p style={{ fontFamily: BODY, fontWeight: 500, fontSize: 16, lineHeight: '22px', color: C.ink, margin: 0 }}>
              Personal summary
            </p>
          </div>
          <div style={{ padding: '12px 24px 16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: 12, borderRadius: 8, backgroundColor: 'var(--neutral-white)', boxShadow: CARD_RING }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{ fontFamily: BODY, fontWeight: 500, fontSize: 14, lineHeight: '22px', color: C.ink, margin: 0 }}>My usage</p>
                  <p style={{ fontFamily: TITLE, fontWeight: 400, fontSize: 14, lineHeight: '22px', color: C.muted, margin: 0 }}>
                    {usage.isUnlimited ? 'Unlimited credits' : `${fmtNum(usage.remainingCredits)} credits remaining`}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                  <p style={{ fontFamily: TITLE, fontWeight: 400, fontSize: 24, lineHeight: '32px', color: C.ink, margin: 0 }}>{fmtNum(usage.ownSpendCredits)}</p>
                  <p style={{ fontFamily: BODY, fontWeight: 500, fontSize: 14, lineHeight: '22px', color: C.ink, margin: 0 }}>credits consumed</p>
                </div>
              </div>
              <StackedProgressBar segments={categoryCredits.map(c => ({ color: c.chipColor, value: c.credits }))} />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {categoryCredits.map(c => (
                  <Chip key={c.key} label={`${c.label} ${fmtNum(c.credits)}`} color={c.chipColor} />
                ))}
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard>
          <div style={{ display: 'flex', alignItems: 'center', padding: '12px 24px 24px', borderBottom: `1px solid ${C.hair}` }}>
            <p style={{ fontFamily: BODY, fontWeight: 500, fontSize: 16, lineHeight: '22px', color: C.ink, margin: 0, flex: '1 0 0', minWidth: 0 }}>This period&apos;s usage</p>
            {periodLabel && (
              <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: 14, lineHeight: '22px', color: C.muted, margin: 0, whiteSpace: 'nowrap' }}>{periodLabel}</p>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '12px 24px 24px' }}>
            {categoryCredits.map(c => (
              <div key={c.key} style={{ display: 'flex', flexDirection: 'column', gap: 9, width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 24, width: '100%' }}>
                  <div style={{ flex: '1 0 0', minWidth: 0 }}>
                    <p style={{ fontFamily: BODY, fontWeight: 500, fontSize: 16, lineHeight: '22px', color: C.ink, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.label}
                    </p>
                    <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: 14, lineHeight: '22px', color: C.muted, margin: 0 }}>
                      {c.subtitle}
                    </p>
                  </div>
                  <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: 14, lineHeight: '22px', color: C.muted, margin: 0, whiteSpace: 'nowrap' }}>
                    {fmtNum(c.credits)} credits
                  </p>
                </div>
                <ProgressBar used={c.credits} total={barTotalCredits} color={c.chipColor} />
              </div>
            ))}

            <div style={{ display: 'flex', gap: 16, fontFamily: BODY, fontWeight: 400, fontSize: 14, lineHeight: '22px', color: C.muted }}>
              <p style={{ margin: 0 }}>{fmtNum(usage.ownSpendCredits)} credits consumed</p>
              <p style={{ margin: 0 }}>{categoryCredits.filter(c => c.credits > 0).length} sources</p>
            </div>
          </div>
        </SectionCard>

      </div>
    </div>
  )
}
