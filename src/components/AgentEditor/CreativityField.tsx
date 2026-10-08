'use client'

import React from 'react'
import { Slider } from '@/components/Slider'
import { clampTemperature, temperatureLabel } from '@/lib/agent-draft'
import { HINT_STYLE, LABEL_STYLE } from './styles'

export interface CreativityFieldProps {
  value:     number
  onChange:  (value: number) => void
  disabled?: boolean
}

/**
 * One control for "creativity" — it is the model's temperature, not two settings.
 * Low is precise and consistent; high is imaginative and varied.
 */
export function CreativityField({ value, onChange, disabled = false }: CreativityFieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <p style={LABEL_STYLE}>Creativity</p>
      <div
        style={{
          display: 'flex', flexDirection: 'column', gap: 12,
          // Top padding reserves room for the value tooltip above the thumb.
          padding: '28px 16px 16px',
          // Same surface and ring as every other field (white in light, a lifted grey in dark), so the card
          // reads against the page in both themes.
          borderRadius: 18, backgroundColor: 'var(--field-surface)',
          boxShadow: '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--text-field-ring)',
        }}
      >
        <Slider
          value={[clampTemperature(value)]}
          onValueChange={([next]) => onChange(clampTemperature(next))}
          min={0}
          max={1}
          step={0.01}
          showValue
          valueFormat={v => `${v.toFixed(2)} · ${temperatureLabel(v)}`}
          fillColor="var(--focus-ring)"
          trackColor="var(--field-track)"
          disabled={disabled}
          aria-label="Creativity"
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span style={HINT_STYLE}>Precise &amp; consistent</span>
          <span style={HINT_STYLE}>Creative &amp; varied</span>
        </div>
      </div>
    </div>
  )
}
