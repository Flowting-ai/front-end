'use client'

import React, { useRef, useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowDownOneIcon,
  ArrowUpDownIcon,
  FilterMailIcon,
  DownloadThreeIcon,
  FolderLibraryIcon,
  UnfoldLessIcon,
} from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { PinboardHeader } from '@/components/PinboardHeader'
import { Pin, type PinProps } from '@/components/Pin'
import { Tooltip } from '@/components/Tooltip'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PinboardPin extends Omit<PinProps, 'fluid'> {
  id: string
}

export interface PinboardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  pins?: PinboardPin[]
  filterLabel?: string
  onFilterClick?:   () => void
  onOptionsClick?:  () => void
  onCollapseAll?:   () => void
  onSortClick?:     () => void
  onExport?:        () => void
  onOrganize?:      () => void
  onClose?:         () => void
  onSearch?:        (q: string) => void
  fluid?: boolean
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_PINS: PinboardPin[] = Array.from({ length: 7 }, (_, i) => ({
  id: `pin-${i}`,
}))

// ── Component ─────────────────────────────────────────────────────────────────

export const Pinboard = React.forwardRef<HTMLDivElement, PinboardProps>(
  function Pinboard(
    {
      pins          = DEFAULT_PINS,
      filterLabel   = 'All pins',
      onFilterClick,
      onOptionsClick,
      onCollapseAll,
      onSortClick,
      onExport,
      onOrganize,
      onClose,
      onSearch,
      fluid         = false,
      style,
      ...props
    },
    ref,
  ) {
    const scrollRef    = useRef<HTMLDivElement>(null)
    const bottomBarRef = useRef<HTMLDivElement>(null)
    // Top overlay intrinsic height (bar bottom edge). Scroll reserve adds 8 px
    // so pins don't sit flush under the filter bar.
    const TOP_BAR_H = 110
    const topH = 118
    const [bottomH, setBottomH] = useState(68)
    const [atTop,    setAtTop]    = useState(true)
    const [atBottom, setAtBottom] = useState(false)
    // Incremented on "collapse all" click — every Pin watches this and folds.
    const [collapseSignal, setCollapseSignal] = useState(0)
    // Set of pin IDs currently expanded — drives visibility of the
    // "collapse all" IconButton.
    const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
    const hasExpanded = expandedIds.size > 0

    const handleCollapseAll = () => {
      setCollapseSignal((s) => s + 1)
      onCollapseAll?.()
    }

    const handlePinExpandedChange = useCallback(
      (id: string) => (expanded: boolean) => {
        setExpandedIds((prev) => {
          const has = prev.has(id)
          if (expanded === has) return prev
          const next = new Set(prev)
          if (expanded) next.add(id)
          else next.delete(id)
          return next
        })
      },
      [],
    )

    // Measure the bottom toolbar so the scroll area reserves correct space.
    useEffect(() => {
      if (!bottomBarRef.current) return
      const ro = new ResizeObserver(() => {
        if (bottomBarRef.current) setBottomH(bottomBarRef.current.offsetHeight)
      })
      ro.observe(bottomBarRef.current)
      return () => ro.disconnect()
    }, [])

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget
      setAtTop(el.scrollTop < 8)
      setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 8)
    }

    // Evaluate initial atBottom once content lays out (pin list shorter than viewport).
    useEffect(() => {
      const el = scrollRef.current
      if (!el) return
      setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 8)
    }, [pins.length, topH, bottomH])

    return (
      <div
        ref={ref}
        style={{
          position:       'relative',
          display:        'flex',
          flexDirection:  'column',
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
        {/* ── Top overlay — header + filter bar ──
            Rendered FIRST in DOM so tab order matches visual order:
            close/search → filter → sort/options → pins → Export → Organize. ── */}
        <div
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
          <PinboardHeader fluid onClose={onClose} onSearch={onSearch} />

          <div
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'space-between',
              width:          '100%',
            }}
          >
            <Button
              variant="secondary"
              size="sm"
              rightIcon={<ArrowDownOneIcon size={16} />}
              onClick={onFilterClick}
            >
              {filterLabel}
            </Button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AnimatePresence initial={false}>
                {hasExpanded && (
                  <motion.div
                    key="collapse-all"
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{    opacity: 0, scale: 0.6 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                    style={{ display: 'inline-flex', transformOrigin: 'center' }}
                  >
                    <Tooltip content="Collapse all Pins">
                      <IconButton
                        variant="secondary"
                        size="sm"
                        icon={<UnfoldLessIcon size={20} />}
                        aria-label="Collapse open pins"
                        onClick={handleCollapseAll}
                      />
                    </Tooltip>
                  </motion.div>
                )}
              </AnimatePresence>
              <motion.div
                layout
                transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                style={{ display: 'inline-flex' }}
              >
                <Tooltip content="Filter">
                  <IconButton
                    variant="secondary"
                    size="sm"
                    icon={<FilterMailIcon size={20} />}
                    aria-label="Filter pins"
                    onClick={onOptionsClick}
                  />
                </Tooltip>
              </motion.div>
              <motion.div
                layout
                transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                style={{ display: 'inline-flex' }}
              >
                <Tooltip content="Sort">
                  <IconButton
                    variant="secondary"
                    size="sm"
                    icon={<ArrowUpDownIcon size={20} />}
                    aria-label="Sort pins"
                    onClick={onSortClick}
                  />
                </Tooltip>
              </motion.div>
            </div>
          </div>
        </div>

        {/* ── Scrollable pin list ──
            tabIndex={-1} keeps the scroller out of the tab sequence (Chrome
            auto-focuses keyboard-scrollable elements) while its children
            (pins) remain individually focusable. ── */}
        <div
          ref={scrollRef}
          tabIndex={-1}
          className="kaya-scrollbar"
          onScroll={handleScroll}
          style={{
            flex:                '1 1 0',
            minHeight:            0,
            overflowY:            'auto',
            overflowX:            'hidden',
            overscrollBehaviorY:  'contain',
            paddingTop:           topH,
            paddingBottom:        bottomH,
            paddingLeft:          8,
            paddingRight:         8,
            outline:              'none',
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
            {pins.map((p) => {
              const { id, ...pinRest } = p
              return (
                <Pin
                  key={id}
                  fluid
                  collapseSignal={collapseSignal}
                  onExpandedChange={handlePinExpandedChange(id)}
                  {...pinRest}
                />
              )
            })}
          </div>
        </div>

        {/* ── Top edge fade — progressive blur (behind) + color fade (in front) ──
            Sits at the bottom edge of the top overlay, softening pins scrolling
            up underneath the filter bar. Hidden when scroll is at top.           ── */}
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
              opacity:              atTop ? 0 : 1,
              transition:           'opacity 150ms ease',
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
            opacity:       atTop ? 0 : 1,
            transition:    'opacity 150ms ease',
          }}
        />

        {/* ── Bottom edge fade — progressive blur (behind) + color fade (in front) ──
            Sits just above the toolbar, softening pins scrolling down
            underneath it. Hidden when scroll is at bottom.                       ── */}
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
              bottom:               bottomH,
              left:                 0,
              right:                0,
              height,
              backdropFilter:       `blur(${blur}px)`,
              WebkitBackdropFilter: `blur(${blur}px)`,
              maskImage:            'linear-gradient(to top, black 0%, transparent 100%)',
              WebkitMaskImage:      'linear-gradient(to top, black 0%, transparent 100%)',
              pointerEvents:        'none',
              zIndex:               1,
              opacity:              atBottom ? 0 : 1,
              transition:           'opacity 150ms ease',
            }}
          />
        ))}
        <div
          aria-hidden
          style={{
            position:      'absolute',
            bottom:        bottomH,
            left:          0,
            right:         0,
            height:        40,
            background:    'linear-gradient(to top, var(--neutral-50) 0%, transparent 100%)',
            pointerEvents: 'none',
            zIndex:        1,
            opacity:       atBottom ? 0 : 1,
            transition:    'opacity 150ms ease',
          }}
        />

        {/* ── Bottom overlay — toolbar ── */}
        <div
          ref={bottomBarRef}
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
          <Button
            variant="ghost"
            size="md"
            fluid
            leftIcon={<DownloadThreeIcon size={16} />}
            onClick={onExport}
          >
            Export
          </Button>
          <Button
            variant="secondary"
            size="md"
            fluid
            leftIcon={<FolderLibraryIcon size={16} />}
            onClick={onOrganize}
          >
            Organize
          </Button>
        </div>
      </div>
    )
  },
)

Pinboard.displayName = 'Pinboard'
export default Pinboard
