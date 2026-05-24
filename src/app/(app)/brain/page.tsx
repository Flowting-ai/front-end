'use client'

import { Suspense, useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  BrainShell,
  StreamingIndicator,
  PlanCard,
  ActivityBlock,
  PauseCard,
  StreamingMessageBubble,
  LoopHistoryCard,
  BrainResultHeader,
  LoopCancelledCard,
  LoopFailedCard,
} from '@/templates/Brain'
import { MessageBubble } from '@/components/MessageBubble'
import { useAuth } from '@/context/auth-context'
import { useChatHistoryContext } from '@/context/chat-history-context'
import { useProjects } from '@/context/projects-context'
import { useModelSelectorContext } from '@/context/model-selector-context'
import type { SidebarProject, SidebarRecentItem } from '@/components/Sidebar'
import type { Phase, PlanStep, StepStatus } from '@/templates/Brain/lib/phase'
import { ChatAddMenu, USE_STYLE_OPTIONS, type SelectedPersonaInfo } from '@/components/chat/AddMenu'
import { ModelMenu, useModelButtonLabel } from '@/components/chat/ModelMenu'
import { AttachmentManager, type PendingAttachment } from '@/components/chat/AttachmentManager'
import { Dropdown } from '@/components/Dropdown'
import { Chip } from '@/components/Chip'
import { FolderOneIcon, GlobalSearchIcon, QuillWriteTwoIcon } from '@strange-huge/icons'
import { useFileUpload } from '@/hooks/use-file-upload'
import { fetchPersonas, getVersion } from '@/lib/api/personas'
import type { PinFolder } from '@/lib/api/pins'
import {
  startBrainChat,
  continueBrainChat,
  consumeBrainStream,
  getBrainMessages,
  respondToPrompt,
  stopBrainChat,
  type BackendPlanStep,
  type BrainMessage,
  type BrainPlanResponse,
} from '@/lib/api/brain'

// ── Page (Suspense wrapper required for useSearchParams) ──────────────────────

