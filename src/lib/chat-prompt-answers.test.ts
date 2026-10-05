import { describe, expect, it } from 'vitest'
import type { ChatPrompt, ChatPromptQuestion } from '@/lib/api/prompts'
import {
  DISMISSED_ANSWER,
  buildDismissResponse,
  canDismissPrompt,
  customTextFromAnswer,
  isQuestionOptional,
  resolveAnswer,
  selectionFromAnswer,
} from './chat-prompt-answers'

const single: ChatPromptQuestion = {
  id: 'q1', question: 'Which?', type: 'single_choice',
  options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }], required: true,
}
const multi: ChatPromptQuestion = { ...single, id: 'q2', type: 'multi_choice' }
const prompt = (kind: string): ChatPrompt => ({ request_id: 'p1', kind, title: 'Quick question', options: [] })

describe('resolveAnswer', () => {
  it('sends only the typed text on single choice, once', () => {
    expect(resolveAnswer(single, 'a', '  my own  ')).toBe('my own')
  })

  it('keeps the selection when nothing is typed', () => {
    expect(resolveAnswer(single, 'a', '   ')).toBe('a')
  })

  it('combines ticked options with typed text on multi choice', () => {
    expect(resolveAnswer(multi, ['a', 'b'], 'c')).toEqual(['a', 'b', 'c'])
  })

  it('has no answer when nothing is selected or typed', () => {
    expect(resolveAnswer(single, '', '')).toBeUndefined()
    expect(resolveAnswer(multi, [], ' ')).toBeUndefined()
  })
})

describe('restoring an answered question', () => {
  it('splits a multi answer back into options and typed text', () => {
    expect(selectionFromAnswer(multi, ['a', 'c'])).toEqual(['a'])
    expect(customTextFromAnswer(multi, ['a', 'c'])).toBe('c')
  })

  it('treats a single answer that is not an option as typed text', () => {
    expect(selectionFromAnswer(single, 'mine')).toBe('')
    expect(customTextFromAnswer(single, 'mine')).toBe('mine')
    expect(selectionFromAnswer(single, 'b')).toBe('b')
    expect(customTextFromAnswer(single, 'b')).toBe('')
  })

  it('restores nothing for a skipped question', () => {
    expect(selectionFromAnswer(single, null)).toBe('')
    expect(customTextFromAnswer(multi, null)).toBe('')
  })
})

describe('optional questions', () => {
  it('only lets ask_user questions be optional', () => {
    expect(isQuestionOptional(prompt('questions'), { ...single, required: false })).toBe(true)
    expect(isQuestionOptional(prompt('questions'), single)).toBe(false)
    expect(isQuestionOptional(prompt('confirm'), { ...single, required: false })).toBe(false)
  })
})

describe('dismissing a card', () => {
  it('is offered only where a reply can safely mean no', () => {
    expect(canDismissPrompt(prompt('questions'))).toBe(true)
    expect(canDismissPrompt(prompt('approval'))).toBe(true)
    expect(canDismissPrompt(prompt('confirm'))).toBe(false)
    expect(canDismissPrompt(prompt('input'))).toBe(false)
  })

  it('keeps given answers and marks every other question as dismissed', () => {
    expect(buildDismissResponse(prompt('questions'), [single, multi], { q1: 'a' })).toEqual({
      answers: { q1: 'a', q2: DISMISSED_ANSWER },
    })
  })

  it('keeps an explicit skip as null', () => {
    expect(buildDismissResponse(prompt('questions'), [single, multi], { q1: null })).toEqual({
      answers: { q1: null, q2: DISMISSED_ANSWER },
    })
  })

  it('rejects an approval', () => {
    expect(buildDismissResponse(prompt('approval'), [single], {})).toBe('reject')
  })
})
