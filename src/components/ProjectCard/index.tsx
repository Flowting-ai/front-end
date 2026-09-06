'use client'

import React, { useState } from 'react'
import { MoreVerticalIcon } from '@strange-huge/icons'
import { IconButton } from '@/components/IconButton'
import { Dropdown } from '@/components/Dropdown'
import { Badge, type BadgeColor } from '@/components/Badge'
import { ProjectCardBody, type ProjectCardBodyProps } from './ProjectCardBody'
import type { ProjectVisibility } from '@/lib/api/projects'

// ── Types ──────────────────────────────────────────────────────────────────────

export const VISIBILITY_LABEL: Record<ProjectVisibility, string> = {
  personal:  'Personal',
  workspace: 'Workspace',
  shared:    'Shared',
}
export const VISIBILITY_COLOR: Record<ProjectVisibility, BadgeColor> = {
  personal:  'Green',
  workspace: 'Blue',
  shared:    'Yellow',
}

export interface ProjectCardProps extends ProjectCardBodyProps {
  active?:    boolean
  onEdit?:    () => void
  onDelete?:  () => void
  onLeave?:   () => void
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
  { title, description, tags, visibility, ownerName, memberCount, updatedAt, chatCount, active, onEdit, onDelete, onLeave, onClick, body, ref }: ProjectCardProps & { ref?: React.Ref<HTMLDivElement> },
) {
    const [hovered,  setHovered]  = useState(false)
    const [focused,  setFocused]  = useState(false)
    const [menuOpen, setMenuOpen] = useState(false)
    const hasActions = Boolean(onEdit || onDelete || onLeave)

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
          height:          '262px',
          overflow:        'hidden',
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
        {/* Top row — "Created by" (left), visibility badge + ⋮ menu (right, hover-fade) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {ownerName && (
              <span
                style={{
                  fontFamily:   'var(--font-body)',
                  fontWeight:   400,
                  fontSize:     '11px',
                  lineHeight:   '16px',
                  color:        'var(--neutral-500)',
                  overflow:     'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace:   'nowrap',
                }}
              >
                Created by {ownerName}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <Badge color={VISIBILITY_COLOR[visibility]} label={VISIBILITY_LABEL[visibility]} />

            {/* ⋮ menu - always visible (not hover-only) */}
            {/* eslint-disable-next-line click-events-have-key-events, no-static-element-interactions -- interactive div; keyboard handling delegated to inner elements */}
            {hasActions && <div
              style={{ flexShrink: 0 }}
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
                  {onEdit && (
                    <Dropdown.Section fluid>
                      <Dropdown.Item label="Edit" onClick={() => { setMenuOpen(false); onEdit() }} fluid />
                    </Dropdown.Section>
                  )}
                  {onLeave && (
                    <Dropdown.Section fluid>
                      <Dropdown.Item label="Leave project" onClick={() => { setMenuOpen(false); onLeave() }} fluid />
                    </Dropdown.Section>
                  )}
                  {onDelete && (
                    <Dropdown.Section fluid>
                      <Dropdown.Item label="Delete" variant="danger" onClick={() => { setMenuOpen(false); onDelete() }} fluid />
                    </Dropdown.Section>
                  )}
                </Dropdown>
              </Dropdown.Float>
            </div>}
          </div>
        </div>

        {/* Static body — use pre-rendered server component when provided, otherwise render inline */}
        {body ?? (
          <ProjectCardBody
            title={title}
            description={description}
            tags={tags}
            visibility={visibility}
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
