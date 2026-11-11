import React from 'react'

export interface UsageMeterProps {
  /** How full the meter is, 0–100. Values outside the range are clamped. */
  value: number
  /** Accessible name for the progress bar, e.g. "Credits used". */
  label: string
  /** Optional text above the bar on the left, e.g. "12,538 of 20,000 credits used". */
  caption?: React.ReactNode
  /** Optional text above the bar on the right, e.g. "63%". */
  trailing?: React.ReactNode
  /** Bar thickness in px. @default 6 */
  height?: number
  style?: React.CSSProperties
}

/**
 * The settings-wide progress meter: a neutral track with a near-black fill, so a usage bar reads the same
 * on every page (credits, storage, seats). A non-zero value always shows a small sliver.
 */
export function UsageMeter({ value, label, caption, trailing, height = 6, style }: UsageMeterProps) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', ...style }}>
      {(caption || trailing) && (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: '20px', color: 'var(--neutral-600)' }}>
          <span style={{ minWidth: 0 }}>{caption}</span>
          {trailing && <span style={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{trailing}</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        style={{ width: '100%', height, borderRadius: 999, background: 'var(--neutral-100)', overflow: 'hidden' }}
      >
        <div
          style={{
            width: `${pct}%`,
            minWidth: pct > 0 ? height : 0,
            height: '100%',
            borderRadius: 999,
            background: 'var(--neutral-900)',
            transition: 'width 400ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </div>
    </div>
  )
}

export default UsageMeter
