'use client'

import React, { useState } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { AnimatePresence, motion } from 'framer-motion'
import { LlmIcon } from '@strange-huge/icons/llm'
import { Switch } from '@/components/Switch'
import { Checkbox } from '@/components/Checkbox'
import { cn } from '@/lib/utils'

// ── Shadow tokens ──────────────────────────────────────────────────────────────

const SHADOW_ITEM_HOVER         = 'var(--shadow-dropdown-item-hover)'
const SHADOW_ITEM_INNER         = 'var(--shadow-item-inner)'
const SHADOW_DANGER_HOVER       = 'var(--shadow-dropdown-item-danger-hover)'
const SHADOW_DANGER_INNER       = 'var(--shadow-dropdown-item-danger-inner)'

// ── Types ─────────────────────────────────────────────────────────────────────

export type DropdownMenuItemVariant = 'default' | 'header' | 'danger'

export interface DropdownMenuItemProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: DropdownMenuItemVariant
  /** Primary label text. */
  label?: string
  /**
   * Optional secondary line beneath the label. Renders as caption-11 in
   * `--dropdown-menu-item-sublabel`. Truncates with ellipsis when longer than
   * the row's available width. Figma 3137:36099.
   */
  subLabel?: string
  /**
   * Icon on the left side of the label. **Do not pass `size`** — the
   * component injects the canonical slot size (currently 20 px) via
   * `React.cloneElement`, so any `size` prop on the passed element is
   * overridden. This keeps slot dimensions a single-source-of-truth: when
   * Figma changes the size, only `DropdownMenuItem` updates — every
   * consumer just keeps passing the bare `<Icon />`. Omit `icon` to render
   * the label with no left indent. Figma 1056:842.
   */
  icon?: React.ReactElement
  /**
   * Free-form avatar slot — renders a 24 × 24 rounded-6 element to the left
   * of the label, used by **persona-style** rows where the avatar is an
   * arbitrary image (or any ReactNode you want to render in that slot).
   * Pass an `<img>` for image avatars; pass any element for custom content.
   * Mutually exclusive with `icon` and `llm`. Figma 3430:39723.
   */
  avatar?: React.ReactNode
  /**
   * Trailing badge slot — renders a `Badge` (or any ReactNode) inside the
   * row's left-content cluster, positioned **after the label column** and
   * **before** the right icon / Switch. Used to surface counts, status
   * markers, or labels alongside the row's primary text. Figma `1056:839`
   * (badge variant) + `3437:2664` (spec sheet).
   *
   * Default + selected + disabled rows typically use a `Neutral` Badge;
   * danger rows still render the badge but you'll usually pick a colour
   * that reads against the soft-red background. Header rows have their
   * own dedicated `headerBadge` slot — pass the badge there for header
   * variants.
   */
  badge?: React.ReactNode
  /**
   * Canonical model id — renders the corresponding `<LlmIcon variant="avatar" />`
   * from `@strange-huge/icons/llm` between the icon and the label column.
   * Pass any key in the `LLM_AVATAR` map (e.g. `"Claude"`, `"OpenAI"`,
   * `"Gemini"`, `"Zhipu"`). Square, rounded-6 px, sized to match the row's
   * content height (38 px when `subLabel` is set, 22 px otherwise).
   * Figma 3143:37109. Stops and asks the user if a model id is missing
   * from `LLM_AVATAR` rather than substituting an inline asset.
   */
  llm?: string
  /**
   * Icon on the right side — shown only when provided. Useful for trailing
   * indicators: checkmarks, chevrons, badges. **Do not pass `size`** — the
   * component injects the canonical slot size (currently 20 px) via
   * `React.cloneElement`. Mutually exclusive with the trailing Switch slot.
   * Figma 1056:940.
   */
  rightIcon?: React.ReactElement
  /** Persistent selected visual state (default variant only). */
  selected?: boolean
  /**
   * Disabled state — opacity 70 %, `cursor: not-allowed`, suppressed
   * pointer events. Available on the default variant only.
   */
  disabled?: boolean
  /**
   * When `true`, renders a 2px animated accent bar on the left edge on
   * hover/selected. Use for long lists (>8 items) or command palettes where
   * the eye needs a strong landing point.
   * @default false
   */
  accent?: boolean
  /** Stretch to full width instead of fixed 217 px. */
  fluid?: boolean
  /**
   * Show a trailing 34×20 Switch in place of `rightIcon`. Pair with
   * `switchChecked` / `defaultSwitchChecked` / `onSwitchChange` to control it.
   * Mutually exclusive with `rightIcon`. Default variant only.
   */
  showSwitch?: boolean
  /** Controlled switch state. */
  switchChecked?: boolean
  /** Uncontrolled switch state. */
  defaultSwitchChecked?: boolean
  /** Fires when the switch toggles. */
  onSwitchChange?: (checked: boolean) => void
  /**
   * Show a leading 16×16 Checkbox at the start of the row's User Info cluster
   * (before `icon` / `avatar` / `llm`). Used by multi-select dropdowns
   * (Figma 3437:2664 — `showCheckbox` variant). Pair with `checkboxChecked` /
   * `defaultCheckboxChecked` / `onCheckboxChange` to control it. Click
   * anywhere on the row toggles the checkbox (same intent as `showSwitch`).
   * Default variant only.
   */
  showCheckbox?: boolean
  /** Controlled checkbox state. */
  checkboxChecked?: boolean
  /** Uncontrolled checkbox state. */
  defaultCheckboxChecked?: boolean
  /** Fires when the checkbox toggles. */
  onCheckboxChange?: (checked: boolean) => void
  /** Render as a child element — allows Radix DropdownMenu.Item composition. */
  asChild?: boolean
  /**
   * **Header variant only** — node rendered next to the label inside the
   * header's left-content cluster (Figma 3198:31774). Typical use: a small
   * status `<Badge>` (e.g. "New", "Beta", an item count). Hidden on default
   * and danger variants.
   */
  headerBadge?: React.ReactNode
  /**
   * **Header variant only** — children render in the header's right slot
   * (Figma 3206:32976). The slot is `flex: 1 0 0` so anything here fills
   * the remaining row width: a trailing button, link, IconButton, status
   * indicator, etc. Use it for actions scoped to the section the header
   * introduces (e.g. "+ Add" beside a "Folders" header). Ignored on
   * default and danger variants.
   */
  children?: React.ReactNode
}

