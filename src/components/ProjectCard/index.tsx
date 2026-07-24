'use client'

import React, { useState } from 'react'
import { MoreVerticalIcon } from '@strange-huge/icons'
import { IconButton } from '@/components/IconButton'
import { Dropdown } from '@/components/Dropdown'
import { TeamChip } from '@/components/TeamChip'
import { ProjectCardBody, type ProjectCardBodyProps } from './ProjectCardBody'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ProjectCardProps extends ProjectCardBodyProps {
  title:      string
  active?:    boolean
  onEdit?:    () => void
  onArchive?: () => void
  onDelete?:  () => void
  onClick?:   () => void
  /**
   * Pre-rendered server component for the static body (tags, description, footer).
   * When the consumer is a server component, pass `<ProjectCardBody {...bodyProps} />`
   * here to pre-render the static subtree server-side. Omit to have the client
   * render the body directly (default behaviour — identical output).
   */
  body?: React.ReactNode
}

// ── Component ──────────────────────────────────────────────────────────────────

function ProjectCardInner(
  { title, description, tags, teamName, updatedAt, chatCount, active, onEdit, onArchive, onDelete, onClick, body, ref }: ProjectCardProps & { ref?: React.Ref<HTMLDivElement> },
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
          height:          '160px',
          padding:         '12px',
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
        {/* Title row (client-rendered: contains the interactive ⋮ menu) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <p
            style={{
              flex:         '1 0 0',
              minWidth:     0,
              fontFamily:   'var(--font-body)',
              fontWeight:   'var(--font-weight-medium)',
              fontSize:     '15px',
              lineHeight:   '22px',
              color:        '#1a1714',
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
              margin:       0,
            }}
          >
            {title}
          </p>

          {/* Team attribution — top-right, always visible for team-owned projects */}
          {teamName && (
            <div style={{ flexShrink: 0, marginLeft: '8px' }}>
              <TeamChip teamName={teamName} size="md" />
            </div>
          )}

          {/* ⋮ menu - fades in on hover/focus */}
          {/* eslint-disable-next-line click-events-have-key-events, no-static-element-interactions -- interactive div; keyboard handling delegated to inner elements */}
          {hasActions && <div
            style={{
              opacity:    showMenu ? 1 : 0,
              transition: 'opacity 120ms ease',
              flexShrink: 0,
              marginLeft: '4px',
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
            description={description}
            tags={tags}
            teamName={teamName}
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
