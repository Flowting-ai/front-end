'use client'

import React, { useState, useCallback } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { motion, AnimatePresence } from 'framer-motion'
import { PinIcon, MoreHorizontalIcon } from '@strange-huge/icons'
import { Checkbox } from '@/components/Checkbox'
import { cn } from '@/lib/utils'

// ── Shadows (Figma exact) ─────────────────────────────────────────────────────

const SHADOW_ROW_BASE    = '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 0px var(--neutral-100)'
const SHADOW_ROW_RING    = '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)'
const SHADOW_ROW_FOCUSED = '0px 2px 2.8px 0px var(--blue-600), 0px 0px 0px 1px var(--blue-600)'

// Chip: rest = ghost ring, elevated (row hovered/focused) = filled with inner highlight
const SHADOW_CHIP_REST    = '0px 0px 0px 1px rgba(59,54,50,0.3)'
const SHADOW_CHIP_ELEVATED = '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(182,172,164,0.4)'
const SHADOW_CHIP_INNER   = 'inset 0px 1px 0px 0px rgba(247,242,237,0.61), inset 0px -1px 0px 0px rgba(106,98,93,0.05)'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChatRowProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  /** Chat title — truncated with ellipsis */
  title?: string
  /** Timestamp label — e.g. "3:42 PM" or "Yesterday" */
  timestamp?: string
  /**
   * Number of pins. Controls icon visibility:
   * > 0 → PinIcon + count; 0 → "No pins" text only (no icon).
   */
  pinCount?: number
  /**
   * Whether the pinboard panel is currently open for this row.
   * Drives the white bg "Pin selected" visual state.
   */
  pinBoardOpen?: boolean
  onPinClick?: () => void
  /** Slides in a Checkbox, hides three-dot, sets fixed 62px height. */
  selectionMode?: boolean
  selected?: boolean
  onSelect?: (checked: boolean) => void
  /** Stub — parent handles opening the context menu */
  onMenuClick?: React.MouseEventHandler<HTMLButtonElement>
  /** Empty-state: dashed blue border + glow, descriptive text, no controls. */
  isEmpty?: boolean
  disabled?: boolean
  asChild?: boolean
}

// ── PinCountChip ─────────────────────────────────────────────────────────────
// Icon rule: show PinIcon only when pinCount > 0.
// Style rule: chip style is driven by the ROW's hover/focus state, not its own.

interface PinCountChipProps {
  pinCount: number
  pinBoardOpen: boolean
  /** True when parent row is hovered or keyboard-focused — chip elevates to match */
  rowElevated: boolean
  title: string
  onClick?: () => void
}

function PinCountChip({ pinCount, pinBoardOpen, rowElevated, title, onClick }: PinCountChipProps) {
  const [focused, setFocused] = useState(false)

  const hasPins  = pinCount > 0
  const label    = hasPins ? `${pinCount} ${pinCount === 1 ? 'pin' : 'pins'}` : 'No pins'
  const elevated = rowElevated || focused

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick?.() }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      tabIndex={-1}
      aria-label={`${label} in "${title}". ${pinBoardOpen ? 'Close' : 'Open'} pinboard.`}
      aria-pressed={pinBoardOpen}
      style={{
        position:        'relative',
        display:         'inline-flex',
        alignItems:      'center',
        gap:             hasPins ? 4 : 0,
        padding:         '5px 8px',
        borderRadius:    8,
        border:          'none',
        backgroundColor: elevated ? 'rgba(237,225,215,0.6)' : 'rgba(255,255,255,0)',
        cursor:          'pointer',
        fontFamily:      'var(--font-body)',
        fontSize:        'var(--font-size-body)',
        fontWeight:      500,
        lineHeight:      'var(--line-height-body)',
        color:           'var(--neutral-700)',
        boxShadow:       elevated ? SHADOW_CHIP_ELEVATED : SHADOW_CHIP_REST,
        flexShrink:      0,
        whiteSpace:      'nowrap',
        outline:         focused ? '2px solid var(--blue-400)' : 'none',
        outlineOffset:   2,
        // De-emphasise when pinboard is open with 0 pins
        opacity:         pinBoardOpen && !hasPins ? 0.7 : 1,
        transition:      'background-color 120ms, box-shadow 120ms, opacity 120ms',
      }}
    >
      {/* PinIcon only when there are pins — regardless of pinBoardOpen state */}
      {hasPins && <PinIcon size={16} color="var(--neutral-500)" />}
      {label}

      {/* Inset highlight — appears when elevated (row hovered/focused) */}
      {elevated && (
        <div
          aria-hidden
          style={{
            position:      'absolute',
            inset:         0,
            borderRadius:  8,
            boxShadow:     SHADOW_CHIP_INNER,
            pointerEvents: 'none',
          }}
        />
      )}
    </button>
  )
}

