'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { PinSkeleton } from '@/components/PinSkeleton'

// ── Constants ─────────────────────────────────────────────────────────────────
// Mirror Pinboard/index.tsx exactly so the swap from skeleton → real Pinboard
// is shift-free. Any drift here should be reflected back in Pinboard.
const TOP_BAR_H   = 110   // top overlay height (header 58 + filter row 36 + gap 12 + bottom-pad 8)
const TOP_PAD     = 118   // scroll-area paddingTop  — content starts below filter row
const BOTTOM_PAD  = 68    // scroll-area paddingBottom — clears the toolbar

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PinboardSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Stretch to fill parent width instead of the default 332 px.
   * @default false
   */
  fluid?: boolean
  /**
   * Number of `PinSkeleton` rows to render in the scroll area.
   * @default 4
   */
  pinCount?: number
}

// ── Component ─────────────────────────────────────────────────────────────────

export const PinboardSkeleton = React.forwardRef<HTMLDivElement, PinboardSkeletonProps>(
  function PinboardSkeleton({ fluid = false, pinCount = 4, className, style, ...props }, ref) {
    return (
      <div
        ref={ref}
        role="status"
        aria-busy="true"
        aria-label="Loading pinboard"
        className={cn(className)}
        style={{
          position:       'relative',
          display:        'flex',
          flexDirection:  'column',
          flexShrink:     0,
          width:          fluid ? '100%' : 332,
          height:         '100%',
          background:     'var(--neutral-50)',
          overflow:       'hidden',
          paddingBottom:  8,
          borderRadius:   'inherit',
          ...style,
        }}
        {...props}
      >
        {/* ── Top overlay — header + filter bar (mirrors Pinboard's compact top chrome) ── */}
        <div
          aria-hidden
          style={{
            position:      'absolute',
            top:           0,
            left:          0,
            right:         0,
            display:       'flex',
            flexDirection: 'column',
            gap:           12,
            padding:       '0 8px 8px 8px',
            background:    'var(--neutral-50)',
            zIndex:        2,
          }}
        >
          {/* PinboardHeader skeleton — height 58, paddingTop 22, justify-end, gap 8 */}
          <div
            style={{
              position:       'relative',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'flex-end',
              gap:            8,
              height:         58,
              paddingTop:     22,
              width:          '100%',
            }}
          >
            {/* "Pinboard" title — absolute left, doesn't affect flow */}
            <div
              className="kaya-skeleton"
              style={{
                position:     'absolute',
                left:         0,
                top:          24,
                width:        96,
                height:       24,
                borderRadius: 4,
              }}
            />
            {/* Search IconButton — 32×32 r8 */}
            <div className="kaya-skeleton" style={{ width: 32, height: 32, borderRadius: 8 }} />
            {/* Close IconButton — 32×32 r8 */}
            <div className="kaya-skeleton" style={{ width: 32, height: 32, borderRadius: 8 }} />
          </div>

          {/* Filter bar — space-between: filter Button (left) + IconButton×2 (right) */}
          <div
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'space-between',
              width:          '100%',
            }}
          >
            <div
              className="kaya-skeleton"
              style={{ width: 96, height: 28, borderRadius: 8 }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="kaya-skeleton" style={{ width: 32, height: 32, borderRadius: 8 }} />
              <div className="kaya-skeleton" style={{ width: 32, height: 32, borderRadius: 8 }} />
            </div>
          </div>
        </div>

        {/* ── Scrollable pin list (no scroll in skeleton — real component reveals scroll on data) ── */}
        <div
          style={{
            flex:           '1 1 0',
            minHeight:      0,
            overflow:       'hidden',
            paddingTop:     TOP_PAD,
            paddingBottom:  BOTTOM_PAD + 4,
            paddingLeft:    8,
            paddingRight:   8,
          }}
        >
          <div
            style={{
              display:       'flex',
              flexDirection: 'column',
              gap:           8,
              alignItems:    'stretch',
              width:         '100%',
            }}
          >
            {Array.from({ length: pinCount }).map((_, i) => (
              <PinSkeleton key={i} fluid />
            ))}
          </div>
        </div>

        {/* ── Top edge fade — progressive blur + colour gradient (always visible at rest
             since content is loading and may overflow) ── */}
        {[
          { height: 40, blur: 2 },
          { height: 28, blur: 3 },
          { height: 18, blur: 5 },
          { height: 10, blur: 6 },
        ].map(({ height, blur }) => (
          <div
            key={`top-blur-${blur}`}
            aria-hidden
            style={{
              position:             'absolute',
              top:                  TOP_BAR_H,
              left:                 0,
              right:                0,
              height,
              backdropFilter:       `blur(${blur}px)`,
              WebkitBackdropFilter: `blur(${blur}px)`,
              maskImage:            'linear-gradient(to bottom, black 0%, transparent 100%)',
              WebkitMaskImage:      'linear-gradient(to bottom, black 0%, transparent 100%)',
              pointerEvents:        'none',
              zIndex:               1,
            }}
          />
        ))}
        <div
          aria-hidden
          style={{
            position:      'absolute',
            top:           TOP_BAR_H,
            left:          0,
            right:         0,
            height:        40,
            background:    'linear-gradient(to bottom, var(--neutral-50) 0%, transparent 100%)',
            pointerEvents: 'none',
            zIndex:        1,
          }}
        />

        {/* ── Bottom edge fade ── */}
        {[
          { height: 40, blur: 2 },
          { height: 28, blur: 3 },
          { height: 18, blur: 5 },
          { height: 10, blur: 6 },
        ].map(({ height, blur }) => (
          <div
            key={`bottom-blur-${blur}`}
            aria-hidden
            style={{
              position:             'absolute',
              bottom:               BOTTOM_PAD,
              left:                 0,
              right:                0,
              height,
              backdropFilter:       `blur(${blur}px)`,
              WebkitBackdropFilter: `blur(${blur}px)`,
              maskImage:            'linear-gradient(to top, black 0%, transparent 100%)',
              WebkitMaskImage:      'linear-gradient(to top, black 0%, transparent 100%)',
              pointerEvents:        'none',
              zIndex:               1,
            }}
          />
        ))}
        <div
          aria-hidden
          style={{
            position:      'absolute',
            bottom:        BOTTOM_PAD,
            left:          0,
            right:         0,
            height:        40,
            background:    'linear-gradient(to top, var(--neutral-50) 0%, transparent 100%)',
            pointerEvents: 'none',
            zIndex:        1,
          }}
        />

        {/* ── Bottom toolbar — Export (ghost, fluid) + Organize (secondary, fluid) ── */}
        <div
          aria-hidden
          style={{
            position:      'absolute',
            bottom:        0,
            left:          0,
            right:         0,
            display:       'flex',
            gap:           8,
            alignItems:    'stretch',
            padding:       '16px 8px',
            background:    'var(--neutral-50)',
            zIndex:        2,
          }}
        >
          <div
            className="kaya-skeleton"
            style={{ flex: '1 1 0', height: 36, borderRadius: 8 }}
          />
          <div
            className="kaya-skeleton"
            style={{ flex: '1 1 0', height: 36, borderRadius: 8 }}
          />
        </div>
      </div>
    )
  },
)

PinboardSkeleton.displayName = 'PinboardSkeleton'

export default PinboardSkeleton
