'use client'

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { animate, motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { springs } from '@/lib/springs'
import { TabItem } from '@/components/TabItem'

// ── Size context — set by TabsList, consumed by TabsTrigger ───────────────────

type TabsSize = 'medium' | 'small'
const TabsSizeContext = React.createContext<TabsSize>('medium')

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TabsListProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> {
  /**
   * When true the List fills its parent width and only the triggers row
   * scrolls horizontally. The beige pill background stays fixed at the
   * container width — it does not grow with the content.
   */
  scrollable?: boolean
  /** Size variant — medium (default) or small. Propagates to all TabsTrigger children via context. */
  size?: TabsSize
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
// Default mode — inline-flex, sizes to content. Pill layers (bg + shadow)
// live inside rowRef, animated via Framer motion animate prop.
//
// Scrollable mode — display:block fills the parent container. rowRef has
// overflow-x:auto. The List clips in X (overflow-x:clip) so the shadow
// never bleeds past the edges, while overflow-y:visible (CSS spec preserves
// it when the other axis is clip, not auto/hidden/scroll) lets the bottom
// drop-shadow render past the border.
//
// The outer drop-shadow is hoisted to the List level (outside the scroll
// container) so it is never clipped by the scroll container. Its DOM style
// is updated two ways — both via direct style mutation to avoid any
// React or Framer Motion render-cycle lag:
//   • Tab switch → spring via animate(from, to, { onUpdate }) → style.transform / style.width
//   • Scroll     → shadowEl.style.transform directly — frame-perfect, zero lag

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  TabsListProps
>(function TabsList({ children, className, scrollable, size = 'medium', ...props }, ref) {
  const isSmall  = size === 'small'
  const radius   = isSmall ? '8px' : '10px'

  const rowRef    = useRef<HTMLDivElement>(null)
  const shadowRef = useRef<HTMLDivElement>(null)
  const [pill, setPill] = useState<{ x: number; width: number } | null>(null)

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
    const observer = new MutationObserver(measure)
    observer.observe(row, { attributes: true, subtree: true, attributeFilter: ['data-state'] })
    return () => observer.disconnect()
  }, [measure])

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
    top:           0,
    bottom:        0,
    borderRadius:  radius,
    pointerEvents: 'none',
  }

  return (
    <TabsSizeContext.Provider value={size}>
      <TabsPrimitive.List
        ref={ref}
        className={cn(className)}
        style={{
          position:   'relative',
          display:    scrollable ? 'block' : 'inline-flex',
          alignItems: 'flex-start',
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
          style={{
            position:   'relative',
            display:    'flex',
            gap:        '4px',
            alignItems: 'center',
            flexShrink: 0,
            ...(scrollable && {
              overflowX:           'auto',
              overscrollBehaviorX: 'contain',
              scrollbarWidth:      'none' as const,
              paddingLeft:         '1px',
            }),
          }}
        >
          {pill && (
            <>
              {/* White bg — in scrollable mode has no outer shadow (hoisted above) */}
              <motion.div
                aria-hidden
                style={{
                  ...pillBase,
                  backgroundColor: 'var(--tab-item-bg-selected)',
                  ...(!scrollable && { boxShadow: 'var(--shadow-tab-item-selected)' }),
                }}
                animate={{ x: pill.x, width: pill.width }}
                initial={false}
                transition={springs.fast}
              />
              {/* Inner bottom shadow — above the white bg */}
              <motion.div
                aria-hidden
                style={{ ...pillBase, boxShadow: 'var(--shadow-tab-item-selected-inner)' }}
                animate={{ x: pill.x, width: pill.width }}
                initial={false}
                transition={springs.fast}
              />
            </>
          )}
          {children}
        </div>
      </TabsPrimitive.List>
    </TabsSizeContext.Provider>
  )
})

TabsList.displayName = 'TabsList'

// ── Trigger ───────────────────────────────────────────────────────────────────

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps
>(function TabsTrigger({ children, icon, className, ...props }, ref) {
  const size = React.useContext(TabsSizeContext)
  return (
    // asChild makes Radix use Slot — it merges data-state, aria-selected, role="tab"
    // etc. onto TabItem, which reads data-state to derive its selected visual state.
    // disableSelectedStyle suppresses TabItem's own bg/shadow since TabsList's
    // animated pill handles the selected treatment.
    <TabsPrimitive.Trigger asChild ref={ref} {...props}>
      <TabItem icon={icon} size={size} disableSelectedStyle className={className}>
        {children}
      </TabItem>
    </TabsPrimitive.Trigger>
  )
})

TabsTrigger.displayName = 'TabsTrigger'

// ── Content ───────────────────────────────────────────────────────────────────

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  TabsContentProps
>(function TabsContent({ children, className, ...props }, ref) {
  return (
    <TabsPrimitive.Content ref={ref} className={cn(className)} {...props}>
      {children}
    </TabsPrimitive.Content>
  )
})

TabsContent.displayName = 'TabsContent'

// ── Compound export ───────────────────────────────────────────────────────────

export default Object.assign(Tabs, {
  List:    TabsList,
  Trigger: TabsTrigger,
  Content: TabsContent,
})
