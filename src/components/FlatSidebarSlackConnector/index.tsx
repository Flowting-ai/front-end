'use client'

import React from 'react'
import { ArrowUpRightOneIcon } from '@strange-huge/icons'
import { Tooltip } from '@/components/Tooltip'

// ── "Sidebar / Slack Connector" (Figma 136:50005) ────────────────────────────
// Slack brand glyph isn't in @strange-huge/icons — inlined here, same pattern
// as SlackIcon in src/components/Sidebar/index.tsx (kept separate rather than
// exported/shared, since that file must stay byte-for-byte unchanged).

function SlackGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M13 9.25V3.75C13 2.7835 13.7835 2 14.75 2C15.7165 2 16.5 2.7835 16.5 3.75V9.25C16.5 10.2165 15.7165 11 14.75 11C13.7835 11 13 10.2165 13 9.25Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 20.25V14.75C7.5 13.7835 8.2835 13 9.25 13C10.2165 13 11 13.7835 11 14.75V20.25C11 21.2165 10.2165 22 9.25 22C8.2835 22 7.5 21.2165 7.5 20.25Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14.75 13L20.25 13C21.2165 13 22 13.7835 22 14.75C22 15.7165 21.2165 16.5 20.25 16.5L14.75 16.5C13.7835 16.5 13 15.7165 13 14.75C13 13.7835 13.7835 13 14.75 13Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.75 7.5L9.25 7.5C10.2165 7.5 11 8.2835 11 9.25C11 10.2165 10.2165 11 9.25 11L3.75 11C2.7835 11 2 10.2165 2 9.25C2 8.2835 2.7835 7.5 3.75 7.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 3.75C7 4.7165 7.7835 5.5 8.75 5.5H10.5V3.75C10.5 2.7835 9.7165 2 8.75 2C7.7835 2 7 2.7835 7 3.75Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M17 20.25C17 19.2835 16.2165 18.5 15.25 18.5H13.5V20.25C13.5 21.2165 14.2835 22 15.25 22C16.2165 22 17 21.2165 17 20.25Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M20.25 7C19.2835 7 18.5 7.7835 18.5 8.75L18.5 10.5H20.25C21.2165 10.5 22 9.7165 22 8.75C22 7.7835 21.2165 7 20.25 7Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M3.75 17C4.7165 17 5.5 16.2165 5.5 15.25V13.5L3.75 13.5C2.7835 13.5 2 14.2835 2 15.25C2 16.2165 2.7835 17 3.75 17Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

export interface FlatSidebarSlackConnectorProps {
  connected?: boolean
  /** Persistent selected/highlighted state — same fill + left indicator bar
   *  treatment as FlatSidebarRow, for when this page is currently active. */
  selected?: boolean
  onAdd?: () => void
  onClick?: () => void
  collapsed?: boolean
}

export function FlatSidebarSlackConnector({ connected = false, selected = false, onAdd, onClick, collapsed = false }: FlatSidebarSlackConnectorProps) {
  const [isHovered, setIsHovered] = React.useState(false)
  const isActive = isHovered || selected

  // Icon-only rail row — same sizing convention as FlatSidebarRow's collapsed
  // default variant (auto width, 6px horizontal padding, 32px height), with a
  // tooltip standing in for the label that's hidden in this state.
  if (collapsed) {
    return (
      <Tooltip content="Slack in Souvenir" side="right" delayDuration={300}>
        <div
          role="button"
          tabIndex={0}
          aria-pressed={selected}
          aria-label="Slack in Souvenir"
          onClick={onClick}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 'auto', height: 32, padding: '0 6px', borderRadius: 10,
            backgroundColor: isActive ? 'var(--sidebar-menu-item-hover-bg)' : 'transparent',
            boxShadow: isActive ? 'var(--shadow-sidebar-item-hover)' : undefined,
            cursor: 'pointer', transition: 'background-color 150ms, box-shadow 150ms', boxSizing: 'border-box',
          }}
        >
          <div style={{ color: 'var(--sidebar-menu-item-text)', lineHeight: 0 }}>
            <SlackGlyph size={20} />
          </div>
        </div>
      </Tooltip>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', height: 32, padding: '0 8px', borderRadius: 10,
        backgroundColor: isActive ? 'var(--sidebar-menu-item-hover-bg)' : 'transparent',
        boxShadow: isActive ? 'var(--shadow-sidebar-item-hover)' : undefined,
        cursor: 'pointer', transition: 'background-color 150ms, box-shadow 150ms', boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <div style={{ color: 'var(--sidebar-menu-item-text)', flexShrink: 0, lineHeight: 0 }}>
          <SlackGlyph size={20} />
        </div>
        <p style={{
          fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-body)',
          lineHeight: 'var(--line-height-body)', color: isHovered ? 'var(--neutral-black)' : 'var(--sidebar-menu-item-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          Slack in Souvenir
        </p>
      </div>
      {connected ? (
        <span aria-hidden style={{ display: 'inline-flex', flexShrink: 0, color: 'var(--sidebar-menu-item-text)' }}>
          <ArrowUpRightOneIcon size={16} animated />
        </span>
      ) : (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onAdd?.() }}
          style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-regular)', fontSize: 'var(--font-size-caption)',
            lineHeight: 'var(--line-height-caption)', color: 'var(--sidebar-menu-item-text)', flexShrink: 0,
          }}
        >
          Add
        </button>
      )}
    </div>
  )
}

export default FlatSidebarSlackConnector
