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
        display:      'flex',
        alignItems:   'center',
        padding:      '12px 16px',
        borderRadius: '12px',
        border:       '1px dashed var(--neutral-300)',
        width:        '100%',
        boxSizing:    'border-box',
      }}
    >
      <p
        style={{
          fontFamily:   'var(--font-body)',
          fontWeight:   'var(--font-weight-regular)',
          fontSize:     '16px',
          lineHeight:   'var(--line-height-body)',
          color:        '#1a1714',
          margin:       0,
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
        }}
      >
        Start a chat to keep conversations organized and re-use project knowledge.
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

    const showActions = hovered || menuOpen || active

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
          flexDirection:   'column',
          gap:             '8px',
          padding:         '12px 16px',
          borderRadius:    '12px',
          backgroundColor: active || hovered || menuOpen ? 'var(--neutral-100)' : 'transparent',
          boxShadow:       active
            ? '0px 2px 2.8px 0px rgba(13,110,178,0.12), 0px 0px 0px 1px var(--blue-600)'
            : hovered || menuOpen
            ? '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)'
            : 'none',
          cursor:          'pointer',
          transition:      'background-color 120ms ease, box-shadow 120ms ease',
          outline:         'none',
          width:           '100%',
          boxSizing:       'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
          {/* Left: title + timestamp */}
          <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <p
              style={{
                fontFamily:   'var(--font-body)',
                fontWeight:   'var(--font-weight-regular)',
                fontSize:     '16px',
                lineHeight:   'var(--line-height-body)',
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
              opacity:    showActions ? 1 : 0,
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
                  icon={<MoreVerticalIcon />}
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

          {/* Pins badge */}
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
              backgroundColor: showActions ? 'rgba(237,225,215,0.6)' : 'transparent',
              boxShadow:       showActions
                ? '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(182,172,164,0.4), inset 0px 1px 0px 0px rgba(247,242,237,0.61), inset 0px -1px 0px 0px rgba(106,98,93,0.05)'
                : '0px 0px 0px 1px rgba(59,54,50,0.3)',
              cursor:          pinCount > 0 ? 'pointer' : 'default',
              flexShrink:      0,
              transition:      'background-color 120ms ease, box-shadow 120ms ease',
            }}
            aria-label={pinCount > 0 ? `${pinCount} pins` : 'No pins'}
          >
            {pinCount > 0 && (
              <PinIcon style={{ width: 16, height: 16, color: 'var(--neutral-700)', flexShrink: 0 }} />
            )}
            <span
              style={{
                fontFamily:  'var(--font-body)',
                fontWeight:  'var(--font-weight-medium)',
                fontSize:    '14px',
                lineHeight:  '22px',
                color:       'var(--neutral-700)',
                whiteSpace:  'nowrap',
              }}
            >
              {pinCount > 0 ? `${pinCount} pins` : 'No pins'}
            </span>
          </button>
        </div>
      </div>
    )
  },
)

ProjectChatRow.displayName = 'ProjectChatRow'
export default ProjectChatRow
