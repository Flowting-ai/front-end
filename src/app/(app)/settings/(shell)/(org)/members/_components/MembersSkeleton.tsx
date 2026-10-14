'use client'

import React from 'react'
import { SHADOW_CARD, SHADOW_STAT_CARD } from './members-shared'

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonBlock({ width = '100%', height, radius = 8 }: { width?: string | number; height: number; radius?: number }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'linear-gradient(90deg, var(--neutral-100) 25%, var(--neutral-50) 50%, var(--neutral-100) 75%)',
      backgroundSize: '200% 100%',
      animation: 'membersSkeletonShimmer 1.4s ease-in-out infinite',
      flexShrink: 0,
    }} />
  )
}

export function MembersPageSkeleton() {
  return (
    <>
      <style>{`@keyframes membersSkeletonShimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
      <div style={{ width: '100%', maxWidth: 908, padding: '0 24px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Page header — h1/subtitle left, "Roles & Permissions" button right */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SkeletonBlock width={120} height={28} radius={6} />
            <SkeletonBlock width={320} height={14} radius={4} />
          </div>
          <SkeletonBlock width={170} height={32} radius={8} />
        </div>

        {/* Stats row */}
        <div style={{ border: '1px solid var(--border-default)', borderRadius: 16, boxShadow: SHADOW_CARD, padding: 12, display: 'flex', gap: 9 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ flex: '1 0 0', minWidth: 0, backgroundColor: 'var(--neutral-white)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 6, boxShadow: SHADOW_STAT_CARD }}>
              <SkeletonBlock width={90} height={13} radius={4} />
              <SkeletonBlock width={40} height={28} radius={6} />
              <SkeletonBlock width={100} height={12} radius={4} />
            </div>
          ))}
        </div>

        {/* Members table skeleton */}
        <div style={{ borderRadius: 16, border: '1px solid var(--border-default)', backgroundColor: 'var(--legacy-f9f5f1)', boxShadow: SHADOW_CARD, overflow: 'hidden', width: '100%' }}>
          {/* Toolbar — title left, search icon button + "Invite members" button right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 24px 24px', borderBottom: '1px solid var(--neutral-100)' }}>
            <SkeletonBlock width={120} height={16} radius={4} />
            <div style={{ flex: '1 0 0' }} />
            <SkeletonBlock width={32} height={32} radius={8} />
            <SkeletonBlock width={130} height={32} radius={8} />
          </div>
          {/* Column headers — Member / Role / Actions (WORKSPACE_MEMBER_COLUMNS) */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '12px 24px' }}>
            <div style={{ flex: '1 0 0', minWidth: 0 }}><SkeletonBlock width={60} height={13} radius={4} /></div>
            <div style={{ width: 150, display: 'flex' }}><SkeletonBlock width={40} height={13} radius={4} /></div>
            <div style={{ width: 130, display: 'flex', justifyContent: 'flex-end' }}><SkeletonBlock width={55} height={13} radius={4} /></div>
          </div>
          {/* Member rows */}
          {[0, 1, 2, 3].map((i, idx) => (
            <React.Fragment key={i}>
              {idx > 0 && <div style={{ height: 1, backgroundColor: 'var(--neutral-100)', margin: 0 }} />}
              <div style={{ display: 'flex', alignItems: 'center', padding: '10px 24px' }}>
                <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <SkeletonBlock width={32} height={32} radius={16} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <SkeletonBlock width={120} height={13} radius={4} />
                    <SkeletonBlock width={160} height={11} radius={4} />
                  </div>
                </div>
                <div style={{ width: 150, display: 'flex' }}><SkeletonBlock width={80} height={28} radius={8} /></div>
                <div style={{ width: 130, display: 'flex', justifyContent: 'flex-end' }}><SkeletonBlock width={72} height={28} radius={8} /></div>
              </div>
            </React.Fragment>
          ))}
        </div>

      </div>
    </>
  )
}
