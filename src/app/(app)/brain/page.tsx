'use client'

import { Suspense, useMemo, useState, useEffect, useRef, useCallback, type CSSProperties } from 'react'
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
  ClarificationSummary,
  type ClarificationSummaryItem,
} from '@/templates/Brain'
import type { QuestionCardOption } from '@/components/QuestionCard'
import { MessageBubble } from '@/components/MessageBubble'
import { useAuth } from '@/context/auth-context'
import { useModelSelectorContext } from '@/context/model-selector-context'
import { BrainSidebarSections } from './BrainSidebarSections'
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
import { listConnectors, initiateLink, pollConnectorUntilActive, type ConnectorCatalogEntry } from '@/lib/api/connectors'
import { toast } from 'sonner'
import {
  startBrainChat,
  continueBrainChat,
  consumeBrainStream,
  getBrainBootstrap,
  getBrainMessages,
  respondToPrompt,
  stopBrainChat,
  type BackendPlanStep,
  type BrainBootstrap,
  type BrainMessage,
  type BrainPlanResponse,
  type GeneratedFileEvent,
  type ImageEvent,
  type ToolCallPreview,
  type ToolConnectPromptEvent,
  type ToolProgressEvent,
  type WebSearchEvent,
} from '@/lib/api/brain'
import { ApiError } from '@/lib/api/client'
import { linkScheduleToChat, consumePendingPrompt } from '@/lib/scheduleLinks'
import type { ContextRailData } from '@/templates/Brain/ContextRail'

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
  // The OpenAPI spec marks plan_json + steps as required, but legacy rows
  // and partially-saved plans can land here with either missing — guard so
  // we don't crash when reopening an existing chat.
  return (plan.plan_json?.steps ?? []).map(mapBackendStep)
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
  disabled?: boolean
}

function CounterInput({ value, onChange, onSend, onCancel, disabled = false }: CounterInputProps) {
  const canSend = value.trim().length > 0 && !disabled
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

// ── Tool connect prompt card ──────────────────────────────────────────────────
// Rendered inline when the model calls a connector tool for an app the user
// hasn't linked. Clicking "Connect" launches the OAuth/API-key flow and polls
// until the connector reports linked, then prompts the user to re-send.

interface ToolConnectCardProps {
  event:        ToolConnectPromptEvent
  onConnected?: (slug: string) => void
}

function ToolConnectCard({ event, onConnected }: ToolConnectCardProps) {
  const [busy,  setBusy]  = useState(false)
  const [done,  setDone]  = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConnect = useCallback(async () => {
    if (busy || done) return
    setBusy(true)
    setError(null)
    try {
      const { redirect_url } = await initiateLink(event.connector_slug)
      if (redirect_url) {
        window.open(redirect_url, '_blank', 'noopener')
      }
      await pollConnectorUntilActive(event.connector_slug)
      setDone(true)
      onConnected?.(event.connector_slug)
      toast.success(`${event.display_name} connected — re-send your message to continue.`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to connect.'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }, [busy, done, event.connector_slug, event.display_name, onConnected])

  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      gap:            8,
      padding:        '14px 16px',
      borderRadius:   12,
      border:         '1px solid var(--neutral-200)',
      backgroundColor:'var(--neutral-white)',
    }}>
      <span style={{
        fontFamily: 'var(--font-body)',
        fontSize:   'var(--font-size-body)',
        fontWeight: 'var(--font-weight-medium)',
        color:      'var(--neutral-800)',
      }}>
        Connect {event.display_name} to continue
      </span>
      <span style={{
        fontFamily: 'var(--font-body)',
        fontSize:   'var(--font-size-caption)',
        lineHeight: 'var(--line-height-caption)',
        color:      'var(--neutral-500)',
      }}>
        Brain needs <code style={{ fontFamily: 'var(--font-code)' }}>{event.tool_name}</code> from {event.display_name} ({event.auth_mode}).
      </span>
      {error && (
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', color: 'var(--color-tag-Red-text, #c0392b)' }}>
          {error}
        </span>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={handleConnect}
          disabled={busy || done}
          style={{
            padding:        '6px 14px',
            borderRadius:   999,
            border:         'none',
            backgroundColor: done ? 'var(--neutral-200)' : 'var(--neutral-900)',
            color:           done ? 'var(--neutral-500)' : 'var(--neutral-white)',
            cursor:          busy || done ? 'not-allowed' : 'pointer',
            fontFamily:      'var(--font-body)',
            fontSize:        'var(--font-size-caption)',
          }}
        >
          {done ? 'Connected' : busy ? 'Connecting…' : `Connect ${event.display_name}`}
        </button>
      </div>
    </div>
  )
}

// ── Tool / search / file activity feed ────────────────────────────────────────
// Lightweight chronological feed of mid-stream side effects: web searches,
// generated images/files, live tool calls, tool progress updates. Each item
// is its own row; the whole feed sits between the activity block and the
// streaming bubble in the active turn.

type ActivityFeedItem =
  | { kind: 'web_search'; data: WebSearchEvent;     id: string }
  | { kind: 'image';      data: ImageEvent;         id: string }
  | { kind: 'file';       data: GeneratedFileEvent; id: string }
  | { kind: 'tool';       data: ToolCallPreview;    id: string; status: 'streaming' | 'executing' | 'complete' }
  | { kind: 'progress';   data: ToolProgressEvent;  id: string }

function ActivityFeed({ items }: { items: ActivityFeedItem[] }) {
  if (items.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item) => {
        switch (item.kind) {
          case 'web_search': return (
            <div key={item.id} style={feedRowStyle}>
              <span style={feedLabelStyle}>Searched</span>
              <span style={feedValueStyle}>“{item.data.query}”</span>
              {item.data.links?.length > 0 && (
                <span style={feedMetaStyle}>{item.data.links.length} result{item.data.links.length === 1 ? '' : 's'}</span>
              )}
            </div>
          )
          case 'image': return (
            <div key={item.id} style={feedRowStyle}>
              <span style={feedLabelStyle}>Image</span>
              <a href={item.data.url} target="_blank" rel="noopener noreferrer" style={feedLinkStyle}>{item.data.s3_key}</a>
            </div>
          )
          case 'file': return (
            <div key={item.id} style={feedRowStyle}>
              <span style={feedLabelStyle}>File</span>
              <a href={item.data.url} target="_blank" rel="noopener noreferrer" style={feedLinkStyle}>{item.data.filename}</a>
              <span style={feedMetaStyle}>{item.data.mime_type}</span>
            </div>
          )
          case 'tool': return (
            <div key={item.id} style={feedRowStyle}>
              <span style={feedLabelStyle}>Tool</span>
              <span style={feedValueStyle}>{item.data.name ?? 'unknown'}</span>
              <span style={feedMetaStyle}>{item.status}</span>
            </div>
          )
          case 'progress': return (
            <div key={item.id} style={feedRowStyle}>
              <span style={feedLabelStyle}>{item.data.tool}</span>
              <span style={feedValueStyle}>{item.data.label ?? item.data.message ?? item.data.status}</span>
              {item.data.percent != null && <span style={feedMetaStyle}>{Math.round(item.data.percent)}%</span>}
            </div>
          )
        }
      })}
    </div>
  )
}

const feedRowStyle: CSSProperties = {
  display:         'flex',
  alignItems:      'center',
  gap:             8,
  padding:         '6px 12px',
  borderRadius:    8,
  border:          '1px solid var(--neutral-100)',
  backgroundColor: 'var(--neutral-50)',
}
const feedLabelStyle: CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize:   'var(--font-size-caption)',
  fontWeight: 'var(--font-weight-medium)',
  color:      'var(--neutral-500)',
  flexShrink: 0,
}
const feedValueStyle: CSSProperties = {
  flex:         '1 1 0',
  minWidth:     0,
  fontFamily:   'var(--font-body)',
  fontSize:     'var(--font-size-caption)',
  color:        'var(--neutral-800)',
  overflow:     'hidden',
  textOverflow: 'ellipsis',
  whiteSpace:   'nowrap',
}
const feedMetaStyle: CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize:   'var(--font-size-caption)',
  color:      'var(--neutral-400)',
  flexShrink: 0,
}
const feedLinkStyle: CSSProperties = {
  ...feedValueStyle,
  color:          'var(--neutral-700)',
  textDecoration: 'underline',
}

