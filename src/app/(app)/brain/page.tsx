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
import type { SidebarProject, SidebarRecentItem } from '@/components/Sidebar'
import type { Phase, PlanStep, StepStatus } from '@/templates/Brain/lib/phase'
import { StopCircleIcon } from '@strange-huge/icons'
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

  // ── Stop chip ─────────────────────────────────────────────────────────────────

  const stopChip = phase === 'executing' ? (
    <button
      type="button"
      onClick={handleStop}
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        gap:             5,
        padding:         '4px 10px',
        borderRadius:    999,
        border:          '1px solid var(--neutral-200)',
        backgroundColor: 'var(--neutral-white)',
        cursor:          'pointer',
        fontFamily:      'var(--font-body)',
        fontSize:        'var(--font-size-caption)',
        fontWeight:      'var(--font-weight-medium)',
        color:           'var(--neutral-600)',
        userSelect:      'none',
        boxShadow:       '0 1px 2px rgba(0,0,0,0.06)',
      }}
    >
      <StopCircleIcon size={12} color="var(--neutral-500)" />
      Stop
    </button>
  ) : undefined

  // ── Has any content to render ─────────────────────────────────────────────────

  const hasContent = historyMessages.length > 0 || localTurns.length > 0 || !!userMessage

  return (
    <BrainShell
      defaultPhase={phase}
      onSend={handleSend}
      chatInputProps={stopChip ? { chips: stopChip } : undefined}
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
  )
}
