'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ArrowRightOneIcon } from '@strange-huge/icons'
import { useAuth } from '@/context/auth-context'
import { useOrgIdentity } from '@/context/org-context'
import { usageQuery } from '@/lib/billing/billing-queries'
import { orgScope } from '@/lib/query-keys'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/ui/button'
import { ORG_PLANS_ROUTE } from '@/lib/routes'
import styles from './usage.module.css'

// Settings → PERSONAL → Usage. Everyone sees their own Slack / Automations / Chat
// spend plus remaining credits on GET /stripe/usage.
//
// Layout: one card answers "where did my credits go?" (a donut of the three
// sources with a breakdown beside it), a second answers "how much is left?"
// (one meter against the total, then the figures). The donut and the list share
// a hover state, so pointing at either highlights the same source.

const TITLE = 'var(--font-title)'
const BODY  = 'var(--font-body)'
const SECTION_SHADOW = '0px 2px 2.8px 0px rgba(82,75,71,0.12)'
const LOW_BALANCE_SHARE = 0.15

// Chat includes subtask spend (agents a chat turn hands work to). Order is
// Slack > Automations > Chat throughout this page.
const CATEGORIES = [
  { key: 'slack',      label: 'Slack',       color: 'var(--usage-slack)',      subtitle: 'Messages and actions in Slack' },
  { key: 'automation', label: 'Automations', color: 'var(--usage-automation)', subtitle: 'Scheduled and automated runs' },
  { key: 'chat',       label: 'Chat',        color: 'var(--usage-chat)',       subtitle: 'Direct conversations' },
] as const

type CategoryKey = typeof CATEGORIES[number]['key']

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

function pct(part: number, whole: number): string {
  if (whole <= 0) return '0%'
  const value = (part / whole) * 100
  if (value > 0 && value < 1) return '<1%'
  return `${Math.round(value)}%`
}

// ── Donut ────────────────────────────────────────────────────────────────────
// Thin ring, a 2px surface gap between segments, and the total in the middle.
// Hovering a segment swaps the centre to that source, which doubles as the tooltip.

const SIZE = 200
const STROKE = 18
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const GAP = 2
const MIN_ARC = 3

