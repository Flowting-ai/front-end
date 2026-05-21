'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import {
  SourceCodeIcon,
  TestTubeIcon,
  BrushIcon,
  CalendarThreeIcon,
  StickyNoteTwoIcon,
  QuillWriteTwoIcon,
  WorkflowSquareTenIcon,
} from '@strange-huge/icons'

// ── Types ─────────────────────────────────────────────────────────────────────

export type PinCategoryType =
  | 'Code'
  | 'Research'
  | 'Creative'
  | 'Planning'
  | 'Tasks'
  | 'Quote'
  | 'Workflow'

export interface PinCategoryProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  type?: PinCategoryType
}

// ── Config ────────────────────────────────────────────────────────────────────
// Each PinCategoryType maps to a color-tag colour (see aliases.css). Tokens
// `--color-tag-{Color}-{bg|text-strong|ring|highlight|depth}` provide the
// visual values; this config only carries the icon and layout intent.

type TagColor = 'Blue' | 'Red' | 'Green' | 'Yellow' | 'Purple' | 'Brown' | 'Neutral'

interface TypeConfig {
  color:    TagColor
  icon:     React.ReactElement
  /** Code uses 32px centered; all others 24px at absolute left:11 top:10 */
  centered: boolean
}

const CONFIG: Record<PinCategoryType, TypeConfig> = {
  Code:     { color: 'Green',   icon: <SourceCodeIcon         size={32} />, centered: true  },
  Research: { color: 'Blue',    icon: <TestTubeIcon           size={24} />, centered: false },
  Creative: { color: 'Purple',  icon: <BrushIcon              size={24} />, centered: false },
  Planning: { color: 'Yellow',  icon: <CalendarThreeIcon      size={24} />, centered: false },
  Tasks:    { color: 'Red',     icon: <StickyNoteTwoIcon      size={24} />, centered: false },
  Quote:    { color: 'Brown',   icon: <QuillWriteTwoIcon      size={24} />, centered: false },
  Workflow: { color: 'Neutral', icon: <WorkflowSquareTenIcon  size={24} />, centered: false },
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PinCategory({ ref, type = 'Code', className, style, ...props }: PinCategoryProps & { ref?: React.Ref<HTMLDivElement> }) {
    const cfg = CONFIG[type]
    const c = cfg.color

    return (
      <div
        ref={ref}
        aria-label={type}
        className={cn(className)}
        style={{
          position:     'relative',
          width:        '45px',
          height:       '45px',
          borderRadius: '8px',
          overflow:     'hidden',
          display:      cfg.centered ? 'flex' : undefined,
          alignItems:   cfg.centered ? 'center' : undefined,
          justifyContent: cfg.centered ? 'center' : undefined,
          boxShadow:    `0px 0px 0px 1px var(--color-tag-${c}-ring)`,
          ...style,
        }}
        {...props}
      >
        {/* Background */}
        <div
          aria-hidden
          style={{
            position:        'absolute',
            inset:           0,
            borderRadius:    '8px',
            backgroundColor: `var(--color-tag-${c}-bg)`,
            pointerEvents:   'none',
          }}
        />

        {/* Icon */}
        <div
          style={{
            position:  cfg.centered ? 'relative' : 'absolute',
            left:      cfg.centered ? undefined : '11px',
            top:       cfg.centered ? undefined : '10px',
            color:     `var(--color-tag-${c}-text-strong)`,
            lineHeight: 0,
            flexShrink: 0,
          }}
        >
          {cfg.icon}
        </div>

        {/* Inset depth shadow */}
        <div
          aria-hidden
          style={{
            position:     'absolute',
            inset:        0,
            borderRadius: 'inherit',
            pointerEvents:'none',
            boxShadow:    `inset 0px 2px 0px 0px var(--color-tag-${c}-highlight), inset 0px -2px 0px 0px var(--color-tag-${c}-depth)`,
          }}
        />
      </div>
    )
}

PinCategory.displayName = 'PinCategory'

export default PinCategory
