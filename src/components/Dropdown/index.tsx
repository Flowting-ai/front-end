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
import { Popover, type PopoverProps, type PopoverSize, POPOVER_WIDTHS } from '@/components/Popover'
import { DropdownSection, type DropdownSectionProps } from '@/components/DropdownSection'
import { DropdownMenuItem, type DropdownMenuItemProps } from '@/components/DropdownMenuItem'

// Re-export for convenience — callers importing `Dropdown` get these for free.
export type { PopoverSize, DropdownSectionProps, DropdownMenuItemProps }
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
  function Dropdown({ children, ...props }, ref) {
    return (
      <Popover ref={ref} {...props}>
        {children}
      </Popover>
    )
  },
)

DropdownRoot.displayName = 'Dropdown'

export const Dropdown = Object.assign(DropdownRoot, {
  Section: DropdownSection,
  Item:    DropdownMenuItem,
}) as DropdownCompound

export default Dropdown
