'use client'

import React, { useState, useCallback } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowDownOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { Switch } from '@/components/Switch'
import { cn } from '@/lib/utils'

// ── Shadows ───────────────────────────────────────────────────────────────────

const SHADOW_ICON    = '0px 0px 0px 1px var(--neutral-100)'
const SHADOW_CONNECT = '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)'
const SHADOW_PANEL   = '0px 0px 0px 1px var(--neutral-100)'

// ── Types ─────────────────────────────────────────────────────────────────────

/** not-connected → shows "Connect" + inline OAuth expand panel on click.
 *  connected-personal → shows ON/OFF badge + Switch toggle.
 *  connected-workspace → a shared org account. When an onActiveChange handler is
 *    given it shows the same ON/OFF badge + Switch as a personal row (pass
 *    `disabled` for viewers who can't manage it); otherwise it falls back to a
 *    read-only "Connected" badge. */
export type ConnectorStatus = 'not-connected' | 'connected-personal' | 'connected-workspace'

export interface ConnectorRowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Connector name — e.g. "Figma", "Slack" */
  name?: string
  /** Caption description below the name */
  description?: string
  /** URL for the 26×26 connector logo (rendered inside a 38×38 white icon box) */
  iconUrl?: string
  /** Alt text for the connector logo */
  iconAlt?: string
  /** Current connection state — drives which right-side affordance renders */
  status?: ConnectorStatus
  /** connected-personal: whether the connector is currently active */
  active?: boolean
  /** connected-personal / connected-workspace: fires when the active toggle changes */
  onActiveChange?: (active: boolean) => void
  /** connected-workspace: name of the workspace that owns this connection */
  workspaceName?: string
  /** connected-workspace: the shared account's label, shown inline as
   *  "{name} ({accountLabel})" — e.g. "Figma (Strange Rock)". */
  accountLabel?: string
  /** OAuth panel heading — defaults to "Connect {name}" */
  oauthTitle?: string
  /** OAuth panel body text */
  oauthDescription?: string
  /** OAuth CTA button label — defaults to "Continue with {name}" */
  oauthCtaLabel?: string
  /** Fires when the OAuth CTA button is clicked */
  onOAuthCta?: () => void
  /** Disables all interaction */
  disabled?: boolean
  asChild?: boolean
}

// ── Icon box ──────────────────────────────────────────────────────────────────

function ConnectorIcon({
  iconUrl,
  iconAlt,
  name,
}: {
  iconUrl?: string
  iconAlt?: string
  name?: string
}) {
  return (
    <div
      aria-hidden={!iconUrl}
      style={{
        width:           38,
        height:          38,
        borderRadius:    5,
        backgroundColor: 'var(--neutral-white)',
        boxShadow:       SHADOW_ICON,
        flexShrink:      0,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        overflow:        'hidden',
      }}
    >
      {iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- connector logo, dynamic/local brand asset
        <img
          src={iconUrl}
          alt={iconAlt ?? (name ? `${name} logo` : 'Connector logo')}
          style={{ width: 26, height: 26, objectFit: 'contain', display: 'block' }}
        />
      ) : (
        <div
          aria-hidden
          style={{
            width:           26,
            height:          26,
            borderRadius:    4,
            backgroundColor: 'var(--neutral-100)',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize:   'var(--font-size-caption)',
              fontWeight: 600,
              color:      'var(--neutral-500)',
              lineHeight: 1,
            }}
          >
            {name?.[0]?.toUpperCase() ?? '?'}
          </span>
        </div>
      )}
    </div>
  )
}

// ── Connect trigger button ────────────────────────────────────────────────────
// Custom chip-style button — lighter visual weight than KDS Button for inline row use.
// Chevron rotates -90° (right) when collapsed, 0° (down) when expanded.

