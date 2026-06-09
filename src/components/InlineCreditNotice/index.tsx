'use client'

import React from 'react'
import { ArrowRightOneIcon, CancelOneIcon } from '@strange-huge/icons'
import { motion } from 'framer-motion'

export type CreditNoticeStatus = 'warning_95' | 'grace' | 'locked'

export interface InlineCreditNoticeProps {
  status:               CreditNoticeStatus
  graceDaysRemaining?:  number
  isAdmin?:             boolean
  onAdminAction?:       () => void
  onDismiss?:           () => void
}

interface NoticeConfig {
  bg:       string
  border:   string
  dot:      string
  text:     string
  message:  (days?: number) => string
  adminCta: string
  memberCta: string
}

const NOTICE_CONFIG: Record<CreditNoticeStatus, NoticeConfig> = {
  warning_95: {
    bg:       'var(--color-tag-Yellow-bg-soft)',
    border:   'var(--color-tag-Yellow-text)',
    dot:      'var(--color-tag-Yellow-text)',
    text:     'var(--color-tag-Yellow-text)',
    message:  () => 'Running low on credits',
    adminCta: 'View usage',
    memberCta: 'Contact admin',
  },
  grace: {
    bg:       'var(--color-tag-Red-bg-soft)',
    border:   'var(--color-tag-Red-text)',
    dot:      'var(--color-tag-Red-text)',
    text:     'var(--color-tag-Red-text)',
    message:  (days) => `Access limited · ${days ?? 0} day${days === 1 ? '' : 's'} to add credits`,
    adminCta: 'Add credits',
    memberCta: 'Contact admin',
  },
  locked: {
    bg:       'var(--color-tag-Red-bg-soft)',
    border:   'var(--color-tag-Red-text)',
    dot:      'var(--color-tag-Red-text)',
    text:     'var(--color-tag-Red-text)',
    message:  () => 'Workspace locked · no new activity until credits are added',
    adminCta: 'Unlock',
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
  const dismissible = status !== 'locked'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } }}
      exit={{ opacity: 0, y: 4, transition: { duration: 0.12 } }}
      style={{
        display:         'flex',
        alignItems:      'center',
        gap:             8,
        padding:         '8px 12px',
        borderRadius:    10,
        backgroundColor: cfg.bg,
        border:          `1px solid ${cfg.border}`,
        margin:          '0 12px 8px',
      }}
    >
      {/* Status dot */}
      <span style={{
        width:           6,
        height:          6,
        borderRadius:    '50%',
        backgroundColor: cfg.dot,
        flexShrink:      0,
      }} />

      {/* Message */}
      <p style={{
        flex:       '1 0 0',
        minWidth:   0,
        fontFamily: 'var(--font-body)',
        fontWeight: 400,
        fontSize:   13,
        lineHeight: '20px',
        color:      cfg.text,
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
            display:    'inline-flex',
            alignItems: 'center',
            gap:        4,
            background: 'none',
            border:     'none',
            cursor:     'pointer',
            padding:    '2px 0',
            fontFamily: 'var(--font-body)',
            fontWeight: 500,
            fontSize:   13,
            color:      cfg.text,
            textDecoration: 'underline',
            flexShrink: 0,
          }}
        >
          {cfg.adminCta}
          <ArrowRightOneIcon size={14} />
        </button>
      ) : (
        <span style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 400,
          fontSize:   13,
          color:      cfg.text,
          opacity:    0.7,
          flexShrink: 0,
        }}>
          {cfg.memberCta}
        </span>
      )}

      {/* Dismiss */}
      {dismissible && onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notice"
          style={{
            display:    'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border:     'none',
            cursor:     'pointer',
            padding:    2,
            color:      cfg.text,
            opacity:    0.6,
            flexShrink: 0,
            borderRadius: 4,
          }}
        >
          <CancelOneIcon size={14} />
        </button>
      )}
    </motion.div>
  )
}

InlineCreditNotice.displayName = 'InlineCreditNotice'
export default InlineCreditNotice
