'use client'

import React, { useState } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { CancelOneIcon } from '@strange-huge/icons'
import { Dropdown, DropdownFloat } from '@/components/Dropdown'
import { DropdownMenuItem } from '@/components/DropdownMenuItem'
import { cn } from '@/lib/utils'

// ── Shadow ────────────────────────────────────────────────────────────────────

const SHADOW_TRIGGER = '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-200)'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SlackProject {
  id:   string
  name: string
}

export interface SlackChannelMappingRowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The Slack channel name, e.g. "#marketing" */
  channelName:     string
  /** Currently mapped project id */
  projectId?:      string
  /** Available project options */
  projects:        SlackProject[]
  /** Fires when user selects a project */
  onProjectSelect?: (projectId: string | null) => void
  /** Fires when × is clicked */
  onRemove?:        () => void
  asChild?: boolean
}

// ── Project dropdown trigger ──────────────────────────────────────────────────

function ProjectTrigger({
  label,
  open,
}: {
  label: string
  open:  boolean
}) {
  return (
    <div style={{
      display:         'flex',
      alignItems:      'center',
      gap:             6,
      padding:         '5px 10px',
      borderRadius:    8,
      backgroundColor: open ? 'var(--neutral-100)' : 'var(--neutral-white)',
      boxShadow:       SHADOW_TRIGGER,
      cursor:          'pointer',
      transition:      'background-color 120ms',
      minWidth:        160,
    }}>
      <span style={{
        flex:       '1 0 0',
        minWidth:   0,
        fontFamily: 'var(--font-body)',
        fontWeight: 400,
        fontSize:   'var(--font-size-body)',
        color:      label === 'Select a project…' ? 'var(--neutral-300)' : 'var(--neutral-700)',
        overflow:   'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
        <path d="M3 5l3 3 3-3" stroke="var(--neutral-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export const SlackChannelMappingRow = React.forwardRef<HTMLDivElement, SlackChannelMappingRowProps>(
  function SlackChannelMappingRow(
    {
      channelName,
      projectId,
      projects,
      onProjectSelect,
      onRemove,
      asChild = false,
      className,
      style,
      ...props
    },
    ref,
  ) {
    const Comp   = (asChild ? Slot : 'div') as React.ElementType
    const [open, setOpen] = useState(false)

    const selected = projects.find(p => p.id === projectId)
    const triggerLabel = selected?.name ?? 'Select a project…'

    return (
      <Comp
        ref={ref}
        className={cn(className)}
        style={{
          display:        'flex',
          alignItems:     'center',
          gap:            12,
          padding:        '8px 0',
          borderBottom:   '1px solid var(--neutral-100)',
          ...style,
        }}
        {...props}
      >
        {/* Channel name */}
        <span style={{
          flex:       '1 0 0',
          minWidth:   0,
          fontFamily: 'var(--font-body)',
          fontWeight: 500,
          fontSize:   'var(--font-size-body)',
          color:      'var(--neutral-700)',
          overflow:   'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {channelName.startsWith('#') ? channelName : `#${channelName}`}
        </span>

        {/* Project picker */}
        <DropdownFloat
          open={open}
          onOpenChange={setOpen}
          placement="bottom-end"
          offset={6}
          trigger={<ProjectTrigger label={triggerLabel} open={open} />}
        >
          <Dropdown style={{ width: 200 }}>
            {projects.map(p => (
              <DropdownMenuItem
                key={p.id}
                fluid
                label={p.name}
                selected={p.id === projectId}
                onClick={() => { onProjectSelect?.(p.id); setOpen(false) }}
              />
            ))}
            {projectId && (
              <>
                <div style={{ height: 1, backgroundColor: 'var(--neutral-100)', margin: '4px 0' }} />
                <DropdownMenuItem
                  fluid
                  label="Remove mapping"
                  onClick={() => { onProjectSelect?.(null); setOpen(false) }}
                />
              </>
            )}
          </Dropdown>
        </DropdownFloat>

        {/* Remove row */}
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${channelName} mapping`}
          style={{
            display:    'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width:      28,
            height:     28,
            borderRadius: 7,
            border:     'none',
            background: 'none',
            cursor:     'pointer',
            color:      'var(--neutral-400)',
            flexShrink: 0,
            outline:    'none',
            transition: 'color 120ms, background-color 120ms',
          }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLElement).style.color = 'var(--neutral-700)'
            ;(e.currentTarget as HTMLElement).style.backgroundColor = 'var(--neutral-100)'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLElement).style.color = 'var(--neutral-400)'
            ;(e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
          }}
        >
          <CancelOneIcon size={16} color="currentColor" />
        </button>
      </Comp>
    )
  },
)

SlackChannelMappingRow.displayName = 'SlackChannelMappingRow'
export default SlackChannelMappingRow
