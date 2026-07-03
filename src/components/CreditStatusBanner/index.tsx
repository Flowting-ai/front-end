'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRightOneIcon, CancelOneIcon } from '@strange-huge/icons'
import { useCreditStatus } from '@/hooks/use-credit-status'
import { SETTINGS_BILLING_ROUTE } from '@/lib/routes'

// Individual credit/topup warning shown above the chat input:
//   • low       — ≥90% of credits used (dismissible)
//   • exhausted — credits gone; usage is hard-blocked until a topup (persistent)
//
// Distinct from InlineCreditNotice (which serves org/team workspace pools with
// admin/member CTAs). This one routes the user to buy a top-up.

const LOW_CFG = {
  bg:      'var(--color-tag-Yellow-bg-soft)',
  fg:      'var(--color-tag-Yellow-text)',
  message: 'Running low on credits',
  cta:     'Buy credits',
} as const

const EXHAUSTED_CFG = {
  bg:      'var(--color-tag-Red-bg-soft)',
  fg:      'var(--color-tag-Red-text)',
  message: 'Credits exhausted · buy a top-up to keep using Souvenir',
  cta:     'Buy credits',
} as const

export function CreditStatusBanner({ suppress = false }: { suppress?: boolean } = {}) {
  const { level } = useCreditStatus()
  const router = useRouter()
  const [dismissedLow, setDismissedLow] = useState(false)

  // Re-arm the dismissible low warning if the user drops back to normal
  // (e.g. after a topup) so it can show again next time they run low.
  useEffect(() => {
    if (level === 'normal') setDismissedLow(false)
  }, [level])

  // `suppress` hides the banner entirely — e.g. when chatting with a Super Link
  // agent billed to the sharer, where this user's own exhaustion is irrelevant.
  const visible = !suppress &&
    (level === 'exhausted' || (level === 'low' && !dismissedLow))
  const cfg = level === 'exhausted' ? EXHAUSTED_CFG : LOW_CFG
  const dismissible = level === 'low'

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={level}
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
            border:          `1px solid ${cfg.fg}`,
            margin:          '0 12px 8px',
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: cfg.fg, flexShrink: 0 }} />

          <p style={{
            flex:       '1 0 0',
            minWidth:   0,
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize:   13,
            lineHeight: '20px',
            color:      cfg.fg,
            margin:     0,
          }}>
            {cfg.message}
          </p>

          <button
            type="button"
            onClick={() => router.push(SETTINGS_BILLING_ROUTE)}
            style={{
              display:        'inline-flex',
              alignItems:     'center',
              gap:            4,
              background:     'none',
              border:         'none',
              cursor:         'pointer',
              padding:        '2px 0',
              fontFamily:     'var(--font-body)',
              fontWeight:     500,
              fontSize:       13,
              color:          cfg.fg,
              textDecoration: 'underline',
              flexShrink:     0,
            }}
          >
            {cfg.cta}
            <ArrowRightOneIcon size={14} />
          </button>

          {dismissible && (
            <button
              type="button"
              onClick={() => setDismissedLow(true)}
              aria-label="Dismiss notice"
              style={{
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                background:     'none',
                border:         'none',
                cursor:         'pointer',
                padding:        2,
                color:          cfg.fg,
                opacity:        0.6,
                flexShrink:     0,
                borderRadius:   4,
              }}
            >
              <CancelOneIcon size={14} />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

CreditStatusBanner.displayName = 'CreditStatusBanner'
export default CreditStatusBanner
