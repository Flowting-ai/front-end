'use client'

/**
 * Thin shadcn-style layer over `@radix-ui/react-dropdown-menu` used by the KDS
 * `Dropdown` family (`Dropdown.Float`, `Dropdown.Submenu`, `Dropdown.Item`,
 * `Dropdown.Section`).
 *
 * `MenuModeContext` tells `DropdownMenuItem` / `DropdownSection` how to render:
 *  - `'none'`    - not inside a Radix menu (e.g. a list inside a plain Popover):
 *                  render a plain element with its own keyboard handling.
 *  - `'menu'`    - inside a Radix menu content: wrap in Radix Item / Label / Group
 *                  so Radix owns roving focus, typeahead and ARIA.
 *  - `'slotted'` - the element is the child of a Radix part that is already an
 *                  item (e.g. `SubTrigger asChild`): render plain, but leave
 *                  role / tabIndex / keyboard to the Radix parent.
 */

import React from 'react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'

export type MenuMode = 'none' | 'menu' | 'slotted'

export const MenuModeContext = React.createContext<MenuMode>('none')

export function useMenuMode(): MenuMode {
  return React.useContext(MenuModeContext)
}

/**
 * True while the Radix part a `'slotted'` element sits in has focus. Radix
 * focuses that wrapper (e.g. the `SubTrigger` span), not the row inside it, so
 * the row reads this to show its highlight for the active item.
 */
export const SlotFocusContext = React.createContext(false)

export function useSlotFocused(): boolean {
  return React.useContext(SlotFocusContext)
}

export const DropdownMenu            = DropdownMenuPrimitive.Root
export const DropdownMenuTrigger     = DropdownMenuPrimitive.Trigger
export const DropdownMenuPortal      = DropdownMenuPrimitive.Portal
export const DropdownMenuContent     = DropdownMenuPrimitive.Content
export const DropdownMenuPrimitiveItem = DropdownMenuPrimitive.Item
export const DropdownMenuGroup       = DropdownMenuPrimitive.Group
export const DropdownMenuLabel       = DropdownMenuPrimitive.Label
export const DropdownMenuSeparator   = DropdownMenuPrimitive.Separator
export const DropdownMenuSub         = DropdownMenuPrimitive.Sub
export const DropdownMenuSubTrigger  = DropdownMenuPrimitive.SubTrigger
export const DropdownMenuSubContent  = DropdownMenuPrimitive.SubContent
