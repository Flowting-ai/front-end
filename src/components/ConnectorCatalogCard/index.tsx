'use client'

import { Tooltip } from '@/components/Tooltip'
import React from 'react'
import { PlusSignIcon } from '@strange-huge/icons'
import { Badge } from '@/components/Badge'
import type { BadgeColor } from '@/components/Badge'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { highlightMatch } from '@/lib/highlightMatch'
import { cn } from '@/lib/utils'

export type ConnectorCatalogCardDensity = 'compact' | 'detailed'
export type ConnectorCatalogCardState =
  | 'available'
  | 'connected'
  | 'reconnect-required'
  | 'unavailable'
  | 'loading'
  | 'error'
export type ConnectorCatalogCardAction = 'none' | 'icon-add' | 'connect' | 'reconnect' | 'manage'

export interface ConnectorCatalogCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  name: string
  description?: string
  /** The catalog category, as a caption between the name and the description. */
  category?: string
  icon?: React.ReactNode
  iconUrl?: string
  iconAlt?: string
  density?: ConnectorCatalogCardDensity
  state?: ConnectorCatalogCardState
  action?: ConnectorCatalogCardAction
  accountCount?: number
  /** Search query to bold within `name` (e.g. the catalog's active search box). */
  highlight?: string
  onAction?: () => void
  /** True while `onAction`'s request is in flight (e.g. fetching connector
   *  details before opening its setup modal) — shows a spinner on the
   *  action button/icon and blocks re-triggering it. */
  actionPending?: boolean
}

const allowedActions: Record<ConnectorCatalogCardState, ConnectorCatalogCardAction[]> = {
  available: ['none', 'icon-add', 'connect'],
  connected: ['none', 'manage'],
  'reconnect-required': ['none', 'reconnect'],
  unavailable: ['none'],
  loading: ['none'],
  error: ['none', 'connect'],
}

function actionCopy(state: ConnectorCatalogCardState, action: ConnectorCatalogCardAction) {
  if (action === 'manage') return 'Manage'
  if (action === 'reconnect') return 'Reconnect'
  if (state === 'error') return 'Try again'
  return 'Connect'
}

/** Status text plus the Badge colour that carries it. Badge owns its own tokens, so
 *  every status reads from one tier instead of three hand-picked tag families. */
function status(
  state: ConnectorCatalogCardState,
  density: ConnectorCatalogCardDensity,
  accountCount: number,
): { label: string; color: BadgeColor } | null {
  switch (state) {
    case 'connected':
      if (density === 'detailed') {
        return accountCount > 1 ? { label: `${accountCount} accounts`, color: 'Green' } : null
      }
      return {
        label: `${accountCount} ${accountCount === 1 ? 'account' : 'accounts'} connected`,
        color: 'Green',
      }
    case 'reconnect-required':
      return { label: 'Reconnect required', color: 'Yellow' }
    case 'unavailable':
      return { label: 'Unavailable', color: 'Neutral' }
    case 'error':
      return { label: "Couldn't load connector", color: 'Red' }
    default:
      return null
  }
}

const SKELETON_BG = 'var(--color-surface-badge, var(--neutral-100))'

