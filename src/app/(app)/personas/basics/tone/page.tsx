'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeftOneIcon, ArrowRightOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { WizardShell, STEPS_BASICS } from '../../_components/WizardShell'

// ── Session-storage key ────────────────────────────────────────────────────

const WIZARD_KEY = 'persona_wizard_draft'

// ── Tone options ──────────────────────────────────────────────────────────────

const TONES = [
  {
    id:       'direct',
    label:    'Direct & confident',
    subtitle: 'Gets to the point. No filler.',
    example:  '"Issue logged. Here\'s what happens next."',
  },
  {
    id:       'warm',
    label:    'Warm & approachable',
    subtitle: 'Human first, solution second.',
    example:  '"I totally get that - let me sort this out for you."',
  },
  {
    id:       'precise',
    label:    'Precise & professional',
    subtitle: 'Formal, structured, no ambiguity.',
    example:  '"Your request has been received and is being reviewed."',
  },
  {
    id:       'evidence',
    label:    'Evidence-based & clear',
    subtitle: 'Reasoned, grounded, neutral.',
    example:  '"Based on your account history, the most likely cause is..."',
  },
]

// ── Tone card ─────────────────────────────────────────────────────────────────

function ToneCard({
  tone,
  selected,
  onSelect,
}: {
  tone: typeof TONES[number]
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      style={{
        background: 'var(--neutral-white)',
        border: selected ? '1px solid var(--blue-400)' : '1px solid var(--neutral-100)',
        borderRadius: 16,
        padding: 12,
        display: 'flex', flexDirection: 'column', gap: 9,
        boxShadow: selected
          ? '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--blue-200)'
          : '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
        cursor: 'pointer',
        width: 332,
        textAlign: 'left',
        transition: 'border-color 150ms, box-shadow 150ms',
      }}
    >
      {/* Header */}
      <div>
        <p style={{
          fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)',
          fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0,
        }}>
          {tone.label}
        </p>
        <p style={{
          fontFamily: 'var(--font-mono)', fontWeight: 400,
          fontSize: 13, lineHeight: '16px', color: 'var(--neutral-500)', margin: 0,
        }}>
          {tone.subtitle}
        </p>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(59,54,50,0.15)', width: '100%' }} />

      {/* Example */}
      <p style={{
        fontFamily: 'var(--font-body)', fontWeight: 400,
        fontSize: 14, lineHeight: '22px', color: '#857a72', margin: 0,
        overflow: 'hidden', display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      }}>
        <span style={{ color: '#c4af9f' }}>Ex - </span>
        {tone.example}
      </p>
    </button>
  )
}

// ── Inner page ────────────────────────────────────────────────────────────────

function TonePageContent() {
  const { push } = useRouter()
  const searchParams = useSearchParams()
  const template = searchParams.get('template') ?? ''

  const [selectedTone, setSelectedTone] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('{name}')

  // Read persona name from sessionStorage (stored by the name page)
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const draft = JSON.parse(sessionStorage.getItem(WIZARD_KEY) ?? '{}')
      if (draft.name) setDisplayName(draft.name)
    } catch { /* ignore */ }
  }, [])

  function buildQuery() {
    const p = new URLSearchParams()
    if (template) p.set('template', template)
    const qs = p.toString()
    return qs ? `?${qs}` : ''
  }

  function handleContinue() {
    if (!selectedTone) return
    try {
      const existing = JSON.parse(sessionStorage.getItem(WIZARD_KEY) ?? '{}')
      sessionStorage.setItem(WIZARD_KEY, JSON.stringify({ ...existing, tone: selectedTone }))
    } catch { /* ignore */ }
    push('/persona/configure/instructions')
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
            How should <em style={{ fontStyle: 'normal' }}>{displayName}</em> sound?
          </p>
          <p style={{
            fontFamily: 'var(--font-body)', fontWeight: 400,
            fontSize: 14, lineHeight: '22px', color: '#827a74', margin: 0,
          }}>
            This shapes how it writes, responds, and feels in conversation.
          </p>
        </div>

        {/* Tone grid + footer */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* 2×2 grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 19 }}>
              <ToneCard tone={TONES[0]} selected={selectedTone === TONES[0].id} onSelect={() => setSelectedTone(TONES[0].id)} />
              <ToneCard tone={TONES[1]} selected={selectedTone === TONES[1].id} onSelect={() => setSelectedTone(TONES[1].id)} />
            </div>
            <div style={{ display: 'flex', gap: 19 }}>
              <ToneCard tone={TONES[2]} selected={selectedTone === TONES[2].id} onSelect={() => setSelectedTone(TONES[2].id)} />
              <ToneCard tone={TONES[3]} selected={selectedTone === TONES[3].id} onSelect={() => setSelectedTone(TONES[3].id)} />
            </div>
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: 683, paddingTop: 64,
          }}>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ArrowLeftOneIcon size={16} />}
              onClick={() => push(`/personas/basics/name${buildQuery()}`)}
            >
              Back
            </Button>
            {/* eslint-disable-next-line react-doctor/design-no-vague-button-label -- wizard step: "Continue" advances to template selection; flow context makes action clear */}
            <Button
              variant="default"
              size="sm"
              rightIcon={<ArrowRightOneIcon size={16} />}
              disabled={!selectedTone}
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

export default function PersonaTonePage() {
  return (
    <Suspense>
      <TonePageContent />
    </Suspense>
  )
}
