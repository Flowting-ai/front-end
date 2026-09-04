'use client'

import React, { useEffect, useState } from 'react'
import { Usage } from '@/lib/api/billing'

// Settings → PERSONAL → Usage. Everyone sees their own chat / Slack / Brain
// spend plus remaining credits on GET /stripe/usage.

const C = {
  ink:    'var(--neutral-900)',
  muted:  'var(--neutral-500)',
  border: 'var(--neutral-200)',
  hair:   'var(--neutral-100)',
  white:  'var(--neutral-white)',
} as const
const TITLE = 'var(--font-title)'
const BODY  = 'var(--font-body)'
const CARD_RING = '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)'
const SECTION_SHADOW = '0px 2px 2.8px 0px rgba(82,75,71,0.12)'

const CATEGORIES = [
  { key: 'chat',  label: 'Chat',  chipColor: 'red',    subtitle: 'Direct conversations' },
  { key: 'slack', label: 'Slack', chipColor: 'blue',   subtitle: 'Messages and actions in Slack' },
  { key: 'brain', label: 'Brain', chipColor: 'yellow', subtitle: 'Brain runs and scheduled work' },
] as const

const CHIP_TOKENS: Record<string, { bg: string; text: string; ring: string }> = {
  yellow: { bg: 'var(--yellow-100,#e9dfc9)', text: 'var(--yellow-700,#6d5921)', ring: 'rgba(143,116,39,0.5)' },
  blue:   { bg: 'var(--blue-100,#cadcf1)',   text: 'var(--blue-700,#135487)',   ring: 'rgba(13,110,178,0.5)' },
  red:    { bg: 'var(--red-100,#ffbfb6)',    text: 'var(--red-700,#7a201c)',    ring: 'rgba(159,38,35,0.5)' },
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

function ProgressBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.max(0, (used / total) * 100)) : 0
  return (
    <div style={{ height: 4, width: '100%', borderRadius: 2, backgroundColor: C.hair, overflow: 'hidden', position: 'relative' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, height: 4, width: `${pct}%`, borderRadius: 2, backgroundColor: 'var(--blue-600,#0d6eb2)' }} />
    </div>
  )
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      width: '100%', display: 'flex', flexDirection: 'column',
      border: `1px solid ${C.border}`, borderRadius: 16, boxShadow: SECTION_SHADOW,
      overflow: 'hidden', paddingTop: 12, paddingBottom: 12,
    }}>
      {children}
    </div>
  )
}

export default function UsagePage() {
  const [usage, setUsage] = useState<Usage | null>(null)

  useEffect(() => {
    let cancelled = false
    Usage.fetch()
      .then(next => { if (!cancelled) setUsage(next) })
      .catch(console.error)
    return () => { cancelled = true }
  }, [])

  if (!usage) {
    return (
      <div style={{ flex: '1 0 0', minHeight: 0, display: 'flex', justifyContent: 'center', padding: '64px 24px 48px' }}>
        <div style={{ width: '100%', maxWidth: 860 }} aria-busy>
          <div style={{ height: 120, borderRadius: 16, backgroundColor: C.hair }} />
        </div>
      </div>
    )
  }

  const categoryCredits = CATEGORIES.map(c => ({
    ...c,
    credits: c.key === 'chat' ? usage.byCategory.chatCredits
      : c.key === 'slack' ? usage.byCategory.slackCredits
      : usage.byCategory.brainCredits,
  }))
  const resetDate = fmtDate(usage.trialExpiresAt)

  return (
    <div className="kaya-scrollbar" style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '64px 24px 48px' }}>
      <div style={{ width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 12 }}>

        <div style={{ paddingLeft: 4, marginBottom: 4 }}>
          <h1 style={{ fontFamily: TITLE, fontWeight: 400, fontSize: 24, lineHeight: '32px', color: C.ink, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Usage
          </h1>
          <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: 14, lineHeight: '22px', color: C.muted, margin: 0 }}>
            Your spend this period, split by chat, Slack, and Brain.
          </p>
        </div>

        <SectionCard>
          <div style={{ padding: '12px 24px 24px', borderBottom: `1px solid ${C.hair}` }}>
            <p style={{ fontFamily: BODY, fontWeight: 500, fontSize: 16, lineHeight: '22px', color: C.ink, margin: 0 }}>
              Personal summary
            </p>
          </div>
          <div style={{ padding: '12px 24px 16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: 12, borderRadius: 8, backgroundColor: C.white, boxShadow: CARD_RING }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{ fontFamily: BODY, fontWeight: 500, fontSize: 14, lineHeight: '22px', color: C.ink, margin: 0 }}>My usage</p>
                  <p style={{ fontFamily: TITLE, fontWeight: 400, fontSize: 14, lineHeight: '22px', color: C.muted, margin: 0 }}>
                    {fmtNum(usage.remainingCredits)} credits remaining
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
            {resetDate !== '—' && (
              <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: 14, lineHeight: '22px', color: C.muted, margin: 0, whiteSpace: 'nowrap' }}>Trial ends {resetDate}</p>
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
                <ProgressBar used={c.credits} total={usage.totalCredits} />
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
