import { z } from 'zod'
import type { Answers, Question } from '@/enhance'

/**
 * Limits for what Enhance sends back to POST /persona/enhance-prompt. The
 * backend (`EnhanceAnswer` in services/persona/schemas.py) sets none, so the
 * client keeps answers to what the UI can produce: at most a few questions,
 * short answers, a short "Other" text.
 */
export const ENHANCE_LIMITS = {
  answers: 10,
  question: 500,
  answer: 1_000,
  /** Characters in one "Other" answer typed by the user. */
  customText: 300,
} as const

export const enhanceAnswerSchema = z.object({
  question: z.string().min(1).max(ENHANCE_LIMITS.question),
  answer: z.string().min(1).max(ENHANCE_LIMITS.answer),
})

export const enhanceAnswersSchema = z.array(enhanceAnswerSchema).max(ENHANCE_LIMITS.answers)

export type EnhanceAnswerPayload = z.infer<typeof enhanceAnswerSchema>

/** Cap a typed "Other" answer. */
export function clampCustomText(text: string): string {
  return text.slice(0, ENHANCE_LIMITS.customText)
}

/**
 * The `{ question, answer }` pairs for the refine call: answered questions
 * only, in order, each trimmed to the limits, then validated.
 */
export function buildAnswerPayload(questions: Question[], answers: Answers): EnhanceAnswerPayload[] {
  const pairs = questions.flatMap(q => {
    const picked = (answers[q.id] ?? []).map(a => a.trim()).filter(Boolean)
    if (picked.length === 0) return []
    return [{
      question: q.text.slice(0, ENHANCE_LIMITS.question),
      answer: picked.join(', ').slice(0, ENHANCE_LIMITS.answer),
    }]
  }).filter(p => p.question.length > 0)
  return enhanceAnswersSchema.parse(pairs.slice(0, ENHANCE_LIMITS.answers))
}
