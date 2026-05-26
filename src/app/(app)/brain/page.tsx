'use client'

import { Suspense, useMemo, useState, useEffect, useRef, useCallback, type CSSProperties } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
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
import {
  initiateLink,
  pollConnectorUntilActive,
  getConnector,
  updateConnector,
  DEFAULT_API_KEY_FIELD,
  type ApiKeyField,
} from '@/lib/api/connectors'
import { toast } from 'sonner'
import {
  startBrainChat,
  continueBrainChat,
  consumeBrainStream,
  getBrainMessages,
  respondToPrompt,
  stopBrainChat,
  type BackendPlanStep,
  type BackendPlanNode,
  type BrainContextEvent,
  type ContextPersona,
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
import { connectorLogoSrc, connectorDisplayName } from '@/lib/connectorLogos'
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

function mapBackendNode(node: BackendPlanNode): PlanStep {
  // Title only — the node also carries a model_id, which we intentionally
  // do not surface in the plan UI.
  return {
    id:         node.id,
    label:      node.title,
    isCritical: false,
    status:     mapBackendStepStatus(node.status),
  }
}

// ── Edge-derived flow grouping ────────────────────────────────────────────────
// The plan is a DAG: nodes are subtasks, edges {from,to} mean "to waits on
// from". We turn that into the flat, ordered PlanStep[] the UI already speaks:
// each step's dependency depth becomes its level, steps are ordered by level
// (authored order preserved within a level), and independent steps sharing a
// level are tagged with the same parallelGroup so PlanCard/LoopHistoryCard
// render them as "runs at the same time". No graph library required.
function applyFlowGrouping(steps: PlanStep[], edges: unknown): PlanStep[] {
  const edgeList = Array.isArray(edges) ? edges : []
  if (steps.length <= 1 || edgeList.length === 0) return steps

  const ids = new Set(steps.map((s) => s.id))
  const upstream = new Map<string, string[]>()
  for (const e of edgeList) {
    if (!e || typeof e !== 'object') continue
    const { from, to } = e as { from?: unknown; to?: unknown }
    if (typeof from === 'string' && typeof to === 'string' && ids.has(from) && ids.has(to)) {
      upstream.set(to, [...(upstream.get(to) ?? []), from])
    }
  }
  if (upstream.size === 0) return steps // no usable edges → leave as authored

  // Longest-path depth via memoised DFS (DAG). onPath guards against a stray
  // cycle so a malformed plan can't hang the render.
  const level = new Map<string, number>()
  const onPath = new Set<string>()
  const depthOf = (id: string): number => {
    const cached = level.get(id)
    if (cached !== undefined) return cached
    if (onPath.has(id)) return 0
    onPath.add(id)
    const deps = upstream.get(id) ?? []
    const d = deps.length ? 1 + Math.max(...deps.map(depthOf)) : 0
    onPath.delete(id)
    level.set(id, d)
    return d
  }
  steps.forEach((s) => depthOf(s.id))

  const levelCounts = new Map<number, number>()
  steps.forEach((s) => {
    const l = level.get(s.id) ?? 0
    levelCounts.set(l, (levelCounts.get(l) ?? 0) + 1)
  })

  // Sort by level, breaking ties on original index so the order is stable and
  // same-level steps land adjacent (groupSteps only clusters consecutive ones).
  return steps
    .map((s, i) => ({ s, i, l: level.get(s.id) ?? 0 }))
    .sort((a, b) => a.l - b.l || a.i - b.i)
    .map(({ s, l }) => ((levelCounts.get(l) ?? 0) > 1 ? { ...s, parallelGroup: `lvl-${l}` } : s))
}

function mapHistoryPlanSteps(plan: BrainPlanResponse): PlanStep[] {
  // The OpenAPI spec marks plan_json + steps as required, but legacy rows
  // and partially-saved plans can land here with either missing — guard so
  // we don't crash when reopening an existing chat. Newer plans persist a
  // `nodes`/`edges` graph instead of a flat `steps` list; fall back to nodes
  // so node-format plans still render, and derive flow grouping from edges.
  const pj = plan.plan_json
  if (pj?.steps?.length) return applyFlowGrouping(pj.steps.map(mapBackendStep), pj.edges)
  if (pj?.nodes?.length) return applyFlowGrouping(pj.nodes.map(mapBackendNode), pj.edges)
  return []
}

// ── Synthesize a context snapshot from fetched messages ──────────────────────
// The live `context` SSE event only fires during an active turn and is never
// persisted; `GET /brain/{id}/messages` carries no context field. So on chat
// reload we reconstruct what we can from the messages: connector slugs from
// `tool_calls` (list_connector_tools.connector_slug + the prefix of
// run_connector_tool.tool_slug), and the persona used from plan-node
// `persona_id` / `ask_user` answers. Pins/files inputs aren't recoverable —
// they aren't in the fetched data — so those sections stay empty.

interface SynthPersonaSource { id: string; name: string; imageUrl?: string | null; activeVersionId?: string | null }

// Strip the descriptive tail from an ask_user persona option label, e.g.
// `kratos — (GPT-5 mini)` → `kratos`, `Digital Marketing Assistant — expert …` →
// `Digital Marketing Assistant`. Splits on an em/en dash (not a hyphen, so
// "kratos-2" survives) and drops any "(…)" parenthetical.
function cleanPersonaLabel(label: string): string {
  const head = label.split(/\s*[—–]\s*/)[0] ?? label
  return head.replace(/\s*\([^)]*\)\s*/g, '').trim() || label.trim()
}

