'use client'

// Loading skeletons for the enterprise, teams and personal views. Part of plans-and-billing/page.tsx.

import React from 'react'
import { RouteState } from '@/components/RouteState'
import { Button } from '@/components/ui/button'
import { SHADOW_CARD, SHADOW_TILE } from './billing-primitives'

/** Shown instead of the skeleton once the billing figures failed to load (e.g. rate-limited), with a Retry. */
export function BillingLoadError({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <div className="kaya-scrollbar" style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '64px 24px 48px' }}>
      <RouteState
        tone="alert"
        heading="Couldn't load billing"
        body="Your plan and billing details didn't load. Check your connection and try again."
        actions={<Button variant="default" size="sm" loading={retrying} onClick={onRetry}>Retry</Button>}
      />
    </div>
  )
}

export function SkeletonBlock({ width = '100%', height, radius = 8 }: { width?: string | number; height: number; radius?: number }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'linear-gradient(90deg, var(--neutral-200) 25%, var(--neutral-100) 50%, var(--neutral-200) 75%)',
      backgroundSize: '200% 100%',
      animation: 'plansSkeletonShimmer 1.4s ease-in-out infinite',
      flexShrink: 0,
    }} />
  )
}

export function SkeletonShimmerStyle() {
  return <style>{`@keyframes plansSkeletonShimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
}

/** A bone vertically centred in a text line box, so stacked lines keep the real line-heights. */
export function SkeletonLine({ width, lineHeight, height, radius = 4 }: { width: string | number; lineHeight: number; height: number; radius?: number }) {
  return (
    <div style={{ height: lineHeight, display: 'flex', alignItems: 'center' }}>
      <SkeletonBlock width={width} height={height} radius={radius} />
    </div>
  )
}

/** Title (24/32) + description (14/22), as in the real page header. */
export function SkeletonPageHeader() {
  return (
    <div style={{ paddingLeft: 4, display: 'flex', flexDirection: 'column' }}>
      <SkeletonLine width={150} lineHeight={32} height={22} radius={6} />
      <SkeletonLine width={290} lineHeight={22} height={14} />
    </div>
  )
}

/** Bordered-card bone matching SectionCard's real chrome (header row + body). */
export function SkeletonSectionCard({
  hasAction = false,
  action,
  headerDivider = true,
  subtitle = true,
  titleWidth = 80,
  bodyPadding = '12px 24px',
  bodyGap = 8,
  bodyAlign = 'center',
  background,
  children,
}: {
  hasAction?:     boolean
  /** Custom action bone (replaces the default 120x36 button). */
  action?:        React.ReactNode
  headerDivider?: boolean
  subtitle?:      boolean
  titleWidth?:    number
  bodyPadding?:   string
  bodyGap?:       number
  bodyAlign?:     'center' | 'flex-start' | 'space-between'
  background?:    string
  children:       React.ReactNode
}) {
  return (
    <div style={{ border: '1px solid var(--border-default)', borderRadius: 16, boxShadow: SHADOW_CARD, display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 18, paddingBottom: 12, overflow: 'hidden', width: '100%', background }}>
      <div style={{ borderBottom: headerDivider ? '1px solid var(--neutral-100)' : undefined, padding: headerDivider ? '0 24px 24px' : '0 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <SkeletonLine width={titleWidth} lineHeight={22} height={16} />
          {subtitle && <SkeletonLine width={240} lineHeight={22} height={14} />}
        </div>
        {action ?? (hasAction && <SkeletonBlock width={120} height={36} radius={10} />)}
      </div>
      <div style={{ flex: '1 0 0', padding: bodyPadding, display: 'flex', flexDirection: 'column', justifyContent: bodyAlign, gap: bodyGap }}>
        {children}
      </div>
    </div>
  )
}

/** Big 26/34 line + 14/22 caption: the stat cards' top block. */
function SkeletonStatBlock({ bigWidth, captionWidth }: { bigWidth: number; captionWidth: number }) {
  return (
    <div>
      <SkeletonLine width={bigWidth} lineHeight={34} height={24} radius={6} />
      <div style={{ marginTop: 6 }}><SkeletonLine width={captionWidth} lineHeight={22} height={14} /></div>
    </div>
  )
}

/** "Big number + label, action button" row: Personal/Enterprise stat body. */
export function SkeletonStatRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: '1 0 0', minWidth: 0 }}><SkeletonStatBlock bigWidth={180} captionWidth={160} /></div>
    </div>
  )
}

/** Plan + Credits remaining two-card row inside the shared bordered shell (Figma 18:25119). */
export function SkeletonTwoCardRow() {
  return (
    <div style={{ width: '100%', border: '1px solid var(--border-default)', borderRadius: 16, boxShadow: SHADOW_CARD, overflow: 'hidden', backgroundColor: 'var(--neutral-50)', padding: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 0 0', minWidth: 280, display: 'flex' }}>
          <SkeletonSectionCard
            headerDivider={false}
            subtitle={false}
            titleWidth={40}
            action={<SkeletonBlock width={41} height={20} radius={6} />}
            background="linear-gradient(135deg, var(--neutral-white) 0%, var(--neutral-200) 100%)"
            bodyAlign="space-between"
          >
            <SkeletonStatBlock bigWidth={230} captionWidth={195} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
              <SkeletonBlock width={110} height={36} radius={10} />
              <SkeletonBlock width={121} height={36} radius={10} />
            </div>
          </SkeletonSectionCard>
        </div>
        <div style={{ flex: '1 0 0', minWidth: 280, display: 'flex' }}>
          <SkeletonSectionCard headerDivider={false} subtitle={false} titleWidth={130} background="var(--neutral-white)" bodyAlign="space-between" bodyGap={12}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <SkeletonLine width={72} lineHeight={34} height={24} radius={6} />
                <SkeletonBlock width={93} height={14} radius={4} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <SkeletonLine width={197} lineHeight={20} height={13} />
                  <SkeletonLine width={26} lineHeight={20} height={13} />
                </div>
                <SkeletonBlock width="100%" height={6} radius={999} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              <SkeletonBlock width={108} height={36} radius={10} />
            </div>
          </SkeletonSectionCard>
        </div>
      </div>
    </div>
  )
}

export function SkeletonPaymentCard() {
  return (
    <SkeletonSectionCard titleWidth={65}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <SkeletonBlock width={63} height={44} radius={6} />
        <div style={{ flex: '1 0 0', display: 'flex', flexDirection: 'column' }}>
          <SkeletonLine width={150} lineHeight={22} height={16} />
          <SkeletonLine width={100} lineHeight={22} height={14} />
        </div>
        <SkeletonBlock width={148} height={36} radius={10} />
      </div>
    </SkeletonSectionCard>
  )
}

export function SkeletonInvoiceCard({ rows = 1 }: { rows?: number }) {
  const cell: React.CSSProperties = { flex: '1 0 0', minWidth: 0 }
  return (
    <SkeletonSectionCard titleWidth={110} action={<SkeletonBlock width={94} height={36} radius={10} />} bodyPadding="0 24px 12px">
      <div style={{ background: 'var(--neutral-white)', borderRadius: 8, padding: 12, boxShadow: SHADOW_TILE }}>
        <div style={{ display: 'flex', gap: 24, padding: '0 12px 12px', borderBottom: '1px solid var(--neutral-100)' }}>
          {[32, 55, 45].map(w => <div key={w} style={cell}><SkeletonLine width={w} lineHeight={22} height={13} /></div>)}
          <div style={{ width: 200, display: 'flex', justifyContent: 'center' }}><SkeletonLine width={50} lineHeight={22} height={13} /></div>
        </div>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 24, padding: 12, borderBottom: i < rows - 1 ? '1px solid var(--neutral-100)' : undefined }}>
            <div style={cell}><SkeletonLine width={84} lineHeight={22} height={14} /></div>
            <div style={cell}><SkeletonLine width={56} lineHeight={22} height={14} /></div>
            <div style={cell}><SkeletonLine width={31} lineHeight={24} height={20} radius={6} /></div>
            <div style={{ width: 200, display: 'flex', justifyContent: 'center' }}><SkeletonLine width={32} lineHeight={22} height={14} /></div>
          </div>
        ))}
      </div>
    </SkeletonSectionCard>
  )
}

/** Enterprise/Pro branch (org.plan === 'enterprise'): Plan/Credits Remaining row →
 *  spend-limit card → Payment/Invoice (admin-only, matching the real `isAdmin &&` gates). */
export function EnterprisePlansSkeleton({ isAdmin }: { isAdmin: boolean }) {
  return (
    <>
      <SkeletonShimmerStyle />
      <div style={{ width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SkeletonPageHeader />

        {/* Plan / Credits Remaining — matches the Teams-branch skeleton below */}
        <SkeletonTwoCardRow />

        {/* Overage spend limit card */}
        <SkeletonSectionCard hasAction>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
            <SkeletonBlock width={80} height={24} radius={6} />
            <SkeletonBlock width={160} height={14} radius={4} />
          </div>
          <SkeletonBlock width="100%" height={4} radius={2} />
          <SkeletonBlock width={220} height={14} radius={4} />
        </SkeletonSectionCard>

        {isAdmin && <SkeletonPaymentCard />}
        {isAdmin && <SkeletonInvoiceCard />}
      </div>
    </>
  )
}

/** Teams branch (org, not enterprise): no hero — Plan + Credits Remaining row →
 *  Payment/Invoice. Non-admins are redirected off this page (page.tsx), so the
 *  org view always ends with Payment + Invoice; they're drawn even while the
 *  role is still resolving (page.tsx passes isAdmin={false} then). */
export function TeamsPlansSkeleton(_props: { isAdmin: boolean }) {
  return (
    <>
      <SkeletonShimmerStyle />
      <div style={{ width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SkeletonPageHeader />
        <SkeletonTwoCardRow />
        <SkeletonPaymentCard />
        <SkeletonInvoiceCard />
      </div>
    </>
  )
}

/** Personal (individual, non-org) branch: same two-card row, plus the
 *  "This month's usage" card (Chat/Slack/Automations) real page adds. */
export function PersonalPlansSkeleton() {
  return (
    <>
      <SkeletonShimmerStyle />
      <div style={{ width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SkeletonPageHeader />
        <SkeletonTwoCardRow />

        {/* This month's usage — Chat / Slack / Automations */}
        <SkeletonSectionCard>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <SkeletonBlock width={50} height={14} radius={4} />
                <SkeletonBlock width={90} height={14} radius={4} />
              </div>
              <SkeletonBlock width="100%" height={4} radius={2} />
            </div>
          ))}
        </SkeletonSectionCard>

        <SkeletonPaymentCard />
        <SkeletonInvoiceCard />
      </div>
    </>
  )
}
