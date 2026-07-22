'use client'

import React, { useState } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDownOneIcon, FolderOneIcon } from '@strange-huge/icons'
import { RoleBadge } from '@/components/RoleBadge'
import type { WorkspaceRole, RoleBadgeMode } from '@/components/RoleBadge'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TeamSwitcherRowProps extends React.HTMLAttributes<HTMLDivElement> {
  teamName:         string
  teamId:           string
  projectCount:     number
  currentUserRole:  WorkspaceRole
  roleMode?:        RoleBadgeMode
  isOpen?:          boolean
  onClick?:         () => void
  asChild?:         boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export const TeamSwitcherRow = React.forwardRef<HTMLDivElement, TeamSwitcherRowProps>(
  function TeamSwitcherRow(
    {
      teamName,
      teamId: _teamId,
      projectCount: _projectCount,
      currentUserRole,
      roleMode = 'solar',
      isOpen = false,
      onClick,
      asChild = false,
      className,
      style,
      onMouseEnter: externalMouseEnter,
      onMouseLeave: externalMouseLeave,
      ...props
    },
    ref,
  ) {
    const Comp       = (asChild ? Slot : 'div') as React.ElementType
    const [hovered, setHovered] = useState(false)
    const isActive   = hovered || isOpen

    return (
      <Comp
        ref={ref}
        className={className}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') onClick?.() }}
        onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => { setHovered(true); externalMouseEnter?.(e) }}
        onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => { setHovered(false); externalMouseLeave?.(e) }}
        style={{
          width:           '100%',
          boxSizing:       'border-box',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'space-between',
          paddingLeft:     '6px',
          paddingRight:    '6px',
          paddingTop:      '5px',
          paddingBottom:   '5px',
          borderRadius:    '10px',
          cursor:          'pointer',
          backgroundColor: isActive ? 'var(--sidebar-menu-item-hover-bg)' : 'transparent',
          boxShadow:       isActive ? 'var(--shadow-sidebar-item-hover)' : undefined,
          transition:      'background-color 150ms, box-shadow 150ms',
          ...style,
        }}
        {...props}
      >
        {/* Left: folder icon + team name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          <span
            aria-hidden
            style={{
              display:        'inline-flex',
              alignItems:     'center',
              justifyContent: 'center',
              width:          '20px',
              height:         '20px',
              flexShrink:     0,
              color:          'var(--sidebar-menu-item-text)',
            }}
          >
            <FolderOneIcon size={20} />
          </span>

          <span
            style={{
              fontFamily:   'var(--font-body)',
              fontWeight:   'var(--font-weight-medium)',
              fontSize:     'var(--font-size-body)',
              lineHeight:   'var(--line-height-body)',
              color:        'var(--sidebar-menu-item-text)',
              whiteSpace:   'nowrap',
              overflow:     'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {teamName}
          </span>
        </div>

        {/* Right: role badge + expand button — 4px gap */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          <RoleBadge role={currentUserRole} showLabel mode={roleMode} />

          <span
            style={{
              position:        'relative',
              display:         'inline-flex',
              alignItems:      'center',
              justifyContent:  'center',
              width:           '20px',
              height:          '20px',
              borderRadius:    '4px',
              backgroundColor: 'var(--neutral-white)',
              boxShadow:       '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(182,172,164,0.4)',
              flexShrink:      0,
              color:           'var(--neutral-600)',
              overflow:        'hidden',
            }}
          >
            <AnimatePresence initial={false} mode="wait">
              <motion.span
                key={isOpen ? 'up' : 'down'}
                initial={{ opacity: 0, y: isOpen ? 6 : -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.13, ease: [0.16, 1, 0.3, 1] }}
                style={{ position: 'absolute', inset: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <span style={{ display: 'inline-flex', transform: isOpen ? 'rotate(180deg)' : 'none' }}>
                  <ArrowDownOneIcon size={16} />
                </span>
              </motion.span>
            </AnimatePresence>
          </span>
        </div>
      </Comp>
    )
  },
)

TeamSwitcherRow.displayName = 'TeamSwitcherRow'
export default TeamSwitcherRow