function synthesizeContextFromMessages(
  messages: BrainMessage[],
  personas: SynthPersonaSource[],
): BrainContextEvent | null {
  const connectorSlugs = new Set<string>()
  // Persona picks in order (latest wins). `label` is the human name pulled from
  // the ask_user option, which survives even if the persona was later deleted.
  const personaPicks: Array<{ id: string; label?: string }> = []

  for (const m of messages) {
    // Plan nodes carry the persona_id (a version id) + (optional) connector_slugs.
    const nodes = m.plan?.plan_json?.nodes ?? []
    for (const n of nodes) {
      const np = (n as unknown as Record<string, unknown>)
      const pid = np.persona_id
      if (typeof pid === 'string' && pid) personaPicks.push({ id: pid })
      const cs = np.connector_slugs
      if (Array.isArray(cs)) for (const s of cs) if (typeof s === 'string') connectorSlugs.add(s.toLowerCase())
    }

    // tool_calls: persisted as { tool, args, output } objects.
    const tcs = (m.tool_calls ?? []) as Array<Record<string, unknown>>
    for (const t of tcs) {
      const tool = typeof t?.tool === 'string' ? t.tool : ''
      const args = (t?.args && typeof t.args === 'object' ? t.args : {}) as Record<string, unknown>

      if (tool === 'list_connector_tools' && typeof args.connector_slug === 'string') {
        connectorSlugs.add(args.connector_slug.toLowerCase())
      }
      if (tool === 'run_connector_tool' && typeof args.tool_slug === 'string') {
        // Tool slugs are uppercase-prefixed by their connector, e.g. SLACK_FIND_USERS.
        const prefix = args.tool_slug.split('_')[0]?.toLowerCase()
        if (prefix) connectorSlugs.add(prefix)
      }
      if (tool === 'ask_user' && typeof t?.output === 'string') {
        try {
          const out = JSON.parse(t.output) as { answers?: Record<string, unknown> }
          const answers = out?.answers
          const questions = Array.isArray(args.questions) ? (args.questions as Array<Record<string, unknown>>) : []
          if (answers && typeof answers === 'object') {
            for (const [k, v] of Object.entries(answers)) {
              // Persona-selection questions are keyed `persona`, `persona_pick2`,
              // etc. Their value is the chosen persona's (version) id; the
              // matching option's label gives us the display name for free.
              if (k.toLowerCase().startsWith('persona') && typeof v === 'string' && v.length >= 8) {
                const q = questions.find((qq) => qq?.id === k)
                const opts = (q && Array.isArray(q.options) ? q.options : []) as Array<Record<string, unknown>>
                const opt = opts.find((o) => o?.value === v)
                const label = typeof opt?.label === 'string' ? cleanPersonaLabel(opt.label) : undefined
                personaPicks.push({ id: v, label })
              }
            }
          }
        } catch { /* ignore malformed tool_call output */ }
      }
    }
  }

  if (connectorSlugs.size === 0 && personaPicks.length === 0) return null

  // Resolve the latest-mentioned persona. Prefer the ask_user label (works even
  // for deleted personas); else match the user's personas list by repo id OR
  // active version id (Brain stores the version id); else a graceful fallback.
  let persona: ContextPersona | null = null
  if (personaPicks.length > 0) {
    const pick = personaPicks[personaPicks.length - 1]
    const p = personas.find((x) => x.id === pick.id || x.activeVersionId === pick.id)
    const resolvedName = pick.label || p?.name
    persona = {
      persona_id: pick.id,
      name:       resolvedName || 'Persona',
      // Only emit a handle when we actually resolved a name — a raw id slice
      // ("@0c72c3e6") is meaningless to the user, so leave it blank otherwise.
      handler:    resolvedName ? resolvedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : '',
      avatar_url: p?.imageUrl ?? undefined,
    }
  }

  return {
    persona,
    pins:  [],
    files: [],
    connectors: Array.from(connectorSlugs).sort().map((slug) => ({
      slug,
      display_name: connectorDisplayName(slug),
      status:       'connected',
    })),
  }
}

// ── Local completed-turn snapshot (built up during the session) ───────────────

