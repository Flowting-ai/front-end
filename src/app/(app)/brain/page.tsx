'use client'

import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  BrainShell,
  StreamingIndicator,
  ClarificationSummary,
  PinConfirmationCard,
  PlanCard,
  ActivityBlock,
  PauseCard,
  NodeFailureCard,
  StreamingMessageBubble,
  ArtifactCard,
  LoopHistoryCard,
  BrainResultHeader,
  LoopCancelledCard,
  LoopFailedCard,
} from '@/templates/Brain'
import type { ClarificationSummaryItem } from '@/templates/Brain'
import { MessageBubble } from '@/components/MessageBubble'
import { useAuth } from '@/context/auth-context'
import { useChatHistoryContext } from '@/context/chat-history-context'
import { useProjects } from '@/context/projects-context'
import type { SidebarProject, SidebarRecentItem } from '@/components/Sidebar'
import type { Phase, PlanStep, StepStatus } from '@/templates/Brain/lib/phase'
import { StopCircleIcon } from '@strange-huge/icons'

// ── Demo clarification questions ──────────────────────────────────────────────

const CLARIFICATION_QUESTIONS = [
  {
    question: 'Which feedback channels should I include in the analysis?',
    options: [
      { id: 'all',       label: 'All channels (Intercom, reviews, surveys)' },
      { id: 'intercom',  label: 'Intercom support tickets' },
      { id: 'reviews',   label: 'App store reviews' },
      { id: 'surveys',   label: 'NPS & in-app surveys' },
    ],
  },
  {
    question: 'What time range should I treat as Q1?',
    options: [
      { id: 'q1-2026', label: 'Jan – Mar 2026 (this year)' },
      { id: 'q1-2025', label: 'Jan – Mar 2025 (last year)' },
      { id: 'last-90', label: 'Rolling last 90 days' },
    ],
  },
  {
    question: "How should I define a 'friction point'?",
    options: [
      { id: 'complaints',  label: 'High-frequency complaint themes' },
      { id: 'dropoff',     label: 'Drop-off events with user comments' },
      { id: 'escalations', label: 'Tickets that required escalation' },
      { id: 'sentiment',   label: 'Any negative sentiment mention' },
    ],
  },
]

const TOTAL_QUESTIONS = CLARIFICATION_QUESTIONS.length

// ── Demo pins surfaced by Pinboard search ─────────────────────────────────────

const DEMO_PINS = [
  { id: 'pin-1', title: 'Q4 2025 User Feedback Summary',        source: 'Notion' },
  { id: 'pin-2', title: 'NPS Score Trends – Q3 to Q4',          source: 'Google Drive' },
  { id: 'pin-3', title: 'Friction Points – Design Review Notes', source: 'Figma' },
]

// ── Demo plan steps ───────────────────────────────────────────────────────────

interface BasePlanStep {
  id:                    string
  label:                 string
  connector?:            string
  isCritical:            boolean
  requiresConnectorName?: string
}

const BASE_PLAN_STEPS: BasePlanStep[] = [
  { id: 's1', label: 'Pull Q1 Intercom support tickets', connector: 'Intercom', isCritical: true,  requiresConnectorName: 'Intercom' },
  { id: 's2', label: 'Fetch Q1 Mixpanel event logs',     connector: 'Mixpanel', isCritical: true,  requiresConnectorName: 'Mixpanel' },
  { id: 's3', label: 'Load NPS survey responses',                               isCritical: false },
  { id: 's4', label: 'Classify feedback into themes',                           isCritical: true },
  { id: 's5', label: 'Rank top 5 friction points',                              isCritical: true },
  { id: 's6', label: 'Draft analysis report',                                   isCritical: true },
]

const CONNECTOR_DESCRIPTIONS: Record<string, string> = {
  Intercom: 'Read support conversations',
  Mixpanel: 'Read product analytics events',
}

const PLAN_INTERPRETATION =
  "I'll pull Q1 feedback from all channels, classify themes across the data, and surface the top 5 friction points with a written analysis."

// ── Demo streaming output ─────────────────────────────────────────────────────

const DEMO_OUTPUT = `## Q1 Friction Point Analysis

**Analyzed:** 847 Intercom tickets · 234 NPS responses · 1,102 app reviews

### Top 5 Friction Points

**1. Onboarding drop-off** (37% of feedback)
Users abandon setup at the "Connect your first integration" step. Permission dialogs appear without explanation of why access is needed.

**2. Slow first-load times** (24%)
The dashboard takes 8–12 seconds on first visit. NPS respondents repeatedly cite slow load as their primary reason for low scores.

**3. Confusing pricing tiers** (19%)
Locked features appear in the UI without indicating which plan unlocks them. Users don't know what they're missing or how to upgrade.

**4. Export failures** (11%)
CSV and PDF exports fail silently for datasets over 10,000 rows. The export button does nothing — no error, no feedback.

**5. Mobile navigation** (9%)
The sidebar collapses on screens under 1,024px but the mobile fallback omits Projects and Pinboard entirely.`

