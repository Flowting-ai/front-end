'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  LogoIcon,
  BubbleChatAddIcon,
  MoreHorizontalIcon,
  AbacusIcon,
  ArrowDownOneIcon,
} from '@strange-huge/icons'

// ── Shadow tokens ──────────────────────────────────────────────────────────────

const SHADOW_ITEM_HOVER     = 'var(--shadow-sidebar-item-hover)'
const SHADOW_ITEM_INNER     = 'var(--shadow-item-inner)'
const SHADOW_NEW_CHAT_BADGE = 'var(--shadow-sidebar-item-new-chat-badge)'
const SHADOW_SHORTCUT       = 'var(--shadow-sidebar-item-shortcut)'
const SHADOW_AVATAR         = 'var(--shadow-sidebar-item-avatar)'

// ── Types ─────────────────────────────────────────────────────────────────────

export type SidebarMenuItemVariant = 'default' | 'new-chat' | 'header' | 'chat-item' | 'chat-item-edit' | 'account-item'

export interface SidebarMenuItemProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SidebarMenuItemVariant
  /** Primary label text */
  label?: string
  /** Subtitle / email — account-item only */
  sublabel?: string
  /**
   * Icon for the `default` variant. Must be a `@strange-huge/icons` component
   * that accepts a `triggered` prop — it will fire when the item is hovered.
   * Defaults to `<LogoIcon size={20} />`.
   */
  icon?: React.ReactElement<{ triggered?: boolean }>
  /** Avatar image URL — account-item only */
  avatarSrc?: string
  /** Shortcut badge text — default variant only, e.g. '⌘ K' */
  shortcut?: string
  /**
   * Trailing slot — `default` variant only. Rendered at the row's right edge
   * (pushed right by the row's `space-between`), after the `shortcut` badge if
   * both are set. Free-form ReactNode — e.g. the "Manage Organization" row's
   * `<Badge>4 updated</Badge>` count pill (Figma 6459:101321). Hidden when
   * `collapsed`.
   */
  trailing?: React.ReactNode
  /** Back-compat alias for chat-item status pills. */
  badge?: React.ReactNode
  /** Click handler for the "..." more button — chat-item only */
  onMoreClick?: React.MouseEventHandler<HTMLButtonElement>
  /**
   * Called when the user triggers a rename via keyboard (double Enter within 400ms) — chat-item only.
   * Parent should switch to chat-item-edit variant.
   */
  onRename?: () => void
  /**
   * Called when the user commits a rename — chat-item-edit only.
   * Receives the new label value. Triggered by Enter or blur.
   */
  onCommit?: (value: string) => void
  /**
   * Called when the user cancels a rename — chat-item-edit only.
   * Triggered by Escape. Parent should switch back to chat-item variant.
   */
  onCancel?: () => void
  /** Click handler for the settings icon button — account-item only */
  onSettingsClick?: React.MouseEventHandler<HTMLButtonElement>
  /** Renders the sublabel in warning colour — account-item only */
  sublabelWarning?: boolean
  /** Optional element rendered before the settings button — account-item only (used for RoleBadge) */
  roleBadge?: React.ReactNode
  /** Click handler for the "Show"/"Hide" toggle button on header hover — header only */
  onShowClick?: React.MouseEventHandler<HTMLButtonElement>
  /** Controls whether the toggle reads "Hide" (true) or "Show" (false/undefined) — header only */
  shown?: boolean
  /** Click handler for the "View all ›" button — header only. Appears on hover; always visible when viewAllAlwaysVisible is true. */
  onViewAllClick?: React.MouseEventHandler<HTMLButtonElement>
  /** When true, the "View all ›" button is always visible (not just on hover) — use for Recents */
  viewAllAlwaysVisible?: boolean
  /** Persistent selected state — default, new-chat, chat-item variants only */
  selected?: boolean
  /** Stretch to full width instead of fixed 217px — use inside Sidebar */
  fluid?: boolean
  /** Icon-only mode for collapsed sidebar — hides labels, shortcut, and text content */
  collapsed?: boolean
  /** Optional route for rows that should preserve native link behavior. */
  href?: string
}

// ── Shared text styles ────────────────────────────────────────────────────────