interface LocalTurn {
  key:          string
  userInput:    string
  output:       string
  planSteps?:   PlanStep[]
  planSummary?: string
  images?:      ImageEvent[]
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
// hasn't linked. For OAuth connectors, opens a popup and polls until linked.
// For api_key connectors, renders an inline credential form and PATCHes directly.

interface ToolConnectCardProps {
  event:        ToolConnectPromptEvent
  onConnected?: (slug: string) => void
}

function ToolConnectCard({ event, onConnected }: ToolConnectCardProps) {
  const [busy,   setBusy]   = useState(false)
  const [done,   setDone]   = useState(false)
  const [error,  setError]  = useState<string | null>(null)
  const [fields, setFields] = useState<ApiKeyField[] | null>(
    event.api_key_fields && event.api_key_fields.length > 0 ? event.api_key_fields : null,
  )
  const [creds,  setCreds]  = useState<Record<string, string>>({})
  const abortedRef = useRef(false)

  useEffect(() => {
    abortedRef.current = false
    return () => { abortedRef.current = true }
  }, [])

  // For api_key connectors without fields in the SSE payload, fetch from catalog
  useEffect(() => {
    if (event.auth_mode !== 'api_key' || fields !== null) return
    getConnector(event.connector_slug)
      .then((entry) => {
        if (!abortedRef.current) {
          setFields(entry.api_key_fields && entry.api_key_fields.length > 0 ? entry.api_key_fields : [DEFAULT_API_KEY_FIELD])
        }
      })
      .catch(() => {
        if (!abortedRef.current) setFields([DEFAULT_API_KEY_FIELD])
      })
  }, [event.auth_mode, event.connector_slug, fields])

  const handleOAuth = useCallback(async () => {
    if (busy || done) return
    setBusy(true)
    setError(null)
    try {
      const { redirect_url } = await initiateLink(event.connector_slug)
      if (redirect_url) window.open(redirect_url, '_blank', 'noopener')
      await pollConnectorUntilActive(event.connector_slug)
      if (abortedRef.current) return
      setDone(true)
      onConnected?.(event.connector_slug)
      toast.success(`${event.display_name} connected — re-send your message to continue.`)
    } catch (e) {
      if (abortedRef.current) return
      setError(e instanceof Error ? e.message : 'Failed to connect.')
    } finally {
      setBusy(false)
    }
  }, [busy, done, event.connector_slug, event.display_name, onConnected])

  const handleApiKey = useCallback(async () => {
    if (busy || done) return
    setBusy(true)
    setError(null)
    try {
      await updateConnector(event.connector_slug, { credentials: creds })
      if (abortedRef.current) return
      setDone(true)
      onConnected?.(event.connector_slug)
      toast.success(`${event.display_name} connected — re-send your message to continue.`)
    } catch (e) {
      if (abortedRef.current) return
      setError(e instanceof Error ? e.message : 'Failed to save credentials.')
    } finally {
      setBusy(false)
    }
  }, [busy, done, event.connector_slug, event.display_name, creds, onConnected])

  const resolvedFields = fields ?? [DEFAULT_API_KEY_FIELD]
  const allFilled = resolvedFields.filter((f) => f.required).every((f) => (creds[f.name] ?? '').trim())

  const cardStyle: CSSProperties = {
    display:         'flex',
    flexDirection:   'column',
    gap:             8,
    padding:         '14px 16px',
    borderRadius:    12,
    border:          '1px solid var(--neutral-200)',
    backgroundColor: 'var(--neutral-white)',
  }
  const labelStyle: CSSProperties = {
    fontFamily: 'var(--font-body)',
    fontSize:   'var(--font-size-caption)',
    fontWeight: 500,
    color:      'var(--neutral-600)',
  }
  const inputStyle: CSSProperties = {
    padding:         '7px 10px',
    borderRadius:    8,
    border:          '1px solid var(--neutral-300)',
    fontFamily:      'var(--font-body)',
    fontSize:        'var(--font-size-caption)',
    // eslint-disable-next-line react-doctor/no-outline-none -- browser outline suppressed
    outline:         'none',
    width:           '100%',
    boxSizing:       'border-box',
    backgroundColor: 'var(--neutral-white)',
  }
  const btnStyle = (primary: boolean, disabled: boolean): CSSProperties => ({
    padding:         '6px 14px',
    borderRadius:    999,
    border:          primary ? 'none' : '1px solid var(--neutral-200)',
    backgroundColor: primary ? (disabled ? 'var(--neutral-200)' : 'var(--neutral-900)') : 'transparent',
    color:           primary ? (disabled ? 'var(--neutral-500)' : 'var(--neutral-white)') : 'var(--neutral-600)',
    cursor:          disabled ? 'not-allowed' : 'pointer',
    fontFamily:      'var(--font-body)',
    fontSize:        'var(--font-size-caption)',
  })

  const logoSrc = connectorLogoSrc(event.connector_slug) ?? connectorLogoSrc(event.display_name)

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element, react-doctor/nextjs-no-img-element -- local brand asset, variable path prevents next/image static analysis
          <img
            src={logoSrc}
            alt=""
            width={24}
            height={24}
            style={{ objectFit: 'contain', display: 'block', flexShrink: 0 }}
          />
        ) : (
          <span style={{
            width:           24,
            height:          24,
            borderRadius:    6,
            backgroundColor: 'var(--neutral-100)',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            fontFamily:      'var(--font-body)',
            fontSize:        13,
            fontWeight:      600,
            color:           'var(--neutral-600)',
            flexShrink:      0,
            textTransform:   'uppercase',
            userSelect:      'none',
          }}>
            {(event.display_name || event.connector_slug || '?').charAt(0)}
          </span>
        )}
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-body)',
          fontWeight: 'var(--font-weight-medium)',
          color:      'var(--neutral-800)',
        }}>
          Connect {event.display_name} to continue
        </span>
      </div>
      <span style={{
        fontFamily: 'var(--font-body)',
        fontSize:   'var(--font-size-caption)',
        lineHeight: 'var(--line-height-caption)',
        color:      'var(--neutral-500)',
      }}>
        Brain needs <code style={{ fontFamily: 'var(--font-code)' }}>{event.tool_name}</code> from {event.display_name}.
      </span>

      {error && (
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', color: 'var(--color-tag-Red-text, #c0392b)' }}>
          {error}
        </span>
      )}

      {event.auth_mode === 'api_key' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          {resolvedFields.map((field) => (
            <div key={field.name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{field.label}</label>
              <input
                type={field.secret ? 'password' : 'text'}
                autoComplete="off"
                placeholder={field.help ?? field.label}
                value={creds[field.name] ?? ''}
                disabled={busy || done}
                onChange={(e) => setCreds((prev) => ({ ...prev, [field.name]: e.target.value }))}
                style={inputStyle}
              />
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button
              type="button"
              onClick={() => void handleApiKey()}
              disabled={busy || done || !allFilled}
              style={btnStyle(true, busy || done || !allFilled)}
            >
              {done ? 'Connected' : busy ? 'Connecting…' : `Connect ${event.display_name}`}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => void handleOAuth()}
            disabled={busy || done}
            style={btnStyle(true, busy || done)}
          >
            {done ? 'Connected' : busy ? 'Connecting…' : `Connect ${event.display_name}`}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Permission prompt card ────────────────────────────────────────────────────
// Rendered inline when the model wants to run a connector tool whose policy is
// `ask` (connector already linked). The user picks a decision; the page POSTs
// the plain-string response to release the blocked stream.

interface PermissionPromptCardProps {
  prompt: {
    displayName:  string
    toolSlug:     string
    connectorSlug: string
    options:      { value: string; label: string; style?: string }[]
  }
  disabled?: boolean
  onDecide:  (decision: string) => void
}

function PermissionPromptCard({ prompt, disabled = false, onDecide }: PermissionPromptCardProps) {
  const logoSrc = connectorLogoSrc(prompt.connectorSlug) ?? connectorLogoSrc(prompt.displayName)
  return (
    <div style={{
      display:         'flex',
      flexDirection:   'column',
      gap:             10,
      padding:         '14px 16px',
      borderRadius:    12,
      border:          '1px solid var(--neutral-200)',
      backgroundColor: 'var(--neutral-white)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element, react-doctor/nextjs-no-img-element -- local brand asset, variable path prevents next/image static analysis
          <img
            src={logoSrc}
            alt=""
            width={24}
            height={24}
            style={{ objectFit: 'contain', display: 'block', flexShrink: 0 }}
          />
        ) : (
          <span style={{
            width:           24,
            height:          24,
            borderRadius:    6,
            backgroundColor: 'var(--neutral-100)',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            fontFamily:      'var(--font-body)',
            fontSize:        13,
            fontWeight:      600,
            color:           'var(--neutral-600)',
            flexShrink:      0,
            textTransform:   'uppercase',
            userSelect:      'none',
          }}>
            {(prompt.displayName || prompt.connectorSlug || '?').charAt(0)}
          </span>
        )}
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-body)',
          fontWeight: 'var(--font-weight-medium)',
          color:      'var(--neutral-800)',
        }}>
          Allow {prompt.displayName || prompt.connectorSlug} to run this action?
        </span>
      </div>
      {prompt.toolSlug && (
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-caption)',
          lineHeight: 'var(--line-height-caption)',
          color:      'var(--neutral-500)',
        }}>
          Tool: <code style={{ fontFamily: 'var(--font-code)' }}>{prompt.toolSlug}</code>
        </span>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 }}>
        {prompt.options.map((opt) => {
          const danger  = opt.style === 'danger' || opt.value === 'block'
          const primary = opt.style === 'primary' || opt.value === 'allow' || opt.value === 'allow_once'
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => onDecide(opt.value)}
              style={{
                padding:         '6px 14px',
                borderRadius:    999,
                border:          primary ? 'none' : '1px solid var(--neutral-200)',
                backgroundColor: primary ? (disabled ? 'var(--neutral-200)' : 'var(--neutral-900)') : 'transparent',
                color:           danger
                  ? 'var(--color-tag-Red-text, #c0392b)'
                  : primary ? (disabled ? 'var(--neutral-500)' : 'var(--neutral-white)') : 'var(--neutral-600)',
                cursor:          disabled ? 'not-allowed' : 'pointer',
                fontFamily:      'var(--font-body)',
                fontSize:        'var(--font-size-caption)',
              }}
            >
              {opt.label}
            </button>
          )
        })}
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

