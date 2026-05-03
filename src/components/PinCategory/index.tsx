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

interface TypeConfig {
  bg:       string
  ring:     string
  insetTop: string
  insetBot: string
  color:    string
  icon:     React.ReactElement
  centered: boolean
}

const CONFIG: Record<PinCategoryType, TypeConfig> = {
  Code: {
    bg:       '#e5f2c5',
    ring:     'rgba(128,183,7,0.5)',
    insetTop: 'rgba(247,254,230,0.7)',
    insetBot: 'rgba(128,183,7,0.1)',
    color:    '#80b707',
    icon:     <SourceCodeIcon size={32} />,
    centered: true,
  },
  Research: {
    bg:       '#cadcf1',
    ring:     'rgba(13,110,178,0.5)',
    insetTop: 'rgba(231,244,253,0.7)',
    insetBot: 'rgba(13,110,178,0.1)',
    color:    '#0d6eb2',
    icon:     <TestTubeIcon size={24} />,
    centered: false,
  },
  Creative: {
    bg:       '#ded0df',
    ring:     'rgba(103,79,104,0.5)',
    insetTop: 'rgba(248,236,249,0.7)',
    insetBot: 'rgba(103,79,104,0.1)',
    color:    '#674f68',
    icon:     <BrushIcon size={24} />,
    centered: false,
  },
  Planning: {
    bg:       '#e9dfc9',
    ring:     'rgba(143,116,39,0.5)',
    insetTop: 'rgba(250,246,235,0.7)',
    insetBot: 'rgba(143,116,39,0.1)',
    color:    '#8f7427',
    icon:     <CalendarThreeIcon size={24} />,
    centered: false,
  },
  Tasks: {
    bg:       '#ffbfb6',
    ring:     'rgba(159,38,35,0.5)',
    insetTop: 'rgba(253,231,231,0.7)',
    insetBot: 'rgba(159,38,35,0.1)',
    color:    '#9f2623',
    icon:     <StickyNoteTwoIcon size={24} />,
    centered: false,
  },
  Quote: {
    bg:       '#e6d5ca',
    ring:     'rgba(126,84,53,0.5)',
    insetTop: 'rgba(250,241,235,0.7)',
    insetBot: 'rgba(126,84,53,0.1)',
    color:    '#7e5435',
    icon:     <QuillWriteTwoIcon size={24} />,
    centered: false,
  },
  Workflow: {
    bg:       '#ede1d7',
    ring:     'rgba(106,98,93,0.5)',
    insetTop: 'rgba(247,242,237,0.7)',
    insetBot: 'rgba(106,98,93,0.1)',
    color:    '#6a625d',
    icon:     <WorkflowSquareTenIcon size={24} />,
    centered: false,
  },
}

// ── Component ─────────────────────────────────────────────────────────────────

export const PinCategory = React.forwardRef<HTMLDivElement, PinCategoryProps>(
  function PinCategory({ type = 'Code', className, style, ...props }, ref) {
    const cfg = CONFIG[type]

    return (
      <div
        ref={ref}
        aria-label={type}
        className={cn(className)}
        style={{
          position:       'relative',
          width:          '45px',
          height:         '45px',
          borderRadius:   '8px',
          overflow:       'hidden',
          display:        cfg.centered ? 'flex' : undefined,
          alignItems:     cfg.centered ? 'center' : undefined,
          justifyContent: cfg.centered ? 'center' : undefined,
          boxShadow:      `0px 0px 0px 1px ${cfg.ring}`,
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
            backgroundColor: cfg.bg,
            pointerEvents:   'none',
          }}
        />

        {/* Icon */}
        <div
          style={{
            position:   cfg.centered ? 'relative' : 'absolute',
            left:       cfg.centered ? undefined : '11px',
            top:        cfg.centered ? undefined : '10px',
            color:      cfg.color,
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
            position:      'absolute',
            inset:         0,
            borderRadius:  'inherit',
            pointerEvents: 'none',
            boxShadow:     `inset 0px 2px 0px 0px ${cfg.insetTop}, inset 0px -2px 0px 0px ${cfg.insetBot}`,
          }}
        />
      </div>
    )
  },
)

PinCategory.displayName = 'PinCategory'
export default PinCategory
