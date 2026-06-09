'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeftOneIcon, ArrowRightOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { WizardShell, STEPS_BASICS } from '../../_components/WizardShell'
import { TEMPLATE_PRESETS } from '../../_data/template-presets'

// ── Session-storage key ────────────────────────────────────────────────────

const WIZARD_KEY = 'persona_wizard_draft'

// ── Tone options ──────────────────────────────────────────────────────────────

interface ToneOption {
  id: string
  label: string
  subtitle: string
  example?: string
}

// Fallback tones shown only when no starter data is available
const FALLBACK_TONES: ToneOption[] = [
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

function starterSoundsToTones(
  starter: { sounds?: Array<{ name: string; description: string }> } | null | undefined
): ToneOption[] {
  if (!starter?.sounds?.length) return []
  return starter.sounds.map(s => ({
    id: s.name.toLowerCase().replace(/\s+/g, '-'),
    label: s.name,
    subtitle: s.description,
  }))
}

// ── Tone card ─────────────────────────────────────────────────────────────────

function ToneCard({
  tone,
  selected,
  onSelect,
}: {
  tone: ToneOption
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

      {/* Example (omitted when starter sounds don't include one) */}
      {tone.example && (
        <p style={{
          fontFamily: 'var(--font-body)', fontWeight: 400,
          fontSize: 14, lineHeight: '22px', color: '#857a72', margin: 0,
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          <span style={{ color: '#c4af9f' }}>Ex - </span>
          {tone.example}
        </p>
      )}
    </button>
  )
}

// ── Inner page ────────────────────────────────────────────────────────────────

function TonePageContent() {
  const { push } = useRouter()
  const searchParams = useSearchParams()
  const template = searchParams.get('template') ?? ''

  // Compute the available tone cards from starter sounds (or fallback to hardcoded)
  const [tones] = useState<ToneOption[]>(() => {
    if (typeof window === 'undefined') return FALLBACK_TONES
    try {
      if (template) return FALLBACK_TONES
      const starter = JSON.parse(sessionStorage.getItem('persona_wizard_starter') ?? 'null') as { sounds?: Array<{ name: string; description: string }> } | null
      const fromStarter = starterSoundsToTones(starter)
      return fromStarter.length > 0 ? fromStarter : FALLBACK_TONES
    } catch { return FALLBACK_TONES }
  })

  const [selectedTone, setSelectedTone] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const draft = JSON.parse(sessionStorage.getItem(WIZARD_KEY) ?? '{}')
      // Restore if same template (back navigation)
      if (draft.template === template && draft.tone) return draft.tone
      // Pre-select from template preset on first visit
      if (template) return TEMPLATE_PRESETS[template]?.tone ?? null
      // Auto-select the first starter sound (it's the backend's recommendation)
      const starter = JSON.parse(sessionStorage.getItem('persona_wizard_starter') ?? 'null') as { sounds?: Array<{ name: string; description: string }> } | null
      const fromStarter = starterSoundsToTones(starter)
      return fromStarter[0]?.id ?? null
    } catch { return null }
  })
  const [displayName, setDisplayName] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    try {
      const draft = JSON.parse(sessionStorage.getItem(WIZARD_KEY) ?? '{}')
      return draft.name ?? ''
    } catch { return '' }
  })

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
    push('/agent/configure/instructions')
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
            How should <em style={{ fontStyle: 'normal' }}>{displayName || 'your agent'}</em> sound?
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
          {/* Tone cards — dynamic from starter sounds, or 2×2 fallback grid */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, maxWidth: 683 }}>
            {tones.map(tone => (
              <ToneCard
                key={tone.id}
                tone={tone}
                selected={selectedTone === tone.id}
                onSelect={() => setSelectedTone(tone.id)}
              />
            ))}
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
              onClick={() => push(`/agents/basics/name${buildQuery()}`)}
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