// ── Shared text styles ────────────────────────────────────────────────────────

const labelTextStyle: React.CSSProperties = {
  fontFamily:   'var(--font-body)',
  fontWeight:   'var(--font-weight-medium)',
  fontSize:     'var(--font-size-body)',
  lineHeight:   'var(--line-height-body)',
  whiteSpace:   'nowrap',
  overflow:     'hidden',
  textOverflow: 'ellipsis',
  width:        '100%',
  margin:       0,
}

const subLabelTextStyle: React.CSSProperties = {
  fontFamily:   'var(--font-body)',
  fontWeight:   'var(--font-weight-regular)',
  fontSize:     'var(--font-size-caption)',
  lineHeight:   'var(--line-height-caption)',
  color:        'var(--dropdown-menu-item-sublabel)',
  whiteSpace:   'nowrap',
  overflow:     'hidden',
  textOverflow: 'ellipsis',
  width:        '100%',
  margin:       0,
}

const headerTextStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontWeight: 'var(--font-weight-medium)',
  fontSize:   'var(--font-size-caption)',
  lineHeight: 'var(--line-height-caption)',
  color:      'var(--dropdown-menu-item-muted)',
  whiteSpace: 'nowrap',
  margin:     0,
}

// ── Component ─────────────────────────────────────────────────────────────────

