'use client'

import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FolderOneIcon, PlusSignIcon, QuillWriteTwoIcon, SettingsOneIcon } from '@strange-huge/icons'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/Tooltip'

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
    const [isHovered, setIsHovered] = useState(false)
    const isActive = isHovered || active
    const [overflow, setOverflow] = useState<'visible' | 'hidden'>('hidden')

    // Per-icon hover — darkens just the icon being pointed at, independent of
    // the row-level hover that only controls reveal (opacity), matching FlatSidebarRow.
    const [newChatIconHovered, setNewChatIconHovered] = useState(false)
    const [openIconHovered, setOpenIconHovered] = useState(false)

    const toggle = () => {
      const next = !isExpanded
      if (!isControlled) setInternalExpanded(next)
      onExpandedChange?.(next)
    }

    return (
      <div ref={ref} className={cn(className)} style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }} {...props}>
        <div
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded}
          onClick={toggle}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() } }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
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
            cursor:          'pointer',
            transition:      'background-color 150ms, box-shadow 150ms',
            userSelect:      'none',
            boxSizing:       'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 0 0', minWidth: 0 }}>
            {icon !== null && (
              <div
                role={onIconClick ? 'button' : undefined}
                tabIndex={onIconClick ? 0 : undefined}
                aria-label={onIconClick ? `Open ${label}` : undefined}
                onClick={onIconClick ? (e) => { e.stopPropagation(); onIconClick() } : undefined}
                onKeyDown={onIconClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onIconClick() } } : undefined}
                style={{ color: 'var(--sidebar-menu-item-text)', flexShrink: 0, lineHeight: 0, cursor: onIconClick ? 'pointer' : undefined }}
              >
                {icon ? React.cloneElement(icon, { triggered: isHovered }) : <FolderOneIcon size={20} variant={(isExpanded || active) ? 'open' : 'closed'} triggered={isHovered} />}
              </div>
            )}
            <p
              style={{
                fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-body)',
                lineHeight: 'var(--line-height-body)', color: isHovered ? 'var(--neutral-black)' : 'var(--sidebar-menu-item-text)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: '1 0 0', minWidth: 0, margin: 0,
              }}
            >
              {label}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {badge}

            {onNewChat && (
              <Tooltip content="New project chat" side="top" delayDuration={300}>
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`New chat in ${label}`}
                  onClick={(e) => { e.stopPropagation(); onNewChat() }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onNewChat() } }}
                  onMouseEnter={() => setNewChatIconHovered(true)}
                  onMouseLeave={() => setNewChatIconHovered(false)}
                  style={{
                    display: 'inline-flex', lineHeight: 0, cursor: 'pointer',
                    color: newChatIconHovered ? 'var(--neutral-black)' : 'var(--sidebar-menu-item-text)',
                    opacity: isActive ? 0.7 : 0, transition: 'opacity 150ms, color 150ms',
                  }}
                >
                  <QuillWriteTwoIcon size={16} animated />
                </span>
              </Tooltip>
            )}

            {onOpen && (
              <Tooltip content="Manage project" side="top" delayDuration={300}>
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${label}`}
                  onClick={(e) => { e.stopPropagation(); onOpen() }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onOpen() } }}
                  onMouseEnter={() => setOpenIconHovered(true)}
                  onMouseLeave={() => setOpenIconHovered(false)}
                  style={{
                    display: 'inline-flex', lineHeight: 0, cursor: 'pointer',
                    color: openIconHovered ? 'var(--neutral-black)' : 'var(--sidebar-menu-item-text)',
                    opacity: isActive ? 0.7 : 0, transition: 'opacity 150ms, color 150ms',
                  }}
                >
                  <SettingsOneIcon size={16} />
                </span>
              </Tooltip>
            )}

            {onAddClick && (
              <span
                role="button"
                tabIndex={0}
                aria-label={addLabel ?? `Add to ${label}`}
                onClick={(e) => { e.stopPropagation(); onAddClick() }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onAddClick() } }}
                style={{ display: 'inline-flex', lineHeight: 0, cursor: 'pointer', color: 'var(--sidebar-menu-item-text)', opacity: isActive ? 0.7 : 0, transition: 'opacity 150ms' }}
              >
                <PlusSignIcon size={16} />
              </span>
            )}
          </div>
        </div>

        <AnimatePresence initial={false}>
          {isExpanded && children && (
            <motion.div
              key="content"
              initial="closed"
              animate="open"
              exit="closed"
              variants={heightVariants}
              style={{ overflow }}
              onAnimationStart={(def) => { if (def === 'closed') setOverflow('hidden') }}
              onAnimationComplete={(def) => { if (def === 'open') setOverflow('visible') }}
            >
              <motion.div
                variants={staggerVariants}
                style={{ paddingLeft: icon === null ? 6 : 28, display: 'flex', flexDirection: 'column', gap: 4 }}
              >
                {React.Children.map(children, (child, i) => (
                  <motion.div key={i} variants={itemVariants}>{child}</motion.div>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  },
)

FlatSidebarProjectGroup.displayName = 'FlatSidebarProjectGroup'
export default FlatSidebarProjectGroup
