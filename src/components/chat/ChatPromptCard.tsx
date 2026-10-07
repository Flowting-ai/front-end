"use client"

import { useMemo, useRef, useState } from "react"

import { ClarificationCard } from "@/components/chat/ClarificationCard"
import type { QuestionCardOption } from "@/components/QuestionCard"
import { respondToChatPrompt } from "@/lib/api/chat"
import {
  buildDismissResponse,
  canDismissPrompt,
  customTextFromAnswer,
  isQuestionOptional,
  resolveAnswer,
  selectionFromAnswer,
} from "@/lib/chat-prompt-answers"
import type { ChatPrompt, ChatPromptQuestion } from "@/types/chat"

interface ChatPromptCardProps {
  prompt: ChatPrompt
  onDecided?: (decision: string) => void
}

const fallbackQuestion = (prompt: ChatPrompt): ChatPromptQuestion => ({
  id: "response",
  question: prompt.description || prompt.title,
  type: prompt.options.length > 0 ? "single_choice" : "text",
  options: prompt.options,
  required: true,
  allow_custom: true,
})

export function ChatPromptCard({ prompt, onDecided }: ChatPromptCardProps) {
  const questions = useMemo(
    () => prompt.questions?.length ? prompt.questions : [fallbackQuestion(prompt)],
    [prompt],
  )
  const [cursor, setCursor] = useState(0)
  // Furthest question reached — Next only moves forward to questions the
  // user has already seen, never past an unanswered one.
  const [furthest, setFurthest] = useState(0)
  const [selected, setSelected] = useState<string | string[]>("")
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [decided, setDecided] = useState(false)
  // The card reports typed text (on every edit, and again just before onSend
  // in the same event, before React applies state) — so it is held in a ref.
  // A ref also guards against a second POST from the same click.
  const typedRef = useRef("")
  const submittingRef = useRef(false)
  const question = questions[cursor]

  if (decided || prompt.decision || !question) return null

  const options: QuestionCardOption[] = (question.options ?? []).map((option) => ({
    id: option.value,
    label: option.label || option.value,
  }))
  const multi = question.type === "multi_choice"
  const optional = isQuestionOptional(prompt, question)

  const goTo = (index: number, collected: Record<string, unknown> = answers) => {
    const target = questions[index]
    setCursor(index)
    setFurthest((current) => Math.max(current, index))
    setSelected(target ? selectionFromAnswer(target, collected[target.id]) : "")
    typedRef.current = target ? customTextFromAnswer(target, collected[target.id]) : ""
  }

  /** Back/Next keep what is on screen for the current question: a changed
   *  answer counts, and clearing a multi-choice answer removes it (an
   *  explicit skip stays a skip). */
  const navigate = (index: number) => {
    const draft = resolveAnswer(question, selected, typedRef.current)
    const collected = { ...answers }
    if (draft !== undefined) collected[question.id] = draft
    else if (collected[question.id] !== null) delete collected[question.id]
    setAnswers(collected)
    goTo(index, collected)
  }

  const respond = async (response: unknown, decision: string) => {
    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    setError("")
    try {
      await respondToChatPrompt(prompt.request_id, response, prompt.respond_url)
      setDecided(true)
      onDecided?.(decision)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send your response")
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  /** Record this question's answer (null = skipped) and move on, or send
   *  the whole card after the last question. */
  const submit = (value: unknown) => {
    if (submittingRef.current) return
    const collected = { ...answers, [question.id]: value }
    setAnswers(collected)
    if (cursor < questions.length - 1) {
      goTo(cursor + 1, collected)
      return
    }
    void respond(prompt.kind === "questions" ? { answers: collected } : value, "resolved")
  }

  const handleSend = () => {
    const typed = typedRef.current
    typedRef.current = ""
    const value = resolveAnswer(question, selected, typed)
    if (value !== undefined) submit(value)
    else if (optional) submit(null)
  }

  const handleSelect = (id: string) => {
    if (!multi) {
      setSelected(id)
      return
    }
    setSelected((current) => {
      const values = Array.isArray(current) ? current : []
      return values.includes(id) ? values.filter((value) => value !== id) : [...values, id]
    })
  }

  return (
    <div style={{ opacity: submitting ? 0.65 : 1, pointerEvents: submitting ? "none" : "auto" }}>
      <ClarificationCard
        questionKey={`${prompt.request_id}:${question.id}`}
        question={question.question || prompt.title}
        options={options}
        questionIndex={questions.length > 1 ? cursor + 1 : undefined}
        totalQuestions={questions.length > 1 ? questions.length : undefined}
        selected={selected}
        multiSelect={multi}
        selectionCount={Array.isArray(selected) ? selected.length : undefined}
        openEndedLabel={question.placeholder || (options.length === 0 ? "Type your answer…" : undefined)}
        defaultOpenEndedText={customTextFromAnswer(question, answers[question.id])}
        onSelect={handleSelect}
        onOpenEndedSubmit={(text) => { typedRef.current = text }}
        onOpenEndedChange={(text) => { typedRef.current = text }}
        onSend={handleSend}
        requireAnswer={!optional}
        pending={submitting}
        onSkip={optional ? () => {
          typedRef.current = ""
          submit(null)
        } : undefined}
        onDismiss={canDismissPrompt(prompt) ? () => {
          void respond(buildDismissResponse(prompt, questions, answers), "dismissed")
        } : undefined}
        onPrev={cursor > 0 ? () => navigate(cursor - 1) : undefined}
        onNext={cursor < furthest ? () => navigate(cursor + 1) : undefined}
      />
      {error && (
        <p role="alert" style={{ margin: "6px 12px 0", color: "var(--red-700)", fontSize: 12 }}>
          {error}
        </p>
      )}
    </div>
  )
}
