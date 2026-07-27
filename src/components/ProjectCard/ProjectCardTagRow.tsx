'use client'

// Single-line, horizontally scrollable tag row — same drag-to-scroll +
// edge-fade pattern as PersonaCard's badge row. Split out from
// ProjectCardBody (a server component) since the drag handlers need client
// interactivity.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Badge, type BadgeColor } from '@/components/Badge'

export function ProjectCardTagRow({ tags }: { tags: Array<{ label: string; color?: BadgeColor }> }) {
  const rowRef    = useRef<HTMLDivElement>(null)
  const dragState = useRef({ active: false, startX: 0, scrollLeft: 0 })

  const [atStart, setAtStart] = useState(true)
  const [atEnd,   setAtEnd]   = useState(true)

  const updateEdges = useCallback(() => {
    const el = rowRef.current
    if (!el) return
    setAtStart(el.scrollLeft < 4)
    setAtEnd(el.scrollWidth - el.scrollLeft - el.clientWidth < 4)
  }, [])

  useEffect(() => {
    updateEdges()
  }, [updateEdges, tags])

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = rowRef.current
    if (!el) return
    dragState.current = { active: true, startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft }
    el.style.cursor = 'grabbing'
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = rowRef.current
    if (!dragState.current.active || !el) return
    e.preventDefault()
    const x    = e.pageX - el.offsetLeft
    const walk = x - dragState.current.startX
    el.scrollLeft = dragState.current.scrollLeft - walk
  }, [])

  const onMouseUp = useCallback(() => {
    const el = rowRef.current
    dragState.current.active = false
    if (el) el.style.cursor = 'grab'
  }, [])

  if (tags.length === 0) return null

  return (
    <div style={{ position: 'relative', margin: '10px -1px 0', flexShrink: 0 }}>
      <div
        ref={rowRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onScroll={updateEdges}
        style={{
          display:             'flex',
          flexWrap:            'nowrap',
          gap:                 4,
          overflowX:           'auto',
          overscrollBehaviorX: 'contain',
          scrollbarWidth:      'none',
          padding:             '1px',
          cursor:              'grab',
          userSelect:          'none',
        }}
      >
        {tags.map((tag) => (
          <Badge key={tag.label} label={tag.label} color={tag.color ?? 'Blue'} />
        ))}
      </div>

      {/* Edge fades — only visible once there's actually more to scroll to. */}
      <div
        aria-hidden
        style={{
          position:      'absolute',
          top:           0,
          bottom:        0,
          left:          0,
          width:         16,
          background:    'linear-gradient(to right, var(--neutral-white) 0%, transparent 100%)',
          pointerEvents: 'none',
          opacity:       atStart ? 0 : 1,
          transition:    'opacity 150ms ease',
        }}
      />
      <div
        aria-hidden
        style={{
          position:      'absolute',
          top:           0,
          bottom:        0,
          right:         0,
          width:         16,
          background:    'linear-gradient(to left, var(--neutral-white) 0%, transparent 100%)',
          pointerEvents: 'none',
          opacity:       atEnd ? 0 : 1,
          transition:    'opacity 150ms ease',
        }}
      />
    </div>
  )
}
