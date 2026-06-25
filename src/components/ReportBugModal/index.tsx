'use client'

import React, { useState } from 'react'
import { CancelOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { toast } from 'sonner'

const SHADOW_MODAL = '0px 19px 32px 0px rgba(18,12,8,0.15), 0px 2px 2.8px 0px rgba(130,122,116,0.1)'
const SHADOW_INPUT = '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)'
const SHADOW_PILL  = '0px 1.091px 1.091px 0px rgba(59,54,50,0.05), 0px 1.455px 3.127px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-100)'
const SHADOW_PILL_ACTIVE = '0px 0px 0px 1px var(--neutral-black, #000), 0px 1.091px 1.091px 0px rgba(59,54,50,0.1), 0px 1.455px 3.127px 0px rgba(59,54,50,0.4)'

type Severity = 'low' | 'medium' | 'high'

function InputField({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
      <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-700)', margin: 0 }}>
        {label}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', background: 'white', borderRadius: 10, padding: '7px 10px', boxShadow: SHADOW_INPUT }}>
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ flex: '1 0 0', minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', padding: '0 2px' }}
        />
      </div>
    </div>
  )
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
  /** Called with form data on submit. Wire up your bug-tracker / support API here. */
  onSubmit?: (data: { email: string; name: string; severity: Severity; description: string }) => Promise<void>
}

export function ReportBugModal({ onClose, onSubmit }: ReportBugModalProps) {
  const [email,       setEmail]       = useState('')
  const [name,        setName]        = useState('')
  const [severity,    setSeverity]    = useState<Severity>('low')
  const [description, setDescription] = useState('')
  const [submitting,  setSubmitting]  = useState(false)

  const handleSubmit = async () => {
    if (!email.trim())       { toast.error('Work email is required.');      return }
    if (!description.trim()) { toast.error('Please describe what went wrong.'); return }
    setSubmitting(true)
    try {
      await onSubmit?.({ email: email.trim(), name: name.trim(), severity, description: description.trim() })
      toast.success("Bug reported — we'll look into it soon.")
      onClose()
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(18,12,8,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        className="kaya-scrollbar"
        style={{ background: 'var(--neutral-50, #f7f2ed)', borderRadius: 20, padding: 8, boxShadow: SHADOW_MODAL, width: '100%', maxWidth: 738, maxHeight: 'calc(100dvh - 48px)', overflow: 'auto' }}
      >
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Header */}
          <div style={{ padding: '12px 12px 0', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <p style={{ flex: '1 0 0', fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
              Report a bug
            </p>
            <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, display: 'flex', color: 'var(--neutral-700)', flexShrink: 0 }}>
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
              <InputField label="Work email" value={email} onChange={setEmail} placeholder="you@company.com" type="email" />
              <InputField label="Full name"  value={name}  onChange={setName}  placeholder="Jane Smith" />
            </div>

            {/* What went wrong — tall textarea */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-700)', margin: 0 }}>
                What went wrong?
              </p>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe what happened and what you expected instead…"
                rows={5}
                style={{ width: '100%', boxSizing: 'border-box', border: 'none', outline: 'none', background: 'white', borderRadius: 10, padding: '9px 12px', boxShadow: SHADOW_INPUT, fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', resize: 'none' }}
              />
            </div>

            {/* Severity pills */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-700)', margin: 0 }}>
                Severity
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <SeverityPill label="Low"    active={severity === 'low'}    onClick={() => setSeverity('low')} />
                <SeverityPill label="Medium" active={severity === 'medium'} onClick={() => setSeverity('medium')} />
                <SeverityPill label="High"   active={severity === 'high'}   onClick={() => setSeverity('high')} />
              </div>
            </div>

          </div>

          {/* Footer */}
          <div style={{ padding: '24px 0 12px' }}>
            <Button variant="default" fluid onClick={handleSubmit} loading={submitting} disabled={submitting}>
              Submit bug
            </Button>
          </div>

        </div>
      </div>
    </div>
  )
}

export default ReportBugModal
