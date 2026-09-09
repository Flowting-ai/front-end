'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { m, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { PinIcon, MoreHorizontalIcon, PenOneIcon, FolderOneIcon, FolderLibraryIcon, ShareOneIcon, DeleteTwoIcon } from '@strange-huge/icons'
import { Checkbox } from '@/components/Checkbox'
import { Badge } from '@/components/Badge'
import { IconButton } from '@/components/IconButton'
import { Dropdown } from '@/components/Dropdown'
import { Divider } from '@/components/Divider'
import { cn } from '@/lib/utils'

// ── Shadows (Figma exact) ─────────────────────────────────────────────────────

// Chip: rest = ghost ring, elevated (row hovered/focused) = filled with inner highlight
const SHADOW_CHIP_REST     = '0px 0px 0px 1px rgba(59,54,50,0.3)'
const SHADOW_CHIP_ELEVATED = '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(182,172,164,0.4)'
const SHADOW_CHIP_INNER    = 'inset 0px 1px 0px 0px rgba(247,242,237,0.61), inset 0px -1px 0px 0px rgba(106,98,93,0.05)'

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
  /** Whether this chat is starred. */
  starred?: boolean
  /** Called with the new title when user commits an inline rename. */
  onRename?: (title: string) => void
  /** Called when user selects "Share" from the context menu. Omit to hide the item. */
  onShare?: () => void
  /** Called when user toggles pin (starred) from the context menu. */
  onStar?: () => void
  /** Called when user selects "Move to project" from the context menu. Omit to hide the item. */
  onMoveToProject?: () => void
  /** Called when user selects Delete from the context menu. */
  onDelete?: () => void
  /** Empty-state: dashed blue border + glow, descriptive text, no controls. */
  isEmpty?: boolean
  disabled?: boolean
  asChild?: boolean
  /** When true, shows a red "Read only" badge — for shared team chats the viewer doesn't own. */
  readOnly?: boolean
  /** When true, shows a "Scheduled" badge — this chat was started from (or is linked to) a schedule. */
  scheduled?: boolean
  /**
   * When true, shows a neutral "Archived" badge and hides Rename/Star (the
   * backend 403s both on an archived chat — services/chat/router.py's
   * rejectArchivedWrite) and the Archive menu item itself (already
   * archived — there is no unarchive endpoint yet). Delete and Move to
   * project stay available; the backend permits both on an archived chat.
   * Distinct from `readOnly`, which hides the whole menu — an archived
   * chat still gets one, just a reduced one.
   */
  archived?: boolean
  /** Called when user selects Archive from the context menu. Omit to hide the item. */
  onArchive?: () => void
}

// ── PinCountChip ─────────────────────────────────────────────────────────────

interface PinCountChipProps {
  pinCount: number
  pinBoardOpen: boolean
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
        opacity:         pinBoardOpen && !hasPins ? 0.7 : 1,
        transition:      'background-color 120ms, box-shadow 120ms, opacity 120ms',
      }}
    >
      {hasPins && <PinIcon size={16} color="var(--neutral-500)" />}
      {label}

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

interface ThreeDotButtonOwnProps {
  visible: boolean
  title: string
  readOnly?: boolean
}

function ThreeDotButton({ visible, title, readOnly = false, onClick, ref, ...rest }: ThreeDotButtonOwnProps & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'title'> & { ref?: React.Ref<HTMLButtonElement> }) {
  return (
    <span
      style={{
        display:       'inline-flex',
        flexShrink:    0,
        opacity:       visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition:    'opacity 120ms',
      }}
    >
      <IconButton
        ref={ref}
        type="button"
        variant="ghost"
        size="sm"
        tabIndex={-1}
        aria-label={`Options for "${title}"`}
        icon={<MoreHorizontalIcon size={20} />}
        disabled={readOnly}
        // Only stop propagation when there's an onClick to protect. Dropdown.Float
        // (unlike Radix's old asChild trigger) doesn't clone its toggle handler onto
        // this button — it lives on an ANCESTOR wrapper span instead — so when no
        // onClick is passed here, the click must be left alone to bubble up to it.
        onClick={readOnly ? undefined : onClick ? (e) => { e.stopPropagation(); onClick(e) } : undefined}
        {...rest}
      />
    </span>
  )
}

// ── ChatRow ───────────────────────────────────────────────────────────────────

