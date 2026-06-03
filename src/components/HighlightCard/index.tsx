'use client'

import React, { useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { CopyOneIcon, MessagePreviewOneIcon, CancelCircleIcon } from '@strange-huge/icons'
import { Tooltip } from '@/components/Tooltip'
import { springs } from '@/lib/springs'
import { cn } from '@/lib/utils'

// ── Color variants ─────────────────────────────────────────────────────────────
// Auto-assigned by index (highlights.length % 4) - never set by the user.
// fold is the -200 / -300 step of the same hue, used for the dog-ear triangle.

export const HIGHLIGHT_COLORS = [
  { key: 'sand',     bg: 'var(--yellow-100)', fold: 'var(--yellow-200)' },
  { key: 'lavender', bg: 'var(--purple-200)', fold: 'var(--purple-300)' },
  { key: 'sky',      bg: 'var(--blue-100)',   fold: 'var(--blue-200)'   },
  { key: 'sage',     bg: 'var(--green-100)',  fold: 'var(--green-200)'  },
] as const

export type HighlightColorIndex = 0 | 1 | 2 | 3

// ── Shadow constants ───────────────────────────────────────────────────────────
// No 1px ring - the ring creates a hard right-angle at the bottom-left (BL radius = 0)
// that conflicts with the diagonal dog-ear edge. Soft blur only.

const SHADOW_REST  = '0px 1px 3px 0px rgba(59,54,50,0.10), 0px 2px 8px 0px rgba(59,54,50,0.06)'
const SHADOW_HOVER = '0px 6px 16px 0px rgba(59,54,50,0.14), 0px 2px 6px 0px rgba(59,54,50,0.08)'

// ── Internal action button ─────────────────────────────────────────────────────

function ActionButton({ icon, label, onClick, ref, ...rest }: {
  icon:    React.ReactNode
  label:   string
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  ref?:    React.Ref<HTMLButtonElement>
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      ref={ref}
      type="button"
      className="kds-highlight-action"
      aria-label={label}
      // Spread Radix-injected props first (onPointerEnter, onPointerLeave, onFocus,
      // onBlur, data-state…) so TooltipTrigger asChild can control open/close state.
      {...rest}
      // Our handlers override anything in rest that would conflict.
      onClick={e => { e.stopPropagation(); onClick(e) }}
      onMouseEnter={(e) => { setHovered(true);  rest.onMouseEnter?.(e) }}
      onMouseLeave={(e) => { setHovered(false); rest.onMouseLeave?.(e) }}
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        justifyContent:  'center',
        width:           28,
        height:          28,
        padding:         0,
        border:          'none',
        borderRadius:    8,
        backgroundColor: hovered ? 'var(--color-interactive-subtle-surface-hover)' : 'transparent',
        color:           hovered ? 'var(--neutral-700)' : 'var(--neutral-500)',
        cursor:          'pointer',
        transition:      'background-color 100ms, color 100ms',
        flexShrink:      0,
      }}
    >
      {icon}
    </button>
  )
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface HighlightCardProps {
  /** The highlighted excerpt. Renders in full - never truncated by the card. Max 280 chars enforced by caller. */
  text:        string
  /** Color index 0–3. Auto-assigned by HighlightPanel as `highlights.indexOf(h) % 4`. Never set manually. */
  colorIndex?: HighlightColorIndex
  /** Called when "Jump to source" is clicked. Omit to hide the action button. */
  onJump?:     () => void
  /** Called when "Copy" is clicked. Omit to hide the action button. */
  onCopy?:     () => void
  /** Called when "Delete" is clicked. Omit to hide the action button. */
  onDelete?:   () => void
  /** Extra classes applied to the outer card element. */
  className?:  string
}

// ── Component ──────────────────────────────────────────────────────────────────

export function HighlightCard({
  text,
  colorIndex = 0,
  onJump,
  onCopy,
  onDelete,
  className,
}: HighlightCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const color = HIGHLIGHT_COLORS[colorIndex]

  return (
    <m.div
      className={cn(className)}
      animate={{
        y:         isHovered ? -2 : 0,
        boxShadow: isHovered ? SHADOW_HOVER : SHADOW_REST,
      }}
      transition={springs.fast}
      style={{
        position:        'relative',
        backgroundColor: color.bg,
        // TL TR BR BL - BL is 0 for the dog-ear fold
        borderRadius:    '3px 3px 3px 0',
        padding:         '12px 12px 44px 12px',
        cursor:          'default',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* ── Quote text ───────────────────────────────────────────────────────── */}
      {/* Besley at body scale is intentional - the only KDS component using     */}
      {/* --font-title here. Creates a literary "captured thought" identity       */}
      {/* distinct from every Geist-based UI element in the system.               */}
      <p
        style={{
          margin:           0,
          fontFamily:       'var(--font-title)',
          fontWeight:       'var(--font-weight-regular)',
          fontSize:         'var(--font-size-body-lg)',
          lineHeight:       1.55,
          color:            'var(--neutral-900)',
          overflow:         'hidden',
          display:          '-webkit-box',
          WebkitLineClamp:  5,
          WebkitBoxOrient:  'vertical' as const,
        }}
      >
        {text}
      </p>

      {/* ── Hover: gradient fade + action row ──────────────────────────────── */}
      <AnimatePresence initial={false}>
        {isHovered && (
          <m.div
            key="actions"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
          >
            {/* Gradient blends last line of Besley text into the action area */}
            <div
              aria-hidden="true"
              style={{
                height:        40,
                background:    `linear-gradient(to bottom, transparent, ${color.bg})`,
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                display:         'flex',
                alignItems:      'center',
                gap:             2,
                padding:         '2px 8px 10px 8px',
                backgroundColor: color.bg,
              }}
            >
              {onCopy   && <Tooltip content="Copy"           side="top"><ActionButton icon={<CopyOneIcon           size={16} />} label="Copy highlight"   onClick={onCopy}   /></Tooltip>}
              {onJump   && <Tooltip content="Open in chat"   side="top"><ActionButton icon={<MessagePreviewOneIcon size={16} />} label="Open in chat"     onClick={onJump}   /></Tooltip>}
              {onDelete && <Tooltip content="Delete"         side="top"><ActionButton icon={<CancelCircleIcon      size={16} />} label="Delete highlight" onClick={onDelete} /></Tooltip>}
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* ── Dog-ear fold - bottom-left, BL radius is 0 ──────────────────────── */}
      <div
        aria-hidden="true"
        style={{
          position:      'absolute',
          bottom:        0,
          left:          0,
          width:         12,
          height:        12,
          background:    color.fold,
          clipPath:      'polygon(0 0, 100% 100%, 0 100%)',
          pointerEvents: 'none',
        }}
      />
    </m.div>
  )
}

export default HighlightCard