// ── Turn timeline ─────────────────────────────────────────────────────────────
// Ordered log of everything that streams into the active turn, so the thread
// renders in arrival order (text segment → tool → text → permission → …) rather
// than bucketing all tools at the top and all text at the bottom. Text items
// are extended in place by successive content tokens; a non-text event ends the
// current text segment so the next token opens a fresh one below it. Mutating
// kinds (tool status, progress, permission/connect resolution) keep their own
// live state and are looked up by reference at render time.
type TimelineItem =
  | { kind: 'text';       id: string; text: string }
  | { kind: 'tool';       id: string; toolKey: string }
  | { kind: 'web_search'; id: string; data: WebSearchEvent }
  | { kind: 'file';       id: string; data: GeneratedFileEvent }
  | { kind: 'image';      id: string; url: string }
  | { kind: 'progress';   id: string }
  | { kind: 'permission'; id: string; promptId: string }
  | { kind: 'connect';    id: string; slug: string }

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

// ── Generated-image grid ──────────────────────────────────────────────────────
// Renders images produced inside a turn (live stream or persisted history) as
// actual thumbnails. Each opens full-size in a new tab. `unoptimized` skips the
// Next image loader so presigned S3 URLs render without remote-pattern config.

function MessageImages({ images }: { images: { url: string }[] }) {
  if (images.length === 0) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {images.map((img) => (
        <a
          key={img.url}
          href={img.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display:      'block',
            borderRadius: 12,
            overflow:     'hidden',
            border:       '1px solid var(--neutral-200)',
            maxWidth:     360,
          }}
        >
          <Image
            src={img.url}
            alt="Generated image"
            width={0}
            height={0}
            sizes="100%"
            unoptimized
            style={{ display: 'block', width: '100%', height: 'auto', maxHeight: 360, objectFit: 'cover' }}
          />
        </a>
      ))}
    </div>
  )
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

  // A single question inside a `question_prompt` event (the dedicated
  // clarifying-questions event the Brain `ask_user` tool emits).
  interface QPQuestion {
    id:          string
    question:    string
    type:        string                    // single_choice | multi_choice | text | yes_no
    options:     QuestionCardOption[]       // empty for text kind
    placeholder?: string
  }
  interface ActiveClarification {
    promptId:    string
    source:      'user_prompt' | 'question_prompt'  // which SSE event produced it
    kind:        string                    // 'choice' | 'input' | other (user_prompt)
    question:    string                    // current question text
    description: string                    // optional body
    options:     QuestionCardOption[]      // empty for free-text
    index:       number                    // 1-based, increments per turn
    openEnded:   boolean                   // current question takes free text
    // question_prompt only — step through N questions, then POST once:
    questions?:  QPQuestion[]
    qCursor?:    number                    // index into `questions`
    collected?:  Record<string, unknown>   // answers gathered so far, keyed by question id
  }
  const [activeClarification, setActiveClarification] = useState<ActiveClarification | null>(null)
  // Connector-tool permission ask (event: permission_prompt) — the connector is
  // linked but the tool's policy is `ask`. Rendered inline in the active turn.
  interface ActivePermissionPrompt {
    promptId:       string
    connectorSlug:  string
    displayName:    string
    toolSlug:       string
    options:        { value: string; label: string; style?: string }[]
  }
  const [activePermissionPrompt, setActivePermissionPrompt] = useState<ActivePermissionPrompt | null>(null)
  const [permissionInFlight, setPermissionInFlight] = useState(false)
  const [selectedClarificationOption, setSelectedClarificationOption] = useState<string | undefined>(undefined)
  const [clarificationInFlight, setClarificationInFlight] = useState(false)
  const [answeredClarifications, setAnsweredClarifications] = useState<ClarificationSummaryItem[]>([])
  const clarificationCountRef = useRef(0)
  // Free-text answer captured from QuestionCard's open-ended input. Held in
  // a ref because the QuestionCard reports it only at submit time — we don't
  // need a re-render per keystroke, just the final value when Send fires.
  const clarificationTextRef = useRef('')

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

  // Note: the ContextRail is now driven entirely by the per-turn `context` SSE
  // event (see liveContext), so the old page-load connectors/bootstrap fetches
  // that used to seed it have been removed.

  // ── Per-turn SSE event state ────────────────────────────────────────────────
  // Slots for the named/inline events that the new YAML adds. Cleared at the
  // start of each turn and on chat reset. Rendered between the ActivityBlock
  // and the StreamingMessageBubble in the active turn body.

  // Search/file data now lives directly in the timeline items; only the image
  // list (snapshot) and the latest tool-progress are kept as separate state.
  const [streamImages,       setStreamImages]       = useState<ImageEvent[]>([])
  const [toolProgress,       setToolProgress]       = useState<ToolProgressEvent | null>(null)

  // ── Live turn context (event: context) ────────────────────────────────────────
  // Snapshot of what Brain actually loaded for the current turn (persona, pins,
  // files, connectors). Fired once at the start of each turn; drives the
  // ContextRail. Null until a turn runs → rail stays empty at idle.
  const [liveContext, setLiveContext] = useState<BrainContextEvent | null>(null)
  const [toolConnectPrompt,  setToolConnectPrompt]  = useState<ToolConnectPromptEvent | null>(null)
  const [liveToolCalls,      setLiveToolCalls]      = useState<Record<string, { status: 'streaming' | 'executing' | 'complete'; tool_call: ToolCallPreview }>>({})

  // ── Ordered turn timeline ────────────────────────────────────────────────────
  // The chronological render model for the active turn (see TimelineItem). Reset
  // at the start of every turn. seenToolIdsRef tracks which tool ids already have
  // a timeline row (so status updates don't add duplicates); progressPushedRef
  // ensures a single progress row.
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const seenToolIdsRef  = useRef<Set<string>>(new Set())
  const progressPushedRef = useRef(false)
  const timelineSeqRef  = useRef(0)

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
    clarificationTextRef.current = ''
    setStreamedContent('')
    setStreamingComplete(false)
    setCompletedAt(null)
    setStreamError(null)
    setPausedAfterLabel(undefined)
    setStreamImages([])
    setToolProgress(null)
    setToolConnectPrompt(null)
    setActivePermissionPrompt(null)
    setLiveToolCalls({})
    setTimeline([])
    seenToolIdsRef.current = new Set()
    progressPushedRef.current = false
    pendingPlanIdRef.current = null
    setLiveContext(null)
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
      .then(async (messages) => {
        setHistoryMessages(messages)
        setHistoryLoaded(true)
        // Reconstruct the ContextRail snapshot from what's in the fetched
        // messages (the backend doesn't persist a context payload). Only fetch
        // personas if a turn referenced one; skip the network call otherwise.
        const referencesPersona = messages.some((m) =>
          (m.plan?.plan_json?.nodes ?? []).some((n) => Boolean((n as unknown as Record<string, unknown>).persona_id))
          || (m.tool_calls ?? []).some((t) => {
            const tc = t as Record<string, unknown> | null
            return tc?.tool === 'ask_user'
          })
        )
        const personas = referencesPersona ? await fetchPersonas().catch(() => []) : []
        const synth = synthesizeContextFromMessages(messages, personas)
        if (synth) setLiveContext(synth)
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
        // The event names the DAG nodes `steps` for FE-compat and ships the
        // dependency `edges` alongside — fold both into flow-grouped steps so
        // PlanCard renders parallel branches as "runs at the same time".
        const rawSteps = ((d.steps ?? []) as BackendPlanStep[])
        const steps    = applyFlowGrouping(rawSteps.map(mapBackendStep), d.edges)
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
          source:      'user_prompt',
          kind,
          question:    typeof d.title === 'string' ? d.title : 'Quick question',
          description: typeof d.description === 'string' ? d.description : '',
          options,
          index:       clarificationCountRef.current,
          openEnded:   kind === 'input',
        })
        setSelectedClarificationOption(undefined)
        setClarificationInFlight(false)
        // Wipe any text typed for the previous question so the input opens
        // empty for the new one. (Not relying on QuestionCard's own reset:
        // the card unmounts and remounts on question change via the `key`
        // prop, but the page-side ref persists across that boundary.)
        clarificationTextRef.current = ''
        setPhase('clarifying-goal')
        break
      }

      // Dedicated clarifying-questions event emitted by the Brain `ask_user`
      // tool (kind="questions"). Carries a LIST of questions; we step through
      // them one at a time in the input slot, gather answers keyed by question
      // id, then POST {response:{answers}} once on the final question so the
      // blocked stream resumes. Without this the stream stalls on heartbeats
      // until the 300s prompt_gate timeout.
      case 'question_prompt': {
        const promptId = typeof d.prompt_id === 'string' ? d.prompt_id : ''
        const rawQs    = Array.isArray(d.questions) ? d.questions : []
        if (!promptId || rawQs.length === 0) break

        const questions: QPQuestion[] = rawQs.flatMap((q: unknown) => {
          if (!q || typeof q !== 'object') return []
          const obj = q as Record<string, unknown>
          const id  = typeof obj.id === 'string' ? obj.id : ''
          if (!id) return []
          const optsRaw = Array.isArray(obj.options) ? obj.options : []
          const opts: QuestionCardOption[] = optsRaw.flatMap((o: unknown) => {
            if (!o || typeof o !== 'object') return []
            const oo = o as Record<string, unknown>
            const val = typeof oo.value === 'string' ? oo.value : ''
            return val ? [{ id: val, label: typeof oo.label === 'string' ? oo.label : val }] : []
          })
          const type = typeof obj.type === 'string' ? obj.type : 'text'
          // yes_no has no options in the payload — synthesize the two choices.
          const resolvedOpts = opts.length > 0
            ? opts
            : type === 'yes_no'
              ? [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }]
              : []
          return [{
            id,
            question:    typeof obj.question === 'string' ? obj.question : 'Quick question',
            type,
            options:     resolvedOpts,
            placeholder: typeof obj.placeholder === 'string' ? obj.placeholder : undefined,
          }]
        })
        if (questions.length === 0) break

        const first = questions[0]
        clarificationCountRef.current += 1
        setActiveClarification({
          promptId,
          source:      'question_prompt',
          kind:        first.type,
          question:    first.question,
          // The real question lives in `question`; the prompt `title` is a
          // generic preamble. Leave description empty so the card shows the
          // question (the mapping prefers description when present).
          description: '',
          options:     first.options,
          index:       clarificationCountRef.current,
          openEnded:   first.options.length === 0,
          questions,
          qCursor:     0,
          collected:   {},
        })
        setSelectedClarificationOption(undefined)
        setClarificationInFlight(false)
        clarificationTextRef.current = ''
        setPhase('clarifying-goal')
        break
      }

      // Connector-tool permission ask: the connector is linked but the tool's
      // policy is `ask`. Distinct from tool_connect_prompt (which links an
      // unlinked connector). Resolve by POSTing a plain string decision.
      case 'permission_prompt': {
        const promptId = typeof d.prompt_id === 'string' ? d.prompt_id : ''
        if (!promptId) break
        const optsRaw = Array.isArray(d.options) ? d.options : []
        const opts = optsRaw.flatMap((o: unknown) => {
          if (!o || typeof o !== 'object') return []
          const oo = o as Record<string, unknown>
          const value = typeof oo.value === 'string' ? oo.value : ''
          return value ? [{ value, label: typeof oo.label === 'string' ? oo.label : value, style: typeof oo.style === 'string' ? oo.style : undefined }] : []
        })
        setActivePermissionPrompt({
          promptId,
          connectorSlug: typeof d.connector_slug === 'string' ? d.connector_slug : '',
          displayName:   typeof d.display_name === 'string' ? d.display_name : (typeof d.connector_slug === 'string' ? d.connector_slug : ''),
          toolSlug:      typeof d.tool_slug === 'string' ? d.tool_slug : '',
          options:       opts.length > 0 ? opts : [
            { value: 'allow_once', label: 'Allow once' },
            { value: 'allow',      label: 'Always allow' },
            { value: 'block',      label: 'Block' },
          ],
        })
        setPermissionInFlight(false)
        setTimeline((prev) => [...prev, { kind: 'permission', id: `permission-${++timelineSeqRef.current}`, promptId }])
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
        if (query) {
          setTimeline((prev) => [...prev, { kind: 'web_search', id: `search-${++timelineSeqRef.current}`, data: { query, links } }])
        }
        break
      }

      case 'image': {
        const url    = typeof d.url    === 'string' ? d.url    : ''
        const s3_key = typeof d.s3_key === 'string' ? d.s3_key : ''
        if (url) {
          setStreamImages((prev) => [...prev, { url, s3_key }])
          setTimeline((prev) => [...prev, { kind: 'image', id: `image-${++timelineSeqRef.current}`, url }])
        }
        break
      }

      case 'generated_file': {
        const url       = typeof d.url       === 'string' ? d.url       : ''
        const s3_key    = typeof d.s3_key    === 'string' ? d.s3_key    : ''
        const filename  = typeof d.filename  === 'string' ? d.filename  : ''
        const mime_type = typeof d.mime_type === 'string' ? d.mime_type : ''
        if (url && filename) {
          setTimeline((prev) => [...prev, { kind: 'file', id: `file-${++timelineSeqRef.current}`, data: { url, s3_key, filename, mime_type } }])
        }
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
          // One progress row, placed at first arrival; later updates flow
          // through toolProgress.
          if (!progressPushedRef.current) {
            progressPushedRef.current = true
            setTimeline((prev) => [...prev, { kind: 'progress', id: `progress-${++timelineSeqRef.current}` }])
          }
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
          setTimeline((prev) => [...prev, { kind: 'connect', id: `connect-${++timelineSeqRef.current}`, slug }])
        }
        break
      }

      // Per-turn context snapshot — drives the ContextRail. Fires once at the
      // start of the turn with the persona/pins/files/connectors Brain loaded.
      case 'context': {
        setLiveContext({
          persona:          (d.persona && typeof d.persona === 'object' ? d.persona : null) as BrainContextEvent['persona'],
          user_context:     (d.user_context && typeof d.user_context === 'object' ? d.user_context : null) as BrainContextEvent['user_context'],
          pins:             Array.isArray(d.pins)       ? (d.pins       as BrainContextEvent['pins'])       : [],
          files:            Array.isArray(d.files)      ? (d.files      as BrainContextEvent['files'])      : [],
          connectors:       Array.isArray(d.connectors) ? (d.connectors as BrainContextEvent['connectors']) : [],
          available_models: Array.isArray(d.available_models) ? (d.available_models as unknown[]) : [],
        })
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
      // Append to the timeline: extend the trailing text segment, or open a new
      // one if the previous item was a tool/search/etc. (so text lands below it).
      if (token) {
        setTimeline((prev) => {
          const last = prev[prev.length - 1]
          if (last && last.kind === 'text') {
            const copy = prev.slice()
            copy[copy.length - 1] = { ...last, text: last.text + token }
            return copy
          }
          return [...prev, { kind: 'text', id: `text-${++timelineSeqRef.current}`, text: token }]
        })
      }
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
      // First time we see this tool id → add a row to the timeline at its
      // arrival position. Later status updates flow through liveToolCalls.
      if (!seenToolIdsRef.current.has(id)) {
        seenToolIdsRef.current.add(id)
        setTimeline((prev) => [...prev, { kind: 'tool', id: `tool-${++timelineSeqRef.current}`, toolKey: id }])
      }
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
    currentStreamImages: ImageEvent[],
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
        images:      currentStreamImages.length > 0 ? currentStreamImages : undefined,
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
    setStreamImages([])
    setToolProgress(null)
    setToolConnectPrompt(null)
    setActivePermissionPrompt(null)
    setLiveToolCalls({})
    setTimeline([])
    seenToolIdsRef.current = new Set()
    progressPushedRef.current = false
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
    setActiveClarification(null)
    setSelectedClarificationOption(undefined)
    setClarificationInFlight(false)
    setAnsweredClarifications([])
    clarificationCountRef.current = 0
    clarificationTextRef.current = ''
    setStreamImages([])
    setToolProgress(null)
    setToolConnectPrompt(null)
    setActivePermissionPrompt(null)
    setLiveToolCalls({})
    setTimeline([])
    seenToolIdsRef.current = new Set()
    progressPushedRef.current = false
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
        streamImages,
      )
    }
    void runBrainStream(value, chatId)
  }, [
    phase, chatId, planSteps, userMessage, streamedContent,
    activePlanSummary, completedAt, streamImages, snapshotAndReset, runBrainStream,
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

  // QuestionCard reports typed text via onOpenEndedSubmit at the moment the
  // user clicks Send. We stash it in a ref so handleClarificationSend (which
  // fires synchronously immediately after) can read it without waiting for
  // a re-render. Cleared whenever a clarification finishes one way or the
  // other (submit, skip, close, new turn, new chat).
  const handleClarificationOpenEnded = useCallback((text: string) => {
    clarificationTextRef.current = text
  }, [])

  const handleClarificationSend = useCallback(() => {
    if (!activeClarification || clarificationInFlight) return

    // Typed free text wins over a previously-selected option — the user's
    // most recent action is the intent. Strip whitespace so an opened-but-
    // empty textarea doesn't beat a real selection.
    const typedText  = clarificationTextRef.current.trim()
    const selectedId = selectedClarificationOption

    // ── question_prompt: step through N questions, gather answers keyed by
    // question id, POST {response:{answers}} once on the last one. ──
    if (activeClarification.source === 'question_prompt') {
      const qs     = activeClarification.questions ?? []
      const cursor = activeClarification.qCursor ?? 0
      const cur    = qs[cursor]
      if (!cur) return

      const isText = activeClarification.openEnded
      // Choice → selected option value (required). Text → typed string, or
      // null when blank (the backend accepts null for optional questions).
      const value: unknown = isText ? (typedText || null) : (selectedId ?? null)
      if (!isText && value == null) {
        toast.info('Pick an option before sending.')
        return
      }
      const collected = { ...(activeClarification.collected ?? {}), [cur.id]: value }
      const displayAnswer = isText
        ? (typedText || '(skipped)')
        : (cur.options.find((o) => o.id === selectedId)?.label ?? String(value))

      // More questions remain → advance to the next one without POSTing.
      if (cursor + 1 < qs.length) {
        setAnsweredClarifications((prev) => [...prev, { question: cur.question, answer: displayAnswer }])
        const next = qs[cursor + 1]
        setActiveClarification({
          ...activeClarification,
          kind:        next.type,
          question:    next.question,
          description: '',
          options:     next.options,
          openEnded:   next.options.length === 0,
          qCursor:     cursor + 1,
          collected,
        })
        setSelectedClarificationOption(undefined)
        clarificationTextRef.current = ''
        return
      }

      // Last question → POST all answers and let the stream resume.
      setClarificationInFlight(true)
      void respondToPrompt(activeClarification.promptId, { response: { answers: collected } })
        .then(() => {
          setAnsweredClarifications((prev) => [...prev, { question: cur.question, answer: displayAnswer }])
          setActiveClarification(null)
          setSelectedClarificationOption(undefined)
          clarificationTextRef.current = ''
          // Hand control back to the stream: 'thinking' lets the next content
          // token flip to 'streaming' (clarifying-goal would swallow it).
          setPhase('thinking')
        })
        .catch((e: unknown) => {
          console.error('[Brain] question_prompt respond failed:', e)
          const msg = e instanceof ApiError && e.status === 404
            ? 'This prompt expired — please re-send your message.'
            : 'Failed to submit your answer. Please try again.'
          toast.error(msg)
        })
        .finally(() => setClarificationInFlight(false))
      return
    }

    const value = typedText || selectedId || ''

    if (!value) {
      toast.info('Pick an option or type an answer before sending.')
      return
    }

    const displayAnswer = typedText
      ? typedText
      : (activeClarification.options.find((o) => o.id === selectedId)?.label ?? value)

    setClarificationInFlight(true)
    void respondToPrompt(activeClarification.promptId, {
      response: { decision: typedText ? 'submit' : 'select', value },
    })
      .then(() => {
        setAnsweredClarifications((prev) => [
          ...prev,
          { question: activeClarification.question, answer: displayAnswer },
        ])
        setActiveClarification(null)
        setSelectedClarificationOption(undefined)
        clarificationTextRef.current = ''
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

  // Skip is also the close (X) handler — see ClarificationCard's onClose={onSkip}.
  // Optimistic: dismiss the card immediately so the user gets instant
  // feedback. The POST runs in the background; if it returns 404 (prompt
  // expired) the user has already moved on, so we just log and continue.
  const handleClarificationSkip = useCallback(() => {
    if (!activeClarification) return
    const { promptId, question, source } = activeClarification

    setActiveClarification(null)
    setSelectedClarificationOption(undefined)
    clarificationTextRef.current = ''
    setAnsweredClarifications((prev) => [
      ...prev,
      { question, answer: { type: 'skipped' as const } },
    ])
    // question_prompt blocks the stream until it's resolved — skipping must
    // still POST (empty answers) so the gate releases, then resume.
    if (source === 'question_prompt') setPhase('thinking')

    const body = source === 'question_prompt'
      ? { response: { answers: {} } }
      : { response: { decision: 'skip' } }
    void respondToPrompt(promptId, body)
      .catch((e: unknown) => {
        if (!(e instanceof ApiError && e.status === 404)) {
          console.warn('[Brain] clarification skip failed:', e)
        }
      })
  }, [activeClarification])

  // ── Permission prompt handler (event: permission_prompt) ────────────────────
  // Resolve a connector-tool permission ask by POSTing a plain string decision
  // ("allow_once" | "allow" | "block"). Unblocks the stream like clarifications.
  const handlePermissionDecision = useCallback((decision: string) => {
    if (!activePermissionPrompt || permissionInFlight) return
    const { promptId } = activePermissionPrompt
    setPermissionInFlight(true)
    void respondToPrompt(promptId, { response: decision })
      .then(() => {
        setActivePermissionPrompt(null)
        setPhase('thinking')
      })
      .catch((e: unknown) => {
        console.error('[Brain] permission respond failed:', e)
        const msg = e instanceof ApiError && e.status === 404
          ? 'This prompt expired — please re-send your message.'
          : 'Failed to submit your decision. Please try again.'
        toast.error(msg)
      })
      .finally(() => setPermissionInFlight(false))
  }, [activePermissionPrompt, permissionInFlight])

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
      streamImages,
    )
    setPhase('idle')
  }, [phase, planSteps, userMessage, streamedContent, activePlanSummary, completedAt, streamImages, snapshotAndReset])

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
    setActiveClarification(null)
    setSelectedClarificationOption(undefined)
    setClarificationInFlight(false)
    setAnsweredClarifications([])
    clarificationCountRef.current = 0
    clarificationTextRef.current = ''
    setStreamedContent('')
    setStreamingComplete(false)
    setCompletedAt(null)
    setStreamError(null)
    setPausedAfterLabel(undefined)
    setStreamImages([])
    setToolProgress(null)
    setToolConnectPrompt(null)
    setActivePermissionPrompt(null)
    setLiveToolCalls({})
    setTimeline([])
    seenToolIdsRef.current = new Set()
    progressPushedRef.current = false
    pendingPlanIdRef.current = null
    setHistoryMessages([])
    setLocalTurns([])
  }, [chatIdFromUrl, push])

  // ── Thread: history from server (reload path) ─────────────────────────────────

  const historyElements = historyMessages.map((msg) => {
    const planSteps = msg.plan ? mapHistoryPlanSteps(msg.plan) : []
    const images = (msg.attachments ?? []).filter((a) => a.mime_type?.startsWith('image/'))
    return (
      <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingTop: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <MessageBubble role="user" content={msg.input} maxWidth="75%" />
        </div>
        {planSteps.length > 0 && (
          <LoopHistoryCard
            steps={planSteps}
            summary={msg.plan?.plan_json?.summary}
            completedAt={msg.created_at ? new Date(msg.created_at) : undefined}
          />
        )}
        {images.length > 0 && <MessageImages images={images} />}
        {msg.output && (
          <StreamingMessageBubble content={msg.output} isComplete />
        )}
      </div>
    )
  })

  // ── Thread: locally completed turns (same session) ───────────────────────────

  const localTurnElements = localTurns.map((turn) => (
    <div key={turn.key} style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingTop: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <MessageBubble role="user" content={turn.userInput} maxWidth="75%" />
      </div>
      {turn.planSteps && turn.planSteps.length > 0 && (
        <LoopHistoryCard
          steps={turn.planSteps}
          summary={turn.planSummary}
          completedAt={turn.completedAt}
        />
      )}
      {turn.images && turn.images.length > 0 && <MessageImages images={turn.images} />}
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

  // Render one timeline item in arrival order. Mutating kinds read their live
  // state by reference (tool status from liveToolCalls, the latest progress
  // from toolProgress, the active permission/connect prompt) so a row added
  // earlier still reflects later updates. Each non-text row reuses the same
  // building blocks the fixed layout used (ActivityFeed row, cards), just
  // rendered at its chronological position.
  const renderTimelineItem = (item: TimelineItem, isLast: boolean) => {
    switch (item.kind) {
      case 'text':
        return (
          <StreamingMessageBubble
            key={item.id}
            content={item.text}
            isComplete={!isLast || streamingComplete || phase === 'complete' || phase === 'cancelled' || phase === 'failed'}
          />
        )
      case 'tool': {
        const e = liveToolCalls[item.toolKey]
        return e ? <ActivityFeed key={item.id} items={[{ kind: 'tool', data: e.tool_call, id: item.id, status: e.status }]} /> : null
      }
      case 'web_search':
        return <ActivityFeed key={item.id} items={[{ kind: 'web_search', data: item.data, id: item.id }]} />
      case 'file':
        return <ActivityFeed key={item.id} items={[{ kind: 'file', data: item.data, id: item.id }]} />
      case 'image':
        return <MessageImages key={item.id} images={[{ url: item.url }]} />
      case 'progress':
        return toolProgress ? <ActivityFeed key={item.id} items={[{ kind: 'progress', data: toolProgress, id: item.id }]} /> : null
      case 'permission':
        // Only the row matching the still-open prompt renders the live card;
        // resolved/older permission rows collapse to nothing.
        return activePermissionPrompt?.promptId === item.promptId
          ? <PermissionPromptCard key={item.id} prompt={activePermissionPrompt} disabled={permissionInFlight} onDecide={handlePermissionDecision} />
          : null
      case 'connect':
        return toolConnectPrompt?.connector_slug === item.slug
          ? (
            <ToolConnectCard
              key={item.id}
              event={toolConnectPrompt}
              onConnected={() => setToolConnectPrompt(null)}
            />
          )
          : null
    }
  }

  const activeTurnContent = userMessage ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingTop: 40 }}>

      {/* User message bubble */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <MessageBubble role="user" content={userMessage} maxWidth="75%" />
      </div>

      {/* Answered clarification Q&As — read-only stacked card, placed right
          after the user message exactly like the Full-thread story. */}
      {answeredClarifications.length > 0 && (
        <ClarificationSummary items={answeredClarifications} />
      )}

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

      {/* ActivityBlock — plan-step tracker; persists through executing and paused */}
      {showActivityBlock && (
        <ActivityBlock steps={planSteps} interpretation={activePlanSummary} />
      )}

      {/* Complete header sits above the transcript */}
      {phase === 'complete' && (
        <BrainResultHeader summary={activePlanSummary || 'Analysis complete'} />
      )}

      {/* ── Ordered transcript ──────────────────────────────────────────────
          Text segments, tool calls, web searches, files, images, the connector
          permission/link cards — all rendered in the order they streamed in,
          so chat and tools interleave instead of bucketing. */}
      {timeline.map((item, i) => renderTimelineItem(item, i === timeline.length - 1))}

      {/* Live cursor — thinking before the first token, composing while tokens
          (or tools) are still arriving. */}
      {phase === 'thinking'  && <StreamingIndicator phase="thinking" />}
      {phase === 'streaming' && <StreamingIndicator phase="streaming" />}

      {/* PauseCard */}
      {phase === 'paused' && (
        <PauseCard
          pausedAfterStep={pausedAfterLabel}
          onContinue={handleContinue}
          onChangeDirection={handleChangeDirection}
          onCancel={() => setPhase('cancelled')}
        />
      )}

      {/* Completed plan recap, below the transcript */}
      {phase === 'complete' && planSteps.length > 0 && (
        <LoopHistoryCard steps={planSteps} completedAt={completedAt ?? undefined} />
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
  // The rail reflects ONLY what Brain actually loaded for the turn — the live
  // `context` event. Empty (rail closed) until a turn runs and the event fires;
  // no selected-chip / bootstrap fallback.
  const contextRailData = useMemo<ContextRailData>(() => {
    if (!liveContext) return {}

    const fmtSize = (bytes?: number): string | null => {
      if (!bytes || bytes <= 0) return null
      if (bytes < 1024) return `${bytes} B`
      if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    return {
      persona: liveContext.persona
        ? {
            name:      liveContext.persona.name || liveContext.persona.handler || 'Persona',
            handle:    liveContext.persona.handler || '',
            avatarUrl: liveContext.persona.avatar_url,
          }
        : undefined,
      pins: (liveContext.pins ?? []).map((p) => ({
        id:     p.pin_id,
        title:  p.title,
        source: p.tags?.length ? p.tags.join(' · ') : undefined,
      })),
      files: (liveContext.files ?? []).map((f) => ({
        name: f.name,
        meta: [f.mime_type, fmtSize(f.size)].filter(Boolean).join(' · ') || undefined,
      })),
      connectors: (liveContext.connectors ?? []).map((c) => ({
        name:   c.display_name || c.slug,
        slug:   c.slug,
        status: c.status === 'failed' ? 'failed' : c.status === 'pending' ? 'pending' : 'connected',
      })),
    }
  }, [liveContext])

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
        // The backend's `title` is usually a generic preamble. The actual
        // model-generated question lives in `description`. Prefer the
        // longer body; fall back to the title only when the model didn't
        // send one. FE never invents the question text.
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
        // No questionIndex / totalQuestions on purpose: we don't know how
        // many questions Brain will ask up front. With both omitted the
        // ClarificationCard hides the pagination chip and prev/next arrows
        // entirely, which is the right UX for "one question at a time".
        selected:       selectedClarificationOption,
        // For free-text questions there are no options to pick — surface a
        // hint that the open-ended text input is the answer field. For choice
        // questions we keep QuestionCard's default ("Something else on your mind").
        openEndedLabel: activeClarification.openEnded
                          ? 'Type your answer…'
                          : undefined,
        onSelect:         handleClarificationSelect,
        onOpenEndedSubmit: handleClarificationOpenEnded,
        onSend:           handleClarificationSend,
        onSkip:           handleClarificationSkip,
      } : undefined}
      chatInputProps={{
        isStreaming: brainIsStreaming,
        disabled: brainIsStreaming,
        onStop: handleStop,
        addMenu,
        modelMenu: <ModelMenu />,
        modelName: modelButtonLabel,
        hideModelSelector: true,
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
