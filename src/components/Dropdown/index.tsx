'use client'

/**
 * Dropdown — pre-composed compound component.
 *
 * Combines `Popover` (the surface shell) with `DropdownSection` and
 * `DropdownMenuItem` sub-components into a single import, so callers never
 * need to import three separate components just to render a menu.
 *
 * Usage:
 * ```tsx
 * <Dropdown size="md">
 *   <Dropdown.Section label="Actions" fluid>
 *     <Dropdown.Item label="Rename" icon={<EditIcon size={16} />} fluid />
 *     <Dropdown.Item label="Delete" fluid />
 *   </Dropdown.Section>
 * </Dropdown>
 * ```
 *
 * Wire to a Radix trigger for positioning + open/close:
 * ```tsx
 * <AnimatePresence>
 *   {open && (
 *     <motion.div {...DROPDOWN_SCALE_PRESET}>
 *       <Dropdown size="md">…</Dropdown>
 *     </motion.div>
 *   )}
 * </AnimatePresence>
 * ```
 */

import React from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Popover, type PopoverProps, type PopoverSize, type PopoverVariant, POPOVER_WIDTHS } from '@/components/Popover'
import { DropdownSection, type DropdownSectionProps } from '@/components/DropdownSection'
import { DropdownMenuItem, type DropdownMenuItemProps } from '@/components/DropdownMenuItem'

// Re-export for convenience — callers importing `Dropdown` get these for free.
export type { PopoverSize, PopoverVariant, DropdownSectionProps, DropdownMenuItemProps }
export { POPOVER_WIDTHS }

// ── Animation presets ─────────────────────────────────────────────────────────
// Spread onto a <motion.div> wrapping <Dropdown> inside <AnimatePresence>.
// Both presets use independent scaleX / scaleY so the menu squishes open
// rather than uniformly scaling — matching the article's signature look.
//
// Exit is always faster than enter. A slow exit reads as lag.

export const DROPDOWN_SCALE_PRESET = {
  initial:    { opacity: 0, scaleX: 0.95, scaleY: 0.75, transformOrigin: 'top center' as const },
  animate:    { opacity: 1, scaleX: 1,    scaleY: 1,    transformOrigin: 'top center' as const },
  exit:       { opacity: 0, scaleX: 0.97, scaleY: 0.85, transition: { duration: 0.12, ease: [0.55, 0.085, 0.68, 0.53] } },
  transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
} as const

export const DROPDOWN_SPRING_PRESET = {
  initial:    { opacity: 0, scaleX: 0.96, scaleY: 0.7,  transformOrigin: 'top center' as const },
  animate:    { opacity: 1, scaleX: 1,    scaleY: 1,    transformOrigin: 'top center' as const },
  exit:       { opacity: 0, scaleX: 0.97, scaleY: 0.85, transition: { duration: 0.1, ease: [0.55, 0.085, 0.68, 0.53] } },
  transition: { type: 'spring' as const, stiffness: 500, damping: 14, opacity: { duration: 0.15, ease: [0.16, 1, 0.3, 1] } },
} as const

/**
 * Per-item stagger for SpringDropdown. Pass `index` for each Dropdown.Item wrapper.
 * ```tsx
 * {items.map((item, i) => (
 *   <motion.div key={item} {...dropdownItemStagger(i)}>
 *     <Dropdown.Item label={item} fluid />
 *   </motion.div>
 * ))}
 * ```
 */
