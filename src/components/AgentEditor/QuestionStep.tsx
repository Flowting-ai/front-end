'use client'

import React, { useRef, useState } from 'react'
import { QuestionCard } from '@/components/QuestionCard'
import type { ClarifyingAnswer, ClarifyingQuestion } from '@/lib/agent-draft'

export interface QuestionStepProps {
  questions: ClarifyingQuestion[]
  /** Answers given, or `[]` when the user skipped / dismissed. */
  onSubmit:  (answers: ClarifyingAnswer[]) => void
}

/**
 * The clarifying questions as cards, one at a time. Every single-choice card
 * starts on its first (default) option, so pressing Send keeps moving; Skip (or
 * dismissing a card) skips them all and uses the defaults.
 */
export function QuestionStep({ questions, onSubmit }: QuestionStepProps) {
  const [index, setIndex] = useState(0)
  const [picks, setPicks] = useState<string[][]>(() => questions.map(q => (q.multiSelect ? [] : ['0'])))
  const [typed, setTyped] = useState<string[]>(() => questions.map(() => ''))
  // The card reports the typed answer and then calls onSend in the same event,
  // before React has applied state — so the typed text is held in a ref too.
  const pendingTyped = useRef('')

  const question = questions[index]
  if (!question) return null
  const isLast = index === questions.length - 1

  function select(optionId: string) {
    setPicks(previous => previous.map((chosen, i) => {
      if (i !== index) return chosen
      if (!question.multiSelect) return [optionId]
      return chosen.includes(optionId) ? chosen.filter(id => id !== optionId) : [...chosen, optionId]
    }))
  }

  function finish(finalTyped: string[]) {
    const answers: ClarifyingAnswer[] = []
    questions.forEach((q, i) => {
      const free = finalTyped[i]?.trim()
      if (free) { answers.push({ question: q.question, answer: free }); return }
      const labels = picks[i].map(id => q.options[Number(id)]?.label).filter((label): label is string => !!label)
      if (labels.length > 0) answers.push({ question: q.question, answer: labels.join(', ') })
    })
    onSubmit(answers)
  }

  function send() {
    const free = pendingTyped.current.trim()
    pendingTyped.current = ''
    const nextTyped = typed.map((value, i) => (i === index ? free : value))
    setTyped(nextTyped)
    if (isLast) finish(nextTyped)
    else setIndex(index + 1)
  }

  return (
    <QuestionCard
      key={index}
      question={question.question}
      type={question.multiSelect ? 'multi' : 'single'}
      options={question.options.map((option, i) => ({ id: String(i), label: option.label, description: option.description }))}
      selected={question.multiSelect ? picks[index] : picks[index][0]}
      selectionCount={question.multiSelect ? picks[index].length : undefined}
      paginationLabel={questions.length > 1 ? `${index + 1}/${questions.length}` : undefined}
      onSelect={select}
      onOpenEndedSubmit={text => { pendingTyped.current = text }}
      onSend={send}
      onSkip={() => onSubmit([])}
      onClose={() => onSubmit([])}
      onPrev={index > 0 ? () => setIndex(index - 1) : undefined}
      onNext={!isLast ? () => setIndex(index + 1) : undefined}
    />
  )
}
