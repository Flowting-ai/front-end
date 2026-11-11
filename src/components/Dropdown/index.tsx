'use client'

/**
 * Dropdown - pre-composed compound component.
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
 * For a floating menu with trigger, positioning and keyboard support use
 * `<Dropdown.Float>` (Radix DropdownMenu underneath). Static usage:
 * ```tsx
 * <AnimatePresence>
 *   {open && (
 *     <m.div {...DROPDOWN_SCALE_PRESET}>
 *       <Dropdown size="md">…</Dropdown>
 *     </m.div>
 *   )}
 * </AnimatePresence>
 * ```
 */

import React from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Popover, type PopoverProps, type PopoverSize, type PopoverVariant, POPOVER_WIDTHS } from '@/components/Popover'
import { DropdownSection, type DropdownSectionProps } from '@/components/DropdownSection'
import { DropdownMenuItem, type DropdownMenuItemProps } from '@/components/DropdownMenuItem'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuPortal, DropdownMenuContent,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
  MenuModeContext, useMenuMode, SlotFocusContext,
} from '@/components/ui/dropdown-menu'

// Re-export for convenience - callers importing `Dropdown` get these for free.
export type { PopoverSize, PopoverVariant, DropdownSectionProps, DropdownMenuItemProps }
export { POPOVER_WIDTHS }

// ── Animation presets ─────────────────────────────────────────────────────────
// Spread onto a <m.div> wrapping <Dropdown> inside <AnimatePresence>.
// Both presets use independent scaleX / scaleY so the menu squishes open
// rather than uniformly scaling - matching the article's signature look.
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
 *   <m.div key={item} {...dropdownItemStagger(i)}>
 *     <Dropdown.Item label={item} fluid />
 *   </m.div>
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

interface DropdownCompound {
  Section: typeof DropdownSection
  Item:    typeof DropdownMenuItem
}

// ── Component ─────────────────────────────────────────────────────────────────

function DropdownRoot({ variant = 'dropdown', children, ref, ...props }: DropdownProps & { ref?: React.Ref<HTMLDivElement> }) {
  // Dropdowns default to the `dropdown` Popover variant (12 px radius per
  // Figma 3206:31988). Consumers can still override to `modal` if they
  // need an 18 px-radius surface for a non-menu popover.
  return (
    <Popover ref={ref} variant={variant} {...props}>
      {children}
    </Popover>
  )
}

DropdownRoot.displayName = 'Dropdown'

// ── Placement system (Dropdown.Float) ─────────────────────────────────────────
// KDS dropdowns may appear in one of ten placements relative to the trigger.
// Spec rules (USER-DEFINED - NEVER CHANGE UNLESS TOLD):
//   • Gap between trigger and dropdown is always 8 px.
//   • bottom-* and top-* placements align to one **side** of the trigger
//     (start = left edges aligned, end = right edges aligned).
//   • left-* and right-* placements anchor to the PARENT dropdown panel when
//     the trigger lives inside one (nested menus), otherwise to the trigger.
//   • Dropdowns sit at z-index 9998 - exactly one layer below the
//     tooltip layer (9999), per the KDS overlay-z hierarchy.
// Positioning, dismissal, focus management and keyboard navigation are all
// delegated to Radix DropdownMenu.

export type DropdownPlacement =
  | 'top-start'    | 'top-center'    | 'top-end'
  | 'bottom-start' | 'bottom-center' | 'bottom-end'
  | 'left-start'   | 'left-end'
  | 'right-start'  | 'right-end'

const DROPDOWN_GAP = 8
const DROPDOWN_Z   = 9998

type Side  = 'top' | 'bottom' | 'left' | 'right'
type Align = 'start' | 'center' | 'end'

function splitPlacement(placement: DropdownPlacement): { side: Side; align: Align } {
  const [side, align] = placement.split('-') as [Side, Align]
  return { side, align }
}

const PANEL_SELECTOR = '[data-kds-dropdown-panel]'

const MENU_ANIMATION = {
  initial:    { opacity: 0, scaleX: 0.95, scaleY: 0.75 },
  animate:    { opacity: 1, scaleX: 1,    scaleY: 1    },
  exit:       { opacity: 0, scaleX: 0.97, scaleY: 0.85, transition: { duration: 0.12, ease: [0.55, 0.085, 0.68, 0.53] as const } },
  transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const },
}

const MENU_ORIGIN_STYLE: React.CSSProperties = {
  transformOrigin: 'var(--radix-dropdown-menu-content-transform-origin)',
}

function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || typeof el.closest !== 'function') return false
  return !!el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')
}

