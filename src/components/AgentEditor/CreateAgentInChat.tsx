'use client'

import { toast } from 'sonner'
import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CancelOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { Spinner } from '@/components/Spinner'
import { ModalHeader, ModalShell } from '@/components/ChangeAgentModelModal/shared'
import { fetchModelsWithCache } from '@/lib/ai-models'
import type { SelectedPersonaInfo } from '@/lib/chat-personas'
import type { AIModel } from '@/types/ai-model'
import {
  PURPOSE_MAX,
  slugifyHandle,
  type AgentDraft,
  type ClarifyingAnswer,
  type ClarifyingQuestion,
} from '@/lib/agent-draft'
import { generateAgentDraft, requestClarifyingQuestions } from '@/lib/agent-generate'
import { AgentSaveError, createAgent, type CreatedAgent } from '@/lib/agent-save'
import { AGENTS_NEW_ROUTE } from '@/lib/routes'
import { QuestionStep } from './QuestionStep'
import { HINT_STYLE, INPUT_STYLE, BOX_STYLE } from './styles'

type Stage =
  | { kind: 'purpose' }
  | { kind: 'asking' }
  | { kind: 'questions'; questions: ClarifyingQuestion[] }
  | { kind: 'working' }
  | { kind: 'failed'; message: string }

export interface CreateAgentInChatProps {
  open:            boolean
  /** What the agent should do, as far as the message said. Empty to ask. */
  initialPurpose:  string
  /** The message the user typed, so it can still be sent as ordinary chat. */
  originalMessage: string
  onClose:         () => void
  /**
   * The agent exists and is saved. The host shows it as a card in the chat; the
   * dialog closes itself right after calling this.
   */
  onCreated:       (result: CreatedInChat) => void
  /** "That wasn't a request to make an agent" — send the original message as chat. */
  onSendAsMessage: (message: string) => void
}

export interface CreatedInChat {
  draft:   AgentDraft
  created: CreatedAgent
  /** The message that asked for the agent, for the thread. */
  message: string
}

/** The new agent as the composer's agent chip. */
export function toComposerAgent(draft: AgentDraft, created: CreatedAgent): SelectedPersonaInfo {
  return {
    id:              created.repoId,
    name:            draft.name.trim(),
    handle:          `@${slugifyHandle(draft.name)}`,
    imageUrl:        created.imageUrl ?? draft.avatarUrl,
    modelId:         draft.modelId,
    activeVersionId: created.versionId,
    // Loaded by the host once the agent is attached, like any other agent chip.
    systemPrompt:    null,
    temperature:     draft.temperature,
    visibility:      'private',
    ownedByViewer:   true,
    description:     draft.description,
    tags:            draft.tags,
    paused:          false,
    shared:          false,
  }
}

function Working({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '36px 20px', textAlign: 'center' }}>
      <Spinner size={22} />
      <p style={{ margin: 0, fontFamily: 'var(--font-title)', fontSize: 18, lineHeight: '24px', color: 'var(--neutral-900)' }}>{title}</p>
      <p style={HINT_STYLE}>{subtitle}</p>
    </div>
  )
}

