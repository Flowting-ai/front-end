'use client'

import React, { useState } from 'react'
import { MoreVerticalIcon, FolderOneIcon } from '@strange-huge/icons'
import { IconButton } from '@/components/IconButton'
import { Dropdown } from '@/components/Dropdown'
import { ProjectCardBody, type ProjectCardBodyProps } from './ProjectCardBody'

// ── Gradient palette — seeded by team name, matching TeamChip/TeamSwitcherRow/
// TeamSwitcherDropdown exactly, so a project's avatar is the same colour as its
// team everywhere else in the app. Only used for team projects — personal
// projects show a plain folder icon instead (see the top row below).

const TEAM_GRADIENTS = [
  'linear-gradient(135deg, #4FACDE 0%, #2D8BBF 100%)',  // teal-blue
  'linear-gradient(135deg, #9B6FE0 0%, #7B4FC0 100%)',  // purple
  'linear-gradient(135deg, #F59542 0%, #D4742A 100%)',  // orange
  'linear-gradient(135deg, #4CAF78 0%, #2D8F58 100%)',  // green
  'linear-gradient(135deg, #E06060 0%, #B83C3C 100%)',  // red-brown
  'linear-gradient(135deg, #60A8E0 0%, #3C80C0 100%)',  // blue
]

function getGradient(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h) + seed.charCodeAt(i)
    h |= 0
  }
  return TEAM_GRADIENTS[Math.abs(h) % TEAM_GRADIENTS.length]!
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ProjectCardProps extends ProjectCardBodyProps {
  active?:    boolean
  onEdit?:    () => void
  onArchive?: () => void
  onDelete?:  () => void
  onClick?:   () => void
  /**
   * Pre-rendered server component for the static body (meta line, title, tags,
   * description, footer). When the consumer is a server component, pass
   * `<ProjectCardBody {...bodyProps} />` here to pre-render the static subtree
   * server-side. Omit to have the client render the body directly (default
   * behaviour — identical output). The top row (scope avatar, ⋮ menu) always
   * renders here in the client wrapper, since the ⋮ menu needs hover state.
   */
  body?: React.ReactNode
}

// ── Component ─────────────────────────────────────────────────────────────────

function ProjectCardInner(
  { title, description, tags, teamName, ownerName, memberCount, updatedAt, chatCount, active, onEdit, onArchive, onDelete, onClick, body, ref }: ProjectCardProps & { ref?: React.Ref<HTMLDivElement> },
) {
    const [hovered,  setHovered]  = useState(false)
    const [focused,  setFocused]  = useState(false)
    const [menuOpen, setMenuOpen] = useState(false)
    const hasActions = Boolean(onEdit || onArchive || onDelete)

    const showMenu = hovered || focused || menuOpen || !!active

    const backgroundColor = (() => {
      if (focused || active) return 'rgba(74,131,191,0.07)'
      if (hovered || menuOpen) return 'var(--neutral-50)'
      return 'var(--neutral-white)'
    })()

    const boxShadow = (() => {
      if (active) return '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 2px var(--blue-500)'
      if (focused) return '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 2px var(--blue-300)'
      return '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)'
    })()

    const scopeLabel = teamName ?? 'Personal'
    const initial     = scopeLabel.charAt(0).toUpperCase()

    return (
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.() }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false) }}
        style={{
          position:        'relative',
          zIndex:          menuOpen ? 1 : 'auto',
          display:         'flex',
          flexDirection:   'column',
          height:          '300px',
          padding:         '20px',
          boxSizing:       'border-box',
          borderRadius:    '12px',
          backgroundColor,
          boxShadow,
          cursor:          'pointer',
          transition:      'background-color 120ms ease, box-shadow 120ms ease',
          outline:         'none',
          width:           '100%',
        }}
      >
        {/* Top row — scope avatar + label (left), ⋮ menu (right, hover-fade) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span
              aria-hidden
              style={{
                display:         'inline-flex',
                alignItems:      'center',
                justifyContent:  'center',
                width:           'calc(var(--line-height-body) + var(--line-height-caption))',
                height:          'calc(var(--line-height-body) + var(--line-height-caption))',
                borderRadius:    teamName ? '3px' : undefined,
                background:      teamName ? getGradient(scopeLabel) : undefined,
                flexShrink:      0,
                fontFamily:      'var(--font-title)',
                fontWeight:      500,
                fontSize:        '16px',
                color:           teamName ? 'var(--neutral-white)' : 'var(--neutral-600)',
                lineHeight:      1,
                boxShadow:       teamName ? 'inset 0px 4px 4px rgba(0,0,0,0.25), inset 0px -1px 0.4px rgba(18,60,95,0.65)' : undefined,
                userSelect:      'none',
              }}
            >
              {teamName ? initial : <FolderOneIcon variant="closed" triggered={hovered} size={38} />}
            </span>
            <span
              style={{
                fontFamily:   'var(--font-body)',
                fontWeight:   'var(--font-weight-medium)',
                fontSize:     '13px',
                lineHeight:   '18px',
                color:        'var(--neutral-700)',
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                whiteSpace:   'nowrap',
              }}
            >
              {scopeLabel}
            </span>
          </div>

          {/* ⋮ menu - fades in on hover/focus */}
          {/* eslint-disable-next-line click-events-have-key-events, no-static-element-interactions -- interactive div; keyboard handling delegated to inner elements */}
          {hasActions && <div
            style={{
              opacity:    showMenu ? 1 : 0,
              transition: 'opacity 120ms ease',
              flexShrink: 0,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Dropdown.Float
              open={menuOpen}
              onOpenChange={setMenuOpen}
              placement="bottom-end"
              trigger={
                <IconButton
                  variant="ghost"
                  size="xs"
                  icon={<MoreVerticalIcon size={16} triggered={showMenu} />}
                  aria-label="Project options"
                />
              }
            >
              <Dropdown size="md">
                <Dropdown.Section fluid>
                  <Dropdown.Item label="Edit"    onClick={() => { setMenuOpen(false); onEdit?.() }}    fluid />
                  <Dropdown.Item label="Archive" onClick={() => { setMenuOpen(false); onArchive?.() }} disabled fluid />
                </Dropdown.Section>
                <Dropdown.Section divider fluid>
                  <Dropdown.Item label="Delete"  variant="danger" onClick={() => { setMenuOpen(false); onDelete?.() }} fluid />
                </Dropdown.Section>
              </Dropdown>
            </Dropdown.Float>
          </div>}
        </div>

        {/* Static body — use pre-rendered server component when provided, otherwise render inline */}
        {body ?? (
          <ProjectCardBody
            title={title}
            description={description}
            tags={tags}
            teamName={teamName}
            ownerName={ownerName}
            memberCount={memberCount}
            updatedAt={updatedAt}
            chatCount={chatCount}
          />
        )}
      </div>
    )
}

export const ProjectCard = React.memo(ProjectCardInner)
ProjectCard.displayName = 'ProjectCard'
export default ProjectCard
