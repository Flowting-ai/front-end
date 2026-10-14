'use client'

import React, { useMemo } from 'react'
import { ArrowLeftOneIcon, ArrowRightOneIcon, CancelOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/Badge'
import { InputField } from '@/components/InputField'
import { OptionRow } from '@/components/OptionRow'
import type { OptionRowVariant } from '@/components/OptionRow'
import { EnhanceDotProgress } from '@/components/EnhanceDotProgress'
import { EnhanceScanningState } from '@/components/EnhanceScanningState'
import { EnhanceSummaryBar } from '@/components/EnhanceSummaryBar'
import { DiffLine } from '@/components/DiffLine'
import { diffLines, diffSummary, type Question } from '@/enhance'
import { MarkdownRenderer } from '@/lib/markdown-utils'
import type { EnhancePhase } from '@/lib/enhance/enhance-flow'
import type { EnhanceFlow } from './use-enhance-flow'

/**
 * The open Enhance panel: header, the view for the current phase, and the footer. Loaded on the
 * first open (index.tsx), so the diff, the markdown preview and the Q&A rows stay out of the agent
 * editor's first load. All state comes from the flow; this file only draws.
 */
export default function EnhancePanel({ flow, value }: { flow: EnhanceFlow; value: string }) {
  const { state } = flow
  const isAudit = state.mode === 'AUDIT'
  const headerLabel =
    state.phase === 'complete' ? 'Your prompt looks comprehensive'
  : isAudit                    ? 'Reviewing your prompt'
  : `Enhance - ${state.mode}`
  const currentQuestion = state.questions[state.qIdx]

  const diffSegments = useMemo(
    () => (state.phase === 'diff' ? diffLines(value, state.draft) : []),
    [state.phase, value, state.draft],
  )
  const summary = useMemo(
    () => (state.phase === 'diff' ? diffSummary(value, state.draft) : { wordsAdded: 0, guidelineGroups: 0 }),
    [state.phase, value, state.draft],
  )

  return (
    <>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h2 style={{
                    margin:     0,
                    fontFamily: 'var(--font-body)',
                    fontWeight: 'var(--font-weight-medium)',
                    fontSize:   'var(--font-size-body-lg, 16px)',
                    lineHeight: 1.3,
                    color:      'var(--neutral-900)',
                  }}>
                    {headerLabel}
                  </h2>
                  {isAudit && state.phase !== 'complete' && (
                    <Badge color="Purple" label="Audit" />
                  )}
                </div>
                <button
                  type="button"
                  aria-label="Close Enhance"
                  onClick={flow.close}
                  style={{
                    display:         'inline-flex',
                    alignItems:      'center',
                    justifyContent:  'center',
                    width:           28,
                    height:          28,
                    padding:         0,
                    border:          'none',
                    borderRadius:    6,
                    backgroundColor: 'transparent',
                    color:           'var(--neutral-700)',
                    cursor:          'pointer',
                  }}
                >
                  <CancelOneIcon size={18} />
                </button>
              </div>

              {/* Body - switches on state */}
              <div
                className="kaya-scrollbar"
                style={{
                  flex:                '1 1 0',
                  minHeight:           0,
                  overflowY:           'auto',
                  overscrollBehaviorY: 'contain',
                  display:             'flex',
                  flexDirection:       'column',
                  gap:                 16,
                  // This scroll area clips overflow, which cut off the left edge of the custom input and
                  // its pink focus ring. 8px of padding gives the ring room; the matching negative
                  // margin eats into the panel's own 20px padding, so nothing shifts.
                  padding:             8,
                  margin:              -8,
                }}
              >
              {state.phase === 'scanning' && (
                <>
                  <EnhanceScanningState />
                  {state.waiting && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: -16 }}>
                      {state.slow && (
                        <p role="status" style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', lineHeight: 'var(--line-height-caption)', color: 'var(--neutral-600)', textAlign: 'center' }}>
                          Still working on it — this can take a little while.
                        </p>
                      )}
                      <Button size="sm" variant="ghost" onClick={flow.close}>Cancel</Button>
                    </div>
                  )}
                </>
              )}

              {state.phase === 'qa' && currentQuestion && (
                <QAStep
                  question={currentQuestion}
                  qIdx={state.qIdx}
                  total={state.questions.length}
                  audit={isAudit}
                  answers={state.answers[currentQuestion.id] ?? []}
                  customText={state.customText[currentQuestion.id] ?? ''}
                  onToggleOption={(label) => flow.toggleOption(currentQuestion.id, label)}
                  onCustomChange={(t) => flow.setCustom(currentQuestion.id, t)}
                  onCustomCommit={() => flow.commitCustom(currentQuestion.id)}
                  onCustomRemove={(label) => flow.removeAnswer(currentQuestion.id, label)}
                />
              )}

              {state.phase === 'diff' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <EnhanceSummaryBar
                    wordsAdded={summary.wordsAdded}
                    guidelineGroups={summary.guidelineGroups}
                  />
                  <div role="group" aria-label="View" style={{ display: 'flex', gap: 6 }}>
                    <Button size="sm" variant={state.diffView === 'changes' ? 'default' : 'ghost'} aria-pressed={state.diffView === 'changes'} onClick={() => flow.setDiffView('changes')}>Changes</Button>
                    <Button size="sm" variant={state.diffView === 'preview' ? 'default' : 'ghost'} aria-pressed={state.diffView === 'preview'} onClick={() => flow.setDiffView('preview')}>Preview</Button>
                  </div>
                  {state.diffView === 'preview' && (
                    <div
                      aria-label="Preview of the enhanced prompt"
                      className="kaya-scrollbar"
                      style={{ maxHeight: 240, overflowY: 'auto', overscrollBehaviorY: 'contain', padding: 2, borderRadius: 8 }}
                    >
                      <MarkdownRenderer content={state.draft} />
                    </div>
                  )}
                  {state.diffView === 'changes' && (
                  <div
                    role="list"
                    aria-label="Diff between original and enhanced prompt"
                    className="kaya-scrollbar"
                    style={{
                      maxHeight:           240,
                      overflowY:           'auto',
                      overscrollBehaviorY: 'contain',
                      padding:             2,
                      borderRadius:        8,
                    }}
                  >
                    {diffSegments.map((seg, i) => (
                      // eslint-disable-next-line react/no-array-index-as-key -- diff segments are positionally stable; no stable IDs available
                      <DiffLine key={i} variant={seg.type} style={{ whiteSpace: 'pre-wrap' }}>{seg.text}</DiffLine>
                    ))}
                  </div>
                  )}
                </div>
              )}

              {state.phase === 'complete' && (
                <p style={{
                  margin:     0,
                  padding:    '24px 4px',
                  fontFamily: 'var(--font-body)',
                  fontSize:   'var(--font-size-body)',
                  lineHeight: 1.5,
                  color:      'var(--neutral-700)',
                }}>
                  Your prompt looks comprehensive. Running another pass would surface advanced refinements.
                </p>
              )}
              </div>

              {/* Footer */}
              <Footer
                phase={state.phase}
                audit={isAudit}
                qIdx={state.qIdx}
                total={state.questions.length}
                canAdvance={flow.canAdvance}
                onBack={flow.back}
                onSkip={() => flow.next(true)}
                onContinue={() => flow.next(false)}
                onDiscard={flow.discard}
                onApply={flow.apply}
                onRunDeeper={flow.runDeeper}
                onClose={flow.close}
              />
    </>
  )
}