function Donut({ segments, total, active, onActive }: {
  segments: { key: CategoryKey; label: string; color: string; value: number }[]
  total: number
  active: CategoryKey | null
  onActive: (key: CategoryKey | null) => void
}) {
  const shown = segments.filter((s) => s.value > 0)
  const gaps = shown.length > 1 ? shown.length * GAP : 0
  const step = shown.length > 1 ? GAP : 0
  const lengths = shown.map((s) => Math.max(MIN_ARC, (s.value / total) * (CIRCUMFERENCE - gaps)))
  const arcs = shown.map((s, index) => ({
    ...s,
    length: lengths[index],
    offset: lengths.slice(0, index).reduce((sum, length) => sum + length + step, 0),
  }))
  const current = active ? segments.find((s) => s.key === active) : null

  return (
    <div className={styles.donutWrap}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={`${fmtNum(total)} credits used: ${segments.map((s) => `${s.label} ${fmtNum(s.value)}`).join(', ')}`}>
        <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--neutral-100)" strokeWidth={STROKE} />
          {arcs.map((arc) => (
            <circle
              key={arc.key}
              className={styles.segment}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={arc.color}
              // A wider invisible hit area would need a second ring; the 18px stroke is already a comfortable target.
              strokeWidth={active === arc.key ? STROKE + 4 : STROKE}
              strokeDasharray={`${arc.length} ${CIRCUMFERENCE - arc.length}`}
              strokeDashoffset={-arc.offset}
              opacity={active && active !== arc.key ? 0.35 : 1}
              onMouseEnter={() => onActive(arc.key)}
              onMouseLeave={() => onActive(null)}
            />
          ))}
        </g>
      </svg>
      <div className={styles.donutCenter} aria-hidden="true">
        <span className={styles.donutValue}>{fmtNum(current ? current.value : total)}</span>
        <span className={styles.donutLabel}>{current ? `${current.label} · ${pct(current.value, total)}` : 'credits used'}</span>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

function Card({ title, meta, children }: { title: string; meta?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>{title}</h2>
        {meta}
      </div>
      {children}
    </section>
  )
}

function Skeleton() {
  const bone = (w: number | string, h: number, r: number | string = 6, extra: React.CSSProperties = {}) => (
    <div className="kaya-skeleton" style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...extra }} />
  )
  const card = (children: React.ReactNode) => (
    <div style={{ borderRadius: 16, border: '1px solid var(--border-default)', boxShadow: SECTION_SHADOW, overflow: 'hidden' }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--neutral-100)', display: 'flex', justifyContent: 'space-between' }}>{bone(150, 18)}{bone(110, 14)}</div>
      {children}
    </div>
  )
  return (
    <div style={{ flex: '1 0 0', minHeight: 0, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '64px 24px 48px' }}>
      <div style={{ width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 12 }} aria-busy>
        <div style={{ paddingLeft: 4, marginBottom: 4 }}>
          <div style={{ height: 32, display: 'flex', alignItems: 'center' }}>{bone(90, 24)}</div>
          <div style={{ height: 22, display: 'flex', alignItems: 'center' }}>{bone(380, 14, 4)}</div>
        </div>
        {card(
          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 32, alignItems: 'center', padding: 24 }}>
            {bone(200, 200, '50%')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {bone(12, 12, 4)}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>{bone(90 + i * 12, 14, 4)}{bone(170, 12, 4)}</div>
                  {bone(60, 14, 4)}
                </div>
              ))}
            </div>
          </div>,
        )}
        {card(
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {bone('100%', 8, 999)}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>{bone('100%', 64, 12)}{bone('100%', 64, 12)}{bone('100%', 64, 12)}</div>
          </div>,
        )}
      </div>
    </div>
  )
}