// ── Page ─────────────────────────────────────────────────────────────────────

export default function BrainPage() {
  const router = useRouter()
  const { user, logout, isAuthenticated } = useAuth()
  const chatHistory = useChatHistoryContext()
  const { projects, getChats, chats: projectChats } = useProjects()

  const displayName = user
    ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.name || ''
    : ''

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

  // ── Phase + message ───────────────────────────────────────────────────────

  const [phase, setPhase]           = useState<Phase>('idle')
  const [userMessage, setUserMessage] = useState('')

  // ── Clarification ─────────────────────────────────────────────────────────

  const [clarificationStep, setClarificationStep]           = useState(0)
  const [answeredClarifications, setAnsweredClarifications] = useState<ClarificationSummaryItem[]>([])
  const [currentSelected, setCurrentSelected]               = useState<string | undefined>(undefined)

  // ── Connector auth ────────────────────────────────────────────────────────

  const [connectedConnectors, setConnectedConnectors] = useState<Set<string>>(new Set())

  // ── Execution step statuses ───────────────────────────────────────────────

  const [stepStatuses, setStepStatuses]   = useState<Record<string, StepStatus>>({})
  const [executingIdx, setExecutingIdx]   = useState(0)
  const [pausedAfterLabel, setPausedAfterLabel] = useState<string | undefined>(undefined)

  // ── Node failure ──────────────────────────────────────────────────────────
  // Refs are read synchronously inside setTimeout so they're always current.

  // s3 (non-critical) fails on first encounter; ref gates the one-time failure.
  const firstFailureHandledRef  = useRef(false)
  // If s3 is skipped, s4 (critical) fails. Ref tracks the skip.
  const s3SkippedRef            = useRef(false)
  // If user re-runs s4 after it already failed critically, that attempt is fatal.
  const criticalRerunAttemptRef = useRef(false)

  // Currently failed step shown in NodeFailureCard.
  const [failedStepData, setFailedStepData] = useState<{
    label:      string
    isCritical: boolean
    error:      string
  } | null>(null)

  // Info stored when the loop enters the unrecoverable 'failed' phase.
  const [failedPhaseInfo, setFailedPhaseInfo] = useState<{
    step:  string
    error: string
  } | null>(null)

  // ── Streaming + completion ────────────────────────────────────────────────

  const [streamedContent, setStreamedContent]       = useState('')
  const [streamingComplete, setStreamingComplete]   = useState(false)
  const [completedAt, setCompletedAt]               = useState<Date | null>(null)

  // ── Timer refs ────────────────────────────────────────────────────────────

  const timerRef          = useRef<ReturnType<typeof setTimeout>  | null>(null)
  const streamIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => {
    if (timerRef.current)          clearTimeout(timerRef.current)
    if (streamIntervalRef.current) clearInterval(streamIntervalRef.current)
  }, [])

  // ── Derived: live plan steps ──────────────────────────────────────────────

  const handleConnectConnector = useCallback((name: string) => {
    setConnectedConnectors((prev) => new Set([...prev, name]))
  }, [])

  const planSteps = useMemo<PlanStep[]>(
    () =>
      BASE_PLAN_STEPS.map((base) => ({
        id:         base.id,
        label:      base.label,
        connector:  base.connector,
        isCritical: base.isCritical,
        status:     stepStatuses[base.id] ?? 'pending',
        requiresConnector: base.requiresConnectorName
          ? {
              name:        base.requiresConnectorName,
              description: CONNECTOR_DESCRIPTIONS[base.requiresConnectorName],
              isConnected: connectedConnectors.has(base.requiresConnectorName),
              onConnect:   () => handleConnectConnector(base.requiresConnectorName!),
            }
          : undefined,
      })),
    [stepStatuses, connectedConnectors, handleConnectConnector],
  )

  // ── Execution simulation ──────────────────────────────────────────────────
  // Runs one step per 2 s. Refs gate two demo failure scenarios:
  //   • s3 (index 2, non-critical): fails once on first run.
  //   • s4 (index 3, critical): fails if s3 was skipped; re-running s4
  //     after that critical failure causes a fatal loop failure.

  useEffect(() => {
    if (phase !== 'executing') return

    const step = BASE_PLAN_STEPS[executingIdx]
    if (!step) {
      // All steps done — begin streaming.
      setPhase('streaming')
      return
    }

    setStepStatuses((prev) => ({ ...prev, [step.id]: 'executing' }))

    const id = setTimeout(() => {
      const isFirstNonCriticalFail =
        executingIdx === 2 && !firstFailureHandledRef.current

      const isCriticalFail =
        executingIdx === 3 &&
        s3SkippedRef.current &&
        !criticalRerunAttemptRef.current

      const isFatalFail =
        executingIdx === 3 &&
        s3SkippedRef.current &&
        criticalRerunAttemptRef.current

      if (isFirstNonCriticalFail) {
        firstFailureHandledRef.current = true
        setStepStatuses((prev) => ({ ...prev, [step.id]: 'failed' }))
        setFailedStepData({
          label:      step.label,
          isCritical: step.isCritical,
          error:      'Failed to reach the survey data endpoint. The API returned 401 Unauthorized.',
        })
        setPhase('node-failed')
        return
      }

      if (isCriticalFail) {
        setStepStatuses((prev) => ({ ...prev, [step.id]: 'failed' }))
        setFailedStepData({
          label:      step.label,
          isCritical: step.isCritical,
          error:      'Theme classification service unavailable. Could not process the feedback corpus.',
        })
        setPhase('node-failed')
        return
      }

      if (isFatalFail) {
        setStepStatuses((prev) => ({ ...prev, [step.id]: 'failed' }))
        setFailedPhaseInfo({
          step:  step.label,
          error: 'Classification service returned repeated errors after retry. The feedback corpus may be malformed or too large to process.',
        })
        setPhase('failed')
        return
      }

      setStepStatuses((prev) => ({ ...prev, [step.id]: 'complete' }))
      setExecutingIdx((i) => i + 1)
    }, 2000)

    return () => clearTimeout(id)
  }, [phase, executingIdx])

  // ── Streaming simulation ──────────────────────────────────────────────────
  // Delivers chunks of DEMO_OUTPUT every 250 ms to simulate token streaming.
  // StreamingMessageBubble's internal typewriter catches up with each chunk.

  useEffect(() => {
    if (phase !== 'streaming') return

    setStreamedContent('')
    setStreamingComplete(false)

    const CHUNK = 60
    let pos = 0

    streamIntervalRef.current = setInterval(() => {
      pos = Math.min(pos + CHUNK, DEMO_OUTPUT.length)
      setStreamedContent(DEMO_OUTPUT.slice(0, pos))

      if (pos >= DEMO_OUTPUT.length) {
        clearInterval(streamIntervalRef.current!)
        streamIntervalRef.current = null

        // Allow typewriter to finish, then mark complete and transition.
        timerRef.current = setTimeout(() => {
          setStreamingComplete(true)
          timerRef.current = setTimeout(() => {
            setCompletedAt(new Date())
            setPhase('complete')
          }, 500)
        }, 600)
      }
    }, 250)

    return () => {
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current)
    }
  }, [phase])

  // ── Send (idle → thinking → clarifying-goal) ──────────────────────────────

  const handleSend = (value: string) => {
    setUserMessage(value)
    setPhase('thinking')
    timerRef.current = setTimeout(() => {
      setClarificationStep(0)
      setAnsweredClarifications([])
      setCurrentSelected(undefined)
      setPhase('clarifying-goal')
    }, 2500)
  }

  // ── Clarification ─────────────────────────────────────────────────────────

  const advanceClarification = (item: ClarificationSummaryItem) => {
    setAnsweredClarifications((prev) => [...prev, item])
    setCurrentSelected(undefined)

    const nextStep = clarificationStep + 1
    if (nextStep < TOTAL_QUESTIONS) {
      setPhase('thinking')
      timerRef.current = setTimeout(() => {
        setClarificationStep(nextStep)
        setPhase('clarifying-goal')
      }, 1500)
    } else {
      // All done — scan Pinboard.
      setPhase('souvenir')
      timerRef.current = setTimeout(() => setPhase('confirming-pins'), 2500)
    }
  }

  const handleClarificationSend = () => {
    if (!currentSelected) return
    const q   = CLARIFICATION_QUESTIONS[clarificationStep]
    const opt = q.options.find((o) => o.id === currentSelected)
    advanceClarification({ question: q.question, answer: { type: 'text', value: opt?.label ?? '' } })
  }

  const handleClarificationSkip = () => {
    const q = CLARIFICATION_QUESTIONS[clarificationStep]
    advanceClarification({ question: q.question, answer: { type: 'skipped' } })
  }

  const handleClarificationPrev = () => {
    if (clarificationStep <= 0) return
    setAnsweredClarifications((prev) => prev.slice(0, -1))
    setClarificationStep((prev) => prev - 1)
    setCurrentSelected(undefined)
  }

  // ── Pin confirmation → planning ───────────────────────────────────────────

  const enterPlanning = () => {
    setStepStatuses(
      Object.fromEntries(BASE_PLAN_STEPS.map((s) => [s.id, 'pending' as StepStatus])),
    )
    setPhase('planning')
  }

  // ── Plan approval → executing ─────────────────────────────────────────────

  const handleApprove = () => {
    setExecutingIdx(0)
    setStepStatuses(
      Object.fromEntries(BASE_PLAN_STEPS.map((s) => [s.id, 'pending' as StepStatus])),
    )
    setPhase('executing')
  }

  // ── Stop → paused ─────────────────────────────────────────────────────────

  const handleStop = () => {
    const completedSteps = BASE_PLAN_STEPS.filter((s) => stepStatuses[s.id] === 'complete')
    setPausedAfterLabel(completedSteps[completedSteps.length - 1]?.label)
    setPhase('paused')
  }

  // ── PauseCard actions ─────────────────────────────────────────────────────

  const handleContinue = () => setPhase('executing')

  // Change direction: reset plan to start and go back to the planning review.
  const handleChangeDirection = () => {
    setExecutingIdx(0)
    setStepStatuses(
      Object.fromEntries(BASE_PLAN_STEPS.map((s) => [s.id, 'pending' as StepStatus])),
    )
    setPhase('planning')
  }

  // ── NodeFailureCard actions ───────────────────────────────────────────────

  const handleRerunNode = () => {
    if (!failedStepData) return
    const step = BASE_PLAN_STEPS[executingIdx]
    if (!step) return

    // Flag that a critical re-run was attempted (enables the fatal path on s4).
    if (failedStepData.isCritical) criticalRerunAttemptRef.current = true

    setStepStatuses((prev) => ({ ...prev, [step.id]: 'pending' }))
    setFailedStepData(null)
    setPhase('executing')
  }

  const handleSkipNode = () => {
    if (!failedStepData) return
    const step = BASE_PLAN_STEPS[executingIdx]
    if (!step) return

    // Track that s3 was skipped — this enables the critical s4 failure path.
    if (executingIdx === 2) s3SkippedRef.current = true

    setStepStatuses((prev) => ({ ...prev, [step.id]: 'skipped' }))
    setFailedStepData(null)
    setExecutingIdx((i) => i + 1)
    setPhase('executing')
  }

  // ── Cancel (from any interruptible phase) ─────────────────────────────────

  const handleCancel = () => setPhase('cancelled')

  // ── Full reset (cancelled, failed, complete → idle) ───────────────────────

  const handleRestart = () => {
    setPhase('idle')
    setUserMessage('')
    setAnsweredClarifications([])
    setClarificationStep(0)
    setCurrentSelected(undefined)
    setConnectedConnectors(new Set())
    setStepStatuses({})
    setExecutingIdx(0)
    setPausedAfterLabel(undefined)
    setFailedStepData(null)
    setFailedPhaseInfo(null)
    setStreamedContent('')
    setStreamingComplete(false)
    setCompletedAt(null)
    firstFailureHandledRef.current  = false
    s3SkippedRef.current            = false
    criticalRerunAttemptRef.current = false
  }

  // ── Derived counts for LoopCancelledCard ──────────────────────────────────

  const completedStepsCount = BASE_PLAN_STEPS.filter(
    (s) => stepStatuses[s.id] === 'complete',
  ).length

  // ── Derived flags ─────────────────────────────────────────────────────────

  const isClarifyingPhase  = phase === 'clarifying-goal'
  const currentQuestion    = CLARIFICATION_QUESTIONS[clarificationStep]
  const showActivityBlock  =
    phase === 'executing' || phase === 'paused' || phase === 'node-failed'

  // ── Thread content ────────────────────────────────────────────────────────

  const threadContent = userMessage ? (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      gap:           24,
      paddingTop:    40,
      paddingBottom: 20,
    }}>

      {/* ── User prompt ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <MessageBubble role="user" content={userMessage} maxWidth="75%" />
      </div>

      {/* ── Answered clarifications (persists once answered) ── */}
      {answeredClarifications.length > 0 && (
        <ClarificationSummary items={answeredClarifications} />
      )}

      {/* ── Thinking ── */}
      {phase === 'thinking' && <StreamingIndicator phase="thinking" />}

      {/* ── Souvenir: scanning Pinboard ── */}
      {phase === 'souvenir' && <StreamingIndicator phase="souvenir" />}

      {/* ── Confirming pins ── */}
      {phase === 'confirming-pins' && (
        <PinConfirmationCard
          pins={DEMO_PINS}
          onProceed={enterPlanning}
          onSkip={enterPlanning}
        />
      )}

      {/* ── Planning ── */}
      {phase === 'planning' && (
        <PlanCard
          steps={planSteps}
          interpretation={PLAN_INTERPRETATION}
          onApprove={handleApprove}
          onCancel={handleCancel}
        />
      )}

      {/* ── Executing / paused / node-failed: ActivityBlock persists ── */}
      {showActivityBlock && (
        <ActivityBlock steps={planSteps} interpretation={PLAN_INTERPRETATION} />
      )}

      {/* ── Paused ── */}
      {phase === 'paused' && (
        <PauseCard
          pausedAfterStep={pausedAfterLabel}
          onContinue={handleContinue}
          onChangeDirection={handleChangeDirection}
          onCancel={handleCancel}
        />
      )}

      {/* ── Node failed ── */}
      {phase === 'node-failed' && failedStepData && (
        <NodeFailureCard
          step={{ label: failedStepData.label, isCritical: failedStepData.isCritical }}
          errorMessage={failedStepData.error}
          onRerun={handleRerunNode}
          onSkip={!failedStepData.isCritical ? handleSkipNode : undefined}
          onCancel={handleCancel}
        />
      )}

      {/* ── Streaming ── */}
      {phase === 'streaming' && (
        <>
          <StreamingIndicator phase="streaming" />
          <StreamingMessageBubble
            content={streamedContent}
            isComplete={streamingComplete}
          />
        </>
      )}

      {/* ── Complete ── */}
      {phase === 'complete' && (
        <>
          <BrainResultHeader
            summary="Analyzed 847 Intercom tickets · 234 NPS responses · 1,102 app reviews"
          />
          <StreamingMessageBubble content={DEMO_OUTPUT} isComplete />
          <ArtifactCard
            title="Q1 Friction Analysis Report"
            meta="Notion · Ready to save"
            onClick={() => {}}
          />
          <LoopHistoryCard
            steps={planSteps}
            completedAt={completedAt ?? undefined}
          />
        </>
      )}

      {/* ── Cancelled ── */}
      {phase === 'cancelled' && (
        <LoopCancelledCard
          completedSteps={completedStepsCount}
          totalSteps={BASE_PLAN_STEPS.length}
          onStartNew={handleRestart}
        />
      )}

      {/* ── Failed (unrecoverable) ── */}
      {phase === 'failed' && (
        <LoopFailedCard
          failedStep={failedPhaseInfo?.step}
          errorDetail={failedPhaseInfo?.error}
          onTryAgain={handleRestart}
          onRephrase={handleRestart}
        />
      )}

    </div>
  ) : null

  // ── ClarificationCard (replaces ChatInput at bottom) ─────────────────────

  const clarificationProps = isClarifyingPhase
    ? {
        question:       currentQuestion.question,
        options:        currentQuestion.options,
        questionIndex:  clarificationStep + 1,
        totalQuestions: TOTAL_QUESTIONS,
        selected:       currentSelected,
        onSelect:       setCurrentSelected,
        onSkip:         handleClarificationSkip,
        onSend:         handleClarificationSend,
        onPrev:         clarificationStep > 0 ? handleClarificationPrev : undefined,
      }
    : undefined

  // ── Stop chip (shown in ChatInput footer during executing) ────────────────

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

  return (
    <BrainShell
      defaultPhase={phase}
      onSend={handleSend}
      clarificationProps={clarificationProps}
      chatInputProps={stopChip ? { chips: stopChip } : undefined}
      sidebarProps={{
        userName:        displayName || 'Account',
        userEmail:       user?.email ?? '',
        isAuthenticated,
        projects:        sidebarProjects,
        recents:         recentChats,
        onSelectChat:    (id) => router.push(`/chat?id=${id}`),
        onNewChat:       () => router.push('/chat'),
        onChatsClick:    () => router.push('/chats'),
        onPersonasClick: () => router.push('/personas'),
        onProjectsClick: () => router.push('/projects'),
        onSettingsClick: () => router.push('/settings'),
        onHelpClick:     () => router.push('/settings/help'),
        onLogoutClick:   () => { void logout() },
        onBrainClick:    undefined,
      }}
    >
      {threadContent}
    </BrainShell>
  )
}