// ── QA step ───────────────────────────────────────────────────────────────────

function QAStep({
  question, qIdx, total, audit, answers, customText,
  onToggleOption, onCustomChange, onCustomCommit, onCustomRemove,
}: {
  question:        Question
  qIdx:            number
  total:           number
  audit:           boolean
  answers:         string[]
  customText:      string
  onToggleOption:  (label: string) => void
  onCustomChange:  (text: string) => void
  onCustomCommit:  () => void
  onCustomRemove:  (label: string) => void
}) {
  const customExpanded = answers.some(a => question.options.every(o => o.label !== a))
    || customText.length > 0

  const isCapped = question.multiSelect && !!question.maxSelect && answers.length >= question.maxSelect

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Step label - hidden in AUDIT (PRD §13) */}
      {!audit && (
        <p style={{
          margin:        0,
          fontFamily:    'var(--font-body)',
          fontSize: 12,
          letterSpacing: '0.03em',
          textTransform: 'uppercase',
          color:         'var(--color-enhance-step-label)',
        }}>
          Step {qIdx + 1} of {total}
        </p>
      )}

      {/* Question text + sub */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h3 style={{
          margin:     0,
          fontFamily: 'var(--font-body)',
          fontWeight: 'var(--font-weight-medium)',
          fontSize:   'var(--font-size-body-lg, 16px)',
          lineHeight: 1.4,
          color:      'var(--neutral-900)',
        }}>
          {question.text}
        </h3>
        {(audit || question.sub) && (
          <p style={{
            margin:     0,
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-caption)',
            lineHeight: 'var(--line-height-caption)',
            color:      'var(--neutral-500)',
          }}>
            {audit ? 'Consider carefully.' : question.sub}
          </p>
        )}
      </div>

      {/* Selected custom chips */}
      {answers.flatMap(custom => question.options.every(o => o.label !== custom) ? [(
        <span
          key={custom}
          style={{
            display:         'inline-flex',
            alignItems:      'center',
            gap:             6,
            padding:         '4px 8px',
            borderRadius:    6,
            backgroundColor: 'var(--color-enhance-primary-tint)',
            color:           'var(--color-diff-added-text)',
            fontFamily:      'var(--font-body)',
            fontSize:        'var(--font-size-caption)',
            fontWeight:      'var(--font-weight-medium)',
            alignSelf:       'flex-start',
          }}
        >
          {custom}
          <button
            type="button"
            aria-label={`Remove ${custom}`}
            onClick={() => onCustomRemove(custom)}
            style={{
              display:         'inline-flex',
              alignItems:      'center',
              justifyContent:  'center',
              width:           14,
              height:          14,
              padding:         0,
              border:          'none',
              background:      'transparent',
              cursor:          'pointer',
              color:           'inherit',
              lineHeight:      0,
            }}
          >
            <CancelOneIcon size={12} />
          </button>
        </span>
      )] : [])}

      {/* Option rows - KDS OptionRow (same component QuestionCard uses).
          single-select:  default | selected
          multi-select:   multi   | multi-selected */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {question.options.map((opt, i) => {
          if (opt.id === 'custom') return null  // rendered as expandable row below
          const isSelected = answers.includes(opt.label)
          const isDisabled = isCapped && !isSelected
          const variant: OptionRowVariant = question.multiSelect
            ? (isSelected ? 'multi-selected' : 'multi')
            : (isSelected ? 'selected'       : 'default')
          return (
            <div
              key={opt.id}
              style={{
                opacity:       isDisabled ? 0.5 : 1,
                pointerEvents: isDisabled ? 'none' : 'auto',
                cursor:        isDisabled ? 'not-allowed' : undefined,
              }}
            >
              <OptionRow
                tabIndex={0}
                variant={variant}
                num={i + 1}
                label={opt.label}
                onClick={() => onToggleOption(opt.label)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onToggleOption(opt.label)
                  }
                }}
                style={{ cursor: 'pointer' }}
              />
            </div>
          )
        })}

        {/* Custom row - bare InputField + Add button */}
        {question.options.some(o => o.id === 'custom') && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: '1 0 0', minWidth: 0 }}>
              <InputField
                fluid
                size="small"
                showLabel={false}
                showSubtitle={false}
                label="Custom answer"
                placeholder="Type your answer…"
                value={customText}
                onChange={onCustomChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    onCustomCommit()
                  }
                }}
              />
            </div>
            <Button
              size="sm"
              variant={customText.trim() ? 'default' : 'secondary'}
              disabled={!customText.trim()}
              onClick={onCustomCommit}
            >
              Add
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Footer ────────────────────────────────────────────────────────────────────

