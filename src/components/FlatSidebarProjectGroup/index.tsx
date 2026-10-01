'use client'

import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { FolderOneIcon, PlusSignIcon, QuillWriteTwoIcon, SettingsOneIcon } from '@strange-huge/icons'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/Tooltip'
import { RESET_BUTTON_STYLE } from '@/lib/reset-button-style'

// ── "Sidebar / Project Group" (Figma 136:49968) ──────────────────────────────
// Project row + its nested chats, inset 28px so child labels align under the
// parent label — "no sub-header; a nested block under a project is
// self-evidently that project's chats" (Figma component description).
//
// The row itself is purely an expand/collapse toggle now — it no longer
// navigates anywhere on click. Two hover-revealed icons replace the old
// rotating chevron: a feather (start a new chat in this project) and a
// settings gear (go to the project's own page).

const SHADOW_ITEM_HOVER = 'var(--shadow-sidebar-item-hover)'

const heightVariants = {
  open: { height: 'auto' as const, transition: { duration: 0.28, ease: [0.4, 0, 0.2, 1] as const } },
  closed: { height: 0, transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] as const, delay: 0.14 } },
}
const staggerVariants = {
  open: { transition: { staggerChildren: 0.04, delayChildren: 0.24 } },
  closed: { transition: {} },
}
const itemVariants = {
  open: { opacity: 1, y: 0, transition: { duration: 0.18, ease: 'easeOut' as const } },
  closed: { opacity: 0, y: 5, transition: { duration: 0.12, ease: 'easeIn' as const } },
}

export interface FlatSidebarProjectGroupProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onClick'> {
  label?: string
  active?: boolean
  expanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  icon?: React.ReactElement<{ triggered?: boolean }> | null
  badge?: React.ReactNode
  children?: React.ReactNode
  /** Feather icon — starts a new chat inside this project. Omit to hide the icon. */
  onNewChat?: () => void
  /** Settings icon — goes to this project's own page. Omit to hide the icon. */
  onOpen?: () => void
  /** Makes the leading icon its own click target (e.g. navigate to an "all projects" page) instead of just toggling expand/collapse. */
  onIconClick?: () => void
  /** Trailing plus button (e.g. "New project") — distinct from onNewChat/onOpen, which are per-project actions. Omit to hide. */
  onAddClick?: () => void
  /** aria-label for the add button. Defaults to `Add to ${label}`. */
  addLabel?: string
}

