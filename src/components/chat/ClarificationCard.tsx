'use client'

import React from 'react'
import { QuestionCard, type QuestionCardOption } from '@/components/QuestionCard'
export type ClarificationType = 'ambiguity' | 'depth' | 'permission'

export interface ClarificationCardProps {
  questionKey?:        string
  question:           string
  options:            QuestionCardOption[]
  /** 1-based index of the current question. Optional — used only when
   *  totalQuestions is also provided, to render an "N/M" pagination chip. */
  questionIndex?:     number
  /** Total number of questions in the clarification flow. When omitted, no
   *  pagination chip and no prev/next arrows are shown. Callers that don't
   *  know the total ahead of time (e.g. live SSE-driven clarification
   *  where each question is decided on the fly) should leave this unset. */
  totalQuestions?:    number
  selected?:          string | string[]
  clarificationType?: ClarificationType
  /** When true the card renders checkboxes (multi-select) instead of radios,
   *  `selected` is treated as a string[], and the header shows "N Selected". */
  multiSelect?:       boolean
  /** Count shown as "N Selected" in the header (multi-select only). */
  selectionCount?:    number
  /** Placeholder text inside the open-ended text input. Default in
   *  QuestionCard is "Something else on your mind". Override e.g. with
   *  "Type your answer…" for free-text-only clarifications. */
  openEndedLabel?:    string
  onSelect?:          (id: string) => void
  /** Fires with the user's typed text when they submit via the open-ended
   *  input. Without this prop, free-text answers are silently dropped. */
  onOpenEndedSubmit?: (text: string) => void
  /** Fires on every edit of the open-ended text. */
  onOpenEndedChange?: (text: string) => void
  /** Omit to hide Skip (required questions). */
  onSkip?:            () => void
  /** Dismisses the whole card (top-right X). Omit to hide the X. */
  onDismiss?:         () => void
  onSend?:            () => void
  onPrev?:            () => void
  onNext?:            () => void
  /** True while the current answer's response is in flight — disables
   *  Send/Skip and shows a spinner on Send. */
  pending?:           boolean
  /** Keep Send disabled until the question has an answer. */
  requireAnswer?:     boolean
  /** Restores typed text when returning to an answered question. */
  defaultOpenEndedText?: string
}

export function ClarificationCard({
  questionKey,
  question,
  options,
  questionIndex,
  totalQuestions,
  selected,
  multiSelect,
  selectionCount,
  openEndedLabel,
  onSelect,
  onOpenEndedSubmit,
  onOpenEndedChange,
  onSkip,
  onDismiss,
  onSend,
  onPrev,
  onNext,
  pending,
  requireAnswer,
  defaultOpenEndedText,
}: ClarificationCardProps) {
  // Only render pagination when the caller knows both numerator and
  // denominator. Showing "1/3" when only one question will ever be asked
  // is misleading; in that case we omit the chip entirely.
  const paginationLabel = (questionIndex != null && totalQuestions != null)
    ? `${questionIndex}/${totalQuestions}`
    : undefined

  return (
    <QuestionCard
      key={questionKey ?? question}
      type={multiSelect ? 'multi' : 'single'}
      question={question}
      options={options}
      selected={selected}
      selectionCount={multiSelect ? selectionCount : undefined}
      onSelect={onSelect}
      paginationLabel={paginationLabel}
      openEndedLabel={openEndedLabel}
      onOpenEndedSubmit={onOpenEndedSubmit}
      onOpenEndedChange={onOpenEndedChange}
      onPrev={onPrev}
      onNext={onNext}
      onSkip={onSkip}
      onSend={onSend}
      onClose={onDismiss}
      pending={pending}
      requireAnswer={requireAnswer}
      defaultOpenEndedText={defaultOpenEndedText}
      autoFocusWhenIdle
    />
  )
}