function Body({
  initialPurpose, originalMessage, onClose, onCreated, onSendAsMessage, onBusyChange,
}: Omit<CreateAgentInChatProps, 'open'> & { onBusyChange: (busy: boolean) => void }) {
  const { push } = useRouter()
  const startsAsking = initialPurpose.trim().length > 0
  const [stage, setStage] = useState<Stage>(startsAsking ? { kind: 'asking' } : { kind: 'purpose' })
  const [purposeText, setPurposeText] = useState(initialPurpose)
  const purposeRef = useRef(initialPurpose.trim())
  const answersRef = useRef<ClarifyingAnswer[]>([])
  const modelsRef = useRef<Promise<AIModel[]>>(Promise.resolve([]))
  // Results of anything the user has moved past are dropped.
  const runRef = useRef(0)

  const busy = stage.kind === 'working'
  useEffect(() => { onBusyChange(busy) }, [busy, onBusyChange])

  // Invalidate in-flight work if the dialog goes away.
  useEffect(() => () => { runRef.current += 1 }, [])

  useEffect(() => {
    modelsRef.current = fetchModelsWithCache().catch(() => [] as AIModel[])
  }, [])

  function build(text: string, answers: ClarifyingAnswer[]) {
    const run = ++runRef.current
    purposeRef.current = text
    answersRef.current = answers
    setStage({ kind: 'working' })
    void (async () => {
      let draft: AgentDraft
      try {
        const models = await modelsRef.current
        draft = (await generateAgentDraft({ purpose: text, answers, models })).draft
      } catch {
        if (run === runRef.current) setStage({ kind: 'failed', message: 'We couldn’t set up the agent just now.' })
        return
      }
      if (run !== runRef.current) return
      try {
        const created = await createAgent(draft)
        if (run !== runRef.current) return
        onCreated({ draft, created, message: originalMessage })
        if (created.published) toast.success(`“${draft.name.trim()}” is ready`)
        else toast.warning('Your agent was created but isn’t live yet. Open it to finish.')
        onClose()
      } catch (error) {
        if (run !== runRef.current) return
        setStage({
          kind: 'failed',
          message: error instanceof AgentSaveError ? error.message : 'We couldn’t create the agent. Please try again.',
        })
      }
    })()
  }

  function ask(text: string) {
    const run = ++runRef.current
    purposeRef.current = text
    setStage({ kind: 'asking' })
    void requestClarifyingQuestions(text).then(found => {
      if (run !== runRef.current) return
      if (found.length === 0) build(text, [])
      else setStage({ kind: 'questions', questions: found })
    })
  }

  // The first look at the purpose starts as soon as the dialog opens.
  useEffect(() => {
    if (!startsAsking) return
    const run = ++runRef.current
    void requestClarifyingQuestions(initialPurpose.trim()).then(found => {
      if (run !== runRef.current) return
      if (found.length === 0) build(initialPurpose.trim(), [])
      else setStage({ kind: 'questions', questions: found })
    })
    // Runs once per open: the body is re-mounted each time the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const footer = stage.kind !== 'working' && (
    <button
      type="button"
      onClick={() => { runRef.current += 1; onSendAsMessage(originalMessage); onClose() }}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline', color: 'var(--neutral-500)', fontFamily: 'var(--font-body)', fontSize: 13 }}
    >
      Not an agent? Send it as a normal message
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 20, minHeight: 0, overflowY: 'auto' }} className="kaya-scrollbar">
      {stage.kind === 'purpose' && (
        <>
          <p style={{ ...HINT_STYLE, fontSize: 14, lineHeight: '22px' }}>What should this agent do? One sentence is enough.</p>
          <div className="kaya-field" style={{ ...BOX_STYLE, padding: '10px 12px' }}>
            <textarea
              autoFocus
              rows={3}
              aria-label="Agent purpose"
              value={purposeText}
              placeholder="e.g. Triages support emails every morning"
              onChange={event => setPurposeText(event.target.value.slice(0, PURPOSE_MAX))}
              style={{ ...INPUT_STYLE, resize: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="default" size="sm" disabled={!purposeText.trim()} onClick={() => ask(purposeText.trim())}>Continue</Button>
          </div>
        </>
      )}

      {stage.kind === 'asking' && <Working title="Reading your request…" subtitle="Checking whether anything needs clarifying." />}

      {stage.kind === 'questions' && (
        <QuestionStep questions={stage.questions} onSubmit={answers => build(purposeRef.current, answers)} />
      )}

      {stage.kind === 'working' && <Working title="Creating your agent…" subtitle="Writing the instructions and picking a model." />}

      {stage.kind === 'failed' && (
        <>
          <p role="alert" style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-800)' }}>{stage.message}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { onClose(); push(`${AGENTS_NEW_ROUTE}?purpose=${encodeURIComponent(purposeRef.current)}`) }}
            >
              Set it up manually
            </Button>
            <Button variant="default" size="sm" onClick={() => build(purposeRef.current, answersRef.current)}>Try again</Button>
          </div>
        </>
      )}

      {footer}
    </div>
  )
}

/**
 * "Create an agent that…" typed into chat: asks what's unclear, makes the agent
 * and saves it straight away, then closes and hands the new agent to the host to
 * show as a card in the chat. Nothing is created until the questions are answered,
 * and closing before then creates nothing.
 */
export function CreateAgentInChat(props: CreateAgentInChatProps) {
  const { open, onClose } = props
  const [busy, setBusy] = useState(false)
  return (
    <ModalShell
      open={open}
      // The agent is being written; closing now would leave the user unsure whether it exists.
      onClose={() => { if (!busy) onClose() }}
      ariaLabel="Create an agent"
      width={720}
    >
      <ModalHeader
        title="Create an agent"
        subtitle="Made from your message — saved as soon as it’s ready."
        right={<IconButton variant="ghost" size="xs" icon={<CancelOneIcon />} aria-label="Close" disabled={busy} onClick={onClose} />}
      />
      <Body
        initialPurpose={props.initialPurpose}
        originalMessage={props.originalMessage}
        onClose={onClose}
        onCreated={props.onCreated}
        onSendAsMessage={props.onSendAsMessage}
        onBusyChange={setBusy}
      />
    </ModalShell>
  )
}
