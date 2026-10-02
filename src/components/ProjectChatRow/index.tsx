'use client'

import React, { useEffect, useRef, useState } from 'react'
import { MoreVerticalIcon, PinIcon } from '@strange-huge/icons'
import { IconButton } from '@/components/IconButton'
import { Button } from '@/components/Button'
import { Dropdown } from '@/components/Dropdown'
import { Badge } from '@/components/Badge'
import { RESET_BUTTON_STYLE } from '@/lib/reset-button-style'
import { PINS_ENABLED } from '@/lib/feature-flags'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ProjectChatRowProps {
  title:            string
  timestamp:        string
  /** Pass `null` while the real count isn't known yet (e.g. the pinboard
   *  hasn't finished loading) — renders a neutral placeholder instead of
   *  falsely claiming "No pins". */
  pinCount:         number | null
  active?:          boolean
  /** Author attribution, appended to the timestamp line (team shared/view-only rows). */
  author?:          string
  /** Read-only shared chat (the "View only" tab) — shows a "View only" badge and never renders the ⋮ menu, regardless of onRename/onDelete. */
  readOnly?:        boolean
  /** Team projects only: show the per-chat "Publish to team" affordance (editor+). */
  canPublish?:      boolean
  /** Whether this chat is currently published to the team. */
  published?:       boolean
  /** Called with the desired next published state once the user confirms. */
  onPublishToggle?: (next: boolean) => void
  onChatClick?:     () => void
  onPinsClick?:     (e: React.MouseEvent) => void
  onRename?:        (newTitle: string) => void
  onDelete?:        () => void
  /** Editable shared chat, not yet owned — shows "Create a copy" instead of Rename/Delete. */
  onCreateCopy?:    () => void
}

// Per-chat publish flow — mirrors the design's YourChatRow state machine.
type PublishState = 'idle' | 'confirming' | 'published' | 'unpublishing'

