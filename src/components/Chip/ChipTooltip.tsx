import React from 'react'

export interface ChipTooltipProps {
  /** Short bold heading, e.g. "Web search". */
  title: string
  /** Optional key/value row; the label is muted and the value bold, e.g. label="Active" value="Concise". */
  detail?: { label: string; value: string }
  /** Plain description lines, each on its own line. */
  lines?: string[]
  /** Hints shown last as "Key: what it does" (e.g. "×: Remove"); the key renders as a small square keycap. */
  hints?: string[]
}

const DIVIDER: React.CSSProperties = { height: 1, background: 'currentColor', opacity: 0.14 }
const REGULAR = 400
const STRONG = 700

/**
 * Structured tooltip body for chips, separated into sections by hairline dividers:
 *   Title · divider · key/value + description · divider · control hints.
 * The surrounding Tooltip renders at medium weight, so body text is set back to
 * regular here so the bold title and values actually stand out.
 */
export function ChipTooltip({ title, detail, lines = [], hints = [] }: ChipTooltipProps) {
  const hasBody = Boolean(detail) || lines.length > 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left', minWidth: 176, padding: '4px 4px 2px', fontWeight: REGULAR }}>
      <div style={{ fontSize: 12, lineHeight: '16px', fontWeight: STRONG, letterSpacing: '0.01em' }}>{title}</div>

      {hasBody && (
        <>
          <div style={DIVIDER} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {detail && (
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
                <span style={{ opacity: 0.65 }}>{detail.label}</span>
                <span style={{ fontWeight: STRONG, textAlign: 'right' }}>{detail.value}</span>
              </div>
            )}
            {lines.map(line => <div key={line} style={{ opacity: 0.9 }}>{line}</div>)}
          </div>
        </>
      )}

      {hints.length > 0 && (
        <>
          <div style={DIVIDER} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {hints.map(hint => {
              const [key, ...rest] = hint.split(':')
              const raw = rest.join(':').trim()
              const action = raw.charAt(0).toUpperCase() + raw.slice(1)
              return (
                <div key={hint} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 18,
                      height: 18,
                      paddingBottom: 1,
                      flexShrink: 0,
                      fontSize: 12,
                      lineHeight: 1,
                      borderRadius: 5,
                      background: 'color-mix(in srgb, currentColor 12%, transparent)',
                      boxShadow: 'inset 0 -1px 0 color-mix(in srgb, currentColor 22%, transparent)',
                    }}
                  >
                    {key.trim()}
                  </span>
                  <span style={{ opacity: 0.85 }}>{action}</span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
