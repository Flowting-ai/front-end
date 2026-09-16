'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeftOneIcon, ArrowRightOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { WizardShell, STEPS_BASICS } from '../../_components/WizardShell'
import { TEMPLATE_PRESETS } from '../../_data/template-presets'
import { AGENTS_BASICS_TONE_ROUTE, AGENTS_BASICS_PURPOSE_ROUTE } from '@/lib/routes'
import { prefetchPersonaStarter } from '@/lib/persona-wizard-prefetch'
import { fetchPersonas } from '@/lib/api/personas'

// ── Session-storage key (shared across wizard pages) ─────────────────────────

const WIZARD_KEY = 'persona_wizard_draft'

// ── Derive a URL-safe handle slug from name ───────────────────────────────────
// Mirrors the backend's actual `slugify()` (back-end/services/persona/repository.py):
// lowercase, collapse non-alphanumeric runs to a single hyphen, trim leading/
// trailing hyphens, fall back to "persona" if that leaves nothing.
function slugify(name: string) {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return slug || 'persona'
}

// Mirrors the backend's allocate_handler(): if the base slug is already taken
// (by one of the viewer's own agents), try `base-2`, `base-3`, ... until free.
// Still just a preview — the backend re-derives and allocates the real handle
// itself on create, under a row lock, so this can't be 100% authoritative
// (e.g. a handle taken by someone else's create between this render and
// submit), but it matches what the backend will very likely produce.
function previewHandle(name: string, takenHandles: Set<string>) {
  const base = slugify(name)
  if (!takenHandles.has(base)) return base
  let n = 2
  while (takenHandles.has(`${base}-${n}`)) n++
  return `${base}-${n}`
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

  // The viewer's own already-used handles, for an accurate collision preview.
  // `visibility === 'private'` personas are the only ones reliably "mine"
  // client-side (the backend only ever returns your own private personas to
  // you — team-visibility ones have no reliable per-persona owner on the
  // frontend), so that's what this checks against.
  const [takenHandles, setTakenHandles] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    fetchPersonas()
      .then(personas => {
        if (cancelled) return
        setTakenHandles(new Set(
          personas
            .filter(p => p.visibility === 'private')
            .map(p => p.handle.replace(/^@/, '')),
        ))
      })
      .catch(() => { /* best-effort preview — falls back to no collision check */ })
    return () => { cancelled = true }
  }, [])

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
    // Fire the tone options request now instead of waiting for the Tone page to
    // mount, so its latency overlaps with this navigation. Skipped when a cached
    // starter already covers this draft (back-nav) — the Tone page will use that
    // instead and this request would just be wasted.
    try {
      const draft  = JSON.parse(sessionStorage.getItem(WIZARD_KEY) ?? '{}')
      const cached = JSON.parse(sessionStorage.getItem('persona_wizard_starter') ?? 'null') as { sounds?: unknown[] } | null
      if (!cached?.sounds?.length) {
        prefetchPersonaStarter(name, (draft.purpose as string | undefined) ?? '')
      }
    } catch { /* ignore */ }
    push(`${AGENTS_BASICS_TONE_ROUTE}${buildQuery()}`)
  }

  const handleSlug = useMemo(() => name.trim() ? previewHandle(name, takenHandles) : '', [name, takenHandles])
  const handle = handleSlug ? `@${handleSlug}` : ''

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
                  @<strong style={{ fontWeight: 'var(--font-weight-medium)' }}>{handleSlug}</strong>
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
                push(`${AGENTS_BASICS_PURPOSE_ROUTE}${buildQuery()}`)
              }}
            >
              Back
            </Button>
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