function Footer({
  phase, audit, qIdx, total, canAdvance,
  onBack, onSkip, onContinue, onDiscard, onApply, onRunDeeper, onClose,
}: {
  phase:        EnhancePhase
  audit:        boolean
  qIdx:         number
  total:        number
  canAdvance:   boolean
  onBack:       () => void
  onSkip:       () => void
  onContinue:   () => void
  onDiscard:    () => void
  onApply:      () => void
  onRunDeeper:  () => void
  onClose:      () => void
}) {
  const isLast       = qIdx === total - 1
  const continueLabel = isLast ? (audit ? 'See revised prompt' : 'Review') : 'Continue'

  if (phase === 'scanning') return null

  if (phase === 'diff') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 4 }}>
        <Button size="sm" variant="ghost" onClick={onDiscard}>Discard</Button>
        <Button size="sm" variant="default" onClick={onApply} rightIcon={<ArrowRightOneIcon />}>Apply changes</Button>
      </div>
    )
  }

  if (phase === 'complete') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
        <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
        <Button size="sm" variant="default" onClick={onRunDeeper} rightIcon={<ArrowRightOneIcon />}>Run deeper analysis</Button>
      </div>
    )
  }

  // qa
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 4 }}>
      <EnhanceDotProgress total={total} current={qIdx} audit={audit} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {qIdx > 0 && <Button size="sm" variant="ghost" onClick={onBack} leftIcon={<ArrowLeftOneIcon />}>Back</Button>}
        <Button size="sm" variant="ghost" onClick={onSkip}>Skip</Button>
        <Button
          size="sm"
          variant={canAdvance ? 'default' : 'secondary'}
          disabled={!canAdvance}
          onClick={onContinue}
          rightIcon={<ArrowRightOneIcon />}
        >
          {continueLabel}
        </Button>
      </div>
    </div>
  )
}
