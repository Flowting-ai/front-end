'use client'

import React, { useState } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { motion } from 'framer-motion'
import { MoreVerticalIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { ConnectorStatusBadge } from '@/components/ConnectorStatusBadge'
import type { ConnectorStatusType } from '@/components/ConnectorStatusBadge'
import { IconButton } from '@/components/IconButton'
import { springs } from '@/lib/springs'
import { cn } from '@/lib/utils'

// ── Shadows — exact values from ConnectorRow ──────────────────────────────────
const SHADOW_CARD = '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)'
const SHADOW_ICON = '0px 0px 0px 1px var(--neutral-100)'
const SHADOW_INNER = 'inset 0px 1px 0px 0px rgba(247,242,237,0.5), inset 0px -1px 0px 0px rgba(82,75,71,0.05)'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConnectorCardLayout   = 'grid' | 'row'
export type ConnectorCardAction   = 'connect' | 'manage' | 'request' | 'add' | 'disconnect'
export type ConnectorCategory     = 'Productivity' | 'Communication' | 'Design' | 'Interactive' | 'Data'

export interface ConnectorCardProps extends React.HTMLAttributes<HTMLDivElement> {
  name:         string
  description?: string
  category?:    ConnectorCategory
  iconUrl?:     string
  iconAlt?:     string
  /** Pass a ConnectorIcon element directly — takes priority over iconUrl */
  iconNode?:    React.ReactNode
  /** Drives which status badge is shown alongside the action button */
  status?:      ConnectorStatusType
  /**
   * grid — vertical card (icon top, description, button bottom)
   * row  — horizontal row (same as ConnectorRow)
   */
  layout?:      ConnectorCardLayout
  /** Primary CTA — drives button label and variant */
  action?:      ConnectorCardAction
  /** 'Private to you' pill — shown on per-member connectors */
  isPrivate?:   boolean
  onAction?:    () => void
  onMore?:      () => void
  disabled?:    boolean
  asChild?: boolean
}

const ACTION_CONFIG: Record<ConnectorCardAction, { label: string; variant: 'default' | 'outline' | 'ghost' }> = {
  connect:    { label: 'Connect',    variant: 'default'  },
  manage:     { label: 'Manage',     variant: 'outline'  },
  request:    { label: 'Request',    variant: 'default'  },
  add:        { label: '+ Add',      variant: 'outline'  },
  disconnect: { label: 'Disconnect', variant: 'outline'  },
}

// ── Connector icon box ────────────────────────────────────────────────────────

function ConnectorIcon({ iconUrl, iconAlt, iconNode, name, size = 44 }: { iconUrl?: string; iconAlt?: string; iconNode?: React.ReactNode; name: string; size?: number }) {
  return (
    <div
      style={{
        width:           size,
        height:          size,
        borderRadius:    8,
        backgroundColor: 'var(--neutral-white)',
        boxShadow:       SHADOW_ICON,
        flexShrink:      0,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        overflow:        'hidden',
      }}
    >
      {iconNode ? (
        iconNode
      ) : iconUrl ? (
        <img src={iconUrl} alt={iconAlt ?? name} style={{ width: size * 0.65, height: size * 0.65, objectFit: 'contain', display: 'block' }} />
      ) : (
        <div style={{ width: size * 0.6, height: size * 0.6, borderRadius: 4, backgroundColor: 'var(--neutral-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12, color: 'var(--neutral-500)' }}>
            {name.slice(0, 2).toUpperCase()}
          </span>
        </div>
      )}
    </div>
  )
}

// ── Private pill ──────────────────────────────────────────────────────────────

function PrivatePill() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 7px',
      borderRadius: 6, backgroundColor: 'var(--color-tag-Blue-bg)',
      fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11,
      color: 'var(--color-tag-Blue-text)', whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      Private to you
    </span>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export const ConnectorCard = React.forwardRef<HTMLDivElement, ConnectorCardProps>(
  function ConnectorCard(
    {
      name, description, category, iconUrl, iconAlt, iconNode,
      status, layout = 'grid', action = 'connect',
      isPrivate = false, onAction, onMore,
      disabled = false, asChild = false,
      className, style, ...props
    },
    ref,
  ) {
    const Comp    = (asChild ? Slot : 'div') as React.ElementType
    const [hov, setHov] = useState(false)
    const actionCfg = ACTION_CONFIG[action]

    // ── Grid layout ──────────────────────────────────────────────────────────
    if (layout === 'grid') {
      return (
        <Comp
          ref={ref}
          onMouseEnter={() => setHov(true)}
          onMouseLeave={() => setHov(false)}
          className={cn(className)}
          style={{
            position:        'relative',
            display:         'flex',
            flexDirection:   'column',
            gap:             10,
            padding:         14,
            borderRadius:    12,
            backgroundColor: 'var(--neutral-white)',
            boxShadow:       SHADOW_CARD,
            opacity:         disabled ? 0.5 : 1,
            pointerEvents:   disabled ? 'none' : undefined,
            ...style,
          }}
          {...props}
        >
          {/* Inner shadow — pointerEvents:none so it never intercepts button clicks */}
          <span aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', boxShadow: SHADOW_INNER, zIndex: 0 }} />

          {/* Header: icon + overflow menu */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative', zIndex: 0 }}>
            <ConnectorIcon iconUrl={iconUrl} iconAlt={iconAlt} iconNode={iconNode} name={name} size={44} />
            {onMore && (
              <motion.span
                animate={{ opacity: hov ? 1 : 0 }}
                transition={{ duration: 0.12 }}
              >
                <IconButton size="xs" variant="ghost" aria-label="More options" icon={<MoreVerticalIcon size={14} />} onClick={onMore} />
              </motion.span>
            )}
          </div>

          {/* Name + category */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '1 0 0' }}>
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-body)', lineHeight: 'var(--line-height-body)', color: 'var(--neutral-900)' }}>
              {name}
            </span>
            {category && (
              <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 'var(--font-size-caption)', color: 'var(--neutral-400)' }}>
                {category}
              </span>
            )}
            {description && (
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 'var(--font-size-caption)', lineHeight: 'var(--line-height-caption)', color: 'var(--neutral-500)', margin: '4px 0 0', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {description}
              </p>
            )}
          </div>

          {/* Footer: status badges + CTA */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {isPrivate && <PrivatePill />}
              {status && <ConnectorStatusBadge status={status} />}
            </div>
            {action && (
              <Button variant={actionCfg.variant} size="sm" onClick={onAction}>
                {actionCfg.label}
              </Button>
            )}
          </div>
        </Comp>
      )
    }

    // ── Row layout (reuses ConnectorRow DNA) ─────────────────────────────────
    return (
      <Comp
        ref={ref}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        className={cn(className)}
        style={{
          position:        'relative',
          display:         'flex',
          alignItems:      'center',
          gap:             12,
          padding:         '10px 14px',
          borderRadius:    12,
          backgroundColor: 'var(--neutral-white)',
          boxShadow:       SHADOW_CARD,
          opacity:         disabled ? 0.5 : 1,
          pointerEvents:   disabled ? 'none' : undefined,
          ...style,
        }}
        {...props}
      >
        <span aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', boxShadow: SHADOW_INNER, zIndex: 1 }} />
        <ConnectorIcon iconUrl={iconUrl} iconAlt={iconAlt} iconNode={iconNode} name={name} size={38} />
        <div style={{ flex: '1 0 0', minWidth: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-body)', color: 'var(--neutral-900)' }}>{name}</span>
            {isPrivate && <PrivatePill />}
          </div>
          {category && <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', color: 'var(--neutral-400)' }}>{category}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {status && <ConnectorStatusBadge status={status} />}
          {action && (
            <Button variant={actionCfg.variant} size="sm" onClick={onAction}>
              {actionCfg.label}
            </Button>
          )}
        </div>
      </Comp>
    )
  },
)

ConnectorCard.displayName = 'ConnectorCard'
export default ConnectorCard
