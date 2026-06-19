'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeftOneIcon, ArrowRightOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { toast } from 'sonner'
import { WizardShell, STEPS_BASICS } from '../../_components/WizardShell'
import { TEMPLATE_PRESETS } from '../../_data/template-presets'
import { personaStarter, createPersonaRepo } from '@/lib/api/personas'
import { fetchModelsWithCache } from '@/lib/ai-models'
import { stableKey } from '@/hooks/use-model-selection'
import { pickTemplateAvatar } from '@/lib/persona-template-avatars'

// ── Session-storage key ────────────────────────────────────────────────────

const WIZARD_KEY = 'persona_wizard_draft'

// ── Tone options ──────────────────────────────────────────────────────────────

interface ToneOption {
  id: string
  label: string
  subtitle: string
  example?: string
}

// Shown while the API fetch is in-flight, or if the fetch fails
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
    id:       s.name.toLowerCase().replace(/\s+/g, '-'),
    label:    s.name,
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

      <div style={{ height: 1, background: 'rgba(59,54,50,0.15)', width: '100%' }} />

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

function ToneCardSkeleton() {
  return (
    <div style={{
      background: 'var(--neutral-50)',
      border: '1px solid var(--neutral-100)',
      borderRadius: 16,
      padding: 12,
      width: 332,
      height: 108,
      animation: 'pulse 1.5s ease-in-out infinite',
    }} />
  )
}

// ── Inner page ────────────────────────────────────────────────────────────────

