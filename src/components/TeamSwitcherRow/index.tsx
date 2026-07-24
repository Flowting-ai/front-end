'use client'

import React, { useState } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDownOneIcon } from '@strange-huge/icons'
import { RoleBadge } from '@/components/RoleBadge'
import type { WorkspaceRole, RoleBadgeMode } from '@/components/RoleBadge'

// ── Deterministic gradient palette — seeded by team NAME, matching
// TeamSwitcherDropdown's getGradient(team.name) exactly, so a team's row here
// is always the same colour as its entry in the dropdown it triggers. ──────

const TEAM_GRADIENTS = [
  'linear-gradient(135deg, #4FACDE 0%, #2D8BBF 100%)',  // teal-blue
  'linear-gradient(135deg, #9B6FE0 0%, #7B4FC0 100%)',  // purple
  'linear-gradient(135deg, #F59542 0%, #D4742A 100%)',  // orange
  'linear-gradient(135deg, #4CAF78 0%, #2D8F58 100%)',  // green
  'linear-gradient(135deg, #E06060 0%, #B83C3C 100%)',  // red-brown
  'linear-gradient(135deg, #60A8E0 0%, #3C80C0 100%)',  // blue
]

function getTeamGradient(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i)
    hash |= 0
  }
  return TEAM_GRADIENTS[Math.abs(hash) % TEAM_GRADIENTS.length]!
}

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
        {/* Left: gradient team-initial avatar + team name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          <span
            aria-hidden
            style={{
              position:     'relative',
              display:      'inline-flex',
              width:        '20px',
              height:       '20px',
              borderRadius: 4,
              background:   getTeamGradient(teamName),
              flexShrink:   0,
              overflow:     'hidden',
            }}
          >
            <span
              aria-hidden
              style={{
                position:      'absolute',
                inset:         0,
                borderRadius:  4,
                pointerEvents: 'none',
                boxShadow:     'inset 0px 4px 4px 0px rgba(0,0,0,0.25), inset 0px -1px 0.4px 0px rgba(18,60,95,0.65)',
              }}
            />
            <span
              style={{
                position:       'absolute',
                inset:          0,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                fontFamily:     'var(--font-title)',
                fontWeight:     500,
                fontSize:       11,
                lineHeight:     1,
                color:          'var(--neutral-white)',
                userSelect:     'none',
              }}
            >
              {teamName.charAt(0).toUpperCase()}
            </span>
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
