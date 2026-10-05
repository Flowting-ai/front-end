import type { ChatPrompt, ChatPromptQuestion } from '@/lib/api/prompts'

/** Sent for every unanswered question when the user dismisses a question
 *  card. The backend hands answers to the model verbatim, so plain text is
 *  what tells it the user declined (and not to guess). */
export const DISMISSED_ANSWER = '(dismissed by the user — not answered)'

const isMulti = (question: ChatPromptQuestion) => question.type === 'multi_choice'

const optionValues = (question: ChatPromptQuestion) =>
  new Set((question.options ?? []).map((option) => option.value))

/** Only `ask_user` questions can be optional. Every other prompt kind
 *  (approval, confirm, input…) needs a real answer from the user. */
export function isQuestionOptional(prompt: ChatPrompt, question: ChatPromptQuestion): boolean {
  return prompt.kind === 'questions' && question.required === false
}

/** The value to send for a question, or undefined when it has no answer.
 *  Typed text wins over a single-choice selection; on multi-choice it is
 *  added to the ticked options so nothing the user picked is lost. */
export function resolveAnswer(
  question: ChatPromptQuestion,
  selected: string | string[],
  typed: string,
): string | string[] | undefined {
  const text = typed.trim()
  if (isMulti(question)) {
    const values = [...(Array.isArray(selected) ? selected : selected ? [selected] : [])]
    if (text) values.push(text)
    return values.length > 0 ? values : undefined
  }
  if (text) return text
  const single = Array.isArray(selected) ? selected[0] : selected
  return single || undefined
}

/** Option selection to restore when the user returns to an answered question. */
export function selectionFromAnswer(question: ChatPromptQuestion, answer: unknown): string | string[] {
  const values = optionValues(question)
  if (isMulti(question)) {
    return Array.isArray(answer) ? answer.filter((value): value is string => typeof value === 'string' && values.has(value)) : []
  }
  return typeof answer === 'string' && values.has(answer) ? answer : ''
}

/** Typed text to restore when the user returns to an answered question. */
export function customTextFromAnswer(question: ChatPromptQuestion, answer: unknown): string {
  const values = optionValues(question)
  if (isMulti(question)) {
    return Array.isArray(answer)
      ? answer.filter((value): value is string => typeof value === 'string' && !values.has(value)).join(', ')
      : ''
  }
  return typeof answer === 'string' && !values.has(answer) ? answer : ''
}

/** Whether the card offers a dismiss (X). Only prompts with a reply that
 *  safely means "no" can be dismissed: question cards and approvals. A
 *  confirm-style prompt (e.g. browser takeover) treats any reply as "done". */
export function canDismissPrompt(prompt: ChatPrompt): boolean {
  return prompt.kind === 'questions' || prompt.kind === 'approval'
}

/** The response POSTed when the user dismisses the card. */
export function buildDismissResponse(
  prompt: ChatPrompt,
  questions: ChatPromptQuestion[],
  answers: Record<string, unknown>,
): unknown {
  if (prompt.kind === 'approval') return 'reject'
  const filled: Record<string, unknown> = {}
  for (const question of questions) {
    filled[question.id] = question.id in answers ? answers[question.id] : DISMISSED_ANSWER
  }
  return { answers: filled }
}
