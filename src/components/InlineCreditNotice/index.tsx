'use client'

import React from 'react'
import { ArrowRightOneIcon, CancelOneIcon, AlertTwoIcon, AlertCircleIcon } from '@strange-huge/icons'
import { motion } from 'framer-motion'

export type CreditNoticeStatus = 'warning_95' | 'grace' | 'locked'

export interface InlineCreditNoticeProps {
  status:               CreditNoticeStatus
  graceDaysRemaining?:  number
  isAdmin?:             boolean
  onAdminAction?:       () => void
  onDismiss?:           () => void
}

// Same warning/error surface the KDS Toast uses (`--toast-{level}-*` in
// aliases.css, wired up for sonner in globals.css) — the semantic family
// meant for alert banners, as opposed to the `--color-tag-*` chip tokens
// which are sized for small pill labels.
type Level = 'warning' | 'error'

const LEVEL_TOKENS: Record<Level, { bg: string; text: string; border: string; Icon: typeof AlertTwoIcon }> = {
  warning: { bg: 'var(--toast-warning-bg)', text: 'var(--toast-warning-text)', border: 'var(--toast-warning-border)', Icon: AlertTwoIcon },
  error:   { bg: 'var(--toast-error-bg)',   text: 'var(--toast-error-text)',   border: 'var(--toast-error-border)',   Icon: AlertCircleIcon },
}

// Mirrors `.kds-toast`'s elevation recipe (globals.css) — soft drop-shadow
// plus a hairline ring in the level's own border color, instead of a flat
// CSS border.
const elevation = (border: string) =>
  `0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 6px 16px -4px rgba(38,33,30,0.10), 0px 0px 0px 1px ${border}`

interface NoticeConfig {
  level:     Level
  message:   (days?: number) => string
  adminCta:  string
  memberCta: string
}

const NOTICE_CONFIG: Record<CreditNoticeStatus, NoticeConfig> = {
  warning_95: {
    level:     'warning',
    message:   () => 'Running low on credits',
    adminCta:  'View usage',
    memberCta: 'Contact admin',
  },
  grace: {
    level:     'error',
    message:   (days) => `Access limited · ${days ?? 0} day${days === 1 ? '' : 's'} to add credits`,
    adminCta:  'Add credits',
    memberCta: 'Contact admin',
  },
  locked: {
    level:     'error',
    message:   () => 'Workspace locked · no new activity until credits are added',
    adminCta:  'Unlock',
    memberCta: 'Contact your admin',
  },
}

export function InlineCreditNotice({
  status,
  graceDaysRemaining,
  isAdmin = false,
  onAdminAction,
  onDismiss,
}: InlineCreditNoticeProps) {
  const cfg = NOTICE_CONFIG[status]
  const tokens = LEVEL_TOKENS[cfg.level]
  const dismissible = status !== 'locked'
  const Icon = tokens.Icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } }}
      exit={{ opacity: 0, y: 4, transition: { duration: 0.12 } }}
      style={{
        display:         'flex',
        alignItems:      'center',
        gap:             10,
        padding:         '10px 14px',
        borderRadius:    'var(--toast-radius)',
        backgroundColor: tokens.bg,
        boxShadow:       elevation(tokens.border),
        margin:          '0 12px 8px',
      }}
    >
      {/* Icon */}
      <span style={{ display: 'flex', flexShrink: 0, color: tokens.text }}>
        <Icon size={16} color={tokens.text} />
      </span>

      {/* Message */}
      <p style={{
        flex:       '1 0 0',
        minWidth:   0,
        fontFamily: 'var(--font-body)',
        fontWeight: 'var(--font-weight-medium)',
        fontSize:   'var(--font-size-body)',
        lineHeight: 'var(--line-height-body)',
        color:      tokens.text,
        margin:     0,
      }}>
        {cfg.message(graceDaysRemaining)}
      </p>

      {/* CTA */}
      {isAdmin ? (
        <button
          type="button"
          onClick={onAdminAction}
          style={{
            display:      'inline-flex',
            alignItems:   'center',
            gap:          4,
            border:       'none',
            cursor:       'pointer',
            padding:      '4px 10px',
            borderRadius: 8,
            backgroundColor: tokens.text,
            color:        tokens.bg,
            fontFamily:   'var(--font-body)',
            fontWeight:   'var(--font-weight-medium)',
            fontSize:     'var(--font-size-caption)',
            lineHeight:   'var(--line-height-caption)',
            flexShrink:   0,
          }}
        >
          {cfg.adminCta}
          <ArrowRightOneIcon size={13} color={tokens.bg} />
        </button>
      ) : (
        <span style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 'var(--font-weight-regular)',
          fontSize:   'var(--font-size-caption)',
          lineHeight: 'var(--line-height-caption)',
          color:      tokens.text,
          opacity:    0.75,
          flexShrink: 0,
        }}>
          {cfg.memberCta}
        </span>
      )}

      {/* Dismiss — same treatment as the KDS Toast close button */}
      {dismissible && onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notice"
          style={{
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            width:           22,
            height:          22,
            border:          'none',
            borderRadius:    7,
            backgroundColor: 'var(--neutral-white)',
            color:           'var(--neutral-600)',
            boxShadow:       '0px 1px 2px rgba(0,0,0,0.08), inset 0px 1px 0px rgba(255,255,255,0.9)',
            cursor:          'pointer',
            flexShrink:      0,
            padding:         0,
          }}
        >
          <CancelOneIcon size={13} />
        </button>
      )}
    </motion.div>
  )
}

InlineCreditNotice.displayName = 'InlineCreditNotice'
export default InlineCreditNotice
