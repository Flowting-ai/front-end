'use client'

import React from 'react'
import { cn } from '@/lib/utils'

// ── Width presets ─────────────────────────────────────────────────────────────
// All values are 8px-grid-aligned and sourced from cross-industry research:
//   sm  192px - compact context menus (4-5 short items, no icons)
//   md  240px - standard dropdown menu (Figma default, KDS baseline)
//   lg  280px - full menus with icons (Material Design + eBay Playbook standard)
//   xl  320px - rich content: long labels, sublabels, trailing meta

export const POPOVER_WIDTHS = {
  sm:  192,
  md:  240,
  lg:  280,
  xl:  320,
} as const

export type PopoverSize = keyof typeof POPOVER_WIDTHS

// ── Variants ──────────────────────────────────────────────────────────────────
// Two corner-radius presets per Figma 3206:31988:
//   modal    - 18px (default; used for confirmation/sheet-style surfaces)
//   dropdown - 12px (used by Dropdown / context menus / select popovers)

export type PopoverVariant = 'modal' | 'dropdown'

const VARIANT_RADIUS: Record<PopoverVariant, number> = {
  modal:    18,
  dropdown: 12,
}

// ── Default scroll cap ────────────────────────────────────────────────────────
// "≈7 items" rule - caps a dropdown that would otherwise grow taller than the
// reasonable comfort zone. 380 px holds 7 sublabel rows (5+22+16+5 = 48 px each
// + 4 px gaps + 16 px section padding) or up to ~10 plain rows. The viewport
// floor `calc(100dvh - 32px)` keeps the popover off the screen edge on short
// laptops and mobile rotations.
//
// Consumers can override with the `maxHeight` prop. Pass `false` to opt out
// (rare - typically for popovers whose content is intrinsically short).
export const POPOVER_DEFAULT_MAX_HEIGHT = 'min(380px, calc(100dvh - 32px))' as const

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PopoverProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Named width preset. Sets a fixed pixel width on the popover surface.
   * Omit for fluid (content-driven) width.
   *
   * | Size | Width | When to use |
   * |------|-------|-------------|
   * | `sm` | 192px | Compact context menus - 4–5 short items, no icons |
   * | `md` | 240px | Standard dropdown (KDS / Figma baseline) |
   * | `lg` | 280px | Full menus with icons (Material Design / eBay standard) |
   * | `xl` | 320px | Rich content - long labels, sublabels, trailing meta |
   */
  size?: PopoverSize
  /**
   * Surface variant - controls corner radius (Figma 3206:31988).
   *  - `modal`    (default) - 18 px radius. For confirmation dialogs / sheets.
   *  - `dropdown`           - 12 px radius. For dropdowns / context menus /
   *                           select popovers. The `<Dropdown>` organism sets
   *                           this automatically; consumers using `<Popover>`
   *                           directly for a menu-like surface should set it
   *                           explicitly.
   */
  variant?: PopoverVariant
  /**
   * Maximum height of the popover content. When the content exceeds this,
   * the surface scrolls internally - content past the cap is reachable via
   * scroll, never by growing the popover. Pass a number (px) or any CSS
   * length (e.g. `'min(420px, calc(100dvh - 24px))'`).
   *
   * Pass `false` to disable the cap and let the popover grow to fit content.
   *
   * Default - `min(380px, calc(100dvh - 32px))` (~7 sublabel rows, capped to
   * the viewport on short screens). The cap is applied to dropdown-style
   * surfaces so a 12-item menu shows ~7 rows + a softly-faded peek of the
   * next, with kaya-scrollbar revealing the rest. See `POPOVER_DEFAULT_MAX_HEIGHT`.
   */
  maxHeight?: number | string | false
  /**
   * Sticky header rendered ABOVE the scrollable content area. Use for
   * filter bars, search inputs, or any other content that must remain
   * visible while the items list scrolls. Sits inside the popover's
   * rounded clip but outside the scroll viewport so the scroll-edge fade
   * never paints over it. Figma reference: persona search submenu
   * (`3436:1591`).
   */
  header?: React.ReactNode
  /**
   * Content to render inside the popover surface.
   * Typically one or more `<DropdownSection>` components.
   */
  children?: React.ReactNode
}

// ── Scroll-edge fade ──────────────────────────────────────────────────────────
// Vertical fade implementation per `specs/patterns/scroll-edge-fade.md`:
//   • 4 progressive backdrop-blur layers (40 / 28 / 18 / 10 px depth,
//     2 / 3 / 5 / 6 px blur radii)
//   • 1 surface-colour gradient (40 px depth, popover-bg → transparent)
// Both edges (top + bottom) gate on `atTop / atBottom / overflowing` state
// derived from a scroll listener + ResizeObserver.

