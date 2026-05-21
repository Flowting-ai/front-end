'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { ArrowLeftOneIcon, ArrowRightOneIcon, CancelOneIcon, LaurelWreathOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { InputField } from '@/components/InputField'
import { OptionRow } from '@/components/OptionRow'
import type { OptionRowVariant } from '@/components/OptionRow'
import { EnhanceDotProgress } from '@/components/EnhanceDotProgress'
import { EnhanceScanningState } from '@/components/EnhanceScanningState'
import { EnhanceSummaryBar } from '@/components/EnhanceSummaryBar'
import { DiffLine } from '@/components/DiffLine'
import {
  scanPrompt, classifyMode, selectQuestions,
  buildRewrite, diffSentences, diffSummary,
} from '@/enhance'
import type {
  EnhanceMode, PersonaContext, Question, Answers,
} from '@/enhance'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EnhancePromptFieldProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Current system prompt value (controlled). */
  value:            string
  /** Fires whenever the prompt text changes (typing OR an Apply commit). */
  onChange:         (next: string) => void
  /**
   * Persona surroundings - feeds the P2 question filters (PRD §8). Optional -
   * defaults to a permissive private persona with no knowledge/connectors.
   */
  personaContext?:  PersonaContext
  /** Textarea placeholder when empty. */
  placeholder?:     string
  /** Optional label for screen readers. */
  ariaLabel?:       string
  /**
   * Forces a specific mode regardless of scan results. Useful for stories /
   * documentation; production should let `scanPrompt` decide.
   */
  forceMode?:       EnhanceMode
  /**
   * Visible field label rendered above the container (matches the Figma
   * "System Instruction" label). Pass `null` to omit the label entirely.
   * Defaults to "System Instruction".
   */
  label?:           React.ReactNode
  /**
   * Optional content rendered in the bottom-left of the idle footer, opposite
   * the Enhance button. Use for undo/redo controls or similar adornments. Not
   * rendered while the field is in an open Enhance state.
   */
  footerLeft?:      React.ReactNode
}

type EnhanceState = 'idle' | 'scanning' | 'qa' | 'diff' | 'complete'

const DEFAULT_CONTEXT: PersonaContext = {
  knowledgeCount:    0,
  connectorsEnabled: [],
  sharing:           'private',
}

const SCAN_DURATION_MS = 1800   // PRD §11
const APPLY_TRANSITION_MS = 180

// ── Component ─────────────────────────────────────────────────────────────────

