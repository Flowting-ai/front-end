'use client'

import React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { Switch } from '@/components/Switch'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export type SecurityRowType   = 'toggle' | 'radio'
export type SecurityRowStatus = 'active' | 'pending' | 'disabled'

// Toggle variant props
export interface SecurityToggleRowToggleProps {
  type:       'toggle'
  isEnabled:  boolean
  onToggle?:  () => void
}

// Radio variant props — 3-way choice (used for HITL threshold)
export interface SecurityToggleRowRadioOption {
  value:       string
  label:       string
  description: string
}

export interface SecurityToggleRowRadioProps {
  type:          'radio'
  options:       SecurityToggleRowRadioOption[]
  value:         string
  onChange?:     (value: string) => void
}

export type SecurityToggleRowVariantProps =
  | SecurityToggleRowToggleProps
  | SecurityToggleRowRadioProps

export type SecurityToggleRowProps = SecurityToggleRowVariantProps & {
  /** Section label — 14px medium weight, left side */
  label: string
  /** Secondary description — 13px muted, below label */
  description: string
  /**
   * active  — fully interactive
   * pending — switch disabled, amber "Verifying…" pill shown (domain claiming)
   * disabled — full row muted, non-interactive
   */
  status?:      SecurityRowStatus
  pendingLabel?: string
  asChild?: boolean
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'>

// ── Pending pill ──────────────────────────────────────────────────────────────

function PendingPill({ label }: { label: string }) {
  return (
    <span
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        gap:             5,
        padding:         '2px 8px',
        borderRadius:    6,
        backgroundColor: 'var(--color-tag-Yellow-bg)',
        fontFamily:      'var(--font-body)',
        fontWeight:      'var(--font-weight-medium)',
        fontSize:        'var(--font-size-caption)',
        lineHeight:      'var(--line-height-caption)',
        color:           'var(--color-tag-Yellow-text)',
        flexShrink:      0,
      }}
    >
      {/* Animated spinner dot */}
      <span
        aria-hidden
        style={{
          display:         'inline-flex',
          width:           6,
          height:          6,
          borderRadius:    '50%',
          backgroundColor: 'var(--color-tag-Yellow-text)',
          opacity:         0.7,
          flexShrink:      0,
        }}
      />
      {label}
    </span>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export const SecurityToggleRow = React.forwardRef<HTMLDivElement, SecurityToggleRowProps>(
  function SecurityToggleRow(
    {
      label,
      description,
      status = 'active',
      pendingLabel = 'Verifying…',
      asChild = false,
      className,
      style,
      ...rest
    },
    ref,
  ) {
    const Comp       = (asChild ? Slot : 'div') as React.ElementType
    const isDisabled = status === 'disabled'
    const isPending  = status === 'pending'

    // Extract variant props from rest
    const { type, ...props } = rest as SecurityToggleRowVariantProps & typeof rest

    return (
      <Comp
        ref={ref}
        className={cn(className)}
        style={{
          display:   'flex',
          flexDirection: 'column',
          gap:       type === 'radio' ? 12 : 0,
          opacity:   isDisabled ? 0.45 : 1,
          pointerEvents: isDisabled ? 'none' : undefined,
          ...style,
        }}
        {...(props as React.HTMLAttributes<HTMLDivElement>)}
      >
        {/* Header row — label + right control */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          {/* Left: label + description */}
          <div style={{ flex: '1 0 0', minWidth: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span
              style={{
                fontFamily:  'var(--font-body)',
                fontWeight:  'var(--font-weight-medium)',
                fontSize:    'var(--font-size-body)',
                lineHeight:  'var(--line-height-body)',
                color:       'var(--neutral-900)',
              }}
            >
              {label}
            </span>
            <span
              style={{
                fontFamily:  'var(--font-body)',
                fontWeight:  'var(--font-weight-regular)',
                fontSize:    'var(--font-size-caption)',
                lineHeight:  'var(--line-height-caption)',
                color:       'var(--neutral-500)',
              }}
            >
              {description}
            </span>
          </div>

          {/* Right: toggle or pending pill */}
          {type === 'toggle' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, paddingTop: 1 }}>
              {isPending && <PendingPill label={pendingLabel} />}
              <Switch
                checked={(rest as SecurityToggleRowToggleProps).isEnabled}
                onCheckedChange={
                  isPending ? undefined : (rest as SecurityToggleRowToggleProps).onToggle
                    ? () => (rest as SecurityToggleRowToggleProps).onToggle?.()
                    : undefined
                }
                disabled={isPending}
                aria-label={label}
              />
            </div>
          )}
        </div>

        {/* Radio options — rendered below the header for HITL-style 3-way choice */}
        {type === 'radio' && (
          <div
            role="radiogroup"
            aria-label={label}
            style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 2 }}
          >
            {(rest as SecurityToggleRowRadioProps).options.map((opt) => {
              const isSelected = (rest as SecurityToggleRowRadioProps).value === opt.value
              return (
                <label
                  key={opt.value}
                  style={{
                    display:   'flex',
                    alignItems: 'flex-start',
                    gap:        10,
                    cursor:    'pointer',
                  }}
                >
                  {/* Custom radio circle */}
                  <span
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={0}
                    onClick={() => (rest as SecurityToggleRowRadioProps).onChange?.(opt.value)}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault()
                        ;(rest as SecurityToggleRowRadioProps).onChange?.(opt.value)
                      }
                    }}
                    style={{
                      display:         'inline-flex',
                      alignItems:      'center',
                      justifyContent:  'center',
                      width:           18,
                      height:          18,
                      borderRadius:    '50%',
                      border:          isSelected
                        ? '5px solid var(--neutral-900)'
                        : '1.5px solid var(--neutral-300)',
                      backgroundColor: 'var(--neutral-white)',
                      flexShrink:      0,
                      marginTop:       2,
                      cursor:          'pointer',
                      outline:         'none',
                      transition:      'border 150ms ease',
                    }}
                    className="kds-radio-btn"
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span
                      style={{
                        fontFamily:  'var(--font-body)',
                        fontWeight:  'var(--font-weight-medium)',
                        fontSize:    'var(--font-size-body)',
                        lineHeight:  'var(--line-height-body)',
                        color:       isSelected ? 'var(--neutral-900)' : 'var(--neutral-700)',
                      }}
                    >
                      {opt.label}
                    </span>
                    <span
                      style={{
                        fontFamily:  'var(--font-body)',
                        fontWeight:  'var(--font-weight-regular)',
                        fontSize:    'var(--font-size-caption)',
                        lineHeight:  'var(--line-height-caption)',
                        color:       'var(--neutral-500)',
                      }}
                    >
                      {opt.description}
                    </span>
                  </div>
                </label>
              )
            })}
          </div>
        )}
      </Comp>
    )
  },
)

SecurityToggleRow.displayName = 'SecurityToggleRow'
export default SecurityToggleRow
