'use client'

import React, { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { m, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  LogoIcon,
  BubbleChatAddIcon,
  MoreHorizontalIcon,
  AbacusIcon,
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
  /** Subtitle / email - account-item only */
  sublabel?: string
  /**
   * Icon for the `default` variant. Must be a `@strange-huge/icons` component
   * that accepts a `triggered` prop - it will fire when the item is hovered.
   * Defaults to `<LogoIcon size={20} />`.
   */
  icon?: React.ReactElement<{ triggered?: boolean }>
  /** Avatar image URL - account-item only */
  avatarSrc?: string
  /** Shortcut badge text - default variant only, e.g. '⌘ K' */
  shortcut?: string
  /** Click handler for the "..." more button - chat-item only */
  onMoreClick?: React.MouseEventHandler<HTMLButtonElement>
  /**
   * Called when the user triggers a rename via keyboard (double Enter within 400ms) - chat-item only.
   * Parent should switch to chat-item-edit variant.
   */
  onRename?: () => void
  /**
   * Called when the user commits a rename - chat-item-edit only.
   * Receives the new label value. Triggered by Enter or blur.
   */
  onCommit?: (value: string) => void
  /**
   * Called when the user cancels a rename - chat-item-edit only.
   * Triggered by Escape. Parent should switch back to chat-item variant.
   */
  onCancel?: () => void
  /** Click handler for the settings icon button - account-item only */
  onSettingsClick?: React.MouseEventHandler<HTMLButtonElement>
  /** Click handler for the "Show"/"Hide" toggle button on header hover - header only */
  onShowClick?: React.MouseEventHandler<HTMLButtonElement>
  /** Controls whether the toggle reads "Hide" (true) or "Show" (false/undefined) - header only */
  shown?: boolean
  /** Persistent selected state - default, new-chat, chat-item variants only */
  selected?: boolean
  /** Stretch to full width instead of fixed 217px - use inside Sidebar */
  fluid?: boolean
  /** Icon-only mode for collapsed sidebar - hides labels, shortcut, and text content */
  collapsed?: boolean
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

export function SidebarMenuItem({
      ref,
      variant = 'default',
      label = 'Label',
      sublabel = 'Label',
      icon = DEFAULT_ICON,
      avatarSrc,
      shortcut,
      onMoreClick,
      onRename,
      onCommit,
      onCancel,
      onSettingsClick,
      onShowClick,
      shown = false,
      selected = false,
      fluid = false,
      collapsed = false,
      className,
      onMouseEnter: externalMouseEnter,
      onMouseLeave: externalMouseLeave,
      onFocus:      externalFocus,
      onBlur:       externalBlur,
      onClick,
      ...props
    // eslint-disable-next-line react-doctor/prefer-useReducer -- multiple useState calls; useReducer refactor deferred
    }: SidebarMenuItemProps & { ref?: React.Ref<HTMLDivElement> }) {
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
    // eslint-disable-next-line react-doctor/no-derived-useState -- intentional draft-state pattern; reset handled by key prop or effect
    const [editValue, setEditValue] = useState(label)
    const inputRef    = useRef<HTMLInputElement>(null)
    const cancelledRef = useRef(false)
    const lastEnterRef = useRef<number>(0)

    useEffect(() => {
      if (!isEditVariant) return
      cancelledRef.current = false
      const id = requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          inputRef.current.select()
        }
      })
      return () => cancelAnimationFrame(id)
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

    // eslint-disable-next-line react-doctor/no-cascading-set-state -- React 18+ batches these; useReducer refactor tracked separately
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
    const handleItemFocus = (e: React.FocusEvent<HTMLDivElement>) => {
      setIsFocused(true)
      externalFocus?.(e)
    }
    const handleItemBlur = (e: React.FocusEvent<HTMLDivElement>) => {
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
    return (
      // eslint-disable-next-line react-doctor/no-static-element-interactions -- div has role=button and tabIndex; keyboard events handled by contained elements
      <div
        ref={ref}
        role={isHeader || isEditVariant ? undefined : 'button'}
        tabIndex={isHeader || isEditVariant ? undefined : 0}
        className={cn(!isHeader && !isEditVariant && 'kaya-sidebar-item', className)}
        style={containerStyle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleItemFocus}
        onBlur={handleItemBlur}
        onKeyDown={handleKeyDown}
        onClick={isHeader ? undefined : onClick}
        {...props}
      >

        {/* ── Header variant ── */}
        {isHeader && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <p style={{ ...captionTextStyle, fontWeight: 'var(--font-weight-medium)' }}>
              {label}
            </p>
            {onShowClick && (
              <button
                type="button"
                tabIndex={isActive ? 0 : -1}
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
                  <m.span
                    key={shown ? 'hide' : 'show'}
                    initial={{ scale: 0.75, opacity: 0, filter: 'blur(4px)' }}
                    animate={{ scale: 1,    opacity: 1, filter: 'blur(0px)' }}
                    exit={{    scale: 0.75, opacity: 0, filter: 'blur(4px)' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    style={{ display: 'block', transformOrigin: 'left center' }}
                  >
                    {shown ? 'Hide' : 'Show'}
                  </m.span>
                </AnimatePresence>
              </button>
            )}
          </div>
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
                  <m.p
                    key="label"
                    style={bodyTextStyle}
                    initial={{ opacity: 0, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, filter: 'blur(4px)' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  >
                    {label}
                  </m.p>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence mode="popLayout" initial={false}>
              {!collapsed && shortcut && (
                <m.div
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
                </m.div>
              )}
            </AnimatePresence>

            {/* Inner depth shadow - hover + selected */}
            {isActive && (
              <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 'inherit', boxShadow: SHADOW_ITEM_INNER }} />
            )}
          </>
        )}

        {/* ── New Chat variant ── */}
        {variant === 'new-chat' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <div style={{ position: 'relative', flexShrink: 0, width: '20px', height: '20px' }}>
              {/* Floating badge - visible at rest, hidden on hover/selected/collapsed */}
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
                <m.p
                  key="label"
                  style={bodyTextStyle}
                  initial={{ opacity: 0, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(4px)' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                >
                  {label}
                </m.p>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Inner depth shadow for new-chat - hover + selected */}
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
              <m.p
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
              </m.p>
            </div>

            {/* More button - reveals on hover or selected */}
            {isActive && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onMoreClick?.(e) }}
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
                  cursor:          'pointer',
                  color:           'var(--sidebar-menu-item-text)',
                }}
              >
                <MoreHorizontalIcon size={20} />
              </button>
            )}

            {/* Inner depth shadow - hover + selected */}
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
              // eslint-disable-next-line react-doctor/no-autofocus -- focus moves into rename input on user-triggered rename
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  cancelledRef.current = false
                  onCommit?.(editValue)
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  cancelledRef.current = true
                  onCancel?.()
                }
              }}
              onBlur={() => {
                if (!cancelledRef.current) onCommit?.(editValue)
              }}
              style={{
                width:       '100%',
                background:  'transparent',
                border:      'none',
                // eslint-disable-next-line react-doctor/no-outline-none -- browser outline suppressed; :focus-visible handled by container or global styles
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
                  <Image
                    alt=""
                    src={avatarSrc}
                    fill
                    sizes="32px"
                    unoptimized
                    style={{ objectFit: 'cover', borderRadius: '9999px' }}
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

              {/* Name + sublabel - hidden when collapsed */}
              <AnimatePresence mode="popLayout" initial={false}>
                {!collapsed && (
                  <m.div
                    key="user-info"
                    initial={{ opacity: 0, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, filter: 'blur(4px)' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flexShrink: 0 }}
                  >
                    <p style={bodyTextStyle}>{label}</p>
                    <p style={{ ...captionTextStyle, color: 'var(--sidebar-menu-item-text)', fontWeight: 'var(--font-weight-regular)' }}>
                      {sublabel}
                    </p>
                  </m.div>
                )}
              </AnimatePresence>
            </div>

            {/* Inner depth shadow - hover */}
            {isActive && (
              <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 'inherit', boxShadow: SHADOW_ITEM_INNER }} />
            )}

            {/* Settings button - hidden when collapsed */}
            <AnimatePresence mode="popLayout" initial={false}>
              {!collapsed && (
                <m.button
                  key="settings"
                  type="button"
                  initial={{ opacity: 0, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(4px)' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  onClick={(e) => { e.stopPropagation(); onSettingsClick?.(e) }}
                  style={{
                    display:         'flex',
                    alignItems:      'center',
                    justifyContent:  'center',
                    overflow:        'hidden',
                    padding:         '6px',
                    borderRadius:    '8px',
                    flexShrink:      0,
                    backgroundColor: 'transparent',
                    border:          'none',
                    cursor:          'pointer',
                    color:           'var(--sidebar-menu-item-text)',
                  }}
                >
                  <AbacusIcon size={20} triggered={isHovered} />
                </m.button>
              )}
            </AnimatePresence>
          </>
        )}

      </div>
    )
}

SidebarMenuItem.displayName = 'SidebarMenuItem'

export default SidebarMenuItem
