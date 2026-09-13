'use client'

import React, { useState } from 'react'
import { SettingsOneIcon } from '@strange-huge/icons'

// ── "Sidebar / Profile Row" (Figma 109:4650) ─────────────────────────────────
// "50px, avatar centred by counter-axis alignment rather than vertical
// padding. On selected the subtitle steps from text/secondary to
// text/primary — secondary only reaches 3.56:1 on that surface, below AA."
// This is the trigger visual only — passed as AccountMenu's `renderTrigger`
// (src/components/AccountMenu) so the dropdown panel/behavior is unchanged.

export interface FlatSidebarProfileRowProps {
  name: string
  sublabel?: string
  avatarSrc?: string
  planLabel?: string
  onOpenSettingsClick: () => void
  collapsed?: boolean
}

export function FlatSidebarProfileRow({ name, sublabel, avatarSrc, planLabel, onOpenSettingsClick, collapsed = false }: FlatSidebarProfileRowProps) {
  const [isHovered, setIsHovered] = useState(false)
  const isActive = isHovered

  if (collapsed) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onOpenSettingsClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenSettingsClick() } }}
        style={{ display: 'flex', justifyContent: 'center', width: '100%', cursor: 'pointer' }}
      >
        <div style={{ width: 32, height: 32, borderRadius: '9999px', overflow: 'hidden', flexShrink: 0, position: 'relative', boxShadow: 'var(--shadow-sidebar-item-avatar)' }}>
          {avatarSrc ? (
            <img alt="" src={avatarSrc} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--neutral-white)', color: 'var(--sidebar-menu-item-text)', fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-caption)' }}>
              {name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpenSettingsClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenSettingsClick() } }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'relative', display: 'flex', alignItems: 'center', gap: 8, width: '100%', height: 50,
        padding: '0 12px', borderRadius: 10, cursor: 'pointer', boxSizing: 'border-box',
        backgroundColor: isActive ? 'var(--sidebar-menu-item-hover-bg)' : 'transparent',
        boxShadow: isActive ? 'var(--shadow-sidebar-item-hover)' : undefined,
        transition: 'background-color 150ms, box-shadow 150ms',
      }}
    >
      <div style={{ width: 32, height: 32, borderRadius: '9999px', overflow: 'hidden', flexShrink: 0, position: 'relative', boxShadow: 'var(--shadow-sidebar-item-avatar)' }}>
        {avatarSrc ? (
          <img alt="" src={avatarSrc} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--neutral-white)', color: 'var(--sidebar-menu-item-text)', fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-caption)' }}>
            {name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', flex: '1 0 0', minWidth: 0, overflow: 'hidden' }}>
        <p style={{
          margin: 0, fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-body)',
          lineHeight: 'var(--line-height-body)', color: 'var(--sidebar-menu-item-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {name}
        </p>
        {sublabel && (
          <p style={{
            margin: 0, fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-regular)', fontSize: 'var(--font-size-caption)',
            lineHeight: 'var(--line-height-caption)', color: isActive ? 'var(--sidebar-menu-item-text)' : 'var(--sidebar-menu-item-muted)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {sublabel}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {planLabel && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', padding: '2px 6px', borderRadius: 6,
            backgroundColor: '#cadcf1', boxShadow: '0px 1px 1.5px 0px rgba(2,15,24,0.2), 0px 0px 0px 1px rgba(13,110,178,0.5)',
            fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-caption)',
            lineHeight: 'var(--line-height-caption)', color: '#135487',
          }}>
            {planLabel}
          </span>
        )}
        <span style={{ display: 'inline-flex', color: 'var(--sidebar-menu-item-text)' }}>
          <SettingsOneIcon size={16} triggered={isActive} />
        </span>
      </div>
    </div>
  )
}

export default FlatSidebarProfileRow