const VERTICAL_FADE_LAYERS = [
  { depth: 40, blur: 2 },
  { depth: 28, blur: 3 },
  { depth: 18, blur: 5 },
  { depth: 10, blur: 6 },
] as const

interface EdgeFadeProps {
  edge: 'top' | 'bottom'
  visible: boolean
}

function EdgeFade({ edge, visible }: EdgeFadeProps) {
  const isTop = edge === 'top'
  const inwardDir = isTop ? 'to bottom' : 'to top'
  const positionStyle: React.CSSProperties = isTop
    ? { top: 0, left: 0, right: 0 }
    : { bottom: 0, left: 0, right: 0 }
  return (
    <>
      {VERTICAL_FADE_LAYERS.map(({ depth, blur }, i) => (
        <div
          key={`${edge}-blur-${i}`}
          aria-hidden
          style={{
            position:           'absolute',
            ...positionStyle,
            height:             depth,
            backdropFilter:     `blur(${blur}px)`,
            WebkitBackdropFilter: `blur(${blur}px)`,
            maskImage:          `linear-gradient(${inwardDir}, black 0%, transparent 100%)`,
            WebkitMaskImage:    `linear-gradient(${inwardDir}, black 0%, transparent 100%)`,
            opacity:            visible ? 1 : 0,
            transition:         'opacity 150ms ease',
            pointerEvents:      'none',
            zIndex:             1,
          }}
        />
      ))}
      <div
        aria-hidden
        style={{
          position:        'absolute',
          ...positionStyle,
          height:          40,
          background:      `linear-gradient(${inwardDir}, var(--popover-bg) 0%, transparent 100%)`,
          opacity:         visible ? 1 : 0,
          transition:      'opacity 150ms ease',
          pointerEvents:   'none',
          zIndex:          1,
        }}
      />
    </>
  )
}

interface ScrollAreaProps {
  maxHeight: number | string
  children: React.ReactNode
}

function ScrollArea({ maxHeight, children }: ScrollAreaProps) {
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const [atTop, setAtTop]               = React.useState(true)
  const [atBottom, setAtBottom]         = React.useState(true)
  const [overflowing, setOverflowing]   = React.useState(false)

  const recompute = React.useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const isOverflowing = el.scrollHeight > el.clientHeight + 1
    setOverflowing(isOverflowing)
    setAtTop(el.scrollTop <= 0)
    setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 1)
  }, [])

  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    recompute()
    const ro = new ResizeObserver(recompute)
    ro.observe(el)
    for (const child of Array.from(el.children)) ro.observe(child as Element)
    return () => ro.disconnect()
  }, [recompute, children])

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div
        ref={scrollRef}
        className="kaya-scrollbar"
        onScroll={recompute}
        style={{
          maxHeight,
          overflowY:           'auto',
          overscrollBehaviorY: 'contain',
        }}
      >
        {children}
      </div>
      <EdgeFade edge="top"    visible={overflowing && !atTop} />
      <EdgeFade edge="bottom" visible={overflowing && !atBottom} />
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Floating surface shell for dropdown menus, command palettes, and context
 * menus. Provides the white rounded card with shadow - no positioning or
 * open/close logic. Wire to `@radix-ui/react-popover` or
 * `@radix-ui/react-dropdown-menu` Content for full behaviour.
 */
export const Popover = React.forwardRef<HTMLDivElement, PopoverProps>(
  function Popover(
    { size, variant = 'modal', maxHeight = POPOVER_DEFAULT_MAX_HEIGHT, header, children, className, style, ...props },
    ref,
  ) {
    const capped = maxHeight !== false
    return (
      <div
        ref={ref}
        className={cn(className)}
        style={{
          backgroundColor: 'var(--popover-bg)',
          borderRadius:    `${VARIANT_RADIUS[variant]}px`,
          overflow:        'hidden',
          boxShadow:       'var(--shadow-popover)',
          display:         'flex',
          flexDirection:   'column',
          width:           size ? `${POPOVER_WIDTHS[size]}px` : undefined,
          ...style,
        }}
        {...props}
      >
        {header && <div style={{ flexShrink: 0 }}>{header}</div>}
        {capped ? (
          <ScrollArea maxHeight={maxHeight as number | string}>{children}</ScrollArea>
        ) : (
          children
        )}
      </div>
    )
  },
)

Popover.displayName = 'Popover'

export default Popover