function TonePageContent() {
  const { push } = useRouter()
  const searchParams = useSearchParams()
  const template = searchParams.get('template') ?? ''

  // Tones: synchronously pre-populate from cached starter sounds (handles back-navigation
  // — IDs stay consistent with the saved draft.tone). Falls back to FALLBACK_TONES while
  // the API fetch runs on first visit.
  const [tones, setTones] = useState<ToneOption[]>(() => {
    if (typeof window === 'undefined' || template) return FALLBACK_TONES
    try {
      const cached = JSON.parse(sessionStorage.getItem('persona_wizard_starter') ?? 'null') as { sounds?: Array<{ name: string; description: string }> } | null
      const fromCached = starterSoundsToTones(cached)
      if (fromCached.length > 0) return fromCached
    } catch { }
    return FALLBACK_TONES
  })

  // Only show loading state when we need a fresh API fetch (no cached sounds yet)
  const [isLoadingTones, setIsLoadingTones] = useState(() => {
    if (typeof window === 'undefined' || template) return false
    try {
      const cached = JSON.parse(sessionStorage.getItem('persona_wizard_starter') ?? 'null') as { sounds?: Array<{ name: string; description: string }> } | null
      return starterSoundsToTones(cached).length === 0
    } catch { return true }
  })

  const [selectedTone, setSelectedTone] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const draft = JSON.parse(sessionStorage.getItem(WIZARD_KEY) ?? '{}')
      // Restore on back navigation — stored ID always matches the loaded tone set
      if ((draft.template ?? '') === template && draft.tone) return draft.tone
      if (template) return TEMPLATE_PRESETS[template]?.tone ?? null
      return null
    } catch { return null }
  })

  const [displayName, setDisplayName] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    try {
      const draft = JSON.parse(sessionStorage.getItem(WIZARD_KEY) ?? '{}')
      return draft.name ?? ''
    } catch { return '' }
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const draft = JSON.parse(sessionStorage.getItem(WIZARD_KEY) ?? '{}')
      if (draft.name) setDisplayName(draft.name)
    } catch { /* ignore */ }
  }, [])

  // Fetch dynamic tone options from the backend on first visit.
  // Skipped when cached sounds are already available (back-navigation case).
  useEffect(() => {
    if (!isLoadingTones) return

    let cancelled = false
    const draft = (() => {
      try { return JSON.parse(sessionStorage.getItem(WIZARD_KEY) ?? '{}') } catch { return {} }
    })()

    personaStarter({
      name:        (draft.name    as string | undefined) ?? '',
      description: (draft.purpose as string | undefined) ?? '',
      tone:        undefined,
    })
      .then(starter => {
        if (cancelled) return
        try { sessionStorage.setItem('persona_wizard_starter', JSON.stringify(starter)) } catch { /* quota */ }
        const fromStarter = starterSoundsToTones(starter)
        if (fromStarter.length > 0) {
          setTones(fromStarter)
          // Clear any draft tone that no longer matches the new tone set
          setSelectedTone(prev => fromStarter.some(t => t.id === prev) ? prev : null)
        }
      })
      .catch(() => { /* keep FALLBACK_TONES on error */ })
      .finally(() => { if (!cancelled) setIsLoadingTones(false) })

    return () => { cancelled = true }
  }, [isLoadingTones])

  function buildQuery() {
    const p = new URLSearchParams()
    if (template) p.set('template', template)
    const qs = p.toString()
    return qs ? `?${qs}` : ''
  }

  const [isLoading, setIsLoading] = useState(false)

  async function handleContinue() {
    if (!selectedTone || isLoading) return

    // Save tone to wizard draft
    try {
      const existing = JSON.parse(sessionStorage.getItem(WIZARD_KEY) ?? '{}')
      sessionStorage.setItem(WIZARD_KEY, JSON.stringify({ ...existing, tone: selectedTone }))
    } catch { /* ignore */ }

    // If repo was already created on a prior Continue (back-nav from instructions),
    // navigate straight to it — don't create a duplicate.
    try {
      const existingRepo = JSON.parse(sessionStorage.getItem('persona_wizard_repo') ?? 'null') as { repoId?: string; versionId?: string } | null
      if (existingRepo?.repoId && existingRepo?.versionId) {
        push(`/agent/configure/instructions?repoId=${existingRepo.repoId}&versionId=${existingRepo.versionId}`)
        return
      }
    } catch { /* ignore */ }

    setIsLoading(true)
    try {
      const draft          = JSON.parse(sessionStorage.getItem(WIZARD_KEY) ?? '{}')
      const effectiveName  = (draft.name    as string | undefined) || 'Untitled Agent'
      const wizardPurpose  = (draft.purpose as string | undefined) || ''
      const wizardTemplate = (draft.template as string | undefined) || ''
      const templatePreset = wizardTemplate ? (TEMPLATE_PRESETS[wizardTemplate] ?? null) : null

      // Get full starter (personalized instruction + persona tags).
      // For templates, the preset instruction takes precedence; we still call for tags.
      let initialPrompt      = templatePreset?.systemInstruction ?? ''
      let starterPersonaTags: string[] = []
      try {
        const starter = await personaStarter({
          name:        effectiveName,
          description: wizardPurpose,
          tone:        selectedTone,
        })
        try { sessionStorage.setItem('persona_wizard_starter', JSON.stringify(starter)) } catch { /* quota */ }
        if (!initialPrompt) initialPrompt = starter.system_instruction ?? ''
        starterPersonaTags = starter.persona_tags ?? []
      } catch {
        // Non-critical — repo still created with empty instruction
      }

      // Fetch models and pick the best one (template hint or first available)
      const models = await fetchModelsWithCache()
      const firstModel = models[0] ?? null
      if (!firstModel) {
        toast.error('No AI models available. Please contact support.')
        return
      }
      // The backend requires model_id on creation, so we always seed the first
      // available model. The `persona_wizard_no_model` flag (set below) makes
      // the Instructions tab start with NO model selected for ALL agents so the
      // user must choose explicitly — the seeded value is overwritten on first save.
      const chosenModelId = stableKey(firstModel) ?? ''

      // Create the repo + initial version
      const repo         = await createPersonaRepo({
        name:        effectiveName,
        modelId:     chosenModelId,
        prompt:      initialPrompt,
        description: wizardPurpose,
      })
      const newRepoId    = repo.id
      const newVersionId = repo.active_version?.id ?? ''

      // Persist wizard state so back-nav detects the created repo
      try { sessionStorage.setItem('persona_wizard_repo', JSON.stringify({ repoId: newRepoId, versionId: newVersionId })) } catch { /* ignore */ }
      // Record the wizard-created version as the "provisional initial" version.
      // The first explicit Save updates it in place (staying v001) instead of
      // minting a duplicate v002; this marker is consumed on that first save.
      try { if (newVersionId) sessionStorage.setItem(`persona_initial_version_${newRepoId}`, newVersionId) } catch { /* ignore */ }
      // Model should never be pre-selected — the user must pick one explicitly
      // on the Instructions tab before they can save or publish.
      try { sessionStorage.setItem(`persona_wizard_no_model_${newRepoId}`, '1') } catch { /* ignore */ }
      // Keep purpose accessible to profile tab description fallback
      if (wizardPurpose) {
        try { sessionStorage.setItem(`persona_wizard_purpose_${newRepoId}`, wizardPurpose) } catch { /* ignore */ }
      }

      // Seed profile draft (avatar + wizard data) so profile tab shows correct data immediately
      const avatarPath = pickTemplateAvatar()
      try {
        sessionStorage.setItem(`persona_profile_${newRepoId}`, JSON.stringify({
          avatarUrl:          avatarPath,
          personaName:        effectiveName || undefined,
          personaDescription: wizardPurpose || undefined,
          personaTags:        starterPersonaTags.length > 0 ? starterPersonaTags : undefined,
        }))
      } catch { /* ignore quota errors */ }

      // Clean up wizard draft now that the repo exists
      try { sessionStorage.removeItem('persona_wizard_draft') } catch { /* ignore */ }

      push(`/agent/configure/instructions?repoId=${newRepoId}&versionId=${newVersionId}`)
    } catch (err) {
      console.error('[TonePage] agent creation error:', err)
      toast.error('Failed to create agent. Please try again.')
    } finally {
      setIsLoading(false)
    }
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, maxWidth: 683 }}>
            {isLoadingTones
              ? Array.from({ length: 4 }).map((_, i) => <ToneCardSkeleton key={i} />)
              : tones.map(tone => (
                  <ToneCard
                    key={tone.id}
                    tone={tone}
                    selected={selectedTone === tone.id}
                    onSelect={() => setSelectedTone(tone.id)}
                  />
                ))
            }
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
              onClick={() => {
                if (selectedTone) {
                  try {
                    const existing = JSON.parse(sessionStorage.getItem(WIZARD_KEY) ?? '{}')
                    sessionStorage.setItem(WIZARD_KEY, JSON.stringify({ ...existing, tone: selectedTone }))
                  } catch { /* ignore */ }
                }
                push(`/agents/basics/name${buildQuery()}`)
              }}
            >
              Back
            </Button>
            <Button
              variant="default"
              size="sm"
              rightIcon={<ArrowRightOneIcon size={16} />}
              disabled={!selectedTone || isLoading || isLoadingTones}
              loading={isLoading}
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
