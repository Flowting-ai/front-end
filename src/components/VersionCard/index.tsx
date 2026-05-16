'use client'

import React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { Badge } from '@/components/Badge'
import type { BadgeColor } from '@/components/Badge'
import { Button } from '@/components/Button'
import { cn } from '@/lib/utils'

// ── Shadows ───────────────────────────────────────────────────────────────────

const SHADOW_CARD   = '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)'
const SHADOW_AVATAR = '0px 1.091px 1.09px 0px rgba(59,54,50,0.05), 0px 1.455px 1px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-100)'

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * "default" = the currently-active version (white bg, "Current" button, Blue badges).
 * "restore" = a past version (neutral-50 + dashed border, "Restore" button, Neutral badges).
 */
export type VersionCardVariant = 'default' | 'restore'

export interface VersionCardChange {
  label: string
}

export interface VersionCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: VersionCardVariant
  /** URL for the persona avatar image. Falls back to a neutral placeholder. */
  avatarUrl?: string
  /** Alt text for the avatar. Defaults to `"${personaName} avatar"`. */
  avatarAlt?: string
  /** Persona name — displayed at body-lg size. */
  personaName?: string
  /** Timestamp string — e.g. "May 12 · 2:34 PM". Shown in code font, right-aligned. */
  timestamp?: string
  /** Version slug — e.g. "@legal-advisor·v002". Shown in code font below the name. */
  versionSlug?: string
  /** Change labels shown as Badge chips under the "Changes" heading. */
  changes?: readonly VersionCardChange[]
  /** Fires when "Restore" is clicked. Only relevant for `variant="restore"`. */
  onRestore?: () => void
  /** Disables all interaction. */
  disabled?: boolean
  asChild?: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export const VersionCard = React.forwardRef<HTMLDivElement, VersionCardProps>(
  function VersionCard(
    {
      variant      = 'default',
      avatarUrl,
      avatarAlt,
      personaName  = '',
      timestamp    = '',
      versionSlug  = '',
      changes      = [],
      onRestore,
      disabled     = false,
      asChild      = false,
      className,
      style,
      ...props
    },
    ref,
  ) {
    const Comp      = (asChild ? Slot : 'div') as React.ElementType
    const isCurrent = variant === 'default'
    const badgeColor: BadgeColor = isCurrent ? 'Blue' : 'Neutral'
    const resolvedAlt = avatarAlt ?? (personaName ? `${personaName} avatar` : 'Persona avatar')

    return (
      <Comp
        ref={ref}
        aria-current={isCurrent ? 'true' : undefined}
        className={cn(className)}
        style={{
          display:         'flex',
          flexDirection:   'column',
          gap:             9,
          padding:         12,
          borderRadius:    16,
          width:           '100%',
          boxSizing:       'border-box' as const,
          backgroundColor: isCurrent ? 'var(--neutral-white)' : 'var(--neutral-50)',
          boxShadow:       SHADOW_CARD,
          ...(isCurrent ? {} : { border: '1px dashed var(--neutral-300)' }),
          opacity:         disabled ? 0.5 : 1,
          pointerEvents:   disabled ? 'none' : undefined,
          ...style,
        }}
        {...props}
      >

        {/* ── Header: avatar + text ──────────────────────────────────────────── */}
        <div
          style={{
            display:    'flex',
            gap:        12,
            alignItems: 'flex-start',
            width:      '100%',
          }}
        >
          {/* Persona avatar */}
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={resolvedAlt}
              style={{
                width:        37,
                height:       37,
                borderRadius: 8,
                objectFit:    'cover',
                flexShrink:   0,
                boxShadow:    SHADOW_AVATAR,
                display:      'block',
              }}
            />
          ) : (
            <div
              aria-hidden
              style={{
                width:           37,
                height:          37,
                borderRadius:    8,
                flexShrink:      0,
                backgroundColor: 'var(--neutral-100)',
                boxShadow:       SHADOW_AVATAR,
              }}
            />
          )}

          {/* Text column */}
          <div
            style={{
              display:       'flex',
              flexDirection: 'column',
              flex:          '1 0 0',
              gap:           8,
              alignItems:    'flex-start',
              minWidth:      0,
            }}
          >
            {/* Name (left) + timestamp (right) */}
            <div
              style={{
                display:        'flex',
                alignItems:     'flex-start',
                justifyContent: 'space-between',
                width:          '100%',
                gap:            8,
              }}
            >
              <span
                style={{
                  fontFamily:   'var(--font-body)',
                  fontSize:     'var(--font-size-body-lg)',
                  fontWeight:   'var(--font-weight-regular)',
                  lineHeight:   'var(--line-height-body-lg)',
                  color:        'var(--neutral-900)',
                  overflow:     'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace:   'nowrap',
                  flex:         '1 1 0',
                  minWidth:     0,
                }}
              >
                {personaName}
              </span>
              {timestamp && (
                <span
                  style={{
                    fontFamily: 'var(--font-code)',
                    fontSize:   'var(--font-size-code)',
                    fontWeight: 'var(--font-weight-regular)',
                    lineHeight: 'var(--line-height-code)',
                    color:      'var(--neutral-500)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {timestamp}
                </span>
              )}
            </div>

            {/* Version slug */}
            {versionSlug && (
              <span
                style={{
                  fontFamily:   'var(--font-code)',
                  fontSize:     'var(--font-size-code)',
                  fontWeight:   'var(--font-weight-regular)',
                  lineHeight:   'var(--line-height-code)',
                  color:        'var(--neutral-500)',
                  whiteSpace:   'nowrap',
                  overflow:     'hidden',
                  textOverflow: 'ellipsis',
                  width:        '100%',
                }}
              >
                {versionSlug}
              </span>
            )}
          </div>
        </div>

        {/* ── Footer: changes (column) + CTA aligned to badge row bottom ────── */}
        <div
          style={{
            display:    'flex',
            alignItems: 'flex-end',
            gap:        8,
            width:      '100%',
          }}
        >
          {/* Changes: "Changes" label above, badges below with right-edge fade.
              flex: 1 1 0 constrains it so the button never gets pushed out. */}
          <div
            style={{
              display:       'flex',
              flexDirection: 'column',
              flex:          '1 1 0',
              minWidth:      0,
              gap:           6,
              alignItems:    'flex-start',
            }}
          >
            {changes.length > 0 && (
              <>
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize:   'var(--font-size-caption)',
                    fontWeight: 'var(--font-weight-regular)',
                    lineHeight: 'var(--line-height-caption)',
                    color:      'var(--neutral-400)',
                  }}
                >
                  Changes
                </span>
                {/* Badge row — 2px padding lets the 1px shadow ring breathe before the
                    overflow boundary; mask fades trailing badges without hard-clipping */}
                <div
                  style={{
                    width:              '100%',
                    padding:            '2px',
                    boxSizing:          'border-box' as const,
                    overflow:           'hidden',
                    WebkitMaskImage:    'linear-gradient(to right, black calc(100% - 40px), transparent 100%)',
                    maskImage:          'linear-gradient(to right, black calc(100% - 40px), transparent 100%)',
                  }}
                >
                  <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
                    {changes.map((change, i) => (
                      <Badge key={i} label={change.label} color={badgeColor} />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* CTA — wrapped in div so layout props don't clobber Button's internal bgStyle */}
          {isCurrent ? (
            <div style={{ flexShrink: 0 }}>
              <Button variant="default" size="sm" tabIndex={-1}>Current</Button>
            </div>
          ) : (
            <div style={{ flexShrink: 0 }}>
              <Button
                variant="outline"
                size="sm"
                onClick={onRestore}
                aria-label={`Restore version ${versionSlug || personaName}`}
              >
                Restore
              </Button>
            </div>
          )}
        </div>

      </Comp>
    )
  },
)

VersionCard.displayName = 'VersionCard'
export default VersionCard
