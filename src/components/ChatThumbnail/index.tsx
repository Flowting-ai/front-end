'use client'

/**
 * ChatThumbnail - 120×120 attachment card rendered above the `ChatInput`
 * textarea (in the `pinCards` slot). Mirrors Figma `3207:33563` and the
 * spec sheet at `3406:1400`.
 *
 * Four `type` variants:
 *   pin    - 16 px radius, white surface, Caption/11 title, neutral pin-icon badge
 *   folder - 16 px radius, white surface, Body/14 title, neutral folder-icon badge
 *   file   - 18 px radius, white surface, Caption/11 filename (fixed 68 px), file-type Badge
 *   image  - 18 px radius, image cover, Neutral Badge with format + size at bottom
 *
 * Hover state surfaces a × IconButton positioned at top-right (overflows the
 * card); driven by `hover` (controlled) or internal mouse hover / button focus.
 */

import * as React from 'react'
import { motion } from 'framer-motion'
import { CancelOneIcon, FolderOneIcon, PinIcon } from '@strange-huge/icons'
import { Badge, type BadgeColor } from '@/components/Badge'
import { springs } from '@/lib/springs'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ChatThumbnailType = 'pin' | 'file' | 'image' | 'folder'

export interface ChatThumbnailProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Variant - Figma `type`. */
  type: ChatThumbnailType

  /**
   * Top-line text. Required for all types:
   *  - `pin` / `folder` - title rendered in the card
   *  - `file` - filename (with extension); the extension drives the badge color
   *  - `image` - descriptive name (used as default `imageAlt` if none provided)
   */
  title: string

  /** File / Image - formatted size string (e.g. `"1.2 MB"`) appended after the format in the badge. */
  fileSize?: string

  /** Image - format label shown before the size in the badge (e.g. `"PNG"`). Defaults to `"IMG"`. */
  imageFormat?: string

  /** Image - src URL. */
  imageSrc?: string

  /** Image - alt text. Defaults to `title`. */
  imageAlt?: string

  /**
   * Forces the hover visual - Figma `hover`. When omitted, the component
   * derives it from internal mouse hover OR remove-button keyboard focus.
   */
  hover?: boolean

  /**
   * When provided, renders a × remove button at the top-right corner. The
   * button is in the DOM whenever `onRemove` is set so keyboard users can
   * always reach it; it's invisible-but-focusable at rest and animates to
   * visible on hover or focus.
   */
  onRemove?: React.MouseEventHandler<HTMLButtonElement>
}

// ── File extension → badge color ──────────────────────────────────────────────

const FILE_EXT_COLOR: Record<string, BadgeColor> = {
  pdf:  'Red',
  docx: 'Blue',
  doc:  'Blue',
  txt:  'Neutral',
  xls:  'Green',
  xlsx: 'Green',
  csv:  'Green',
  ppt:  'Brown',
  pptx: 'Brown',
  html: 'Neutral',
  htm:  'Neutral',
  md:   'Neutral',
  json: 'Neutral',
}

function extractFileExt(fileName: string): { ext: string; color: BadgeColor } {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  return {
    ext:   ext.toUpperCase() || 'FILE',
    color: FILE_EXT_COLOR[ext] ?? 'Neutral',
  }
}

// ── Card-level shadow (Figma 3207:33563 `Event` node) ─────────────────────────
// `0px 4px 4px 0px rgba(82,75,71,0.12)` (= --neutral-700-12) +
// `0px 0px 0px 1px var(--neutral-100)`.

const CARD_SHADOW =
  '0px 4px 4px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-100)'

// ── IconBadge ─────────────────────────────────────────────────────────────────
// Small Neutral-tinted chip used for the pin / folder badge at the bottom of
// the card. Matches the Neutral KDS color-tag (background, outer + inner
// shadows) but contains a 20×20 icon glyph instead of a text label.

function IconBadge({
  icon,
  ariaLabel,
}: {
  icon: React.ReactNode
  ariaLabel: string
}) {
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      style={{
        position:        'relative',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         2,
        borderRadius:    6,
        flexShrink:      0,
        backgroundColor: 'var(--color-tag-Neutral-bg)',
        boxShadow:       'var(--color-tag-Neutral-shadow)',
        color:           'var(--color-tag-Neutral-text)',
      }}
    >
      <div style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <div
        aria-hidden
        style={{
          position:      'absolute',
          inset:         0,
          pointerEvents: 'none',
          borderRadius:  'inherit',
          boxShadow:     'var(--color-tag-Neutral-inner-shadow)',
        }}
      />
    </div>
  )
}