function ChatRowInner(
  {
    title         = '',
    timestamp     = '',
    pinCount      = 0,
    pinBoardOpen  = false,
    onPinClick,
    selectionMode = false,
    selected      = false,
    onSelect,
    starred       = false,
    onRename,
    onShare,
    onStar,
    onMoveToProject,
    onDelete,
    isEmpty       = false,
    disabled      = false,
    asChild       = false,
    readOnly      = false,
    scheduled     = false,
    archived      = false,
    onArchive,
    className,
    style,
    onClick,
    onKeyDown,
    ref,
    ...props
  }: ChatRowProps & { ref?: React.Ref<HTMLDivElement> },
) {
    const Comp = (asChild ? Slot : 'div') as React.ElementType

    const [rowHovered,  setRowHovered]  = useState(false)
    const [rowFocused,  setRowFocused]  = useState(false)
    const [menuOpen,    setMenuOpen]    = useState(false)
    const [isRenaming,  setIsRenaming]  = useState(false)
    const [renameValue, setRenameValue] = useState('')
    const renameInputRef    = useRef<HTMLInputElement>(null)
    // Set in every dropdown Dropdown.Item's onClick — Dropdown.Float portals its
    // panel to document.body, but React still bubbles the click as a SYNTHETIC
    // event up the component tree to this row's own onClick, which would
    // otherwise also navigate to the chat right after Rename/Pin/Move/Delete was
    // selected. The row's onClick checks and resets this to swallow that click.
    const pendingMenuActionRef = useRef(false)
    // Set by Enter/Escape so the blur that follows setIsRenaming(false)
    // (removing the focused input from the DOM) is recognized as DOM cleanup
    // rather than a genuine click-away, and isn't double-handled.
    const renameResolvedRef = useRef(false)

    const resolvedTitle = title || 'Untitled chat'

    const submitRename = useCallback(() => {
      const trimmed = renameValue.trim()
      if (trimmed && trimmed !== resolvedTitle) {
        onRename?.(trimmed)
      }
      setIsRenaming(false)
    }, [renameValue, resolvedTitle, onRename])

    useEffect(() => {
      if (isRenaming && renameInputRef.current) {
        renameResolvedRef.current = false
        // Deferred to a macrotask: Dropdown.Float restores focus to its trigger
        // when the menu closes, and that restoration can land after this same
        // commit's effects run — a plain synchronous focus() here loses that
        // race silently. setTimeout(0) guarantees this runs after that cleanup.
        const id = window.setTimeout(() => {
          renameInputRef.current?.focus()
          renameInputRef.current?.select()
        }, 0)
        return () => window.clearTimeout(id)
      }
    }, [isRenaming])

    const handleRowFocus = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) setRowFocused(true)
    }, [])

    const handleRowBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
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
    // Keep three-dot visible while menu is open (even if mouse moves away)
    const showMenu      = (rowElevated || pinBoardOpen || menuOpen) && !selectionMode && !isEmpty

    // Ghost-button treatment (see Button's `ghost` variant) for bg/hover, plus a
    // persistent 1px border (same color as the list divider) on every row.
    const rowActive = rowElevated || pinBoardOpen
    const bg = isEmpty ? 'transparent' : rowActive ? 'var(--button-ghost-bg-hover)' : 'transparent'

    const rowShadow = isEmpty
      ? undefined
      : rowActive
        ? 'var(--shadow-item-inner), inset 0 0 0 1px var(--divider-color)'
        : 'inset 0 0 0 1px var(--divider-color)'

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
        onFocus={handleRowFocus}
        onBlur={handleRowBlur}
        onClick={
          selectionMode
            ? () => onSelect?.(!selected)
            : (e: React.MouseEvent<HTMLDivElement>) => {
                if (isRenaming || pendingMenuActionRef.current) {
                  pendingMenuActionRef.current = false
                  return
                }
                onClick?.(e)
              }
        }
        onKeyDown={handleKeyDown}
        style={{
          display:         'flex',
          alignItems:      'center',
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
          cursor:          isEmpty ? 'default' : isRenaming ? 'text' : 'pointer',
          userSelect:      'none',
          transition:      'background-color 120ms, box-shadow 150ms',
          ...style,
        }}
        {...props}
      >

        {/* ── Checkbox (selection mode only) ─────────────────────────────── */}
        <AnimatePresence initial={false}>
          {selectionMode && (
            <m.div
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
            </m.div>
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
              {isRenaming ? (
                <input
                  ref={renameInputRef}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => {
                    // Enter/Escape already resolved this rename synchronously — the
                    // blur that follows (input unmounting) is just DOM cleanup, not
                    // a real click-away, so skip it to avoid double-handling.
                    if (renameResolvedRef.current) return
                    renameResolvedRef.current = true
                    setIsRenaming(false)
                    toast.info('Rename cancelled')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter')  { e.preventDefault(); renameResolvedRef.current = true; submitRename() }
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      renameResolvedRef.current = true
                      setIsRenaming(false)
                      toast.info('Rename cancelled')
                    }
                    e.stopPropagation()
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    flex:            '1 1 0',
                    fontFamily:      'var(--font-body)',
                    fontSize:        'var(--font-size-body-lg)',
                    fontWeight:      400,
                    lineHeight:      'var(--line-height-body-lg)',
                    color:           '#1a1714',
                    border:          'none',
                    borderBottom:    '1.5px solid var(--blue-400)',
                    outline:         'none',
                    backgroundColor: 'transparent',
                    padding:         0,
                    minWidth:        0,
                    width:           '100%',
                  }}
                />
              ) : (
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
              )}

              {timestamp && !isRenaming && (
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

            {/* Right controls — read-only badge + three-dot + pin chip */}
            <div
              style={{
                display:    'flex',
                alignItems: 'center',
                gap:        6,
                flexShrink: 0,
              }}
            >
              {starred && !selectionMode && (
                <span aria-label="Pinned" style={{ display: 'inline-flex', flexShrink: 0 }}>
                  <PinIcon size={18} color="var(--color-tag-Yellow-text)" />
                </span>
              )}
              {scheduled && !selectionMode && (
                <Badge color="Purple" label="Scheduled" />
              )}
              {readOnly && !selectionMode && (
                <Badge color="Red" label="Read only" />
              )}
              {archived && !selectionMode && (
                <Badge color="Neutral" label="Archived" />
              )}
              {!selectionMode && !archived && readOnly && (
                <ThreeDotButton visible={showMenu} title={resolvedTitle} readOnly />
              )}
              {!selectionMode && !archived && !readOnly && (
                <Dropdown.Float
                  open={menuOpen}
                  onOpenChange={setMenuOpen}
                  placement="bottom-end"
                  // Rows can sit anywhere in this scrollable, virtualized list — a
                  // row near the bottom of the viewport would otherwise run the
                  // menu off-screen with a fixed placement. Mirrors the sidebar's
                  // FlatChatHistoryItem dropdown.
                  autoFlipVertical
                  trigger={<ThreeDotButton visible={showMenu} title={resolvedTitle} />}
                >
                  <Dropdown>
                    <Dropdown.Section fluid>
                      {onShare && (
                        <Dropdown.Item
                          fluid
                          icon={<ShareOneIcon color="var(--neutral-600)" />}
                          label="Share"
                          onClick={() => { pendingMenuActionRef.current = true; setMenuOpen(false); onShare() }}
                        />
                      )}
                      {!archived && (
                        <Dropdown.Item
                          fluid
                          icon={<PenOneIcon animated color="var(--neutral-600)" />}
                          label="Rename"
                          onClick={() => { pendingMenuActionRef.current = true; setMenuOpen(false); setRenameValue(title); setIsRenaming(true) }}
                        />
                      )}
                      {!archived && (
                        <Dropdown.Item
                          fluid
                          icon={<PinIcon animated color="var(--neutral-600)" />}
                          label={starred ? 'Unpin chat' : 'Pin chat'}
                          onClick={() => { pendingMenuActionRef.current = true; setMenuOpen(false); onStar?.() }}
                        />
                      )}
                      {onMoveToProject && (
                        <Dropdown.Item
                          fluid
                          icon={<FolderOneIcon color="var(--neutral-600)" variant="static" />}
                          label="Move to project"
                          onClick={() => { pendingMenuActionRef.current = true; setMenuOpen(false); onMoveToProject() }}
                        />
                      )}
                      {!archived && onArchive && (
                        <Dropdown.Item
                          fluid
                          icon={<FolderLibraryIcon color="var(--neutral-600)" />}
                          label="Archive"
                          onClick={() => { pendingMenuActionRef.current = true; setMenuOpen(false); onArchive() }}
                        />
                      )}
                      <Divider decorative />
                      <Dropdown.Item
                        fluid
                        variant="danger"
                        icon={<DeleteTwoIcon color="var(--red-500)" />}
                        label="Delete"
                        onClick={() => { pendingMenuActionRef.current = true; setMenuOpen(false); onDelete?.() }}
                      />
                    </Dropdown.Section>
                  </Dropdown>
                </Dropdown.Float>
              )}
              {onPinClick !== undefined && (
                <PinCountChip
                  pinCount={pinCount}
                  pinBoardOpen={pinBoardOpen}
                  rowElevated={rowElevated}
                  title={resolvedTitle}
                  onClick={onPinClick}
                />
              )}
            </div>
          </>
        )}

      </Comp>
    )
}

export const ChatRow = React.memo(ChatRowInner)
ChatRow.displayName = 'ChatRow'
export default ChatRow
