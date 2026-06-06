'use client'

import React, { useRef, useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDownOneIcon } from '@strange-huge/icons'
import { Popover } from '@/components/Popover'
import { DropdownMenuItem } from '@/components/DropdownMenuItem'
import { Divider } from '@/components/Divider'
import { springs } from '@/lib/springs'
import { cn } from '@/lib/utils'

// ── Shadows ───────────────────────────────────────────────────────────────────
const SHADOW_HEADER_HOVER = 'var(--shadow-sidebar-item-hover)'

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
  id:           string
  name:         string
  projectCount?: number
}

export interface TeamSwitcherProps extends React.HTMLAttributes<HTMLDivElement> {
  teams:         TeamSwitcherTeam[]
  activeTeamId?: string | null
  isAdmin?:      boolean
  /** Fires when user selects a team from dropdown */
  onTeamSelect?: (teamId: string | null) => void
  /** Fires when "Manage teams →" is clicked (Admin only) */
  onManageTeams?: () => void
  /** Fires when the collapse chevron is clicked */
  onToggleCollapse?: () => void
  isCollapsed?: boolean
}

// ── Team avatar dot ───────────────────────────────────────────────────────────

function TeamDot({ teamId, size = 18 }: { teamId: string; size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        display:    'inline-flex',
        width:      size,
        height:     size,
        borderRadius: '50%',
        background: getTeamGradient(teamId),
        flexShrink: 0,
        boxShadow:  '0px 1px 2px rgba(0,0,0,0.15)',
      }}
    />
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
      onManageTeams,
      onToggleCollapse,
      isCollapsed = false,
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

    const activeTeam = teams.find(t => t.id === activeTeamId) ?? teams[0]

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
        {/* ── Header row — trigger + collapse chevron ── */}
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            borderRadius:   8,
            padding:        '4px 6px',
            backgroundColor: hovered ? 'var(--neutral-900-04, rgba(38,33,30,0.04))' : 'transparent',
            transition:     'background-color 120ms ease',
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {/* Left: dot + team name (this IS the dropdown trigger) */}
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setOpen(o => !o)}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label={`Switch team — currently ${activeTeam?.name ?? 'no team selected'}`}
            style={{
              display:    'flex',
              alignItems: 'center',
              gap:        8,
              background: 'none',
              border:     'none',
              cursor:     'pointer',
              padding:    0,
              minWidth:   0,
              flex:       '1 0 0',
              outline:    'none',
            }}
          >
            {activeTeam && <TeamDot teamId={activeTeam.id} size={16} />}
            <span
              style={{
                fontFamily:   'var(--font-body)',
                fontWeight:   'var(--font-weight-medium)',
                fontSize:     'var(--font-size-caption)',
                lineHeight:   'var(--line-height-caption)',
                color:        'var(--sidebar-menu-item-text, var(--neutral-600))',
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                whiteSpace:   'nowrap',
              }}
            >
              {activeTeam?.name ?? 'Teams'}
            </span>
          </button>

          {/* Right: collapse chevron */}
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Expand team projects' : 'Collapse team projects'}
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              width:          20,
              height:         20,
              background:     'none',
              border:         'none',
              cursor:         'pointer',
              padding:        0,
              flexShrink:     0,
              color:          'var(--neutral-400)',
              outline:        'none',
              // Chevron is hover-only — fades in when the header row is hovered
              opacity:        hovered ? 1 : 0,
              transform:      isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
              transition:     'transform 200ms ease, opacity 120ms ease',
            }}
          >
            <ArrowDownOneIcon size={12} />
          </button>
        </div>

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
                    icon={<TeamDot teamId={team.id} size={18} />}
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
                    <Divider decorative style={{ margin: '4px 0', backgroundColor: 'rgba(59,54,50,0.1)' }} />
                    <DropdownMenuItem
                      fluid
                      label="Manage teams →"
                      onClick={() => { onManageTeams?.(); setOpen(false) }}
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
