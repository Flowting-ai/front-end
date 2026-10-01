'use client'

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeftOneIcon, ArrowRightOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { ConfirmModal } from '@/components/ConfirmModal'
import { Spinner } from '@/components/Spinner'
import { AdvancedPersonalizeModal } from '@/components/AgentEditor/AdvancedPersonalizeModal'
import { AgentEditor } from '@/components/AgentEditor/AgentEditor'
import { QuestionStep } from '@/components/AgentEditor/QuestionStep'
import { AgentPageHeader, AgentPageShell } from '../_components/AgentPageShell'
import { TEMPLATE_PRESETS } from '../_data/template-presets'
import { fetchModelsWithCache } from '@/lib/ai-models'
import { fetchPersonas } from '@/lib/api/personas'
import type { PersonaSound } from '@/lib/api/persona-schemas'
import type { AIModel } from '@/types/ai-model'
import {
  FALLBACK_TONES,
  PURPOSE_MAX,
  applyTone,
  deriveDescription,
  draftProblems,
  isDraftDirty,
  nextAgentName,
  previewHandle,
  readTone,
  type AgentDraft,
  type ClarifyingAnswer,
  type ClarifyingQuestion,
} from '@/lib/agent-draft'
import {
  generateAgentDraft,
  manualAgentDraft,
  regenerateInstructions,
  requestClarifyingQuestions,
  seedFromPreset,
} from '@/lib/agent-generate'
import { AgentSaveError, createAgent } from '@/lib/agent-save'
import { pickDifferentTemplateAvatar } from '@/lib/persona-template-avatars'
import { trackBrowserEvent } from '@/lib/analytics/events'
import { AGENT_EDIT_ROUTE, AGENTS_ROUTE, AGENTS_TEMPLATES_ROUTE } from '@/lib/routes'

const STARTER_CHIPS = [
  'Drafts weekly reports',
  'Summarises support tickets',
  'Answers policy questions',
  'Reviews contracts and flags risks',
] as const

type Stage = 'purpose' | 'asking' | 'questions' | 'generating' | 'failed' | 'editor'

const PROBLEM_MESSAGE = {
  name:         'Give the agent a name.',
  model:        'Choose a model for the agent.',
  instructions: 'Add instructions for the agent.',
} as const

// ── Small screens ─────────────────────────────────────────────────────────────

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 35, alignItems: 'center', width: '100%' }}>
      {children}
    </div>
  )
}

function Heading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', textAlign: 'center' }}>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)' }}>
        {title}
      </h1>
      {subtitle && (
        <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', maxWidth: 520 }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}

function PurposeStep({
  purpose, onChange, onContinue, onBack,
}: { purpose: string; onChange: (value: string) => void; onContinue: () => void; onBack: () => void }) {
  const { push } = useRouter()
  return (
    <Centered>
      <Heading title="What should this agent do?" subtitle="One sentence is enough — we’ll set up the name, model and instructions for you." />
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: 684, gap: 12 }}>
        <div
          style={{
            background: 'var(--neutral-white)', borderRadius: 10, padding: '12px 10px',
            boxShadow: '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
          }}
        >
          <textarea
            value={purpose}
            autoFocus
            rows={3}
            aria-label="Agent purpose"
            placeholder="e.g. Reviews contracts and flags risks in plain English"
            onChange={event => onChange(event.target.value.slice(0, PURPOSE_MAX))}
            onKeyDown={event => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); onContinue() }
            }}
            style={{
              width: '100%', resize: 'none', background: 'transparent', border: 'none', outline: 'none',
              fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)',
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)' }}>
          <span>Keep it to what the agent should do.</span>
          <span>{purpose.length}/{PURPOSE_MAX}</span>
        </div>

        <div role="group" aria-label="Starter ideas" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {STARTER_CHIPS.map(chip => (
            <button
              key={chip}
              type="button"
              onClick={() => onChange(chip)}
              style={{
                padding: '5px 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)', fontSize: 13, lineHeight: '20px',
                color: 'var(--neutral-700)', backgroundColor: 'var(--neutral-white)',
                boxShadow: '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
              }}
            >
              {chip}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 40 }}>
          <Button variant="outline" size="sm" leftIcon={<ArrowLeftOneIcon size={16} />} onClick={onBack}>
            Agents
          </Button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button variant="ghost" size="sm" onClick={() => push(AGENTS_TEMPLATES_ROUTE)}>
              Start from a template
            </Button>
            <Button
              variant="default"
              size="sm"
              rightIcon={<ArrowRightOneIcon size={16} />}
              disabled={purpose.trim().length === 0}
              onClick={onContinue}
            >
              Continue
            </Button>
          </div>
        </div>
      </div>
    </Centered>
  )
}

