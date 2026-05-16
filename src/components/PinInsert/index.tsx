'use client'

/**
 * PinInsert - single row inside the @-mention pin-insertion listbox.
 *
 * Mirrors Figma `3193:6740` exactly. The variant matrix is `type × hover ×
 * highlight` (8 cells). Use `<PinInsert>` inside a parent `role="listbox"`
 * surface - the parent owns keyboard navigation, focused-index state, and
 * the listbox `aria-activedescendant` wiring. This component is `role="option"`,
 * non-tabbable (`tabIndex={-1}`), and reflects its keyboard-focused state
 * via `aria-selected={isFocused}` so screen readers announce the active
 * row as the parent moves focus.
 *
 * The Figma `highlight` prop lights up when the user is searching - the
 * substring of `title` that matches `searchQuery` is wrapped in a `<mark>`
 * with `var(--blue-600)` background and white text. Pass `highlight=true`
 * whenever there's an active query (for example: while the user is typing
 * after `@` in `ChatInput`). Without `searchQuery`, no highlight renders
 * even when `highlight=true`.
 */

import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PlusSignIcon } from '@strange-huge/icons'
import { Badge, type BadgeColor } from '@/components/Badge'
import { IconButton } from '@/components/IconButton'
import { springs } from '@/lib/springs'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PinTag {
  label: string
  color: BadgeColor
}

/**
 * Maps to Figma's `type` variant.
 *  - `'with-badges'`   → bottom row renders the `tags` array as `Badge` chips.
 *  - `'with-subtitle'` → bottom row renders `subtitle` as a single-line caption.
 */
export type PinInsertType = 'with-badges' | 'with-subtitle'

export interface PinInsertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'aria-selected'> {
  /** The pin's title - top line of the row. */
  title: string

  /** Layout variant - Figma `type`. Defaults to `'with-badges'`. */
  type?: PinInsertType

  /** Tags shown as `Badge` chips when `type='with-badges'`. */
  tags?: PinTag[]

  /** Caption text shown when `type='with-subtitle'`. */
  subtitle?: string

  /**
   * Forces the hover visual state - Figma `hover`. When omitted, the
   * component derives it from internal mouse hover OR `isFocused`.
   * Pass explicitly to lock the variant for stories or design-system docs.
   */
  hover?: boolean

  /**
   * Forces the title-highlight visual state - Figma `highlight`. When
   * `true` AND `searchQuery` is non-empty, the matched substring is
   * wrapped in a `<mark>` with `--blue-600` background and white text.
   * Without `searchQuery`, no highlight is drawn even when `highlight=true`.
   */
  highlight?: boolean

  /**
   * The active search query - drives the `<mark>` placement when
   * `highlight=true`. Typically the text the user has typed after `@`
   * in the chat input.
   */
  searchQuery?: string

  /**
   * Keyboard-driven selection - applies hover styles without mouse hover
   * and reflects via `aria-selected` so screen readers announce this row
   * as the active option.
   */
  isFocused?: boolean

  /** Click / Enter / Space - fires when this pin is selected. */
  onAdd?: () => void
}

// ── Highlight helper ──────────────────────────────────────────────────────────

const MARK_STYLE: React.CSSProperties = {
  backgroundColor: 'var(--blue-600)',
  color:           'var(--neutral-white)',
  borderRadius:    '4px',
  padding:         '0 2px',
  fontStyle:       'normal',
}

