'use client'

import React from 'react'

// Shared header/empty-row primitives for the project "who has access" panels
// (ProjectTeamPanel, ProjectAgentsPanel, ProjectMembersPanel) — each rendered
// their own copy of this exact pattern before.

export interface SectionHeaderProps {
  title:      string
  subtitle:   string
  /** Optional trailing control (e.g. an "Add member" button), rendered to the
   *  right of the title/subtitle column. */
  action?:    React.ReactNode
  padding?:   string
}

export function SectionHeader({ title, subtitle, action, padding = '12px 24px 10px' }: SectionHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding }}>
      <div style={{ flex: '1 0 0', minWidth: 0 }}>
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
          {title}
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, lineHeight: '16px', color: 'var(--neutral-500)', margin: 0 }}>
          {subtitle}
        </p>
      </div>
      {action}
    </div>
  )
}

export interface EmptyRowProps {
  text:    string
  padding?: string
}

export function EmptyRow({ text, padding = '2px 24px 16px' }: EmptyRowProps) {
  return (
    <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-400)', margin: 0, padding }}>
      {text}
    </p>
  )
}
