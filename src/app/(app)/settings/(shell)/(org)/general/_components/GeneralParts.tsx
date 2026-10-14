'use client'

import React, { useState } from 'react'
import { ArrowDownOneIcon, TickTwoIcon } from '@strange-huge/icons'
import { Dropdown, DropdownFloat } from '@/components/Dropdown'
import { DropdownMenuItem } from '@/components/DropdownMenuItem'

// One-click starters for the AI instructions box; each adds a line.
export const INSTRUCTION_STARTERS = [
  'Always cite sources',
  'Keep answers under 200 words',
  'Use bullet points for lists',
]

// Hidden for now: flip to true to show the Danger Zone card again.
export const SHOW_DANGER_ZONE = false

// ── Text input ────────────────────────────────────────────────────────────────

export function TextInput({
  value,
  onChange,
  placeholder,
  readOnly,
  style,
}: {
  value:        string
  onChange?:    (v: string) => void
  placeholder?: string
  readOnly?:    boolean
  style?:       React.CSSProperties
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      readOnly={readOnly}
      style={{
        height:          36,
        backgroundColor: readOnly ? 'var(--neutral-50)' : 'var(--field-surface)',
        borderRadius:    10,
        boxShadow:       '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
        border:          'none',
        padding:         '7px 10px',
        fontFamily:      'var(--font-body)',
        fontWeight:      400,
        fontSize:        14,
        lineHeight:      '22px',
        color:           readOnly ? 'var(--neutral-400)' : 'var(--neutral-900)',
        boxSizing:       'border-box',
        outline:         'none',
        ...style,
      }}
    />
  )
}

// ── Copy icon ─────────────────────────────────────────────────────────────────

export function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="5.5" y="5.5" width="7" height="8" rx="1.5" stroke="var(--neutral-400)" strokeWidth="1.2" />
      <path d="M10.5 5.5V4a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" stroke="var(--neutral-400)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

// ── Card shell ────────────────────────────────────────────────────────────────

export function Card({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <div style={{
      border:       `1px solid ${danger ? 'var(--red-400)' : 'var(--border-default)'}`,
      borderRadius: 16,
      boxShadow:    '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
      overflow:     'hidden',
    }}>
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  subtitle,
  badge,
}: {
  title:     string
  subtitle?: string
  badge?:    React.ReactNode
}) {
  return (
    <div style={{
      borderBottom: '1px solid var(--neutral-100)',
      // Symmetric top/bottom — was '12px 24px 24px', which left the title
      // cramped against the card's top border compared to the space below it.
      padding:      '24px',
      display:      'flex',
      alignItems:   'flex-start',
      gap:          12,
    }}>
      <div style={{ flex: '1 0 0', minWidth: 0 }}>
        <p style={{
          fontFamily:   'var(--font-body)',
          fontWeight:   500,
          fontSize:     16,
          lineHeight:   '22px',
          color:        'var(--neutral-900)',
          margin:       '0 0 6px',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
        }}>
          {title}
        </p>
        {subtitle && (
          <p style={{
            fontFamily:   'var(--font-body)',
            fontWeight:   400,
            fontSize:     14,
            lineHeight:   '22px',
            color:        'var(--neutral-500)',
            margin:       0,
          }}>
            {subtitle}
          </p>
        )}
      </div>
      {badge}
    </div>
  )
}

// ── Field row ─────────────────────────────────────────────────────────────────

// ── Visibility select ─────────────────────────────────────────────────────────

const VISIBILITY_OPTIONS = [
  { value: 'private', label: 'Private by default' },
  { value: 'team',    label: 'Team only'           },
]

export function VisibilitySelect({
  value,
  onChange,
  disabled,
}: {
  value:     string
  onChange:  (v: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const label = VISIBILITY_OPTIONS.find(o => o.value === value)?.label ?? value

  return (
    <DropdownFloat
      open={open}
      onOpenChange={v => { if (!disabled) setOpen(v) }}
      placement="bottom-end"
      offset={4}
      trigger={
        <button
          type="button"
          disabled={disabled}
          style={{
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'space-between',
            gap:             8,
            width:           327,
            height:          36,
            padding:         '0 10px',
            borderRadius:    10,
            border:          'none',
            backgroundColor: 'var(--neutral-50)',
            boxShadow:       '0px 1.091px 1.091px 0px rgba(59,54,50,0.05), 0px 1.455px 3.127px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-100)',
            cursor:          disabled ? 'not-allowed' : 'pointer',
            opacity:         disabled ? 0.6 : 1,
            outline:         'none',
            flexShrink:      0,
          }}
        >
          <span style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize:   14,
            lineHeight: '22px',
            color:      'var(--neutral-700)',
          }}>
            {label}
          </span>
          <ArrowDownOneIcon size={12} color="var(--neutral-400)" />
        </button>
      }
    >
      <Dropdown style={{ width: 327 }} maxHeight={false}>
        {VISIBILITY_OPTIONS.map(o => (
          <DropdownMenuItem
            key={o.value}
            fluid
            label={o.label}
            selected={o.value === value}
            icon={o.value === value ? <TickTwoIcon size={14} /> : undefined}
            onClick={() => { onChange(o.value); setOpen(false) }}
          />
        ))}
      </Dropdown>
    </DropdownFloat>
  )
}

// ── Image compression ─────────────────────────────────────────────────────────

export function compressImage(file: File, maxW: number, maxH: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img
        const ratio = Math.min(maxW / width, maxH / height, 1)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