function ConnectTrigger({
  expanded,
  onClick,
}: {
  expanded: boolean
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)

  const shadow = focused
    ? `0px 0px 0px 2px var(--blue-400), ${SHADOW_CONNECT}`
    : hovered
      ? '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(59,54,50,0.3)'
      : SHADOW_CONNECT

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      aria-expanded={expanded}
      style={{
        display:         'flex',
        alignItems:      'center',
        gap:             4,
        padding:         '5px 8px',
        borderRadius:    8,
        border:          'none',
        backgroundColor: hovered ? 'var(--neutral-50)' : 'var(--neutral-white)',
        cursor:          'pointer',
        fontFamily:      'var(--font-body)',
        fontSize:        'var(--font-size-body)',
        fontWeight:      400,
        lineHeight:      'var(--line-height-body)',
        color:           'var(--neutral-700)',
        boxShadow:       shadow,
        flexShrink:      0,
        whiteSpace:      'nowrap',
        outline:         'none',
        transition:      'background-color 120ms, box-shadow 120ms',
      }}
    >
      Connect
      <motion.span
        animate={{ rotate: expanded ? 0 : -90 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        style={{ display: 'flex', lineHeight: 0 }}
      >
        <ArrowDownOneIcon size={14} color="var(--neutral-500)" />
      </motion.span>
    </button>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export const ConnectorRow = React.forwardRef<HTMLDivElement, ConnectorRowProps>(
  function ConnectorRow(
    {
      name             = '',
      description      = '',
      iconUrl,
      iconAlt,
      status           = 'not-connected',
      active           = false,
      onActiveChange,
      workspaceName    = '',
      accountLabel     = '',
      oauthTitle,
      oauthDescription = '',
      oauthCtaLabel,
      onOAuthCta,
      disabled         = false,
      asChild          = false,
      className,
      style,
      ...props
    },
    ref,
  ) {
    const Comp = (asChild ? Slot : 'div') as React.ElementType
    const [expanded, setExpanded] = useState(false)

    const handleConnectClick = useCallback(() => {
      setExpanded((prev) => !prev)
    }, [])

    const resolvedOauthTitle    = oauthTitle    ?? (name ? `Connect ${name}`          : 'Connect')
    const resolvedOauthCtaLabel = oauthCtaLabel ?? (name ? `Continue with ${name}`    : 'Connect')

    return (
      <Comp
        ref={ref}
        className={cn(className)}
        style={{
          display:       'flex',
          flexDirection: 'column',
          width:         '100%',
          opacity:       disabled ? 0.5 : 1,
          pointerEvents: disabled ? 'none' : undefined,
          ...style,
        }}
        {...props}
      >
        {/* ── Main row ─────────────────────────────────────────────────────── */}
        <div
          style={{
            display:      'flex',
            alignItems:   'center',
            gap:          12,
            height:       56,
            padding:      '0 12px',
            borderRadius: 12,
          }}
        >
          {/* Connector logo */}
          <ConnectorIcon iconUrl={iconUrl} iconAlt={iconAlt} name={name} />

          {/* Name + description */}
          <div
            style={{
              flex:          '1 1 0',
              display:       'flex',
              flexDirection: 'column',
              gap:           2,
              minWidth:      0,
            }}
          >
            <span
              style={{
                fontFamily:   'var(--font-body)',
                fontSize:     'var(--font-size-body)',
                fontWeight:   500,
                lineHeight:   'var(--line-height-body)',
                color:        'var(--neutral-800)',
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                whiteSpace:   'nowrap',
              }}
            >
              {name}
              {accountLabel && (
                <span style={{ fontWeight: 400, color: 'var(--neutral-500)' }}>
                  {' '}({accountLabel})
                </span>
              )}
            </span>
            {description && (
              <span
                style={{
                  fontFamily:   'var(--font-body)',
                  fontSize:     'var(--font-size-caption)',
                  fontWeight:   400,
                  lineHeight:   'var(--line-height-caption)',
                  color:        'var(--neutral-500)',
                  overflow:     'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace:   'nowrap',
                }}
              >
                {description}
              </span>
            )}
          </div>

          {/* Right affordance — varies by status */}
          {status === 'not-connected' && (
            <ConnectTrigger expanded={expanded} onClick={handleConnectClick} />
          )}

          {status === 'connected-personal' && (
            <div
              style={{
                display:    'flex',
                alignItems: 'center',
                gap:        8,
                flexShrink: 0,
              }}
            >
              <Badge
                label={active ? 'ON' : 'OFF'}
                color={active ? 'Yellow' : 'Neutral'}
              />
              <Switch
                checked={active}
                onCheckedChange={onActiveChange}
              />
            </div>
          )}

          {status === 'connected-workspace' && (
            <div
              style={{
                display:    'flex',
                alignItems: 'center',
                gap:        8,
                flexShrink: 0,
              }}
            >
              {/* Toggle affordance when the viewer can manage this shared account;
                  otherwise a read-only "Connected" badge with the workspace name. */}
              {onActiveChange ? (
                <>
                  <Badge
                    label={active ? 'ON' : 'OFF'}
                    color={active ? 'Yellow' : 'Neutral'}
                  />
                  <Switch
                    checked={active}
                    onCheckedChange={onActiveChange}
                  />
                </>
              ) : (
                <>
                  {workspaceName && (
                    <span
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize:   'var(--font-size-caption)',
                        fontWeight: 400,
                        lineHeight: 'var(--line-height-caption)',
                        color:      'var(--neutral-500)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {workspaceName}
                    </span>
                  )}
                  <Badge label="Connected" color="Neutral" />
                </>
              )}
            </div>
          )}
        </div>

        {/* ── OAuth expand panel (not-connected only) ───────────────────────── */}
        <AnimatePresence initial={false}>
          {status === 'not-connected' && expanded && (
            <motion.div
              key="oauth-panel"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              style={{ overflow: 'hidden' }}
            >
              <div
                style={{
                  display:         'flex',
                  flexDirection:   'column',
                  gap:             8,
                  padding:         '12px 14px 14px',
                  marginTop:       2,
                  borderRadius:    12,
                  backgroundColor: 'var(--neutral-50)',
                  boxShadow:       SHADOW_PANEL,
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize:   'var(--font-size-body)',
                    fontWeight: 500,
                    lineHeight: 'var(--line-height-body)',
                    color:      'var(--neutral-900)',
                  }}
                >
                  {resolvedOauthTitle}
                </span>

                {oauthDescription && (
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize:   'var(--font-size-caption)',
                      fontWeight: 400,
                      lineHeight: 'var(--line-height-caption)',
                      color:      'var(--neutral-500)',
                    }}
                  >
                    {oauthDescription}
                  </span>
                )}

                <div style={{ display: 'flex', marginTop: 4 }}>
                  <Button variant="default" size="sm" onClick={onOAuthCta}>
                    {resolvedOauthCtaLabel}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Comp>
    )
  },
)

ConnectorRow.displayName = 'ConnectorRow'
export default ConnectorRow
