'use client'

import React, { useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { DragDropVerticalIcon, TickTwoIcon } from '@strange-huge/icons'
import { OptionBadge } from '@/components/OptionBadge'
import { springs } from '@/lib/springs'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

export type OptionRowVariant =
  | 'default'        // single-select, idle        - numbered badge, white bg
  | 'selected'       // single-select, selected     - inline white badge + tick, neutral/100 bg
  | 'rank'           // drag-to-rank, idle          - numbered badge, white bg, drag handle
  | 'rank-focused'   // drag-to-rank, kbd focused   - numbered badge, neutral/50, blue border, drag handle
  | 'multi'          // multi-select, unchecked     - inline white checkbox (no tick), white bg
  | 'multi-selected' // multi-select, checked       - inline white checkbox + tick, neutral/50 bg

export interface OptionRowProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: OptionRowVariant
  num?: number
  label?: string
  /** Props spread onto the drag-handle div - used to wire useDragControls in rank mode */
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}

// ── Token shorthands ──────────────────────────────────────────────────────────

const BG_WHITE       = 'var(--neutral-white, white)'
const BG_NEUTRAL_50  = 'var(--neutral-50, #f7f2ed)'
const BG_NEUTRAL_100 = 'var(--neutral-100, #ede1d7)'
const BORDER_BLUE    = '1px solid var(--blue-400, #6e98cb)'

// Shadow for the numbered badge - shared constant
const BADGE_OUTER_SHADOW = '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(182,172,164,0.4)'
const BADGE_INNER_SHADOW = 'inset 0px 1px 0px 0px rgba(247,242,237,0.61), inset 0px -1px 0px 0px rgba(106,98,93,0.05)'
// Shadow for the check/checkbox badge - white with yellow inner glow
const CHECK_INNER_SHADOW = 'inset 0px 1px 0px 0px var(--yellow-200, #d8c9a7), inset 0px -1px 0px 0px rgba(106,98,93,0.05)'

// ── Badge animation variants ───────────────────────────────────────────────────

const badgeEnter = {
  initial:  { scale: 0.5, opacity: 0, filter: 'blur(4px)' },
  animate:  { scale: 1,   opacity: 1, filter: 'blur(0px)', transition: springs.fast },
  exit:     { scale: 0.5, opacity: 0, filter: 'blur(4px)', transition: { duration: 0.08, ease: 'easeIn' as const } },
}

// ── Component ──────────────────────────────────────────────────────────────────

