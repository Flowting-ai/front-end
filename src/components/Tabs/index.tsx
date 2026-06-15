'use client'

import React, { use, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { animate, motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { springs } from '@/lib/springs'
import { TabItem } from '@/components/TabItem'

// ── Contexts — set by TabsList, consumed by TabsTrigger ───────────────────────

type TabsSize = 'medium' | 'small'
const TabsSizeContext     = React.createContext<TabsSize>('medium')
const TabsFluidContext    = React.createContext(false)
const TabsCollapseContext = React.createContext(false)
// Collapse mode: reserved width (px) for the active label slot = widest label
// across all tabs. Keeps the active tab — and the whole strip — a constant width.
const TabsMaxLabelContext = React.createContext<number | null>(null)

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TabsListProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> {
  /**
   * When true the List fills its parent width and only the triggers row
   * scrolls horizontally. The beige pill background stays fixed at the
   * container width - it does not grow with the content.
   */
  scrollable?: boolean
  /** Size variant - medium (default) or small. Propagates to all TabsTrigger children via context. */
  size?: TabsSize
  /** When true, the list fills its parent width and each trigger grows equally (sidebar tab strip). */
  fluid?: boolean
  /** How triggers are distributed along the main axis. Defaults to flex-start. */
  justify?: 'start' | 'center' | 'space-evenly' | 'space-between'
  /**
   * Top offset of the active pill from the row top edge.
   * Negative = extends beyond; positive = inset. Default: -0.5.
   */
  pillTopInset?: number
  /**
   * Bottom offset of the active pill from the row bottom edge.
   * Negative = extends beyond; positive = inset. Default: -0.5.
   */
  pillBottomInset?: number
  /**
   * Collapse mode — only the active trigger shows its label; the rest render
   * icon-only. The strip hugs its content and the sliding pill springs to fit
   * the active trigger as the label mounts/unmounts. Mutually exclusive with
   * `fluid` and `scrollable`. Used by the Sidebar section switcher.
   */
  collapse?: boolean
}

export interface TabsTriggerProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> {
  /** Optional 16×16 icon rendered to the left of the label */
  icon?: React.ReactNode
}

export interface TabsContentProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content> {}

// ── Root ──────────────────────────────────────────────────────────────────────

export const Tabs = TabsPrimitive.Root
Tabs.displayName = 'Tabs'

// ── List (pill container) ─────────────────────────────────────────────────────
//
// Default mode - inline-flex, sizes to content. Pill layers (bg + shadow)
// live inside rowRef, animated via Framer Motion animate prop.
//
// Scrollable mode - display:block fills the parent container. rowRef has
// overflow-x:auto. The List clips in X (overflow-x:clip) so the shadow
// never bleeds past the edges, while overflow-y:visible (CSS spec preserves
// it when the other axis is clip, not auto/hidden/scroll) lets the bottom
// drop-shadow render past the border.
//
// The outer drop-shadow is hoisted to the List level (outside the scroll
// container) so it is never clipped by the scroll container. Its DOM style
// is updated two ways - both via direct style mutation to avoid any
// React or Framer Motion render-cycle lag:
//   • Tab switch → spring via animate(from, to, { onUpdate }) → style.transform / style.width
//   • Scroll     → shadowEl.style.transform directly - frame-perfect, zero lag

export function TabsList({
  ref,
  children,
  className,
  scrollable,
  fluid,
  collapse,
  size = 'medium',
  justify,
  pillTopInset = -0.5,
  pillBottomInset = -0.5,
  ...props
}: TabsListProps & { ref?: React.Ref<React.ElementRef<typeof TabsPrimitive.List>> }) {
  const isSmall  = size === 'small'
  const radius   = isSmall ? '8px' : '10px'

  const rowRef    = useRef<HTMLDivElement>(null)
  const shadowRef = useRef<HTMLDivElement>(null)
  const [pill, setPill] = useState<{ x: number; width: number } | null>(null)
  // Collapse mode: widest label width across tabs (reserved for the active slot).
  const [maxLabelW, setMaxLabelW] = useState<number | null>(null)
  const [overflowing, setOverflowing] = useState(false)
  const [dragging, setDragging]       = useState(false)
  const dragState = useRef<{ startX: number; startScroll: number; moved: boolean; pointerId: number; target: Element | null } | null>(null)

  // Track current shadow position for spring start values.
  const shadowXCur = useRef(0)
  const shadowWCur = useRef(0)
  // Cancels for in-flight spring animations.
  const shadowAnimX = useRef<{ stop(): void } | null>(null)
  const shadowAnimW = useRef<{ stop(): void } | null>(null)
  const isFirstPill = useRef(true)

  // ── Measurement ────────────────────────────────────────────────────────────

  const measure = useCallback(() => {
    const row = rowRef.current
    if (!row) return
    const active = row.querySelector<HTMLElement>('[data-state="active"]')
    if (!active) { setPill(null); return }
    setPill({ x: active.offsetLeft, width: active.offsetWidth })
  }, [])

  useLayoutEffect(() => { measure() }, [measure])

  useEffect(() => {
    const row = rowRef.current
    if (!row) return
    const mo = new MutationObserver(measure)
    mo.observe(row, { attributes: true, subtree: true, attributeFilter: ['data-state'] })
    // Re-measure whenever the container is resized (e.g. sidebar collapse/expand
    // animation) so the pill tracks the active tab through the layout change.
    const ro = new ResizeObserver(measure)
    ro.observe(row)
    return () => { mo.disconnect(); ro.disconnect() }
  }, [measure])

  // ── Collapse: measure the widest label so the active slot can be reserved ────
  // Each tab's inner label span reports its natural offsetWidth even while its
  // outer slot is clipped to width 0, so the max is available without rendering
  // every label expanded. Re-measures on child change, container resize, and
  // font load. The active tab is then pinned to this width → constant strip.
  useLayoutEffect(() => {
    if (!collapse) return
    const row = rowRef.current
    if (!row) return
    const remeasure = () => {
      const labels = row.querySelectorAll<HTMLElement>('[data-tab-collapse-label] > span')
      let max = 0
      labels.forEach((el) => { max = Math.max(max, el.offsetWidth) })
      if (max > 0) setMaxLabelW((prev) => (prev === max ? prev : max))
    }
    remeasure()
    const ro = new ResizeObserver(remeasure)
    row.querySelectorAll('[data-tab-collapse-label] > span').forEach((el) => ro.observe(el))
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
    if (fonts?.ready) fonts.ready.then(remeasure).catch(() => {})
    return () => ro.disconnect()
  }, [collapse, children])

  // Re-measure the pill once the reserved label width is applied (active tab
  // width changes from natural → reserved), so the pill matches the new width.
  useLayoutEffect(() => { measure() }, [maxLabelW, measure])

  // ── Scrollable: sync shadow DOM directly ────────────────────────────────────

  const applyShadow = useCallback((x: number, w: number) => {
    const el = shadowRef.current
    if (!el) return
    el.style.transform = `translateX(${x}px)`
    el.style.width     = `${w}px`
    shadowXCur.current = x
    shadowWCur.current = w
  }, [])

  useLayoutEffect(() => {
    if (!scrollable || !pill) return
    const sl      = rowRef.current?.scrollLeft ?? 0
    const targetX = pill.x - sl

    if (isFirstPill.current) {
      applyShadow(targetX, pill.width)
      isFirstPill.current = false
      return
    }

    shadowAnimX.current?.stop()
    shadowAnimW.current?.stop()

    const fromX = shadowXCur.current
    const fromW = shadowWCur.current

    shadowAnimX.current = animate(fromX, targetX, {
      ...springs.fast,
      onUpdate: (v) => {
        shadowXCur.current = v
        if (shadowRef.current) shadowRef.current.style.transform = `translateX(${v}px)`
      },
    })
    shadowAnimW.current = animate(fromW, pill.width, {
      ...springs.fast,
      onUpdate: (v) => {
        shadowWCur.current = v
        if (shadowRef.current) shadowRef.current.style.width = `${v}px`
      },
    })
  }, [pill, scrollable, applyShadow])

  // ── Scrollable: detect overflow so the grab cursor only shows when draggable ──

  useEffect(() => {
    if (!scrollable) { setOverflowing(false); return }
    const row = rowRef.current
    if (!row) return
    const update = () => setOverflowing(row.scrollWidth > row.clientWidth + 1)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(row)
    for (const child of Array.from(row.children)) ro.observe(child as Element)
    return () => ro.disconnect()
  }, [scrollable, children])

  // ── Scrollable: pointer-drag to scroll the row ─────────────────────────────
  //
  // Mouse / pen only - touch devices use native horizontal scrolling, which
  // already includes momentum + rubber-band. We arm on pointerdown, only
  // promote to a drag once the pointer has moved past a 4 px threshold (so
  // a click on a tab still selects it), and suppress the synthetic click
  // that follows the drag so a tab isn't activated mid-scroll.

  const onRowPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!scrollable || !overflowing) return
    if (e.pointerType === 'touch') return
    if (e.button !== 0) return
    const row = rowRef.current
    if (!row) return
    // Suppress the default mousedown focus/activation so Radix doesn't select
    // the tab until we know whether this is a click or a drag. We re-issue
    // the click manually on pointerup if no drag occurred.
    e.preventDefault()
    dragState.current = {
      startX: e.clientX,
      startScroll: row.scrollLeft,
      moved: false,
      pointerId: e.pointerId,
      target: e.target as Element,
    }
  }, [scrollable, overflowing])

  const onRowPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const s = dragState.current
    if (!s) return
    const dx = e.clientX - s.startX
    if (!s.moved) {
      if (Math.abs(dx) <= 4) return
      s.moved = true
      setDragging(true)
      try { rowRef.current?.setPointerCapture(s.pointerId) } catch {}
    }
    if (rowRef.current) rowRef.current.scrollLeft = s.startScroll - dx
    e.preventDefault()
  }, [])

  const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const s = dragState.current
    if (!s) return
    const wasDrag = s.moved
    const target  = s.target
    dragState.current = null
    setDragging(false)
    try { rowRef.current?.releasePointerCapture(s.pointerId) } catch {}
    if (!wasDrag && target) {
      // pointerdown was preventDefault'd, so the browser suppressed the
      // mousedown→focus→click chain. Re-issue activation manually on the
      // tab button under the original pointerdown.
      const btn = (target.closest('button') as HTMLButtonElement | null)
      if (btn && !btn.disabled) {
        // focusVisible:false → suppress :focus-visible ring on pointer-driven
        // activation. Keyboard nav goes through Radix's own onKeyDown and
        // still triggers the ring as expected.
        ;(btn as HTMLButtonElement & { focus: (opts?: { preventScroll?: boolean; focusVisible?: boolean }) => void })
          .focus({ focusVisible: false })
        btn.click()
      }
    }
    void e
  }, [])

  const handleScroll = useCallback(() => {
    const row = rowRef.current
    if (!row || !pill) return
    shadowAnimX.current?.stop()
    const x = pill.x - row.scrollLeft
    shadowXCur.current = x
    if (shadowRef.current) shadowRef.current.style.transform = `translateX(${x}px)`
  }, [pill])

  // ── Pill base style (shared by all pill layers, size-aware) ────────────────

  const pillBase: React.CSSProperties = {
    position:      'absolute',
    top:           pillTopInset,
    bottom:        pillBottomInset,
    borderRadius:  radius,
    pointerEvents: 'none',
  }

  return (
    <TabsMaxLabelContext.Provider value={collapse ? maxLabelW : null}>
    <TabsCollapseContext.Provider value={!!collapse}>
    <TabsFluidContext.Provider value={!!fluid}>
    <TabsSizeContext.Provider value={size}>
      <TabsPrimitive.List
        ref={ref}
        className={cn(className)}
        style={{
          position:   'relative',
          display:    scrollable ? 'block' : fluid ? 'flex' : 'inline-flex',
          alignItems: 'flex-start',
          ...(fluid && { width: '100%' }),
          ...(!scrollable && !fluid && { alignSelf: 'flex-start' }),
          ...(scrollable && {
            overflowX:          'clip' as React.CSSProperties['overflowX'],
            overflowY:          'visible',
            overflowClipMargin: '8px',
          }),
        }}
        {...props}
      >
        {/* ── Beige pill background ── */}
        <div
          aria-hidden
          style={{ position: 'absolute', inset: 0, borderRadius: radius, pointerEvents: 'none' }}
        >
          <div style={{ position: 'absolute', inset: 0, borderRadius: radius, backgroundColor: 'var(--tab-bg)' }} />
          <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', boxShadow: 'var(--shadow-tab-inner)' }} />
        </div>

        {/* ── Scrollable: outer shadow on the List (never inside scroll container) ── */}
        {scrollable && (
          <div
            ref={shadowRef}
            aria-hidden
            style={{
              ...pillBase,
              boxShadow:  '0px 1px 1.5px 0px var(--neutral-700-12), 1px 0px 0px 1px var(--neutral-100)',
              width:       0,
              visibility: pill ? 'visible' : 'hidden',
            }}
          />
        )}

        {/* ── Triggers row ── */}
        <div
          ref={rowRef}
          onScroll={scrollable ? handleScroll : undefined}
          onPointerDown={scrollable ? onRowPointerDown : undefined}
          onPointerMove={scrollable ? onRowPointerMove : undefined}
          onPointerUp={scrollable ? endDrag : undefined}
          onPointerCancel={scrollable ? endDrag : undefined}
          className={scrollable ? 'kds-tabs-scroll-row' : undefined}
          data-draggable={scrollable && overflowing ? 'true' : undefined}
          data-dragging={dragging ? 'true' : undefined}
          style={{
            position:   'relative',
            display:    'flex',
            gap:        '4px',
            alignItems: 'center',
            ...(fluid  && { flex: '1 0 0' }),
            ...(!fluid && { flexShrink: 0 }),
            ...(justify && { justifyContent: justify, width: '100%' }),
            ...(scrollable && {
              overflowX:           'auto',
              overscrollBehaviorX: 'contain',
              scrollbarWidth:      'none' as const,
              paddingLeft:         '1px',
              cursor:              overflowing ? (dragging ? 'grabbing' : 'grab') : undefined,
              userSelect:          dragging ? 'none' : undefined,
              touchAction:         'pan-x',
            }),
          }}
        >
          {/* In scrollable mode the active pill is handled by the hoisted
              shadowRef (glass border outside the scroll container). Rendering
              the white-bg + inner-shadow pair here as well would show two
              active indicators simultaneously, so we skip it entirely. */}
          {pill && !scrollable && (
            <>
              {/* White bg + outer shadow */}
              <motion.div
                aria-hidden
                style={{
                  ...pillBase,
                  backgroundColor: 'var(--tab-item-bg-selected)',
                  boxShadow: 'var(--shadow-tab-item-selected)',
                }}
                animate={{ x: pill.x, width: pill.width }}
                initial={false}
                transition={collapse ? springs.moderate : springs.fast}
              />
              {/* Inner bottom shadow — above the white bg */}
              <motion.div
                aria-hidden
                style={{ ...pillBase, boxShadow: 'var(--shadow-tab-item-selected-inner)' }}
                animate={{ x: pill.x, width: pill.width }}
                initial={false}
                transition={collapse ? springs.moderate : springs.fast}
              />
            </>
          )}
          {children}
        </div>
      </TabsPrimitive.List>
    </TabsSizeContext.Provider>
    </TabsFluidContext.Provider>
    </TabsCollapseContext.Provider>
    </TabsMaxLabelContext.Provider>
  )
}