// Ghost-button treatment (see Button's `ghost` variant) for bg/hover — no
// permanent border; row separation comes from a <Divider /> between rows
// instead (see the project page's list rendering).

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
  { title, timestamp, pinCount, active, author, readOnly, canPublish, published, onPublishToggle, onChatClick, onPinsClick, onRename, onDelete, onCreateCopy, ref }: ProjectChatRowProps & { ref?: React.Ref<HTMLDivElement> },
) {
    const [hovered,   setHovered]   = useState(false)
    const [menuOpen,  setMenuOpen]  = useState(false)
    const [isEditing, setIsEditing] = useState(false)

    // Publish state machine. Seeded from `published`; re-synced when the prop
    // changes (e.g. after the parent reloads the published set). Tracks the
    // previous value via useState, not a ref -- writing to ref.current during
    // render isn't safe (a render can be replayed/discarded, e.g. Strict Mode
    // double-invoking or a Suspense interruption, leaving the ref out of sync
    // with what actually committed), and is exactly what the React Compiler's
    // `refs` lint rule flags. useState is the compiler-safe version of the
    // same "adjust state when a prop changes" pattern.
    const [publishState, setPublishState] = useState<PublishState>(published ? 'published' : 'idle')
    const [prevPublished, setPrevPublished] = useState(published)
    if (prevPublished !== published) {
      setPrevPublished(published)
      setPublishState(published ? 'published' : 'idle')
    }
    const isPublished  = publishState === 'published'
    const isConfirming = publishState === 'confirming' || publishState === 'unpublishing'
    const [editValue, setEditValue] = useState(title)
    const inputRef = useRef<HTMLInputElement>(null)
    const [prevTitle, setPrevTitle] = useState(title)
    if (prevTitle !== title) {
      setPrevTitle(title)
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

    // ⋮ menu only visible on hover/menu-open, and only when there's an action
    // to offer (read-only shared/view-only rows pass no handlers). No
    // "Unpublish" entry — see the menu section below — so a published chat's
    // publish state alone no longer justifies showing the menu.
    const showMoreMenu = hovered || menuOpen
    const hasMenu = !readOnly && (!!onRename || !!onDelete || !!onCreateCopy)
    // Pin badge uses warm hover style when the row is active or hovered
    const showPinAction = hovered || menuOpen || !!active

    // `null` = count not known yet (pinboard still loading) — treated like
    // "no pins" for layout/interaction purposes, but labelled honestly instead
    // of claiming zero.
    const pinCountKnown = pinCount !== null
    const hasPins       = pinCountKnown && pinCount > 0

    // Ghost bg: transparent at rest, ghost-hover fill on hover/menu-open —
    // matches ChatRow's rowActive/bg treatment exactly.
    const rowElevated = hovered || menuOpen
    const backgroundColor = rowElevated ? 'var(--button-ghost-bg-hover)' : 'transparent'

    const boxShadow = (() => {
      if (active && rowElevated) {
        return '0px 2px 2.8px 0px rgba(13,110,178,0.12), 0px 0px 0px 1.5px var(--blue-500)'
      }
      if (rowElevated) {
        return 'var(--shadow-item-inner)'
      }
      return undefined
    })()

    // Active-but-not-hovered uses a dashed outline border
    const outline = (active && !rowElevated) ? '2px dashed var(--blue-500)' : 'none'

    return (
      <div
        ref={ref}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display:         'flex',
          alignItems:      'center',
          gap:             '8px',
          padding:         '12px 16px',
          borderRadius:    '12px',
          backgroundColor,
          boxShadow,
          outline,
          transition:      'background-color 120ms ease, box-shadow 120ms ease',
          width:           '100%',
          boxSizing:       'border-box',
        }}
      >
        {/* Left: title + timestamp. The whole row used to be one role="button"
            div wrapping the ⋮ menu, pin-count and publish buttons as nested
            interactive descendants — assistive tech can't reliably operate a
            button inside another interactive element. The title/timestamp
            (the "open chat" target) is now its own real <button> instead, a
            sibling to those, not their ancestor; while editing there's no
            button here at all (an <input> can't validly nest inside one
            anyway), which is fine since the row's own navigate click was
            already suppressed during editing before this change. */}
        {isEditing ? (
          <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter')  { e.preventDefault(); commitRename() }
                if (e.key === 'Escape') { e.preventDefault(); cancelRename() }
              }}
              style={{
                fontFamily:      'var(--font-body)',
                fontWeight:      'var(--font-weight-medium)',
                fontSize:        '15px',
                lineHeight:      '22px',
                color:           'var(--legacy-1a1714)',
                border:          'none',
                outline:         'none',
                background:      'transparent',
                width:           '100%',
                padding:         0,
                margin:          0,
              }}
            />
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
              {[timestamp, author].filter(Boolean).join(' · ')}
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onChatClick?.()}
            style={{ ...RESET_BUTTON_STYLE, flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
              <p
                style={{
                  fontFamily:   'var(--font-body)',
                  fontWeight:   'var(--font-weight-medium)',
                  fontSize:     '15px',
                  lineHeight:   '22px',
                  color:        'var(--legacy-1a1714)',
                  overflow:     'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace:   'nowrap',
                  margin:       0,
                }}
              >
                {title}
              </p>
              {isPublished && <Badge color="Blue" label="Published" style={{ flexShrink: 0 }} />}
              {readOnly && <Badge color="Red" label="View only" style={{ flexShrink: 0 }} />}
            </div>
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
              {[timestamp, author].filter(Boolean).join(' · ')}
            </p>
          </button>
        )}

        {/* Publish confirmation — replaces ⋮/pins while confirming */}
        {!isEditing && isConfirming && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>

            <span
              style={{
                display:         'inline-flex',
                alignItems:      'center',
                padding:         '2px 4px',
                borderRadius:    6,
                backgroundColor: 'var(--blue-100)',
                boxShadow:       '0px 1px 1.5px 0px rgba(2,15,24,0.2), 0px 0px 0px 1px rgba(13,110,178,0.5)',
                fontFamily:      'var(--font-body)',
                fontWeight:      500,
                fontSize:        11,
                lineHeight:      '16px',
                color:           'var(--blue-700)',
                whiteSpace:      'nowrap',
                flexShrink:      0,
              }}
            >
              {publishState === 'unpublishing'
                ? 'This chat would be unpublished from all members of this project'
                : 'This chat would be published to all members of this project'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPublishState(publishState === 'unpublishing' ? 'published' : 'idle')}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const next = publishState !== 'unpublishing'
                setPublishState(next ? 'published' : 'idle')
                onPublishToggle?.(next)
              }}
            >
              Confirm
            </Button>
          </div>
        )}

        {/* ⋮ menu - hover-revealed */}
        {!isEditing && !isConfirming && hasMenu && (
          <div
            style={{
              display:    'flex',
              alignItems: 'center',
              opacity:    showMoreMenu ? 1 : 0,
              transition: 'opacity 120ms ease',
              flexShrink: 0,
            }}
          >
            <Dropdown.Float
              open={menuOpen}
              onOpenChange={setMenuOpen}
              placement="bottom-end"
              // Rows can sit anywhere in this scrollable chat list — a row
              // near the bottom of the viewport would otherwise run the menu
              // off-screen with a fixed placement.
              autoFlipVertical
              trigger={
                <IconButton
                  variant="ghost"
                  size="sm"
                  icon={<MoreVerticalIcon triggered={showMoreMenu} />}
                  aria-label="Chat options"
                />
              }
            >
              <Dropdown size="sm" maxHeight={false}>
                <Dropdown.Section fluid>
                  {onRename && (
                    <Dropdown.Item
                      label="Rename"
                      onClick={() => { setMenuOpen(false); setIsEditing(true) }}
                      fluid
                    />
                  )}
                  {/* No "Unpublish" action — the backend has no unshare route
                      for a chat yet (only POST .../share, which is one-way).
                      Offering this would optimistically flip the row to
                      "unpublished" locally with no way to actually make that
                      true server-side. */}
                  {onCreateCopy && (
                    <Dropdown.Item
                      label="Create a copy"
                      onClick={() => { setMenuOpen(false); onCreateCopy() }}
                      fluid
                    />
                  )}
                  {onDelete && (
                    <Dropdown.Item
                      label="Delete"
                      variant="danger"
                      onClick={() => { setMenuOpen(false); onDelete() }}
                      fluid
                    />
                  )}
                </Dropdown.Section>
              </Dropdown>
            </Dropdown.Float>
          </div>
        )}

        {/* + Publish — editor+ only, hidden once published or while confirming,
            and only shown on hover/menu-open like the row's other actions. */}
        {!isEditing && !isConfirming && canPublish && !isPublished && showMoreMenu && (
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPublishState('confirming')}
            >
              Publish
            </Button>
          </div>
        )}

        {/* Pin count badge */}
        {PINS_ENABLED && !isConfirming && <button
          onClick={(e) => {
            if (hasPins) onPinsClick?.(e)
          }}
          disabled={!hasPins}
          aria-label={hasPins ? `${pinCount} pins` : pinCountKnown ? 'No pins' : 'Pin count loading'}
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
            cursor:         hasPins ? 'pointer' : 'default',
            width:          !hasPins ? '78px' : undefined,
            overflow:       'hidden',
            boxShadow:      (showPinAction && hasPins)
              ? '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(212, 212, 212,0.4)'
              : '0px 0px 0px 1px rgba(59,54,50,0.3)',
            transition:     'box-shadow 120ms ease',
          }}
        >
          {/* Warm fill on hover/active when there are pins */}
          {hasPins && showPinAction && (
            <div
              aria-hidden
              style={{
                position:      'absolute',
                inset:         0,
                background:    'rgba(245, 245, 245,0.6)',
                pointerEvents: 'none',
                borderRadius:  '8px',
              }}
            />
          )}

          {hasPins ? (
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
                  color:      'var(--neutral-700)',
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
              {pinCountKnown ? 'No pins' : '···'}
            </span>
          )}

          {/* Inset highlight on hover/active when there are pins */}
          {hasPins && showPinAction && (
            <div
              aria-hidden
              style={{
                position:      'absolute',
                inset:         0,
                pointerEvents: 'none',
                borderRadius:  '8px',
                boxShadow:     'inset 0px 1px 0px 0px rgba(255, 255, 255,0.61), inset 0px -1px 0px 0px rgba(106,98,93,0.05)',
              }}
            />
          )}
        </button>}
      </div>
    )
}

ProjectChatRow.displayName = 'ProjectChatRow'
export default ProjectChatRow
