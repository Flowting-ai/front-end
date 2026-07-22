"use client"

import { useMemo, useState } from "react"

import { ClarificationCard } from "@/templates/Brain/ClarificationCard"
import type { QuestionCardOption } from "@/components/QuestionCard"
import { respondToChatPrompt } from "@/lib/api/chat"
import type { ChatPrompt, ChatPromptQuestion } from "@/hooks/use-chat-state"

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
  const [selected, setSelected] = useState<string | string[]>("")
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [decided, setDecided] = useState(false)
  const question = questions[cursor]

  if (decided || prompt.decision || !question) return null

  const options: QuestionCardOption[] = (question.options ?? []).map((option) => ({
    id: option.value,
    label: option.label || option.value,
  }))
  const multi = question.type === "multi_choice"

  const submit = async (value: unknown) => {
    if (submitting) return
    const collected = { ...answers, [question.id]: value }
    if (cursor < questions.length - 1) {
      setAnswers(collected)
      setCursor((current) => current + 1)
      setSelected("")
      return
    }

    setSubmitting(true)
    setError("")
    try {
      const response = prompt.kind === "questions"
        ? { answers: collected }
        : value
      await respondToChatPrompt(prompt.request_id, response, prompt.respond_url)
      setDecided(true)
      onDecided?.("resolved")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send your response")
    } finally {
      setSubmitting(false)
    }
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
        onSelect={handleSelect}
        onOpenEndedSubmit={(text) => void submit(text)}
        onSend={() => {
          if (Array.isArray(selected) ? selected.length > 0 : Boolean(selected)) {
            void submit(selected)
          }
        }}
        onPrev={cursor > 0 ? () => {
          setCursor((current) => current - 1)
          setSelected("")
        } : undefined}
      />
      {error && (
        <p role="alert" style={{ margin: "6px 12px 0", color: "var(--red-700)", fontSize: 12 }}>
          {error}
        </p>
      )}
    </div>
  )
}
