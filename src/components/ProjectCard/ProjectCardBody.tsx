// Server component — no 'use client' directive.
// Renders the static visual parts of a ProjectCard: title, tags, description,
// divider, and the bottom stats row. The top row (visibility badge, "Created
// by", ⋮ menu) lives in the client wrapper instead — the ⋮ menu needs hover
// state, and "Created by" / the badge sit in that same top row now, not here.
// When the consumer page is a server component, pass an instance of this as the
// `body` prop to ProjectCard so the static subtree is pre-rendered server-side.

import { type BadgeColor } from '@/components/Badge'
import { UserIcon, BubbleChatAddIcon } from '@strange-huge/icons'
import { ProjectCardTagRow } from './ProjectCardTagRow'
import type { ProjectVisibility } from '@/lib/api/projects'

export interface ProjectCardBodyProps {
  title:        string
  description?: string
  tags?:        Array<{ label: string; color?: BadgeColor }>
  /** Rendered by the parent ProjectCard as a top-left badge, not here. */
  visibility:   ProjectVisibility
  /** Project owner's display name — rendered by the parent ProjectCard in
   *  the top row's left slot ("Created by X"), not here. */
  ownerName?:   string
  /** People with access to this project — the team's roster for a team
   *  project, or 1 (just the owner) for a personal one. */
  memberCount:  number
  /** Pre-formatted relative string, e.g. "Updated 3h ago". */
  updatedAt:    string
  chatCount:    number
}

export function ProjectCardBody({ title, description, tags, memberCount, updatedAt, chatCount }: ProjectCardBodyProps) {
  return (
    <>
      {/* Title — "Created by" moved up to the card's top row, alongside the
          visibility badge, so it no longer lives here as a meta line. */}
      <p
        style={{
          fontFamily:      'var(--font-title)',
          fontWeight:      'var(--font-weight-medium)',
          fontSize:        '18px',
          lineHeight:      '24px',
          color:           'var(--neutral-900)',
          overflow:        'hidden',
          display:         '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          margin:          0,
          marginTop:       '8px',
          flexShrink:      0,
        }}
      >
        {title}
      </p>

      {/* Tags — single-line, horizontally scrollable with drag-to-scroll and
          edge fades, same pattern as PersonaCard's badge row. */}
      {tags && tags.length > 0 && <ProjectCardTagRow tags={tags} />}

      {/* Description — 3 lines max, truncated with an ellipsis. Fixed maxHeight
          (3 × line-height) alongside line-clamp: `flex: 1 1 0` let this grow
          to fit its own content instead of actually clipping to 3 lines —
          line-clamp + flex-grow is an unreliable combo, the explicit height
          cap makes the truncation hold regardless. */}
      <p
        style={{
          maxHeight:       '51px',
          flexShrink:      0,
          fontFamily:      'var(--font-body)',
          fontWeight:      'var(--font-weight-regular)',
          fontSize:        '12px',
          lineHeight:      '17px',
          color:           'var(--neutral-500)',
          overflow:        'hidden',
          textOverflow:    'ellipsis',
          display:         '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          margin:          0,
          marginTop:       '10px',
        }}
      >
        {description ?? ''}
      </p>

      {/* Spacer — grows to push the divider/footer to the bottom of the card
          regardless of how much content sits above it (so every card's
          footer lines up at the same height), while guaranteeing a minimum
          gap above the divider via minHeight. The card's fixed height is
          bumped by the same amount so this is added space, not space taken
          from anything else. */}
      <div style={{ flex: '1 1 auto', minHeight: 12 }} />

      {/* Divider */}
      <div style={{ height: 1, width: '100%', backgroundColor: 'var(--divider-color)', flexShrink: 0 }} />

      {/* Footer — updated time (left), member + chat counts (right) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexShrink: 0, marginTop: '10px' }}>
        <span
          style={{
            fontFamily:   'var(--font-body)',
            fontWeight:   400,
            fontSize:     '12px',
            lineHeight:   '16px',
            color:        'var(--neutral-500)',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}
        >
          {updatedAt}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--neutral-400)', whiteSpace: 'nowrap' }}>
            <UserIcon size={14} />
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: '12px', lineHeight: '16px', color: 'var(--neutral-500)' }}>
              {memberCount} {memberCount === 1 ? 'member' : 'members'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--neutral-400)', whiteSpace: 'nowrap' }}>
            <BubbleChatAddIcon size={14} />
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: '12px', lineHeight: '16px', color: 'var(--neutral-500)' }}>
              {chatCount} {chatCount === 1 ? 'chat' : 'chats'}
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