// ── Remove button ─────────────────────────────────────────────────────────────
// 28×28 (4 px padding + 20 px icon) - borrows the `IconButton variant="secondary"`
// shadow stack and white surface. Always in the DOM when `onRemove` is set so
// keyboard users can always Tab to it; invisible-but-focusable at rest.

function RemoveButton({
  onRemove,
  title,
  show,
  onFocusChange,
}: {
  onRemove: React.MouseEventHandler<HTMLButtonElement>
  title: string
  show: boolean
  onFocusChange: (focused: boolean) => void
}) {
  const [isFocused, setIsFocused] = React.useState(false)

  return (
    <motion.button
      type="button"
      aria-label={`Remove "${title}"`}
      onClick={onRemove}
      tabIndex={0}
      onFocus={(e) => {
        // Pattern 2 - only show the focus ring when focus arrived via keyboard.
        if (typeof e.target.matches === 'function' && e.target.matches(':focus-visible')) {
          setIsFocused(true)
          onFocusChange(true)
        }
      }}
      onBlur={() => { setIsFocused(false); onFocusChange(false) }}
      animate={{ opacity: show ? 1 : 0, scale: show ? 1 : 0.7 }}
      transition={springs.fast}
      style={{
        position:        'absolute',
        top:             -10,
        left:            102,
        width:           28,
        height:          28,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         4,
        borderRadius:    8,
        border:          'none',
        cursor:          'pointer',
        backgroundColor: 'var(--neutral-white)',
        color:           'var(--icon-button-secondary-icon)',
        boxShadow:       'var(--shadow-button-secondary-outer), var(--shadow-button-secondary-inner)',
        outlineStyle:    'solid',
        outlineWidth:    '2px',
        outlineOffset:   '2px',
        outlineColor:    isFocused ? 'var(--focus-ring)' : 'transparent',
        transition:      'outline-color 150ms',
        zIndex:          2,
      }}
    >
      <CancelOneIcon size={20} color="currentColor" />
    </motion.button>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export const ChatThumbnail = React.forwardRef<HTMLDivElement, ChatThumbnailProps>(
  function ChatThumbnail(
    {
      type,
      title,
      fileSize,
      imageFormat = 'IMG',
      imageSrc,
      imageAlt,
      hover,
      onRemove,
      className,
      style,
      onMouseEnter,
      onMouseLeave,
      ...props
    },
    ref,
  ) {
    const [hovered,             setHovered]             = React.useState(false)
    const [removeButtonFocused, setRemoveButtonFocused] = React.useState(false)

    const isActive   = hover ?? (hovered || removeButtonFocused)
    const showRemove = isActive && onRemove !== undefined

    return (
      <motion.div
        ref={ref}
        layout
        // Enter - scale up + de-blur (220 ms ease-out cubic)
        // Exit  - scale down + fade out + blur out (180 ms ease-in cubic)
        // The wrapper's `layout` prop makes sibling thumbnails reflow as
        // one is removed, so the exit animation sits cleanly on top of
        // the row's collapse.
        initial={{ opacity: 0, scale: 0.7, filter: 'blur(4px)' }}
        animate={{
          opacity: 1, scale: 1, filter: 'blur(0px)',
          transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
        }}
        exit={{
          opacity: 0, scale: 0.7, filter: 'blur(4px)',
          transition: { duration: 0.18, ease: [0.55, 0.085, 0.68, 0.53] },
        }}
        className={cn(className)}
        onMouseEnter={(e) => { setHovered(true);  onMouseEnter?.(e) }}
        onMouseLeave={(e) => { setHovered(false); onMouseLeave?.(e) }}
        style={{ position: 'relative', display: 'inline-flex', flexShrink: 0, ...style }}
        {...(props as Record<string, unknown>)}
      >
        {/* ── Pin / Folder card ─────────────────────────────────────────────── */}
        {(type === 'pin' || type === 'folder') && (
          <div
            style={{
              position:        'relative',
              width:           120,
              height:          120,
              flexShrink:      0,
              display:         'flex',
              padding:         12,
              borderRadius:    16,
              overflow:        'hidden',
              backgroundColor: 'var(--neutral-white)',
              boxShadow:       CARD_SHADOW,
            }}
          >
            <div
              style={{
                display:       'flex',
                flexDirection: 'column',
                flex:          '1 0 0',
                minWidth:      1,
                height:        '100%',
                gap:           10,
                alignItems:    'flex-start',
              }}
            >
              <p
                style={{
                  flex:         '1 0 0',
                  minHeight:    1,
                  width:        '100%',
                  margin:       0,
                  fontFamily:   'var(--font-body)',
                  fontWeight:   'var(--font-weight-medium)',
                  fontSize:     'var(--font-size-body)',
                  lineHeight:   'var(--line-height-body)',
                  color:        'var(--neutral-900)',
                  overflow:     'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {title}
              </p>
              {type === 'pin'    && <IconBadge icon={<PinIcon       size={20} color="currentColor" />} ariaLabel="Pin"    />}
              {type === 'folder' && <IconBadge icon={<FolderOneIcon variant="static" size={20} color="currentColor" />} ariaLabel="Folder" />}
            </div>
          </div>
        )}

        {/* ── File card ─────────────────────────────────────────────────────── */}
        {type === 'file' && (() => {
          const { ext, color } = extractFileExt(title)
          const badgeLabel = fileSize ? `${ext} • ${fileSize}` : ext
          return (
            <div
              style={{
                position:        'relative',
                width:           120,
                height:          120,
                flexShrink:      0,
                display:         'flex',
                flexDirection:   'column',
                justifyContent:  'center',
                padding:         12,
                borderRadius:    18,
                overflow:        'hidden',
                backgroundColor: 'var(--neutral-white)',
                boxShadow:       CARD_SHADOW,
              }}
            >
              <div
                style={{
                  display:       'flex',
                  flexDirection: 'column',
                  gap:           8,
                  width:         96,
                  flexShrink:    0,
                }}
              >
                <p
                  style={{
                    width:        96,
                    height:       68,
                    flexShrink:   0,
                    margin:       0,
                    fontFamily:   'var(--font-body)',
                    fontWeight:   'var(--font-weight-medium)',
                    fontSize:     'var(--font-size-body)',
                    lineHeight:   'var(--line-height-body)',
                    color:        'var(--neutral-900)',
                    overflow:     'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {title}
                </p>
                <div style={{ display: 'flex', alignItems: 'flex-start', flexShrink: 0 }}>
                  <Badge label={badgeLabel} color={color} />
                </div>
              </div>
            </div>
          )
        })()}

        {/* ── Image card ────────────────────────────────────────────────────── */}
        {type === 'image' && (() => {
          const badgeLabel = fileSize ? `${imageFormat} • ${fileSize}` : imageFormat
          return (
            <div
              style={{
                position:        'relative',
                width:           120,
                height:          120,
                flexShrink:      0,
                display:         'flex',
                flexDirection:   'column',
                justifyContent:  'flex-end',
                padding:         12,
                borderRadius:    18,
                overflow:        'hidden',
                backgroundColor: 'var(--neutral-white)',
                boxShadow:       CARD_SHADOW,
              }}
            >
              {imageSrc && (
                <img
                  src={imageSrc}
                  alt={imageAlt ?? title}
                  style={{
                    position:     'absolute',
                    inset:        0,
                    width:        '100%',
                    height:       '100%',
                    objectFit:    'cover',
                    display:      'block',
                  }}
                />
              )}
              {/* Bottom-left badge sits above the cover image */}
              <div
                style={{
                  position:    'relative',
                  display:     'flex',
                  alignItems:  'flex-start',
                  flexShrink:  0,
                }}
              >
                <Badge label={badgeLabel} color="Neutral" />
              </div>
            </div>
          )
        })()}

        {/* ── × remove button ───────────────────────────────────────────────── */}
        {onRemove && (
          <RemoveButton
            onRemove={onRemove}
            title={title}
            show={showRemove}
            onFocusChange={setRemoveButtonFocused}
          />
        )}
      </motion.div>
    )
  },
)

ChatThumbnail.displayName = 'ChatThumbnail'
export default ChatThumbnail
