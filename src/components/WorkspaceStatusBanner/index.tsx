'use client'

import React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'
import { Button } from '@/components/Button'

// ── Types ─────────────────────────────────────────────────────────────────────

export type TokenStatus = 'warning_95' | 'grace' | 'locked'

export interface WorkspaceStatusBannerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Which exhaustion state to render — controls copy, color, and CTAs */
  tokenStatus: TokenStatus
  /**
   * For grace state: how many days until workspace locks.
   * Shown as "X days remaining".
   */
  graceDaysRemaining?: number
  /** When true, shows the Admin CTA ("Add credits" / "Unlock"). Members see "Contact your admin." */
  isAdmin?: boolean
  /** Fires when the Admin CTA is clicked */
  onAdminAction?: () => void
  asChild?: boolean
}

// ── Config ────────────────────────────────────────────────────────────────────

interface BannerConfig {
  dotColor:   string
  textColor:  string
  message:    (days?: number) => string
  adminCta:   string
  memberNote: string
}

const BANNER_CONFIG: Record<TokenStatus, BannerConfig> = {
  warning_95: {
    dotColor:   'var(--color-tag-Yellow-text)',
    textColor:  'var(--color-tag-Yellow-text)',
    message:    () => 'Your workspace is running low on credits.',
    adminCta:   'View usage →',
    memberNote: 'Contact your admin to add credits.',
  },
  grace: {
    dotColor:   'var(--color-tag-Red-text)',
    textColor:  'var(--color-tag-Red-text)',
    message:    (days) => `Workspace access is limited — ${days != null ? `${days} day${days !== 1 ? 's' : ''} to add credits` : 'add credits to restore access'}.`,
    adminCta:   'Add credits',
    memberNote: 'Contact your admin.',
  },
  locked: {
    dotColor:   'var(--color-tag-Red-text)',
    textColor:  'var(--color-tag-Red-text)',
    message:    () => 'Workspace is locked. No new activity until credits are added.',
    adminCta:   'Unlock workspace',
    memberNote: 'Contact your admin.',
  },
}

// ── Component ─────────────────────────────────────────────────────────────────

export const WorkspaceStatusBanner = React.forwardRef<HTMLDivElement, WorkspaceStatusBannerProps>(
  function WorkspaceStatusBanner(
    {
      tokenStatus,
      graceDaysRemaining,
      isAdmin = false,
      onAdminAction,
      asChild = false,
      className,
      style,
      ...props
    },
    ref,
  ) {
    const Comp = (asChild ? Slot : 'div') as React.ElementType
    const cfg  = BANNER_CONFIG[tokenStatus]

    return (
      <Comp
        ref={ref}
        role="status"
        aria-live="polite"
        className={cn(className)}
        style={{
          display:         'flex',
          alignItems:      'center',
          gap:             10,
          padding:         '8px 16px',
          borderRadius:    10,
          flexShrink:      0,
          width:           '100%',
          boxSizing:       'border-box' as const,
          ...style,
        }}
        {...props}
      >
        {/* Pulsing status dot */}
        <span
          aria-hidden
          style={{
            display:         'inline-flex',
            width:           7,
            height:          7,
            borderRadius:    '50%',
            backgroundColor: cfg.dotColor,
            flexShrink:      0,
          }}
        />

        {/* Message */}
        <span
          style={{
            flex:       '1 0 0',
            minWidth:   1,
            fontFamily: 'var(--font-body)',
            fontWeight: 'var(--font-weight-medium)',
            fontSize:   'var(--font-size-caption)',
            lineHeight: 'var(--line-height-caption)',
            color:      cfg.textColor,
          }}
        >
          {cfg.message(graceDaysRemaining)}
        </span>

        {/* CTA or note */}
        {isAdmin ? (
          <Button variant="secondary" size="sm" onClick={onAdminAction} style={{ flexShrink: 0 }}>
            {cfg.adminCta}
          </Button>
        ) : (
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 'var(--font-weight-regular)',
              fontSize:   'var(--font-size-body)',
              lineHeight: 'var(--line-height-body)',
              color:      cfg.textColor,
              opacity:    0.75,
              flexShrink: 0,
            }}
          >
            {cfg.memberNote}
          </span>
        )}
      </Comp>
    )
  },
)

WorkspaceStatusBanner.displayName = 'WorkspaceStatusBanner'
export default WorkspaceStatusBanner
