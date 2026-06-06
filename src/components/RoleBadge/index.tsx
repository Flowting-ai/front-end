'use client'

import React from 'react'
import { Badge } from '@/components/Badge'
import type { BadgeColor } from '@/components/Badge'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export type WorkspaceRole = 'admin' | 'editor' | 'member'
export type RoleBadgeSize = 'sm' | 'md'

export interface RoleBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  role: WorkspaceRole
  size?: RoleBadgeSize
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<WorkspaceRole, string> = {
  admin:  'Admin',
  editor: 'Editor',
  member: 'Member',
}

function roleBadgeColor(role: WorkspaceRole): BadgeColor {
  if (role === 'editor') return 'Blue'
  return 'Neutral'
}

// ── Component ─────────────────────────────────────────────────────────────────
// Wraps Badge — inherits its shadow ring, inner depth, borderRadius: 6,
// and font scale. No new visual language invented here.

export function RoleBadge({ role, size = 'md', className, style }: RoleBadgeProps) {
  const isEditor = role === 'editor'
  return (
    <span
      style={{
        position:        'relative',
        display:         'inline-flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         size === 'md' ? '3px' : '2px',
        borderRadius:    '6px',
        backgroundColor: isEditor ? 'var(--color-tag-Blue-bg)' : 'var(--neutral-100)',
        boxShadow:       isEditor
          ? 'var(--color-tag-Blue-shadow)'
          : 'var(--color-tag-Neutral-shadow)',
        overflow:        'clip',
        ...style,
      }}
    >
      <span
        style={{
          padding:    '0 2px',
          fontFamily: 'var(--font-body)',
          fontWeight: role === 'admin' ? 600 : 500,
          fontSize:   'var(--font-size-caption)',
          lineHeight: 'var(--line-height-caption)',
          color:      isEditor ? 'var(--color-tag-Blue-text)' : 'var(--neutral-600)',
          whiteSpace: 'nowrap',
          position:   'relative',
        }}
      >
        {ROLE_LABEL[role]}
      </span>
      {/* Inner depth overlay — matches Badge exactly */}
      <span
        aria-hidden
        style={{
          position:      'absolute',
          inset:         0,
          pointerEvents: 'none',
          borderRadius:  'inherit',
          boxShadow:     isEditor
            ? 'var(--color-tag-Blue-inner-shadow)'
            : 'var(--color-tag-Neutral-inner-shadow)',
        }}
      />
    </span>
  )
}

RoleBadge.displayName = 'RoleBadge'
export default RoleBadge
