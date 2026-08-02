'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRightOneIcon, CancelOneIcon, AlertTwoIcon, AlertCircleIcon } from '@strange-huge/icons'
import { useCreditStatus } from '@/hooks/use-credit-status'
import { SETTINGS_BILLING_ROUTE } from '@/lib/routes'

// Individual credit/topup warning shown above the chat input:
//   • low       — ≥90% of credits used (dismissible)
//   • exhausted — credits gone; usage is hard-blocked until a topup (persistent)
//
// Distinct from InlineCreditNotice (which serves org/team workspace pools with
// admin/member CTAs). This one routes the user to buy a top-up.
//
// Same warning/error surface the KDS Toast uses (`--toast-{level}-*` in
// aliases.css, wired up for sonner in globals.css) — the semantic family
// meant for alert banners, as opposed to the `--color-tag-*` chip tokens
// which are sized for small pill labels.

// Mirrors `.kds-toast`'s elevation recipe (globals.css) — soft drop-shadow
// plus a hairline ring in the level's own border color, instead of a flat
// CSS border.
const elevation = (border: string) =>
  `0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 6px 16px -4px rgba(38,33,30,0.10), 0px 0px 0px 1px ${border}`

const LOW_CFG = {
  bg:      'var(--toast-warning-bg)',
  fg:      'var(--toast-warning-text)',
  border:  'var(--toast-warning-border)',
  Icon:    AlertTwoIcon,
  message: 'Running low on credits',
  cta:     'Buy credits',
} as const

const EXHAUSTED_CFG = {
  bg:      'var(--toast-error-bg)',
  fg:      'var(--toast-error-text)',
  border:  'var(--toast-error-border)',
  Icon:    AlertCircleIcon,
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
  const Icon = cfg.Icon

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
            gap:             10,
            padding:         '10px 14px',
            borderRadius:    'var(--toast-radius)',
            backgroundColor: cfg.bg,
            boxShadow:       elevation(cfg.border),
            margin:          '0 12px 8px',
          }}
        >
          <span style={{ display: 'flex', flexShrink: 0, color: cfg.fg }}>
            <Icon size={16} color={cfg.fg} />
          </span>

          <p style={{
            flex:       '1 0 0',
            minWidth:   0,
            fontFamily: 'var(--font-body)',
            fontWeight: 'var(--font-weight-medium)',
            fontSize:   'var(--font-size-body)',
            lineHeight: 'var(--line-height-body)',
            color:      cfg.fg,
            margin:     0,
          }}>
            {cfg.message}
          </p>

          <button
            type="button"
            onClick={() => router.push(SETTINGS_BILLING_ROUTE)}
            style={{
              display:      'inline-flex',
              alignItems:   'center',
              gap:          4,
              border:       'none',
              cursor:       'pointer',
              padding:      '4px 10px',
              borderRadius: 8,
              backgroundColor: cfg.fg,
              color:        cfg.bg,
              fontFamily:   'var(--font-body)',
              fontWeight:   'var(--font-weight-medium)',
              fontSize:     'var(--font-size-caption)',
              lineHeight:   'var(--line-height-caption)',
              flexShrink:   0,
            }}
          >
            {cfg.cta}
            <ArrowRightOneIcon size={13} color={cfg.bg} />
          </button>

          {dismissible && (
            <button
              type="button"
              onClick={() => setDismissedLow(true)}
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
      )}
    </AnimatePresence>
  )
}

CreditStatusBanner.displayName = 'CreditStatusBanner'
export default CreditStatusBanner
