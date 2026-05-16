'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SearchOneIcon, StickyNoteTwoIcon, CancelOneIcon } from '@strange-huge/icons'
import { HighlightCard, HIGHLIGHT_COLORS } from '@/components/HighlightCard'
import { IconButton } from '@/components/IconButton'
import { springs } from '@/lib/springs'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface HighlightEntry {
  /** Unique identifier. Passed back through onJump, onCopy, onDelete. */
  id:         string
  /** The full quote text. Displayed without truncation inside a HighlightCard. */
  text:       string
  /** Color assigned at creation time (0–3). Persisted so colors are stable across deletes/reorders. */
  colorIndex: 0 | 1 | 2 | 3
}

export interface HighlightPanelProps {
  /** Ordered list of highlights to display. Cards render top-to-bottom in array order. */
  highlights: HighlightEntry[]
  /** Forwarded to each card's Jump button. `id` matches HighlightEntry.id. Omit to hide Jump on all cards. */
  onJump?:    (id: string) => void
  /** Forwarded to each card's Copy button. `id` matches HighlightEntry.id. Omit to hide Copy on all cards. */
  onCopy?:    (id: string) => void
  /** Forwarded to each card's Delete button. `id` matches HighlightEntry.id. Omit to hide Delete on all cards. */
  onDelete?:  (id: string) => void
  /** Extra classes applied to the panel root element. */
  className?: string
}

// ── Component ──────────────────────────────────────────────────────────────────