export const FlatSidebarProjectGroup = React.forwardRef<HTMLDivElement, FlatSidebarProjectGroupProps>(
  function FlatSidebarProjectGroup(
    { label = '', active = false, expanded: expandedProp, onExpandedChange, icon, badge, children, onNewChat, onOpen, onIconClick, onAddClick, addLabel, className, ...props },
    ref,
  ) {
    const isControlled = expandedProp !== undefined
    const [internalExpanded, setInternalExpanded] = useState(false)
    const isExpanded = isControlled ? expandedProp! : internalExpanded
    const rowRef = useRef<HTMLDivElement>(null)
    const [isHovered, setIsHovered] = useState(false)
    const isActive = isHovered || active
    const [overflow, setOverflow] = useState<'visible' | 'hidden'>('hidden')

    // Per-icon hover — darkens just the icon being pointed at, independent of
    // the row-level hover that only controls reveal (opacity), matching FlatSidebarRow.
    const [newChatIconHovered, setNewChatIconHovered] = useState(false)
    const [openIconHovered, setOpenIconHovered] = useState(false)

    // The sidebar re-sorts projects by recency, so a background update (a
    // chat's updatedAt bumping, etc.) can reorder this row out from under the
    // cursor while its key stays stable — React moves the DOM node instead of
    // remounting it. Browsers only fire mouseenter/mouseleave on real pointer
    // motion, not on a layout move, so a stale `isHovered` can otherwise stick
    // (buttons left visible/clickable on a row the cursor isn't over anymore).
    // Re-validate against the live cursor on the next pointer movement so it
    // self-heals instead of staying wrong until the row happens to be
    // re-entered/left directly.
    useEffect(() => {
      if (!isHovered) return
      const recheck = (e: MouseEvent) => {
        const rect = rowRef.current?.getBoundingClientRect()
        const inside = !!rect && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom
        if (!inside) setIsHovered(false)
      }
      window.addEventListener('mousemove', recheck)
      return () => window.removeEventListener('mousemove', recheck)
    }, [isHovered])

    useEffect(() => {
      if (!isHovered) {
        setNewChatIconHovered(false)
        setOpenIconHovered(false)
      }
    }, [isHovered])

    const toggle = () => {
      const next = !isExpanded
      if (!isControlled) setInternalExpanded(next)
      onExpandedChange?.(next)
    }

    return (
      <div ref={ref} className={cn(className)} style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }} {...props}>
        {/* Not itself a role="button" any more — it used to wrap the toggle
            button, the icon, and up to 3 more role="button" spans (new chat /
            open / add) all as nested interactive descendants of one outer
            interactive element, which assistive tech can't reliably operate
            (nested-interactive-control). The toggle, icon (when clickable),
            and each action are now real, sibling <button>s inside this purely
            visual/hover-tracking row; nothing here needs stopPropagation any
            more since there's no longer a parent click handler to protect
            against. */}
        <div
          ref={rowRef}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          data-sidebar-active={isActive ? '' : undefined}
          style={{
            position:        'relative',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'space-between',
            gap:             8,
            width:           '100%',
            height:          32,
            padding:         '0 8px',
            borderRadius:    10,
            backgroundColor: isActive ? 'var(--sidebar-menu-item-hover-bg)' : 'transparent',
            boxShadow:       isActive ? SHADOW_ITEM_HOVER : undefined,
            transition:      'background-color 150ms, box-shadow 150ms',
            userSelect:      'none',
            boxSizing:       'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 0 0', minWidth: 0 }}>
            {icon !== null && (
              onIconClick ? (
                <button
                  type="button"
                  onClick={onIconClick}
                  aria-label={`Open ${label}`}
                  style={{ ...RESET_BUTTON_STYLE, color: 'var(--sidebar-icon, var(--sidebar-menu-item-text))', flexShrink: 0, lineHeight: 0, cursor: 'pointer' }}
                >
                  {icon ? React.cloneElement(icon, { triggered: isHovered }) : <FolderOneIcon size={20} variant={(isExpanded || active) ? 'open' : 'closed'} triggered={isHovered} />}
                </button>
              ) : (
                <div style={{ color: 'var(--sidebar-icon, var(--sidebar-menu-item-text))', flexShrink: 0, lineHeight: 0 }}>
                  {icon ? React.cloneElement(icon, { triggered: isHovered }) : <FolderOneIcon size={20} variant={(isExpanded || active) ? 'open' : 'closed'} triggered={isHovered} />}
                </div>
              )
            )}
            <button
              type="button"
              aria-expanded={isExpanded}
              onClick={toggle}
              style={{
                ...RESET_BUTTON_STYLE,
                fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-body)',
                lineHeight: 'var(--line-height-body)', color: isHovered ? 'var(--neutral-black)' : 'var(--sidebar-menu-item-text)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: '1 0 0', minWidth: 0,
              }}
            >
              {label}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {badge}

            {onNewChat && (
              <Tooltip content="New project chat" side="top" delayDuration={300}>
                <button
                  type="button"
                  aria-label={`New chat in ${label}`}
                  onClick={onNewChat}
                  onMouseEnter={() => setNewChatIconHovered(true)}
                  onMouseLeave={() => setNewChatIconHovered(false)}
                  style={{
                    ...RESET_BUTTON_STYLE, display: 'inline-flex', lineHeight: 0,
                    color: newChatIconHovered ? 'var(--neutral-black)' : 'var(--sidebar-icon, var(--sidebar-menu-item-text))',
                    opacity: isActive ? 0.7 : 0, pointerEvents: isActive ? 'auto' : 'none', transition: 'opacity 150ms, color 150ms',
                  }}
                >
                  <QuillWriteTwoIcon size={16} animated />
                </button>
              </Tooltip>
            )}

            {onOpen && (
              <Tooltip content="Manage project" side="top" delayDuration={300}>
                <button
                  type="button"
                  aria-label={`Open ${label}`}
                  onClick={onOpen}
                  onMouseEnter={() => setOpenIconHovered(true)}
                  onMouseLeave={() => setOpenIconHovered(false)}
                  style={{
                    ...RESET_BUTTON_STYLE, display: 'inline-flex', lineHeight: 0,
                    color: openIconHovered ? 'var(--neutral-black)' : 'var(--sidebar-icon, var(--sidebar-menu-item-text))',
                    opacity: isActive ? 0.7 : 0, pointerEvents: isActive ? 'auto' : 'none', transition: 'opacity 150ms, color 150ms',
                  }}
                >
                  <SettingsOneIcon size={16} />
                </button>
              </Tooltip>
            )}

            {onAddClick && (
              <button
                type="button"
                aria-label={addLabel ?? `Add to ${label}`}
                onClick={onAddClick}
                style={{ ...RESET_BUTTON_STYLE, display: 'inline-flex', lineHeight: 0, color: 'var(--sidebar-icon, var(--sidebar-menu-item-text))', opacity: isActive ? 0.7 : 0, pointerEvents: isActive ? 'auto' : 'none', transition: 'opacity 150ms' }}
              >
                <PlusSignIcon size={16} />
              </button>
            )}
          </div>
        </div>

        <AnimatePresence initial={false}>
          {isExpanded && children && (
            <m.div
              key="content"
              initial="closed"
              animate="open"
              exit="closed"
              variants={heightVariants}
              style={{ overflow }}
              onAnimationStart={(def) => { if (def === 'closed') setOverflow('hidden') }}
              onAnimationComplete={(def) => { if (def === 'open') setOverflow('visible') }}
            >
              <m.div
                variants={staggerVariants}
                style={{ paddingLeft: icon === null ? 6 : 28, display: 'flex', flexDirection: 'column', gap: 4 }}
              >
                {React.Children.map(children, (child, i) => (
                  <m.div key={i} variants={itemVariants}>{child}</m.div>
                ))}
              </m.div>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    )
  },
)

FlatSidebarProjectGroup.displayName = 'FlatSidebarProjectGroup'
export default FlatSidebarProjectGroup
