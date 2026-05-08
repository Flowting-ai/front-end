'use client'

import React from 'react'
import { cn } from '@/lib/utils'

// ── Width presets ─────────────────────────────────────────────────────────────
// All values are 8px-grid-aligned and sourced from cross-industry research:
//   sm  192px — compact context menus (4-5 short items, no icons)
//   md  240px — standard dropdown menu (Figma default, KDS baseline)
//   lg  280px — full menus with icons (Material Design + eBay Playbook standard)
//   xl  320px — rich content: long labels, sublabels, trailing meta

export const POPOVER_WIDTHS = {
  sm:  192,
  md:  240,
  lg:  280,
  xl:  320,
} as const

export type PopoverSize = keyof typeof POPOVER_WIDTHS

// ── Variants ──────────────────────────────────────────────────────────────────
// Two corner-radius presets per Figma 3206:31988:
//   modal    — 18px (default; used for confirmation/sheet-style surfaces)
//   dropdown — 12px (used by Dropdown / context menus / select popovers)

export type PopoverVariant = 'modal' | 'dropdown'

const VARIANT_RADIUS: Record<PopoverVariant, number> = {
  modal:    18,
  dropdown: 12,
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PopoverProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Named width preset. Sets a fixed pixel width on the popover surface.
   * Omit for fluid (content-driven) width.
   *
   * | Size | Width | When to use |
   * |------|-------|-------------|
   * | `sm` | 192px | Compact context menus — 4–5 short items, no icons |
   * | `md` | 240px | Standard dropdown (KDS / Figma baseline) |
   * | `lg` | 280px | Full menus with icons (Material Design / eBay standard) |
   * | `xl` | 320px | Rich content — long labels, sublabels, trailing meta |
   */
  size?: PopoverSize
  /**
   * Surface variant — controls corner radius (Figma 3206:31988).
   *  - `modal`    (default) — 18 px radius. For confirmation dialogs / sheets.
   *  - `dropdown`           — 12 px radius. For dropdowns / context menus /
   *                           select popovers. The `<Dropdown>` organism sets
   *                           this automatically; consumers using `<Popover>`
   *                           directly for a menu-like surface should set it
   *                           explicitly.
   */
  variant?: PopoverVariant
  /**
   * Content to render inside the popover surface.
   * Typically one or more `<DropdownSection>` components.
   */
  children?: React.ReactNode
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Floating surface shell for dropdown menus, command palettes, and context
 * menus. Provides the white rounded card with shadow — no positioning or
 * open/close logic. Wire to `@radix-ui/react-popover` or
 * `@radix-ui/react-dropdown-menu` Content for full behaviour.
 */
export const Popover = React.forwardRef<HTMLDivElement, PopoverProps>(
  function Popover({ size, variant = 'modal', children, className, style, ...props }, ref) {
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
        {children}
      </div>
    )
  },
)

Popover.displayName = 'Popover'

export default Popover
