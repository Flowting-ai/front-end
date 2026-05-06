'use client'

import React, { useState } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { AnimatePresence, motion } from 'framer-motion'
import { BookmarkTwoIcon, BookmarkTwoSolidIcon, InformationCircleIcon } from '@strange-huge/icons'
import { LlmIcon } from '@strange-huge/icons/llm'
import { IconButton } from '@/components/IconButton'
import { Tooltip } from '@/components/Tooltip'
import { cn } from '@/lib/utils'

// ── Shadow constants ───────────────────────────────────────────────────────────
// Identical shadow system to DropdownMenuItem — shares the same warm-neutral hover language.

const SHADOW_ACTIVE =
  '0px 1px 1.5px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-300-40)'

const SHADOW_INNER =
  'inset 0px 1px 0px 0px var(--neutral-50-61), inset 0px -1px 0px 0px var(--neutral-600-05)'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ModelSelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Canonical model id — rendered as an `<LlmIcon variant="avatar" size={18} />`
   * inside the 22×22 image slot. This is the **default and preferred** way to
   * supply a model avatar. Look up valid ids in `LLM_AVATAR` from
   * `@strange-huge/icons/llm` (e.g. `"Claude"`, `"OpenAI"`, `"Gemini"`,
   * `"Meta"`, `"Mistral"`, `"Perplexity"`, `"Grok"`, `"DeepSeek"`).
   *
   * If a needed id is missing from the registry, request that it be added to
   * `@strange-huge/icons` — never inline an SVG or fall back to a placeholder.
   */
  llm?: string
  /**
   * Manual override for the image slot — accepts any ReactNode. Use this only
   * when the row is not a model brand covered by `LLM_AVATAR` (custom local
   * model, user upload, etc.). When `llm` and `image` are both set, `image`
   * wins.
   */
  image?: React.ReactNode
  /** Model name label */
  label?: string
  /**
   * Icon slot indicating model capabilities (e.g. text, vision, code, audio).
   * Pass one or more `@strange-huge/icons` components at `size={16}`.
   * The container is aria-hidden — the label carries the accessible name.
   */
  icons?: React.ReactNode
  /**
   * Show the right-edge bookmark `IconButton` (24×24, ghost, `BookmarkTwoIcon`
   * at 18px). Per Figma, the bookmark sits as a sibling to `icons` after the
   * type-indicator strip — present in Default/Hover/Selected. Default `false`.
   */
  bookmark?: boolean
  /**
   * Controlled bookmarked state — when set, the parent owns the toggle. The
   * solid icon (`BookmarkTwoSolidIcon`) renders when `true`, the outline
   * (`BookmarkTwoIcon`) when `false`.
   */
  bookmarked?: boolean
  /** Initial uncontrolled bookmarked state. Defaults to `false`. */
  defaultBookmarked?: boolean
  /** Fires when the user toggles the bookmark. Receives the next state. */
  onBookmarkedChange?: (next: boolean) => void
  /** Optional raw click handler — runs after the toggle. `stopPropagation` is applied automatically. */
  onBookmarkClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  /**
   * Tooltip content shown when the row is hovered (the avatar swaps to an
   * info-circle while hovered — that glyph is the tooltip trigger). When
   * omitted the swap still happens but no tooltip opens.
   */
  info?: React.ReactNode
  /** Persistent selected / active state */
  selected?: boolean
  /** Render as a child element (Radix Slot) — lets you compose with Select.Item, etc. */
  asChild?: boolean
}

// ── Text style ────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  flex:          '1 0 0',
  fontFamily:    'var(--font-body)',
  fontWeight:    'var(--font-weight-medium)',
  fontSize:      '14px',
  lineHeight:    '22px',
  color:         'var(--model-select-item-text)',
  whiteSpace:    'nowrap',
  overflow:      'hidden',
  textOverflow:  'ellipsis',
}

// ── Component ─────────────────────────────────────────────────────────────────