TabsList.displayName = 'TabsList'

// ── Trigger ───────────────────────────────────────────────────────────────────

export function TabsTrigger({
  ref,
  children,
  icon,
  className,
  ...props
}: TabsTriggerProps & { ref?: React.Ref<React.ElementRef<typeof TabsPrimitive.Trigger>> }) {
  const size       = use(TabsSizeContext)
  const isFluid    = use(TabsFluidContext)
  const isCollapse = use(TabsCollapseContext)
  const maxLabelW  = use(TabsMaxLabelContext)
  return (
    // asChild makes Radix use Slot - it merges data-state, aria-selected, role="tab"
    // etc. onto TabItem, which reads data-state to derive its selected visual state.
    // disableSelectedStyle suppresses TabItem's own bg/shadow since TabsList's
    // animated pill handles the selected treatment.
    <TabsPrimitive.Trigger asChild ref={ref} {...props}>
      <TabItem icon={icon} size={size} disableSelectedStyle fluid={isFluid} collapse={isCollapse} reservedLabelWidth={maxLabelW} className={className}>
        {children}
      </TabItem>
    </TabsPrimitive.Trigger>
  )
}

TabsTrigger.displayName = 'TabsTrigger'

// ── Content ───────────────────────────────────────────────────────────────────

export function TabsContent({
  ref,
  children,
  className,
  ...props
}: TabsContentProps & { ref?: React.Ref<React.ElementRef<typeof TabsPrimitive.Content>> }) {
  return (
    <TabsPrimitive.Content ref={ref} className={cn(className)} {...props}>
      {children}
    </TabsPrimitive.Content>
  )
}

TabsContent.displayName = 'TabsContent'

// ── Compound export ───────────────────────────────────────────────────────────

export default Object.assign(Tabs, {
  List:    TabsList,
  Trigger: TabsTrigger,
  Content: TabsContent,
})
