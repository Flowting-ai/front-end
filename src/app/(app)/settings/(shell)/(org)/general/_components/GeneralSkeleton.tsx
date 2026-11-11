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

/** A bone vertically centred in a text line of the given height, so line boxes match the real text. */
function Line({ lh, width, height, radius = 4 }: { lh: number; width: number | string; height: number; radius?: number }) {
  return <div style={{ height: lh, display: 'flex', alignItems: 'center' }}><SkeletonBlock width={width} height={height} radius={radius} /></div>
}

export function GeneralPageSkeleton() {
  return (
    <div style={{ width: '100%', maxWidth: 908, padding: '0 24px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <style>{`@keyframes generalSkeletonShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>

      {/* Page header: h1 (32px line) + subtitle (22px line) */}
      <div style={{ paddingLeft: 4, marginBottom: 4, display: 'flex', flexDirection: 'column' }}>
        <Line lh={32} width={90} height={26} radius={6} />
        <Line lh={22} width={530} height={14} />
      </div>

      {/* Workspace: hero (logo, name, link, Edit workspace) + Workspace ID strip */}
      <SkeletonCard>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px' }}>
          <SkeletonBlock width={64} height={64} radius={16} />
          <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Line lh={28} width={164} height={20} radius={6} />
            <div style={{ height: 22, display: 'flex', alignItems: 'center', gap: 6 }}>
              <SkeletonBlock width={361} height={14} radius={4} />
              <SkeletonBlock width={16} height={16} radius={4} />
            </div>
          </div>
          <SkeletonBlock width={125} height={32} radius={8} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 24px', borderTop: '1px solid var(--border-default)', background: 'var(--neutral-50)' }}>
          <Line lh={20} width={82} height={12} />
          <SkeletonBlock width={143} height={12} radius={4} />
          <SkeletonBlock width={16} height={16} radius={4} />
          <SkeletonBlock width={16} height={16} radius={4} />
        </div>
      </SkeletonCard>

      {/* AI instructions: head + status pill, editor box (textarea, starters + counter), footer */}
      <SkeletonCard>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '16px 24px', borderBottom: '1px solid var(--neutral-100)' }}>
          <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Line lh={22} width={108} height={15} />
            <Line lh={20} width={494} height={12} />
          </div>
          <SkeletonBlock width={73} height={22} radius={999} />
        </div>
        <div style={{ padding: '16px 24px 20px' }}>
          <div style={{ border: '1px solid var(--border-default)', borderRadius: 12, background: 'var(--field-surface)', overflow: 'hidden' }}>
            <div style={{ height: 140, padding: '15px 14px', boxSizing: 'border-box' }}>
              <SkeletonBlock width={630} height={14} radius={4} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 10px', borderTop: '1px solid var(--border-default)', background: 'var(--neutral-50)' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {[140, 206, 168].map(w => <SkeletonBlock key={w} width={w} height={26} radius={999} />)}
              </div>
              <SkeletonBlock width={50} height={12} radius={4} />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderTop: '1px solid var(--border-default)' }}>
          <div style={{ flex: '1 0 0', minWidth: 0 }}><SkeletonBlock width={235} height={12} radius={4} /></div>
          <SkeletonBlock width={61} height={32} radius={8} />
          <SkeletonBlock width={137} height={32} radius={8} />
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
