'use client'

import React, { useEffect } from 'react'
import { useForm, ValidationError } from '@formspree/react'
import { toast } from 'sonner'
import { CancelOneIcon } from '@strange-huge/icons'

const SHADOW_MODAL = '0px 19px 32px 0px rgba(18,12,8,0.15), 0px 2px 2.8px 0px rgba(130,122,116,0.1)'
const SHADOW_INPUT = '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)'

const S = {
  label: {
    fontFamily: 'var(--font-body)',
    fontWeight: 400,
    fontSize: 14,
    lineHeight: '22px',
    color: 'var(--neutral-700)',
    margin: 0,
  } as React.CSSProperties,
  inputWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    background: 'white',
    borderRadius: 10,
    padding: '7px 10px',
    boxShadow: SHADOW_INPUT,
  } as React.CSSProperties,
  input: {
    flex: '1 0 0',
    minWidth: 0,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontFamily: 'var(--font-body)',
    fontSize: 14,
    lineHeight: '22px',
    color: 'var(--neutral-900)',
    padding: '0 2px',
  } as React.CSSProperties,
  fieldError: {
    display: 'block',
    fontFamily: 'var(--font-body)',
    fontSize: 12,
    lineHeight: '16px',
    color: '#dc2626',
    marginTop: 2,
  } as React.CSSProperties,
} as const

export function ContactSalesModal({ onClose }: { onClose: () => void }) {
  const [state, handleSubmit] = useForm('xgojalnr')

  // Success: toast + close
  useEffect(() => {
    if (state.succeeded) {
      toast.success("We'll be in touch within one business day.")
      onClose()
    }
  }, [state.succeeded, onClose])

  // Form-level errors (server / spam / network) → toast.
  // @formspree/react v3: state.errors is a SubmissionErrors instance; getFormErrors()
  // returns {code, message}[] — not strings — so we extract .message before toasting.
  useEffect(() => {
    if (state.submitting || state.succeeded) return
    const formErrs: Array<{ code: string; message: string }> =
      (state.errors?.getFormErrors?.() as Array<{ code: string; message: string }>) ?? []
    if (formErrs.length > 0) {
      toast.error(formErrs[0].message ?? 'Submission failed. Please try again.')
    }
  }, [state.errors, state.submitting, state.succeeded])

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(18,12,8,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        className="kaya-scrollbar"
        style={{
          background: 'var(--neutral-50, #f7f2ed)',
          borderRadius: 20,
          padding: 8,
          boxShadow: SHADOW_MODAL,
          width: '100%',
          maxWidth: 738,
          maxHeight: 'calc(100dvh - 48px)',
          overflow: 'auto',
        }}
      >
        <form onSubmit={handleSubmit}>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Header */}
            <div style={{ borderBottom: '1px solid var(--neutral-100)', padding: '0 12px 24px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <p style={{ flex: '1 0 0', fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
                Contact sales
              </p>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, display: 'flex', color: 'var(--neutral-700)' }}
              >
                <CancelOneIcon size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Subtitle */}
              <div style={{ padding: '0 12px 24px' }}>
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
                  Deploy the Autonomous Company Brain to your team. We&apos;ll scope seats, governance, and rollout.
                </p>
              </div>

              {/* Fields */}
              <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 16, padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* Row 1: Work email + Full name */}
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
                    <label htmlFor="cs-email" style={S.label}>Work email</label>
                    <div style={S.inputWrap}>
                      <input
                        id="cs-email"
                        type="email"
                        name="email"
                        placeholder="you@company.com"
                        required
                        style={S.input}
                      />
                    </div>
                    <span style={S.fieldError}>
                      <ValidationError field="email" errors={state.errors} />
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
                    <label htmlFor="cs-name" style={S.label}>Full name</label>
                    <div style={S.inputWrap}>
                      <input
                        id="cs-name"
                        type="text"
                        name="name"
                        placeholder="Jane Smith"
                        required
                        style={S.input}
                      />
                    </div>
                    <span style={S.fieldError}>
                      <ValidationError field="name" errors={state.errors} />
                    </span>
                  </div>
                </div>

                {/* Row 2: Company + Team size */}
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
                    <label htmlFor="cs-company" style={S.label}>Company</label>
                    <div style={S.inputWrap}>
                      <input
                        id="cs-company"
                        type="text"
                        name="company"
                        placeholder="Acme Inc."
                        required
                        style={S.input}
                      />
                    </div>
                    <span style={S.fieldError}>
                      <ValidationError field="company" errors={state.errors} />
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
                    <label htmlFor="cs-team-size" style={S.label}>Team size</label>
                    <div style={{ display: 'flex', alignItems: 'center', background: 'white', borderRadius: 10, padding: '7px 10px', boxShadow: SHADOW_INPUT }}>
                      <select
                        id="cs-team-size"
                        name="team_size"
                        defaultValue="1-5"
                        style={{ flex: '1 0 0', minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', cursor: 'pointer' }}
                      >
                        <option value="1-5">1 – 5</option>
                        <option value="6-20">6 – 20</option>
                        <option value="21-50">21 – 50</option>
                        <option value="51-200">51 – 200</option>
                        <option value="201+">201+</option>
                      </select>
                    </div>
                    <span style={S.fieldError}>
                      <ValidationError field="team_size" errors={state.errors} />
                    </span>
                  </div>
                </div>

                {/* What are you trying to solve? */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label htmlFor="cs-message" style={S.label}>What are you trying to solve?</label>
                  <textarea
                    id="cs-message"
                    name="message"
                    placeholder="Tell us about your use case…"
                    rows={4}
                    required
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      border: 'none',
                      outline: 'none',
                      background: 'white',
                      borderRadius: 10,
                      padding: '9px 12px',
                      boxShadow: SHADOW_INPUT,
                      fontFamily: 'var(--font-body)',
                      fontSize: 14,
                      lineHeight: '22px',
                      color: 'var(--neutral-900)',
                      resize: 'none',
                    }}
                  />
                  <span style={S.fieldError}>
                    <ValidationError field="message" errors={state.errors} />
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: '24px 0 12px', display: 'flex', flexDirection: 'column', gap: 9 }}>
                <button
                  type="submit"
                  disabled={state.submitting}
                  style={{
                    width: '100%',
                    padding: '10px 20px',
                    borderRadius: 10,
                    border: 'none',
                    background: 'var(--neutral-900)',
                    color: 'white',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 500,
                    fontSize: 14,
                    lineHeight: '22px',
                    cursor: state.submitting ? 'not-allowed' : 'pointer',
                    opacity: state.submitting ? 0.6 : 1,
                    transition: 'opacity 150ms',
                  }}
                >
                  {state.submitting ? 'Sending…' : 'Contact sales'}
                </button>
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
                  Response within one business day.
                </p>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
