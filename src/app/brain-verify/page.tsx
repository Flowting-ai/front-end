'use client'

// ── Dev-only verification harness ──────────────────────────────────────────
// Mounts the REAL components changed for the Brain feedback-loop / error-card
// work (ClarificationCard → QuestionCard, NodeFailureCard, PauseCard,
// BrainNarration) with the same prop wiring page.tsx uses, plus a live readout
// of what each flow captures. Lives outside the (app) group so it skips the
// auth shell but still inherits globals.css + MotionProvider from the root
// layout. Not linked anywhere — reach it at /brain-verify. Safe to delete.

import React, { useRef, useState } from 'react'
import {
  ClarificationCard,
  NodeFailureCard,
  PauseCard,
  BrainNarration,
} from '@/templates/Brain'
import type { QuestionCardOption } from '@/components/QuestionCard'

const FREE_TEXT_Q = 'Who is the email to, and what should it say?'
const MULTI_Q = 'Which sources should I pull from?'
const SINGLE_Q = 'Which tone do you want?'

const MULTI_OPTS: QuestionCardOption[] = [
  { id: 'tickets', label: 'Support tickets' },
  { id: 'interviews', label: 'User interviews' },
  { id: 'nps', label: 'NPS surveys' },
  { id: 'sales', label: 'Sales call notes' },
]
const SINGLE_OPTS: QuestionCardOption[] = [
  { id: 'direct', label: 'Direct & confident' },
  { id: 'warm', label: 'Warm & approachable' },
  { id: 'formal', label: 'Precise & professional' },
]

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 760, width: '100%' }}>
      <div>
        <h2 style={{ fontFamily: 'var(--font-title)', fontSize: 20, color: 'var(--neutral-900)', margin: 0 }}>{title}</h2>
        {hint && <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-500)', margin: '4px 0 0' }}>{hint}</p>}
      </div>
      {children}
    </section>
  )
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div data-testid={`readout-${label}`} style={{
      fontFamily: 'var(--font-code)', fontSize: 13, color: 'var(--neutral-700)',
      background: 'var(--neutral-100)', borderRadius: 8, padding: '8px 12px',
    }}>
      <strong>{label}:</strong> <span data-readout={label}>{value || '—'}</span>
    </div>
  )
}

export default function BrainVerifyPage() {
  // Free-text
  const freeTextRef = useRef('')
  const [freeTextSubmitted, setFreeTextSubmitted] = useState('')

  // Multi-select
  const [multiSel, setMultiSel] = useState<string[]>([])
  const [multiSubmitted, setMultiSubmitted] = useState<string[]>([])
  const toggleMulti = (id: string) =>
    setMultiSel((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  // Single-choice (regression)
  const [singleSel, setSingleSel] = useState<string | undefined>()
  const [singleSubmitted, setSingleSubmitted] = useState('')

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--neutral-50)',
      padding: '48px 32px', display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 48,
    }}>
      <h1 style={{ fontFamily: 'var(--font-title)', fontSize: 28, color: 'var(--neutral-950)', margin: 0 }}>
        Brain verification harness
      </h1>

      {/* 1 — Free-text: textarea must be OPEN by default (the bug fix) */}
      <Section title="1 · Free-text clarification" hint="Textarea should be open immediately (no click needed). Type, then Send — the value must be captured.">
        <ClarificationCard
          question={FREE_TEXT_Q}
          options={[]}
          openEndedLabel="Type your answer…"
          onOpenEndedSubmit={(t) => { freeTextRef.current = t }}
          onSend={() => setFreeTextSubmitted(freeTextRef.current)}
          onSkip={() => setFreeTextSubmitted('(skipped)')}
        />
        <Readout label="free-text-submitted" value={freeTextSubmitted} />
      </Section>

      {/* 2 — Multi-select: checkboxes, N Selected, array capture */}
      <Section title="2 · Multi-select clarification" hint="Checkboxes (toggle multiple). Header shows 'N Selected'. Send captures an array. Empty submit allowed.">
        <ClarificationCard
          question={MULTI_Q}
          options={MULTI_OPTS}
          multiSelect
          selected={multiSel}
          selectionCount={multiSel.length}
          onSelect={toggleMulti}
          onSend={() => setMultiSubmitted(multiSel)}
          onSkip={() => setMultiSubmitted([])}
        />
        <Readout label="multi-submitted" value={multiSubmitted.join(', ')} />
      </Section>

      {/* 3 — Single-choice (regression: radios, replace-on-pick) */}
      <Section title="3 · Single-choice (regression)" hint="Radios — picking one replaces the prior. Should be unchanged by the multi work.">
        <ClarificationCard
          question={SINGLE_Q}
          options={SINGLE_OPTS}
          selected={singleSel}
          onSelect={setSingleSel}
          onSend={() => setSingleSubmitted(SINGLE_OPTS.find((o) => o.id === singleSel)?.label ?? '')}
          onSkip={() => setSingleSubmitted('(skipped)')}
        />
        <Readout label="single-submitted" value={singleSubmitted} />
      </Section>

      {/* 4 — NodeFailureCard (FE-display recovery): Re-run / Cancel, NO Skip */}
      <Section title="4 · Node-failed card" hint="Shows the failed step + error. Re-run / Cancel only — no 'Skip step' (no backend skip in FE-display scope).">
        <NodeFailureCard
          step={{ label: 'Pull interview transcripts from Notion', isCritical: false }}
          errorMessage="Notion API returned 403: the connected workspace lacks read access to that database."
          onRerun={() => {}}
          onCancel={() => {}}
        />
      </Section>

      {/* 5 — PauseCard: 'Change direction' present (now returns to ChatInput) */}
      <Section title="5 · Pause card (Stop)" hint="Continue / Change direction / Cancel. 'Change direction' now returns to the ChatInput to retype.">
        <PauseCard
          pausedAfterStep="Identify recurring pain-point themes"
          onContinue={() => {}}
          onChangeDirection={() => {}}
          onCancel={() => {}}
        />
      </Section>

      {/* 6 — Counter narration (the in-thread revision note) */}
      <Section title="6 · Counter narration" hint="Shown in-thread while Brain re-plans after a counter.">
        <BrainNarration text={'Revising the plan based on your note: “focus on enterprise customers only”'} />
      </Section>
    </div>
  )
}
