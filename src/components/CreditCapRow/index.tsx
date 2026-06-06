'use client'

import React, { useState } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { Avatar } from '@/components/Avatar'
import { cn } from '@/lib/utils'

// ── Shadows ───────────────────────────────────────────────────────────────────

const SHADOW_INPUT = '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-200)'
const SHADOW_INPUT_FOCUS = '0px 0px 0px 1.5px var(--neutral-500)'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreditCapRowProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  memberName:  string
  email:       string
  avatarUrl?:  string
  /** Credits consumed this billing period */
  creditUsed:  number
  /** Current cap — undefined means no cap set */
  creditCap?:  number
  /** When true, renders the editable admin input for the cap */
  isAdmin?:    boolean
  /** Fires when admin changes the cap. null = remove cap (no limit) */
  onCapChange?: (cap: number | null) => void
  asChild?: boolean
}

function formatK(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n)
}

// ── CapInput — Admin only ─────────────────────────────────────────────────────

function CapInput({
  value,
  onChange,
}: {
  value: number | undefined
  onChange: (cap: number | null) => void
}) {
  const [focused, setFocused] = useState(false)
  const [draft,   setDraft]   = useState(value != null ? String(value) : '')

  function commit() {
    const n = parseInt(draft, 10)
    if (!draft.trim() || isNaN(n) || n <= 0) {
      onChange(null)
      setDraft('')
    } else {
      onChange(n)
      setDraft(String(n))
    }
  }

  return (
    <div style={{
      display:         'flex',
      alignItems:      'center',
      height:          28,
      width:           90,
      borderRadius:    8,
      backgroundColor: 'var(--neutral-white)',
      boxShadow:       focused ? SHADOW_INPUT_FOCUS : SHADOW_INPUT,
      transition:      'box-shadow 120ms',
      flexShrink:      0,
    }}>
      <input
        type="number"
        min={1}
        value={draft}
        placeholder="No limit"
        onChange={e => setDraft(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); commit() }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        style={{
          flex:       '1 0 0',
          minWidth:   0,
          padding:    '0 8px',
          border:     'none',
          outline:    'none',
          background: 'transparent',
          fontFamily: 'var(--font-body)',
          fontWeight: 400,
          fontSize:   'var(--font-size-caption)',
          color:      'var(--neutral-700)',
          // Hide browser spinners
          MozAppearance: 'textfield' as React.CSSProperties['MozAppearance'],
        }}
      />
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export const CreditCapRow = React.forwardRef<HTMLDivElement, CreditCapRowProps>(
  function CreditCapRow(
    {
      memberName,
      email,
      avatarUrl,
      creditUsed,
      creditCap,
      isAdmin = false,
      onCapChange,
      asChild = false,
      className,
      style,
      ...props
    },
    ref,
  ) {
    const Comp    = (asChild ? Slot : 'div') as React.ElementType
    const exceeded = creditCap != null && creditUsed > creditCap
    const usedColor = exceeded ? 'var(--color-tag-Red-text)' : 'var(--neutral-600)'

    return (
      <Comp
        ref={ref}
        className={cn(className)}
        style={{
          display:        'flex',
          alignItems:     'center',
          gap:            12,
          padding:        '10px 16px',
          backgroundColor: exceeded ? 'var(--color-tag-Red-bg)' : 'transparent',
          transition:     'background-color 150ms',
          ...style,
        }}
        {...props}
      >
        {/* Avatar */}
        <Avatar
          name={memberName}
          size="sm"
          style={{ flexShrink: 0 }}
        />

        {/* Name + email */}
        <div style={{ flex: '1 0 0', minWidth: 0 }}>
          <p style={{
            fontFamily:   'var(--font-body)',
            fontWeight:   500,
            fontSize:     'var(--font-size-body)',
            lineHeight:   'var(--line-height-body)',
            color:        'var(--neutral-900)',
            margin:       0,
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
            {memberName}
          </p>
          <p style={{
            fontFamily:   'var(--font-body)',
            fontWeight:   400,
            fontSize:     'var(--font-size-caption)',
            lineHeight:   'var(--line-height-caption)',
            color:        'var(--neutral-400)',
            margin:       0,
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
            {email}
          </p>
        </div>

        {/* Usage */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <span style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 500,
            fontSize:   'var(--font-size-caption)',
            color:      usedColor,
          }}>
            {formatK(creditUsed)}
          </span>
          {creditCap != null && (
            <span style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              fontSize:   'var(--font-size-caption)',
              color:      'var(--neutral-400)',
            }}>
              {' / '}{formatK(creditCap)}
            </span>
          )}
          {exceeded && (
            <p style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              fontSize:   'var(--font-size-caption)',
              color:      'var(--color-tag-Red-text)',
              margin:     '1px 0 0',
            }}>
              Cap exceeded
            </p>
          )}
        </div>

        {/* Admin cap input OR member static cap */}
        {isAdmin ? (
          <CapInput
            value={creditCap}
            onChange={onCapChange ?? (() => {})}
          />
        ) : (
          <span style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize:   'var(--font-size-caption)',
            color:      creditCap != null ? 'var(--neutral-500)' : 'var(--neutral-300)',
            flexShrink: 0,
            width:      90,
            textAlign:  'right',
          }}>
            {creditCap != null ? `${formatK(creditCap)} cap` : 'No limit'}
          </span>
        )}
      </Comp>
    )
  },
)

CreditCapRow.displayName = 'CreditCapRow'
export default CreditCapRow
