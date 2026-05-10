'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { PinSkeleton } from '@/components/PinSkeleton'

// ── Constants ─────────────────────────────────────────────────────────────────
// Mirror PinboardExpanded's resting frame, sidebar, content wrapper, header,
// and 2-column grid exactly so the swap from skeleton → real expanded panel is
// shift-free. Any drift here should be reflected back in PinboardExpanded.
const PANEL_SHADOW =
  '0 19px 32px 8px rgba(18,12,8,0.15), 0 2px 2.8px 0 rgba(130,122,116,0.10), 0 0 0 1px var(--neutral-100)'

const SIDEBAR_W   = 240
const CVW_WIDTH   = 644   // Content Vertical Wrapper — 2 × 314 + 8 gap + 8 buffer
const CVW_HEIGHT  = 788
const ROW_GAP     = 32

// ── Internal — Sidebar section header + row placeholder ──────────────────────

function SidebarSection({
  rows,
  showAddRow = false,
}: {
  rows: number
  showAddRow?: boolean
}) {
  return (
    <div
      style={{
        display:       'flex',
        flexDirection: 'column',
        gap:           4,
        padding:       8,
        width:         '100%',
        overflow:      'hidden',
      }}
    >
      {/* Section label — small dim text bar */}
      <div
        className="kaya-skeleton"
        style={{ width: 92, height: 12, borderRadius: 4, marginBottom: 4 }}
      />
      {showAddRow && <SidebarRow withIcon />}
      {Array.from({ length: rows }).map((_, i) => (
        <SidebarRow key={i} withIcon />
      ))}
    </div>
  )
}

function SidebarRow({ withIcon = true }: { withIcon?: boolean }) {
  // Mirror SidebarMenuItem default size: ~32 px tall, padding 6, gap 8, icon 20
  const labelW = 92 + Math.floor(Math.random() * 60) // 92–152
  return (
    <div
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          8,
        padding:      6,
        borderRadius: 8,
        width:        '100%',
      }}
    >
      {withIcon && (
        <div className="kaya-skeleton" style={{ width: 20, height: 20, borderRadius: 6 }} />
      )}
      <div className="kaya-skeleton" style={{ flex: 1, maxWidth: labelW, height: 10, borderRadius: 4 }} />
    </div>
  )
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PinboardExpandedSkeletonProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Number of pin skeletons to render in the 2-column grid.
   * @default 6
   */
  pinCount?: number
  /**
   * Override the panel width. Defaults to PinboardExpanded's resting 924 px.
   * @default 924
   */
  width?: number
  /**
   * Override the panel height. Defaults to PinboardExpanded's resting 817 px.
   * @default 817
   */
  height?: number
}

// ── Component ─────────────────────────────────────────────────────────────────

export const PinboardExpandedSkeleton = React.forwardRef<
  HTMLDivElement,
  PinboardExpandedSkeletonProps