function WorkingStep({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <Centered>
      <div role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', paddingTop: 40 }}>
        <Spinner size={24} />
        <Heading title={title} subtitle={subtitle} />
      </div>
    </Centered>
  )
}

function FailedStep({
  onRetry, onManual, onEditPurpose,
}: { onRetry: () => void; onManual: () => void; onEditPurpose: () => void }) {
  return (
    <Centered>
      <Heading
        title="We couldn’t set up your agent"
        subtitle="Your purpose is saved. Try again, or fill in the details yourself."
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
        <Button variant="outline" size="sm" leftIcon={<ArrowLeftOneIcon size={16} />} onClick={onEditPurpose}>Edit purpose</Button>
        <Button variant="outline" size="sm" onClick={onManual}>Fill in manually</Button>
        <Button variant="default" size="sm" onClick={onRetry}>Try again</Button>
      </div>
    </Centered>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

function NewAgentContent() {
  const { push } = useRouter()
  const searchParams = useSearchParams()
  const templateSlug = searchParams.get('template') ?? ''
  const preset = templateSlug ? TEMPLATE_PRESETS[templateSlug] : undefined

  const [stage, setStage] = useState<Stage>('purpose')
  // A template's purpose, or one handed over from chat ("Create an agent that…").
  const [purpose, setPurpose] = useState(() => preset?.purpose ?? (searchParams.get('purpose') ?? '').slice(0, PURPOSE_MAX))
  const [questions, setQuestions] = useState<ClarifyingQuestion[]>([])
  const [answers, setAnswers] = useState<ClarifyingAnswer[]>([])
  const [draft, setDraft] = useState<AgentDraft | null>(null)
  const [tones, setTones] = useState<PersonaSound[]>(FALLBACK_TONES)

  const [models, setModels] = useState<AIModel[]>([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [takenHandles, setTakenHandles] = useState<ReadonlySet<string>>(new Set())

  const [saving, setSaving] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [confirm, setConfirm] = useState<'cancel' | 'instructions' | null>(null)

  // Drops the result of any generation the user has since left behind.
  const runRef = useRef(0)
  const modelsRef = useRef<Promise<AIModel[]>>(Promise.resolve([]))
  // What generation produced, for "has the user changed this?" checks.
  const generatedRef = useRef<AgentDraft | null>(null)
  // Once the agent exists the leave-warning must not fire for our own redirect.
  const leavingRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    modelsRef.current = fetchModelsWithCache().catch(() => [] as AIModel[])
    modelsRef.current.then(list => {
      if (cancelled) return
      setModels(list)
      setModelsLoading(false)
    })
    // Best-effort: lets the handle preview show the suffix the backend will add.
    fetchPersonas()
      .then(personas => {
        if (!cancelled) setTakenHandles(new Set(personas.filter(p => p.visibility === 'private').map(p => p.handle.replace(/^@/, ''))))
      })
      .catch(() => { /* preview only */ })
    return () => { cancelled = true }
  }, [])

  // Generated content isn't saved anywhere until Finish — warn before it's lost.
  useEffect(() => {
    if (stage !== 'editor') return
    const warn = (event: BeforeUnloadEvent) => {
      if (leavingRef.current) return
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [stage])

  const seed = useMemo(() => (preset ? seedFromPreset(preset) : undefined), [preset])

  const generate = useCallback(async (text: string, given: ClarifyingAnswer[], run: number) => {
    setAnswers(given)
    setStage('generating')
    const catalog = await modelsRef.current
    try {
      const result = await generateAgentDraft({ purpose: text, answers: given, models: catalog, seed })
      if (run !== runRef.current) return
      generatedRef.current = result.draft
      setDraft(result.draft)
      setTones(result.tones)
      setStage('editor')
    } catch {
      if (run !== runRef.current) return
      setStage('failed')
    }
  }, [seed])

  async function handleContinue() {
    const text = purpose.trim()
    if (!text) return
    const run = ++runRef.current
    if (preset) {
      // Templates already carry a complete setup — no questions to ask.
      await generate(text, [], run)
      return
    }
    setStage('asking')
    const found = await requestClarifyingQuestions(text)
    if (run !== runRef.current) return
    if (found.length === 0) {
      await generate(text, [], run)
      return
    }
    setQuestions(found)
    setStage('questions')
  }

  async function handleAnswers(given: ClarifyingAnswer[]) {
    const run = ++runRef.current
    await generate(purpose.trim(), given, run)
  }

  function handleManual() {
    const result = manualAgentDraft(purpose.trim(), models, seed)
    runRef.current += 1
    generatedRef.current = result.draft
    setDraft(result.draft)
    setTones(result.tones)
    setStage('editor')
  }

  function editDraft(patch: Partial<AgentDraft>) {
    setDraft(current => (current ? { ...current, ...patch } : current))
  }

  async function runRegenerateInstructions() {
    if (!draft) return
    setRegenerating(true)
    try {
      const fresh = await regenerateInstructions({ name: draft.name.trim() || draft.name, purpose: purpose.trim(), answers })
      // Keep the tone the user had chosen, if it is one we can name.
      const previous = readTone(draft.instructions, tones)
      const next = previous.kind === 'known' ? applyTone(fresh.instructions, previous.tone) : fresh.instructions
      generatedRef.current = generatedRef.current ? { ...generatedRef.current, instructions: next } : generatedRef.current
      setTones(fresh.tones)
      setDraft(current => (current ? { ...current, instructions: next } : current))
    } catch {
      toast.error('Couldn’t generate new instructions. Please try again.')
    } finally {
      setRegenerating(false)
    }
  }

  function handleRegenerateInstructions() {
    if (!draft) return
    const edited = !generatedRef.current || draft.instructions !== generatedRef.current.instructions
    if (edited && draft.instructions.trim()) setConfirm('instructions')
    else void runRegenerateInstructions()
  }

  async function handleFinish() {
    if (!draft || saving) return
    const [problem] = draftProblems(draft)
    if (problem) {
      toast.error(PROBLEM_MESSAGE[problem])
      return
    }
    setSaving(true)
    try {
      const created = await createAgent(draft, { templateSlug: preset ? templateSlug : undefined })
      leavingRef.current = true
      if (created.published) {
        toast.success(`“${draft.name.trim()}” is ready`)
        push(`${AGENTS_ROUTE}?agent=${created.repoId}`)
      } else {
        toast.warning('Your agent was created but isn’t live yet. Save it again to finish.')
        push(AGENT_EDIT_ROUTE(created.repoId))
      }
      // Stays "saving" on purpose: the page is navigating away, and re-enabling
      // Finish here would let a double-click create the agent twice.
    } catch (error) {
      toast.error(error instanceof AgentSaveError ? error.message : 'Failed to create the agent. Please try again.')
      setSaving(false)
    }
  }

  function handleCancel() {
    if (draft && generatedRef.current && isDraftDirty(draft, generatedRef.current)) {
      setConfirm('cancel')
      return
    }
    leaveWithoutSaving()
  }

  function leaveWithoutSaving() {
    leavingRef.current = true
    trackBrowserEvent('agent_wizard_abandoned', { last_step: 'editor' })
    push(AGENTS_ROUTE)
  }

  const handle = draft && draft.name.trim() ? previewHandle(draft.name, takenHandles) : ''

  // ── Editor ──────────────────────────────────────────────────────────────────
  if (stage === 'editor' && draft) {
    return (
      <AgentPageShell>
        <AgentPageHeader
          title="New agent — review & edit"
          subtitle="Everything is pre-filled. Change anything, then finish to create your agent."
          actions={
            <>
              <Button variant="outline" size="sm" onClick={handleCancel} disabled={saving}>Cancel</Button>
              <Button variant="default" size="sm" onClick={() => void handleFinish()} loading={saving} disabled={saving}>
                Finish — create agent
              </Button>
            </>
          }
        />
        <AgentEditor
          draft={draft}
          onChange={editDraft}
          tones={tones}
          models={models}
          modelsLoading={modelsLoading}
          handle={handle}
          disabled={saving}
          onRegenerateName={() => editDraft({ name: nextAgentName(purpose, draft.name) })}
          onRegenerateDescription={() => editDraft({ description: deriveDescription(purpose) })}
          onRegenerateAvatar={() => editDraft({ avatarUrl: pickDifferentTemplateAvatar(draft.avatarUrl) })}
          onRegenerateInstructions={handleRegenerateInstructions}
          regeneratingInstructions={regenerating}
          onOpenAdvanced={() => setAdvancedOpen(true)}
        />

        <AdvancedPersonalizeModal
          open={advancedOpen}
          onClose={() => setAdvancedOpen(false)}
          values={{ instructions: draft.instructions, temperature: draft.temperature }}
          tones={tones}
          saveLabel="Apply"
          onSave={values => editDraft(values)}
        />

        {confirm === 'cancel' && (
          <ConfirmModal
            title="Discard this agent?"
            description="Nothing has been saved yet. If you leave now, this agent is lost."
            confirmLabel="Discard"
            cancelLabel="Keep editing"
            onConfirm={async () => { leaveWithoutSaving() }}
            onClose={() => setConfirm(null)}
          />
        )}
        {confirm === 'instructions' && (
          <ConfirmModal
            title="Replace your instructions?"
            description="You’ve edited the instructions. Generating new ones replaces what’s there now."
            confirmLabel="Generate new"
            cancelLabel="Keep mine"
            danger={false}
            onConfirm={async () => { await runRegenerateInstructions() }}
            onClose={() => setConfirm(null)}
          />
        )}
      </AgentPageShell>
    )
  }

  // ── Everything before the editor ────────────────────────────────────────────
  return (
    <AgentPageShell maxWidth={720}>
      {stage === 'purpose' && (
        <PurposeStep
          purpose={purpose}
          onChange={setPurpose}
          onContinue={() => void handleContinue()}
          onBack={() => push(AGENTS_ROUTE)}
        />
      )}
      {stage === 'asking' && (
        <WorkingStep title="Reading your purpose…" subtitle="Checking whether anything needs clarifying." />
      )}
      {stage === 'questions' && (
        <Centered>
          <Heading title="A couple of quick questions" subtitle="Pick the closest answer — or skip to use the defaults." />
          <div style={{ width: '100%', maxWidth: 754 }}>
            <QuestionStep questions={questions} onSubmit={given => void handleAnswers(given)} />
          </div>
        </Centered>
      )}
      {stage === 'generating' && (
        <WorkingStep title="Setting up your agent…" subtitle="Writing the instructions and picking a model." />
      )}
      {stage === 'failed' && (
        <FailedStep
          onRetry={() => { const run = ++runRef.current; void generate(purpose.trim(), answers, run) }}
          onManual={handleManual}
          onEditPurpose={() => { runRef.current += 1; setStage('purpose') }}
        />
      )}
    </AgentPageShell>
  )
}

export default function NewAgentPage() {
  return (
    <Suspense>
      <NewAgentContent />
    </Suspense>
  )
}
