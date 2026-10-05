import { describe, expect, it } from 'vitest'

import { EMPTY_TURN_MESSAGE } from '@/lib/model-error'
import {
  INCOMPLETE_ANSWER_MESSAGE,
  INTERRUPTED_MESSAGE,
  placeErrorNotice,
  resolveTurnOutcome,
} from '@/lib/turn-outcome'

const ERROR = 'This model is unresponsive right now. Please try again or switch to another model.'

describe('resolveTurnOutcome', () => {
  it('finishes a normal turn with its answer and no notice', () => {
    expect(resolveTurnOutcome({ end: 'done', rawContent: 'The answer.', hasOtherOutput: false })).toEqual({
      content: 'The answer.',
      isError: false,
      errorNotice: undefined,
      thinking: undefined,
    })
  })

  it('keeps streamed text when the run errors, with the error as a notice', () => {
    const outcome = resolveTurnOutcome({ end: 'error', rawContent: 'Half of the ans', error: ERROR, hasOtherOutput: false })
    expect(outcome).toMatchObject({ content: 'Half of the ans', isError: false, errorNotice: ERROR })
  })

  it('keeps streamed text when the connection drops', () => {
    const outcome = resolveTurnOutcome({ end: 'error', rawContent: 'Partial', reasoningText: 'r', hasOtherOutput: false })
    expect(outcome).toMatchObject({ content: 'Partial', isError: false, errorNotice: INTERRUPTED_MESSAGE, thinking: 'r' })
  })

  it('shows the error as the message when nothing was shown', () => {
    expect(resolveTurnOutcome({ end: 'error', rawContent: '', error: ERROR, hasOtherOutput: false }))
      .toMatchObject({ content: ERROR, isError: true, errorNotice: undefined })
  })

  it('keeps cards and blocks on an error, with the error as a notice', () => {
    expect(resolveTurnOutcome({ end: 'error', rawContent: '', error: ERROR, hasOtherOutput: true }))
      .toMatchObject({ content: '', isError: false, errorNotice: ERROR })
  })

  it('treats an empty finished turn as empty, but not one that showed a card', () => {
    expect(resolveTurnOutcome({ end: 'done', rawContent: '', hasOtherOutput: false }))
      .toMatchObject({ content: EMPTY_TURN_MESSAGE, isError: true })
    expect(resolveTurnOutcome({ end: 'done', rawContent: '', hasOtherOutput: true }))
      .toMatchObject({ content: '', isError: false, errorNotice: undefined })
  })

  it('treats a stream that closed early as complete when it showed something', () => {
    expect(resolveTurnOutcome({ end: 'ended', rawContent: 'All of it.', hasOtherOutput: false }))
      .toMatchObject({ content: 'All of it.', isError: false, errorNotice: undefined })
    expect(resolveTurnOutcome({ end: 'ended', rawContent: '', hasOtherOutput: true }))
      .toMatchObject({ content: '', isError: false })
    expect(resolveTurnOutcome({ end: 'ended', rawContent: '', reasoningText: 'thinking', hasOtherOutput: false }))
      .toMatchObject({ content: INTERRUPTED_MESSAGE, isError: true, thinking: 'thinking' })
  })

  it('moves an unfinished leading think block to reasoning and marks the answer incomplete', () => {
    expect(resolveTurnOutcome({ end: 'done', rawContent: '<think>step one, step two', hasOtherOutput: false })).toEqual({
      content: INCOMPLETE_ANSWER_MESSAGE,
      isError: true,
      errorNotice: undefined,
      thinking: 'step one, step two',
    })
    expect(resolveTurnOutcome({ end: 'done', rawContent: '<think>plan', hasOtherOutput: true }))
      .toMatchObject({ content: '', isError: false, errorNotice: INCOMPLETE_ANSWER_MESSAGE })
  })

  it('prefers reasoning events over think-tag text', () => {
    expect(resolveTurnOutcome({ end: 'done', rawContent: '<think>tag</think>Answer', reasoningText: 'events', hasOtherOutput: false }).thinking)
      .toBe('events')
  })
})

describe('placeErrorNotice', () => {
  it('passes content through when there is no notice', () => {
    expect(placeErrorNotice('text', undefined, false)).toEqual({ content: 'text', isError: false, errorNotice: undefined })
  })

  it('does not count whitespace as shown text', () => {
    expect(placeErrorNotice('  \n', 'Oops', false)).toEqual({ content: 'Oops', isError: true, errorNotice: undefined })
  })
})