const bodyTextStyle: React.CSSProperties = {
  fontFamily:  'var(--font-body)',
  fontWeight:  'var(--font-weight-medium)',
  fontSize:    'var(--font-size-body)',
  lineHeight:  'var(--line-height-body)',
  color:       'var(--sidebar-menu-item-text)',
  whiteSpace:  'nowrap',
}

const captionTextStyle: React.CSSProperties = {
  fontFamily:  'var(--font-body)',
  fontSize:    'var(--font-size-caption)',
  lineHeight:  'var(--line-height-caption)',
  color:       'var(--sidebar-menu-item-muted)',
  whiteSpace:  'nowrap',
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_ICON = <LogoIcon size={20} />

// ── Component ─────────────────────────────────────────────────────────────────

export const SidebarMenuItem = React.forwardRef<HTMLDivElement, SidebarMenuItemProps>(
  function SidebarMenuItem(
    {
      variant = 'default',
      label = 'Label',
      sublabel = 'Label',
      icon = DEFAULT_ICON,
      avatarSrc,
      shortcut,
      trailing,
      badge,
      onMoreClick,
      onRename,
      onCommit,
      onCancel,
      onSettingsClick,
      sublabelWarning = false,
      roleBadge,
      onShowClick,
      shown = false,
      onViewAllClick,
      viewAllAlwaysVisible = false,
      selected = false,
      fluid = false,
      collapsed = false,
      href,
      className,
      onMouseEnter: externalMouseEnter,
      onMouseLeave: externalMouseLeave,
      onFocus:      externalFocus,
      onBlur:       externalBlur,
      onClick,
      ...props
    },
    ref,
  ) {
    const [isHovered, setIsHovered] = useState(false)
    const [isFocused, setIsFocused] = useState(false)
    const isActive      = isHovered || isFocused || selected

    // When this item is deselected (another item was clicked), clear any stale
    // isFocused state so it doesn't remain visually active.
    useEffect(() => {
      if (!selected) setIsFocused(false)
    }, [selected])
    const isHeader      = variant === 'header'
    const isChatItem    = variant === 'chat-item'
    const isEditVariant = variant === 'chat-item-edit'
    const isAccountItem = variant === 'account-item'

    // ── chat-item-edit state ───────────────────────────────────────────────────
    const [editValue, setEditValue] = useState(label)
    const inputRef    = useRef<HTMLInputElement>(null)
    const renameResolvedRef = useRef(false)
    const lastEnterRef = useRef<number>(0)

    useEffect(() => {
      if (isEditVariant && inputRef.current) {
        renameResolvedRef.current = false
        // Deferred to a macrotask: Radix's DropdownMenu restores focus to its
        // trigger when the menu closes (which is how Rename gets opened), and
        // that restoration can land after this same commit's effects run —
        // a plain synchronous focus()/select() here loses that race silently
        // (no error, just an unfocused input with no visible caret). A
        // setTimeout(0) guarantees this runs after Radix's own cleanup.
        const id = window.setTimeout(() => {
          inputRef.current?.focus()
          inputRef.current?.select()
        }, 0)
        return () => window.clearTimeout(id)
      }
    }, [isEditVariant])

    // ── chat-item marquee ──────────────────────────────────────────────────────
    const labelContainerRef = useRef<HTMLDivElement>(null)
    const labelRef          = useRef<HTMLParagraphElement>(null)
    const [marqueeOffset,  setMarqueeOffset]  = useState(0)
    const [isMarqueeing,   setIsMarqueeing]   = useState(false)
    const [marqueeDone,    setMarqueeDone]    = useState(false)

    useEffect(() => {
      if (!isChatItem) return
      const id = requestAnimationFrame(() => {
        const container = labelContainerRef.current
        const p         = labelRef.current
        if (container && p) {
          setMarqueeOffset(Math.max(0, p.scrollWidth - container.clientWidth))
        }
      })
      return () => cancelAnimationFrame(id)
    }, [isHovered, label, isChatItem])

    useEffect(() => {
      if (!isHovered) {
        setIsMarqueeing(false)
        const id = setTimeout(() => setMarqueeDone(false), 300)
        return () => clearTimeout(id)
      }
      if (marqueeOffset === 0) return
      const id = setTimeout(() => setIsMarqueeing(true), 1000)
      return () => clearTimeout(id)
    }, [isHovered, marqueeOffset])

    const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
      setIsHovered(true)
      externalMouseEnter?.(e)
    }
    const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
      setIsHovered(false)
      externalMouseLeave?.(e)
    }
    const handleFocus = (e: React.FocusEvent<HTMLDivElement>) => {
      setIsFocused(true)
      externalFocus?.(e)
    }
    const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsFocused(false)
      externalBlur?.(e)
    }
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!isHeader && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        if (isChatItem && e.key === 'Enter') {
          const now = Date.now()
          if (selected && now - lastEnterRef.current < 400) {
            lastEnterRef.current = 0
            onRename?.()
          } else {
            lastEnterRef.current = now
            onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>)
          }
        } else {
          onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>)
        }
      }
    }

    const isLink = Boolean(href) && !isHeader && !isEditVariant
    const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return
      if (onClick) {
        e.preventDefault()
        onClick(e as unknown as React.MouseEvent<HTMLDivElement>)
      }
    }

    // In collapsed mode, header, chat-item, and chat-item-edit rows are not rendered
    if (collapsed && (isHeader || isChatItem || isEditVariant)) return null

    // ── Container style ────────────────────────────────────────────────────────
    const containerStyle: React.CSSProperties = {
      position:        'relative',
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'space-between',
      overflow:        'hidden',
      borderRadius:    '10px',
      width:           collapsed ? 'auto' : fluid ? '100%' : '217px',
      paddingLeft:     '6px',
      paddingRight:    (!collapsed && isChatItem && isActive) ? '0px' : '6px',
      paddingTop:      (!collapsed && isChatItem && isActive) ? '0px' : (isAccountItem && collapsed) ? '9px' : isAccountItem ? '6px' : (isChatItem || isEditVariant) ? '3px' : collapsed ? '6px' : '5px',
      paddingBottom:   (!collapsed && isChatItem && isActive) ? '0px' : (isAccountItem && collapsed) ? '9px' : isAccountItem ? '6px' : (isChatItem || isEditVariant) ? '3px' : collapsed ? '6px' : '5px',
      backgroundColor: isEditVariant || (!isHeader && isActive) ? 'var(--sidebar-menu-item-hover-bg)' : 'transparent',
      boxShadow:       isEditVariant
                         ? '0px 0px 0px 1px var(--focus-ring)'
                         : (!isHeader && isActive) ? SHADOW_ITEM_HOVER : undefined,
      cursor:          isHeader ? 'default' : isEditVariant ? 'text' : 'pointer',
      transition:      isEditVariant ? undefined : 'background-color 150ms, box-shadow 150ms',
    }

    const rootProps = {
      ref,
      role: isHeader || isEditVariant || isLink ? undefined : 'button',
      tabIndex: isHeader || isEditVariant ? undefined : 0,
      'aria-pressed': (!isHeader && !isEditVariant) ? selected : undefined,
      className: cn(!isHeader && !isEditVariant && 'kaya-sidebar-item', className),
      style: isLink ? { ...containerStyle, textDecoration: 'none' } : containerStyle,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
      onFocus: handleFocus,
      onBlur: handleBlur,
      onKeyDown: handleKeyDown,
      ...props,
    }

    const content = (
      <>

        {/* ── Header variant ── */}
        {isHeader && (
          <>
            {/* Left: label + Show/Hide toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <p style={{ ...captionTextStyle, fontWeight: 'var(--font-weight-medium)' }}>
                {label}
              </p>
              {onShowClick && (
                <button
                  type="button"
                  tabIndex={0}
                  aria-expanded={shown}
                  aria-label={shown ? `Hide ${label}` : `Show ${label}`}
                  onClick={(e) => { e.stopPropagation(); onShowClick(e) }}
                  style={{
                    fontFamily:  'var(--font-body)',
                    fontWeight:  'var(--font-weight-medium)',
                    fontSize:    'var(--font-size-caption)',
                    lineHeight:  'var(--line-height-caption)',
                    color:       'var(--sidebar-menu-item-muted)',
                    whiteSpace:  'nowrap',
                    background:  'none',
                    border:      'none',
                    padding:     0,
                    cursor:      'pointer',
                    flexShrink:  0,
                    visibility:  isActive ? 'visible' : 'hidden',
                  }}
                >
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={shown ? 'hide' : 'show'}
                      initial={{ scale: 0.75, opacity: 0, filter: 'blur(4px)' }}
                      animate={{ scale: 1,    opacity: 1, filter: 'blur(0px)' }}
                      exit={{    scale: 0.75, opacity: 0, filter: 'blur(4px)' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      style={{ display: 'block', transformOrigin: 'left center' }}
                    >
                      {shown ? 'Hide' : 'Show'}
                    </motion.span>
                  </AnimatePresence>
                </button>
              )}
            </div>
            {/* Right: "View all ›" — hover-only unless viewAllAlwaysVisible */}
            {onViewAllClick && (
              <button
                type="button"
                tabIndex={0}
                aria-label={`View all ${label}`}
                onClick={(e) => { e.stopPropagation(); onViewAllClick(e) }}
                style={{
                  display:     'flex',
                  alignItems:  'center',
                  gap:         '2px',
                  background:  'none',
                  border:      'none',
                  padding:     0,
                  cursor:      'pointer',
                  flexShrink:  0,
                  opacity:     viewAllAlwaysVisible ? 1 : (isActive ? 1 : 0),
                  transition:  'opacity 150ms ease',
                }}
              >
                <p style={{ ...captionTextStyle, fontWeight: 'var(--font-weight-medium)' }}>
                  View all
                </p>
                <span style={{ display: 'inline-flex', lineHeight: 0, color: 'var(--sidebar-menu-item-muted)', transform: 'rotate(-90deg)' }}>
                  <ArrowDownOneIcon size={16} />
                </span>
              </button>
            )}
          </>
        )}

        {/* ── Default variant ── */}
        {variant === 'default' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <div style={{ color: 'var(--sidebar-menu-item-text)', flexShrink: 0, lineHeight: 0 }}>
                {React.cloneElement(icon, { triggered: isHovered })}
              </div>
              <AnimatePresence mode="popLayout" initial={false}>
                {!collapsed && (
                  <motion.p
                    key="label"
                    style={bodyTextStyle}
                    initial={{ opacity: 0, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, filter: 'blur(4px)' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  >
                    {label}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence mode="popLayout" initial={false}>
              {!collapsed && shortcut && (
                <motion.div
                  key="shortcut"
                  initial={{ opacity: 0, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(4px)' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  style={{
                    display:         'flex',
                    alignItems:      'center',
                    justifyContent:  'center',
                    overflow:        'hidden',
                    padding:         '2px 4px',
                    borderRadius:    '4px',
                    height:          '20px',
                    backgroundImage: 'linear-gradient(180deg, var(--neutral-white) 0%, var(--neutral-50) 100%)',
                    boxShadow:       SHADOW_SHORTCUT,
                    flexShrink:      0,
                  }}
                >
                  <p style={{ ...captionTextStyle, fontWeight: 'var(--font-weight-medium)', color: 'var(--sidebar-menu-item-muted)' }}>
                    {shortcut}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Trailing slot — e.g. the Manage Organization "N updated" Badge.
                Pushed to the row's right edge by space-between. Hidden when
                collapsed. */}
            {!collapsed && trailing && (
              <div style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                {trailing}
              </div>
            )}

            {/* Inner depth shadow — hover + selected */}
            {isActive && (
              <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 'inherit', boxShadow: SHADOW_ITEM_INNER }} />
            )}
          </>
        )}

        {/* ── New Chat variant ── */}
        {variant === 'new-chat' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <div style={{ position: 'relative', flexShrink: 0, width: '20px', height: '20px' }}>
              {/* Floating badge — visible at rest, hidden on hover/selected/collapsed */}
              {!collapsed && !isActive && (
                <div
                  aria-hidden
                  style={{
                    position:        'absolute',
                    top:             '-2px',
                    left:            '-2px',
                    width:           '24px',
                    height:          '24px',
                    borderRadius:    '6px',
                    backgroundColor: 'var(--sidebar-menu-item-new-chat-badge-bg)',
                    boxShadow:       SHADOW_NEW_CHAT_BADGE,
                    pointerEvents:   'none',
                  }}
                />
              )}
              <div style={{ position: 'relative', color: 'var(--sidebar-menu-item-text)', lineHeight: 0 }}>
                <BubbleChatAddIcon size={20} triggered={isHovered} />
              </div>
            </div>
            <AnimatePresence mode="popLayout" initial={false}>
              {!collapsed && (
                <motion.p
                  key="label"
                  style={bodyTextStyle}
                  initial={{ opacity: 0, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(4px)' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                >
                  {label}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Inner depth shadow for new-chat — hover + selected */}
        {variant === 'new-chat' && isActive && (
          <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 'inherit', boxShadow: SHADOW_ITEM_INNER }} />
        )}

        {/* ── Chat Item variant ── */}
        {isChatItem && (
          <>
            <div
              ref={labelContainerRef}
              style={{
                display:    'flex',
                alignItems: 'center',
                flexShrink: 1,
                minWidth:   0,
                overflow:        'hidden',
                paddingTop:      '2px',
                paddingBottom:   '2px',
                maskImage:        (isActive && marqueeOffset > 0 && !isMarqueeing && !marqueeDone) ? 'linear-gradient(to right, black calc(100% - 20px), transparent 100%)' : undefined,
                WebkitMaskImage:  (isActive && marqueeOffset > 0 && !isMarqueeing && !marqueeDone) ? 'linear-gradient(to right, black calc(100% - 20px), transparent 100%)' : undefined,
                paddingRight:     isMarqueeing ? '48px' : undefined,
              }}
            >
              <motion.p
                ref={labelRef}
                style={{
                  ...bodyTextStyle,
                  overflow:     isActive ? 'visible' : 'hidden',
                  textOverflow: isActive ? 'clip'    : 'ellipsis',
                }}
                animate={isHovered && marqueeOffset > 0
                  ? { x: [0, -marqueeOffset] }
                  : { x: 0 }
                }
                transition={isHovered && marqueeOffset > 0
                  ? { duration: marqueeOffset / 40, ease: 'linear', delay: 1 }
                  : { duration: 0.3, ease: 'easeOut' }
                }
                onAnimationComplete={() => { setIsMarqueeing(false); setMarqueeDone(true) }}
              >
                {label}
              </motion.p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              {badge && (
                <motion.div layout transition={{ type: 'spring', stiffness: 400, damping: 28 }} style={{ display: 'flex', alignItems: 'center' }}>
                  {badge}
                </motion.div>
              )}
              <AnimatePresence mode="popLayout">
                {isActive && (
                  <motion.button
                    key="more"
                    type="button"
                    initial={{ opacity: 0, x: 6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 6 }}
                    transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); onMoreClick?.(e) }}
                    style={{
                      display:         'flex',
                      alignItems:      'center',
                      justifyContent:  'center',
                      overflow:        'hidden',
                      padding:         '6px',
                      borderRadius:    '8px',
                      flexShrink:      0,
                      backgroundColor: 'var(--sidebar-menu-item-hover-bg)',
                      border:          'none',
                      cursor:          onMoreClick ? 'pointer' : 'not-allowed',
                      color:           'var(--sidebar-menu-item-text)',
                    }}
                  >
                    <MoreHorizontalIcon size={20} />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            {/* Inner depth shadow — hover + selected */}
            {isActive && (
              <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 'inherit', boxShadow: SHADOW_ITEM_INNER }} />
            )}
          </>
        )}

        {/* ── Chat Item Edit variant ── */}
        {isEditVariant && (
          <div style={{ display: 'flex', alignItems: 'center', width: '100%', paddingTop: '2px', paddingBottom: '2px' }}>
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                // Stop every keystroke here — otherwise it bubbles to the row's
                // own onKeyDown, which treats Enter/Space as "activate this row"
                // and calls preventDefault on Space, silently blocking the
                // space character from ever reaching the input.
                e.stopPropagation()
                if (e.key === 'Enter') {
                  e.preventDefault()
                  renameResolvedRef.current = true
                  onCommit?.(editValue)
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  renameResolvedRef.current = true
                  onCancel?.()
                  toast.info('Rename cancelled')
                }
              }}
              onBlur={() => {
                // Enter/Escape already resolved this rename synchronously — the
                // blur that follows (input unmounting) is just DOM cleanup, not
                // a real click-away, so skip it to avoid double-handling.
                if (renameResolvedRef.current) return
                renameResolvedRef.current = true
                onCancel?.()
                toast.info('Rename cancelled')
              }}
              style={{
                width:       '100%',
                background:  'transparent',
                border:      'none',
                outline:     'none',
                fontFamily:  'var(--font-body)',
                fontWeight:  'var(--font-weight-medium)',
                fontSize:    'var(--font-size-body)',
                lineHeight:  'var(--line-height-body)',
                color:       'var(--sidebar-menu-item-text)',
                whiteSpace:  'nowrap',
                padding:     0,
                cursor:      'text',
              }}
            />
          </div>
        )}

        {/* ── Account Item variant ── */}
        {isAccountItem && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
              {/* Avatar */}
              <div
                style={{
                  position:     'relative',
                  flexShrink:   0,
                  width:        '32px',
                  height:       '32px',
                  borderRadius: '9999px',
                  boxShadow:    SHADOW_AVATAR,
                  overflow:     'hidden',
                }}
              >
                {avatarSrc ? (
                  <img
                    alt=""
                    src={avatarSrc}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: '9999px' }}
                  />
                ) : (
                  <div
                    style={{
                      position:       'absolute',
                      inset:          0,
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'center',
                      backgroundColor:'var(--neutral-white)',
                      color:          'var(--sidebar-menu-item-text)',
                      fontFamily:     'var(--font-body)',
                      fontWeight:     'var(--font-weight-medium)',
                      fontSize:       'var(--font-size-caption)',
                    }}
                  >
                    {label.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Name + sublabel — hidden when collapsed */}
              <AnimatePresence mode="popLayout" initial={false}>
                {!collapsed && (
                  <motion.div
                    key="user-info"
                    initial={{ opacity: 0, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, filter: 'blur(4px)' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flexShrink: 0 }}
                  >
                    <p style={bodyTextStyle}>{label}</p>
                    <p style={{ ...captionTextStyle, color: sublabelWarning ? 'var(--color-tag-Yellow-text,#854d0e)' : 'var(--sidebar-menu-item-text)', fontWeight: 'var(--font-weight-regular)' }}>
                      {sublabel}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Inner depth shadow — hover */}
            {isActive && (
              <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 'inherit', boxShadow: SHADOW_ITEM_INNER }} />
            )}

            {/* Right cluster — Figma "Icon Container" (6408:12254): the role badge
                and the settings (abacus) icon sit in ONE container at a 4px gap
                with 6px outer padding, so the chip↔icon gap is just 4px — not
                inflated by a separate button's own padding. The container is the
                settings click target. */}
            <AnimatePresence mode="popLayout" initial={false}>
              {!collapsed && (
                <motion.button
                  key="account-actions"
                  type="button"
                  aria-label="Account settings"
                  initial={{ opacity: 0, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(4px)' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  onClick={(e) => { e.stopPropagation(); onSettingsClick?.(e) }}
                  style={{
                    display:         'flex',
                    alignItems:      'center',
                    gap:             '4px',
                    padding:         '6px',
                    borderRadius:    '8px',
                    flexShrink:      0,
                    backgroundColor: 'transparent',
                    border:          'none',
                    cursor:          'pointer',
                    color:           'var(--sidebar-menu-item-text)',
                  }}
                >
                  {roleBadge && (
                    <span style={{ display: 'inline-flex', flexShrink: 0 }}>{roleBadge}</span>
                  )}
                  <span style={{ display: 'inline-flex', lineHeight: 0 }}>
                    <AbacusIcon size={20} triggered={isHovered} />
                  </span>
                </motion.button>
              )}
            </AnimatePresence>
          </>
        )}

      </>
    )

    if (isLink) {
      const {
        ref: _ref,
        role: _role,
        tabIndex,
        className,
        style,
        onMouseEnter,
        onMouseLeave,
        onFocus,
        onBlur,
        onKeyDown,
      } = rootProps
      return (
        <Link
          href={href!}
          tabIndex={tabIndex}
          className={className}
          style={style}
          onMouseEnter={onMouseEnter as unknown as React.MouseEventHandler<HTMLAnchorElement>}
          onMouseLeave={onMouseLeave as unknown as React.MouseEventHandler<HTMLAnchorElement>}
          onFocus={onFocus as unknown as React.FocusEventHandler<HTMLAnchorElement>}
          onBlur={onBlur as unknown as React.FocusEventHandler<HTMLAnchorElement>}
          onKeyDown={onKeyDown as unknown as React.KeyboardEventHandler<HTMLAnchorElement>}
          onClick={handleAnchorClick}
        >
          {content}
        </Link>
      )
    }

    return (
      <div onClick={isHeader ? undefined : onClick} {...rootProps}>
        {content}
      </div>
    )
  }
)

SidebarMenuItem.displayName = 'SidebarMenuItem'

export default SidebarMenuItem
