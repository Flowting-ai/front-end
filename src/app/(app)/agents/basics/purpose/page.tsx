'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeftOneIcon, ArrowRightOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { WizardShell, STEPS_BASICS } from '../../_components/WizardShell'
import { TEMPLATE_PRESETS } from '../../_data/template-presets'
import CancelCreationModal from '../../_components/CancelCreationModal'

const MAX_CHARS = 120
const WIZARD_KEY = 'persona_wizard_draft'

// ── Inner page (needs Suspense for useSearchParams) ───────────────────────────

function PurposePageContent() {
  const { push } = useRouter()
  const searchParams = useSearchParams()
  const template = searchParams.get('template') ?? ''
  const [cancelOpen, setCancelOpen] = useState(false)

  // Side-effect guard: React 18 StrictMode calls useState initializers twice.
  // All sessionStorage writes/removes live in the useEffect below, not here.
  const initDoneRef = useRef(false)

  const [purpose, setPurpose] = useState(() => {
    if (typeof window === 'undefined') return ''
    try {
      const draft = JSON.parse(sessionStorage.getItem(WIZARD_KEY) ?? '{}')
      const goingBack = sessionStorage.getItem('persona_wizard_going_back') === '1'
      if (goingBack && (draft.template ?? '') === template && draft.purpose) return draft.purpose
      if (template) return TEMPLATE_PRESETS[template]?.purpose ?? ''
      return ''
    } catch { return '' }
  })

  useEffect(() => {
    if (initDoneRef.current) return
    initDoneRef.current = true
    try {
      const draft = JSON.parse(sessionStorage.getItem(WIZARD_KEY) ?? '{}')
      const goingBack = sessionStorage.getItem('persona_wizard_going_back') === '1'
      sessionStorage.removeItem('persona_wizard_going_back')
      if (!goingBack || (draft.template ?? '') !== template || !draft.purpose) {
        // Fresh start — clear all stale wizard state from previous sessions
        sessionStorage.removeItem('persona_wizard_repo')
        sessionStorage.removeItem('persona_wizard_starter')
        sessionStorage.removeItem(WIZARD_KEY)
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function buildQuery() {
    const p = new URLSearchParams()
    if (template) p.set('template', template)
    const qs = p.toString()
    return qs ? `?${qs}` : ''
  }

  function handleContinue() {
    try {
      const existing = JSON.parse(sessionStorage.getItem(WIZARD_KEY) ?? '{}')
      const purposeChanged = existing.purpose !== purpose
      sessionStorage.setItem(WIZARD_KEY, JSON.stringify({
        ...existing,
        purpose,
        // Only clear downstream fields if the purpose actually changed
        name:     purposeChanged ? undefined : existing.name,
        tone:     purposeChanged ? undefined : existing.tone,
        template: template || undefined,
      }))
    } catch { /* ignore */ }
    push(`/agents/basics/name${buildQuery()}`)
  }

  return (
    <>
    <WizardShell steps={STEPS_BASICS}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 35, alignItems: 'center', width: '100%' }}>

        {/* Heading */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', textAlign: 'center' }}>
          <p style={{
            fontFamily: 'var(--font-title)', fontWeight: 400,
            fontSize: 24, lineHeight: '32px', color: '#1a1916', margin: 0,
          }}>
            What should this agent do?
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
              onClick={() => setCancelOpen(true)}
            >
              Back
            </Button>
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

    {cancelOpen && (
      <CancelCreationModal
        onCancel={() => {
          setCancelOpen(false)
          try { sessionStorage.removeItem('persona_wizard_draft') } catch { /* ignore */ }
          try { sessionStorage.removeItem('persona_wizard_starter') } catch { /* ignore */ }
          try { sessionStorage.removeItem('persona_wizard_repo') } catch { /* ignore */ }
          push('/agents')
        }}
        onKeep={() => setCancelOpen(false)}
      />
    )}
    </>
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
