'use client'

import React, { useEffect, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Button } from '@/components/Button'
import { CardBrandLogo } from '@/components/CardBrandLogo'
import type { CardBrand } from '@/components/CardBrandLogo'
import { chargeTopUp, createTopUpSession, openBillingPortal, type BillingInfo } from '@/lib/api/user'
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

const PRESETS = [
  { usd: 2,  credits: 1_000, label: 'Basic'     },
  { usd: 5,  credits: 2_500, label: 'Popular'   },
  { usd: 10, credits: 5_500, label: 'Best value' },
] as const

const CREDITS_PER_DOLLAR = 500
const MAX_USD = 100

function fmtNum(n: number) {
  return n.toLocaleString('en-US')
}

function fmtUsd(n: number) {
  return n % 1 === 0 ? `$${n}` : `$${n.toFixed(2)}`
}

const summaryText: React.CSSProperties = {
  fontFamily: BODY, fontWeight: 500, fontSize: 16, lineHeight: '22px',
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
  maxHeight: 'calc(100dvh - 48px)',
  zIndex: 9999,
  backgroundColor: '#f7f2ed',
  borderRadius: 20,
  padding: 8,
  boxShadow: '0px 19px 32px 0px rgba(18,12,8,0.15), 0px 2px 2.8px 0px rgba(130,122,116,0.1)',
  display: 'flex',
  flexDirection: 'column' as const,
  overflow: 'hidden',
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
  const usd      = isCustom ? (parseFloat(custom) || 0) : (PRESETS[selected]?.usd ?? 0)
  const credits  = isCustom
    ? Math.floor(usd * CREDITS_PER_DOLLAR)
    : (PRESETS[selected]?.credits ?? 0)
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
                flex: '1 0 0', minHeight: 0, overflowY: 'auto',
                padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
              }}
            >
              {/* ── Header ── */}
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                borderBottom: `1px solid ${C.hair}`,
                padding: '12px 12px 24px',
              }}>
                <p style={{
                  flex: '1 0 0', minWidth: 0, margin: 0,
                  fontFamily: TITLE, fontWeight: 400, fontSize: 24, lineHeight: '32px',
                  color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  Buy more credits
                </p>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 32, height: 32, flexShrink: 0, borderRadius: 8,
                    border: 'none', backgroundColor: 'transparent',
                    cursor: 'pointer', color: C.muted, padding: 6,
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                    <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {/* ── Body sections ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* Description */}
                <div style={{ padding: '12px 12px 24px' }}>
                  <p style={{
                    fontFamily: BODY, fontWeight: 400, fontSize: 14, lineHeight: '22px',
                    color: '#827a74', margin: 0,
                  }}>
                    Top up your credits instantly. Unused credits roll over to your next billing cycle.
                  </p>
                </div>

                {/* Preset cards + custom input */}
                <div style={{
                  border: `1px solid ${C.border}`, borderRadius: 16, padding: 12,
                  display: 'flex', flexDirection: 'column', gap: 12,
                }}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {PRESETS.map((pkg, idx) => {
                      const sel = selected === idx
                      return (
                        <button
                          key={pkg.usd}
                          onClick={() => pickPreset(idx)}
                          style={{
                            flex: '1 0 0', minWidth: 0,
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9,
                            padding: 12, borderRadius: 8, cursor: 'pointer',
                            backgroundColor: C.white, border: 'none',
                            boxShadow: sel
                              ? '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 2px var(--neutral-900)'
                              : '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
                            transition: 'box-shadow 120ms',
                          }}
                        >
                          <span style={{
                            display: 'inline-flex', alignItems: 'center',
                            padding: '2px 4px', borderRadius: 6,
                            backgroundColor: 'var(--neutral-100, #ede1d7)',
                            boxShadow: '0px 1px 1.5px 0px rgba(18,12,8,0.2), 0px 0px 0px 1px rgba(106,98,93,0.5)',
                            fontFamily: BODY, fontWeight: 500, fontSize: 11, lineHeight: '16px',
                            color: 'var(--neutral-700, #524b47)', whiteSpace: 'nowrap',
                          }}>
                            {pkg.label}
                          </span>
                          <p style={{
                            fontFamily: TITLE, fontWeight: 400, fontSize: 24, lineHeight: '32px',
                            color: BLUE_700, margin: 0, textAlign: 'center',
                          }}>
                            ${pkg.usd}
                          </p>
                          <p style={{
                            fontFamily: BODY, fontWeight: 400, fontSize: 16, lineHeight: '22px',
                            color: C.ink, margin: 0, textAlign: 'center',
                          }}>
                            {fmtNum(pkg.credits)} credits
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
                        fontFamily: BODY, fontWeight: 400, fontSize: 14, lineHeight: '22px',
                        color: 'var(--neutral-700, #524b47)',
                      }}
                    >
                      Other
                    </label>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 2,
                      backgroundColor: C.white, padding: '7px 10px', borderRadius: 10,
                      boxShadow: isCustom && custom !== ''
                        ? '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 2px var(--neutral-900)'
                        : '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
                      transition: 'box-shadow 120ms',
                    }}>
                      <span style={{
                        fontFamily: BODY, fontWeight: 400, fontSize: 14, lineHeight: '22px',
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
                          fontFamily: BODY, fontWeight: 400, fontSize: 14, lineHeight: '22px',
                          color: C.ink, padding: '0 2px',
                        }}
                      />
                      {isCustom && credits > 0 && (
                        <span style={{
                          fontFamily: BODY, fontWeight: 400, fontSize: 12, lineHeight: '16px',
                          color: 'var(--neutral-600, #6a625d)', flexShrink: 0,
                          paddingLeft: 8, whiteSpace: 'nowrap',
                        }}>
                          {fmtNum(credits)} credits
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Order summary */}
                <div style={{
                  border: `1px solid ${C.border}`, borderRadius: 16,
                  display: 'flex', flexDirection: 'column',
                }}>
                  <div style={{
                    borderBottom: `1px solid ${C.hair}`,
                    padding: 12, display: 'flex', flexDirection: 'column', gap: 9,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <p style={{ ...summaryText, flex: '1 0 0', minWidth: 0 }}>Extra credits</p>
                      <p style={summaryText}>{credits > 0 ? `${fmtNum(credits)} credits` : '—'}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <p style={{ ...summaryText, flex: '1 0 0', minWidth: 0 }}>Estimated tax</p>
                      <p style={summaryText}>$0.00</p>
                    </div>
                  </div>
                  <div style={{ padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <p style={{ ...summaryText, flex: '1 0 0', minWidth: 0 }}>Total due</p>
                      <p style={summaryText}>{usd > 0 ? fmtUsd(usd) : '—'}</p>
                    </div>
                  </div>
                </div>

                {/* Payment method */}
                <div style={{ border: `1px solid ${C.border}`, borderRadius: 16 }}>
                  <div style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <p style={{
                      ...summaryText, flex: '1 0 0', minWidth: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      Payment method
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                      <CardBrandLogo brand={(pm?.brand as CardBrand) || 'unknown'} width={63} height={44} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <p style={{
                          fontFamily: BODY, fontWeight: 500, fontSize: 16, lineHeight: '22px',
                          color: C.ink, margin: 0,
                        }}>
                          {pm?.last4 ? `Card ending in ${pm.last4}` : 'No card on file'}
                        </p>
                        {pm?.exp_month && pm?.exp_year && (
                          <p style={{
                            fontFamily: BODY, fontWeight: 400, fontSize: 14, lineHeight: '22px',
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
                        width: 36, height: 36, flexShrink: 0, borderRadius: 10,
                        border: 'none', backgroundColor: 'transparent',
                        cursor: openingPortal ? 'default' : 'pointer',
                        color: C.muted, padding: 8,
                        opacity: openingPortal ? 0.5 : 1,
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
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
                display: 'flex', flexDirection: 'column', gap: 9,
                paddingTop: 24, paddingBottom: 12,
              }}>
                <Button
                  variant="default"
                  size="md"
                  fluid
                  loading={paying}
                  disabled={!canPay}
                  onClick={() => { void handlePay() }}
                >
                  {canPay ? `Pay ${fmtUsd(usd)} now` : 'Pay now'}
                </Button>
                <p style={{
                  fontFamily: BODY, fontWeight: 400, fontSize: 14, lineHeight: '22px',
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
