// The Enhance panel's state machine, as a pure reducer. The component hook (use-enhance-flow.ts)
// owns the side effects (requests, timers, analytics) and dispatches these actions; everything the
// panel shows is derived from this one state, so the views stay presentational.

import type { Answers, EnhanceMode, Question } from '@/enhance'
import { clampCustomText } from './enhance-request'

export type EnhancePhase = 'idle' | 'scanning' | 'qa' | 'diff' | 'complete'
export type DiffView = 'changes' | 'preview'

export interface EnhanceFlowState {
  phase: EnhancePhase
  mode: EnhanceMode
  /** Where the questions and draft come from: the backend, or the local rule-based check. */
  source: 'backend' | 'local'
  questions: Question[]
  qIdx: number
  answers: Answers
  /** questionId → the "Other" text being typed. */
  customText: Record<string, string>
  /** The draft shown in the diff and applied on Apply. */
  draft: string
  /** The backend's first draft, kept as the fallback when the refine call fails. */
  backendDraft: string
  diffView: DiffView
  /** A backend call is in flight; `slow` once it has taken a while. */
  waiting: boolean
  slow: boolean
}

export const INITIAL_ENHANCE_STATE: EnhanceFlowState = {
  phase: 'idle',
  mode: 'BUILD',
  source: 'local',
  questions: [],
  qIdx: 0,
  answers: {},
  customText: {},
  draft: '',
  backendDraft: '',
  diffView: 'changes',
  waiting: false,
  slow: false,
}

export type EnhanceAction =
  | { type: 'startBackend' }
  | { type: 'startLocal'; mode: EnhanceMode; questions: Question[] }
  | { type: 'scanDone' }
  | { type: 'backendReady'; draft: string; questions: Question[] }
  | { type: 'refineStarted' }
  | { type: 'showDraft'; draft: string }
  | { type: 'slow' }
  | { type: 'close' }
  | { type: 'finish' }
  | { type: 'toggleOption'; questionId: string; label: string }
  | { type: 'setCustom'; questionId: string; text: string }
  | { type: 'commitCustom'; questionId: string }
  | { type: 'removeAnswer'; questionId: string; label: string }
  | { type: 'back' }
  | { type: 'next' }
  | { type: 'setDiffView'; view: DiffView }

const freshQuestions = { qIdx: 0, answers: {}, customText: {} }
const notWaiting = { waiting: false, slow: false }

export function enhanceReducer(state: EnhanceFlowState, action: EnhanceAction): EnhanceFlowState {
  switch (action.type) {
    case 'startBackend':
      return { ...state, ...freshQuestions, phase: 'scanning', mode: 'BUILD', source: 'backend', waiting: true, slow: false }
    case 'startLocal':
      return { ...state, ...freshQuestions, ...notWaiting, phase: 'scanning', mode: action.mode, source: 'local', questions: action.questions }
    case 'scanDone':
      return state.phase === 'scanning' ? { ...state, phase: state.questions.length > 0 ? 'qa' : 'complete' } : state
    case 'backendReady':
      return action.questions.length > 0
        ? { ...state, ...freshQuestions, ...notWaiting, backendDraft: action.draft, questions: action.questions, phase: 'qa' }
        : { ...state, ...freshQuestions, ...notWaiting, backendDraft: action.draft, questions: [], draft: action.draft, diffView: 'changes', phase: 'diff' }
    case 'refineStarted':
      return { ...state, phase: 'scanning', waiting: true, slow: false }
    case 'showDraft':
      return { ...state, ...notWaiting, draft: action.draft, diffView: 'changes', phase: 'diff' }
    case 'slow':
      return state.waiting ? { ...state, slow: true } : state
    case 'close':
      return { ...state, ...notWaiting, phase: 'idle' }
    case 'finish':
      return { ...state, ...notWaiting, phase: 'idle', draft: '' }
    case 'toggleOption': {
      const question = state.questions.find((q) => q.id === action.questionId)
      if (!question) return state
      const current = state.answers[action.questionId] ?? []
      let next: string[]
      if (question.multiSelect) {
        if (current.includes(action.label)) next = current.filter((x) => x !== action.label)
        else if (question.maxSelect && current.length >= question.maxSelect) return state
        else next = [...current, action.label]
      } else {
        next = current[0] === action.label ? [] : [action.label]
      }
      return { ...state, answers: { ...state.answers, [action.questionId]: next } }
    }
    case 'setCustom':
      return { ...state, customText: { ...state.customText, [action.questionId]: clampCustomText(action.text) } }
    case 'commitCustom': {
      const text = clampCustomText(state.customText[action.questionId]?.trim() ?? '')
      if (!text) return state
      return {
        ...state,
        answers: { ...state.answers, [action.questionId]: [...(state.answers[action.questionId] ?? []), text] },
        customText: { ...state.customText, [action.questionId]: '' },
      }
    }
    case 'removeAnswer':
      return { ...state, answers: { ...state.answers, [action.questionId]: (state.answers[action.questionId] ?? []).filter((x) => x !== action.label) } }
    case 'back':
      return state.qIdx > 0 ? { ...state, qIdx: state.qIdx - 1 } : state
    case 'next':
      return state.qIdx < state.questions.length - 1 ? { ...state, qIdx: state.qIdx + 1 } : state
    case 'setDiffView':
      return { ...state, diffView: action.view }
  }
}

/** The current question has an answer (picked or typed), so Continue is enabled. */
export function canAdvance(state: EnhanceFlowState): boolean {
  const question = state.questions[state.qIdx]
  if (!question) return false
  return (state.answers[question.id] ?? []).length > 0 || (state.customText[question.id]?.trim().length ?? 0) > 0
}

export const isLastQuestion = (state: EnhanceFlowState) => state.qIdx >= state.questions.length - 1

export const questionsAnswered = (state: EnhanceFlowState) => Object.values(state.answers).filter((a) => a.length > 0).length
