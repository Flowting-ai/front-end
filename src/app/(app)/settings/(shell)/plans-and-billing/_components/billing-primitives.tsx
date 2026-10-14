'use client'

// Shared pieces of Plans & Billing: snapshot cache, formatting, shadows, badge and section card. Part of plans-and-billing/page.tsx.

import React from 'react'

export const PERSONAL_SNAP_KEY = 'kaya:billing:snapshot:v3'

/** Minimal display snapshot persisted across the Stripe round-trip. */
export interface PersonalBillingSnapshot {
  planType:         string | null
  creditsTotal:     number
  creditsRemaining: number
  creditsUsed:      number
  chatCredits:      number
  slackCredits:     number
  automationCredits: number
  nextBilling:      string
  periodEnd:        string | null
  cancelAtPeriodEnd: boolean
}

export function isFutureIso(iso: string | null | undefined): boolean {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return !Number.isNaN(t) && t > Date.now()
}

/** True if we appear to have just returned from a Stripe-hosted page. */
export function isStripeReturn(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (document.referrer && /stripe\.com/i.test(document.referrer)) return true
    const p = new URLSearchParams(window.location.search)
    return p.has('session_id') || p.has('checkout') || p.has('portal') || p.has('billing') || p.has('success')
  } catch {
    return false
  }
}

export function readCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writeCache(key: string, value: unknown): void {
  if (typeof window === 'undefined') return
  try { window.sessionStorage.setItem(key, JSON.stringify(value)) } catch { /* quota / private mode */ }
}

export function fmtNum(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('en-US')
}

/*
 * Settings → Organization → Billing ("Plans & Usage")
 * Figma — Kaya Design System:
 *   Teams Owner   6017:30243   Teams Admin   6017:30577
 *   Ent.  Owner   6017:30739   Ent.  Admin   6017:31067
 *   Buy more credits modal     6017:29823
 *   Monthly spend cap modal    6017:30157
 *
 * Tokens (Figma → CSS var): all colors/spacing map onto the existing Kaya vars.
 */

// ── Shared style constants (exact Figma values) ───────────────────────────────

export const SHADOW_CARD    = '0px 2px 2.8px 0px rgba(82,75,71,0.12)'                                   // bordered section card
export const SHADOW_TILE     = '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)' // white inner tile
export const SHADOW_MODAL   = '0px 19px 32px 0px rgba(18,12,8,0.15), 0px 2px 2.8px 0px rgba(130,122,116,0.1)'
export const SHADOW_INPUT   = '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)'

// Same "big number" / secondary-text convention as the Monthly Limits /
// Active members cards on /settings/analytics — applied here to the Plan /
// Included Credits Remaining cards' own big line and captions so the two
// pages' stat cards read consistently. SectionCard's own title already
// renders at this size/weight, so no separate header style is needed here.
export const statCardBigLineStyle: React.CSSProperties = {
  fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 26, lineHeight: '34px', color: 'var(--neutral-900)', margin: 0,
}
export const statCardCaptionStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0,
}

// ── Small primitives ───────────────────────────────────────────────────────────

export const fmtUsd = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Credits are USD × 1000. The Enterprise view speaks in credits, so usage/limits
// are displayed via this helper even though the backend stores them in USD.

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Pill badge — blue (info), yellow (note), neutral, green / red (status). */
export function Badge({ label, tone }: { label: string; tone: 'blue' | 'yellow' | 'neutral' | 'green' | 'red' }) {
  const map = {
    blue:    { bg: 'var(--blue-100)',    fg: 'var(--blue-700)',    ring: 'var(--blue-600-50)' },
    yellow:  { bg: 'var(--yellow-100)',  fg: 'var(--yellow-700)',  ring: 'color-mix(in srgb, var(--yellow-600) 50%, transparent)' },
    neutral: { bg: 'var(--neutral-100)', fg: 'var(--neutral-700)', ring: 'color-mix(in srgb, var(--neutral-600) 50%, transparent)' },
    green:   { bg: 'var(--green-50)',    fg: 'var(--green-800)',   ring: 'rgba(128,183,7,0.5)' },
    red:     { bg: 'var(--red-100)',     fg: 'var(--red-700)',     ring: 'var(--red-600-51)' },
  }[tone]
  return (
    <span style={{
      display:        'inline-flex',
      alignItems:     'center',
      padding:        '2px 4px',
      borderRadius:   6,
      background:     map.bg,
      color:          map.fg,
      boxShadow:      `0px 1px 1.5px 0px rgba(2,15,24,0.2), 0px 0px 0px 1px ${map.ring}`,
      fontFamily:     'var(--font-body)',
      fontWeight:     500,
      fontSize:       11,
      lineHeight:     '16px',
      whiteSpace:     'nowrap',
    }}>
      {label}
    </span>
  )
}

/** Bordered section card with a header row (title / subtitle / action). */
export function SectionCard({
  title,
  subtitle,
  action,
  children,
  bodyPadding = '12px 24px',
  bodyGap,
  headerDivider = true,
  background,
  bodyAlign = 'center',
  titleColor = 'var(--neutral-900)',
}: {
  title:          string
  subtitle?:      string
  action?:        React.ReactNode
  children:       React.ReactNode
  bodyPadding?:   string
  bodyGap?:       number
  /** Figma 18:24922/18:25080 (Plan / Credits Remaining) have no rule between
   *  title and body — unlike Payment/Invoice history, which do. */
  headerDivider?: boolean
  /** Explicit card fill — any valid CSS `background` value (solid color or gradient). Omit to keep the existing transparent/inherited look. */
  background?:    string
  /**
   * Body content's vertical alignment. Default `'center'` (existing
   * behavior everywhere else) — pass `'flex-start'` when this card sits
   * beside another SectionCard whose first line needs to land on the same
   * row regardless of how much content follows it in either card; centering
   * shifts that first line up/down based on each card's own content height.
   * Pass `'space-between'` when the body is a top block plus a trailing
   * actions row that should sink to the card's bottom edge (e.g. when
   * `alignItems: 'stretch'` on the surrounding row makes this card taller
   * than its own content) instead of sitting immediately under the block.
   */
  bodyAlign?:     'center' | 'flex-start' | 'space-between'
  /** Title text color. @default 'var(--neutral-900)' */
  titleColor?:    string
}) {
  return (
    <div style={{
      border:        '1px solid var(--border-default)',
      borderRadius:  16,
      boxShadow:     SHADOW_CARD,
      display:       'flex',
      flexDirection: 'column',
      gap:           12,
      paddingTop:    18,
      paddingBottom: 12,
      overflow:      'hidden',
      width:         '100%',
      background,
    }}>
      <div style={{
        borderBottom: headerDivider ? '1px solid var(--neutral-100)' : undefined,
        padding:      headerDivider ? '0 24px 24px' : '0 24px',
        display:      'flex',
        alignItems:   'center',
        gap:          12,
      }}>
        <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: titleColor, margin: 0 }}>
            {title}
          </p>
          {subtitle && (
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
              {subtitle}
            </p>
          )}
        </div>
        {action}
      </div>
      <div style={{ flex: '1 0 0', padding: bodyPadding, display: 'flex', flexDirection: 'column', justifyContent: bodyAlign, gap: bodyGap }}>
        {children}
      </div>
    </div>
  )
}
