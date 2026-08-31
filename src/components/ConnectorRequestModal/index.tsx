'use client'

import React, { useCallback, useState } from 'react'
import { z } from 'zod'
import { Slot } from '@radix-ui/react-slot'
import { CancelOneIcon, ArrowDownOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { InputField } from '@/components/InputField'
import { Dropdown } from '@/components/Dropdown'
import { Divider } from '@/components/Divider'
import { cn } from '@/lib/utils'

// ── Shadows — match ShareModal exactly ───────────────────────────────────────
const SHADOW_MODAL   = '0px 12px 16px -4px rgba(130,122,116,0.12), 0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)'
const SHADOW_TRIGGER = '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-200)'
const SHADOW_INPUT   = '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConnectorRequestUrgency = 'nice-to-have' | 'would-help' | 'blocking'

export interface ConnectorRequestModalProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSubmit'> {
  loading?: boolean
  onClose?: () => void
  onSubmit?: (data: { toolName: string; url: string; description: string; urgency: ConnectorRequestUrgency }) => void
  asChild?: boolean
}

const URGENCY_OPTIONS: { value: ConnectorRequestUrgency; label: string }[] = [
  { value: 'nice-to-have', label: 'Nice to have' },
  { value: 'would-help',   label: 'Would help our workflow' },
  { value: 'blocking',     label: 'Blocking us right now' },
]

// url/description stay unconstrained strings — only toolName was ever required,
// same rule as before, now enforced through zod instead of an inline .trim() check.
const connectorRequestSchema = z.object({
  toolName:    z.string().trim().min(1),
  url:         z.string().trim(),
  description: z.string().trim(),
  urgency:     z.enum(['nice-to-have', 'would-help', 'blocking']),
})

// ── Close button — matches ShareModal ────────────────────────────────────────

function CloseButton({ onClick }: { onClick?: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button type="button" onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} aria-label="Close"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 3, borderRadius: 6, border: 'none', backgroundColor: hov ? 'var(--neutral-100)' : 'transparent', cursor: 'pointer', color: hov ? 'var(--neutral-700)' : 'var(--neutral-500)', flexShrink: 0, lineHeight: 0, outline: 'none', transition: 'background-color 120ms, color 120ms' }}>
      <CancelOneIcon size={18} />
    </button>
  )
}

// ── Urgency dropdown ──────────────────────────────────────────────────────────

function UrgencyDropdown({ value, onChange }: { value: ConnectorRequestUrgency; onChange: (v: ConnectorRequestUrgency) => void }) {
  const [open, setOpen] = useState(false)
  const [hov,  setHov]  = useState(false)
  const label = URGENCY_OPTIONS.find(o => o.value === value)?.label ?? 'Select'

  return (
    <Dropdown.Float
      open={open}
      onOpenChange={setOpen}
      placement="bottom-start"
      offset={4}
      trigger={
        <button type="button"
          onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', padding: '8px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', backgroundColor: hov ? 'var(--neutral-50)' : 'var(--neutral-white)', boxShadow: SHADOW_TRIGGER, fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-body)', color: 'var(--neutral-700)', outline: 'none', transition: 'background-color 120ms' }}>
          <span>{label}</span>
          <ArrowDownOneIcon size={14} color="var(--neutral-400)" />
        </button>
      }
    >
      <Dropdown>
        <Dropdown.Section fluid>
          {URGENCY_OPTIONS.map(opt => (
            <Dropdown.Item key={opt.value} fluid label={opt.label} selected={value === opt.value}
              onClick={() => { onChange(opt.value); setOpen(false) }} />
          ))}
        </Dropdown.Section>
      </Dropdown>
    </Dropdown.Float>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export const ConnectorRequestModal = React.forwardRef<HTMLDivElement, ConnectorRequestModalProps>(
  function ConnectorRequestModal({ loading = false, onClose, onSubmit, asChild = false, className, style, ...props }, ref) {
    const Comp = (asChild ? Slot : 'div') as React.ElementType
    const [toolName,    setToolName]    = useState('')
    const [url,         setUrl]         = useState('')
    const [description, setDescription] = useState('')
    const [urgency,     setUrgency]     = useState<ConnectorRequestUrgency>('would-help')

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') onClose?.()
    }, [onClose])

    const validation = connectorRequestSchema.safeParse({ toolName, url, description, urgency })

    const handleSubmit = () => {
      if (!validation.success) return
      onSubmit?.(validation.data)
    }

    return (
      <Comp
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Request from Souvenir"
        className={cn(className)}
        onKeyDown={handleKeyDown}
        style={{
          display:         'flex',
          flexDirection:   'column',
          gap:             16,
          width:           520,
          padding:         '20px 18px',
          borderRadius:    18,
          boxSizing:       'border-box' as const,
          backgroundColor: 'var(--neutral-white)',
          boxShadow:       SHADOW_MODAL,
          ...style,
        }}
        {...props}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-title)', fontSize: 'var(--font-size-heading)', fontWeight: 400, lineHeight: 'var(--line-height-heading)', color: 'var(--neutral-900)', margin: 0 }}>
              Request from Souvenir
            </h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', color: 'var(--neutral-500)', margin: '4px 0 0', lineHeight: 'var(--line-height-caption)' }}>
              Tell Souvenir what you need. We'll scope it and notify your workspace when it's available.
            </p>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        <Divider decorative style={{ backgroundColor: 'var(--neutral-100)' }} />

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 'var(--font-size-body)', color: 'var(--neutral-700)' }}>
              Tool / service name
            </label>
            <InputField
              value={toolName}
              onChange={setToolName}
              placeholder="e.g. beehiiv"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 'var(--font-size-body)', color: 'var(--neutral-700)' }}>
              Website or app URL <span style={{ fontWeight: 400, color: 'var(--neutral-400)' }}>(optional)</span>
            </label>
            <InputField
              value={url}
              onChange={setUrl}
              placeholder="http://"
              type="url"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 'var(--font-size-body)', color: 'var(--neutral-700)' }}>
              What do you need it to do?
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What data should the brain read? What actions should it take? Which team needs it?"
              rows={3}
              style={{
                fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-body)', color: 'var(--neutral-900)',
                backgroundColor: 'var(--neutral-white)', borderRadius: 10, border: 'none',
                boxShadow: SHADOW_INPUT, padding: '8px 12px', resize: 'vertical',
                lineHeight: 'var(--line-height-body)', outline: 'none', boxSizing: 'border-box', width: '100%',
                fontWeight: 400,
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 'var(--font-size-body)', color: 'var(--neutral-700)' }}>
              How blocking is this?
            </label>
            <UrgencyDropdown value={urgency} onChange={setUrgency} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="default" size="sm" loading={loading} disabled={!validation.success} onClick={handleSubmit}>
            Submit request
          </Button>
        </div>
      </Comp>
    )
  },
)

ConnectorRequestModal.displayName = 'ConnectorRequestModal'
export default ConnectorRequestModal