>(function PinboardExpandedSkeleton(
  { pinCount = 6, width = 924, height = 817, className, style, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      role="status"
      aria-busy="true"
      aria-label="Loading pinboard"
      className={cn(className)}
      style={{
        position:        'relative',
        width,
        height,
        background:      'var(--neutral-50)',
        borderRadius:    28,
        overflow:        'hidden',
        boxShadow:       PANEL_SHADOW,
        isolation:       'isolate',
        ...style,
      }}
      {...props}
    >
      {/* ── Outer pinboard — flex row, items-center, px-8 (mirrors PinboardExpanded root) ── */}
      <div
        style={{
          display:      'flex',
          alignItems:   'center',
          width:        '100%',
          height:       '100%',
          padding:      '0 8px',
          background:   'var(--neutral-50)',
          overflow:     'hidden',
        }}
      >
        {/* ── Sidebar Container — Figma 2565:32601 ── */}
        <div
          style={{
            display:        'flex',
            flexDirection:  'column',
            height:         '100%',
            padding:        '8px 0',
            flexShrink:     0,
            zIndex:         2,
            background:     'var(--neutral-50)',
          }}
        >
          {/* Sidebar Wrapper — Figma 2565:32602 (radius 20, translucent bg, ring shadow) */}
          <div
            style={{
              display:      'flex',
              alignItems:   'flex-start',
              flex:         '1 0 0',
              minHeight:    0,
              borderRadius: 20,
              background:   'var(--color-surface-glass)',
              boxShadow:
                '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-200)',
              overflow:     'hidden',
            }}
          >
            <div
              style={{
                display:        'flex',
                flexDirection:  'column',
                gap:            4,
                height:         '100%',
                width:          SIDEBAR_W,
                padding:        '8px 0',
                overflowX:      'hidden',
                overflowY:      'hidden',
                flexShrink:     0,
              }}
            >
              <SidebarSection rows={2} />               {/* Pinboard section */}
              <SidebarSection rows={3} showAddRow />    {/* Your folders */}
              <SidebarSection rows={3} />                {/* Project folders */}
            </div>
          </div>
        </div>

        {/* ── Content Container — Figma 2565:34101 ── */}
        <div
          style={{
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'flex-start',
            flexShrink:     0,
            height:         '100%',
            paddingTop:     8,
            background:     'var(--neutral-50)',
            zIndex:         1,
          }}
        >
          {/* Content Wrapper — Figma 2565:34102 (flex-1, p-12, r-20, overflow-clip) */}
          <div
            style={{
              display:      'flex',
              alignItems:   'flex-start',
              flex:         '1 0 0',
              minHeight:    1,
              padding:      12,
              borderRadius: 20,
              overflow:     'hidden',
            }}
          >
            {/* Content Vertical Wrapper — Figma 2565:34103 (644 × 788, gap 24) */}
            <div
              style={{
                display:        'flex',
                flexDirection:  'column',
                alignItems:     'flex-start',
                gap:            24,
                flexShrink:     0,
                width:          CVW_WIDTH,
                height:         CVW_HEIGHT,
              }}
            >
              {/* ── Header — Figma 2565:34104 ── */}
              <div
                style={{
                  display:    'flex',
                  gap:        8,
                  alignItems: 'flex-start',
                  width:      '100%',
                  flexShrink: 0,
                }}
              >
                {/* Pins Info — Title + 2 badges */}
                <div
                  style={{
                    display:        'flex',
                    flex:           '1 0 0',
                    flexDirection:  'column',
                    gap:            8,
                    alignItems:     'flex-start',
                    justifyContent: 'center',
                    minWidth:       1,
                  }}
                >
                  <div style={{ display: 'flex', paddingLeft: 4, width: '100%' }}>
                    <div
                      className="kaya-skeleton"
                      style={{ height: 28, width: '60%', borderRadius: 6 }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                    {/* Two Badge skeletons — Neutral, ~24 tall */}
                    <div className="kaya-skeleton" style={{ width: 64, height: 22, borderRadius: 6 }} />
                    <div className="kaya-skeleton" style={{ width: 96, height: 22, borderRadius: 6 }} />
                  </div>
                </div>

                {/* Actions — Organise (sm Button, ~32 tall) + Close (sm IconButton 32×32) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <div className="kaya-skeleton" style={{ width: 108, height: 32, borderRadius: 8 }} />
                  <div className="kaya-skeleton" style={{ width: 32,  height: 32, borderRadius: 8 }} />
                </div>
              </div>

              {/* ── Pin Cards Container ── */}
              <div
                style={{
                  display:        'flex',
                  flexDirection:  'column',
                  gap:            12,
                  flex:           '1 0 0',
                  minHeight:      1,
                  width:          '100%',
                }}
              >
                {/* ── Tabs Container — Figma 2565:34112 (gap 32) ── */}
                <div
                  style={{
                    display:    'flex',
                    alignItems: 'center',
                    gap:        ROW_GAP,
                    width:      '100%',
                    flexShrink: 0,
                  }}
                >
                  {/* Tabs strip — fills left, snaps width via flex */}
                  <div
                    style={{
                      flex:     '1 0 0',
                      minWidth: 1,
                      overflow: 'hidden',
                      padding:  '1px 0 1px 1px',
                      display:  'flex',
                      gap:      4,
                    }}
                  >
                    {[88, 80, 72, 76].map((w, i) => (
                      <div
                        key={i}
                        className="kaya-skeleton"
                        style={{ width: w, height: 28, borderRadius: 8, flexShrink: 0 }}
                      />
                    ))}
                  </div>

                  {/* Secondary Actions cluster — Search (32) + Export, Filter, Sort (32 each) */}
                  <div
                    style={{
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'flex-end',
                      gap:            4,
                      flexShrink:     0,
                    }}
                  >
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="kaya-skeleton"
                        style={{ width: 32, height: 32, borderRadius: 8 }}
                      />
                    ))}
                  </div>
                </div>

                {/* ── Scrollable Pin Cards Grid — 2-column flex (mirrors real layout) ── */}
                <div
                  style={{
                    position:   'relative',
                    flex:       '1 0 0',
                    minHeight:  1,
                    width:      '100%',
                  }}
                >
                  <div
                    style={{
                      width:    '100%',
                      height:   '100%',
                      overflow: 'hidden',
                      padding:  '2px',
                    }}
                  >
                    <div
                      style={{
                        display:        'flex',
                        flexDirection:  'row',
                        alignItems:     'flex-start',
                        gap:            8,
                      }}
                    >
                      {[0, 1].map((col) => (
                        <div
                          key={col}
                          style={{
                            display:        'flex',
                            flexDirection:  'column',
                            gap:            8,
                            flex:           '0 0 auto',
                          }}
                        >
                          {Array.from({ length: pinCount }).map((_, i) => {
                            if (i % 2 !== col) return null
                            // Vary body lines + label count for natural rhythm
                            const bodyLines  = (i % 3 === 0) ? 3 : 2
                            const labelCount = 2 + (i % 3)
                            return (
                              <PinSkeleton
                                key={i}
                                variant="compact"
                                bodyLines={bodyLines}
                                labelCount={labelCount}
                              />
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Top + bottom edge fades — same pattern as the real grid */}
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
                        top:                  0,
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
                      top:           0,
                      left:          0,
                      right:         0,
                      height:        40,
                      background:    'linear-gradient(to bottom, var(--neutral-50) 0%, transparent 100%)',
                      pointerEvents: 'none',
                      zIndex:        1,
                    }}
                  />
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
                        bottom:               0,
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
                      bottom:        0,
                      left:          0,
                      right:         0,
                      height:        40,
                      background:    'linear-gradient(to top, var(--neutral-50) 0%, transparent 100%)',
                      pointerEvents: 'none',
                      zIndex:        1,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

PinboardExpandedSkeleton.displayName = 'PinboardExpandedSkeleton'

export default PinboardExpandedSkeleton
