import { describe, expect, it } from 'vitest'
import type { Question } from '@/enhance'
import { ENHANCE_LIMITS, buildAnswerPayload, clampCustomText, enhanceAnswersSchema } from './enhance-request'

const q = (id: string, text = `Question ${id}?`): Question => ({ id, text, sub: '', options: [] })

describe('buildAnswerPayload', () => {
  it('sends answered questions only, in order, joined', () => {
    const payload = buildAnswerPayload([q('a'), q('b'), q('c')], { a: ['Formal', ' Short '], b: [], c: ['Yes'] })
    expect(payload).toEqual([
      { question: 'Question a?', answer: 'Formal, Short' },
      { question: 'Question c?', answer: 'Yes' },
    ])
  })

  it('trims each pair and the list to the limits', () => {
    const long = 'x'.repeat(5_000)
    const questions = Array.from({ length: 15 }, (_, i) => q(String(i), long))
    const answers = Object.fromEntries(questions.map(qq => [qq.id, [long]]))
    const payload = buildAnswerPayload(questions, answers)
    expect(payload).toHaveLength(ENHANCE_LIMITS.answers)
    expect(payload[0].question).toHaveLength(ENHANCE_LIMITS.question)
    expect(payload[0].answer).toHaveLength(ENHANCE_LIMITS.answer)
  })

  it('caps typed custom text and rejects oversized payloads at the boundary', () => {
    expect(clampCustomText('y'.repeat(400))).toHaveLength(ENHANCE_LIMITS.customText)
    expect(() => enhanceAnswersSchema.parse([{ question: 'q', answer: 'z'.repeat(2_000) }])).toThrow()
  })
})