function HighlightedTitle({ text, query }: { text: string; query: string }) {
  const q = query.trim()
  if (!q) return <>{text}</>
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark style={MARK_STYLE}>{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export const PinInsert = React.forwardRef<HTMLDivElement, PinInsertProps>(
  function PinInsert(
    {
      title,
      type = 'with-badges',
      tags = [],
      subtitle,
      hover,
      highlight = false,
      searchQuery = '',
      isFocused = false,
      onAdd,
      onClick,
      onKeyDown,
      onMouseEnter,
      onMouseLeave,
      className,
      style,
      ...props
    },
    ref,
  ) {
    const [hovered, setHovered] = React.useState(false)

    // When the controlled `hover` prop is undefined, derive from internal
    // pointer hover OR keyboard focus. `isFocused` and mouse hover both
    // produce the same visual - the row is "active".
    const isActive = hover ?? (hovered || isFocused)

    const showSubtitle = type === 'with-subtitle'
    const showBadges   = type === 'with-badges' && tags.length > 0

    function handleClick(e: React.MouseEvent<HTMLDivElement>) {
      onAdd?.()
      onClick?.(e)
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onAdd?.()
      }
      onKeyDown?.(e)
    }

    return (
      <div
        ref={ref}
        role="option"
        aria-selected={isFocused}
        tabIndex={-1}
        className={cn(className)}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onMouseEnter={(e) => { setHovered(true);  onMouseEnter?.(e) }}
        onMouseLeave={(e) => { setHovered(false); onMouseLeave?.(e) }}
        style={{
          position:        'relative',
          display:         'flex',
          alignItems:      'center',
          gap:             '12px',
          padding:         '8px',
          borderRadius:    '10px',
          cursor:          'pointer',
          backgroundColor: 'var(--neutral-white)',
          // Figma hover variant - outer drop + 1 px warm border ring.
          // Tokens: --neutral-700-12 (drop), --neutral-300-40 (ring).
          boxShadow: isActive
            ? '0px 1px 1.5px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-300-40)'
            : 'none',
          // overflow-clip is required so the absolute hover overlays
          // never bleed past the rounded corners.
          overflow: 'hidden',
          ...style,
        }}
        {...props}
      >
        {/* Hover background overlay - Figma 3193:6741 (`bg-[rgba(237,225,215,0.6)]`). */}
        {isActive && (
          <div
            aria-hidden
            style={{
              position:        'absolute',
              inset:           0,
              pointerEvents:   'none',
              borderRadius:    'inherit',
              backgroundColor: 'var(--neutral-100-60)',
            }}
          />
        )}

        {/* ── Content column (Figma "AL") ─────────────────────────────────── */}
        <div
          style={{
            position:      'relative',
            display:       'flex',
            flexDirection: 'column',
            flex:          '1 0 0',
            minWidth:      1,
            gap:           '4px',
            alignItems:    'flex-start',
          }}
        >
          {/* Title */}
          <p
            style={{
              width:        '100%',
              margin:       0,
              fontFamily:   'var(--font-body)',
              fontWeight:   'var(--font-weight-medium)',
              fontSize:     'var(--font-size-body)',
              lineHeight:   'var(--line-height-body)',
              color:        'var(--neutral-900)',
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}
          >
            {highlight && searchQuery.trim().length > 0
              ? <HighlightedTitle text={title} query={searchQuery} />
              : title}
          </p>

          {/* Bottom row - badges OR subtitle */}
          {showBadges && (
            <div
              style={{
                display:    'flex',
                alignItems: 'center',
                gap:        '6px',
                width:      '100%',
              }}
            >
              {tags.map((tag) => (
                <Badge key={tag.label} label={tag.label} color={tag.color} />
              ))}
            </div>
          )}

          {showSubtitle && subtitle && (
            <p
              style={{
                width:        '100%',
                margin:       0,
                fontFamily:   'var(--font-body)',
                fontWeight:   'var(--font-weight-regular)',
                fontSize:     'var(--font-size-caption)',
                lineHeight:   'var(--line-height-caption)',
                color:        'var(--neutral-900)',
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                whiteSpace:   'nowrap',
              }}
            >
              {subtitle}
            </p>
          )}
        </div>

        {/* ── + IconButton - visible on hover/focus ───────────────────────────
             KDS IconButton (variant=ghost size=sm → 32×32, 8 px radius).
             Visual-only: row click owns selection so the button is hidden
             from screen readers (`aria-hidden`), removed from the tab order
             (`tabIndex=-1`), and has `pointer-events: none` so clicks pass
             through to the row. */}
        <AnimatePresence initial={false}>
          {isActive && (
            <motion.span
              key="add-icon"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1   }}
              exit={{    opacity: 0, scale: 0.7 }}
              transition={springs.fast}
              aria-hidden
              style={{
                position:      'relative',
                display:       'inline-flex',
                flexShrink:    0,
                pointerEvents: 'none',
              }}
            >
              <IconButton
                aria-label="Add pin"
                aria-hidden
                tabIndex={-1}
                variant="ghost"
                size="sm"
                icon={<PlusSignIcon />}
              />
            </motion.span>
          )}
        </AnimatePresence>

        {/* Inner shadow overlay - Figma hover state inset highlight + depth. */}
        {isActive && (
          <div
            aria-hidden
            style={{
              position:      'absolute',
              inset:         0,
              pointerEvents: 'none',
              borderRadius:  'inherit',
              // Tokens: --neutral-50-61 (top highlight), --neutral-600-05 (bottom depth).
              boxShadow:
                'inset 0px 1px 0px 0px var(--neutral-50-61), inset 0px -1px 0px 0px var(--neutral-600-05)',
            }}
          />
        )}
      </div>
    )
  },
)

PinInsert.displayName = 'PinInsert'

export default PinInsert