export const DropdownMenuItem = React.forwardRef<HTMLDivElement, DropdownMenuItemProps>(
  function DropdownMenuItem(
    {
      variant = 'default',
      label = 'Label',
      subLabel,
      icon,
      avatar,
      badge,
      llm,
      rightIcon,
      selected = false,
      disabled = false,
      accent = false,
      fluid = false,
      showSwitch = false,
      switchChecked,
      defaultSwitchChecked,
      onSwitchChange,
      showCheckbox = false,
      checkboxChecked,
      defaultCheckboxChecked,
      onCheckboxChange,
      asChild = false,
      headerBadge,
      children,
      className,
      style,
      onMouseEnter: externalMouseEnter,
      onMouseLeave: externalMouseLeave,
      onKeyDown:    externalKeyDown,
      onClick,
      ...props
    },
    ref,
  ) {
    const [isHovered, setIsHovered] = useState(false)
    const isHeader = variant === 'header'
    const isDanger = variant === 'danger'

    // ── Switch state mirror (when showSwitch) ──────────────────────────────
    // DropdownMenuItem owns the switch state internally so a click anywhere
    // on the row — not just on the switch itself — toggles it. The Switch
    // is always rendered controlled (`checked={effectiveSwitchOn}`), and
    // clicks on the switch propagate-stop at the wrapper so we don't double-
    // toggle (once from Radix, once from the row's onClick).
    // ── Icon size injection ─────────────────────────────────────────────────
    // DropdownMenuItem dictates the slot's icon size — consumers pass the
    // icon element without a `size` prop and the component clones it with
    // the canonical size injected. This means a Figma-driven size change
    // (16 → 20 in the corner-radius revision) flips in ONE place; we don't
    // chase every consumer to update `size={...}`. Strange-huge icons accept
    // `size`; non-icon components ignore the injected prop.
    const SLOT_ICON_SIZE = 20
    const sizedIcon =
      icon && React.isValidElement(icon)
        ? React.cloneElement(icon as React.ReactElement<{ size?: number }>, { size: SLOT_ICON_SIZE })
        : icon
    const sizedRightIcon =
      rightIcon && React.isValidElement(rightIcon)
        ? React.cloneElement(rightIcon as React.ReactElement<{ size?: number }>, { size: SLOT_ICON_SIZE })
        : rightIcon

    const isSwitchControlled = switchChecked !== undefined
    const [internalSwitchOn, setInternalSwitchOn] = useState(!!defaultSwitchChecked)
    const effectiveSwitchOn = isSwitchControlled ? !!switchChecked : internalSwitchOn
    const handleSwitchChange = (next: boolean) => {
      if (!isSwitchControlled) setInternalSwitchOn(next)
      onSwitchChange?.(next)
    }
    const toggleSwitch = () => {
      if (disabled) return
      handleSwitchChange(!effectiveSwitchOn)
    }

    // ── Checkbox state mirror (when showCheckbox) ──────────────────────────
    // Mirrors the Switch pattern: clicking anywhere on the row toggles the
    // checkbox. The Checkbox itself stops propagation so we don't double-
    // toggle (once from Radix, once from the row's onClick).
    const isCheckboxControlled = checkboxChecked !== undefined
    const [internalCheckboxOn, setInternalCheckboxOn] = useState(!!defaultCheckboxChecked)
    const effectiveCheckboxOn = isCheckboxControlled ? !!checkboxChecked : internalCheckboxOn
    const handleCheckboxChange = (next: boolean) => {
      if (!isCheckboxControlled) setInternalCheckboxOn(next)
      onCheckboxChange?.(next)
    }
    const toggleCheckbox = () => {
      if (disabled) return
      handleCheckboxChange(!effectiveCheckboxOn)
    }
    // Header is a label-only row; danger has only Default + Hover (per Figma —
    // no Selected or Disabled). Default supports Hover, Selected, Disabled.
    const isActive = !isHeader && !disabled && (isHovered || (variant === 'default' && selected))

    const labelColor = isDanger
      ? 'var(--dropdown-menu-item-danger-text)'
      : 'var(--dropdown-menu-item-text)'

    const hoverBg = isDanger
      ? 'var(--dropdown-menu-item-danger-hover-bg)'
      : 'var(--dropdown-menu-item-hover-bg)'

    const hoverShadow = isDanger ? SHADOW_DANGER_HOVER : SHADOW_ITEM_HOVER
    const innerShadow = isDanger ? SHADOW_DANGER_INNER : SHADOW_ITEM_INNER

    const Comp = asChild ? Slot : 'div'

    return (
      <Comp
        ref={ref}
        role={isHeader ? undefined : 'menuitem'}
        tabIndex={isHeader || disabled ? undefined : 0}
        aria-disabled={disabled || undefined}
        data-disabled={disabled || undefined}
        className={cn(!isHeader && 'kaya-dropdown-item', className)}
        style={{
          position:        'relative',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  isHeader ? 'flex-start' : 'space-between',
          overflow:        'hidden',
          // Figma 1056:840 / 1056:874 — radius 6 px (lowered from 10 px in
          // the same revision that introduced the header right-slot).
          borderRadius:    '6px',
          width:           fluid ? '100%' : '217px',
          // Figma 1056:874 — header pt-4, pb-6
          paddingLeft:     '6px',
          paddingRight:    '6px',
          paddingTop:      isHeader ? '4px' : '5px',
          paddingBottom:   isHeader ? '6px' : '5px',
          backgroundColor: isActive ? hoverBg : 'transparent',
          boxShadow:       isActive ? hoverShadow : undefined,
          opacity:         disabled ? 0.7 : 1,
          cursor:          isHeader ? 'default' : disabled ? 'not-allowed' : 'pointer',
          transition:      'background-color 150ms, box-shadow 150ms, opacity 150ms',
          userSelect:      'none',
          ...style,
        }}
        onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
          if (!disabled) setIsHovered(true)
          externalMouseEnter?.(e)
        }}
        onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
          setIsHovered(false)
          externalMouseLeave?.(e)
        }}
        onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
          if (!isHeader && !disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            // When the row carries a Switch / Checkbox, Enter/Space toggles
            // it as well as firing the consumer's onClick — same intent as a
            // click.
            if (showSwitch && !isDanger) toggleSwitch()
            if (showCheckbox && !isDanger) toggleCheckbox()
            onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>)
          }
          externalKeyDown?.(e)
        }}
        onClick={
          isHeader || disabled
            ? undefined
            : (e: React.MouseEvent<HTMLDivElement>) => {
                // Click anywhere on the row toggles the Switch / Checkbox.
                // Clicks on the control itself stop-propagate at the wrapper,
                // so they don't reach this handler — Radix toggles them
                // directly via its own onCheckedChange path. No double-toggle.
                if (showSwitch && !isDanger) toggleSwitch()
                if (showCheckbox && !isDanger) toggleCheckbox()
                onClick?.(e)
              }
        }
        {...props}
      >
        {/* ── Header variant — left-content (label + optional badge) + right slot ── */}
        {isHeader && (
          <>
            {/* Left content — label + optional headerBadge slot. Figma 3198:31824. */}
            <div
              style={{
                display:    'flex',
                alignItems: 'center',
                gap:        8,
                height:     17,
                flexShrink: 0,
              }}
            >
              <p style={headerTextStyle}>{label}</p>
              {headerBadge}
            </div>
            {/* Right slot — flex 1 0 0, fills remaining width. Figma 3206:32976.
                Common consumers: trailing IconButton / Button / Link. The slot
                container is items-center so children align centrally on the
                row's vertical axis. */}
            {children !== undefined && children !== null && (
              <div
                style={{
                  display:        'flex',
                  alignItems:     'center',
                  flex:           '1 0 0',
                  minWidth:       1,
                  alignSelf:      'stretch',
                }}
              >
                <div style={{ flex: '1 0 0', minWidth: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  {children}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Default + Danger variants ── */}
        {!isHeader && (
          <>
            {/* Accent bar — 2 px left edge indicator (default only) */}
            <AnimatePresence initial={false}>
              {isActive && accent && !isDanger && (
                <motion.div
                  key="accent"
                  aria-hidden
                  initial={{ scaleY: 0, opacity: 0 }}
                  animate={{ scaleY: 1, opacity: 1 }}
                  exit={{    scaleY: 0, opacity: 0 }}
                  transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    position:        'absolute',
                    left:            0,
                    top:             '4px',
                    bottom:          '4px',
                    width:           '2px',
                    borderRadius:    '2px',
                    backgroundColor: 'var(--neutral-900)',
                    transformOrigin: 'center',
                    pointerEvents:   'none',
                  }}
                />
              )}
            </AnimatePresence>

            {/* User Info — flex 1 0 0, min-w-px so label/subLabel can truncate */}
            <div
              style={{
                display:    'flex',
                alignItems: 'center',
                gap:        '8px',
                flex:       '1 0 0',
                minWidth:   1,
              }}
            >
              {/* Leading checkbox slot — Figma 3437:2664 (showCheckbox).
                  Sits at the start of the User Info cluster, before icon /
                  avatar / llm. 16×16, gap-8 from the next slot. Click on
                  the checkbox itself stops propagation so the row's onClick
                  doesn't double-toggle it. Default variant only. */}
              {showCheckbox && !isDanger && (
                <div
                  style={{ flexShrink: 0, display: 'inline-flex', lineHeight: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation() }}
                >
                  <Checkbox
                    checked={effectiveCheckboxOn}
                    onCheckedChange={handleCheckboxChange}
                    disabled={disabled}
                    aria-label={label}
                  />
                </div>
              )}

              {icon && (
                <div
                  style={{
                    width:      '20px',
                    height:     '20px',
                    flexShrink: 0,
                    lineHeight: 0,
                    color:      labelColor,
                  }}
                >
                  {sizedIcon}
                </div>
              )}

              {/* Persona / free-form avatar — Figma 3430:39723. Square,
                  rounded-6 px, 24 px to align vertically with the body-14
                  label's line-height. Pass an `<img>` for an image avatar,
                  or any ReactNode for custom content (e.g. an initials
                  bubble). Mutually exclusive with `icon` and `llm`. */}
              {avatar && !isDanger && (
                <div
                  aria-hidden
                  style={{
                    width:        24,
                    height:       24,
                    flexShrink:   0,
                    borderRadius: 6,
                    overflow:     'hidden',
                    lineHeight:   0,
                    display:      'inline-flex',
                    alignItems:   'center',
                    justifyContent: 'center',
                  }}
                >
                  {avatar}
                </div>
              )}

              {/* Model avatar — Figma 3143:37109. Square, rounded-6 px,
                  sized to match the row's content height. LlmIcon variant
                  "avatar" is the canonical source per the KDS Model Avatar
                  Rule — never substitute an inline SVG. */}
              {llm && !isDanger && (() => {
                const avatarSize = subLabel ? 38 : 22
                return (
                  <div
                    aria-hidden
                    style={{
                      width:        avatarSize,
                      height:       avatarSize,
                      flexShrink:   0,
                      borderRadius: 6,
                      overflow:     'hidden',
                      lineHeight:   0,
                    }}
                  >
                    <LlmIcon id={llm} variant="color" size={avatarSize} />
                  </div>
                )
              })()}

              {/* Label / sublabel column — flex-col so subLabel sits below label */}
              <div
                style={{
                  display:        'flex',
                  flexDirection:  'column',
                  alignItems:     'flex-start',
                  flex:           '1 0 0',
                  minWidth:       1,
                }}
              >
                <p style={{ ...labelTextStyle, color: labelColor }}>{label}</p>
                {subLabel && <p style={subLabelTextStyle}>{subLabel}</p>}
              </div>

              {/* Badge slot — Figma 1056:839 / 3437:2664. Sits after the
                  label column inside the User Info cluster (so it lives in
                  the row's left content, NOT the trailing icon slot). The
                  consumer passes a `<Badge />` (or any ReactNode); the slot
                  is `flexShrink: 0` so the badge keeps its full width and
                  the label column is the one that truncates when space is
                  tight. */}
              {badge && (
                <div
                  style={{
                    flexShrink:     0,
                    display:        'inline-flex',
                    alignItems:     'center',
                    lineHeight:     0,
                  }}
                >
                  {badge}
                </div>
              )}
            </div>

            {/* Trailing slot — Switch OR rightIcon (mutually exclusive). Switch
                is default-variant-only per Figma 3139:36148. */}
            {!isDanger && showSwitch ? (
              <div
                style={{ flexShrink: 0, display: 'inline-flex', lineHeight: 0 }}
                // Switch toggle should not also fire the row's onClick.
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation() }}
              >
                <Switch
                  checked={effectiveSwitchOn}
                  onCheckedChange={handleSwitchChange}
                  disabled={disabled}
                  aria-label={label}
                />
              </div>
            ) : rightIcon ? (
              <div
                style={{
                  width:      '20px',
                  height:     '20px',
                  flexShrink: 0,
                  lineHeight: 0,
                  color:      isDanger
                    ? 'var(--dropdown-menu-item-danger-text)'
                    : 'var(--dropdown-menu-item-muted)',
                }}
              >
                {sizedRightIcon}
              </div>
            ) : null}

            {/* Inner depth shadow — hover + selected (variant-specific token) */}
            {isActive && (
              <div
                aria-hidden
                style={{
                  position:      'absolute',
                  inset:         0,
                  pointerEvents: 'none',
                  borderRadius:  'inherit',
                  boxShadow:     innerShadow,
                }}
              />
            )}
          </>
        )}
      </Comp>
    )
  },
)

DropdownMenuItem.displayName = 'DropdownMenuItem'

export default DropdownMenuItem
