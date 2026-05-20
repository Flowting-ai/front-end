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

const _ProjectCard = React.forwardRef<HTMLDivElement, ProjectCardProps>(
  function ProjectCard(
    { title, description, tags, updatedAt, chatCount, active, onEdit, onArchive, onDelete, onClick },
    ref,
  ) {
    const [hovered,  setHovered]  = useState(false)
    const [focused,  setFocused]  = useState(false)
    const [menuOpen, setMenuOpen] = useState(false)

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
        {/* Title row */}
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

          {/* ⋮ menu - fades in on hover/focus */}
          <div
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
                  <Dropdown.Item label="Edit"    onClick={onEdit}    fluid />
                  <Dropdown.Item label="Archive" onClick={onArchive} disabled fluid />
                </Dropdown.Section>
                <Dropdown.Section divider fluid>
                  <Dropdown.Item label="Delete"  variant="danger" onClick={onDelete} fluid />
                </Dropdown.Section>
              </Dropdown>
            </Dropdown.Float>
          </div>
        </div>

        {/* Tags - single non-wrapping row; padding prevents shadow clip */}
        {tags && tags.length > 0 && (
          <div
            style={{
              display:    'flex',
              gap:        '4px',
              flexWrap:   'nowrap',
              overflow:   'hidden',
              flexShrink: 0,
              marginTop:  '3px',
              padding:    '2px 1px',
            }}
          >
            {tags.map((tag, i) => (
              <Badge key={i} label={tag.label} color={tag.color ?? 'Blue'} />
            ))}
          </div>
        )}

        {/* Description - fills remaining space, 4-line clamp */}
        <p
          style={{
            flex:            '1 1 0',
            minHeight:       0,
            fontFamily:      'var(--font-body)',
            fontWeight:      'var(--font-weight-regular)',
            fontSize:        '11px',
            lineHeight:      '16px',
            color:           '#857a72',
            overflow:        'hidden',
            display:         '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            margin:          0,
            marginTop:       '6px',
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
            flexShrink:     0,
            marginTop:      '6px',
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

export const ProjectCard = React.memo(_ProjectCard)
ProjectCard.displayName = 'ProjectCard'
export default ProjectCard