export default function BrainPage() {
  return (
    <Suspense fallback={null}>
      <BrainPageInner />
    </Suspense>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapBackendStepStatus(status?: string): StepStatus {
  switch (status) {
    case 'running':   return 'executing'
    case 'completed': return 'complete'
    case 'failed':    return 'failed'
    default:          return 'pending'
  }
}

function mapBackendStep(step: BackendPlanStep): PlanStep {
  return {
    id:         step.id,
    label:      step.title,
    connector:  step.connector_slug,
    isCritical: false,
    status:     mapBackendStepStatus(step.status),
  }
}

function mapHistoryPlanSteps(plan: BrainPlanResponse): PlanStep[] {
  return plan.plan_json.steps.map(mapBackendStep)
}

// ── Local completed-turn snapshot (built up during the session) ───────────────

interface LocalTurn {
  key:          string
  userInput:    string
  output:       string
  planSteps?:   PlanStep[]
  planSummary?: string
  completedAt?: Date
  cancelled:    boolean
}

// ── Counter input UI ──────────────────────────────────────────────────────────

interface CounterInputProps {
  value:    string
  onChange: (v: string) => void
  onSend:   () => void
  onCancel: () => void
}

function CounterInput({ value, onChange, onSend, onCancel }: CounterInputProps) {
  const canSend = value.trim().length > 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Describe how you'd like the plan revised…"
        rows={3}
        style={{
          width:           '100%',
          padding:         '12px',
          borderRadius:    '12px',
          border:          '1px solid var(--neutral-200)',
          fontFamily:      'var(--font-body)',
          fontSize:        'var(--font-size-body)',
          lineHeight:      'var(--line-height-body)',
          color:           'var(--neutral-800)',
          resize:          'none',
          outline:         'none',
          backgroundColor: 'var(--neutral-white)',
          boxSizing:       'border-box',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding:         '6px 14px',
            borderRadius:    999,
            border:          '1px solid var(--neutral-200)',
            backgroundColor: 'transparent',
            cursor:          'pointer',
            fontFamily:      'var(--font-body)',
            fontSize:        'var(--font-size-caption)',
            color:           'var(--neutral-600)',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          style={{
            padding:         '6px 14px',
            borderRadius:    999,
            border:          'none',
            backgroundColor: canSend ? 'var(--neutral-900)' : 'var(--neutral-200)',
            cursor:          canSend ? 'pointer' : 'not-allowed',
            fontFamily:      'var(--font-body)',
            fontSize:        'var(--font-size-caption)',
            color:           canSend ? 'var(--neutral-white)' : 'var(--neutral-400)',
          }}
        >
          Send counter
        </button>
      </div>
    </div>
  )
}

// ── Inner page ────────────────────────────────────────────────────────────────

// eslint-disable-next-line react-doctor/prefer-useReducer -- multiple useState calls; useReducer refactor deferred
function BrainPageInner() {
  const searchParams = useSearchParams()
  const { push, replace } = useRouter()
  const { user, logout, isAuthenticated } = useAuth()
  const chatHistory = useChatHistoryContext()
  const { projects, getChats, chats: projectChats } = useProjects()

  const chatIdFromUrl = searchParams.get('id')

  const displayName = user
    ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.name || ''
    : ''

  // ── Sidebar ─────────────────────────────────────────────────────────────────

  const projectChatIds = useMemo(
    () => new Set(projectChats.map((c) => c.id)),
    [projectChats],
  )

  const sidebarProjects = useMemo<SidebarProject[]>(
    () =>
      projects.map((p) => ({
        id:        p.id,
        label:     p.name,
        chatItems: getChats(p.id)
          .slice(0, 5)
          .map((c) => ({ id: c.id, label: c.title || 'Untitled' })),
      })),
    [projects, getChats],
  )

  const recentChats = useMemo<SidebarRecentItem[]>(
    () =>
      chatHistory.chats
        .filter((c) => !projectChatIds.has(c.id))
        .slice(0, 20)
        .map((c) => ({ id: c.id, label: c.title || 'Untitled' })),
    [chatHistory.chats, projectChatIds],
  )

  // ── Chat identity ────────────────────────────────────────────────────────────

  const [chatId, setChatId] = useState<string | null>(chatIdFromUrl)

  // ── Phase ────────────────────────────────────────────────────────────────────

  const [phase, setPhase] = useState<Phase>('idle')

  // ── Active turn ──────────────────────────────────────────────────────────────

  const [userMessage, setUserMessage]             = useState('')
  const [activePlanSteps, setActivePlanSteps]     = useState<PlanStep[]>([])
  const [activePlanSummary, setActivePlanSummary] = useState('')
  const [promptId, setPromptId]                   = useState('')
  const [stepStatuses, setStepStatuses]           = useState<Record<string, StepStatus>>({})
  const [streamedContent, setStreamedContent]     = useState('')
  const [streamingComplete, setStreamingComplete] = useState(false)
  const [completedAt, setCompletedAt]             = useState<Date | null>(null)
  const [streamError, setStreamError]             = useState<string | null>(null)

  // ── Counter flow ─────────────────────────────────────────────────────────────

  const [showCounterInput, setShowCounterInput] = useState(false)
  const [counterText, setCounterText]           = useState('')

  // ── Pause ────────────────────────────────────────────────────────────────────

  const [pausedAfterLabel, setPausedAfterLabel] = useState<string | undefined>()

  // ── History ──────────────────────────────────────────────────────────────────

  const [historyMessages, setHistoryMessages] = useState<BrainMessage[]>([])
  const [localTurns, setLocalTurns]           = useState<LocalTurn[]>([])
  const [historyLoaded, setHistoryLoaded]     = useState(!chatIdFromUrl)

  // ── Refs ─────────────────────────────────────────────────────────────────────

  const abortRef         = useRef<AbortController | null>(null)
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const turnCounterRef   = useRef(0)

  // ── Add-menu feature state ────────────────────────────────────────────────

  const { models, selectedModel, selectModel, open: openModelSelector } = useModelSelectorContext()
  const modelButtonLabel = useModelButtonLabel()
  const { processFiles, FILE_ACCEPT } = useFileUpload()

  const [webSearchEnabled,     setWebSearchEnabled]     = useState(false)
  const [selectedStyleId,      setSelectedStyleId]      = useState<string | null>(null)
  const [styleChipOpen,        setStyleChipOpen]        = useState(false)
  const [selectedFolders,      setSelectedFolders]      = useState<PinFolder[]>([])
  const [selectedPersona,      setSelectedPersona]      = useState<SelectedPersonaInfo | null>(null)
  const [personaChipOpen,      setPersonaChipOpen]      = useState(false)
  const [chipPersonas,         setChipPersonas]         = useState<SelectedPersonaInfo[]>([])
  const [loadingChipPersonas,  setLoadingChipPersonas]  = useState(false)
  const [brainAttachments,     setBrainAttachments]     = useState<PendingAttachment[]>([])

  const fileInputRef    = useRef<HTMLInputElement>(null)
  const selectModelRef  = useRef(selectModel)
  selectModelRef.current = selectModel

  // eslint-disable-next-line react-doctor/no-cascading-set-state -- React 18+ batches these; useReducer refactor tracked separately
  useEffect(() => {
    if (!selectedPersona) return
    if (selectedPersona.systemPrompt !== null) {
      if (selectedPersona.modelId && models.length > 0) {
        const match = models.find(m => String(m.modelId ?? m.id) === String(selectedPersona.modelId))
        if (match) selectModelRef.current(match)
      }
      return
    }
    if (!selectedPersona.activeVersionId) {
      if (selectedPersona.modelId && models.length > 0) {
        const match = models.find(m => String(m.modelId ?? m.id) === String(selectedPersona.modelId))
        if (match) selectModelRef.current(match)
      }
      return
    }
    let cancelled = false
    getVersion(selectedPersona.id, selectedPersona.activeVersionId)
      .then(version => {
        if (cancelled) return
        if (version.model_id && models.length > 0) {
          const match = models.find(m => String(m.modelId ?? m.id) === version.model_id)
          if (match) selectModelRef.current(match)
        }
        setSelectedPersona(prev =>
          prev?.id === selectedPersona.id
            ? { ...prev, modelId: version.model_id ?? prev.modelId, systemPrompt: version.prompt, temperature: version.temperature }
            : prev
        )
      })
      .catch(() => {})
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- selectModel intentionally via ref
  }, [selectedPersona, models])

  // eslint-disable-next-line react-doctor/no-cascading-set-state -- React 18+ batches these; useReducer refactor tracked separately
  useEffect(() => {
    if (!personaChipOpen) return
    setLoadingChipPersonas(true)
    fetchPersonas()
      .then(list => setChipPersonas(list.map(p => ({ id: p.id, name: p.name, imageUrl: p.imageUrl, modelId: p.modelId, activeVersionId: p.activeVersionId, systemPrompt: null, temperature: null }))))
      .catch(() => setChipPersonas([]))
      .finally(() => setLoadingChipPersonas(false))
  }, [personaChipOpen])

  useEffect(() => () => {
    if (completeTimerRef.current) clearTimeout(completeTimerRef.current)
    abortRef.current?.abort()
  }, [])

  // ── Load history on mount (when chat_id is in URL) ───────────────────────────

  useEffect(() => {
    if (!chatIdFromUrl) return

    void getBrainMessages(chatIdFromUrl)
      .then((messages) => {
        setHistoryMessages(messages)
        setHistoryLoaded(true)
      })
      .catch(() => {
        setHistoryLoaded(true)
      })
  }, [chatIdFromUrl])

  // ── Derived plan steps (base + live step statuses) ───────────────────────────

  const planSteps = useMemo<PlanStep[]>(
    () => activePlanSteps.map((s) => ({
      ...s,
      status: stepStatuses[s.id] ?? s.status,
    })),
    [activePlanSteps, stepStatuses],
  )

  // ── SSE named-event handler ───────────────────────────────────────────────────

  const handleNamedEvent = useCallback((name: string, data: unknown) => {
    const d = data as Record<string, unknown>

    switch (name) {
      case 'plan_proposed': {
        const rawSteps = ((d.steps ?? []) as BackendPlanStep[])
        const steps    = rawSteps.map(mapBackendStep)
        setActivePlanSteps(steps)
        setActivePlanSummary((d.summary as string) ?? '')
        setStepStatuses(Object.fromEntries(steps.map((s) => [s.id, 'pending' as StepStatus])))
        setShowCounterInput(false)
        setCounterText('')
        setPhase('planning')
        break
      }

      case 'user_prompt': {
        if (d.kind === 'plan') {
          setPromptId((d.prompt_id as string) ?? '')
        }
        break
      }

      case 'plan_approved': {
        setPhase('executing')
        break
      }

      case 'plan_countered': {
        // Opus is revising; wait for the next plan_proposed
        setPhase('thinking')
        break
      }

      case 'plan_cancelled': {
        setPhase('cancelled')
        break
      }

      case 'step_started': {
        const stepId = d.step_id as string
        setStepStatuses((prev) => ({ ...prev, [stepId]: 'executing' }))
        break
      }

      case 'step_completed': {
        const stepId = d.step_id as string
        setStepStatuses((prev) => ({ ...prev, [stepId]: 'complete' }))
        break
      }

      case 'step_failed': {
        const stepId = d.step_id as string
        setStepStatuses((prev) => ({ ...prev, [stepId]: 'failed' }))
        // Execution halts; Opus narration follows as content events
        break
      }

      case 'message_saved': {
        if (completeTimerRef.current) clearTimeout(completeTimerRef.current)
        completeTimerRef.current = setTimeout(() => {
          setStreamingComplete(true)
          completeTimerRef.current = setTimeout(() => {
            setCompletedAt(new Date())
            setPhase('complete')
          }, 400)
        }, 400)
        break
      }

      default:
        break
    }
  }, [])

  // ── SSE inline-event handler ──────────────────────────────────────────────────

  const handleInlineEvent = useCallback((data: unknown) => {
    const d = data as Record<string, unknown>

    if (d.type === 'content') {
      const token = (d.content as string) ?? ''
      setStreamedContent((prev) => prev + token)
      // Transition to streaming on first content token (whether after steps or trivial answer)
      setPhase((prev) =>
        prev === 'executing' || prev === 'thinking' || prev === 'planning'
          ? 'streaming'
          : prev,
      )
    }
  }, [])

  // ── Snapshot + reset active turn ─────────────────────────────────────────────

  const snapshotAndReset = useCallback((
    opts: { cancelled?: boolean } = {},
    currentPlanSteps: PlanStep[],
    currentUserMessage: string,
    currentStreamedContent: string,
    currentActivePlanSummary: string,
    currentCompletedAt: Date | null,
  ) => {
    const key = `turn-${++turnCounterRef.current}`
    setLocalTurns((prev) => [
      ...prev,
      {
        key,
        userInput:   currentUserMessage,
        output:      currentStreamedContent,
        planSteps:   currentPlanSteps.length > 0 ? currentPlanSteps : undefined,
        planSummary: currentActivePlanSummary || undefined,
        completedAt: currentCompletedAt ?? undefined,
        cancelled:   opts.cancelled ?? false,
      },
    ])

    // Reset all active-turn state
    setUserMessage('')
    setStreamedContent('')
    setStreamingComplete(false)
    setCompletedAt(null)
    setStreamError(null)
    setActivePlanSteps([])
    setActivePlanSummary('')
    setPromptId('')
    setStepStatuses({})
    setShowCounterInput(false)
    setCounterText('')
    setPausedAfterLabel(undefined)
  }, [])

  // ── Stream runner ─────────────────────────────────────────────────────────────

  const runBrainStream = useCallback(async (
    input:            string,
    existingChatId:   string | null,
  ) => {
    if (completeTimerRef.current) {
      clearTimeout(completeTimerRef.current)
      completeTimerRef.current = null
    }

    setUserMessage(input)
    setPhase('thinking')
    setStreamedContent('')
    setStreamingComplete(false)
    setCompletedAt(null)
    setStreamError(null)
    setActivePlanSteps([])
    setActivePlanSummary('')
    setPromptId('')
    setStepStatuses({})
    setShowCounterInput(false)
    setCounterText('')

    const controller = new AbortController()
    abortRef.current = controller

    try {
      let response: Response
      let resolvedChatId = existingChatId

      if (!resolvedChatId) {
        const result = await startBrainChat(input, {}, controller.signal)
        resolvedChatId = result.chatId
        response = result.stream
        if (resolvedChatId) {
          setChatId(resolvedChatId)
          replace(`/brain?id=${resolvedChatId}`, { scroll: false })
        }
      } else {
        response = await continueBrainChat(resolvedChatId, input, {}, controller.signal)
      }

      await consumeBrainStream(response, {
        onNamed:  handleNamedEvent,
        onInline: handleInlineEvent,
        onClose:  () => {},
        onError:  (e) => {
          if (e.name === 'AbortError') return
          console.error('[Brain] stream error:', e)
        },
      })
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return
      console.error('[Brain] stream failed:', e)
      const msg = (e as Error)?.message ?? 'Something went wrong. Please try again.'
      setStreamError(msg)
      setPhase('failed')
    }
  }, [handleNamedEvent, handleInlineEvent, replace])

  // ── Send handler ──────────────────────────────────────────────────────────────

  const handleSend = useCallback((value: string) => {
    const terminalPhases: Phase[] = ['complete', 'cancelled', 'failed']
    if (terminalPhases.includes(phase)) {
      // Archive the finished turn before starting a new one
      snapshotAndReset(
        { cancelled: phase === 'cancelled' },
        planSteps,
        userMessage,
        streamedContent,
        activePlanSummary,
        completedAt,
      )
    }
    void runBrainStream(value, chatId)
  }, [
    phase, chatId, planSteps, userMessage, streamedContent,
    activePlanSummary, completedAt, snapshotAndReset, runBrainStream,
  ])

  // ── Plan decisions ────────────────────────────────────────────────────────────

  const handleApprove = useCallback(() => {
    if (!promptId) return
    void respondToPrompt(promptId, { response: { decision: 'approve' } }).catch((e) => {
      console.error('[Brain] approve failed:', e)
    })
  }, [promptId])

  const handleCounter = useCallback(() => {
    setShowCounterInput(true)
  }, [])

  const handleCounterSend = useCallback(() => {
    if (!promptId || !counterText.trim()) return
    void respondToPrompt(promptId, {
      response: { decision: 'counter', counter_text: counterText.trim() },
    }).catch((e) => {
      console.error('[Brain] counter failed:', e)
    })
    setShowCounterInput(false)
    setCounterText('')
  }, [promptId, counterText])

  const handlePlanCancel = useCallback(() => {
    if (!promptId) {
      setPhase('cancelled')
      return
    }
    void respondToPrompt(promptId, { response: { decision: 'cancel' } }).catch((e) => {
      console.error('[Brain] cancel failed:', e)
      setPhase('cancelled')
    })
  }, [promptId])

  // ── Stop ──────────────────────────────────────────────────────────────────────

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    if (chatId) {
      void stopBrainChat(chatId).catch(() => {})
    }
    const completedSteps = planSteps.filter((s) => s.status === 'complete')
    setPausedAfterLabel(completedSteps[completedSteps.length - 1]?.label)
    setPhase('paused')
  }, [chatId, planSteps])

  // ── Pause card ────────────────────────────────────────────────────────────────

  const handleContinue = useCallback(() => {
    // Re-run the same input; the backend starts a fresh execution turn
    void runBrainStream(userMessage, chatId)
  }, [runBrainStream, userMessage, chatId])

  const handleChangeDirection = useCallback(() => {
    // Go back to the plan approval screen so the user can re-inspect
    setPhase('planning')
  }, [])

  // ── Restart ───────────────────────────────────────────────────────────────────

  const handleRestart = useCallback(() => {
    snapshotAndReset(
      { cancelled: phase === 'cancelled' },
      planSteps,
      userMessage,
      streamedContent,
      activePlanSummary,
      completedAt,
    )
    setPhase('idle')
  }, [phase, planSteps, userMessage, streamedContent, activePlanSummary, completedAt, snapshotAndReset])

  // ── Thread: history from server (reload path) ─────────────────────────────────

  const historyElements = historyMessages.map((msg) => (
    <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingTop: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <MessageBubble role="user" content={msg.input} maxWidth="75%" />
      </div>
      {msg.plan && msg.plan.plan_json.steps.length > 0 && (
        <LoopHistoryCard
          steps={mapHistoryPlanSteps(msg.plan)}
          completedAt={new Date(msg.created_at)}
        />
      )}
      {msg.output && (
        <StreamingMessageBubble content={msg.output} isComplete />
      )}
    </div>
  ))

  // ── Thread: locally completed turns (same session) ───────────────────────────

  const localTurnElements = localTurns.map((turn) => (
    <div key={turn.key} style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingTop: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <MessageBubble role="user" content={turn.userInput} maxWidth="75%" />
      </div>
      {turn.planSteps && turn.planSteps.length > 0 && (
        <LoopHistoryCard
          steps={turn.planSteps}
          completedAt={turn.completedAt}
        />
      )}
      {turn.output && (
        <StreamingMessageBubble content={turn.output} isComplete />
      )}
      {turn.cancelled && !turn.output && (
        <LoopCancelledCard
          completedSteps={turn.planSteps?.filter((s) => s.status === 'complete').length ?? 0}
          totalSteps={turn.planSteps?.length ?? 0}
          onStartNew={handleRestart}
        />
      )}
    </div>
  ))

  // ── Thread: active turn ───────────────────────────────────────────────────────

  const showActivityBlock = phase === 'executing' || phase === 'paused'

  const activeTurnContent = userMessage ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingTop: 40 }}>

      {/* User message bubble */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <MessageBubble role="user" content={userMessage} maxWidth="75%" />
      </div>

      {/* Thinking */}
      {phase === 'thinking' && <StreamingIndicator phase="thinking" />}

      {/* Plan card + optional counter input */}
      {phase === 'planning' && (
        <>
          <PlanCard
            steps={planSteps}
            interpretation={activePlanSummary}
            onApprove={handleApprove}
            onCounter={handleCounter}
            onCancel={handlePlanCancel}
          />
          {showCounterInput && (
            <CounterInput
              value={counterText}
              onChange={setCounterText}
              onSend={handleCounterSend}
              onCancel={() => { setShowCounterInput(false); setCounterText('') }}
            />
          )}
        </>
      )}

      {/* ActivityBlock — persists through executing and paused */}
      {showActivityBlock && (
        <ActivityBlock steps={planSteps} interpretation={activePlanSummary} />
      )}

      {/* PauseCard */}
      {phase === 'paused' && (
        <PauseCard
          pausedAfterStep={pausedAfterLabel}
          onContinue={handleContinue}
          onChangeDirection={handleChangeDirection}
          onCancel={() => setPhase('cancelled')}
        />
      )}

      {/* Streaming */}
      {phase === 'streaming' && (
        <>
          <StreamingIndicator phase="streaming" />
          <StreamingMessageBubble
            content={streamedContent}
            isComplete={streamingComplete}
          />
        </>
      )}

      {/* Complete */}
      {phase === 'complete' && (
        <>
          <BrainResultHeader summary={activePlanSummary || 'Analysis complete'} />
          <StreamingMessageBubble content={streamedContent} isComplete />
          {planSteps.length > 0 && (
            <LoopHistoryCard steps={planSteps} completedAt={completedAt ?? undefined} />
          )}
        </>
      )}

      {/* Cancelled */}
      {phase === 'cancelled' && (
        <LoopCancelledCard
          completedSteps={planSteps.filter((s) => s.status === 'complete').length}
          totalSteps={planSteps.length}
          onStartNew={handleRestart}
        />
      )}

      {/* Failed */}
      {phase === 'failed' && (
        <LoopFailedCard errorDetail={streamError ?? undefined} onTryAgain={handleRestart} onRephrase={handleRestart} />
      )}

    </div>
  ) : null

  // ── Add menu + chips ──────────────────────────────────────────────────────────

  const activeStyle = USE_STYLE_OPTIONS.find(s => s.id === selectedStyleId) ?? null

  const styleChip = activeStyle && (
    <Dropdown.Float
      open={styleChipOpen}
      onOpenChange={setStyleChipOpen}
      placement="top-start"
      trigger={
        <Chip
          label={activeStyle.label}
          icon={<QuillWriteTwoIcon size={20} color="var(--chip-text)" />}
          onRemove={() => setSelectedStyleId(null)}
          onExpand={() => setStyleChipOpen(v => !v)}
        />
      }
    >
      <Dropdown size="md">
        <Dropdown.Section fluid>
          {USE_STYLE_OPTIONS.map(opt => (
            <Dropdown.Item
              key={opt.id}
              label={opt.label}
              subLabel={opt.subLabel}
              selected={opt.id === 'none' ? selectedStyleId === null : selectedStyleId === opt.id}
              onClick={() => { setSelectedStyleId(opt.id === 'none' ? null : opt.id); setStyleChipOpen(false) }}
              fluid
            />
          ))}
        </Dropdown.Section>
      </Dropdown>
    </Dropdown.Float>
  )

  const folderChips = selectedFolders.map(folder => (
    <Chip
      key={folder.id}
      label={folder.name}
      icon={<FolderOneIcon size={20} color="var(--chip-text)" />}
      onRemove={() => setSelectedFolders(prev => prev.filter(f => f.id !== folder.id))}
    />
  ))

  const webSearchChip = webSearchEnabled ? (
    <Chip
      key="web-search"
      size="Medium"
      icon={<GlobalSearchIcon size={20} color="var(--chip-text)" />}
      label="Web search"
      onRemove={() => setWebSearchEnabled(false)}
    />
  ) : null

  const personaChip = selectedPersona ? (
    <Dropdown.Float
      open={personaChipOpen}
      onOpenChange={setPersonaChipOpen}
      placement="top-start"
      trigger={
        <Chip
          label={selectedPersona.name}
          personaImage={selectedPersona.imageUrl ?? undefined}
          onRemove={() => setSelectedPersona(null)}
          onExpand={() => setPersonaChipOpen(v => !v)}
          title={undefined}
          style={undefined}
        />
      }
    >
      <Dropdown size="md" style={{ minWidth: 200 }} maxHeight="min(280px, calc(100dvh - 120px))">
        <Dropdown.Section fluid>
          {loadingChipPersonas
            ? <Dropdown.Item label="Loading…" fluid disabled />
            : chipPersonas.length > 0
              ? chipPersonas.map(p => (
                  <Dropdown.Item
                    key={p.id}
                    label={p.name}
                    fluid
                    selected={selectedPersona.id === p.id}
                    onClick={() => { setSelectedPersona(p); setPersonaChipOpen(false) }}
                  />
                ))
              : <Dropdown.Item label="No personas yet" fluid disabled />
          }
        </Dropdown.Section>
      </Dropdown>
    </Dropdown.Float>
  ) : null

  const chips = (styleChip || folderChips.length > 0 || webSearchChip || personaChip) ? (
    <>{styleChip}{folderChips}{webSearchChip}{personaChip}</>
  ) : undefined

  const addMenu = (
    <ChatAddMenu
      webSearchEnabled={webSearchEnabled}
      onWebSearchChange={setWebSearchEnabled}
      onAddFilesClick={() => fileInputRef.current?.click()}
      selectedStyleId={selectedStyleId}
      onStyleChange={setSelectedStyleId}
      selectedFolders={selectedFolders}
      onFolderToggle={(folder) => setSelectedFolders(prev =>
        prev.some(f => f.id === folder.id) ? prev.filter(f => f.id !== folder.id) : [...prev, folder]
      )}
      selectedPersonaId={selectedPersona?.id ?? null}
      onPersonaChange={setSelectedPersona}
    />
  )

  const brainIsStreaming = !['idle', 'complete', 'cancelled', 'failed', 'paused'].includes(phase)

  // ── Has any content to render ─────────────────────────────────────────────────

  const hasContent = historyMessages.length > 0 || localTurns.length > 0 || !!userMessage

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={FILE_ACCEPT}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            setBrainAttachments(prev => processFiles(Array.from(e.target.files!), prev))
            e.target.value = ''
          }
        }}
        style={{ display: 'none' }}
        aria-hidden="true"
      />
    <BrainShell
      defaultPhase={phase}
      onSend={handleSend}
      chatInputProps={{
        isStreaming: brainIsStreaming,
        disabled: brainIsStreaming,
        onStop: handleStop,
        addMenu,
        modelMenu: <ModelMenu />,
        modelName: modelButtonLabel,
        chips,
        attachmentsSlot: (
          <AttachmentManager
            attachments={brainAttachments}
            onAttachmentsChange={setBrainAttachments}
          />
        ),
      }}
      sidebarProps={{
        userName:        displayName || 'Account',
        userEmail:       user?.email ?? '',
        isAuthenticated,
        projects:        sidebarProjects,
        recents:         recentChats,
        onSelectChat:    (id) => push(`/chat?id=${id}`),
        onNewChat:       () => push('/chat'),
        onChatsClick:    () => push('/chats'),
        onPersonasClick: () => push('/personas'),
        onProjectsClick: () => push('/projects'),
        onSettingsClick: () => push('/settings'),
        onHelpClick:     () => push('/settings/help'),
        onLogoutClick:   () => { void logout() },
        onBrainClick:    undefined,
      }}
    >
      {historyLoaded && hasContent ? (
        <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 20 }}>
          {historyElements}
          {localTurnElements}
          {activeTurnContent}
        </div>
      ) : null}
    </BrainShell>
    </>
  )
}