export function ConnectorCatalogCard({
  name,
  description,
  category,
  icon,
  iconUrl,
  iconAlt = '',
  density = 'detailed',
  state = 'available',
  action = 'none',
  accountCount = 1,
  highlight,
  onAction,
  actionPending = false,
  className,
  style,
  title,
  ...props
}: ConnectorCatalogCardProps) {
  const resolvedAction =
    density === 'compact' || !allowedActions[state].includes(action) ? 'none' : action
  const badge = status(state, density, accountCount)
  const isLoading = state === 'loading'
  const isCompact = density === 'compact'
  const logoSize = isCompact ? 40 : 36
  const artworkSize = isCompact ? '100%' : 32

  return (
    <Tooltip content={title} disabled={!title} maxWidth={280}><div
      className={cn(className)}
      style={{
        boxSizing: 'border-box',
        display: 'flex',
        width: '100%',
        minWidth: 0,
        alignItems: 'center',
        gap: isCompact ? 8 : 12,
        padding: isCompact ? '10px 12px' : '12px 14px',
        background: 'var(--card-bg)',
        borderRadius: isCompact ? 16 : 14,
        boxShadow: 'var(--shadow-surface-card, 0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-200))',
        color: 'var(--color-text-default)',
        fontFamily: 'var(--font-body)',
        opacity: state === 'unavailable' ? 0.5 : 1,
        ...style,
      }}
      aria-busy={isLoading || undefined}
      aria-label={isLoading ? `Loading ${name}` : undefined}
      {...props}
    >
      {/* 36/40px tile holding 32px artwork — the tile is the touch target, the artwork is the mark. */}
      <div
        aria-hidden={iconAlt === '' || undefined}
        style={{
          display: 'grid',
          flex: '0 0 auto',
          placeItems: 'center',
          borderRadius: isCompact ? 10 : 12,
          width: logoSize,
          height: logoSize,
        }}
      >
        {/* No plate behind the mark — provider logos carry their own shape. */}
        <div
          style={{
            display: 'grid',
            overflow: 'hidden',
            placeItems: 'stretch',
            borderRadius: isCompact ? 10 : 6,
            width: artworkSize,
            height: artworkSize,
          }}
        >
          {isLoading ? (
            <span className="kaya-skeleton" style={{ display: 'block', width: '100%', height: '100%', borderRadius: 6, background: SKELETON_BG }} />
          ) : iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- provider-hosted logo_url
            <img
              src={iconUrl}
              alt={iconAlt}
              style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            icon ?? (
              <span
                style={{
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 'var(--font-size-body)',
                  fontWeight: 'var(--font-weight-semibold)',
                }}
              >
                {name.slice(0, 1)}
              </span>
            )
          )}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          minWidth: 0,
          flex: '1 1 auto',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        {isLoading ? (
          <>
            <span className="kaya-skeleton" style={{ display: 'block', width: 120, height: 14, borderRadius: 4, background: SKELETON_BG }} />
            <span className="kaya-skeleton" style={{ display: 'block', width: 80, height: 10, borderRadius: 4, background: SKELETON_BG }} />
          </>
        ) : (
          <>
            <span
              style={{
                maxWidth: '100%',
                overflow: 'hidden',
                fontSize: 'var(--font-size-body)',
                fontWeight: 'var(--font-weight-medium)',
                lineHeight: 'var(--line-height-body)',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {highlight ? highlightMatch(name, highlight, 'background') : name}
            </span>
            {category && density === 'detailed' && (
              <span
                style={{
                  color: 'var(--neutral-400)',
                  fontSize: 'var(--font-size-caption)',
                  lineHeight: 'var(--line-height-caption)',
                }}
              >
                {category}
              </span>
            )}
            {badge ? (
              <Badge label={badge.label} color={badge.color} />
            ) : description && density === 'detailed' ? (
              <Tooltip content={description} maxWidth={280}><span
                style={{
                  maxWidth: '100%',
                  overflow: 'hidden',
                  color: 'var(--color-text-placeholder)',
                  fontSize: 'var(--font-size-caption)',
                  fontWeight: 'var(--font-weight-regular)',
                  lineHeight: 'var(--line-height-caption)',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {description}
              </span></Tooltip>
            ) : null}
          </>
        )}
      </div>

      {resolvedAction === 'icon-add' ? (
        <IconButton
          variant="ghost"
          size="xs"
          aria-label={`Connect ${name}`}
          icon={<PlusSignIcon size={16} />}
          onClick={onAction}
          loading={actionPending}
          disabled={actionPending}
        />
      ) : resolvedAction !== 'none' ? (
        <Button
          variant="outline"
          size="sm"
          aria-label={`${actionCopy(state, resolvedAction)} ${name}`}
          onClick={onAction}
          loading={actionPending}
          disabled={actionPending}
        >
          {actionCopy(state, resolvedAction)}
        </Button>
      ) : null}
    </div></Tooltip>
  )
}

ConnectorCatalogCard.displayName = 'ConnectorCatalogCard'
export default ConnectorCatalogCard
