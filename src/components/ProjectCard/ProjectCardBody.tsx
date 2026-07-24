// Server component — no 'use client' directive.
// Renders the static visual parts of a ProjectCard: meta line, title, tags,
// description, divider, and the bottom stats row. The scope avatar + ⋮ menu
// live in the client wrapper instead — the ⋮ menu needs hover state, and sits
// in the same top row as the avatar.
// When the consumer page is a server component, pass an instance of this as the
// `body` prop to ProjectCard so the static subtree is pre-rendered server-side.

import { Badge, type BadgeColor } from '@/components/Badge'
import { UserIcon, BubbleChatAddIcon } from '@strange-huge/icons'

export interface ProjectCardBodyProps {
  title:        string
  description?: string
  tags?:        Array<{ label: string; color?: BadgeColor }>
  /** Team this project belongs to — omitted/undefined for personal projects.
   *  Rendered by the parent ProjectCard in the top-left avatar, not here. */
  teamName?:    string
  /** Project owner's display name, for the "Created by" meta line. */
  ownerName?:   string
  /** People with access to this project — the team's roster for a team
   *  project, or 1 (just the owner) for a personal one. */
  memberCount:  number
  /** Pre-formatted relative string, e.g. "Updated 3h ago". */
  updatedAt:    string
  chatCount:    number
}

export function ProjectCardBody({ title, description, tags, ownerName, memberCount, updatedAt, chatCount }: ProjectCardBodyProps) {
  return (
    <>
      {/* Meta line — created-by only (relative update time moved to the footer) */}
      {ownerName && (
        <p
          style={{
            fontFamily:   'var(--font-body)',
            fontWeight:   400,
            fontSize:     '11px',
            lineHeight:   '16px',
            color:        'var(--neutral-500)',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
            margin:       0,
            marginTop:    '10px',
            flexShrink:   0,
          }}
        >
          Created by {ownerName}
        </p>
      )}

      {/* Title */}
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

      {/* Tags — capped at 2 rows: Badge is 20px tall (16px line-height-caption
          + 2px×2 padding), so 2 rows + the 4px row gap + this container's own
          2px×2 padding = 48px. Anything beyond 2 rows is clipped. */}
      {tags && tags.length > 0 && (
        <div
          style={{
            display:    'flex',
            gap:        '4px',
            flexWrap:   'wrap',
            overflow:   'hidden',
            maxHeight:  '48px',
            flexShrink: 0,
            marginTop:  '10px',
            padding:    '2px 1px',
          }}
        >
          {tags.map((tag) => (
            <Badge key={tag.label} label={tag.label} color={tag.color ?? 'Blue'} />
          ))}
        </div>
      )}

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

      {/* Divider — marginTop: auto pins this (and the footer below it) to the
          bottom of the card regardless of how much content sits above it, so
          every card's footer lines up at the same height. Requires the card
          itself to have a fixed height, not just a minHeight. */}
      <div style={{ height: 1, width: '100%', backgroundColor: 'var(--divider-color)', marginTop: 'auto', flexShrink: 0 }} />

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
