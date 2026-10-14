'use client'

// Loading skeletons for the enterprise, teams and personal views. Part of plans-and-billing/page.tsx.

import React from 'react'
import { SHADOW_CARD, SHADOW_TILE } from './billing-primitives'

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

export function SkeletonPageHeader() {
  return (
    <div style={{ paddingLeft: 4, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <SkeletonBlock width={80} height={24} radius={6} />
      <SkeletonBlock width={240} height={14} radius={4} />
    </div>
  )
}

/** Bordered-card bone matching SectionCard's real chrome (header row + body). */
export function SkeletonSectionCard({
  hasAction = false,
  headerDivider = true,
  bodyPadding = '12px 24px',
  children,
}: {
  hasAction?:     boolean
  headerDivider?: boolean
  bodyPadding?:   string
  children:       React.ReactNode
}) {
  return (
    <div style={{ border: '1px solid var(--border-default)', borderRadius: 16, boxShadow: SHADOW_CARD, display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 12, paddingBottom: 12, overflow: 'hidden', width: '100%' }}>
      <div style={{ borderBottom: headerDivider ? '1px solid var(--neutral-100)' : undefined, padding: headerDivider ? '0 24px 24px' : '0 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SkeletonBlock width={80} height={16} radius={4} />
          <SkeletonBlock width={210} height={14} radius={4} />
        </div>
        {hasAction && <SkeletonBlock width={120} height={32} radius={8} />}
      </div>
      <div style={{ flex: '1 0 0', padding: bodyPadding, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {children}
      </div>
    </div>
  )
}

/** "Big number + label, action button" row — the Plan / Credits Remaining cards' body. */
export function SkeletonStatRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <SkeletonBlock width={180} height={16} radius={4} />
        <SkeletonBlock width={140} height={14} radius={4} />
      </div>
      <SkeletonBlock width={130} height={32} radius={8} />
    </div>
  )
}

/** Plan + Credits Remaining two-card row (Figma 18:25119) — Teams and Personal both use this. */
export function SkeletonTwoCardRow() {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 0 0', minWidth: 280, display: 'flex' }}>
        <SkeletonSectionCard hasAction headerDivider={false}><SkeletonStatRow /></SkeletonSectionCard>
      </div>
      <div style={{ flex: '1 0 0', minWidth: 280, display: 'flex' }}>
        <SkeletonSectionCard headerDivider={false}><SkeletonStatRow /></SkeletonSectionCard>
      </div>
    </div>
  )
}

export function SkeletonPaymentCard() {
  return (
    <SkeletonSectionCard>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <SkeletonBlock width={44} height={28} radius={6} />
        <div style={{ flex: '1 0 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SkeletonBlock width={180} height={16} radius={4} />
          <SkeletonBlock width={100} height={14} radius={4} />
        </div>
        <SkeletonBlock width={150} height={32} radius={8} />
      </div>
    </SkeletonSectionCard>
  )
}

export function SkeletonInvoiceCard() {
  return (
    <div style={{ border: '1px solid var(--border-default)', borderRadius: 16, boxShadow: SHADOW_CARD, display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 12, paddingBottom: 12, overflow: 'hidden', width: '100%' }}>
      <div style={{ borderBottom: '1px solid var(--neutral-100)', padding: '0 24px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: '1 0 0' }}><SkeletonBlock width={120} height={16} radius={4} /></div>
        <SkeletonBlock width={100} height={32} radius={8} />
      </div>
      <div style={{ padding: '0 24px 12px' }}>
        <div style={{ background: 'var(--neutral-white)', borderRadius: 8, padding: 12, boxShadow: SHADOW_TILE }}>
          <div style={{ display: 'flex', gap: 24, padding: '0 12px 12px', borderBottom: '1px solid var(--neutral-100)' }}>
            {['Date', 'Amount', 'Status'].map(k => <SkeletonBlock key={k} width={55} height={13} radius={4} />)}
            <div style={{ width: 200, display: 'flex', justifyContent: 'center' }}><SkeletonBlock width={55} height={13} radius={4} /></div>
          </div>
          {[0, 1, 2].map((i, idx) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 24, padding: 12, borderBottom: idx < 2 ? '1px solid var(--neutral-100)' : undefined }}>
              <SkeletonBlock width={80} height={14} radius={4} />
              <SkeletonBlock width={60} height={14} radius={4} />
              <SkeletonBlock width={45} height={20} radius={6} />
              <div style={{ width: 200, display: 'flex', justifyContent: 'center' }}><SkeletonBlock width={36} height={14} radius={4} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
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
 *  Payment/Invoice (admin-only). */
export function TeamsPlansSkeleton({ isAdmin }: { isAdmin: boolean }) {
  return (
    <>
      <SkeletonShimmerStyle />
      <div style={{ width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SkeletonPageHeader />
        <SkeletonTwoCardRow />
        {isAdmin && <SkeletonPaymentCard />}
        {isAdmin && <SkeletonInvoiceCard />}
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
