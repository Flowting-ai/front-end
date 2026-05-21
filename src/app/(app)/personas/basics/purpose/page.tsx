'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeftOneIcon, ArrowRightOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { WizardShell, STEPS_BASICS } from '../../_components/WizardShell'

const MAX_CHARS = 120
const WIZARD_KEY = 'persona_wizard_draft'

// ── Inner page (needs Suspense for useSearchParams) ───────────────────────────

function PurposePageContent() {
  const { push } = useRouter()
  const searchParams = useSearchParams()
  const template = searchParams.get('template') ?? ''

  const [purpose, setPurpose] = useState(() => {
    // Prefill from sessionStorage if user navigated back
    if (typeof window === 'undefined') return ''
    try {
      const draft = JSON.parse(sessionStorage.getItem(WIZARD_KEY) ?? '{}')
      return draft.purpose ?? ''
    } catch { return '' }
  })

  function buildQuery() {
    const p = new URLSearchParams()
    if (template) p.set('template', template)
    const qs = p.toString()
    return qs ? `?${qs}` : ''
  }

  function handleContinue() {
    try {
      const existing = JSON.parse(sessionStorage.getItem(WIZARD_KEY) ?? '{}')
      // Clear name/tone from previous runs in case user came back and changed purpose
      sessionStorage.setItem(WIZARD_KEY, JSON.stringify({ ...existing, purpose, name: undefined, tone: undefined }))
    } catch { /* ignore */ }
    push(`/personas/basics/name${buildQuery()}`)
  }

  return (
    <WizardShell steps={STEPS_BASICS}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 35, alignItems: 'center', width: '100%' }}>

        {/* Heading */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', textAlign: 'center' }}>
          <p style={{
            fontFamily: 'var(--font-title)', fontWeight: 400,
            fontSize: 24, lineHeight: '32px', color: '#1a1916', margin: 0,
          }}>
            What should this persona do?
          </p>
          <p style={{
            fontFamily: 'var(--font-body)', fontWeight: 400,
            fontSize: 14, lineHeight: '22px', color: '#827a74', margin: 0,
          }}>
            One sentence is perfect - this becomes its purpose and card description.
          </p>
        </div>

        {/* Input area */}
        <div style={{ display: 'flex', flexDirection: 'column', width: 684 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Textarea */}
            <div style={{
              background: 'var(--neutral-white)',
              borderRadius: 10,
              boxShadow: '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
              padding: '12px 10px',
            }}>
              <textarea
                value={purpose}
                onChange={e => setPurpose(e.target.value.slice(0, MAX_CHARS))}
                placeholder="e.g. Reviews contracts and flags risks in plain English"
                rows={2}
                style={{
                  width: '100%',
                  fontFamily: 'var(--font-body)', fontWeight: 400,
                  fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)',
                  background: 'transparent', border: 'none', outline: 'none',
                  resize: 'none',
                  '::placeholder': { color: 'var(--neutral-600)' },
                } as React.CSSProperties}
              />
            </div>

            {/* Hint + char count */}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)',
              fontSize: 14, lineHeight: '22px', color: '#827a74',
            }}>
              <span>Keep it tight - this shows on the card</span>
              <span>{purpose.length}/{MAX_CHARS}</span>
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
              onClick={() => push(`/personas/templates${buildQuery()}`)}
            >
              Back
            </Button>
            {/* eslint-disable-next-line react-doctor/design-no-vague-button-label -- wizard step: "Continue" advances to tone step; flow context makes action clear */}
            <Button
              variant="default"
              size="sm"
              rightIcon={<ArrowRightOneIcon size={16} />}
              disabled={purpose.trim().length === 0}
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

export default function PersonaPurposePage() {
  return (
    <Suspense>
      <PurposePageContent />
    </Suspense>
  )
}
