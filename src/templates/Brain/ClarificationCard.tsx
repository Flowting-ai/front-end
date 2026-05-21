'use client'

import React from 'react'
import { QuestionCard, type QuestionCardOption } from '@/components/QuestionCard'
import { type ClarificationType } from './lib/phase'

export interface ClarificationCardProps {
  question:           string
  options:            QuestionCardOption[]
  /** 1-based index shown in the pagination counter. */
  questionIndex:      number
  totalQuestions?:    number
  selected?:          string
  clarificationType?: ClarificationType
  onSelect?:          (id: string) => void
  onSkip?:            () => void
  onSend?:            () => void
  onPrev?:            () => void
  onNext?:            () => void
}

export function ClarificationCard({
  question,
  options,
  questionIndex,
  totalQuestions = 3,
  selected,
  onSelect,
  onSkip,
  onSend,
  onPrev,
  onNext,
}: ClarificationCardProps) {
  return (
    <QuestionCard
      key={question}
      type="single"
      question={question}
      options={options}
      selected={selected}
      onSelect={onSelect}
      paginationLabel={`${questionIndex}/${totalQuestions}`}
      onPrev={onPrev}
      onNext={onNext}
      onSkip={onSkip}
      onSend={onSend}
      onClose={onSkip}
    />
  )
}
