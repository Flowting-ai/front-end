'use client'

import React, { useState } from 'react'
import { MoreVerticalIcon, PinIcon } from '@strange-huge/icons'
import { IconButton } from '@/components/IconButton'
import { Dropdown } from '@/components/Dropdown'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ProjectChatRowProps {
  title:        string
  timestamp:    string
  pinCount:     number
  active?:      boolean
  onChatClick?: () => void
  onPinsClick?: (e: React.MouseEvent) => void
  onRename?:    () => void
  onDelete?:    () => void
}

// ── Empty-state row ────────────────────────────────────────────────────────────

export function ProjectChatEmptyRow() {
  return (
    <div
      style={{
        display:         'flex',
        alignItems:      'center',
        padding:         '12px 16px',
        borderRadius:    '12px',
        border:          '1px dashed var(--neutral-300)',
        backgroundColor: 'var(--neutral-50)',
        width:           '100%',
        boxSizing:       'border-box',
      }}
    >
      <p
        style={{
          fontFamily:   'var(--font-body)',
          fontWeight:   'var(--font-weight-regular)',
          fontSize:     '14px',
          lineHeight:   '22px',
          color:        '#857a72',
          margin:       0,
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
        }}
      >
        Start a chat — your project instructions and files apply automatically.
      </p>
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

export const ProjectChatRow = React.forwardRef<HTMLDivElement, ProjectChatRowProps>(
  function ProjectChatRow(
    { title, timestamp, pinCount, active, onChatClick, onPinsClick, onRename, onDelete },
    ref,
  ) {
    const [hovered,  setHovered]  = useState(false)
    const [menuOpen, setMenuOpen] = useState(false)

    // ⋮ menu only visible on hover/menu-open
    const showMoreMenu = hovered || menuOpen
    // Pins button gets warm styling on hover, menu-open, or active
    const showPinAction = hovered || menuOpen || !!active

    const backgroundColor = (hovered || menuOpen) ? 'var(--neutral-100)' : 'transparent'

    const boxShadow = (() => {
      if (active && (hovered || menuOpen)) {
        return '0px 2px 2.8px 0px rgba(13,110,178,0.12), 0px 0px 0px 1.5px var(--blue-500)'
      }
      if (hovered || menuOpen) {
        return '0px 1px 1.5px 0px rgba(82,75,71,0.10), 0px 0px 0px 1px var(--neutral-200)'
      }
      return 'none'
    })()

    // Active-but-not-hovered uses a dashed outline border
    const outline = (active && !hovered && !menuOpen) ? '2px dashed var(--blue-500)' : 'none'

    return (
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        onClick={onChatClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onChatClick?.() }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display:         'flex',
          alignItems:      'center',
          gap:             '8px',
          padding:         '10px 14px 10px 16px',
          borderRadius:    '12px',
          backgroundColor,
          boxShadow,
          outline,
          cursor:          'pointer',
          transition:      'background-color 120ms ease, box-shadow 120ms ease',
          width:           '100%',
          boxSizing:       'border-box',
        }}
      >
        {/* Left: title + timestamp */}
        <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <p
            style={{
              fontFamily:   'var(--font-body)',
              fontWeight:   'var(--font-weight-medium)',
              fontSize:     '15px',
              lineHeight:   '22px',
              color:        '#1a1714',
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
              margin:       0,
            }}
          >
            {title}
          </p>
          <p
            style={{
              fontFamily:   'var(--font-body)',
              fontWeight:   'var(--font-weight-regular)',
              fontSize:     '11px',
              lineHeight:   '16px',
              color:        '#a39b95',
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
              margin:       0,
            }}
          >
            {timestamp}
          </p>
        </div>

        {/* ⋮ menu — hover-revealed */}
        <div
          style={{
            opacity:    showMoreMenu ? 1 : 0,
            transition: 'opacity 120ms ease',
            flexShrink: 0,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Dropdown.Float
            open={menuOpen}
            onOpenChange={setMenuOpen}
            placement="bottom-end"
            trigger={
              <IconButton
                variant="ghost"
                size="xs"
                icon={<MoreVerticalIcon triggered={showMoreMenu} />}
                aria-label="Chat options"
              />
            }
          >
            <Dropdown size="sm">
              <Dropdown.Section>
                <Dropdown.Item label="Rename" onClick={onRename} fluid />
                <Dropdown.Item label="Delete" variant="danger" onClick={onDelete} fluid />
              </Dropdown.Section>
            </Dropdown>
          </Dropdown.Float>
        </div>

        {/* Pins badge — always visible, styled on hover/active */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (pinCount > 0) onPinsClick?.(e)
          }}
          disabled={pinCount === 0}
          style={{
            display:         'inline-flex',
            alignItems:      'center',
            gap:             '4px',
            padding:         '5px 8px',
            borderRadius:    '8px',
            border:          'none',
            backgroundColor: showPinAction
              ? 'rgba(237,225,215,0.6)'
              : 'transparent',
            boxShadow: showPinAction
              ? '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(182,172,164,0.4), inset 0px 1px 0px 0px rgba(247,242,237,0.61), inset 0px -1px 0px 0px rgba(106,98,93,0.05)'
              : '0px 0px 0px 1px rgba(59,54,50,0.2)',
            cursor:     pinCount > 0 ? 'pointer' : 'default',
            flexShrink: 0,
            transition: 'background-color 120ms ease, box-shadow 120ms ease',
          }}
          aria-label={pinCount > 0 ? `${pinCount} pins` : 'No pins'}
        >
          {pinCount > 0 && (
            <PinIcon style={{ width: 14, height: 14, color: 'var(--neutral-700)', flexShrink: 0 }} />
          )}
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 'var(--font-weight-medium)',
              fontSize:   '13px',
              lineHeight: '20px',
              color:      'var(--neutral-700)',
              whiteSpace: 'nowrap',
            }}
          >
            {pinCount > 0 ? `${pinCount} pins` : 'No pins'}
          </span>
        </button>
      </div>
    )
  },
)

ProjectChatRow.displayName = 'ProjectChatRow'
export default ProjectChatRow