export function HighlightPanel({
  highlights,
  onJump,
  onCopy,
  onDelete,
  className,
}: HighlightPanelProps) {
  const [searchOpen,  setSearchOpen]  = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Scroll-edge fade state ────────────────────────────────────────────────
  // Vertical fade (top + bottom) on the scrollable card list.
  const scrollRef = useRef<HTMLDivElement>(null)
  const [atTop,    setAtTop]    = useState(true)
  const [atBottom, setAtBottom] = useState(false)

  const filtered = searchValue.trim()
    ? highlights.filter(h =>
        h.text.toLowerCase().includes(searchValue.toLowerCase())
      )
    : highlights

  const openSearch = () => {
    setSearchOpen(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const closeSearch = () => {
    setSearchOpen(false)
    setSearchValue('')
  }

  // Recompute atTop / atBottom from the scroll container's current geometry.
  // 1px tolerance handles rounding in scrollHeight/scrollTop arithmetic.
  const recomputeScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const overflowing = el.scrollHeight > el.clientHeight + 1
    setAtTop(!overflowing || el.scrollTop <= 0)
    setAtBottom(!overflowing || el.scrollTop + el.clientHeight >= el.scrollHeight - 1)
  }, [])

  // Observe size changes - content additions/removals + font/icon load can
  // shift the overflow state without firing onScroll. Re-run when the
  // filtered list changes, in case items mount with their own animations.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    recomputeScroll()
    const ro = new ResizeObserver(recomputeScroll)
    ro.observe(el)
    for (const child of Array.from(el.children)) ro.observe(child as Element)
    return () => ro.disconnect()
  }, [recomputeScroll, filtered.length])

  return (
    <div
      className={cn(className)}
      style={{
        display:        'flex',
        flexDirection:  'column',
        width:          332,
        height:         '100%',
        backgroundColor: 'var(--neutral-50)',
        gap:            0,
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '22px 8px 10px 8px',
          flexShrink:     0,
        }}
      >
        {/* Title / search input toggle */}
        <AnimatePresence mode="wait" initial={false}>
          {searchOpen ? (
            <motion.div
              key="search-input"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={springs.fast}
              style={{ flex: 1, marginRight: 8 }}
            >
              <input
                ref={inputRef}
                type="text"
                aria-label="Search highlights"
                placeholder="Search highlights…"
                value={searchValue}
                onChange={e => setSearchValue(e.target.value)}
                onKeyDown={e => e.key === 'Escape' && closeSearch()}
                style={{
                  width:           '100%',
                  border:          'none',
                  background:      'transparent',
                  fontFamily:      'var(--font-body)',
                  fontWeight:      'var(--font-weight-regular)',
                  fontSize:        'var(--font-size-body-lg)',
                  lineHeight:      '1.4',
                  color:           'var(--neutral-900)',
                  caretColor:      'var(--focus-ring)',
                  outline:         '2px solid transparent',
                  outlineOffset:   '2px',
                  borderRadius:    '4px',
                }}
                onFocus={e => {
                  if (e.target.matches(':focus-visible')) {
                    e.target.style.outlineColor = 'var(--focus-ring)'
                  }
                }}
                onBlur={e => { e.target.style.outlineColor = 'transparent' }}
              />
            </motion.div>
          ) : (
            <motion.h2
              key="title"
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 6 }}
              transition={springs.fast}
              style={{
                margin:      0,
                fontFamily:  'var(--font-title)',
                fontWeight:  'var(--font-weight-regular)',
                fontSize:    24,
                lineHeight:  '1.3',
                color:       'var(--neutral-700)',
              }}
            >
              Highlight
            </motion.h2>
          )}
        </AnimatePresence>

        {/* Header action buttons */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
          <AnimatePresence initial={false}>
            {searchOpen && (
              <motion.div
                key="close-btn"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={springs.fast}
              >
                <IconButton
                  variant="ghost"
                  size="sm"
                  icon={<CancelOneIcon size={20} />}
                  aria-label="Close search"
                  onClick={closeSearch}
                />
              </motion.div>
            )}
          </AnimatePresence>
          <IconButton
            variant="ghost"
            size="sm"
            icon={<SearchOneIcon size={20} />}
            aria-label="Search highlights"
            aria-pressed={searchOpen}
            onClick={searchOpen ? undefined : openSearch}
          />
        </div>
      </div>

      {/* ── Search result count ── */}
      <AnimatePresence initial={false}>
        {searchOpen && searchValue && (
          <motion.p
            key="result-count"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={springs.fast}
            style={{
              margin:     0,
              padding:    '0 16px 8px',
              fontFamily: 'var(--font-body)',
              fontWeight: 'var(--font-weight-regular)',
              fontSize:   11,
              lineHeight: '1.5',
              color:      'var(--neutral-500)',
              flexShrink: 0,
              overflow:   'hidden',
            }}
          >
            {filtered.length === 0
              ? 'No results'
              : `${filtered.length} highlight${filtered.length === 1 ? '' : 's'}`}
          </motion.p>
        )}
      </AnimatePresence>

      {/* ── Scrollable card list ── */}
      <div style={{ position: 'relative', flex: '1 1 0', minHeight: 0 }}>
      <div
        ref={scrollRef}
        onScroll={recomputeScroll}
        className="kaya-scrollbar"
        style={{
          width:               '100%',
          height:              '100%',
          overflowY:           'auto',
          overscrollBehaviorY: 'contain',
          padding:             '0 8px 24px',
          display:             'flex',
          flexDirection:       'column',
          gap:                 8,
        }}
      >
        <AnimatePresence initial={false}>
          {filtered.map(h => (
            <motion.div
              key={h.id}
              initial={{ opacity: 0, scaleY: 0.85, y: -8 }}
              animate={{ opacity: 1, scaleY: 1,    y:  0 }}
              exit={{    opacity: 0, scaleY: 0.85, y: -8 }}
              transition={springs.moderate}
              style={{ transformOrigin: 'top center' }}
            >
              <HighlightCard
                text={h.text}
                colorIndex={h.colorIndex}
                onJump={onJump     ? () => onJump(h.id)     : undefined}
                onCopy={onCopy     ? () => onCopy(h.id)     : undefined}
                onDelete={onDelete ? () => onDelete(h.id)   : undefined}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* ── Empty state ── */}
        <AnimatePresence initial={false}>
          {filtered.length === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                display:        'flex',
                flexDirection:  'column',
                alignItems:     'center',
                justifyContent: 'center',
                gap:            12,
                padding:        '48px 24px',
                textAlign:      'center',
              }}
            >
              <StickyNoteTwoIcon size={32} color="var(--neutral-300)" />
              <p
                style={{
                  margin:     0,
                  fontFamily: 'var(--font-body)',
                  fontWeight: 'var(--font-weight-regular)',
                  fontSize:   'var(--font-size-caption)',
                  lineHeight: '1.5',
                  color:      'var(--neutral-500)',
                }}
              >
                {searchValue ? 'No highlights match your search' : 'Nothing highlighted yet'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Top edge fade - 4 progressive backdrop-blur layers + 1 surface gradient ── */}
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
            opacity:              atTop ? 0 : 1,
            transition:           'opacity 150ms ease',
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
          opacity:       atTop ? 0 : 1,
          transition:    'opacity 150ms ease',
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
            opacity:              atBottom ? 0 : 1,
            transition:           'opacity 150ms ease',
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
          opacity:       atBottom ? 0 : 1,
          transition:    'opacity 150ms ease',
        }}
      />
      </div>
    </div>
  )
}

export default HighlightPanel
