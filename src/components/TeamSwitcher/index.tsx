'use client'

import React, { useRef, useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDownOneIcon } from '@strange-huge/icons'
import { Popover } from '@/components/Popover'
import { DropdownMenuItem } from '@/components/DropdownMenuItem'
import { Divider } from '@/components/Divider'
import { Badge } from '@/components/Badge'
import { cn } from '@/lib/utils'

// ── Deterministic gradient palette ───────────────────────────────────────────
// Each team gets a unique gradient from its name. Stable — same name = same color.
// Uses the warm KDS palette: teal, blue, purple, orange, red-brown, green.

const TEAM_GRADIENTS = [
  'linear-gradient(135deg, #4FACDE 0%, #2D8BBF 100%)',  // teal-blue
  'linear-gradient(135deg, #9B6FE0 0%, #7B4FC0 100%)',  // purple
  'linear-gradient(135deg, #F59542 0%, #D4742A 100%)',  // orange
  'linear-gradient(135deg, #4CAF78 0%, #2D8F58 100%)',  // green
  'linear-gradient(135deg, #E06060 0%, #B83C3C 100%)',  // red-brown
  'linear-gradient(135deg, #60A8E0 0%, #3C80C0 100%)',  // blue
]

function getTeamGradient(teamId: string): string {
  let hash = 0
  for (let i = 0; i < teamId.length; i++) {
    hash = ((hash << 5) - hash) + teamId.charCodeAt(i)
    hash |= 0
  }
  return TEAM_GRADIENTS[Math.abs(hash) % TEAM_GRADIENTS.length]!
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TeamSwitcherTeam {
  id:            string
  name:          string
  projectCount?: number
  role?:         'owner' | 'admin' | 'editor' | 'member'
}

export interface TeamSwitcherProps extends React.HTMLAttributes<HTMLDivElement> {
  teams:         TeamSwitcherTeam[]
  activeTeamId?: string | null
  isAdmin?:      boolean
  /** Fires when user selects a team from dropdown */
  onTeamSelect?: (teamId: string | null) => void
}

// ── Team avatar — rounded square with the team's initial, gradient by id ──────

function TeamAvatar({ teamId, name, size = 20 }: { teamId: string; name: string; size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        position:     'relative',
        display:      'inline-flex',
        width:        size,
        height:       size,
        borderRadius: 4,
        background:   getTeamGradient(teamId),
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
        {name.charAt(0).toUpperCase()}
      </span>
    </span>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export const TeamSwitcher = React.forwardRef<HTMLDivElement, TeamSwitcherProps>(
  function TeamSwitcher(
    {
      teams,
      activeTeamId,
      isAdmin = false,
      onTeamSelect,
      className,
      style,
      ...props
    },
    ref,
  ) {
    const [open,    setOpen]    = useState(false)
    const [hovered, setHovered] = useState(false)
    const triggerRef            = useRef<HTMLButtonElement>(null)
    const panelRef              = useRef<HTMLDivElement>(null)

    const activeTeam = activeTeamId === null && isAdmin
      ? null
      : (teams.find(t => t.id === activeTeamId) ?? teams[0])
    const activeLabel = activeTeam?.name ?? 'All workspace'

    // Close on outside click
    useEffect(() => {
      if (!open) return
      const handler = (e: MouseEvent) => {
        if (
          panelRef.current?.contains(e.target as Node) ||
          triggerRef.current?.contains(e.target as Node)
        ) return
        setOpen(false)
      }
      document.addEventListener('mousedown', handler, { capture: true })
      return () => document.removeEventListener('mousedown', handler, { capture: true })
    }, [open])

    // Escape closes
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); triggerRef.current?.focus() }
    }, [])

    // If no teams: section simply doesn't render.
    // Individual users who aren't in any team won't see this section at all.
    if (teams.length === 0) return null

    return (
      <div
        ref={ref}
        className={cn(className)}
        style={{ position: 'relative', ...style }}
        onKeyDown={handleKeyDown}
        {...props}
      >
        {/* ── Header row — the whole row is the dropdown trigger ── */}
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Switch team — currently ${activeLabel}`}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            width:          '100%',
            borderRadius:   8,
            padding:        '4px 6px',
            backgroundColor: hovered ? 'var(--neutral-900-04, rgba(38,33,30,0.04))' : 'transparent',
            border:         'none',
            cursor:         'pointer',
            outline:        'none',
            transition:     'background-color 120ms ease',
          }}
        >
          {/* Left: avatar + team name */}
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: '1 0 0' }}>
            {activeTeam && <TeamAvatar teamId={activeTeam.id} name={activeTeam.name} size={20} />}
            <span
              style={{
                fontFamily:   'var(--font-body)',
                fontWeight:   'var(--font-weight-medium)',
                fontSize:     'var(--font-size-caption)',
                lineHeight:   'var(--line-height-caption)',
                color:        'var(--neutral-500)',
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                whiteSpace:   'nowrap',
              }}
            >
              {activeLabel}
            </span>
          </span>

          {/* Right: chevron in a Shortcut Container box */}
          <span
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              borderRadius:   4,
              padding:        2,
              flexShrink:     0,
              background:     'linear-gradient(180deg, var(--neutral-white) 0%, var(--neutral-50) 100%)',
              boxShadow:      '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(182,172,164,0.4)',
            }}
          >
            <ArrowDownOneIcon size={16} color="var(--neutral-500)" />
          </span>
        </button>

        {/* ── Dropdown panel ── */}
        <AnimatePresence>
          {open && (
            <motion.div
              key="team-switcher-panel"
              initial={{ opacity: 0, scaleX: 0.96, scaleY: 0.75, transformOrigin: 'top center' }}
              animate={{ opacity: 1, scaleX: 1, scaleY: 1, transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] } }}
              exit={{ opacity: 0, scaleY: 0.85, transition: { duration: 0.1, ease: [0.55, 0.085, 0.68, 0.53] } }}
              style={{
                position:     'absolute',
                top:          'calc(100% + 4px)',
                left:         0,
                right:        0,
                zIndex:       50,
              }}
            >
              <Popover
                ref={panelRef}
                variant="dropdown"
                maxHeight={false}
                role="menu"
                aria-label="Switch team"
                style={{ padding: 4, minWidth: '100%' }}
              >
                {/* Team rows */}
                {teams.map(team => (
                  <DropdownMenuItem
                    key={team.id}
                    fluid
                    label={team.name}
                    subLabel={team.projectCount != null ? `${team.projectCount} project${team.projectCount !== 1 ? 's' : ''}` : undefined}
                    selected={team.id === activeTeamId}
                    icon={<TeamAvatar teamId={team.id} name={team.name} size={20} />}
                    badge={team.role && (
                      <Badge
                        label={team.role.charAt(0).toUpperCase() + team.role.slice(1)}
                        color={team.role === 'owner' || team.role === 'admin' ? 'Yellow' : team.role === 'editor' ? 'Blue' : 'Neutral'}
                      />
                    )}
                    onClick={() => { onTeamSelect?.(team.id); setOpen(false) }}
                  />
                ))}

                {/* Admin-only options */}
                {isAdmin && (
                  <>
                    <Divider decorative style={{ margin: '4px 0', backgroundColor: 'rgba(59,54,50,0.1)' }} />
                    <DropdownMenuItem
                      fluid
                      label="All workspace"
                      selected={activeTeamId === null}
                      onClick={() => { onTeamSelect?.(null); setOpen(false) }}
                    />
                  </>
                )}
              </Popover>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  },
)

TeamSwitcher.displayName = 'TeamSwitcher'
export default TeamSwitcher