/**
 * Keeps text fields inside a menu usable: Radix's typeahead / Tab trapping
 * would otherwise swallow keystrokes typed into an `<input>` in the panel.
 * Escape still bubbles so the menu can close.
 */
function EditableKeyGuard({ children }: { children: React.ReactNode }) {
  return (    <div
      style={{ display: 'contents' }}
      onKeyDown={(e) => {
        if (e.key !== 'Escape' && isEditableTarget(e.target)) e.stopPropagation()
      }}
    >
      {children}
    </div>
  )
}

export interface DropdownFloatProps {
  /**
   * The trigger element. Wrapped in a `<span>` that acts as the Radix trigger
   * (opens/closes on pointer + keyboard). Pass any focusable interactive
   * element (typically an `<IconButton>` or `<Button>`).
   */
  trigger: React.ReactElement
  /** Controlled open state. */
  open: boolean
  /** Open-state setter. */
  onOpenChange: (open: boolean) => void
  /** Position of the dropdown relative to the trigger. Defaults to `bottom-end`. */
  placement?: DropdownPlacement
  /** Gap between trigger and dropdown. Defaults to 8 px (KDS standard). */
  offset?: number
  /**
   * Opt-in collision handling - flips / shifts the panel so it stays inside
   * the viewport (e.g. a chat row near the bottom of a scrolling sidebar).
   * Defaults to `false`: the exact placement from the spec table is kept.
   */
  autoFlipVertical?: boolean
  /**
   * Called with the side the panel actually opened on, once it is mounted and
   * again if `autoFlipVertical` flips it. Lets a trigger reflect the real
   * direction (e.g. the composer's model button pointing up when its menu
   * drops up). Must be stable - wrap it in `useCallback`.
   */
  onSideChange?: (side: Side) => void
  /** Dropdown content - typically a `<Dropdown>` containing one or more `<Dropdown.Section>`s. */
  children: React.ReactNode
}

/**
 * `Dropdown.Float` - controlled floating menu built on Radix DropdownMenu.
 * Radix handles portal mounting, placement, outside-click / Escape
 * dismissal, roving focus, typeahead and ARIA. This wrapper adds the KDS
 * z-index, gap, nested-panel anchoring and the scale/opacity animation.
 */
export function DropdownFloat({
  trigger,
  open,
  onOpenChange,
  placement = 'bottom-end',
  offset = DROPDOWN_GAP,
  autoFlipVertical = false,
  onSideChange,
  children,
}: DropdownFloatProps) {
  // Static wrapper: its layout box is unaffected by transforms applied inside
  // the trigger (e.g. IconButton's whileTap scale), so anchoring stays exact.
  const triggerWrapRef       = React.useRef<HTMLSpanElement | null>(null)
  const interactedOutsideRef = React.useRef(false)
  const { side, align } = splitPlacement(placement)
  const isSideways = side === 'left' || side === 'right'

  // Sideways placements inside another dropdown anchor to the PARENT panel's
  // edges rather than the trigger row, so a nested menu lines up with the
  // parent card. Radix anchors to the trigger, so convert that to offsets.
  const [nested, setNested] = React.useState({ side: 0, align: 0 })
  React.useLayoutEffect(() => {
    if (!open || !isSideways) return
    const t = triggerWrapRef.current
    const panel = t?.closest(PANEL_SELECTOR) as HTMLElement | null
    if (!t || !panel) return
    const r = t.getBoundingClientRect()
    const p = panel.getBoundingClientRect()
    setNested({
      side:  side === 'right' ? p.right - r.right : r.left - p.left,
      align: align === 'end' ? r.bottom - p.bottom : p.top - r.top,
    })
  }, [open, isSideways, side, align])

  // Radix writes the resolved side onto the content element as `data-side`
  // (after collision handling), so that attribute - watched, since a flip can
  // happen while the panel is open - is the only honest source for it.
  const panelRef = React.useRef<HTMLDivElement | null>(null)
  React.useEffect(() => {
    const el = panelRef.current
    if (!open || !el || !onSideChange) return
    const report = () => {
      const resolved = el.getAttribute('data-side')
      if (resolved) onSideChange(resolved as Side)
    }
    report()
    const observer = new MutationObserver(report)
    observer.observe(el, { attributes: true, attributeFilter: ['data-side'] })
    return () => observer.disconnect()
  }, [open, onSideChange])

  const focusTrigger = () => {
    triggerWrapRef.current
      ?.querySelector<HTMLElement>('button, a[href], [role="button"], [tabindex]:not([tabindex="-1"])')
      ?.focus()
  }

  const wiredTrigger = React.cloneElement(trigger, {
    'aria-haspopup': 'menu',
    'aria-expanded': open,
  } as React.HTMLAttributes<HTMLElement>)

  return (
    <DropdownMenu
      modal={false}
      open={open}
      onOpenChange={(next) => {
        if (next) interactedOutsideRef.current = false
        onOpenChange(next)
      }}
    >
      <DropdownMenuTrigger asChild>
        <span
          ref={triggerWrapRef}
          style={{ display: 'inline-flex' }}
          // Clicks on the trigger never reach ancestor rows (e.g. a chat row
          // that navigates on click). Keyboard-synthesised clicks (`detail`
          // 0 - e.g. Enter on a nested menu item used as trigger) toggle here,
          // since Radix itself only listens for pointerdown / its own keydown.
          onClick={(e) => {
            e.stopPropagation()
            if (e.detail === 0) onOpenChange(!open)
          }}
        >
          {wiredTrigger}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuPortal forceMount>
        <AnimatePresence initial={false}>
          {open && (
            <DropdownMenuContent
              forceMount
              asChild
              side={side}
              align={align}
              sideOffset={offset + nested.side}
              alignOffset={nested.align}
              avoidCollisions={autoFlipVertical}
              collisionPadding={8}
              data-kds-dropdown-panel=""
              style={{ zIndex: DROPDOWN_Z, outline: 'none' }}
              onCloseAutoFocus={(e) => {
                e.preventDefault()
                if (!interactedOutsideRef.current) focusTrigger()
              }}
              onInteractOutside={(e) => {
                // Clicks / focus inside ANY KDS dropdown panel (e.g. a nested
                // menu portaled to body) don't close this one.
                const target = e.target as Element | null
                if (target && typeof target.closest === 'function' && target.closest(PANEL_SELECTOR)) {
                  e.preventDefault()
                  return
                }
                interactedOutsideRef.current = true
              }}
              onKeyDown={(e) => {
                // WAI-ARIA menu pattern: Tab dismisses the menu.
                if (e.key === 'Tab') onOpenChange(false)
              }}
            >
              <m.div ref={panelRef} {...MENU_ANIMATION} style={MENU_ORIGIN_STYLE}>
                <MenuModeContext.Provider value="menu">
                  <EditableKeyGuard>{children}</EditableKeyGuard>
                </MenuModeContext.Provider>
              </m.div>
            </DropdownMenuContent>
          )}
        </AnimatePresence>
      </DropdownMenuPortal>
    </DropdownMenu>
  )
}

