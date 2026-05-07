'use client'

import React, { useMemo } from 'react'
import { cn } from '@/lib/utils'

// ── Constants ─────────────────────────────────────────────────────────────────
// Card shadow + radius mirror Pin's outer card so the skeleton drops in at the
// same elevation as a real pin in the Pinboard grid.
const SHADOW_CARD =
  '0px 2px 2.8px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-100)'

// Width presets per consumer surface — matches Pin's resting widths.
//   compact  → Pinboard collapsed panel (314 px)
//   expanded → PinboardExpanded grid cell (644 px)
const VARIANT_WIDTH: Record<'compact' | 'expanded', number> = {
  compact:  314,
  expanded: 644,
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PinSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Surface variant. Picks the resting width to match the real Pin:
   *  - `compact`  (default) — 314 px, used inside the collapsed Pinboard.
   *  - `expanded`           — 644 px, used inside PinboardExpanded's grid.
   * @default 'compact'
   */
  variant?: 'compact' | 'expanded'
  /**
   * Stretch to the parent's width instead of the variant's preset width.
   * Use inside flex/grid containers that already constrain the cell.
   * @default false
   */
  fluid?: boolean
  /**
   * Number of body-text bars to render in the description block (each is a
   * 16 px-tall shimmer line). Two lines mirrors Pin's collapsed body.
   * @default 2
   */
  bodyLines?: number
  /**
   * Number of label chips to render in the labels row. The first slot is
   * always the "Add tag" affordance (24×24); remaining slots are short label
   * placeholders. Pass 0 to hide the labels row entirely.
   * @default 3
   */
  labelCount?: number
}

// ── Component ─────────────────────────────────────────────────────────────────

export const PinSkeleton = React.forwardRef<HTMLDivElement, PinSkeletonProps>(
  function PinSkeleton(
    {
      variant    = 'compact',
      fluid      = false,
      bodyLines  = 2,
      labelCount = 3,
      className,
      style,
      ...props
    },
    ref,
  ) {
    // Randomise label widths so the row reads naturally rather than as a
    // mechanical strip of identical bars. Memoised per-instance.
    const labelWidths = useMemo(
      () =>
        Array.from({ length: Math.max(0, labelCount - 1) }, () =>
          Math.floor(Math.random() * 32) + 44, // 44–76 px
        ),
      [labelCount],
    )

    return (
      <div
        ref={ref}
        aria-hidden
        aria-busy="true"
        className={cn(className)}
        style={{
          position:        'relative',
          width:           fluid ? '100%' : VARIANT_WIDTH[variant],
          borderRadius:    16,
          backgroundColor: 'var(--neutral-white)',
          boxShadow:       SHADOW_CARD,
          overflow:        'clip',
          isolation:       'isolate',
          ...style,
        }}
        {...props}
      >
        <div
          style={{
            display:       'flex',
            flexDirection: 'column',
            gap:           16,
            alignItems:    'flex-start',
            padding:       '12px 12px 16px 12px',
          }}
        >
          {/* ── Header row — category tile + title stack + ellipsis slot ── */}
          <div
            style={{
              display:    'flex',
              gap:        4,
              alignItems: 'flex-start',
              width:      '100%',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display:    'flex',
                flex:       '1 0 0',
                gap:        12,
                alignItems: 'flex-start',
                minWidth:   0,
              }}
            >
              {/* PinCategory tile placeholder — matches PinCategory's 45×45 / r8 */}
              <div
                className="kaya-skeleton"
                style={{
                  width:        45,
                  height:       45,
                  borderRadius: 8,
                  flexShrink:   0,
                }}
              />

              {/* Title — two short bars stacked, mirroring Pin's 2-line title cap */}
              <div
                style={{
                  flex:          '1 0 0',
                  display:       'flex',
                  flexDirection: 'column',
                  gap:           6,
                  paddingTop:    6,
                  minWidth:      0,
                }}
              >
                <div
                  className="kaya-skeleton"
                  style={{ height: 14, width: '70%', borderRadius: 4 }}
                />
                <div
                  className="kaya-skeleton"
                  style={{ height: 14, width: '45%', borderRadius: 4 }}
                />
              </div>
            </div>

            {/* IconButton (more options) placeholder — 24×24 / r6 */}
            <div
              className="kaya-skeleton"
              style={{
                width:        24,
                height:       24,
                borderRadius: 6,
                flexShrink:   0,
              }}
            />
          </div>

          {/* ── Body lines ── */}
          {bodyLines > 0 && (
            <div
              style={{
                display:       'flex',
                flexDirection: 'column',
                gap:           6,
                width:         '100%',
                flexShrink:    0,
              }}
            >
              {Array.from({ length: bodyLines }).map((_, i) => (
                <div
                  key={i}
                  className="kaya-skeleton"
                  style={{
                    height:       16,
                    width:        i === bodyLines - 1 ? '60%' : '100%',
                    borderRadius: 4,
                  }}
                />
              ))}
            </div>
          )}

          {/* ── Labels row — Add-tag chip + label placeholders ── */}
          {labelCount > 0 && (
            <div
              style={{
                display:    'flex',
                gap:        6,
                alignItems: 'center',
                width:      '100%',
                flexShrink: 0,
                overflow:   'hidden',
              }}
            >
              {/* Add-tag affordance — square 24×24 (no label text) */}
              <div
                className="kaya-skeleton"
                style={{
                  width:        24,
                  height:       24,
                  borderRadius: 6,
                  flexShrink:   0,
                }}
              />
              {labelWidths.map((w, i) => (
                <div
                  key={i}
                  className="kaya-skeleton"
                  style={{
                    width:        w,
                    height:       24,
                    borderRadius: 6,
                    flexShrink:   0,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    )
  },
)

PinSkeleton.displayName = 'PinSkeleton'

export default PinSkeleton