export const ModelSelectItem = React.forwardRef<HTMLDivElement, ModelSelectItemProps>(
  function ModelSelectItem(
    {
      llm,
      image,
      label,
      icons,
      bookmark         = false,
      bookmarked,
      defaultBookmarked = false,
      onBookmarkedChange,
      onBookmarkClick,
      info,
      selected   = false,
      asChild    = false,
      className,
      style,
      onMouseEnter: externalEnter,
      onMouseLeave: externalLeave,
      ...props
    },
    ref,
  ) {
    const [isHovered, setIsHovered] = useState(false)
    const isActive = isHovered || selected

    // Bookmark — controlled vs uncontrolled state. Render the solid icon when on.
    const isBookmarkControlled = bookmarked !== undefined
    const [internalBookmarked, setInternalBookmarked] = useState(defaultBookmarked)
    const isBookmarked = isBookmarkControlled ? !!bookmarked : internalBookmarked

    // Avatar resolution: explicit `image` override > `llm` id > nothing.
    // Per the component's avatar rule, model rows should pass `llm` so the
    // canonical `LlmIcon` avatar renders — `image` exists only as an escape
    // hatch for custom/non-brand rows.
    //
    // The avatar always sits inside an 18×18 wrapper with `border-radius: 5px`
    // and `overflow: hidden` (matching the original Figma design) so square
    // fills (e.g. Anthropic's solid-orange Claude tile) round their corners.
    const resolvedAvatar =
      image ?? (llm ? <LlmIcon id={llm} variant="avatar" size={18} /> : null)
    const resolvedImage = resolvedAvatar ? (
      <span
        style={{
          width:        '18px',
          height:       '18px',
          borderRadius: '5px',
          overflow:     'hidden',
          flexShrink:   0,
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'center',
          lineHeight:   0,
        }}
      >
        {resolvedAvatar}
      </span>
    ) : null

    const Comp = asChild ? Slot : 'div'

    return (
      <Comp
        ref={ref}
        className={cn('kds-model-select-item', className)}
        style={{
          position:        'relative',
          display:         'flex',
          alignItems:      'center',
          gap:             '8px',
          padding:         '6px',
          borderRadius:    '10px',
          overflow:        'hidden',
          backgroundColor: isActive ? 'var(--model-select-item-bg-active)' : 'transparent',
          boxShadow:       isActive ? SHADOW_ACTIVE : 'none',
          cursor:          'pointer',
          userSelect:      'none',
          flexShrink:      0,
          transition:      'background-color 150ms, box-shadow 150ms',
          ...style,
        }}
        onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
          setIsHovered(true)
          externalEnter?.(e)
        }}
        onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
          setIsHovered(false)
          externalLeave?.(e)
        }}
        {...props}
      >
        {/* ── Left section: image + label ── */}
        <div style={{ display: 'flex', flex: '1 0 0', gap: '8px', alignItems: 'center', minWidth: 0 }}>
          {resolvedImage && (
            <div
              aria-hidden
              style={{
                position:        'relative',
                width:           '22px',
                height:          '22px',
                flexShrink:      0,
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
                overflow:        'hidden',
              }}
            >
              {/*
                Hover swaps avatar → info-circle via popLayout cross-fade.
                The Tooltip wraps the entire 22×22 slot once and stays mounted —
                if it conditionally wrapped only the "info" branch, framer's
                popLayout projection would mis-track positions across the
                key-swap and the avatar would slide in from the right instead
                of crossfading in place. Tooltip is `disabled` whenever no
                info content is provided OR the row isn't hovered, so the
                tooltip only opens while the info-circle is visible.
              */}
              <Tooltip
                content={info ?? null}
                side="top"
                disabled={!info || !isHovered}
              >
                <span
                  style={{
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    width:          '100%',
                    height:         '100%',
                    lineHeight:     0,
                  }}
                >
                  <AnimatePresence mode="popLayout" initial={false}>
                    {isHovered ? (
                      <motion.span
                        key="info"
                        initial={{ scale: 0.75, opacity: 0, filter: 'blur(4px)' }}
                        animate={{ scale: 1,    opacity: 1, filter: 'blur(0px)' }}
                        exit={{    scale: 0.75, opacity: 0, filter: 'blur(4px)' }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        style={{
                          display:        'flex',
                          alignItems:     'center',
                          justifyContent: 'center',
                          lineHeight:     0,
                          color:          'var(--model-select-item-icon)',
                        }}
                      >
                        <InformationCircleIcon size={20} />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="image"
                        initial={{ scale: 0.75, opacity: 0, filter: 'blur(4px)' }}
                        animate={{ scale: 1,    opacity: 1, filter: 'blur(0px)' }}
                        exit={{    scale: 0.75, opacity: 0, filter: 'blur(4px)' }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        style={{
                          display:        'flex',
                          alignItems:     'center',
                          justifyContent: 'center',
                          lineHeight:     0,
                        }}
                      >
                        {resolvedImage}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
              </Tooltip>
            </div>
          )}

          <span style={labelStyle}>{label}</span>
        </div>

        {/* ── Right icons slot ── */}
        {icons && (
          <div
            aria-hidden
            style={{
              display:    'flex',
              alignItems: 'center',
              flexShrink: 0,
              gap:        '2px',
              lineHeight: 0,
              color:      'var(--model-select-item-icon)',
            }}
          >
            {icons}
          </div>
        )}

        {/* ── Right bookmark button (built-in, toggleable via `bookmark` prop) ── */}
        {bookmark && (
          <div
            style={{
              display:    'flex',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <IconButton
              size="xs"
              variant="ghost"
              icon={
                /* AnimatePresence popLayout cross-fade between outline ↔ solid.
                   Same in-place glyph-swap pattern as the avatar↔info-circle
                   swap above and the documented text/glyph-swap pattern in
                   `specs/patterns/in-place-text-swap.md`. */
                <span
                  style={{
                    width:          '18px',
                    height:         '18px',
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    lineHeight:     0,
                  }}
                >
                  <AnimatePresence mode="popLayout" initial={false}>
                    {isBookmarked ? (
                      <motion.span
                        key="solid"
                        initial={{ scale: 0.75, opacity: 0, filter: 'blur(4px)' }}
                        animate={{ scale: 1,    opacity: 1, filter: 'blur(0px)' }}
                        exit={{    scale: 0.75, opacity: 0, filter: 'blur(4px)' }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        style={{ display: 'flex', lineHeight: 0 }}
                      >
                        <BookmarkTwoSolidIcon size={18} />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="outline"
                        initial={{ scale: 0.75, opacity: 0, filter: 'blur(4px)' }}
                        animate={{ scale: 1,    opacity: 1, filter: 'blur(0px)' }}
                        exit={{    scale: 0.75, opacity: 0, filter: 'blur(4px)' }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        style={{ display: 'flex', lineHeight: 0 }}
                      >
                        <BookmarkTwoIcon size={18} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
              }
              aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark model'}
              aria-pressed={isBookmarked}
              onClick={(e) => {
                e.stopPropagation()
                const next = !isBookmarked
                if (!isBookmarkControlled) setInternalBookmarked(next)
                onBookmarkedChange?.(next)
                onBookmarkClick?.(e)
              }}
            />
          </div>
        )}

        {/* ── Inner depth shadow — active state ── */}
        {isActive && (
          <div
            aria-hidden
            style={{
              position:      'absolute',
              inset:         0,
              borderRadius:  'inherit',
              pointerEvents: 'none',
              boxShadow:     SHADOW_INNER,
            }}
          />
        )}
      </Comp>
    )
  },
)

ModelSelectItem.displayName = 'ModelSelectItem'

export default ModelSelectItem
