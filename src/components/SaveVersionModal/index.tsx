'use client'

import React, { useState, useEffect, useRef } from 'react'
import { CancelOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'

// ── Available change tags ────────────────────────────────────────────────────

export const ALL_CHANGE_TAGS = ['Instructions', 'Model', 'Profile', 'Knowledge', 'Connectors'] as const
export type ChangeTag = (typeof ALL_CHANGE_TAGS)[number]

// ── Props ────────────────────────────────────────────────────────────────────

export interface SaveVersionModalProps {
  open: boolean
  /** Tags that are pre-selected when the modal opens. */
  initialTags?: string[]
  /** Shows a loading spinner on the Save button while true. */
  isSaving?: boolean
  /** Called with the chosen tags when user clicks "Save version". Empty array = skipped. */
  onSave: (tags: string[]) => void
  /** Called when the user cancels (backdrop click, Escape, X icon). Does NOT trigger a save. */
  onClose: () => void
}

// ── Tag chip ─────────────────────────────────────────────────────────────────

function TagChip({ label, selected, onToggle }: { label: string; selected: boolean; onToggle: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:         'flex',
        alignItems:      'center',
        padding:         '6px 14px',
        borderRadius:    100,
        border:          selected ? '1px solid var(--blue-400)' : '1px solid var(--neutral-200)',
        backgroundColor: selected
          ? 'var(--blue-50, #eff6ff)'
          : hovered
          ? 'var(--neutral-50)'
          : 'transparent',
        boxShadow:       selected ? '0px 0px 0px 1px var(--blue-200, #bfdbfe)' : 'none',
        cursor:          'pointer',
        fontFamily:      'var(--font-body)',
        fontWeight:      500,
        fontSize:        14,
        lineHeight:      '22px',
        color:           selected ? 'var(--blue-700, #1d4ed8)' : 'var(--neutral-600)',
        transition:      'background-color 100ms, border-color 100ms, box-shadow 100ms, color 100ms',
        userSelect:      'none',
      }}
    >
      {label}
    </button>
  )
}

// ── Modal ────────────────────────────────────────────────────────────────────

export function SaveVersionModal({
  open,
  initialTags = [],
  isSaving    = false,
  onSave,
  onClose,
}: SaveVersionModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialTags))
  // Track the serialised initial tags so the effect dependency is stable
  const initialTagsKey = initialTags.slice().sort().join(',')

  useEffect(() => {
    if (open) setSelected(new Set(initialTags))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTagsKey])

  // Escape key to close (without saving)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  if (!open) return null

  function toggleTag(tag: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  return (
    // eslint-disable-next-line react-doctor/click-events-have-key-events, react-doctor/no-static-element-interactions -- backdrop click to cancel; keyboard via Escape handler above
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tag this version"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position:              'fixed',
        inset:                 0,
        backgroundColor:       'rgba(18,12,8,0.45)',
        backdropFilter:        'blur(2px)',
        WebkitBackdropFilter:  'blur(2px)',
        display:               'flex',
        alignItems:            'center',
        justifyContent:        'center',
        zIndex:                200,
      }}
    >
      {/* Card */}
      {/* eslint-disable-next-line react-doctor/click-events-have-key-events, react-doctor/no-static-element-interactions -- stop propagation so backdrop doesn't fire */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: 'white',
          borderRadius:    18,
          boxShadow:
            '0px 12px 16px -4px rgba(130,122,116,0.12), 0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
          padding:         '20px',
          width:           400,
          maxWidth:        'calc(100vw - 32px)',
          display:         'flex',
          flexDirection:   'column',
          gap:             16,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <p style={{
              fontFamily:  'var(--font-title)',
              fontWeight:  400,
              fontSize:    20,
              lineHeight:  '28px',
              color:       '#1a1916',
              margin:      0,
            }}>
              What changed?
            </p>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              fontSize:   14,
              lineHeight: '22px',
              color:      'var(--neutral-500)',
              margin:     0,
            }}>
              Tag this version to track what you updated.
            </p>
          </div>
          <IconButton
            variant="outline"
            size="md"
            icon={<CancelOneIcon size={20} />}
            aria-label="Cancel"
            onClick={onClose}
          />
        </div>

        {/* Tag chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {ALL_CHANGE_TAGS.map(tag => (
            <TagChip
              key={tag}
              label={tag}
              selected={selected.has(tag)}
              onToggle={() => toggleTag(tag)}
            />
          ))}
        </div>

        {/* Footer */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'flex-end',
          gap:            8,
          paddingTop:     4,
          borderTop:      '1px solid var(--neutral-100)',
        }}>
          <Button
            variant="ghost"
            size="sm"
            disabled={isSaving}
            onClick={() => onSave([])}
          >
            Skip
          </Button>
          {/* eslint-disable-next-line react-doctor/design-no-vague-button-label -- contextually clear: saves a version */}
          <Button
            variant="default"
            size="sm"
            loading={isSaving}
            disabled={isSaving}
            onClick={() => onSave([...selected])}
          >
            {isSaving ? 'Saving…' : 'Save version'}
          </Button>
        </div>
      </div>
    </div>
  )
}
