'use client'

import React, { useState } from 'react'
import { CancelOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { toast } from 'sonner'

// ── Style constants (mirrors org/plans page tokens) ──────────────────────────

const SHADOW_MODAL = '0px 19px 32px 0px rgba(18,12,8,0.15), 0px 2px 2.8px 0px rgba(130,122,116,0.1)'
const SHADOW_INPUT = '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)'
const SHADOW_PILL  = '0px 1.091px 1.091px 0px rgba(59,54,50,0.05), 0px 1.455px 3.127px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-100)'
const SHADOW_PILL_ACTIVE = '0px 0px 0px 1px var(--neutral-black, #000), 0px 1.091px 1.091px 0px rgba(59,54,50,0.1), 0px 1.455px 3.127px 0px rgba(59,54,50,0.4)'

type PreferredTime = 'mornings' | 'afternoons' | 'evenings'

// ── Labelled input ────────────────────────────────────────────────────────────

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label:        string
  value:        string
  onChange:     (v: string) => void
  placeholder?: string
  type?:        string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
      <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-700)', margin: 0 }}>
        {label}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'white', borderRadius: 10, padding: '7px 10px', boxShadow: SHADOW_INPUT }}>
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

// ── Preferred-time pill toggle ────────────────────────────────────────────────

function TimePill({
  label,
  active,
  onClick,
}: {
  label:   string
  active:  boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex:            '1 1 0',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         '6px 10px 8px',
        borderRadius:    10,
        border:          'none',
        cursor:          'pointer',
        fontFamily:      'var(--font-body)',
        fontWeight:      500,
        fontSize:        14,
        lineHeight:      '22px',
        whiteSpace:      'nowrap',
        position:        'relative',
        background:      'white',
        color:           active ? 'var(--neutral-50, #f7f2ed)' : 'var(--neutral-700)',
        boxShadow:       active ? SHADOW_PILL_ACTIVE : SHADOW_PILL,
        transition:      'box-shadow 120ms, color 120ms',
      }}
    >
      {active && (
        <span
          aria-hidden
          style={{
            position:     'absolute',
            inset:        0,
            borderRadius: 10,
            background:   'linear-gradient(180deg, var(--neutral-700, #524b47) 0%, var(--neutral-900, #26211e) 100%)',
            pointerEvents: 'none',
          }}
        />
      )}
      <span style={{ position: 'relative' }}>{label}</span>
    </button>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export interface RequestDemoModalProps {
  onClose: () => void
  /** Called with form data when the user clicks "Book a demo". Wire up your calendar / CRM here. */
  onSubmit?: (data: {
    email:         string
    name:          string
    preferredTime: PreferredTime
    message:       string
  }) => Promise<void>
}

export function RequestDemoModal({ onClose, onSubmit }: RequestDemoModalProps) {
  const [email,         setEmail]         = useState('')
  const [name,          setName]          = useState('')
  const [preferredTime, setPreferredTime] = useState<PreferredTime>('mornings')
  const [message,       setMessage]       = useState('')
  const [submitting,    setSubmitting]     = useState(false)

  const handleSubmit = async () => {
    if (!email.trim()) { toast.error('Work email is required.'); return }
    setSubmitting(true)
    try {
      await onSubmit?.({ email: email.trim(), name: name.trim(), preferredTime, message: message.trim() })
      toast.success("We'll send you a calendar link shortly.")
      onClose()
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    // Backdrop
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position:        'fixed',
        inset:           0,
        zIndex:          1000,
        background:      'rgba(18,12,8,0.5)',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         24,
      }}
    >
      {/* Sheet */}
      <div
        className="kaya-scrollbar"
        style={{
          background:  'var(--neutral-50, #f7f2ed)',
          borderRadius: 20,
          padding:      8,
          boxShadow:    SHADOW_MODAL,
          width:        '100%',
          maxWidth:     738,
          maxHeight:    'calc(100dvh - 48px)',
          overflow:     'auto',
        }}
      >
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Header */}
          <div style={{ padding: '12px 12px 0', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <p style={{ flex: '1 0 0', fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
              Request a demo
            </p>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, display: 'flex', color: 'var(--neutral-700)', flexShrink: 0 }}
            >
              <CancelOneIcon size={20} />
            </button>
          </div>

          {/* Subtitle */}
          <div style={{ padding: '0 12px 24px' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
              A 30-minute walkthrough of the centralized brain, agents, and the Slack bot.
            </p>
          </div>

          {/* Form container */}
          <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 16, padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Row 1: Work email + Full name */}
            <div style={{ display: 'flex', gap: 12 }}>
              <InputField label="Work email" value={email} onChange={setEmail} placeholder="you@company.com" type="email" />
              <InputField label="Full name"  value={name}  onChange={setName}  placeholder="Jane Smith" />
            </div>

            {/* Preferred time toggles */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-700)', margin: 0 }}>
                Preferred time
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <TimePill label="Mornings"   active={preferredTime === 'mornings'}   onClick={() => setPreferredTime('mornings')} />
                <TimePill label="Afternoons" active={preferredTime === 'afternoons'} onClick={() => setPreferredTime('afternoons')} />
                <TimePill label="Evenings"   active={preferredTime === 'evenings'}   onClick={() => setPreferredTime('evenings')} />
              </div>
            </div>

            {/* Textarea */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-700)', margin: 0 }}>
                What do you want to see?
              </p>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Tell us about your team and what you're trying to solve — we'll tailor the demo to it…"
                rows={4}
                style={{ width: '100%', boxSizing: 'border-box', border: 'none', outline: 'none', background: 'white', borderRadius: 10, padding: '9px 12px', boxShadow: SHADOW_INPUT, fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', resize: 'none' }}
              />
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: '24px 0 12px', display: 'flex', flexDirection: 'column', gap: 9 }}>
            <Button variant="default" fluid onClick={handleSubmit} loading={submitting} disabled={submitting}>
              Book a demo
            </Button>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
              Opens a calendar to pick your slot.
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}

export default RequestDemoModal
