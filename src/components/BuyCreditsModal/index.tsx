'use client'

import React, { useEffect, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Button } from '@/components/Button'
import { CardBrandLogo } from '@/components/CardBrandLogo'
import type { CardBrand } from '@/components/CardBrandLogo'
import { chargeTopUp, createTopUpSession, openBillingPortal, type BillingInfo } from '@/lib/api/user'
import { notifyCreditsUpdated } from '@/hooks/use-credit-status'
import { toast } from 'sonner'

const TITLE = 'var(--font-title)'
const BODY  = 'var(--font-body)'

const C = {
  ink:    'var(--neutral-900)',
  muted:  'var(--neutral-500)',
  border: 'var(--neutral-200)',
  hair:   'var(--neutral-100)',
  white:  'var(--neutral-white)',
} as const

const BLUE_700 = '#135487'

const PRESETS = [2, 5, 10] as const

const MAX_USD = 100

function fmtUsd(n: number) {
  return n % 1 === 0 ? `$${n}` : `$${n.toFixed(2)}`
}

const summaryText: React.CSSProperties = {
  fontFamily: BODY, fontWeight: 500, fontSize: 13, lineHeight: '18px',
  color: 'var(--neutral-900)', margin: 0, whiteSpace: 'nowrap',
}

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.28)',
  backdropFilter: 'blur(2px)',
  zIndex: 9998,
}

const modalWrapStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  margin: 'auto',
  width: '100%',
  maxWidth: 520,
  height: 'fit-content',
  zIndex: 9999,
  backgroundColor: '#f7f2ed',
  borderRadius: 20,
  padding: 8,
  boxShadow: '0px 19px 32px 0px rgba(18,12,8,0.15), 0px 2px 2.8px 0px rgba(130,122,116,0.1)',
}

export interface BuyCreditsModalProps {
  open:      boolean
  onClose:   () => void
  billing:   BillingInfo | null
  onSuccess: () => void
}

