'use client'

import React, { useState } from 'react'
import { MoreVerticalIcon } from '@strange-huge/icons'
import { Badge, type BadgeColor } from '@/components/Badge'
import { IconButton } from '@/components/IconButton'
import { Dropdown } from '@/components/Dropdown'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ProjectCardProps {
  title:       string
  description?: string
  tags?:       Array<{ label: string; color?: BadgeColor }>
  updatedAt:   string
  chatCount:   number
  active?:     boolean
  onEdit?:     () => void
  onArchive?:  () => void
  onDelete?:   () => void
  onClick?:    () => void
}

// ── Component ──────────────────────────────────────────────────────────────────

export const ProjectCard = React.forwardRef<HTMLDivElement, ProjectCardProps>(
  function ProjectCard(
    { title, description, tags, updatedAt, chatCount, active, onEdit, onArchive, onDelete, onClick },
    ref,
  ) {
    const [hovered,  setHovered]  = useState(false)
    const [menuOpen, setMenuOpen] = useState(false)

    const showMenu = hovered || menuOpen || active

    return (
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.() }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display:         'flex',
          flexDirection:   'column',
          gap:             '8px',
          padding:         '12px',
          borderRadius:    '12px',
          backgroundColor: hovered || menuOpen ? 'var(--neutral-50)' : 'var(--neutral-white)',
          boxShadow:       active
            ? '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 2px var(--blue-500)'
            : '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
          cursor:          'pointer',
          transition:      'background-color 120ms ease, box-shadow 120ms ease',
          outline:         'none',
          width:           '100%',
          boxSizing:       'border-box',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', width: '100%' }}>
          <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {/* Title row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' }}>
              <p
                style={{
                  flex:         '1 0 0',
                  minWidth:     0,
                  fontFamily:   'var(--font-body)',
                  fontWeight:   'var(--font-weight-regular)',
                  fontSize:     '16px',
                  lineHeight:   'var(--line-height-body)',
                  color:        '#1a1714',
                  overflow:     'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace:   'nowrap',
                  margin:       0,
                }}
              >
                {title}
              </p>

              {/* ⋮ menu */}
              <div
                style={{
                  opacity:    showMenu ? 1 : 0,
                  transition: 'opacity 120ms ease',
                  flexShrink: 0,
                  marginLeft: '8px',
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
                      icon={<MoreVerticalIcon />}
                      aria-label="Project options"
                    />
                  }
                >
                  <Dropdown size="sm">
                    <Dropdown.Section>
                      <Dropdown.Item label="Edit" onClick={onEdit} fluid />
                      <Dropdown.Item label="Archive" onClick={onArchive} fluid />
                      <Dropdown.Item label="Delete" variant="danger" onClick={onDelete} fluid />
                    </Dropdown.Section>
                  </Dropdown>
                </Dropdown.Float>
              </div>
            </div>

            {/* Tags */}
            {tags && tags.length > 0 && (
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                {tags.map((tag, i) => (
                  <Badge key={i} label={tag.label} color={tag.color ?? 'Blue'} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <p
          style={{
            fontFamily:   'var(--font-body)',
            fontWeight:   'var(--font-weight-regular)',
            fontSize:     '11px',
            lineHeight:   '16px',
            color:        '#857a72',
            overflow:     'hidden',
            display:      '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            height:       '48px',
            margin:       0,
            width:        '100%',
          }}
        >
          {description ?? ''}
        </p>

        {/* Footer */}
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            width:          '100%',
            fontFamily:     'var(--font-body)',
            fontWeight:     'var(--font-weight-regular)',
            fontSize:       '11px',
            lineHeight:     '16px',
          }}
        >
          <span style={{ color: '#857a72', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {updatedAt}
          </span>
          <span style={{ color: '#6a625d', flexShrink: 0, marginLeft: '8px' }}>
            {chatCount} {chatCount === 1 ? 'chat' : 'chats'}
          </span>
        </div>
      </div>
    )
  },
)

ProjectCard.displayName = 'ProjectCard'
export default ProjectCard
