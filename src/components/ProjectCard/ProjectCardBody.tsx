// Server component — no 'use client' directive.
// Renders the static visual parts of a ProjectCard: tags, description, footer.
// When the consumer page is a server component, pass an instance of this as the
// `body` prop to ProjectCard so the static subtree is pre-rendered server-side.

import { Badge, type BadgeColor } from '@/components/Badge'

export interface ProjectCardBodyProps {
  description?: string
  tags?:        Array<{ label: string; color?: BadgeColor }>
  updatedAt:    string
  chatCount:    number
}

export function ProjectCardBody({ description, tags, updatedAt, chatCount }: ProjectCardBodyProps) {
  return (
    <>
      {/* Tags */}
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
          {tags.map((tag) => (
            <Badge key={tag.label} label={tag.label} color={tag.color ?? 'Blue'} />
          ))}
        </div>
      )}

      {/* Description */}
      <p
        style={{
          flex:            '1 1 0',
          minHeight:       0,
          fontFamily:      'var(--font-body)',
          fontWeight:      'var(--font-weight-regular)',
          fontSize: '12px',
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
          fontSize: '12px',
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
    </>
  )
}
