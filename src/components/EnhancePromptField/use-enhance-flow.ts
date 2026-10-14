'use client'

import { useEffect, useReducer, useRef } from 'react'
import { toast } from 'sonner'
import { scanPrompt, classifyMode, selectQuestions, buildRewrite, fromBackendQuestions, type EnhanceMode } from '@/enhance'
import { enhancePrompt } from '@/lib/api/personas'
import { friendlyApiError } from '@/lib/api/client'
import { trackBrowserEvent, trackFeature } from '@/lib/analytics/events'
import { buildAnswerPayload } from '@/lib/enhance/enhance-request'
import { classifyEnhanceFailure, enhanceOutcomeProps, type EnhanceOutcome } from '@/lib/enhance/enhance-outcome'
import {
  INITIAL_ENHANCE_STATE, canAdvance, enhanceReducer, isLastQuestion, questionsAnswered,
  type DiffView, type EnhanceFlowState,
} from '@/lib/enhance/enhance-flow'

// The local scan is instant; this is only a short transition, not a fake wait.
const SCAN_DURATION_MS = 300
// A backend call that takes longer than this gets a "still working" note and a Cancel; one that
// takes longer than the timeout is dropped for the local check.
const SLOW_AFTER_MS = 8_000
const GIVE_UP_AFTER_MS = 45_000

export interface EnhanceFlow {
  state: EnhanceFlowState
  canAdvance: boolean
  open: () => void
  close: () => void
  toggleOption: (questionId: string, label: string) => void
  setCustom: (questionId: string, text: string) => void
  commitCustom: (questionId: string) => void
  removeAnswer: (questionId: string, label: string) => void
  back: () => void
  next: (skipped?: boolean) => void
  runDeeper: () => void
  setDiffView: (view: DiffView) => void
  apply: () => void
  discard: () => void
}

/**
 * Everything Enhance does besides drawing: the reducer (lib/enhance/enhance-flow.ts), the two
 * backend calls, the abort, slow and give-up timers, the local fallback and the outcome analytics.
 * `value` is the prompt; `onApply` commits a draft. The calls are plain promises, not React Query
 * mutations: the field is reused in places with no QueryClientProvider, and the reducer already
 * models loading, failure and cancel (decision D10).
 */