DropdownFloat.displayName = 'Dropdown.Float'

// ── Dropdown.Submenu ──────────────────────────────────────────────────────────
// Hover-triggered nested menu built on Radix `DropdownMenu.Sub`. Radix owns
// hover intent, the pointer-grace "safe triangle", ArrowRight / ArrowLeft /
// Escape handling and viewport collision flipping. The submenu sits 8 px
// outside the PARENT panel's edge and aligns with that panel's top or bottom,
// matching the direction the parent itself opened in.
//
// Meant to be rendered inside a `Dropdown.Float`. Outside any Radix menu it
// falls back to a hover-opened standalone floating menu.

const SUBMENU_OPEN_DELAY  = 80
const SUBMENU_CLOSE_DELAY = 220

export interface DropdownSubmenuProps {
  /** The trigger row - typically a `<Dropdown.Item rightIcon={<ArrowRightOneIcon />}>`. */
  trigger: React.ReactElement
  /** Submenu contents - typically a `<Dropdown size="md">` with one or more sections. */
  children: React.ReactNode
  /** Optional: controlled open state. Omit for uncontrolled. */
  open?: boolean
  /** Optional: open-state setter for controlled mode. */
  onOpenChange?: (open: boolean) => void
}

function useControllableOpen(controlledOpen: boolean | undefined, onOpenChange?: (open: boolean) => void) {
  const isControlled = controlledOpen !== undefined
  const [internalOpen, setInternalOpen] = React.useState(false)
  const open = isControlled ? !!controlledOpen : internalOpen
  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next)
    onOpenChange?.(next)
  }
  return [open, setOpen] as const
}

function wireSubTrigger(trigger: React.ReactElement, open: boolean) {
  return React.cloneElement(trigger, {
    'aria-haspopup': 'menu',
    'aria-expanded': open,
  } as React.HTMLAttributes<HTMLElement>)
}

export function DropdownSubmenu(props: DropdownSubmenuProps) {
  const mode = useMenuMode()
  return mode === 'menu' ? <RadixSubmenu {...props} /> : <StandaloneSubmenu {...props} />
}

