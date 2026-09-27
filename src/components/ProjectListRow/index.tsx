'use client'

import React, { useState } from 'react'
import { UserIcon, BubbleChatAddIcon, MoreVerticalIcon, PenOneIcon, UnlinkOneIcon, DeleteTwoIcon } from '@strange-huge/icons'
import { Badge } from '@/components/Badge'
import { IconButton } from '@/components/IconButton'
import { Dropdown } from '@/components/Dropdown'
import { Divider } from '@/components/Divider'
import { VISIBILITY_LABEL, VISIBILITY_COLOR } from '@/components/ProjectCard'
import { RESET_BUTTON_STYLE } from '@/lib/reset-button-style'
import type { Project } from '@/context/projects-context'

// ── Compact list-view row ────────────────────────────────────────────────────

export function ProjectListRow({
  project, ownerName, memberCount, updatedAt, onClick, onEdit, onDelete, onLeave,
}: {
  project:      Project
  ownerName?:   string
  memberCount:  number
  updatedAt:    string
  onClick:      () => void
  onEdit?:      () => void
  onDelete?:    () => void
  onLeave?:     () => void
}) {
  const [hovered,  setHovered]  = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const hasActions = Boolean(onEdit || onDelete || onLeave)
  const showMenu   = hovered || menuOpen

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:         'flex',
        alignItems:      'center',
        gap:             12,
        padding:         '10px 16px',
        borderRadius:    12,
        backgroundColor: hovered || menuOpen ? 'var(--neutral-50)' : 'var(--neutral-white)',
        boxShadow:       '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
        transition:      'background-color 120ms ease',
        width:           '100%',
        boxSizing:       'border-box',
      }}
    >
      {/* The whole row used to be one role="button" div wrapping the ⋮ menu's
          own real button as a nested interactive descendant — assistive tech
          can't reliably operate a button inside another interactive
          element. Badge/title/stats are now a single real <button> (the
          "navigate" target); the menu slot is a plain sibling, so nothing is
          nested inside anything else interactive any more. */}
      <button
        type="button"
        onClick={onClick}
        style={{
          ...RESET_BUTTON_STYLE,
          display:    'flex',
          alignItems: 'center',
          gap:        12,
          flex:       '1 1 0',
          minWidth:   0,
          cursor:     'pointer',
        }}
      >
        {/* Visibility badge — fixed width so Personal/Workspace/Shared rows all
            line up instead of each badge hugging its own label's width. */}
        <Badge
          color={VISIBILITY_COLOR[project.visibility]}
          label={VISIBILITY_LABEL[project.visibility]}
          style={{ width: 84, flexShrink: 0 }}
        />

        {/* Title + meta */}
        <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span
            style={{
              fontFamily:   'var(--font-body)',
              fontWeight:   'var(--font-weight-medium)',
              fontSize:     14,
              lineHeight:   '20px',
              color:        'var(--neutral-900)',
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}
          >
            {project.name}
          </span>
          <span
            style={{
              fontFamily:   'var(--font-body)',
              fontWeight:   400,
              fontSize:     11,
              lineHeight:   '16px',
              color:        'var(--neutral-500)',
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}
          >
            {ownerName ? `Created by ${ownerName} · ` : ''}{updatedAt}
          </span>
        </div>

        {/* Stats — each count gets a fixed-width slot (not just min-width) so a
            1-, 2-, or 3-digit number never nudges either icon's position;
            tabular-nums keeps the digits themselves a constant width too. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, color: 'var(--neutral-400)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <UserIcon size={18} />
            <span style={{ width: 22, fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '20px', color: 'var(--neutral-500)', fontVariantNumeric: 'tabular-nums' }}>{memberCount}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <BubbleChatAddIcon size={18} />
            <span style={{ width: 22, fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '20px', color: 'var(--neutral-500)', fontVariantNumeric: 'tabular-nums' }}>{project.chatCount}</span>
          </div>
        </div>
      </button>

      {/* ⋮ menu slot - fixed 24×24 footprint always reserved (even when this
          row has no actions) so Stats' icons land at the same horizontal
          position on every row, regardless of hasActions. */}
      <div style={{ width: 24, height: 24, flexShrink: 0 }}>
        {hasActions && (
          <div style={{ opacity: showMenu ? 1 : 0, transition: 'opacity 120ms ease' }}>
            <Dropdown.Float
              open={menuOpen}
              onOpenChange={setMenuOpen}
              placement="bottom-end"
              // Rows can sit anywhere in this scrollable list — a row near
              // the bottom of the viewport would otherwise run the menu
              // off-screen with a fixed placement.
              autoFlipVertical
              trigger={
                <IconButton
                  variant="ghost"
                  size="xs"
                  icon={<MoreVerticalIcon size={16} triggered={showMenu} />}
                  aria-label="Project options"
                />
              }
            >
              <Dropdown size="md" maxHeight={false}>
                <Dropdown.Section fluid>
                  {onEdit && (
                    <Dropdown.Item icon={<PenOneIcon color="var(--neutral-600)" />} label="Edit" onClick={() => { setMenuOpen(false); onEdit() }} fluid />
                  )}
                  {onLeave && (
                    <Dropdown.Item icon={<UnlinkOneIcon color="var(--neutral-600)" />} label="Leave project" onClick={() => { setMenuOpen(false); onLeave() }} fluid />
                  )}
                  {onDelete && (
                    <>
                      {(onEdit || onLeave) && <Divider decorative />}
                      <Dropdown.Item icon={<DeleteTwoIcon color="var(--red-500)" />} label="Delete" variant="danger" onClick={() => { setMenuOpen(false); onDelete() }} fluid />
                    </>
                  )}
                </Dropdown.Section>
              </Dropdown>
            </Dropdown.Float>
          </div>
        )}
      </div>
    </div>
  )
}

export default ProjectListRow
