'use client'

import React from 'react'
import { SHOW_DANGER_ZONE } from './GeneralParts'

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonBlock({
  width = '100%',
  height,
  radius = 8,
}: {
  width?: number | string
  height: number
  radius?: number
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius:   radius,
        flexShrink:     0,
        background:     'linear-gradient(90deg, var(--neutral-100) 25%, var(--neutral-50) 50%, var(--neutral-100) 75%)',
        backgroundSize: '200% 100%',
        animation:      'generalSkeletonShimmer 1.4s ease-in-out infinite',
      }}
    />
  )
}

function SkeletonCard({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <div style={{
      border:       `1px solid ${danger ? 'var(--red-400, #f87171)' : 'var(--border-default)'}`,
      borderRadius: 16,
      boxShadow:    '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
      overflow:     'hidden',
    }}>
      {children}
    </div>
  )
}

function SkeletonRow({ children, border = true }: { children: React.ReactNode; border?: boolean }) {
  return (
    <div style={{
      padding:      '12px 24px',
      borderBottom: border ? '1px solid var(--neutral-100)' : undefined,
      display:      'flex',
      alignItems:   'center',
      gap:          12,
    }}>
      {children}
    </div>
  )
}

export function GeneralPageSkeleton() {
  return (
    <div style={{ width: '100%', maxWidth: 908, padding: '0 24px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <style>{`@keyframes generalSkeletonShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>

      {/* Page header */}
      <div style={{ paddingLeft: 4, marginBottom: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SkeletonBlock width={90}  height={28} radius={8} />
        <SkeletonBlock width={360} height={14} radius={5} />
      </div>

      {/* Workspace Identity */}
      <SkeletonCard>
        {/* Card header */}
        <div style={{ borderBottom: '1px solid var(--neutral-100)', padding: '24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SkeletonBlock width={170} height={16} radius={5} />
          <SkeletonBlock width={260} height={13} radius={4} />
        </div>
        {/* Avatar */}
        <SkeletonRow>
          <SkeletonBlock width={65} height={65} radius={33} />
          <div style={{ flex: '1 0 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SkeletonBlock width={120} height={14} radius={5} />
            <SkeletonBlock width={220} height={12} radius={4} />
          </div>
          <SkeletonBlock width={100} height={32} radius={8} />
        </SkeletonRow>
        {/* Name */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--neutral-100)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SkeletonBlock width={120} height={14} radius={5} />
          <SkeletonBlock width={521} height={36} radius={10} />
        </div>
        {/* Slug + ID */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--neutral-100)', display: 'flex', gap: 16 }}>
          <div style={{ flex: '1 0 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SkeletonBlock width={140} height={14} radius={5} />
            <SkeletonBlock height={36} radius={10} />
            <SkeletonBlock width={180} height={12} radius={4} />
          </div>
          <div style={{ flex: '1 0 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SkeletonBlock width={110} height={14} radius={5} />
            <SkeletonBlock height={36} radius={10} />
          </div>
        </div>
        {/* Save */}
        <div style={{ padding: '6px 24px 20px', display: 'flex', justifyContent: 'flex-end' }}>
          <SkeletonBlock width={108} height={32} radius={8} />
        </div>
      </SkeletonCard>

      {/* AI Instructions */}
      <SkeletonCard>
        <div style={{ borderBottom: '1px solid var(--neutral-100)', padding: '24px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: '1 0 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SkeletonBlock width={260} height={16} radius={5} />
            <SkeletonBlock height={14} radius={4} />
            <SkeletonBlock width='60%' height={14} radius={4} />
          </div>
          <SkeletonBlock width={116} height={22} radius={6} />
        </div>
        <div style={{ padding: '12px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SkeletonBlock height={96} radius={10} />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <SkeletonBlock width={130} height={32} radius={8} />
          </div>
        </div>
      </SkeletonCard>

      {/* Danger Zone */}
      {SHOW_DANGER_ZONE && (
      <SkeletonCard danger>
        <div style={{ borderBottom: '1px solid var(--neutral-100)', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SkeletonBlock width={110} height={16} radius={5} />
          <SkeletonBlock width={310} height={13} radius={4} />
        </div>
        <SkeletonRow>
          <div style={{ flex: '1 0 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SkeletonBlock width={150} height={14} radius={5} />
            <SkeletonBlock width={280} height={13} radius={4} />
          </div>
          <SkeletonBlock width={80} height={32} radius={8} />
        </SkeletonRow>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 8, borderBottom: undefined }}>
          <SkeletonBlock width={160} height={14} radius={5} />
          <SkeletonBlock width={250} height={13} radius={4} />
          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            <SkeletonBlock width={280} height={36} radius={10} />
            <SkeletonBlock width={150} height={36} radius={8} />
          </div>
        </div>
      </SkeletonCard>
      )}
    </div>
  )
}