function RadixSubmenu({ trigger, children, open: controlledOpen, onOpenChange }: DropdownSubmenuProps) {
  const [open, setOpen] = useControllableOpen(controlledOpen, onOpenChange)
  const triggerRef = React.useRef<HTMLSpanElement | null>(null)
  // Radix focuses this wrapper span when the row is the active item; the row
  // inside reads it (SlotFocusContext) to paint its highlight.
  const [triggerFocused, setTriggerFocused] = React.useState(false)
  // Distance from the trigger row's edge to the parent panel's edge, so the
  // submenu clears the PARENT card by exactly the KDS gap.
  const [panelInset, setPanelInset] = React.useState(0)
  // Shift along the vertical axis. Radix aligns a submenu's top to its trigger
  // ROW, which leaves it starting mid-panel. This lines it up with the parent
  // panel's own edge instead - its TOP when the parent dropped down, its BOTTOM
  // when the parent dropped up - so the two cards read as one block opening in
  // the same direction.
  const [alignOffset, setAlignOffset] = React.useState(0)
  const subPanelRef = React.useRef<HTMLDivElement | null>(null)
  React.useLayoutEffect(() => {
    if (!open) return
    const t = triggerRef.current
    const panel = t?.closest(PANEL_SELECTOR) as HTMLElement | null
    if (!t || !panel) return
    const panelRect   = panel.getBoundingClientRect()
    const triggerRect = t.getBoundingClientRect()
    setPanelInset(Math.max(0, panelRect.right - triggerRect.right))
    // Radix writes the direction it resolved onto the parent panel.
    const parentSide = panel.getAttribute('data-side')
    // offsetHeight, not a bounding rect: the panel is mid enter-animation here
    // and its scale would skew a measured rect.
    const subHeight = subPanelRef.current?.offsetHeight ?? 0
    setAlignOffset(
      parentSide === 'top'
        ? panelRect.bottom - triggerRect.top - subHeight
        : panelRect.top - triggerRect.top,
    )
  }, [open])

  return (
    <DropdownMenuSub open={open} onOpenChange={setOpen}>
      <DropdownMenuSubTrigger asChild>
        <span
          ref={triggerRef}
          style={{ display: 'block', outline: 'none' }}
          onFocus={() => setTriggerFocused(true)}
          onBlur={() => setTriggerFocused(false)}
        >
          <MenuModeContext.Provider value="slotted">
            <SlotFocusContext.Provider value={triggerFocused}>
              {wireSubTrigger(trigger, open)}
            </SlotFocusContext.Provider>
          </MenuModeContext.Provider>
        </span>
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal forceMount>
        <AnimatePresence initial={false}>
          {open && (
            <DropdownMenuSubContent
              forceMount
              asChild
              sideOffset={DROPDOWN_GAP + panelInset}
              alignOffset={alignOffset}
              collisionPadding={8}
              data-kds-dropdown-panel=""
              style={{ zIndex: DROPDOWN_Z, outline: 'none' }}
            >
              <m.div ref={subPanelRef} {...MENU_ANIMATION} style={MENU_ORIGIN_STYLE}>
                <MenuModeContext.Provider value="menu">
                  <EditableKeyGuard>{children}</EditableKeyGuard>
                </MenuModeContext.Provider>
              </m.div>
            </DropdownMenuSubContent>
          )}
        </AnimatePresence>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  )
}

/** Fallback for a Submenu rendered outside any Radix menu. */
function StandaloneSubmenu({ trigger, children, open: controlledOpen, onOpenChange }: DropdownSubmenuProps) {
  const [open, setOpen] = useControllableOpen(controlledOpen, onOpenChange)
  const timerRef = React.useRef<number | null>(null)
  const clear = () => {
    if (timerRef.current != null) { clearTimeout(timerRef.current); timerRef.current = null }
  }
  const schedule = (next: boolean) => {
    clear()
    if (next === open) return
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      setOpen(next)
    }, next ? SUBMENU_OPEN_DELAY : SUBMENU_CLOSE_DELAY)
  }
  React.useEffect(() => () => {
    if (timerRef.current != null) clearTimeout(timerRef.current)
  }, [])

  return (    <div style={{ display: 'block' }} onMouseEnter={() => schedule(true)} onMouseLeave={() => schedule(false)}>
      <DropdownFloat
        open={open}
        onOpenChange={(next) => { clear(); setOpen(next) }}
        placement="right-start"
        trigger={<span style={{ display: 'block', width: '100%' }}>{wireSubTrigger(trigger, open)}</span>}
      >        <div onMouseEnter={clear} onMouseLeave={() => schedule(false)}>{children}</div>
      </DropdownFloat>
    </div>
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
}) as typeof DropdownRoot & DropdownCompoundExtended

export default Dropdown
