'use client'

import React from 'react'
import { Badge } from '@/components/Badge'
import { VISIBILITY_COLOR, VISIBILITY_LABEL } from '@/components/ProjectCard'
import type { Project } from '@/context/projects-context'

/**
 * Project name and its type chip, then the description (up to 3 lines). Sharing sits beside the
 * back button at the top; owner and settings live in the Project settings panel.
 */
export function ProjectHeader({ project }: { project: Project }) {
  return (
    <div style={{ width: '100%', maxWidth: '679px', marginBottom: '24px', flexShrink: 0 }}>
      {/* Title row: the name truncates (full text on hover) so the type chip never gets squeezed. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h1 title={project.name} style={{ flex: '1 1 0', minWidth: 0, fontFamily: 'var(--font-title)', fontWeight: 'var(--font-weight-regular)', fontSize: '24px', lineHeight: '32px', color: 'var(--neutral-800)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {project.name}
        </h1>
        <Badge size="md" color={VISIBILITY_COLOR[project.visibility]} label={VISIBILITY_LABEL[project.visibility]} style={{ flexShrink: 0 }} />
      </div>

      {project.description && (
        // At most 3 lines (wraps and line breaks alike), then an ellipsis; the full text is on hover and in Project settings.
        <p
          title={project.description}
          style={{
            fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-regular)', fontSize: '14px', lineHeight: '22px', color: 'var(--neutral-800)',
            margin: 0, marginTop: 4, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
            display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 3, overflow: 'hidden',
          }}
        >
          {project.description}
        </p>
      )}
    </div>
  )
}