export default function UsagePage() {
  const { user } = useAuth()
  const router = useRouter()
  const { orgId } = useOrgIdentity()
  const usageQ = useQuery(usageQuery(orgScope(orgId)))
  const usage = usageQ.data ?? null
  const [active, setActive] = useState<CategoryKey | null>(null)

  if (!usage && usageQ.isError) {
    return (
      <div style={{ flex: "1 0 0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 48, textAlign: "center" }}>
        <p style={{ margin: 0, fontFamily: BODY, fontWeight: 500, fontSize: 16, lineHeight: "24px", color: "var(--neutral-900)" }}>Couldn&apos;t load your usage</p>
        <p style={{ margin: 0, fontFamily: BODY, fontSize: 14, lineHeight: "22px", color: "var(--neutral-600)" }}>Check your connection and try again.</p>
        <Button variant="secondary" size="sm" onClick={() => { void usageQ.refetch() }}>Try again</Button>
      </div>
    )
  }
  if (!usage) return <Skeleton />

  const categories = CATEGORIES.map(c => ({
    ...c,
    value: c.key === 'chat' ? usage.byCategory.chatCredits
      : c.key === 'slack' ? usage.byCategory.slackCredits
      : usage.byCategory.automationCredits,
  }))
  const spent = categories.reduce((sum, c) => sum + c.value, 0)

  // `nextBillingDate` comes from the user's own profile (already loaded by
  // AuthProvider), the same field plans-and-billing uses for "Resets".
  const trialEndDate = fmtDate(usage.trialExpiresAt)
  const isTrial = trialEndDate !== '—'
  const billingResetDate = fmtDate(user?.nextBillingDate)
  const periodLabel = isTrial
    ? `Trial ends ${trialEndDate}`
    : billingResetDate !== '—'
      ? `Resets ${billingResetDate}`
      : null

  const total = usage.totalCredits
  const top = spent > 0 ? categories.reduce((best, c) => (c.value > best.value ? c : best)) : null
  const usedShare = total > 0 ? Math.min(1, usage.usedCredits / total) : 0
  const lowBalance = !usage.isUnlimited && total > 0 && usage.remainingCredits / total < LOW_BALANCE_SHARE

  return (
    <div className={`kaya-scrollbar ${styles.root}`} style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '64px 24px 48px' }}>
      <div style={{ width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 12 }}>

        <div style={{ paddingLeft: 4, marginBottom: 4 }}>
          <h1 style={{ fontFamily: TITLE, fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
            Usage
          </h1>
          <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-600)', margin: 0 }}>
            Your spend this period, split by Slack, Automations, and Chat.
          </p>
        </div>

        <Card title="Where your credits went" meta={periodLabel && <p className={styles.cardMeta}>{periodLabel}</p>}>
          <div className={styles.split}>
            <Donut segments={categories} total={spent} active={active} onActive={setActive} />
            {spent === 0 ? (
              <p className={styles.empty}>No credits used yet this period. Chats, Slack messages and automations will show up here as you use them.</p>
            ) : (
              <ul className={styles.legend} aria-label="Credits by source">
                {categories.map(c => (
                  <li
                    key={c.key}
                    className={styles.legendRow}
                    data-active={active === c.key}
                    data-dim={active !== null && active !== c.key}
                    onMouseEnter={() => setActive(c.key)}
                    onMouseLeave={() => setActive(null)}
                  >
                    <span className={styles.swatch} style={{ background: c.color }} aria-hidden="true" />
                    <div style={{ minWidth: 0 }}>
                      <p className={styles.legendName}>{c.label}</p>
                      <p className={styles.legendHint}>{c.subtitle}</p>
                    </div>
                    <span className={styles.legendValue}>{fmtNum(c.value)} credits</span>
                    <span className={styles.legendShare}>{pct(c.value, spent)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card
          title="Credit balance"
          meta={lowBalance ? <Badge label="Running low" color="Yellow" /> : usage.isUnlimited ? <Badge label="Unlimited" color="Green" /> : null}
        >
          {usage.isUnlimited ? (
            <div className={styles.balance}>
              <div className={styles.stats} style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Used this period</span>
                  <span className={styles.statValue}>{fmtNum(usage.ownSpendCredits)}</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Remaining</span>
                  <span className={styles.statValue}>Unlimited</span>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.balance}>
              <div>
                <div className={styles.meterLabels}>
                  <span>{fmtNum(usage.usedCredits)} of {fmtNum(total)} credits used</span>
                  <span>{pct(usage.usedCredits, total)}</span>
                </div>
                <div
                  className={styles.meter}
                  role="progressbar"
                  aria-label="Credits used"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(usedShare * 100)}
                  style={{ marginTop: 8 }}
                >
                  <div className={styles.meterFill} style={{ width: `${usedShare * 100}%` }} />
                </div>
              </div>
              <div className={styles.stats}>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Remaining</span>
                  <span className={styles.statValue}>{fmtNum(usage.remainingCredits)}</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Most used</span>
                  <span className={styles.statValue}>{top ? `${top.label} · ${pct(top.value, spent)}` : "—"}</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Total this period</span>
                  <span className={styles.statValue}>{fmtNum(total)}</span>
                </div>
              </div>
            </div>
          )}
          <div className={styles.footer}>
            <span>{lowBalance ? 'Top up or change plan to keep working without interruption.' : 'Credits reset at the start of each billing period.'}</span>
            <Button
              variant={lowBalance ? 'default' : 'secondary'}
              size="sm"
              rightIcon={<ArrowRightOneIcon size={16} />}
              onClick={() => router.push(ORG_PLANS_ROUTE)}
            >
              {lowBalance ? 'Top up credits' : 'View plans & billing'}
            </Button>
          </div>
        </Card>

      </div>
    </div>
  )
}
