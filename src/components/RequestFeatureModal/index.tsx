'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useForm, ValidationError } from '@formspree/react'
import { CancelOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { useAuth } from '@/context/auth-context'
import { useFocusTrap } from '@/hooks/use-focus-trap'
import { toast } from 'sonner'

const SHADOW_MODAL = '0px 19px 32px 0px rgba(18,12,8,0.15), 0px 2px 2.8px 0px rgba(130,122,116,0.1)'
const SHADOW_INPUT = '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)'

// Closing the modal (the X, a click on the overlay) previously discarded
// whatever was typed with no warning. Persisted here instead: survives
// close/reopen and even a page reload within the same tab, cleared only
// once the request actually submits.
const DRAFT_KEY = 'kaya:requestFeatureDraft:v1'

function readDraft(): string {
  if (typeof window === 'undefined') return ''
  try {
    return window.sessionStorage.getItem(DRAFT_KEY) ?? ''
  } catch {
    return ''
  }
}

function writeDraft(message: string): void {
  try { window.sessionStorage.setItem(DRAFT_KEY, message) } catch { /* quota / private mode */ }
}

function clearDraft(): void {
  try { window.sessionStorage.removeItem(DRAFT_KEY) } catch { /* noop */ }
}

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-700)', margin: 0,
}
const inputStyle: React.CSSProperties = {
  flex: '1 0 0', minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', padding: '0 2px',
}
const fieldErrorStyle: React.CSSProperties = {
  display: 'block', fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: '16px', color: '#dc2626', marginTop: 2,
}

export interface RequestFeatureModalProps {
  onClose: () => void
}

export function RequestFeatureModal({ onClose }: RequestFeatureModalProps) {
  const { user } = useAuth()
  // Already known from sign-in (same identity shown in the Settings
  // sidebar) — prefilled so it's not re-typed on every request, but left as
  // plain `defaultValue`s (uncontrolled) so they're still freely editable.
  const displayName = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.name || '' : ''
  const [message, setMessage] = useState(readDraft)
  const [state, handleSubmit] = useForm('mrerelnz')
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef, true, onClose)

  useEffect(() => {
    writeDraft(message)
  }, [message])

  // Success: clear the draft, toast + close
  useEffect(() => {
    if (state.succeeded) {
      clearDraft()
      toast.success('Feature request sent — thanks for the suggestion!')
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
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Request a feature"
        tabIndex={-1}
        className="kaya-scrollbar"
        style={{ background: 'var(--neutral-50, #f7f2ed)', borderRadius: 20, padding: 8, boxShadow: SHADOW_MODAL, width: '100%', maxWidth: 738, maxHeight: 'calc(100dvh - 48px)', overflow: 'auto', outline: 'none' }}
      >
        <form onSubmit={handleSubmit}>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Header */}
            <div style={{ padding: '12px 12px 0', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <p style={{ flex: '1 0 0', fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
                Request a feature
              </p>
              <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, display: 'flex', color: 'var(--neutral-700)', flexShrink: 0 }}>
                <CancelOneIcon size={20} />
              </button>
            </div>

            {/* Subtitle */}
            <div style={{ padding: '0 12px 24px' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
                Got an idea for Souvenir?
              </p>
            </div>

            {/* Form container */}
            <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 16, padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Row 1: Work email + Full name */}
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
                  <label htmlFor="rf-email" style={labelStyle}>Work email</label>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'white', borderRadius: 10, padding: '7px 10px', boxShadow: SHADOW_INPUT }}>
                    <input id="rf-email" type="email" name="email" placeholder="you@company.com" defaultValue={user?.email ?? ''} required style={inputStyle} />
                  </div>
                  <span style={fieldErrorStyle}>
                    <ValidationError field="email" errors={state.errors} />
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
                  <label htmlFor="rf-name" style={labelStyle}>Full name</label>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'white', borderRadius: 10, padding: '7px 10px', boxShadow: SHADOW_INPUT }}>
                    <input id="rf-name" type="text" name="name" placeholder="Jane Smith" defaultValue={displayName} style={inputStyle} />
                  </div>
                  <span style={fieldErrorStyle}>
                    <ValidationError field="name" errors={state.errors} />
                  </span>
                </div>
              </div>

              {/* What would help you — tall textarea */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label htmlFor="rf-message" style={labelStyle}>What would help you?</label>
                <textarea
                  id="rf-message"
                  name="message"
                  placeholder="Tell us about your team and what you're trying to solve…"
                  rows={5}
                  required
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', border: 'none', outline: 'none', background: 'white', borderRadius: 10, padding: '9px 12px', boxShadow: SHADOW_INPUT, fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', resize: 'none' }}
                />
                <span style={fieldErrorStyle}>
                  <ValidationError field="message" errors={state.errors} />
                </span>
              </div>

            </div>

            {/* Footer */}
            <div style={{ padding: '24px 0 12px' }}>
              <Button variant="default" fluid type="submit" loading={state.submitting} disabled={state.submitting}>
                Submit request
              </Button>
            </div>

          </div>
        </form>
      </div>
    </div>
  )
}

export default RequestFeatureModal
