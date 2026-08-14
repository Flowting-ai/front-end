'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowDownOneIcon, MoreHorizontalIcon, PinIcon, PlusSignIcon } from '@strange-huge/icons'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/Tooltip'

// ── Types ─────────────────────────────────────────────────────────────────────
// "Sidebar / Row" (Figma 109:10765) — identity-agnostic: the row itself does not
// know whether it's "New", "Agents", a project chat, or a recent chat. Identity
// (icon + label + behavior) is supplied entirely by the caller. Mirrors
// SidebarMenuItem's rename/link contract (src/components/SidebarMenuItem) but is
// a separate component so the old tabbed Sidebar (Brain/Admin/team-settings)
// stays byte-for-byte unchanged — see docs/features/sidebar-current-state-audit.md.

export type FlatSidebarRowVariant = 'default' | 'chat-item' | 'chat-item-edit' | 'header'

export interface FlatSidebarRowProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onClick'> {
  variant?: FlatSidebarRowVariant
  label?: string
  icon?: React.ReactElement<{ triggered?: boolean }>
  /** Persistent selected state — fill + text emphasis + left indicator bar (Figma: "selected is multi-signal"). */
  selected?: boolean
  /** Icon-only collapsed rail. header/chat-item/chat-item-edit rows render nothing when collapsed. */
  collapsed?: boolean
  href?: string
  onClick?: React.MouseEventHandler<HTMLDivElement>
  /** Trailing action slot — revealed on hover (e.g. Slack row's "Add"). Informational badges use `badge` instead. */
  trailing?: React.ReactNode
  /** Persistent trailing badge (e.g. "Read only") — always visible, not hover-gated. */
  badge?: React.ReactNode
  /** header variant: opens the "…" section menu. Other variants: opens the row's own menu. */
  onMoreClick?: React.MouseEventHandler<HTMLButtonElement>
  /** chat-item variant only — hover-revealed pin toggle rendered just left of the more button. Omit to hide. */
  onPinClick?: React.MouseEventHandler<HTMLButtonElement>
  /** chat-item variant only — whether this item is currently pinned (colors the pin icon + flips its tooltip/aria-label). */
  pinned?: boolean
  onRename?: () => void
  onCommit?: (value: string) => void
  onCancel?: () => void
  /** header variant only — expand/collapse state, driven by the chevron */
  shown?: boolean
  onShowClick?: React.MouseEventHandler<HTMLButtonElement>
  /** header variant only — hover-revealed create action (Figma: "Projects → Create new project. Recents → New chat."). Omit to hide. */
  onAddClick?: React.MouseEventHandler<HTMLButtonElement>
  /** header variant only — aria-label for the add action, e.g. "New project". Defaults to `Add to ${label}`. */
  addLabel?: string
  /** header variant only — persistent leading icon rendered just left of the add button (e.g. section identity icon). Omit to hide. */
  headerIcon?: React.ReactNode
  /** header variant only — makes headerIcon clickable (e.g. navigate to the section's own page). Omit for a purely decorative icon. */
  onHeaderIconClick?: React.MouseEventHandler<HTMLButtonElement>
  /** header variant only — aria-label for the header icon button. Defaults to `Open ${label}`. */
  headerIconLabel?: string
  /** header variant only — shrinks the label to caption size, for a nested sub-header (e.g. "Personal Projects" under "Projects") that shouldn't read as loud as a top-level section title. */
  compact?: boolean
}

const bodyTextStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontWeight: 'var(--font-weight-medium)',
  fontSize: 'var(--font-size-body)',
  lineHeight: 'var(--line-height-body)',
  color: 'var(--sidebar-menu-item-text)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  flex: '1 0 0',
  minWidth: 0,
}