export function useEnhanceFlow({ value, forceMode, onApply }: {
  value: string
  forceMode?: EnhanceMode
  onApply: (draft: string, previous: string) => void
}): EnhanceFlow {
  const [state, dispatch] = useReducer(enhanceReducer, INITIAL_ENHANCE_STATE)
  // Callbacks fired after an await read the latest state through this ref.
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state })

  const requestId = useRef(0) // bumped to ignore a stale response after close / restart
  const abortRef = useRef<AbortController | null>(null)
  const scanTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const giveUpRef = useRef<() => void>(() => {})
  const startedAt = useRef<number | null>(null)

  const newRequestSignal = () => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    return abortRef.current.signal
  }
  const cancelRequest = () => { abortRef.current?.abort(); abortRef.current = null }
  const clearScan = () => { if (scanTimer.current) clearTimeout(scanTimer.current) }

  const reportOutcome = (outcome: EnhanceOutcome) => {
    trackBrowserEvent('prompt_enhance_outcome', enhanceOutcomeProps({
      outcome,
      source: stateRef.current.source,
      startedAt: startedAt.current,
      now: Date.now(),
      questionsAnswered: questionsAnswered(stateRef.current),
    }))
  }

  useEffect(() => () => {
    if (scanTimer.current) clearTimeout(scanTimer.current)
    abortRef.current?.abort()
  }, [])

  useEffect(() => {
    if (!state.waiting) return
    const slowTimer = setTimeout(() => dispatch({ type: 'slow' }), SLOW_AFTER_MS)
    const giveUpTimer = setTimeout(() => giveUpRef.current(), GIVE_UP_AFTER_MS)
    return () => { clearTimeout(slowTimer); clearTimeout(giveUpTimer) }
  }, [state.waiting])

  const startLocal = (mode: EnhanceMode, questions: ReturnType<typeof selectQuestions>) => {
    clearScan()
    dispatch({ type: 'startLocal', mode, questions })
    scanTimer.current = setTimeout(() => dispatch({ type: 'scanDone' }), SCAN_DURATION_MS)
  }

  // Local (rule-based) flow, used when the backend is unavailable.
  const openLocal = () => {
    const scores = scanPrompt(value)
    const mode = forceMode ?? classifyMode(scores)
    startLocal(mode, selectQuestions(mode, scores))
  }

  const open = () => {
    trackFeature('agent_enhance_instructions')
    startedAt.current = Date.now()
    if (!value.trim()) { openLocal(); return }
    const run = ++requestId.current
    dispatch({ type: 'startBackend' })
    giveUpRef.current = () => {
      requestId.current++
      cancelRequest()
      reportOutcome('timeout')
      toast.info('Enhance is taking too long — using a quick local check instead.')
      openLocal()
    }
    enhancePrompt(value, [], { signal: newRequestSignal() }).then(
      (res) => {
        if (run !== requestId.current) return
        dispatch({ type: 'backendReady', draft: res.enhanced_prompt, questions: fromBackendQuestions(res.questions) })
      },
      (err: unknown) => {
        if (run !== requestId.current) return
        const failure = classifyEnhanceFailure(err)
        if (failure === 'aborted') return
        if (failure === 'credits') {
          reportOutcome('credits_exhausted')
          dispatch({ type: 'close' })
          toast.error(friendlyApiError('', 402))
          return
        }
        reportOutcome('fallback_local')
        openLocal()
      },
    )
  }

  const close = () => {
    if (stateRef.current.phase !== 'idle') reportOutcome('closed')
    requestId.current++
    cancelRequest()
    clearScan()
    dispatch({ type: 'close' })
  }

  // Send the answers back so the backend folds them into a final draft.
  const refine = () => {
    const run = ++requestId.current
    const current = stateRef.current
    // Answered questions only, trimmed to ENHANCE_LIMITS.
    const payload = buildAnswerPayload(current.questions, current.answers)
    dispatch({ type: 'refineStarted' })
    const showFirstDraft = () => dispatch({ type: 'showDraft', draft: stateRef.current.backendDraft })
    giveUpRef.current = () => {
      requestId.current++
      cancelRequest()
      reportOutcome('timeout')
      toast.info('Enhance is taking too long — showing the first draft.')
      showFirstDraft()
    }
    enhancePrompt(value, payload, { signal: newRequestSignal() }).then(
      (res) => {
        if (run !== requestId.current) return
        dispatch({ type: 'showDraft', draft: res.enhanced_prompt })
      },
      (err: unknown) => {
        if (run !== requestId.current) return
        const failure = classifyEnhanceFailure(err)
        if (failure === 'aborted') return
        // Out of credits on the refine: the first draft is still usable, so show it with the reason.
        if (failure === 'credits') toast.error(friendlyApiError('', 402))
        showFirstDraft()
      },
    )
  }

  const next = (skipped = false) => {
    const current = stateRef.current
    if (!skipped && !canAdvance(current)) return
    if (!isLastQuestion(current)) { dispatch({ type: 'next' }); return }
    if (current.source === 'backend') { refine(); return }
    dispatch({ type: 'showDraft', draft: buildRewrite(value, current.questions, current.answers) })
  }

  return {
    state,
    canAdvance: canAdvance(state),
    open,
    close,
    toggleOption: (questionId, label) => dispatch({ type: 'toggleOption', questionId, label }),
    setCustom: (questionId, text) => dispatch({ type: 'setCustom', questionId, text }),
    commitCustom: (questionId) => dispatch({ type: 'commitCustom', questionId }),
    removeAnswer: (questionId, label) => dispatch({ type: 'removeAnswer', questionId, label }),
    back: () => dispatch({ type: 'back' }),
    next,
    // A forced AUDIT pass with the local questions.
    runDeeper: () => startLocal('AUDIT', selectQuestions('AUDIT', scanPrompt(value))),
    setDiffView: (view) => dispatch({ type: 'setDiffView', view }),
    apply: () => {
      reportOutcome('applied')
      const draft = stateRef.current.draft
      dispatch({ type: 'finish' })
      onApply(draft, value)
    },
    discard: () => {
      reportOutcome('discarded')
      dispatch({ type: 'finish' })
    },
  }
}
