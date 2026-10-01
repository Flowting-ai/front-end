'use client'

import React, { useMemo } from 'react'
import type { PersonaSound } from '@/lib/api/persona-schemas'
import { applyTone, readTone, toneLine } from '@/lib/agent-draft'
import { HINT_STYLE, LABEL_STYLE } from './styles'

export interface ToneFieldProps {
  instructions: string
  tones:        readonly PersonaSound[]
  /** Receives the instructions with the tone line set (or removed for Default). */
  onChange:     (instructions: string) => void
  disabled?:    boolean
}

function Chip({
  label, selected, disabled, onClick,
}: { label: string; selected: boolean; disabled?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      style={{
        padding:      '5px 12px',
        borderRadius: 999,
        border:       'none',
        cursor:       disabled ? 'not-allowed' : onClick ? 'pointer' : 'default',
        opacity:      disabled ? 0.6 : 1,
        fontFamily:   'var(--font-body)',
        fontWeight:   'var(--font-weight-medium)',
        fontSize:     13,
        lineHeight:   '20px',
        color:        selected ? 'var(--blue-700)' : 'var(--neutral-700)',
        backgroundColor: selected ? 'var(--blue-50, #eef4fb)' : 'var(--neutral-white)',
        boxShadow:    selected
          ? '0px 0px 0px 1px var(--blue-400)'
          : '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
        transition:   'box-shadow 150ms, background-color 150ms, color 150ms',
      }}
    >
      {label}
    </button>
  )
}

/**
 * How the agent sounds. The backend keeps no separate tone setting, so choosing
 * one writes a single `Tone: …` line into the instructions (and Default removes
 * it) — you can see it and edit it there.
 */
export function ToneField({ instructions, tones, onChange, disabled = false }: ToneFieldProps) {
  const reading = useMemo(() => readTone(instructions, tones), [instructions, tones])
  const active = reading.kind === 'known' ? reading.tone : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <p style={LABEL_STYLE}>Tone</p>
      <div role="group" aria-label="Tone" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Chip
          label="Default"
          selected={reading.kind === 'default'}
          disabled={disabled}
          onClick={() => onChange(applyTone(instructions, null))}
        />
        {tones.map(tone => (
          <Chip
            key={toneLine(tone)}
            label={tone.name}
            selected={active === tone}
            disabled={disabled}
            onClick={() => onChange(applyTone(instructions, tone))}
          />
        ))}
        {reading.kind === 'custom' && <Chip label="Custom" selected disabled />}
      </div>
      <p style={HINT_STYLE}>
        {active
          ? active.description
          : reading.kind === 'custom'
            ? 'Set by a "Tone:" line in the instructions. Pick one above to replace it.'
            : 'No tone line — the agent uses its natural voice.'}
      </p>
    </div>
  )
}