// Figma "Sidebar / Section Header" label: Regular 400 (rows are Medium 500),
// same size/color as a row label so the section title doesn't read as a caption.
const headerLabelTextStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontWeight: 'var(--font-weight-regular)',
  fontSize: 'var(--font-size-body)',
  lineHeight: 'var(--line-height-body)',
  color: 'var(--sidebar-menu-item-text)',
  whiteSpace: 'nowrap',
  margin: 0,
}

const headerActionButtonStyle = (visible: boolean, iconHovered: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  lineHeight: 0,
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  color: iconHovered ? 'var(--neutral-black)' : 'var(--sidebar-menu-item-muted)',
  opacity: visible ? 1 : 0,
  transition: 'opacity 150ms, color 150ms',
})

export const FlatSidebarRow = React.forwardRef<HTMLDivElement, FlatSidebarRowProps>(
  function FlatSidebarRow(
    {
      variant = 'default',
      label = '',
      icon,
      selected = false,
      collapsed = false,
      href,
      onClick,
      trailing,
      badge,
      onMoreClick,
      onPinClick,
      pinned = false,
      onRename,
      onCommit,
      onCancel,
      shown = false,
      onShowClick,
      onAddClick,
      addLabel,
      headerIcon,
      onHeaderIconClick,
      headerIconLabel,
      compact = false,
      className,
      onMouseEnter: externalMouseEnter,
      onMouseLeave: externalMouseLeave,
      ...props
    },
    ref,
  ) {
    const [isHovered, setIsHovered] = useState(false)
    const isHeader = variant === 'header'
    const isEditVariant = variant === 'chat-item-edit'
    const isActive = isHovered || selected

    // Per-icon hover — darkens just the icon being pointed at, independent of
    // the row/header-level hover that only controls reveal (opacity/underline).
    const [moreIconHovered, setMoreIconHovered] = useState(false)
    const [headerIconHovered, setHeaderIconHovered] = useState(false)
    const [addIconHovered, setAddIconHovered] = useState(false)
    const [chatMoreIconHovered, setChatMoreIconHovered] = useState(false)
    const [pinIconHovered, setPinIconHovered] = useState(false)

    // ── rename (chat-item-edit) — Enter commits, Escape cancels, blur cancels
    // unless already resolved, matching SidebarMenuItem's guard so a rename
    // never double-fires commit-then-cancel. ──
    const [editValue, setEditValue] = useState(label)
    const inputRef = useRef<HTMLInputElement>(null)
    const resolvedRef = useRef(false)
    const lastEnterRef = useRef(0)

    useEffect(() => {
      if (isEditVariant && inputRef.current) {
        resolvedRef.current = false
        const id = window.setTimeout(() => {
          inputRef.current?.focus()
          inputRef.current?.select()
        }, 0)
        return () => window.clearTimeout(id)
      }
    }, [isEditVariant])

    if (collapsed && (isHeader || variant === 'chat-item' || isEditVariant)) return null

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isHeader || isEditVariant) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        if (variant === 'chat-item' && e.key === 'Enter') {
          const now = Date.now()
          if (selected && now - lastEnterRef.current < 400) {
            lastEnterRef.current = 0
            onRename?.()
            return
          }
          lastEnterRef.current = now
        }
        onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>)
      }
    }

    const containerStyle: React.CSSProperties = {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 'var(--space-008, 8px)',
      overflow: 'hidden',
      borderRadius: 'var(--radius-010, 10px)',
      width: collapsed ? 'auto' : '100%',
      height: isHeader ? 'auto' : '32px',
      paddingLeft: collapsed ? '6px' : 'var(--space-008, 8px)',
      paddingRight: collapsed ? '6px' : 'var(--space-008, 8px)',
      backgroundColor: !isHeader && isActive ? 'var(--sidebar-menu-item-hover-bg)' : 'transparent',
      boxShadow: !isHeader && isActive ? 'var(--shadow-sidebar-item-hover)' : undefined,
      cursor: isHeader ? 'default' : isEditVariant ? 'text' : 'pointer',
      transition: 'background-color 150ms, box-shadow 150ms',
      boxSizing: 'border-box',
    }

    const indicatorBar = !isHeader && selected && (
      <span
        aria-hidden
        style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: 16, borderRadius: 2, backgroundColor: 'var(--neutral-700)' }}
      />
    )

    if (isHeader) {
      return (
        <div
          ref={ref}
          className={cn(className)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', height: 24, padding: '2px 8px', boxSizing: 'border-box' }}
          onMouseEnter={(e) => { setIsHovered(true); externalMouseEnter?.(e) }}
          onMouseLeave={(e) => { setIsHovered(false); externalMouseLeave?.(e) }}
          {...props}
        >
          <button
            type="button"
            tabIndex={0}
            aria-expanded={shown}
            aria-label={shown ? `Collapse ${label}` : `Expand ${label}`}
            onClick={(e) => { e.stopPropagation(); onShowClick?.(e) }}
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, cursor: onShowClick ? 'pointer' : 'default', minWidth: 0 }}
          >
            <p style={{
              ...headerLabelTextStyle,
              ...(compact ? { fontSize: 'var(--font-size-caption)', lineHeight: 'var(--line-height-caption)' } : null),
              textDecoration: isHovered ? 'underline' : 'none',
            }}>{label}</p>
            <span style={{ display: 'inline-flex', lineHeight: 0, color: 'var(--sidebar-menu-item-text)', flexShrink: 0, transform: shown ? 'none' : 'rotate(-90deg)', transition: 'transform 150ms' }}>
              <ArrowDownOneIcon size={12} />
            </span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {onMoreClick && (
              <Tooltip content={`${label} options`} side="top" delayDuration={300}>
                <button
                  type="button"
                  aria-label={`${label} options`}
                  onClick={(e) => { e.stopPropagation(); onMoreClick(e) }}
                  onMouseEnter={() => setMoreIconHovered(true)}
                  onMouseLeave={() => setMoreIconHovered(false)}
                  style={headerActionButtonStyle(isHovered, moreIconHovered)}
                >
                  <MoreHorizontalIcon size={16} />
                </button>
              </Tooltip>
            )}
            {headerIcon && (onHeaderIconClick ? (
              <Tooltip content={headerIconLabel ?? `Open ${label}`} side="top" delayDuration={300}>
                <button
                  type="button"
                  aria-label={headerIconLabel ?? `Open ${label}`}
                  onClick={(e) => { e.stopPropagation(); onHeaderIconClick(e) }}
                  onMouseEnter={() => setHeaderIconHovered(true)}
                  onMouseLeave={() => setHeaderIconHovered(false)}
                  style={headerActionButtonStyle(isHovered, headerIconHovered)}
                >
                  {headerIcon}
                </button>
              </Tooltip>
            ) : (
              <span style={{ display: 'inline-flex', lineHeight: 0, color: 'var(--sidebar-menu-item-muted)', opacity: isHovered ? 1 : 0, transition: 'opacity 150ms' }}>
                {headerIcon}
              </span>
            ))}
            {onAddClick && (
              <Tooltip content={addLabel ?? `Add to ${label}`} side="top" delayDuration={300}>
                <button
                  type="button"
                  aria-label={addLabel ?? `Add to ${label}`}
                  onClick={(e) => { e.stopPropagation(); onAddClick(e) }}
                  onMouseEnter={() => setAddIconHovered(true)}
                  onMouseLeave={() => setAddIconHovered(false)}
                  style={headerActionButtonStyle(isHovered, addIconHovered)}
                >
                  <PlusSignIcon size={16} />
                </button>
              </Tooltip>
            )}
          </div>
        </div>
      )
    }

    if (isEditVariant) {
      return (
        <div ref={ref} className={cn(className)} style={{ ...containerStyle, backgroundColor: 'var(--sidebar-menu-item-hover-bg)', boxShadow: '0px 0px 0px 1px var(--focus-ring)' }} {...props}>
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter') { e.preventDefault(); resolvedRef.current = true; onCommit?.(editValue) }
              if (e.key === 'Escape') { e.preventDefault(); resolvedRef.current = true; onCancel?.(); toast.info('Rename cancelled') }
            }}
            onBlur={() => {
              if (resolvedRef.current) return
              resolvedRef.current = true
              onCancel?.()
              toast.info('Rename cancelled')
            }}
            style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', padding: 0, ...bodyTextStyle }}
          />
        </div>
      )
    }

    const content = (
      <>
        {indicatorBar}
        {icon && (
          <div style={{ color: 'var(--sidebar-menu-item-text)', flexShrink: 0, lineHeight: 0 }}>
            {React.cloneElement(icon, { triggered: isHovered })}
          </div>
        )}
        {!collapsed && <p style={{ ...bodyTextStyle, color: isHovered ? 'var(--neutral-black)' : bodyTextStyle.color }}>{label}</p>}
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {badge}
            {trailing && (isActive ? (
              <div style={{ display: 'inline-flex', alignItems: 'center' }}>{trailing}</div>
            ) : null)}
            {variant === 'chat-item' && isActive && onPinClick && (
              <Tooltip content={pinned ? 'Unpin' : 'Pin'} side="top" delayDuration={300}>
                <button
                  type="button"
                  aria-label={pinned ? 'Unpin' : 'Pin'}
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); onPinClick(e) }}
                  onMouseEnter={() => setPinIconHovered(true)}
                  onMouseLeave={() => setPinIconHovered(false)}
                  style={headerActionButtonStyle(true, pinned || pinIconHovered)}
                >
                  <PinIcon size={16} />
                </button>
              </Tooltip>
            )}
            {variant === 'chat-item' && isActive && (
              <Tooltip content="More options" side="top" delayDuration={300}>
                <button
                  type="button"
                  aria-label="More options"
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); onMoreClick?.(e) }}
                  onMouseEnter={() => setChatMoreIconHovered(true)}
                  onMouseLeave={() => setChatMoreIconHovered(false)}
                  style={{
                    ...headerActionButtonStyle(true, chatMoreIconHovered),
                    cursor: onMoreClick ? 'pointer' : 'not-allowed',
                  }}
                >
                  <MoreHorizontalIcon size={16} />
                </button>
              </Tooltip>
            )}
          </div>
        )}
      </>
    )

    const rootProps = {
      ref,
      role: 'button' as const,
      tabIndex: 0,
      'aria-pressed': selected,
      className: cn(className),
      style: href ? { ...containerStyle, textDecoration: 'none' } : containerStyle,
      onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => { setIsHovered(true); externalMouseEnter?.(e) },
      onMouseLeave: (e: React.MouseEvent<HTMLDivElement>) => { setIsHovered(false); externalMouseLeave?.(e) },
      onKeyDown: handleKeyDown,
      ...props,
    }

    if (href) {
      return (
        <Link
          href={href}
          tabIndex={0}
          className={rootProps.className}
          style={rootProps.style}
          onMouseEnter={rootProps.onMouseEnter as unknown as React.MouseEventHandler<HTMLAnchorElement>}
          onMouseLeave={rootProps.onMouseLeave as unknown as React.MouseEventHandler<HTMLAnchorElement>}
          onKeyDown={rootProps.onKeyDown as unknown as React.KeyboardEventHandler<HTMLAnchorElement>}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return
            if (onClick) { e.preventDefault(); onClick(e as unknown as React.MouseEvent<HTMLDivElement>) }
          }}
        >
          {content}
        </Link>
      )
    }

    return (
      <div onClick={onClick} {...rootProps}>
        {content}
      </div>
    )
  },
)

FlatSidebarRow.displayName = 'FlatSidebarRow'
export default FlatSidebarRow