export function EnhancePromptField(
  {
    value,
    onChange,
    personaContext = DEFAULT_CONTEXT,
    placeholder = "Describe your persona's goals, expertise, tone, and responsibilities. Example: 'You are a senior UX researcher who specializes in…'",
    ariaLabel = 'System prompt',
    forceMode,
    label = 'System Instruction',
    footerLeft,
    className,
    style,
    ref,
    ...props
  }: EnhancePromptFieldProps & { ref?: React.Ref<HTMLDivElement> },
// eslint-disable-next-line react-doctor/prefer-useReducer -- multiple useState calls; useReducer refactor deferred
) {
    const [state, setState]         = useState<EnhanceState>('idle')
    const [mode, setMode]           = useState<EnhanceMode>('BUILD')
    const [questions, setQuestions] = useState<Question[]>([])
    const [qIdx, setQIdx]           = useState(0)
    const [answers, setAnswers]     = useState<Answers>({})
    const [customText, setCustomText] = useState<Record<string, string>>({})  // questionId → in-progress custom string
    const [draftRewrite, setDraftRewrite] = useState<string>('')

    const scanTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    useEffect(() => () => { if (scanTimer.current) clearTimeout(scanTimer.current) }, [])

    const isOpen = state !== 'idle'

    // ── Open / close ───────────────────────────────────────────────────────────

    const openEnhance = () => {
      // Run scan immediately so we can decide between [scanning] → [qa] / [complete].
      const scores = scanPrompt(value)
      const detectedMode = forceMode ?? classifyMode(scores)
      const qs = selectQuestions(detectedMode, scores, personaContext)
      setMode(detectedMode)
      setQuestions(qs)
      setQIdx(0)
      setAnswers({})
      setCustomText({})
      setState('scanning')
      scanTimer.current = setTimeout(() => {
        if (qs.length === 0) setState('complete')
        else setState('qa')
      }, SCAN_DURATION_MS)
    }

    const closeEnhance = () => {
      if (scanTimer.current) clearTimeout(scanTimer.current)
      setState('idle')
    }

    // ── Q&A handlers ───────────────────────────────────────────────────────────

    const currentQuestion = questions[qIdx]

    const toggleOption = (qid: string, optionLabel: string) => {
      setAnswers(prev => {
        const q = questions.find(qq => qq.id === qid)
        if (!q) return prev
        const cur = prev[qid] ?? []
        if (q.multiSelect) {
          if (cur.includes(optionLabel)) return { ...prev, [qid]: cur.filter(x => x !== optionLabel) }
          if (q.maxSelect && cur.length >= q.maxSelect) return prev  // capped
          return { ...prev, [qid]: [...cur, optionLabel] }
        }
        return { ...prev, [qid]: cur[0] === optionLabel ? [] : [optionLabel] }
      })
    }

    const commitCustom = (qid: string) => {
      const text = customText[qid]?.trim()
      if (!text) return
      setAnswers(prev => ({ ...prev, [qid]: [...(prev[qid] ?? []), text] }))
      setCustomText(prev => ({ ...prev, [qid]: '' }))
    }

    const removeAnswer = (qid: string, label: string) => {
      setAnswers(prev => ({ ...prev, [qid]: (prev[qid] ?? []).filter(x => x !== label) }))
    }

    const canAdvance = (() => {
      if (!currentQuestion) return false
      const a = answers[currentQuestion.id] ?? []
      return a.length > 0 || (customText[currentQuestion.id]?.trim().length ?? 0) > 0
    })()

    const goBack = () => {
      if (qIdx === 0) return
      setQIdx(i => i - 1)
    }
    const skip = () => goNext(true)
    const goNext = (skipped = false) => {
      if (!skipped && !canAdvance) return
      if (qIdx >= questions.length - 1) {
        // Build rewrite + advance to diff
        const rewrite = buildRewrite(value, questions, answers)
        setDraftRewrite(rewrite)
        setState('diff')
        return
      }
      setQIdx(i => i + 1)
    }

    // ── Apply / discard ────────────────────────────────────────────────────────

    const applyChanges = () => {
      onChange(draftRewrite)
      setState('idle')
      setDraftRewrite('')
    }
    const discard = () => {
      setDraftRewrite('')
      setState('idle')
    }

    // ── Visual helpers ─────────────────────────────────────────────────────────

    const isAudit = mode === 'AUDIT'
    const headerLabel =
      state === 'complete' ? 'Your prompt looks comprehensive'
    : isAudit              ? 'Reviewing your prompt'
    : `Enhance - ${mode}`

    const containerStateStyle: React.CSSProperties = isOpen ? {
      backgroundColor: 'var(--color-enhance-surface-open)',
      borderColor:     'var(--color-enhance-border-open)',
      borderWidth:     1.5,
    } : {
      backgroundColor: '#FFFFFF',
      borderColor:     '#E5E5E5',
      borderWidth:     1,
    }

    // ── Diff content ───────────────────────────────────────────────────────────

    const diffSegments = useMemo(
      () => (state === 'diff' ? diffSentences(value, draftRewrite) : []),
      [state, value, draftRewrite],
    )
    const summary = useMemo(
      () => (state === 'diff' ? diffSummary(value, draftRewrite) : { wordsAdded: 0, guidelineGroups: 0 }),
      [state, value, draftRewrite],
    )

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
      <div
        ref={ref}
        className={cn(className)}
        style={{
          display:       'flex',
          flexDirection: 'column',
          gap:           8,
          width:         '100%',
          ...style,
        }}
      >
        {/* Field label - Figma "System Instruction" sits above the container */}
        {label && (
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 'var(--font-weight-regular)',
              fontSize:   'var(--font-size-body)',
              lineHeight: 'var(--line-height-body)',
              color:      'var(--neutral-900)',
            }}
          >
            {label}
          </span>
        )}

        <div
          role={isOpen ? 'dialog' : undefined}
          aria-label={isOpen ? 'Enhance your system prompt' : undefined}
          style={{
            position:        'relative',
            width:           '100%',
            borderRadius:    18,
            borderStyle:     'solid',
            overflow:        'hidden',
            height:          534,
            // eslint-disable-next-line react-doctor/no-layout-transition-inline -- dynamic border-width animation requires inline style
            transition:      'background-color 200ms ease, border-color 200ms ease, border-width 200ms ease',
            ...containerStateStyle,
          }}
          {...props}
        >
        {/* Idle: textarea fills, footer pinned in flex flow at bottom — matches Figma node I848:53731;1677:7723 */}
        {!isOpen && (
          <div
            style={{
              display:       'flex',
              flexDirection: 'column',
              gap:           25,
              height:        '100%',
              padding:       12,
              boxSizing:     'border-box',
            }}
          >
            <textarea
              aria-label={ariaLabel}
              className="kaya-enhance-textarea"
              placeholder={placeholder}
              value={value}
              onChange={e => onChange(e.target.value)}
              style={{
                flex:       '1 1 0',
                minHeight:  0,
                width:      '100%',
                padding:    0,
                border:     'none',
                background: 'transparent',
                resize:     'none',
                // eslint-disable-next-line react-doctor/no-outline-none -- browser outline suppressed; :focus-visible handled by container or global styles
                outline:    'none',
                fontFamily: 'Inter, var(--font-body)',
                fontWeight: 400,
                fontSize:   14,
                lineHeight: 1.29,
                color:      '#524B47',
              }}
            />
            <div
              style={{
                flexShrink:     0,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'space-between',
                gap:            8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {footerLeft}
              </div>
              <Button
                size="md"
                variant="default"
                onClick={openEnhance}
                leftIcon={<LaurelWreathOneIcon />}
              >
                Enhance
              </Button>
            </div>
          </div>
        )}

        {/* Open: EnhanceBox replaces the textarea */}
        <AnimatePresence initial={false}>
          {isOpen && (
            <m.div
              key={state}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position:      'absolute',
                inset:         0,
                padding:       '20px 20px 16px',
                display:       'flex',
                flexDirection: 'column',
                gap:           16,
                minHeight:     0,
                borderRadius:  18,
              }}
            >
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
                  {isAudit && state !== 'complete' && (
                    <Badge color="Purple" label="Audit" />
                  )}
                </div>
                <button
                  type="button"
                  aria-label="Close Enhance"
                  onClick={closeEnhance}
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
                }}
              >
              {state === 'scanning' && <EnhanceScanningState />}

              {state === 'qa' && currentQuestion && (
                <QAStep
                  question={currentQuestion}
                  qIdx={qIdx}
                  total={questions.length}
                  audit={isAudit}
                  answers={answers[currentQuestion.id] ?? []}
                  customText={customText[currentQuestion.id] ?? ''}
                  onToggleOption={(label) => toggleOption(currentQuestion.id, label)}
                  onCustomChange={(t) => setCustomText(prev => ({ ...prev, [currentQuestion.id]: t }))}
                  onCustomCommit={() => commitCustom(currentQuestion.id)}
                  onCustomRemove={(label) => removeAnswer(currentQuestion.id, label)}
                />
              )}

              {state === 'diff' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <EnhanceSummaryBar
                    wordsAdded={summary.wordsAdded}
                    guidelineGroups={summary.guidelineGroups}
                  />
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
                      // eslint-disable-next-line react/no-array-index-as-key, react-doctor/no-array-index-as-key -- diff segments are positionally stable; no stable IDs available
                      <DiffLine key={i} variant={seg.type}>{seg.text}</DiffLine>
                    ))}
                  </div>
                </div>
              )}

              {state === 'complete' && (
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
                state={state}
                audit={isAudit}
                qIdx={qIdx}
                total={questions.length}
                canAdvance={canAdvance}
                onBack={goBack}
                onSkip={skip}
                onContinue={() => goNext(false)}
                onDiscard={discard}
                onApply={applyChanges}
                onRunDeeper={() => {
                  // Re-enter scan with forced AUDIT
                  const scores = scanPrompt(value)
                  const qs = selectQuestions('AUDIT', scores, personaContext)
                  setMode('AUDIT')
                  setQuestions(qs)
                  setQIdx(0)
                  setAnswers({})
                  setCustomText({})
                  setState('scanning')
                  scanTimer.current = setTimeout(() => setState(qs.length > 0 ? 'qa' : 'complete'), SCAN_DURATION_MS)
                }}
                onClose={closeEnhance}
              />
            </m.div>
          )}
        </AnimatePresence>
        </div>
      </div>
    )
}

EnhancePromptField.displayName = 'EnhancePromptField'

export default EnhancePromptField

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
        <p style={{
          margin:     0,
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-caption)',
          lineHeight: 'var(--line-height-caption)',
          color:      'var(--neutral-500)',
        }}>
          {audit ? 'Consider carefully.' : question.sub}
        </p>
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
  state, audit, qIdx, total, canAdvance,
  onBack, onSkip, onContinue, onDiscard, onApply, onRunDeeper, onClose,
}: {
  state:        EnhanceState
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

  if (state === 'scanning') return null

  if (state === 'diff') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 4 }}>
        <Button size="sm" variant="ghost" onClick={onDiscard}>Discard</Button>
        <Button size="sm" variant="default" onClick={onApply} rightIcon={<ArrowRightOneIcon />}>Apply changes</Button>
      </div>
    )
  }

  if (state === 'complete') {
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