export function dropdownItemStagger(index: number) {
  return {
    initial:    { opacity: 0, x: -4 },
    animate:    { opacity: 1, x: 0 },
    transition: { type: 'spring' as const, stiffness: 600, damping: 25, delay: index * 0.04 },
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type DropdownProps = PopoverProps

interface DropdownCompound
  extends React.ForwardRefExoticComponent<DropdownProps & React.RefAttributes<HTMLDivElement>> {
  Section: typeof DropdownSection
  Item:    typeof DropdownMenuItem
}

// ── Component ─────────────────────────────────────────────────────────────────

const DropdownRoot = React.forwardRef<HTMLDivElement, DropdownProps>(
  function Dropdown({ variant = 'dropdown', children, ...props }, ref) {
    // Dropdowns default to the `dropdown` Popover variant (12 px radius per
    // Figma 3206:31988). Consumers can still override to `modal` if they
    // need an 18 px-radius surface for a non-menu popover.
    return (
      <Popover ref={ref} variant={variant} {...props}>
        {children}
      </Popover>
    )
  },
)

DropdownRoot.displayName = 'Dropdown'

// ── Placement system (Dropdown.Float) ─────────────────────────────────────────
// KDS dropdowns may appear in one of six placements relative to the trigger.
// Spec rules (USER-DEFINED — NEVER CHANGE UNLESS TOLD):
//   • Gap between trigger and dropdown is always 8 px.
//   • bottom-* and top-* placements align to one **side** of the trigger
//     (start = left edges aligned, end = right edges aligned).
//   • left-start and right-start align the dropdown's **top** to the
//     trigger's top.
//   • Dropdowns sit at z-index 9998 — exactly one layer below the
//     tooltip layer (9999), per the KDS overlay-z hierarchy.
// Use `<Dropdown.Float>` (below) to get all of this for free.

export type DropdownPlacement =
  | 'top-start'    | 'top-center'    | 'top-end'
  | 'bottom-start' | 'bottom-center' | 'bottom-end'
  | 'left-start'   | 'left-end'
  | 'right-start'  | 'right-end'

const DROPDOWN_GAP = 8
const DROPDOWN_Z   = 9998

// Per-placement transform-origin so the open/close animation appears to
// emanate from the trigger's edge.
const PLACEMENT_ORIGIN: Record<DropdownPlacement, string> = {
  'top-start':     'bottom left',
  'top-center':    'bottom center',
  'top-end':       'bottom right',
  'bottom-start':  'top left',
  'bottom-center': 'top center',
  'bottom-end':    'top right',
  'left-start':    'top right',
  'left-end':      'bottom right',
  'right-start':   'top left',
  'right-end':     'bottom left',
}

// Position style is split into TWO layers so centred placements can apply
// `translateX(-50%)` on a static wrapper without colliding with the
// scale/opacity transform on the inner motion.div.
//
// Viewport dimensions come from `document.documentElement.clientWidth/Height`,
// NOT `window.innerWidth/Height`. The latter includes the scrollbar, while
// `getBoundingClientRect` and `position: fixed` both work in drawable-area
// coordinates that exclude it. Using `innerWidth` for the right/bottom anchor
// shifts dropdowns by the scrollbar width (≈15 px on macOS).
function computeFloatStyle(
  rect: DOMRect,
  placement: DropdownPlacement,
  gap: number,
): React.CSSProperties {
  const vw = document.documentElement.clientWidth
  const vh = document.documentElement.clientHeight
  const cx = rect.left + rect.width / 2 // horizontal centre of trigger

  switch (placement) {
    case 'bottom-start':
      return { top: rect.bottom + gap, left: rect.left }
    case 'bottom-center':
      return { top: rect.bottom + gap, left: cx, transform: 'translateX(-50%)' }
    case 'bottom-end':
      return { top: rect.bottom + gap, right: vw - rect.right }
    case 'top-start':
      return { bottom: vh - rect.top + gap, left: rect.left }
    case 'top-center':
      return { bottom: vh - rect.top + gap, left: cx, transform: 'translateX(-50%)' }
    case 'top-end':
      return { bottom: vh - rect.top + gap, right: vw - rect.right }
    case 'right-start':
      return { top: rect.top, left: rect.right + gap }
    case 'right-end':
      return { bottom: vh - rect.bottom, left: rect.right + gap }
    case 'left-start':
      return { top: rect.top, right: vw - rect.left + gap }
    case 'left-end':
      return { bottom: vh - rect.bottom, right: vw - rect.left + gap }
  }
}

export interface DropdownFloatProps {
  /**
   * The trigger element. Receives a merged ref + an onClick wrapper that
   * toggles `open`. Pass any focusable interactive element (typically an
   * `<IconButton>` or `<Button>`).
   */
  trigger: React.ReactElement
  /** Controlled open state. */
  open: boolean
  /** Open-state setter. */
  onOpenChange: (open: boolean) => void
  /**
   * Position of the dropdown relative to the trigger. Defaults to `bottom-end`.
   *
   *  - `bottom-start` / `bottom-end` — below the trigger, left- or right-aligned.
   *  - `top-start`    / `top-end`    — above the trigger, left- or right-aligned.
   *  - `right-start`                 — to the right of the trigger, top-aligned.
   *  - `left-start`                  — to the left of the trigger, top-aligned.
   */
  placement?: DropdownPlacement
  /** Gap between trigger and dropdown. Defaults to 8 px (KDS standard). */
  offset?: number
  /** Dropdown content — typically a `<Dropdown>` containing one or more `<Dropdown.Section>`s. */
  children: React.ReactNode
}

/**
 * `Dropdown.Float` — controlled floating-menu wrapper. Handles:
 *  - Trigger ref + click-to-toggle wiring
 *  - Portal mounting to `document.body` (escapes ancestor `overflow`/`isolation`)
 *  - Placement-based positioning (`top-start`, `bottom-end`, `right-start`, …)
 *  - Click-outside + Escape close
 *  - Scroll/resize re-anchoring while open
 *  - Per-placement scale/opacity entry & exit (transform-origin = trigger edge)
 */
export function DropdownFloat({
  trigger,
  open,
  onOpenChange,
  placement = 'bottom-end',
  offset = DROPDOWN_GAP,
  children,
}: DropdownFloatProps) {
  // The trigger is wrapped in a static <span> so we can read a layout-box
  // rect that's *independent of any transforms applied inside the trigger
  // itself* (e.g. IconButton's `whileTap: { scale: 0.96 }`). Reading the
  // trigger's own getBoundingClientRect during whileTap exit returns the
  // scaled rect — that was anchoring `top-end` / `bottom-end` ~1 px short of
  // the trigger's true right edge. CSS `transform` on a child doesn't affect
  // its parent's layout box, so the wrapper's rect is always correct.
  const triggerWrapRef = React.useRef<HTMLSpanElement | null>(null)
  const panelRef       = React.useRef<HTMLDivElement | null>(null)
  const wasOpenRef     = React.useRef(false)
  const [posStyle, setPosStyle] = React.useState<React.CSSProperties>({})

  const recompute = React.useCallback(() => {
    const t = triggerWrapRef.current
    if (!t) return
    // Sideways placements + nested submenus: anchor to the parent dropdown
    // panel, NOT the trigger row. The user expects the submenu's bottom (or
    // top) to line up with the parent PANEL's edge — not with the row that
    // happens to be the trigger. Section padding inside the parent means
    // the last row's bottom sits 8 px above the panel's bottom; anchoring
    // to the row would leave the submenu's bottom that 8 px short. For
    // top/bottom placements we still anchor to the trigger because that's
    // what people expect there ("dropdown drops right under this row").
    let rect: DOMRect = t.getBoundingClientRect()
    const isSideways =
      placement === 'left-start'  || placement === 'left-end' ||
      placement === 'right-start' || placement === 'right-end'
    if (isSideways) {
      const parentPanel = t.closest('[data-kds-dropdown-panel]') as HTMLElement | null
      if (parentPanel) rect = parentPanel.getBoundingClientRect()
    }
    setPosStyle(computeFloatStyle(rect, placement, offset))
  }, [placement, offset])

  // Find all keyboard-navigable menu items (excluding disabled / aria-disabled).
  const getMenuItems = React.useCallback((): HTMLElement[] => {
    const root = panelRef.current
    if (!root) return []
    return Array.from(
      root.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not([data-disabled]):not([aria-disabled="true"])',
      ),
    )
  }, [])

  // Return focus to the trigger's focusable element (button, link, etc.)
  // when the menu closes via keyboard. Skips when the close was caused by a
  // mouse click — re-focusing on click can pull a focus ring back onto the
  // trigger that the user didn't ask for.
  const focusTrigger = React.useCallback(() => {
    const focusable =
      triggerWrapRef.current?.querySelector<HTMLElement>(
        'button, a[href], [role="button"], [tabindex]:not([tabindex="-1"])',
      )
    focusable?.focus()
  }, [])

  React.useLayoutEffect(() => {
    if (open) recompute()
  }, [open, recompute])

  // When the menu opens, move focus into it (first menu item). When it
  // closes after having been open via keyboard, return focus to the trigger.
  React.useEffect(() => {
    if (open) {
      // Defer one frame so the portal has mounted + framer-motion has
      // applied its initial styles.
      const id = requestAnimationFrame(() => {
        const items = getMenuItems()
        items[0]?.focus()
      })
      wasOpenRef.current = true
      return () => cancelAnimationFrame(id)
    }
    if (wasOpenRef.current) {
      // Closing — return focus to trigger only if focus is currently inside
      // the (now-unmounting) menu. If the user clicked outside, focus has
      // already moved elsewhere; don't yank it back.
      const focusInsideMenu =
        document.activeElement === document.body ||
        panelRef.current?.contains(document.activeElement)
      if (focusInsideMenu) focusTrigger()
      wasOpenRef.current = false
    }
  }, [open, getMenuItems, focusTrigger])

  React.useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerWrapRef.current?.contains(target)) return
      if (panelRef.current?.contains(target))       return
      // Nested-dropdown coordination: clicks inside ANY KDS dropdown panel
      // (including a submenu portaled to body that's logically nested under
      // this one) should NOT close this dropdown. Each panel marks itself
      // with `data-kds-dropdown-panel`; we walk up from the target to see
      // if it lives inside any of them. If yes, treat as still inside.
      const targetEl = target as Element
      if (typeof targetEl.closest === 'function' && targetEl.closest('[data-kds-dropdown-panel]')) return
      onOpenChange(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Only the dropdown that owns the focus closes on Escape — otherwise
        // pressing Escape inside a nested submenu would close the parent too.
        // Walk from `document.activeElement` to its closest panel; if that
        // panel exists and isn't this one, ignore (the topmost dropdown's
        // handler will fire).
        const active = document.activeElement as Element | null
        const ownerPanel = active?.closest?.('[data-kds-dropdown-panel]') ?? null
        if (ownerPanel && ownerPanel !== panelRef.current) return
        e.preventDefault()
        onOpenChange(false)
        return
      }
      // Menu navigation only fires when focus is in the menu.
      if (!panelRef.current?.contains(document.activeElement)) return
      const items = getMenuItems()
      if (items.length === 0) return
      const i = items.indexOf(document.activeElement as HTMLElement)
      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault()
          items[(i + 1) % items.length].focus()
          break
        }
        case 'ArrowUp': {
          e.preventDefault()
          items[i <= 0 ? items.length - 1 : i - 1].focus()
          break
        }
        case 'Home': {
          e.preventDefault()
          items[0].focus()
          break
        }
        case 'End': {
          e.preventDefault()
          items[items.length - 1].focus()
          break
        }
        case 'Tab': {
          // Per WAI-ARIA menu pattern, Tab dismisses the menu and lets the
          // browser advance focus to the next page focusable. We close the
          // menu but DON'T preventDefault — the natural Tab continues from
          // the trigger after focus is restored.
          onOpenChange(false)
          break
        }
      }
    }
    const onScrollOrResize = () => recompute()
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown',   onKey)
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown',   onKey)
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [open, onOpenChange, recompute, getMenuItems])

  // ARIA attributes on the trigger itself (focusable element); click handler
  // lives on the wrapper-span and bubbles up from any descendant click.
  const wiredTrigger = React.cloneElement(trigger, {
    'aria-haspopup': 'menu',
    'aria-expanded': open,
  } as React.HTMLAttributes<HTMLElement>)

  return (
    <>
      <span
        ref={triggerWrapRef}
        style={{ display: 'inline-flex' }}
        onClick={(e) => {
          e.stopPropagation()
          onOpenChange(!open)
        }}
      >
        {wiredTrigger}
      </span>
      {typeof window !== 'undefined' && createPortal(
        <AnimatePresence initial={false}>
          {open && (
            // Outer wrapper carries the fixed positioning + (for centred
            // placements only) a `translateX(-50%)`. Keeping the centring
            // transform off the motion.div is essential — framer-motion's
            // `scale` transform would otherwise collide with translate, and
            // we'd lose the centre alignment as soon as the menu animates.
            <div
              ref={panelRef}
              role="menu"
              data-kds-dropdown-panel
              style={{
                position: 'fixed',
                ...posStyle,
                zIndex:   DROPDOWN_Z,
              }}
            >
              <motion.div
                initial={{ opacity: 0, scaleX: 0.95, scaleY: 0.75 }}
                animate={{ opacity: 1, scaleX: 1,    scaleY: 1    }}
                exit={{    opacity: 0, scaleX: 0.97, scaleY: 0.85, transition: { duration: 0.12, ease: [0.55, 0.085, 0.68, 0.53] } }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                style={{ transformOrigin: PLACEMENT_ORIGIN[placement] }}
              >
                {children}
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}

DropdownFloat.displayName = 'Dropdown.Float'

// ── Dropdown.Submenu ──────────────────────────────────────────────────────────
// Hover-triggered nested dropdown. Differs from `Dropdown.Float` in three
// key ways, all driven by submenu UX conventions:
//
//   1. Opens on hover/focus (80 ms intent delay) and closes on leave
//      (220 ms grace period). Keyboard also opens.
//   2. Anchors VERTICALLY to the trigger row, HORIZONTALLY to the parent
//      dropdown panel — the submenu sits 8 px to the right of the parent
//      card's edge so the visible gap is consistent.
//   3. Vertically auto-flips: defaults to top-aligned with the trigger row.
//      If the submenu would overflow the viewport bottom, the bottom-edge
//      aligns with the trigger row instead.
//
// Safe triangle (frozen-vertex variant). Two facts make this hard:
//   • Travelling diagonally from the trigger to the submenu inevitably
//     crosses sibling rows; their `onMouseEnter` would steal hover.
//   • A "live cursor" triangle (re-computed every frame from the current
//     cursor) shrinks to nothing as the cursor moves and provides almost
//     no protection. The vertex must be FROZEN at the moment the user
//     starts moving rightward.
//
// Algorithm:
//   • While the submenu is open, listen for `pointermove`. The first
//     rightward sample (deltaX > 1 device-pixel) FREEZES the triangle
//     vertex at the cursor's current position. Any leftward sample past
//     the frozen vertex unfreezes it (user changed their mind).
//   • A `requestAnimationFrame` loop checks each frame whether the cursor
//     is inside the submenu rect, inside the grace triangle (frozen vertex
//     → submenu top-left −10 px → submenu bottom-left +10 px), or outside.
//   • While inside the safe triangle: clear any pending close timer AND
//     suppress `pointer-events` on the parent dropdown panel so sibling
//     rows can't fire their `onMouseEnter` and steal hover. When the
//     cursor exits the triangle, schedule an 80 ms close.
//   • Touch / pen pointers bypass the safe triangle entirely (only mouse
//     gets the grace zone).
//
// Reference: specs/components/dropdown.md § Submenus.

const SUBMENU_OPEN_DELAY  = 80
const SUBMENU_CLOSE_DELAY = 220
const SUBMENU_EXIT_CLOSE  = 80     // close after exiting safe triangle
const SUBMENU_LEAVE_CLOSE = 120    // close after leaving submenu panel
const SUBMENU_GAP         = DROPDOWN_GAP
const SAFE_TRIANGLE_PAD   = 10     // px extension beyond submenu top/bottom

export interface DropdownSubmenuProps {
  /**
   * The trigger row — typically a `<Dropdown.Item rightIcon={<ArrowRightOneIcon />}>`.
   * Receives a wrapping `<span>` ref + hover/focus/keyboard handlers via
   * the wrapper, so the trigger element itself is unmodified.
   */
  trigger: React.ReactElement
  /** Submenu contents — typically a `<Dropdown size="md">` with one or more sections. */
  children: React.ReactNode
  /** Optional: controlled open state. Omit for uncontrolled. */
  open?: boolean
  /** Optional: open-state setter for controlled mode. */
  onOpenChange?: (open: boolean) => void
}

type Point = { x: number; y: number }

// Even-odd ray-casting point-in-polygon test. Works for any simple polygon
// (including the 3-vertex grace triangle), not just convex shapes.
function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y
    const xj = polygon[j].x, yj = polygon[j].y
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function buildGraceTriangle(vertex: Point, submenuRect: DOMRect, padding = SAFE_TRIANGLE_PAD): Point[] {
  return [
    vertex,
    { x: submenuRect.left, y: submenuRect.top    - padding },
    { x: submenuRect.left, y: submenuRect.bottom + padding },
  ]
}

export function DropdownSubmenu({ trigger, children, open: controlledOpen, onOpenChange }: DropdownSubmenuProps) {
  const isControlled = controlledOpen !== undefined
  const [internalOpen, setInternalOpen] = React.useState(false)
  const open = isControlled ? !!controlledOpen : internalOpen
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next)
      onOpenChange?.(next)
    },
    [isControlled, onOpenChange],
  )

  const triggerWrapRef    = React.useRef<HTMLSpanElement | null>(null)
  const panelRef          = React.useRef<HTMLDivElement  | null>(null)
  const parentPanelRef    = React.useRef<HTMLElement     | null>(null)
  const openTimerRef      = React.useRef<number | null>(null)
  const closeTimerRef     = React.useRef<number | null>(null)
  const cursorRef         = React.useRef<Point>({ x: 0, y: 0 })
  const prevCursorXRef    = React.useRef<number>(0)
  const frozenVertexRef   = React.useRef<Point | null>(null)
  const inSafeZoneRef     = React.useRef<boolean>(false)
  const rafIdRef          = React.useRef<number>(0)
  const [posStyle, setPosStyle]               = React.useState<React.CSSProperties>({})
  const [openOriginAxis, setOpenOriginAxis]   = React.useState<'top' | 'bottom'>('top')
  // Horizontal axis: 'left' = submenu opens to the right of the parent panel
  // (default), 'right' = submenu opens to the LEFT of the parent panel
  // (auto-flipped when the right side would overflow the viewport).
  const [openOriginXAxis, setOpenOriginXAxis] = React.useState<'left' | 'right'>('left')

  const clearOpenTimer  = React.useCallback(() => {
    if (openTimerRef.current  != null) { clearTimeout(openTimerRef.current);  openTimerRef.current  = null }
  }, [])
  const clearCloseTimer = React.useCallback(() => {
    if (closeTimerRef.current != null) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null }
  }, [])

  const scheduleOpen = React.useCallback(() => {
    clearCloseTimer()
    if (open || openTimerRef.current != null) return
    openTimerRef.current = window.setTimeout(() => {
      openTimerRef.current = null
      setOpen(true)
    }, SUBMENU_OPEN_DELAY)
  }, [open, setOpen, clearCloseTimer])

  const scheduleClose = React.useCallback((ms: number = SUBMENU_CLOSE_DELAY) => {
    clearOpenTimer()
    if (closeTimerRef.current != null) clearTimeout(closeTimerRef.current)
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null
      setOpen(false)
      inSafeZoneRef.current   = false
      frozenVertexRef.current = null
      // Restore pointer-events on the parent dropdown panel in case we
      // suppressed them during the safe-zone phase.
      if (parentPanelRef.current) parentPanelRef.current.style.pointerEvents = ''
    }, ms)
  }, [setOpen, clearOpenTimer])

  React.useEffect(() => () => { clearOpenTimer(); clearCloseTimer() }, [clearOpenTimer, clearCloseTimer])

  // Compute placement once the panel mounts. Default: top-aligned with the
  // trigger row, 8 px to the right of the PARENT panel's edge. Flip
  // vertically when the submenu would overflow the bottom of the viewport.
  // We measure the panel's actual height (capped by Popover.maxHeight) so
  // the flip decision is exact.
  const recompute = React.useCallback(() => {
    const t = triggerWrapRef.current
    const p = panelRef.current
    if (!t || !p) return
    const rect = t.getBoundingClientRect()
    const parentPanel = t.closest('[data-kds-dropdown-panel]') as HTMLElement | null
    parentPanelRef.current = parentPanel
    const panelRect   = parentPanel ? parentPanel.getBoundingClientRect() : rect
    const vw          = document.documentElement.clientWidth
    const vh          = document.documentElement.clientHeight
    const panelWidth  = p.offsetWidth
    const panelHeight = p.offsetHeight

    // Horizontal placement — default opens to the right of the parent panel
    // (8 px gap, KDS standard). When that would overflow the viewport's
    // right edge AND the LEFT side has room, flip to open on the left of
    // the parent panel. The transform-origin follows the chosen edge so the
    // open animation emanates from the correct side. 8 px viewport-edge
    // safety margin on both sides.
    const rightAnchor    = panelRect.right + SUBMENU_GAP
    const overflowsRight = rightAnchor + panelWidth + 8 > vw
    const leftFlipFits   = panelRect.left - SUBMENU_GAP - panelWidth >= 8
    let leftStyle: number
    let originX: 'left' | 'right'
    if (overflowsRight && leftFlipFits) {
      leftStyle = panelRect.left - SUBMENU_GAP - panelWidth
      originX   = 'right'
    } else {
      leftStyle = rightAnchor
      originX   = 'left'
    }
    setOpenOriginXAxis(originX)

    const overflowsBelow = rect.top + panelHeight + 8 > vh
    if (overflowsBelow) {
      setOpenOriginAxis('bottom')
      setPosStyle({ left: leftStyle, bottom: vh - rect.bottom })
    } else {
      setOpenOriginAxis('top')
      setPosStyle({ left: leftStyle, top: rect.top })
    }
  }, [])

  React.useLayoutEffect(() => {
    if (open) recompute()
  }, [open, recompute])

  // Pointer-move tracker — feeds `cursorRef` and manages the frozen vertex.
  // Only mouse pointers participate in the safe triangle; touch / pen
  // pointers fall through to the standard close-grace flow.
  React.useEffect(() => {
    if (!open) return
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const cx = e.clientX
      const cy = e.clientY
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
      const threshold = Math.max(1, 1 / dpr)
      const deltaX = cx - prevCursorXRef.current
      // Rightward intent → FREEZE the triangle vertex here so the safe
      // zone is anchored to where the user committed to the gesture.
      if (deltaX > threshold && !frozenVertexRef.current) {
        frozenVertexRef.current = { x: cx, y: cy }
      } else if (frozenVertexRef.current && cx < frozenVertexRef.current.x) {
        // Cursor moved back to the left of the vertex → user is no longer
        // heading toward the submenu. Unfreeze and let the rAF loop fall
        // through to the standard exit path on the next sample.
        frozenVertexRef.current = null
      }
      prevCursorXRef.current = cx
      cursorRef.current = { x: cx, y: cy }
    }
    const onScrollOrResize = () => recompute()
    document.addEventListener('pointermove', onMove)
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      document.removeEventListener('pointermove', onMove)
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [open, recompute])

  // rAF loop — runs only while open. Per frame:
  //   • If cursor is inside the submenu rect → clear close, restore
  //     pointer-events on the parent panel.
  //   • Else if a vertex is frozen → check the grace triangle. Inside →
  //     keep open, suppress parent panel pointer-events so siblings can't
  //     steal hover. Outside (and we WERE in the zone) → schedule the
  //     short exit close.
  //   • Else → no special handling; the standard trigger / submenu leave
  //     handlers manage the close.
  // The early-return when the cursor hasn't moved keeps the loop nearly
  // free in the steady state.
  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    let lastCx = NaN, lastCy = NaN
    const loop = () => {
      if (cancelled) return
      const sub = panelRef.current
      if (!sub) { rafIdRef.current = requestAnimationFrame(loop); return }
      const cursor = cursorRef.current
      if (cursor.x === lastCx && cursor.y === lastCy) {
        rafIdRef.current = requestAnimationFrame(loop)
        return
      }
      lastCx = cursor.x; lastCy = cursor.y
      const subRect = sub.getBoundingClientRect()
      const inSubmenu =
        cursor.x >= subRect.left && cursor.x <= subRect.right &&
        cursor.y >= subRect.top  && cursor.y <= subRect.bottom
      if (inSubmenu) {
        clearCloseTimer()
        if (parentPanelRef.current) parentPanelRef.current.style.pointerEvents = ''
        rafIdRef.current = requestAnimationFrame(loop)
        return
      }
      const frozen = frozenVertexRef.current
      if (frozen) {
        const polygon = buildGraceTriangle(frozen, subRect)
        const isInZone = isPointInPolygon(cursor, polygon)
        if (isInZone) {
          if (!inSafeZoneRef.current) inSafeZoneRef.current = true
          clearCloseTimer()
        } else if (inSafeZoneRef.current) {
          inSafeZoneRef.current = false
          scheduleClose(SUBMENU_EXIT_CLOSE)
        }
      } else if (inSafeZoneRef.current) {
        inSafeZoneRef.current = false
      }
      // Suppress hover on the parent panel while inside the safe zone so
      // sibling rows can't fire `onMouseEnter` and steal hover.
      const parent = parentPanelRef.current
      if (parent) {
        parent.style.pointerEvents = (frozen && inSafeZoneRef.current) ? 'none' : ''
      }
      rafIdRef.current = requestAnimationFrame(loop)
    }
    rafIdRef.current = requestAnimationFrame(loop)
    return () => {
      cancelled = true
      cancelAnimationFrame(rafIdRef.current)
      // Always restore pointer-events on teardown — never leave the parent
      // panel inert if the submenu unmounts mid-interaction.
      if (parentPanelRef.current) parentPanelRef.current.style.pointerEvents = ''
    }
  }, [open, scheduleClose, clearCloseTimer])

  // Trigger leave is straightforward when the rAF loop owns the safe-zone
  // logic: just schedule the standard grace close. If the user is inside
  // the safe triangle, the loop will clear this on the next frame.
  const handleTriggerLeave = React.useCallback(() => {
    scheduleClose(SUBMENU_CLOSE_DELAY)
  }, [scheduleClose])

  // Keyboard wiring on the wrapper span — applies to whatever focusable
  // element lives inside the trigger row.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
      if (!open) {
        e.preventDefault()
        clearOpenTimer()
        setOpen(true)
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        clearCloseTimer()
        setOpen(false)
      }
    }
  }

  // Wire ARIA + the submenu's open state onto the trigger element so
  // screen readers announce it correctly.
  const wiredTrigger = React.cloneElement(trigger, {
    'aria-haspopup': 'menu',
    'aria-expanded': open,
  } as React.HTMLAttributes<HTMLElement>)

  // Open/close animation origin matches the placement axis: top-aligned
  // submenus emanate from the upper-left corner; bottom-aligned from the
  // lower-left.
  const transformOrigin = `${openOriginAxis} ${openOriginXAxis}`

  return (
    <>
      <span
        ref={triggerWrapRef}
        style={{ display: 'block' }}
        onMouseEnter={() => { frozenVertexRef.current = null; scheduleOpen() }}
        onMouseLeave={handleTriggerLeave}
        onFocus={(e) => {
          // Only open the submenu when focus arrives via a real keyboard
          // gesture (Tab / arrow keys / Enter on the trigger). The parent
          // `Dropdown.Float` programmatically focuses `items[0]` one frame
          // after open — for a mouse click that focus is NOT `:focus-visible`,
          // and we must not auto-open the first submenu just because the
          // dropdown was opened. (Without this gate, clicking a Filter button
          // whose first row is a submenu trigger would immediately cascade
          // into the first submenu — the original bug surfaced in the
          // Pinboard Filter dropdown.)
          const target = e.target as HTMLElement
          if (typeof target.matches === 'function' && target.matches(':focus-visible')) {
            scheduleOpen()
          }
        }}
        onKeyDown={onKeyDown}
      >
        {wiredTrigger}
      </span>
      {typeof window !== 'undefined' && createPortal(
        <AnimatePresence initial={false}>
          {open && (
            <div
              ref={panelRef}
              role="menu"
              data-kds-dropdown-panel
              onMouseEnter={() => { clearCloseTimer(); inSafeZoneRef.current = false; frozenVertexRef.current = null }}
              onMouseLeave={() => scheduleClose(SUBMENU_LEAVE_CLOSE)}
              style={{
                position: 'fixed',
                ...posStyle,
                zIndex:   DROPDOWN_Z,
              }}
            >
              <motion.div
                initial={{ opacity: 0, scaleX: 0.95, scaleY: 0.75 }}
                animate={{ opacity: 1, scaleX: 1,    scaleY: 1    }}
                exit={{    opacity: 0, scaleX: 0.97, scaleY: 0.85, transition: { duration: 0.12, ease: [0.55, 0.085, 0.68, 0.53] } }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                style={{ transformOrigin }}
              >
                {children}
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}

DropdownSubmenu.displayName = 'Dropdown.Submenu'

interface DropdownCompoundExtended extends DropdownCompound {
  Float:   typeof DropdownFloat
  Submenu: typeof DropdownSubmenu
}

export const Dropdown = Object.assign(DropdownRoot, {
  Section: DropdownSection,
  Item:    DropdownMenuItem,
  Float:   DropdownFloat,
  Submenu: DropdownSubmenu,
}) as DropdownCompoundExtended

export default Dropdown
