'use client'

import React, { useState } from 'react'
import { cn } from '@/lib/utils'

// ── Shadows ───────────────────────────────────────────────────────────────────

const CHIP_RING        = '0px 0px 0px 1px rgba(59,54,50,0.28)'
const CHIP_RING_DANGER = '0px 0px 0px 1px rgba(220,38,38,0.28)'

// ── ChipButton ────────────────────────────────────────────────────────────────

interface ChipButtonProps {
  children:  React.ReactNode
  danger?:   boolean
  ghost?:    boolean
  disabled?: boolean
  onClick?:  () => void
}

export function ChipButton({ children, danger = false, ghost = false, disabled = false, onClick }: ChipButtonProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        gap:             6,
        padding:         '5px 10px',
        borderRadius:    8,
        border:          'none',
        backgroundColor: hovered && !disabled
          ? danger ? 'rgba(220,38,38,0.05)' : 'rgba(59,54,50,0.04)'
          : 'transparent',
        boxShadow:       ghost
          ? 'none'
          : danger ? CHIP_RING_DANGER : CHIP_RING,
        fontFamily:      'var(--font-body)',
        fontSize:        'var(--font-size-body)',
        fontWeight:      500,
        lineHeight:      'var(--line-height-body)',
        color:           danger ? 'var(--red-500, #dc2626)' : 'var(--neutral-700)',
        opacity:         disabled ? 0.38 : 1,
        cursor:          disabled ? 'not-allowed' : 'pointer',
        transition:      'background-color 120ms',
        flexShrink:      0,
        whiteSpace:      'nowrap',
      }}
    >
      {children}
    </button>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChatSelectionBarProps {
  /** Number of currently selected chats */
  selectedCount:   number
  /** Total chats in the list — used to determine "all selected" state */
  totalCount:      number
  /** Fires when "Select all" / "Deselect all" is clicked */
  onToggleAll:     () => void
  /** Fires when "Move to project" is clicked */
  onMoveToProject: () => void
  /** Fires when "Delete" is clicked */
  onDelete:        () => void
  /** Fires when "Cancel" is clicked */
  onCancel:        () => void
  className?:      string
  style?:          React.CSSProperties
}

// ── Component — flat inline controls, no card wrapping ───────────────────────
// Drop this directly into a header row. The parent handles show/hide animation.

export function ChatSelectionBar({
  selectedCount,
  totalCount,
  onToggleAll,
  onMoveToProject,
  onDelete,
  onCancel,
  className,
  style,
}: ChatSelectionBarProps) {
  const noneSelected = selectedCount === 0
  const allSelected  = selectedCount === totalCount && totalCount > 0

  return (
    <div
      className={cn(className)}
      style={{
        display:    'flex',
        alignItems: 'center',
        gap:        6,
        ...style,
      }}
    >
      {/* Count — plain text, no badge */}
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-body)',
          fontWeight: 400,
          lineHeight: 'var(--line-height-body)',
          color:      noneSelected ? 'var(--neutral-400)' : 'var(--neutral-600)',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          paddingRight: 2,
        }}
      >
        {selectedCount} selected
      </span>

      <ChipButton onClick={onToggleAll}>
        {allSelected ? 'Deselect all' : 'Select all'}
      </ChipButton>

      <ChipButton disabled={noneSelected} onClick={onMoveToProject}>
        Move to project
      </ChipButton>

      <ChipButton danger disabled={noneSelected} onClick={onDelete}>
        Delete
      </ChipButton>

      {/* Divider */}
      <div
        aria-hidden
        style={{
          width:           1,
          height:          18,
          backgroundColor: 'var(--neutral-200)',
          flexShrink:      0,
          margin:          '0 2px',
        }}
      />

      <ChipButton ghost onClick={onCancel}>
        Cancel
      </ChipButton>
    </div>
  )
}

export default ChatSelectionBar