// ── ThreeDotButton ────────────────────────────────────────────────────────────

interface ThreeDotButtonProps {
  visible: boolean
  title: string
  onClick?: React.MouseEventHandler<HTMLButtonElement>
}

function ThreeDotButton({ visible, title, onClick }: ThreeDotButtonProps) {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick?.(e) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      aria-label={`Options for "${title}"`}
      tabIndex={-1}
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         6,
        borderRadius:    8,
        border:          'none',
        backgroundColor: hovered ? 'rgba(237,225,215,0.6)' : 'transparent',
        cursor:          'pointer',
        outline:         focused ? '2px solid var(--blue-400)' : 'none',
        outlineOffset:   2,
        flexShrink:      0,
        opacity:         visible ? 1 : 0,
        pointerEvents:   visible ? 'auto' : 'none',
        transition:      'opacity 120ms, background-color 120ms',
      }}
    >
      <MoreHorizontalIcon size={20} color="var(--neutral-600)" />
    </button>
  )
}

// ── ChatRow ───────────────────────────────────────────────────────────────────

export const ChatRow = React.forwardRef<HTMLDivElement, ChatRowProps>(
  function ChatRow(
    {
      title         = '',
      timestamp     = '',
      pinCount      = 0,
      pinBoardOpen  = false,
      onPinClick,
      selectionMode = false,
      selected      = false,
      onSelect,
      onMenuClick,
      isEmpty       = false,
      disabled      = false,
      asChild       = false,
      className,
      style,
      onClick,
      onKeyDown,
      ...props
    },
    ref,
  ) {
    const Comp = (asChild ? Slot : 'div') as React.ElementType

    const [rowHovered, setRowHovered] = useState(false)
    const [rowFocused, setRowFocused] = useState(false)

    const handleFocus = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) setRowFocused(true)
    }, [])

    const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setRowFocused(false)
    }, [])

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
        e.preventDefault()
        if (selectionMode) {
          onSelect?.(!selected)
        } else {
          onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>)
        }
      }
      onKeyDown?.(e)
    }, [selectionMode, selected, onSelect, onClick, onKeyDown])

    // ── Visual state ──────────────────────────────────────────────────────────
    const isInteractive = !isEmpty && !disabled
    const isHovered     = rowHovered && isInteractive && !selectionMode
    const isFocused     = rowFocused && isInteractive && !selectionMode
    const rowElevated   = isHovered || isFocused
    const showMenu      = (rowElevated || pinBoardOpen) && !selectionMode && !isEmpty

    // Figma bg by state:
    // Default → transparent | Hover/Focused → neutral-100 | Pin-selected → white
    const bg = isEmpty || (!rowElevated && !pinBoardOpen)
      ? 'transparent'
      : pinBoardOpen && !rowElevated
        ? 'var(--neutral-white)'
        : 'var(--neutral-100)'

    const rowShadow = isEmpty
      ? undefined
      : isFocused
        ? SHADOW_ROW_FOCUSED
        : rowElevated || pinBoardOpen
          ? SHADOW_ROW_RING
          : SHADOW_ROW_BASE

    const resolvedTitle = title || 'Untitled chat'

    return (
      <Comp
        ref={ref}
        className={cn(className)}
        role={selectionMode ? 'checkbox' : isEmpty ? undefined : 'button'}
        aria-label={isEmpty ? undefined : resolvedTitle}
        aria-checked={selectionMode ? selected : undefined}
        tabIndex={isEmpty ? undefined : 0}
        onMouseEnter={() => setRowHovered(true)}
        onMouseLeave={() => setRowHovered(false)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onClick={selectionMode ? () => onSelect?.(!selected) : onClick}
        onKeyDown={handleKeyDown}
        style={{
          display:         'flex',
          alignItems:      'center',
          // Figma: px-16 py-12 for normal; h-62 px-6 for selection
          padding:         selectionMode ? '0 16px 0 6px' : '12px 16px',
          height:          selectionMode ? 62 : undefined,
          borderRadius:    12,
          boxSizing:       'border-box',
          width:           '100%',
          backgroundColor: bg,
          boxShadow:       rowShadow,
          outline:         isFocused
            ? '1px solid var(--blue-400)'
            : isEmpty
              ? '1.5px dashed var(--blue-400)'
              : 'none',
          outlineOffset:   -1,
          opacity:         disabled ? 0.5 : 1,
          pointerEvents:   disabled ? 'none' : undefined,
          cursor:          isEmpty ? 'default' : 'pointer',
          userSelect:      'none',
          transition:      'background-color 120ms, box-shadow 150ms',
          ...style,
        }}
        {...props}
      >

        {/* ── Checkbox (selection mode only) ─────────────────────────────── */}
        {/* No width animation — avoids clipping the checkbox ring shadow.     */}
        {/* Animate opacity + x only; layout shifts naturally on mode toggle.  */}
        <AnimatePresence initial={false}>
          {selectionMode && (
            <motion.div
              key="checkbox"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              style={{ flexShrink: 0, marginRight: 9 }}
              onClick={(e) => e.stopPropagation()}
            >
              <Checkbox
                checked={selected}
                onCheckedChange={(v) => onSelect?.(v === true)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Empty state ────────────────────────────────────────────────── */}
        {isEmpty && (
          <p
            style={{
              flex:         '1 1 0',
              fontFamily:   'var(--font-body)',
              fontSize:     'var(--font-size-body)',
              fontWeight:   400,
              lineHeight:   'var(--line-height-body)',
              color:        'var(--neutral-500)',
              margin:       0,
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}
          >
            Start a chat to keep conversations organized and re-use project knowledge.
          </p>
        )}

        {/* ── Normal content ─────────────────────────────────────────────── */}
        {!isEmpty && (
          <>
            {/* Title + timestamp — left column, flex-1 */}
            <div
              style={{
                flex:          '1 1 0',
                display:       'flex',
                flexDirection: 'column',
                gap:           6,
                minWidth:      0,
              }}
            >
              <p
                style={{
                  fontFamily:   'var(--font-body)',
                  fontSize:     'var(--font-size-body-lg)',
                  fontWeight:   400,
                  lineHeight:   'var(--line-height-body-lg)',
                  color:        '#1a1714',
                  overflow:     'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace:   'nowrap',
                  margin:       0,
                }}
              >
                {resolvedTitle}
              </p>

              {timestamp && (
                <p
                  style={{
                    fontFamily:   'var(--font-body)',
                    fontSize:     'var(--font-size-caption)',
                    fontWeight:   400,
                    lineHeight:   'var(--line-height-caption)',
                    color:        '#a39b95',
                    overflow:     'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace:   'nowrap',
                    margin:       0,
                  }}
                >
                  {timestamp}
                </p>
              )}
            </div>

            {/* Right controls — three-dot + pin chip */}
            <div
              style={{
                display:    'flex',
                alignItems: 'center',
                gap:        6,
                flexShrink: 0,
              }}
            >
              {!selectionMode && (
                <ThreeDotButton
                  visible={showMenu}
                  title={resolvedTitle}
                  onClick={onMenuClick}
                />
              )}
              <PinCountChip
                pinCount={pinCount}
                pinBoardOpen={pinBoardOpen}
                rowElevated={rowElevated}
                title={resolvedTitle}
                onClick={onPinClick}
              />
            </div>
          </>
        )}

      </Comp>
    )
  },
)

ChatRow.displayName = 'ChatRow'
export default ChatRow
