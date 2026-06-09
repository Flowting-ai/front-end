'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeftOneIcon, ArrowRightOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { WizardShell, STEPS_BASICS } from '../../_components/WizardShell'
import { TEMPLATE_PRESETS } from '../../_data/template-presets'

// ── Session-storage key (shared across wizard pages) ─────────────────────────

const WIZARD_KEY = 'persona_wizard_draft'

// ── Derive a URL-safe handle slug from name ───────────────────────────────────

function toHandle(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, '')
}

// ── Inner page ────────────────────────────────────────────────────────────────

function NamePageContent() {
  const { push } = useRouter()
  const searchParams = useSearchParams()
  const template = searchParams.get('template') ?? ''

  const [name, setName] = useState(() => {
    if (typeof window === 'undefined') return ''
    try {
      const draft = JSON.parse(sessionStorage.getItem(WIZARD_KEY) ?? '{}')
      // Restore on back navigation. Normalize: stored as undefined when no template.
      if ((draft.template ?? '') === template && draft.name) return draft.name
      // Pre-fill from template preset on first visit
      if (template) return TEMPLATE_PRESETS[template]?.name ?? ''
      return ''
    } catch { return '' }
  })

  function buildQuery() {
    const p = new URLSearchParams()
    if (template) p.set('template', template)
    const qs = p.toString()
    return qs ? `?${qs}` : ''
  }

  function saveName() {
    try {
      const existing = JSON.parse(sessionStorage.getItem(WIZARD_KEY) ?? '{}')
      sessionStorage.setItem(WIZARD_KEY, JSON.stringify({ ...existing, name }))
    } catch { /* ignore */ }
  }

  function handleContinue() {
    if (!name.trim()) return
    saveName()
    push(`/agents/basics/tone${buildQuery()}`)
  }

  const handle = name.trim() ? `@${toHandle(name)}01` : ''

  return (
    <WizardShell steps={STEPS_BASICS}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 35, alignItems: 'center', width: '100%' }}>

        {/* Heading */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', textAlign: 'center' }}>
          <p style={{
            fontFamily: 'var(--font-title)', fontWeight: 400,
            fontSize: 24, lineHeight: '32px', color: '#1a1916', margin: 0,
          }}>
            What should we call it?
          </p>
          <p style={{
            fontFamily: 'var(--font-body)', fontWeight: 400,
            fontSize: 14, lineHeight: '22px', color: '#827a74', margin: 0,
          }}>
            This is how it appears in your library and in chat.
          </p>
        </div>

        {/* Input area */}
        <div style={{ display: 'flex', flexDirection: 'column', width: 436 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Input */}
            <div style={{
              background: 'var(--neutral-white)',
              borderRadius: 10,
              boxShadow: '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
              padding: '12px 10px',
            }}>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Legal Assistant"
                style={{
                  width: '100%',
                  fontFamily: 'var(--font-body)', fontWeight: 400,
                  fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)',
                  // eslint-disable-next-line react-doctor/no-outline-none -- browser outline suppressed; :focus-visible handled by container or global styles
                  background: 'transparent', border: 'none', outline: 'none',
                }}
              />
            </div>

            {/* Handle preview */}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)',
              fontSize: 14, lineHeight: '22px', color: '#827a74',
              minHeight: 22,
            }}>
              {handle && (
                <span>
                  @<strong style={{ fontWeight: 'var(--font-weight-medium)' }}>{toHandle(name)}</strong>01
                </span>
              )}
            </div>
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            paddingTop: 64,
          }}>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ArrowLeftOneIcon size={16} />}
              onClick={() => {
                saveName()
                try { sessionStorage.setItem('persona_wizard_going_back', '1') } catch { /* ignore */ }
                push(`/agents/basics/purpose${buildQuery()}`)
              }}
            >
              Back
            </Button>
            {/* eslint-disable-next-line react-doctor/design-no-vague-button-label -- wizard step: "Continue" advances to next step; position in flow makes action clear */}
            <Button
              variant="default"
              size="sm"
              rightIcon={<ArrowRightOneIcon size={16} />}
              disabled={name.trim().length === 0}
              onClick={handleContinue}
            >
              Continue
            </Button>
          </div>
        </div>

      </div>
    </WizardShell>
  )
}

// ── Page export ───────────────────────────────────────────────────────────────

export default function PersonaNamePage() {
  return (
    <Suspense>
      <NamePageContent />
    </Suspense>
  )
}