export function OptionRow({
    ref,
    variant = 'default', num = 1, label = '', dragHandleProps, className, style, ...props
  }: OptionRowProps & { ref?: React.Ref<HTMLDivElement> }) {
    const [hovered, setHovered] = useState(false)
    const [focused, setFocused] = useState(false)

    const showDrag = variant === 'rank' || variant === 'rank-focused'

    // Background resolves hover internally - no consumer involvement needed
    const bg = (() => {
      if (variant === 'selected')                          return BG_NEUTRAL_100
      if (variant === 'multi-selected')                    return BG_NEUTRAL_50
      if (variant === 'rank-focused')                      return BG_NEUTRAL_50
      // default, rank, multi: white idle → neutral/50 on hover
      return hovered ? BG_NEUTRAL_50 : BG_WHITE
    })()

    const hasBorder = variant === 'rank-focused'

    // Which badge key to show (drives AnimatePresence swap)
    const badgeKey = (() => {
      if (variant === 'selected')       return 'check'
      if (variant === 'multi')          return 'checkbox'
      if (variant === 'multi-selected') return 'checkbox-checked'
      return 'number'
    })()

    return (
      <div
        ref={ref}
        className={cn(className)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          display:         'flex',
          alignItems:      'center',
          gap:             10,
          height:          42,
          width:           '100%',
          flexShrink:      0,
          padding:         '0 10px',
          borderRadius:    12,
          backgroundColor: bg,
          border:          hasBorder ? BORDER_BLUE : 'none',
          outline:         focused ? `2px solid var(--blue-400, #6e98cb)` : 'none',
          outlineOffset:   '-2px',
          position:        'relative',
          userSelect:      'none',
          transition:      'background-color 150ms ease',
          ...style,
        }}
        {...props}
      >
        {/* Badge slot - AnimatePresence swaps between number / check / checkbox / checkbox-checked */}
        <div style={{ width: 28, height: 28, flexShrink: 0, position: 'relative' }}>
          <AnimatePresence mode="popLayout" initial={false}>

            {/* Numbered badge */}
            {badgeKey === 'number' && (
              <m.div key="number" {...badgeEnter} style={{ position: 'absolute', inset: 0 }}>
                <OptionBadge variant="number" num={num} />
              </m.div>
            )}

            {/* Selected - white badge + tick */}
            {badgeKey === 'check' && (
              <m.div key="check" {...badgeEnter} style={{ position: 'absolute', inset: 0 }}>
                <div
                  style={{
                    width:           28,
                    height:          28,
                    borderRadius:    8,
                    flexShrink:      0,
                    display:         'flex',
                    alignItems:      'center',
                    justifyContent:  'center',
                    overflow:        'clip',
                    position:        'relative',
                    boxShadow:       BADGE_OUTER_SHADOW,
                  }}
                >
                  <div
                    aria-hidden
                    style={{
                      position:        'absolute',
                      inset:           0,
                      borderRadius:    8,
                      backgroundColor: BG_WHITE,
                      pointerEvents:   'none',
                    }}
                  />
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TickTwoIcon size={14} color="var(--neutral-700, #524b47)" />
                  </div>
                  <div
                    aria-hidden
                    style={{
                      position:    'absolute',
                      inset:       0,
                      borderRadius: 'inherit',
                      boxShadow:   CHECK_INNER_SHADOW,
                      pointerEvents: 'none',
                    }}
                  />
                </div>
              </m.div>
            )}

            {/* Multi unchecked - white badge, no tick */}
            {badgeKey === 'checkbox' && (
              <m.div key="checkbox" {...badgeEnter} style={{ position: 'absolute', inset: 0 }}>
                <div
                  style={{
                    width:           28,
                    height:          28,
                    borderRadius:    8,
                    flexShrink:      0,
                    display:         'flex',
                    alignItems:      'center',
                    justifyContent:  'center',
                    overflow:        'clip',
                    position:        'relative',
                    boxShadow:       BADGE_OUTER_SHADOW,
                  }}
                >
                  <div
                    aria-hidden
                    style={{
                      position:        'absolute',
                      inset:           0,
                      borderRadius:    8,
                      backgroundColor: BG_WHITE,
                      pointerEvents:   'none',
                    }}
                  />
                  <div
                    aria-hidden
                    style={{
                      position:    'absolute',
                      inset:       0,
                      borderRadius: 'inherit',
                      boxShadow:   CHECK_INNER_SHADOW,
                      pointerEvents: 'none',
                    }}
                  />
                </div>
              </m.div>
            )}

            {/* Multi checked - white badge + tick */}
            {badgeKey === 'checkbox-checked' && (
              <m.div key="checkbox-checked" {...badgeEnter} style={{ position: 'absolute', inset: 0 }}>
                <div
                  style={{
                    width:           28,
                    height:          28,
                    borderRadius:    8,
                    flexShrink:      0,
                    display:         'flex',
                    alignItems:      'center',
                    justifyContent:  'center',
                    overflow:        'clip',
                    position:        'relative',
                    boxShadow:       BADGE_OUTER_SHADOW,
                  }}
                >
                  <div
                    aria-hidden
                    style={{
                      position:        'absolute',
                      inset:           0,
                      borderRadius:    8,
                      backgroundColor: BG_WHITE,
                      pointerEvents:   'none',
                    }}
                  />
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TickTwoIcon size={14} color="var(--neutral-700, #524b47)" />
                  </div>
                  <div
                    aria-hidden
                    style={{
                      position:    'absolute',
                      inset:       0,
                      borderRadius: 'inherit',
                      boxShadow:   CHECK_INNER_SHADOW,
                      pointerEvents: 'none',
                    }}
                  />
                </div>
              </m.div>
            )}

          </AnimatePresence>
        </div>

        {/* Label */}
        <p
          style={{
            flex:         '1 0 0',
            minWidth:     1,
            fontFamily:   'var(--font-body)',
            fontWeight:   'var(--font-weight-medium)',
            fontSize:     'var(--font-size-body-lg, 16px)',
            lineHeight:   'var(--line-height-body-lg, 22px)',
            color:        'var(--neutral-600, #6a625d)',
            margin:       0,
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}
        >
          {label}
        </p>

        {/* Drag handle - rank modes only, receives onPointerDown from useDragControls */}
        {showDrag && (
          <div
            {...dragHandleProps}
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              flexShrink:     0,
              width:          24,
              height:         24,
              borderRadius:   6,
              cursor:         'grab',
              touchAction:    'none',
              ...dragHandleProps?.style,
            }}
          >
            <DragDropVerticalIcon size={18} color="var(--neutral-500, #8a7f79)" />
          </div>
        )}
      </div>
    )
}

OptionRow.displayName = 'OptionRow'
export default OptionRow