export function BuyCreditsModal({ open, onClose, billing, onSuccess }: BuyCreditsModalProps) {
  const [selected, setSelected] = useState(0)   // preset index; -1 = custom
  const [custom,   setCustom]   = useState('')
  const [paying,   setPaying]   = useState(false)
  const [openingPortal, setOpeningPortal] = useState(false)

  // Reset to first preset whenever modal opens
  useEffect(() => {
    if (open) { setSelected(0); setCustom('') }
  }, [open])

  const pm       = billing?.payment_method ?? null
  const isCustom = selected === -1
  const usd      = isCustom ? (parseFloat(custom) || 0) : (PRESETS[selected] ?? 0)
  const canPay   = usd > 0 && usd <= MAX_USD

  function pickPreset(idx: number) {
    setSelected(idx)
    setCustom('')
  }

  function onCustomChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) {
      const n = parseFloat(v)
      if (v === '' || isNaN(n) || n <= MAX_USD) {
        setSelected(-1)
        setCustom(v)
      }
    }
  }

  async function handlePay() {
    if (!canPay || paying) return
    setPaying(true)
    try {
      if (pm) {
        const res = await chargeTopUp(usd)
        if (res.status === 'succeeded' || res.status === 'ok') {
          toast.success('Credits added successfully!')
          // Refresh credits app-wide (chat gate, banners, sidebar) without a reload.
          notifyCreditsUpdated()
          onSuccess()
          onClose()
          return
        }
      }
      const session = await createTopUpSession(usd)
      document.cookie = 'souvenir_checkout_complete=1; path=/; max-age=3600; SameSite=Lax'
      window.location.href = session.checkout_url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Payment failed')
    } finally {
      setPaying(false)
    }
  }

  async function handleEditPayment() {
    if (openingPortal) return
    setOpeningPortal(true)
    try {
      const url = await openBillingPortal()
      if (url) window.location.href = url
      else toast.error('Could not open the billing portal')
    } catch {
      toast.error('Could not open the billing portal')
    } finally {
      setOpeningPortal(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <m.div
            key="buy-credits-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={backdropStyle}
            // eslint-disable-next-line click-events-have-key-events, no-static-element-interactions
            onClick={onClose}
          />

          {/* Modal card */}
          <m.div
            key="buy-credits-modal"
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            style={modalWrapStyle}
          >
            {/* Scrollable body */}
            <div
              className="kaya-scrollbar"
              style={{
                overflowY: 'auto',
                maxHeight: 'calc(100dvh - 64px)',
                padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
              }}
            >
              {/* ── Header ── */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                borderBottom: `1px solid ${C.hair}`,
                padding: '10px 12px 16px',
              }}>
                <p style={{
                  flex: '1 0 0', minWidth: 0, margin: 0,
                  fontFamily: TITLE, fontWeight: 400, fontSize: 18, lineHeight: '24px',
                  color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  Buy more credits
                </p>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 28, height: 28, flexShrink: 0, borderRadius: 8,
                    border: 'none', backgroundColor: 'transparent',
                    cursor: 'pointer', color: C.muted, padding: 4,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
                    <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {/* ── Body sections ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                {/* Description */}
                <div style={{ padding: '4px 12px 8px' }}>
                  <p style={{
                    fontFamily: BODY, fontWeight: 400, fontSize: 12, lineHeight: '18px',
                    color: '#827a74', margin: 0,
                  }}>
                    Top up your credits instantly. Unused credits roll over to your next billing cycle.
                  </p>
                </div>

                {/* Preset cards + custom input */}
                <div style={{
                  border: `1px solid ${C.border}`, borderRadius: 14, padding: 10,
                  display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {PRESETS.map((amt, idx) => {
                      const sel = selected === idx
                      return (
                        <button
                          key={amt}
                          onClick={() => pickPreset(idx)}
                          style={{
                            flex: '1 0 0', minWidth: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: '10px 8px', borderRadius: 8, cursor: 'pointer',
                            backgroundColor: C.white, border: 'none',
                            boxShadow: sel
                              ? '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 2px var(--neutral-900)'
                              : '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
                            transition: 'box-shadow 120ms',
                          }}
                        >
                          <p style={{
                            fontFamily: TITLE, fontWeight: 400, fontSize: 18, lineHeight: '24px',
                            color: BLUE_700, margin: 0,
                          }}>
                            ${amt}
                          </p>
                        </button>
                      )
                    })}
                  </div>

                  {/* Custom "Other" input */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label
                      htmlFor="buy-credits-custom"
                      style={{
                        fontFamily: BODY, fontWeight: 400, fontSize: 12, lineHeight: '16px',
                        color: 'var(--neutral-700, #524b47)',
                      }}
                    >
                      Other
                    </label>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 2,
                      backgroundColor: C.white, padding: '6px 10px', borderRadius: 8,
                      boxShadow: isCustom && custom !== ''
                        ? '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 2px var(--neutral-900)'
                        : '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
                      transition: 'box-shadow 120ms',
                    }}>
                      <span style={{
                        fontFamily: BODY, fontWeight: 400, fontSize: 13, lineHeight: '18px',
                        color: custom ? C.ink : 'var(--neutral-600, #6a625d)',
                        paddingLeft: 2, flexShrink: 0,
                      }}>
                        $
                      </span>
                      <input
                        id="buy-credits-custom"
                        type="text"
                        inputMode="decimal"
                        placeholder="Amount"
                        value={custom}
                        onChange={onCustomChange}
                        onFocus={() => { if (selected !== -1) setSelected(-1) }}
                        style={{
                          flex: '1 0 0', minWidth: 0,
                          border: 'none', outline: 'none',
                          backgroundColor: 'transparent',
                          fontFamily: BODY, fontWeight: 400, fontSize: 13, lineHeight: '18px',
                          color: C.ink, padding: '0 2px',
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Order summary — total due only */}
                <div style={{ border: `1px solid ${C.border}`, borderRadius: 14 }}>
                  <div style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <p style={{ ...summaryText, flex: '1 0 0', minWidth: 0 }}>Total due</p>
                    <p style={summaryText}>{usd > 0 ? fmtUsd(usd) : '—'}</p>
                  </div>
                </div>

                {/* Payment method */}
                <div style={{ border: `1px solid ${C.border}`, borderRadius: 14 }}>
                  <div style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <p style={{
                      ...summaryText, flex: '1 0 0', minWidth: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      Payment method
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <CardBrandLogo brand={(pm?.brand as CardBrand) || 'unknown'} width={46} height={32} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <p style={{
                          fontFamily: BODY, fontWeight: 500, fontSize: 13, lineHeight: '18px',
                          color: C.ink, margin: 0,
                        }}>
                          {pm?.last4 ? `Card ending in ${pm.last4}` : 'No card on file'}
                        </p>
                        {pm?.exp_month && pm?.exp_year && (
                          <p style={{
                            fontFamily: BODY, fontWeight: 400, fontSize: 11, lineHeight: '16px',
                            color: 'var(--neutral-500, #827a74)', margin: 0,
                          }}>
                            Expiry {String(pm.exp_month).padStart(2, '0')}/{pm.exp_year}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      aria-label="Edit payment method"
                      onClick={() => { void handleEditPayment() }}
                      disabled={openingPortal}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 32, height: 32, flexShrink: 0, borderRadius: 8,
                        border: 'none', backgroundColor: 'transparent',
                        cursor: openingPortal ? 'default' : 'pointer',
                        color: C.muted, padding: 6,
                        opacity: openingPortal ? 0.5 : 1,
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
                        <path
                          d="M14.5 2.5a2.121 2.121 0 0 1 3 3L6 17l-4 1 1-4L14.5 2.5z"
                          stroke="currentColor" strokeWidth="1.5"
                          strokeLinecap="round" strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Footer ── */}
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 8,
                paddingTop: 16, paddingBottom: 8,
              }}>
                <Button
                  variant="default"
                  size="sm"
                  fluid
                  loading={paying}
                  disabled={!canPay}
                  onClick={() => { void handlePay() }}
                >
                  {canPay ? `Pay ${fmtUsd(usd)} now` : 'Pay now'}
                </Button>
                <p style={{
                  fontFamily: BODY, fontWeight: 400, fontSize: 11, lineHeight: '16px',
                  color: '#827a74', margin: 0,
                }}>
                  By clicking Pay now, you allow Souvenir to charge your card in the amount above.
                </p>
              </div>
            </div>
          </m.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default BuyCreditsModal
