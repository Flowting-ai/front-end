'use client'

import React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDownOneIcon } from '@strange-huge/icons'
import { RoleBadge } from '@/components/RoleBadge'
import type { WorkspaceRole, RoleBadgeMode } from '@/components/RoleBadge'

// ── Team gradient (same algorithm as TeamChip / TeamSwitcher) ─────────────────

const TEAM_GRADIENTS = [
  'linear-gradient(135deg, #4FACDE 0%, #2D8BBF 100%)',
  'linear-gradient(135deg, #9B6FE0 0%, #7B4FC0 100%)',
  'linear-gradient(135deg, #F59542 0%, #D4742A 100%)',
  'linear-gradient(135deg, #4CAF78 0%, #2D8F58 100%)',
  'linear-gradient(135deg, #E06060 0%, #B83C3C 100%)',
  'linear-gradient(135deg, #60A8E0 0%, #3C80C0 100%)',
]

function getGradient(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h) + seed.charCodeAt(i)
    h |= 0
  }
  return TEAM_GRADIENTS[Math.abs(h) % TEAM_GRADIENTS.length]!
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
      ...props
    },
    ref,
  ) {
    const Comp     = (asChild ? Slot : 'div') as React.ElementType
    const gradient = getGradient(teamName)
    const initial  = teamName.charAt(0).toUpperCase()

    return (
      <Comp
        ref={ref}
        className={className}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') onClick?.() }}
        style={{
          // Full-width so space-between pushes the role badge + chevron to the
          // right edge (avatar + name hug the left). Without this the row hugs
          // its content and the badge/chevron bunch up after the name.
          width:          '100%',
          boxSizing:      'border-box',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          paddingLeft:    '6px',
          paddingRight:   '6px',
          paddingTop:     '5px',
          paddingBottom:  '5px',
          borderRadius:   '10px',
          cursor:         'pointer',
          ...style,
        }}
        {...props}
      >
        {/* Left: avatar + team name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          {/* 20×20 gradient avatar */}
          <span
            aria-hidden
            style={{
              display:        'inline-flex',
              alignItems:     'center',
              justifyContent: 'center',
              width:          '20px',
              height:         '20px',
              borderRadius:   '3px',
              background:     gradient,
              flexShrink:     0,
              fontFamily:     'var(--font-title)',
              fontWeight:     500,
              fontSize:       '11px',
              lineHeight:     1,
              color:          'var(--neutral-white)',
              boxShadow:      'inset 0px 4px 4px rgba(0,0,0,0.25), inset 0px -1px 0.4px rgba(18,60,95,0.65)',
            }}
          >
            {initial}
          </span>

          <span
            style={{
              fontFamily:  'var(--font-body)',
              fontWeight:  500,
              fontSize:    '11px',
              lineHeight:  1,
              color:       'var(--neutral-500)',
              whiteSpace:  'nowrap',
              overflow:    'hidden',
              textOverflow:'ellipsis',
            }}
          >
            {teamName}
          </span>
        </div>

        {/* Right: role badge + expand button — 4px gap (Figma 6419:83526) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          <RoleBadge role={currentUserRole} showLabel mode={roleMode} />

          {/* Expand chevron — closed shows a down chevron, open shows an up
              chevron. The icon is NOT spun 180° as an animation; the down and up
              glyphs swap via a soft opacity + vertical dissolve (AnimatePresence),
              so it reads as a smooth cut, never a rotation. The "up" glyph is the
              same chevron flipped with a STATIC transform (orientation only — the
              transition itself only touches opacity + y). */}
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
                {/* Rotate a wrapper span, NOT the icon: ArrowDownOneIcon clobbers
                    its own `transform`, so a `style` transform on it is dropped.
                    Open → flip the down chevron to point up (static orientation). */}
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
