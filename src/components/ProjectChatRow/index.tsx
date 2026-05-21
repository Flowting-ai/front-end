'use client'

import React, { useEffect, useRef, useState } from 'react'
import { MoreVerticalIcon, PinIcon } from '@strange-huge/icons'
import { IconButton } from '@/components/IconButton'
import { Dropdown } from '@/components/Dropdown'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ProjectChatRowProps {
  title:            string
  timestamp:        string
  pinCount:         number
  active?:          boolean
  onChatClick?:     () => void
  onPinsClick?:     (e: React.MouseEvent) => void
  onRename?:        (newTitle: string) => void
  onDelete?:        () => void
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
        Start a chat - your project instructions and files apply automatically.
      </p>
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ProjectChatRow(
  { title, timestamp, pinCount, active, onChatClick, onPinsClick, onRename, onDelete, ref }: ProjectChatRowProps & { ref?: React.Ref<HTMLDivElement> },
) {
    const [hovered,   setHovered]   = useState(false)
    const [menuOpen,  setMenuOpen]  = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    // eslint-disable-next-line react-doctor/no-derived-useState -- intentional draft-state pattern; reset handled by key prop or effect
    const [editValue, setEditValue] = useState(title)
    const inputRef = useRef<HTMLInputElement>(null)
    const prevTitleRef = useRef(title)
    if (prevTitleRef.current !== title) {
      prevTitleRef.current = title
      setEditValue(title)
    }

    // Focus the input when editing starts
    useEffect(() => {
      if (isEditing) {
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }, [isEditing])

    const commitRename = () => {
      const trimmed = editValue.trim()
      if (trimmed && trimmed !== title) onRename?.(trimmed)
      setIsEditing(false)
    }

    const cancelRename = () => {
      setEditValue(title)
      setIsEditing(false)
    }

    // ⋮ menu only visible on hover/menu-open
    const showMoreMenu = hovered || menuOpen
    // Pin badge uses warm hover style when the row is active or hovered
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
        onClick={() => { if (!isEditing) onChatClick?.() }}
        onKeyDown={(e) => { if (!isEditing && (e.key === 'Enter' || e.key === ' ')) onChatClick?.() }}
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
          cursor:          isEditing ? 'default' : 'pointer',
          transition:      'background-color 120ms ease, box-shadow 120ms ease',
          width:           '100%',
          boxSizing:       'border-box',
        }}
      >
        {/* Left: title + timestamp */}
        <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {isEditing ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter')  { e.preventDefault(); commitRename() }
                if (e.key === 'Escape') { e.preventDefault(); cancelRename() }
                e.stopPropagation()
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                fontFamily:      'var(--font-body)',
                fontWeight:      'var(--font-weight-medium)',
                fontSize:        '15px',
                lineHeight:      '22px',
                color:           '#1a1714',
                border:          'none',
                // eslint-disable-next-line react-doctor/no-outline-none -- browser outline suppressed; :focus-visible handled by container or global styles
                outline:         'none',
                background:      'transparent',
                width:           '100%',
                padding:         0,
                margin:          0,
              }}
            />
          ) : (
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
          )}
          <p
            style={{
              fontFamily:   'var(--font-body)',
              fontWeight:   'var(--font-weight-regular)',
              fontSize: '12px',
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

        {/* ⋮ menu - hover-revealed */}
        {!isEditing && (
          // eslint-disable-next-line react-doctor/click-events-have-key-events, react-doctor/no-static-element-interactions -- stopPropagation wrapper; menu items handle keyboard
          <div
            style={{
              display:    'flex',
              alignItems: 'center',
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
                  size="sm"
                  icon={<MoreVerticalIcon triggered={showMoreMenu} />}
                  aria-label="Chat options"
                />
              }
            >
              <Dropdown size="sm">
                <Dropdown.Section fluid>
                  <Dropdown.Item
                    label="Rename"
                    onClick={() => { setMenuOpen(false); setIsEditing(true) }}
                    fluid
                  />
                  <Dropdown.Item
                    label="Delete"
                    variant="danger"
                    onClick={() => { setMenuOpen(false); onDelete?.() }}
                    fluid
                  />
                </Dropdown.Section>
              </Dropdown>
            </Dropdown.Float>
          </div>
        )}

        {/* Pin count badge */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (pinCount > 0) onPinsClick?.(e)
          }}
          disabled={pinCount === 0}
          aria-label={pinCount > 0 ? `${pinCount} pins` : 'No pins'}
          style={{
            position:       'relative',
            display:        'inline-flex',
            alignItems:     'center',
            justifyContent: 'center',
            gap:            '4px',
            border:         'none',
            background:     'transparent',
            padding:        '6px 8px',
            flexShrink:     0,
            borderRadius:   '8px',
            cursor:         pinCount > 0 ? 'pointer' : 'default',
            width:          pinCount === 0 ? '78px' : undefined,
            overflow:       'hidden',
            boxShadow:      (showPinAction && pinCount > 0)
              ? '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(182,172,164,0.4)'
              : '0px 0px 0px 1px rgba(59,54,50,0.3)',
            transition:     'box-shadow 120ms ease',
          }}
        >
          {/* Warm fill on hover/active when there are pins */}
          {pinCount > 0 && showPinAction && (
            <div
              aria-hidden
              style={{
                position:      'absolute',
                inset:         0,
                background:    'rgba(237,225,215,0.6)',
                pointerEvents: 'none',
                borderRadius:  '8px',
              }}
            />
          )}

          {pinCount > 0 ? (
            <>
              <PinIcon
                animated
                style={{ width: 16, height: 16, color: '#857a72', flexShrink: 0, position: 'relative' }}
              />
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 'var(--font-weight-medium)',
                  fontSize:   '13px',
                  lineHeight: '20px',
                  color:      '#524b47',
                  whiteSpace: 'nowrap',
                  position:   'relative',
                }}
              >
                {pinCount} pins
              </span>
            </>
          ) : (
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 'var(--font-weight-medium)',
                fontSize:   '13px',
                lineHeight: '20px',
                color:      '#857a72',
                whiteSpace: 'nowrap',
              }}
            >
              No pins
            </span>
          )}

          {/* Inset highlight on hover/active when there are pins */}
          {pinCount > 0 && showPinAction && (
            <div
              aria-hidden
              style={{
                position:      'absolute',
                inset:         0,
                pointerEvents: 'none',
                borderRadius:  '8px',
                boxShadow:     'inset 0px 1px 0px 0px rgba(247,242,237,0.61), inset 0px -1px 0px 0px rgba(106,98,93,0.05)',
              }}
            />
          )}
        </button>
      </div>
    )
}

ProjectChatRow.displayName = 'ProjectChatRow'
export default ProjectChatRow