// ── Inner page ────────────────────────────────────────────────────────────────

// eslint-disable-next-line react-doctor/prefer-useReducer -- multiple useState calls; useReducer refactor deferred
function BrainPageInner() {
  const searchParams = useSearchParams()
  const { push, replace } = useRouter()
  const { user, logout, isAuthenticated } = useAuth()
  const chatIdFromUrl = searchParams.get('id')

  const displayName = user
    ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.name || ''
    : ''

  // ── Sidebar collapse state — shared via localStorage with all other pages ─────

  const sidebarCollapsedRef = useRef(
    typeof window !== 'undefined' ? localStorage.getItem('sidebar_collapsed') === 'true' : false
  )
  const handleSidebarCollapse = useCallback(() => {
    sidebarCollapsedRef.current = !sidebarCollapsedRef.current
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebar_collapsed', String(sidebarCollapsedRef.current))
    }
  }, [])

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

  // ── Plan-decision in-flight guard ────────────────────────────────────────────
  // Disables Approve/Counter/Cancel between the click and the server's reply,
  // so a double-click can't fire two POSTs against the same prompt_id (the
  // second is invalidated server-side and returns 404).
  const [actionInFlight, setActionInFlight] = useState(false)

  // ── Clarification flow ───────────────────────────────────────────────────────
  // Brain may ask one or more disambiguation questions before planning when
  // the prompt is too vague. The backend emits `user_prompt` events with
  // kinds 'choice' (predefined options) or 'input' (free text). We render
  // them via ClarificationCard in the input slot, accumulate answered Q&As
  // for the ClarificationSummary in the thread, and POST the response back
  // to /chats/prompts/{prompt_id} so the stream can resume.

  interface ActiveClarification {
    promptId:    string
    kind:        string                    // 'choice' | 'input' | other
    question:    string                    // user_prompt.title
    description: string                    // user_prompt.description (optional body)
    options:     QuestionCardOption[]      // empty for 'input' kind
    index:       number                    // 1-based, increments per turn
  }
  const [activeClarification, setActiveClarification] = useState<ActiveClarification | null>(null)
  const [selectedClarificationOption, setSelectedClarificationOption] = useState<string | undefined>(undefined)
  const [clarificationInFlight, setClarificationInFlight] = useState(false)
  const [answeredClarifications, setAnsweredClarifications] = useState<ClarificationSummaryItem[]>([])
  const clarificationCountRef = useRef(0)

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
  // Set to true when we navigate to a newly-created chat — prevents the thread-change
  // reset effect from wiping the live stream that just started.
  const skipNextResetRef = useRef(false)
  // Same guard for the history-load effect: a freshly-created chat already has its
  // user input in local state, so re-fetching messages would render it twice.
  const skipNextHistoryLoadRef = useRef(false)

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

  // ── Connectors (for ContextRail) ─────────────────────────────────────────────
  // Cached at the page level so the rail can render the moment it slides in
  // (during the planning → complete phase window). Refreshed once per mount.
  const [connectors, setConnectors] = useState<ConnectorCatalogEntry[]>([])
  useEffect(() => {
    let cancelled = false
    void listConnectors()
      .then((list) => { if (!cancelled) setConnectors(list) })
      .catch((e) => { console.warn('[Brain] listConnectors failed:', e) })
    return () => { cancelled = true }
  }, [])

  // ── Bootstrap (GET /brain/bootstrap) ────────────────────────────────────────
  // Page-load context: which persona is in scope, attached pins/files,
  // linked connectors with tool counts, available models, current project.
  // Seeds the ContextRail before the first turn and gives the page a default
  // persona/connector set when the user hasn't picked any.

  const [bootstrap, setBootstrap] = useState<BrainBootstrap | null>(null)
  useEffect(() => {
    let cancelled = false
    void getBrainBootstrap()
      .then((b) => { if (!cancelled) setBootstrap(b) })
      .catch((e) => { console.warn('[Brain] getBrainBootstrap failed:', e) })
    return () => { cancelled = true }
  }, [])

  // ── Per-turn SSE event state ────────────────────────────────────────────────
  // Slots for the named/inline events that the new YAML adds. Cleared at the
  // start of each turn and on chat reset. Rendered between the ActivityBlock
  // and the StreamingMessageBubble in the active turn body.

  const [webSearches,        setWebSearches]        = useState<WebSearchEvent[]>([])
  const [streamImages,       setStreamImages]       = useState<ImageEvent[]>([])
  const [streamFiles,        setStreamFiles]        = useState<GeneratedFileEvent[]>([])
  const [toolProgress,       setToolProgress]       = useState<ToolProgressEvent | null>(null)
  const [toolConnectPrompt,  setToolConnectPrompt]  = useState<ToolConnectPromptEvent | null>(null)
  const [liveToolCalls,      setLiveToolCalls]      = useState<Record<string, { status: 'streaming' | 'executing' | 'complete'; tool_call: ToolCallPreview }>>({})

  // ── Plan-approval correlation ───────────────────────────────────────────────
  // plan_proposed → user_prompt(kind='choice') is the plan approval gate.
  // We stash plan_id on the ref so the next 'choice' prompt can be routed
  // to the plan-approval flow rather than the clarification flow. Cleared
  // once consumed or when the plan is resolved (approved/countered/cancelled).
  const pendingPlanIdRef = useRef<string | null>(null)

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

  // ── Sync chatId + full state reset when navigating between brain threads ──────
  // eslint-disable-next-line react-doctor/no-cascading-set-state -- React 18 batches; intentional full reset
  useEffect(() => {
    if (skipNextResetRef.current) {
      skipNextResetRef.current = false
      return
    }
    abortRef.current?.abort()
    setChatId(chatIdFromUrl)
    setPhase('idle')
    setUserMessage('')
    setActivePlanSteps([])
    setActivePlanSummary('')
    setPromptId('')
    setStepStatuses({})
    setShowCounterInput(false)
    setCounterText('')
    setActionInFlight(false)
    setActiveClarification(null)
    setSelectedClarificationOption(undefined)
    setClarificationInFlight(false)
    setAnsweredClarifications([])
    clarificationCountRef.current = 0
    setStreamedContent('')
    setStreamingComplete(false)
    setCompletedAt(null)
    setStreamError(null)
    setPausedAfterLabel(undefined)
    setWebSearches([])
    setStreamImages([])
    setStreamFiles([])
    setToolProgress(null)
    setToolConnectPrompt(null)
    setLiveToolCalls({})
    pendingPlanIdRef.current = null
    setHistoryMessages([])
    setLocalTurns([])
    setHistoryLoaded(!chatIdFromUrl)
  }, [chatIdFromUrl])

  // ── Load history on mount (when chat_id is in URL) ───────────────────────────

  useEffect(() => {
    if (!chatIdFromUrl) return
    if (skipNextHistoryLoadRef.current) {
      skipNextHistoryLoadRef.current = false
      setHistoryLoaded(true)
      return
    }

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
        const planId   = typeof d.plan_id === 'string' ? d.plan_id : null
        pendingPlanIdRef.current = planId
        setActivePlanSteps(steps)
        setActivePlanSummary((d.summary as string) ?? '')
        setStepStatuses(Object.fromEntries(steps.map((s) => [s.id, 'pending' as StepStatus])))
        setShowCounterInput(false)
        setCounterText('')
        setPhase('planning')
        break
      }

      case 'user_prompt': {
        const kind     = typeof d.kind === 'string' ? d.kind : ''
        const promptId = typeof d.prompt_id === 'string' ? d.prompt_id : ''
        if (!promptId) break

        // Parse options up front — we need the values to detect plan-approval
        // prompts and we reuse the parsed list for the clarification path.
        const optionsRaw = Array.isArray(d.options) ? d.options : []
        const options: QuestionCardOption[] = optionsRaw.flatMap((o: unknown) => {
          if (!o || typeof o !== 'object') return []
          const obj = o as Record<string, unknown>
          const id    = typeof obj.value === 'string' ? obj.value : ''
          const label = typeof obj.label === 'string' ? obj.label : id
          return id ? [{ id, label }] : []
        })
        const optionValues = options.map((o) => o.id)

        // Plan-approval gate. Once plan_proposed has fired, the very next
        // user_prompt is the approval gate — protocol-guaranteed, regardless
        // of `kind` or option shape. We also accept several backend-side
        // variations as a belt-and-braces fallback:
        //   • Legacy `kind: 'plan'` (pre-new-yaml)
        //   • Explicit plan_id in metadata
        //   • Option values containing the literal word "approve" (covers
        //     'approve', 'approve_plan', 'approveplan', etc.)
        //   • Option labels containing "approve plan" (case-insensitive) for
        //     backends that put the marker in label rather than value
        // The cardinal rule: a plan-approval prompt must NEVER land in the
        // clarification flow — its target UI is PlanCard's approve/counter/
        // cancel buttons, not the ClarificationCard.
        const metaPlanId = typeof (d.metadata as Record<string, unknown> | undefined)?.plan_id === 'string'
          ? (d.metadata as Record<string, string>).plan_id
          : null
        const optionLabelsLower = options.map((o) => o.label.toLowerCase())
        const optionValuesLower = optionValues.map((v) => v.toLowerCase())
        const optionMentionsApprove =
          optionValuesLower.some((v) => v.includes('approve')) ||
          optionLabelsLower.some((l) => l.includes('approve plan') || l === 'approve')
        const isPlanApproval =
          kind === 'plan' ||
          pendingPlanIdRef.current != null ||
          metaPlanId != null ||
          optionMentionsApprove
        if (isPlanApproval) {
          pendingPlanIdRef.current = null
          setPromptId(promptId)
          // Make sure we don't leave a stale clarification on screen from a
          // previous prompt — the plan-approval gate replaces it.
          setActiveClarification(null)
          setSelectedClarificationOption(undefined)
          // Snap into the planning phase so PlanCard re-renders even if
          // we'd transitioned away (e.g. to clarifying-goal during a mid-
          // plan question). showPlanCard already guards on activePlanSteps
          // so an empty-plan edge case won't render anything wrong.
          setPhase('planning')
          break
        }

        // Anything else is a vague-prompt clarification: 'choice' (predefined
        // options), 'input' (free text), 'confirm', or 'permission'. Surface
        // it via ClarificationCard. permission/confirm prompts arrive without
        // options; we pass them through with empty options so the input slot
        // renders.

        clarificationCountRef.current += 1
        setActiveClarification({
          promptId,
          kind,
          question:    typeof d.title === 'string' ? d.title : 'Quick question',
          description: typeof d.description === 'string' ? d.description : '',
          options,
          index:       clarificationCountRef.current,
        })
        setSelectedClarificationOption(undefined)
        setClarificationInFlight(false)
        setPhase('clarifying-goal')
        break
      }

      case 'plan_approved': {
        pendingPlanIdRef.current = null
        setPhase('executing')
        break
      }

      case 'plan_countered': {
        // Opus is revising; wait for the next plan_proposed
        pendingPlanIdRef.current = null
        setPhase('thinking')
        break
      }

      case 'plan_cancelled': {
        pendingPlanIdRef.current = null
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

      case 'title': {
        const title = typeof d.title === 'string' ? d.title : ''
        if (title && typeof document !== 'undefined') {
          document.title = `${title} — Brain`
        }
        break
      }

      case 'web_search': {
        const query = typeof d.query === 'string' ? d.query : ''
        const links = Array.isArray(d.links) ? d.links : []
        if (query) setWebSearches((prev) => [...prev, { query, links }])
        break
      }

      case 'image': {
        const url    = typeof d.url    === 'string' ? d.url    : ''
        const s3_key = typeof d.s3_key === 'string' ? d.s3_key : ''
        if (url) setStreamImages((prev) => [...prev, { url, s3_key }])
        break
      }

      case 'generated_file': {
        const url       = typeof d.url       === 'string' ? d.url       : ''
        const s3_key    = typeof d.s3_key    === 'string' ? d.s3_key    : ''
        const filename  = typeof d.filename  === 'string' ? d.filename  : ''
        const mime_type = typeof d.mime_type === 'string' ? d.mime_type : ''
        if (url && filename) setStreamFiles((prev) => [...prev, { url, s3_key, filename, mime_type }])
        break
      }

      case 'tool_progress': {
        const tool     = typeof d.tool     === 'string' ? d.tool     : ''
        const status   = typeof d.status   === 'string' ? d.status   : ''
        const filename = typeof d.filename === 'string' ? d.filename : ''
        if (tool) {
          setToolProgress({
            tool,
            status,
            filename,
            label:           (d.label           ?? null) as string | null,
            step:            (d.step            ?? null) as string | null,
            message:         (d.message         ?? null) as string | null,
            code_preview:    (d.code_preview    ?? null) as string | null,
            elapsed_seconds: (d.elapsed_seconds ?? null) as number | null,
            percent:         (d.percent         ?? null) as number | null,
            detail:          (d.detail          ?? null) as string | null,
          })
        }
        break
      }

      case 'tool_connect_prompt': {
        const slug         = typeof d.connector_slug === 'string' ? d.connector_slug : ''
        const display_name = typeof d.display_name   === 'string' ? d.display_name   : slug
        const auth_mode    = typeof d.auth_mode      === 'string' ? d.auth_mode      : 'oauth2'
        const tool_name    = typeof d.tool_name      === 'string' ? d.tool_name      : ''
        const request_id   = typeof d.request_id     === 'string' ? d.request_id     : ''
        if (slug) {
          setToolConnectPrompt({
            connector_slug: slug,
            display_name,
            auth_mode,
            tool_name,
            request_id,
          })
        }
        break
      }

      default:
        break
    }
  }, [])

  // ── SSE inline-event handler ──────────────────────────────────────────────────

  const handleInlineEvent = useCallback((data: unknown) => {
    const d = data as Record<string, unknown>
    const t = d.type

    // Guard against late tokens leaking into a finished turn — only flip
    // phase out of in-flight states. 'executing' is preserved because that's
    // when the ActivityBlock should keep rendering plan steps; the phase
    // flips to 'streaming' only on actual visible content.
    if (t === 'content') {
      const token = (d.content as string) ?? ''
      setStreamedContent((prev) => prev + token)
      setPhase((prev) =>
        prev === 'executing' || prev === 'thinking' || prev === 'planning'
          ? 'streaming'
          : prev,
      )
      return
    }

    // Extended-thinking and legacy reasoning deltas. The model can spend
    // tens of seconds emitting these before the first content token, so we
    // must move off 'thinking' once they start — otherwise the user sees a
    // frozen loading state even though tokens are flowing. We don't render
    // the reasoning text yet (separate UI), but the phase transition alone
    // is enough to surface progress and stop the spinner.
    if (t === 'reasoning_body' || t === 'reasoning_heading' || t === 'reasoning') {
      setPhase((prev) => (prev === 'thinking' || prev === 'planning' ? 'streaming' : prev))
      return
    }

    if (t === 'error') {
      const errStr = typeof d.error === 'string' && d.error.length > 0
        ? d.error
        : 'The model returned a stream error.'
      console.error('[Brain] inline error event:', errStr)
      setStreamError(errStr)
      setPhase('failed')
      return
    }

    // Tool execution lifecycle (inline; arrives interleaved with content).
    // The activity feed renders one row per tool_call id, updating status
    // as the model progresses streaming → executing → complete.
    if (t === 'tool_calls_streaming' || t === 'tool_executing' || t === 'tool_complete') {
      const tc = d.tool_call as ToolCallPreview | null | undefined
      if (!tc) return
      const id = tc.id ?? tc.name ?? `tool-${Date.now()}`
      const status: 'streaming' | 'executing' | 'complete' =
        t === 'tool_calls_streaming' ? 'streaming'
      : t === 'tool_executing'        ? 'executing'
      :                                 'complete'
      setLiveToolCalls((prev) => ({ ...prev, [id]: { status, tool_call: tc } }))
      return
    }

    // End of agentic round. The visible answer (if any) has already been
    // assembled from content tokens; we don't reset anything here because
    // message_saved drives the transition to 'complete'. finish_reason of
    // length/incomplete/content_filter signals a truncated response.
    if (t === 'done') {
      const finish = typeof d.finish_reason === 'string' ? d.finish_reason : null
      if (finish === 'length' || finish === 'incomplete' || finish === 'content_filter') {
        console.warn('[Brain] response truncated:', finish)
      }
      return
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
    setWebSearches([])
    setStreamImages([])
    setStreamFiles([])
    setToolProgress(null)
    setToolConnectPrompt(null)
    setLiveToolCalls({})
    pendingPlanIdRef.current = null
  }, [])

  // ── Stream runner ─────────────────────────────────────────────────────────────

  const runBrainStream = useCallback(async (
    input:            string,
    existingChatId:   string | null,
    fromScheduleId?:  string,
  ) => {
    if (completeTimerRef.current) {
      clearTimeout(completeTimerRef.current)
      completeTimerRef.current = null
    }

    // Abort any prior in-flight stream before starting a new turn. Without
    // this, a previously-running consumer can keep pushing events into the
    // new turn's state (e.g., late `content` tokens after the user retries).
    abortRef.current?.abort()

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
    setActionInFlight(false)
    setWebSearches([])
    setStreamImages([])
    setStreamFiles([])
    setToolProgress(null)
    setToolConnectPrompt(null)
    setLiveToolCalls({})
    pendingPlanIdRef.current = null

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
          skipNextResetRef.current = true
          skipNextHistoryLoadRef.current = true
          setChatId(resolvedChatId)
          if (fromScheduleId) linkScheduleToChat(fromScheduleId, resolvedChatId)
          replace(`/brain?id=${resolvedChatId}`, { scroll: false })
        } else {
          // Backend forgot to set X-Chat-Id (e.g., a misconfigured proxy
          // stripping the header). The stream will still play, but the chat
          // is unrecoverable on refresh — warn the user.
          console.warn('[Brain] /brain/create returned no X-Chat-Id header — chat is orphaned')
          toast.warning('Chat started but cannot be saved to the URL. Refreshing will lose it.')
        }
      } else {
        response = await continueBrainChat(resolvedChatId, input, {}, controller.signal)
      }

      await consumeBrainStream(response, {
        onNamed:  handleNamedEvent,
        onInline: handleInlineEvent,
        onClose:  () => {},
        onError:  (e) => {
          // User-initiated stop arrives as AbortError — the Stop handler
          // already transitioned phase to 'paused', so don't override.
          if (e.name === 'AbortError') return
          console.error('[Brain] stream error:', e)
          setStreamError(e.message || 'Connection lost. Please try again.')
          setPhase('failed')
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

  // ── Auto-fire from schedule create ────────────────────────────────────────────
  // The Schedules page hands off newly-created schedules via ?fromSchedule=<id>
  // with the prompt stashed in sessionStorage. We start the chat once, write the
  // resulting chatId back into the link store, and never look at this id again.
  const handledScheduleIdRef = useRef<string | null>(null)
  useEffect(() => {
    const sid = searchParams.get('fromSchedule')
    if (!sid || handledScheduleIdRef.current === sid) return
    handledScheduleIdRef.current = sid
    const prompt = consumePendingPrompt(sid)
    if (!prompt) return
    void runBrainStream(prompt, null, sid)
  }, [searchParams, runBrainStream])

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

  // Pending prompts are tied to the live SSE stream — if the stream dropped,
  // POST /chats/prompts/{id} returns 404 "No pending prompt with that id".
  // Surface that as a user-visible failure instead of swallowing it.
  const explainPromptError = (e: unknown, verb: string): string => {
    if (e instanceof ApiError && e.status === 404) {
      return `Couldn't ${verb} this plan — the connection was lost while waiting. Please re-send your message.`
    }
    return `Couldn't ${verb} the plan. Please try again.`
  }

  const handleApprove = useCallback(() => {
    if (!promptId || actionInFlight) return
    setActionInFlight(true)
    void respondToPrompt(promptId, { response: { decision: 'approve' } })
      .catch((e: unknown) => {
        console.error('[Brain] approve failed:', e)
        setStreamError(explainPromptError(e, 'approve'))
        setPhase('failed')
      })
      .finally(() => setActionInFlight(false))
  }, [promptId, actionInFlight])

  const handleCounter = useCallback(() => {
    if (!promptId || actionInFlight) return
    setShowCounterInput(true)
  }, [promptId, actionInFlight])

  const handleCounterSend = useCallback(() => {
    if (!promptId || actionInFlight || !counterText.trim()) return
    setActionInFlight(true)
    void respondToPrompt(promptId, {
      response: { decision: 'counter', counter_text: counterText.trim() },
    })
      .catch((e: unknown) => {
        console.error('[Brain] counter failed:', e)
        setStreamError(explainPromptError(e, 'counter'))
        setPhase('failed')
      })
      .finally(() => setActionInFlight(false))
    setShowCounterInput(false)
    setCounterText('')
  }, [promptId, actionInFlight, counterText])

  const handlePlanCancel = useCallback(() => {
    if (actionInFlight) return
    // Cancel is "fire and forget": flip the UI immediately so the user sees
    // their intent acknowledged, regardless of whether the backend is still
    // listening. If the prompt is gone, the stream will end on its own; if
    // it's alive, the backend will emit plan_cancelled and wrap up.
    if (promptId) {
      setActionInFlight(true)
      void respondToPrompt(promptId, { response: { decision: 'cancel' } })
        .catch((e: unknown) => {
          // 404 here is expected if the stream already died — don't surface.
          if (!(e instanceof ApiError && e.status === 404)) {
            console.warn('[Brain] cancel respond failed:', e)
          }
        })
        .finally(() => setActionInFlight(false))
    }
    setPhase('cancelled')
  }, [promptId, actionInFlight])

  // ── Clarification prompt handlers ───────────────────────────────────────────
  // user_prompt events that aren't plan-approval (kinds 'choice' / 'input' /
  // 'confirm' / 'permission') arrive in activeClarification. ClarificationCard
  // renders in the input slot; these handlers POST the response and clear
  // the clarification so the stream resumes.

  const handleClarificationSelect = useCallback((id: string) => {
    setSelectedClarificationOption(id)
  }, [])

  const handleClarificationSend = useCallback(() => {
    if (!activeClarification || clarificationInFlight) return
    const value = selectedClarificationOption
    if (!value && activeClarification.kind !== 'input') return
    setClarificationInFlight(true)
    void respondToPrompt(activeClarification.promptId, {
      response: { decision: 'select', value: value ?? '' },
    })
      .then(() => {
        setAnsweredClarifications((prev) => [
          ...prev,
          {
            question: activeClarification.question,
            answer:   activeClarification.options.find((o) => o.id === value)?.label ?? value ?? '',
          },
        ])
        setActiveClarification(null)
        setSelectedClarificationOption(undefined)
        // Phase will be updated by the next SSE event (plan_proposed, content,
        // user_prompt, etc.). If the prior plan is still in scope we leave
        // phase='clarifying-goal' until the backend transitions us.
      })
      .catch((e: unknown) => {
        console.error('[Brain] clarification respond failed:', e)
        const msg = e instanceof ApiError && e.status === 404
          ? 'This prompt expired — please re-send your message.'
          : 'Failed to submit your answer. Please try again.'
        toast.error(msg)
      })
      .finally(() => setClarificationInFlight(false))
  }, [activeClarification, selectedClarificationOption, clarificationInFlight])

  const handleClarificationSkip = useCallback(() => {
    if (!activeClarification || clarificationInFlight) return
    setClarificationInFlight(true)
    void respondToPrompt(activeClarification.promptId, {
      response: { decision: 'skip' },
    })
      .then(() => {
        setAnsweredClarifications((prev) => [
          ...prev,
          {
            question: activeClarification.question,
            answer:   { type: 'skipped' as const },
          },
        ])
        setActiveClarification(null)
        setSelectedClarificationOption(undefined)
      })
      .catch((e: unknown) => {
        if (!(e instanceof ApiError && e.status === 404)) {
          console.warn('[Brain] clarification skip failed:', e)
        }
      })
      .finally(() => setClarificationInFlight(false))
  }, [activeClarification, clarificationInFlight])

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

  // ── New chat ─────────────────────────────────────────────────────────────────
  // Used by both the sidebar's "Brain" button and the "+ New chat" entry.
  // When we're on /brain?id=xxx, push('/brain') drops the chat id and the
  // thread-change effect wipes state. When we're already on /brain with no
  // id, the URL doesn't change so that effect never fires — wipe state
  // imperatively for cases like an orphaned chat (no X-Chat-Id) or stale
  // local turns after a hot reload.

  const handleNewChat = useCallback(() => {
    abortRef.current?.abort()
    if (chatIdFromUrl) {
      push('/brain')
      return
    }
    setChatId(null)
    setPhase('idle')
    setUserMessage('')
    setActivePlanSteps([])
    setActivePlanSummary('')
    setPromptId('')
    setStepStatuses({})
    setShowCounterInput(false)
    setCounterText('')
    setActionInFlight(false)
    setStreamedContent('')
    setStreamingComplete(false)
    setCompletedAt(null)
    setStreamError(null)
    setPausedAfterLabel(undefined)
    setWebSearches([])
    setStreamImages([])
    setStreamFiles([])
    setToolProgress(null)
    setToolConnectPrompt(null)
    setLiveToolCalls({})
    pendingPlanIdRef.current = null
    setHistoryMessages([])
    setLocalTurns([])
  }, [chatIdFromUrl, push])

  // ── Thread: history from server (reload path) ─────────────────────────────────

  const historyElements = historyMessages.map((msg) => (
    <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingTop: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <MessageBubble role="user" content={msg.input} maxWidth="75%" />
      </div>
      {msg.plan && (msg.plan.plan_json?.steps?.length ?? 0) > 0 && (
        <LoopHistoryCard
          steps={mapHistoryPlanSteps(msg.plan)}
          completedAt={msg.created_at ? new Date(msg.created_at) : undefined}
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

  // Phases that may interleave a clarification/permission prompt without
  // implying the plan has been retracted. While we're in one of these, keep
  // the PlanCard visible so an out-of-band prompt can't wipe the active turn.
  const showPlanCard      = (phase === 'planning' || phase === 'clarifying-goal') && activePlanSteps.length > 0
  const showActivityBlock = phase === 'executing' || phase === 'paused'

  // Build the side-effect feed (web searches, images, files, live tools,
  // tool progress). Items are appended in arrival order; tool calls are
  // keyed by id so successive streaming/executing/complete updates collapse
  // into a single row that flips status in place.
  const activityFeedItems = useMemo<ActivityFeedItem[]>(() => {
    const items: ActivityFeedItem[] = []
    webSearches.forEach((w, i)  => items.push({ kind: 'web_search', data: w, id: `search-${i}` }))
    streamImages.forEach((im, i) => items.push({ kind: 'image',     data: im, id: `image-${i}` }))
    streamFiles.forEach((f, i)  => items.push({ kind: 'file',      data: f, id: `file-${i}` }))
    Object.entries(liveToolCalls).forEach(([id, entry]) =>
      items.push({ kind: 'tool', data: entry.tool_call, id: `tool-${id}`, status: entry.status }),
    )
    if (toolProgress) {
      items.push({ kind: 'progress', data: toolProgress, id: `progress-${toolProgress.tool}-${toolProgress.filename}` })
    }
    return items
  }, [webSearches, streamImages, streamFiles, liveToolCalls, toolProgress])

  const activeTurnContent = userMessage ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingTop: 40 }}>

      {/* User message bubble */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <MessageBubble role="user" content={userMessage} maxWidth="75%" />
      </div>

      {/* Thinking */}
      {phase === 'thinking' && <StreamingIndicator phase="thinking" />}

      {/* Plan card + optional counter input */}
      {showPlanCard && (
        <>
          <PlanCard
            steps={planSteps}
            interpretation={activePlanSummary}
            onApprove={handleApprove}
            onCounter={handleCounter}
            onCancel={handlePlanCancel}
            actionsDisabled={!promptId || actionInFlight}
          />
          {showCounterInput && (
            <CounterInput
              value={counterText}
              onChange={setCounterText}
              onSend={handleCounterSend}
              onCancel={() => { setShowCounterInput(false); setCounterText('') }}
              disabled={!promptId || actionInFlight}
            />
          )}
        </>
      )}

      {/* ActivityBlock — persists through executing and paused */}
      {showActivityBlock && (
        <ActivityBlock steps={planSteps} interpretation={activePlanSummary} />
      )}

      {/* Connector-link CTA — surfaced mid-stream when the model called a
          tool for an app the user hasn't linked. User clicks Connect → OAuth
          flow → polls until linked → re-send their message. */}
      {toolConnectPrompt && (
        <ToolConnectCard
          event={toolConnectPrompt}
          onConnected={(slug) => {
            setToolConnectPrompt(null)
            // Refresh connector status so the ContextRail reflects the new link.
            void listConnectors()
              .then((list) => setConnectors(list))
              .catch(() => {})
            void slug
          }}
        />
      )}

      {/* Side-effect feed: web searches, images, files, live tool calls,
          tool progress. Order is creation-time; tool calls collapse by id. */}
      <ActivityFeed items={activityFeedItems} />

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

  // ── ContextRail data ─────────────────────────────────────────────────────────
  // The right rail surfaces three things active for this conversation:
  //   1. Persona — whichever persona the user attached via the chip menu
  //   2. In context — pin folders attached as context (each folder bundles
  //      files indexed from a connector, hence the "Connector Files" framing)
  //   3. Connectors — every connector the user has linked, dotted green
  //
  // Only linked connectors are shown. The rail visually supports a 'failed'
  // state (red dot) — that hook is reserved for a future signal (e.g. an
  // SSE `tool_connect_prompt` event flagging a degraded connector mid-stream),
  // since the catalog endpoint itself only reports linked/not-linked.

  // The rail prefers user-set values (selectedPersona / selectedFolders) and
  // falls back to bootstrap-supplied defaults so the rail isn't empty before
  // the first turn. Bootstrap pins appear when no folders are attached;
  // bootstrap connectors merge with /connectors so we get tool_count for free.
  const contextRailData = useMemo<ContextRailData>(() => {
    const bootstrapConnectorBySlug = new Map(
      (bootstrap?.connectors ?? []).map((c) => [c.slug, c]),
    )
    const mergedConnectors = connectors
      .filter((c) => c.linked)
      .map((c) => {
        const b = bootstrapConnectorBySlug.get(c.slug)
        const status: 'connected' | 'failed' | 'pending' =
          b?.status === 'failed'  ? 'failed'
        : b?.status === 'pending' ? 'pending'
        :                           'connected'
        return { name: c.display_name, status }
      })

    const fallbackPersona = !selectedPersona && bootstrap?.persona
      ? {
          name:      bootstrap.persona.name,
          handle:    bootstrap.persona.handler,
          avatarUrl: undefined,
        }
      : undefined

    const fallbackPins = selectedFolders.length === 0
      ? (bootstrap?.pins ?? []).map((p) => ({
          id:     p.pin_id,
          title:  p.title,
          source: p.tags?.length ? p.tags.join(' · ') : undefined,
        }))
      : []

    return {
      persona: selectedPersona
        ? {
            name:      selectedPersona.name,
            handle:    selectedPersona.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
            avatarUrl: selectedPersona.imageUrl ?? undefined,
          }
        : fallbackPersona,
      pins: selectedFolders.length > 0
        ? selectedFolders.map((f) => ({
            id:     f.id,
            title:  f.name,
            source: `${f.pin_count} pin${f.pin_count === 1 ? '' : 's'}`,
          }))
        : fallbackPins,
      connectors: mergedConnectors,
    }
  }, [selectedPersona, selectedFolders, connectors, bootstrap])

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
      contextRailData={contextRailData}
      clarificationProps={activeClarification ? {
        // The backend's `title` is a generic preamble ("A few details to
        // get this right"). The actual model-generated question lives in
        // `description`. Prefer description; fall back to title only when
        // the model didn't send a body. FE never invents text.
        question:       activeClarification.description?.trim()
                          ? activeClarification.description
                          : activeClarification.question,
        options:        activeClarification.options.length > 0
                          ? activeClarification.options
                          // permission/confirm prompts arrive with empty options;
                          // synthesize sensible defaults so the card has something
                          // to render. The backend treats the value as the user's
                          // decision.
                          : activeClarification.kind === 'permission'
                            ? [{ id: 'approve', label: 'Approve' }, { id: 'deny', label: 'Deny' }]
                            : activeClarification.kind === 'confirm'
                              ? [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }]
                              : [],
        questionIndex:  activeClarification.index,
        selected:       selectedClarificationOption,
        onSelect:       handleClarificationSelect,
        onSend:         handleClarificationSend,
        onSkip:         handleClarificationSkip,
      } : undefined}
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
        userName:           displayName || 'Account',
        userEmail:          user?.email ?? '',
        isAuthenticated,
        defaultBodySection: 'workflow',
        defaultCollapsed:   sidebarCollapsedRef.current,
        onCollapse:         handleSidebarCollapse,
        recentItems: (
          <BrainSidebarSections
            activeChatId={chatId}
            isSchedulesPage={false}
            onThreadClick={(id) => { replace(`/brain?id=${id}`) }}
          />
        ),
        onNewChat:       handleNewChat,
        onChatsClick:    () => { toast.info("Opening Chat Board"); push('/chats') },
        onPersonasClick: () => { toast.info("Opening Personas"); push('/personas') },
        onProjectsClick: () => { toast.info("Opening Projects"); push('/projects') },
        onSettingsClick: () => push('/settings'),
        onHelpClick:     () => push('/settings/help'),
        onLogoutClick:   () => { void logout() },
        onBrainClick:    handleNewChat,
      }}
    >
      {chatIdFromUrl || hasContent ? (
        <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 20 }}>
          {historyLoaded && historyElements}
          {historyLoaded && localTurnElements}
          {historyLoaded && activeTurnContent}
        </div>
      ) : null}
    </BrainShell>
    </>
  )
}
