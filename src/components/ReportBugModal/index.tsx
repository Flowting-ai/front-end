'use client'

import React, { useState, useEffect } from 'react'
import { useForm, ValidationError } from '@formspree/react'
import { CancelOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { toast } from 'sonner'

const SHADOW_MODAL = '0px 19px 32px 0px rgba(18,12,8,0.15), 0px 2px 2.8px 0px rgba(130,122,116,0.1)'
const SHADOW_INPUT = '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)'
const SHADOW_PILL  = '0px 1.091px 1.091px 0px rgba(59,54,50,0.05), 0px 1.455px 3.127px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-100)'
const SHADOW_PILL_ACTIVE = '0px 0px 0px 1px var(--neutral-black, #000), 0px 1.091px 1.091px 0px rgba(59,54,50,0.1), 0px 1.455px 3.127px 0px rgba(59,54,50,0.4)'

type Severity = 'low' | 'medium' | 'high'

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-700)', margin: 0,
}
const inputStyle: React.CSSProperties = {
  flex: '1 0 0', minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', padding: '0 2px',
}
const fieldErrorStyle: React.CSSProperties = {
  display: 'block', fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: '16px', color: '#dc2626', marginTop: 2,
}

function SeverityPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: '1 1 0', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '6px 10px 8px', borderRadius: 10, border: 'none', cursor: 'pointer',
        fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px',
        whiteSpace: 'nowrap', position: 'relative', background: 'white',
        color: active ? 'var(--neutral-50, #f7f2ed)' : 'var(--neutral-700)',
        boxShadow: active ? SHADOW_PILL_ACTIVE : SHADOW_PILL,
        transition: 'box-shadow 120ms, color 120ms',
      }}
    >
      {active && (
        <span aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 10, background: 'linear-gradient(180deg, var(--neutral-700, #524b47) 0%, var(--neutral-900, #26211e) 100%)', pointerEvents: 'none' }} />
      )}
      <span style={{ position: 'relative' }}>{label}</span>
    </button>
  )
}

export interface ReportBugModalProps {
  onClose: () => void
}

export function ReportBugModal({ onClose }: ReportBugModalProps) {
  const [severity, setSeverity] = useState<Severity>('low')
  const [state, handleSubmit] = useForm('xjgjgopw')

  // Success: toast + close
  useEffect(() => {
    if (state.succeeded) {
      toast.success("Bug reported — we'll look into it soon.")
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
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(18,12,8,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        className="kaya-scrollbar"
        style={{ background: 'var(--neutral-50, #f7f2ed)', borderRadius: 20, padding: 8, boxShadow: SHADOW_MODAL, width: '100%', maxWidth: 738, maxHeight: 'calc(100dvh - 48px)', overflow: 'auto' }}
      >
        <form onSubmit={handleSubmit}>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Header */}
            <div style={{ padding: '12px 12px 0', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <p style={{ flex: '1 0 0', fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
                Report a bug
              </p>
              <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, display: 'flex', color: 'var(--neutral-700)', flexShrink: 0 }}>
                <CancelOneIcon size={20} />
              </button>
            </div>

            {/* Subtitle */}
            <div style={{ padding: '0 12px 24px' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
                Something not working right?
              </p>
            </div>

            {/* Form container */}
            <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 16, padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Row 1: Work email + Full name */}
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
                  <label htmlFor="rb-email" style={labelStyle}>Work email</label>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'white', borderRadius: 10, padding: '7px 10px', boxShadow: SHADOW_INPUT }}>
                    <input id="rb-email" type="email" name="email" placeholder="you@company.com" required style={inputStyle} />
                  </div>
                  <span style={fieldErrorStyle}>
                    <ValidationError field="email" errors={state.errors} />
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
                  <label htmlFor="rb-name" style={labelStyle}>Full name</label>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'white', borderRadius: 10, padding: '7px 10px', boxShadow: SHADOW_INPUT }}>
                    <input id="rb-name" type="text" name="name" placeholder="Jane Smith" style={inputStyle} />
                  </div>
                  <span style={fieldErrorStyle}>
                    <ValidationError field="name" errors={state.errors} />
                  </span>
                </div>
              </div>

              {/* What went wrong — tall textarea */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label htmlFor="rb-message" style={labelStyle}>What went wrong?</label>
                <textarea
                  id="rb-message"
                  name="message"
                  placeholder="Describe what happened and what you expected instead…"
                  rows={5}
                  required
                  style={{ width: '100%', boxSizing: 'border-box', border: 'none', outline: 'none', background: 'white', borderRadius: 10, padding: '9px 12px', boxShadow: SHADOW_INPUT, fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', resize: 'none' }}
                />
                <span style={fieldErrorStyle}>
                  <ValidationError field="message" errors={state.errors} />
                </span>
              </div>

              {/* Severity pills */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <p style={labelStyle}>Severity</p>
                <input type="hidden" name="severity" value={severity} />
                <div style={{ display: 'flex', gap: 10 }}>
                  <SeverityPill label="Low"    active={severity === 'low'}    onClick={() => setSeverity('low')} />
                  <SeverityPill label="Medium" active={severity === 'medium'} onClick={() => setSeverity('medium')} />
                  <SeverityPill label="High"   active={severity === 'high'}   onClick={() => setSeverity('high')} />
                </div>
              </div>

            </div>

            {/* Footer */}
            <div style={{ padding: '24px 0 12px' }}>
              <Button variant="default" fluid type="submit" loading={state.submitting} disabled={state.submitting}>
                Submit bug
              </Button>
            </div>

          </div>
        </form>
      </div>
    </div>
  )
}

export default ReportBugModal
