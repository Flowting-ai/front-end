'use client'

import { Suspense, useMemo, useState, useEffect, useRef, useCallback, type CSSProperties } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { springs } from '@/lib/springs'
import { useSearchParams, useRouter } from 'next/navigation'
import { useSearch } from '@/context/search-context'
import Image from 'next/image'
import {
  BrainShell,
  StreamingIndicator,
  BrainNarration,
  PlanCard,
  ActivityBlock,
  PauseCard,
  StreamingMessageBubble,
  LoopHistoryCard,
  BrainResultHeader,
  LoopCancelledCard,
  LoopFailedCard,
  ClarificationSummary,
  ArtifactCard,
  type ClarificationSummaryItem,
} from '@/templates/Brain'
import type { QuestionCardOption } from '@/components/QuestionCard'
import { MessageBubble } from '@/components/MessageBubble'
import { useAuth } from '@/context/auth-context'
import { useOrg } from '@/context/org-context'
import { useCreditStatus, CREDITS_EXHAUSTED_EVENT } from '@/hooks/use-credit-status'
import { useModelSelectorContext } from '@/context/model-selector-context'
import { AccountMenu } from '@/components/AccountMenu'
import { BrainSidebarSections } from './BrainSidebarSections'
import type { Phase, PlanStep, StepStatus } from '@/templates/Brain/lib/phase'
import { ChatAddMenu, USE_STYLE_OPTIONS, type SelectedPersonaInfo } from '@/components/chat/AddMenu'
import { ModelMenu, useModelButtonLabel } from '@/components/chat/ModelMenu'
import { AttachmentManager, type PendingAttachment } from '@/components/chat/AttachmentManager'
import { Button } from '@/components/Button'
import { Dropdown } from '@/components/Dropdown'
import { Chip } from '@/components/Chip'
import { FolderOneIcon, GlobalSearchIcon, QuillWriteTwoIcon, ImageDownloadTwoIcon } from '@strange-huge/icons'
import { useFileUpload } from '@/hooks/use-file-upload'
import { fetchPersonas, getVersion } from '@/lib/api/personas'
import type { PinFolder } from '@/lib/api/pins'
import {
  initiateLink,
  pollConnectorUntilActive,
  getConnector,
  updateConnector,
  oauthNeedsInitFields,
  DEFAULT_API_KEY_FIELD,
  type ApiKeyField,
} from '@/lib/api/connectors'
import { toast } from 'sonner'
import {
  startBrainChat,
  continueBrainChat,
  consumeBrainStream,
  getBrainMessages,
  subscribeBrainRun,
  approveBrainPlan,
  counterBrainPlan,
  cancelBrainPlan,
  respondToPrompt,
  stopBrainChat,
  stopBrainRun,
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
import { isExtractable, extractText, stripDocumentBlocks } from '@/lib/brain-file-extract'
import { linkScheduleToChat, consumePendingPrompt, remapScheduleLink } from '@/lib/scheduleLinks'
import { listTasks } from '@/lib/api/tasks'
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

/**
 * Converts a raw tool slug to a human-readable display name.
 * Handles both SCREAMING_SNAKE_CASE connector slugs (GMAIL_SEND_EMAIL)
 * and lowercase snake_case tool names (gmail_send_email).
 *   GMAIL_SEND_EMAIL → Gmail: Send Email
 *   run_connector_tool → run connector tool
 */
function formatToolSlug(slug: string): string {
  if (!slug) return 'Tool'
  // SCREAMING_SNAKE → treat first segment as service, rest as action
  if (/^[A-Z][A-Z0-9_]+$/.test(slug)) {
    const parts = slug.split('_')
    const service = parts[0].charAt(0) + parts[0].slice(1).toLowerCase()
    const action  = parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ')
    return action ? `${service}: ${action}` : service
  }
  // lowercase_snake → space-separated
  return slug.replace(/_/g, ' ')
}

function mapBackendStepStatus(status?: string): StepStatus {
  switch (status) {
    case 'running':   return 'executing'
    case 'completed': return 'complete'
    case 'failed':    return 'failed'
    case 'skipped':   return 'skipped'
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
      name:       resolvedName || 'Agent',
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

// ── Generated-file display helpers ───────────────────────────────────────────

function mimeLabel(mime: string): string {
  if (mime.includes('pdf'))                                           return 'PDF Document'
  if (mime.includes('word') || mime.includes('docx'))                return 'Word Document'
  if (mime.includes('excel') || mime.includes('spreadsheet') || mime.includes('xlsx')) return 'Spreadsheet'
  if (mime.includes('powerpoint') || mime.includes('presentation') || mime.includes('pptx')) return 'Presentation'
  if (mime.includes('text/plain'))                                    return 'Text File'
  if (mime.includes('markdown'))                                      return 'Markdown'
  if (mime.includes('csv'))                                           return 'CSV'
  if (mime.includes('json'))                                          return 'JSON'
  if (mime.includes('html'))                                          return 'HTML'
  if (mime.includes('image/'))                                        return 'Image'
  return 'File'
}

// Extract a display filename from an S3 key (last path segment).
function filenameFromS3Key(key: string): string {
  const segment = key.split('/').pop()
  return segment && segment.length > 0 ? segment : 'Generated file'
}

// ── User attachment metadata (file info kept after upload for display) ────────

interface UserAttachment {
  file_name: string
  file_type: string
  file_size: number
}

// isExtractable / extractText are imported from @/lib/brain-file-extract.

function AttachmentChips({ attachments }: { attachments: UserAttachment[] }) {
  if (!attachments.length) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'flex-end' }}>
      {attachments.map((att, i) => {
        const ext = att.file_name.split('.').pop()?.toUpperCase() ?? 'FILE'
        const isImage = att.file_type.startsWith('image/')
        return (
          <div
            key={i}
            style={{
              display:         'inline-flex',
              alignItems:      'center',
              gap:             '5px',
              padding:         '4px 8px',
              borderRadius:    '8px',
              backgroundColor: 'rgba(59,54,50,0.07)',
              border:          '1px solid rgba(59,54,50,0.10)',
              maxWidth:        '220px',
            }}
          >
            <svg
              width="12" height="12" viewBox="0 0 24 24"
              fill="none" stroke="var(--neutral-500)" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round"
              style={{ flexShrink: 0 }}
            >
              {isImage ? (
                <>
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </>
              ) : (
                <>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </>
              )}
            </svg>
            <span
              style={{
                fontFamily:   'var(--font-body)',
                fontSize:     '12px',
                fontWeight:   500,
                color:        'var(--neutral-700)',
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                whiteSpace:   'nowrap',
              }}
            >
              {att.file_name}
            </span>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--neutral-400)', flexShrink: 0 }}>
              {ext}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Local completed-turn snapshot (built up during the session) ───────────────

interface LocalTurn {
  key:             string
  userInput:       string
  output:          string
  planSteps?:      PlanStep[]
  planSummary?:    string
  images?:         ImageEvent[]
  generatedFiles?: GeneratedFileEvent[]
  completedAt?:    Date
  cancelled:       boolean
  attachments?:    UserAttachment[]
}

// ── Counter input UI ──────────────────────────────────────────────────────────

interface CounterInputProps {
  value:    string
  onChange: (v: string) => void
  onSend:   () => void
  onCancel: () => void
  disabled?: boolean
}

// ── Motion: standard KDS mount preset ─────────────────────────────────────────
// The may-day Brain design rises every card/row in with the same gesture:
// fade + 8px lift + 4px deblur, on a springs.moderate spring. `page.tsx` is the
// integration layer that owns this "consumer-driven" motion (the template
// components animate their own internals; the thread cadence lives here).
// Uses LazyMotion's `m` — the root MotionProvider loads `domMax` features.
const MOUNT_INITIAL = { opacity: 0, y: 8, filter: 'blur(4px)' } as const
const MOUNT_ANIMATE = { opacity: 1, y: 0, filter: 'blur(0px)' } as const

/** Wraps a thread element so it rises into place when it mounts. */
function Rise({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode
  delay?: number
  style?: CSSProperties
}) {
  return (
    <m.div
      initial={MOUNT_INITIAL}
      animate={MOUNT_ANIMATE}
      transition={delay ? { ...springs.moderate, delay } : springs.moderate}
      style={style}
    >
      {children}
    </m.div>
  )
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

  const handleOAuth = useCallback(async (initData?: Record<string, string>) => {
    if (busy || done) return
    setBusy(true)
    setError(null)
    try {
      // initData carries per-tenant OAuth credentials (Shopify client_id/secret);
      // undefined for plain OAuth.
      const { redirect_url } = await initiateLink(event.connector_slug, initData)
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
  // Per-tenant OAuth (Shopify BYOA) declares required init fields; render the
  // same credential form as api_key, but submit via the OAuth path (posts
  // init_data, then opens the hosted connect popup).
  const showCredentialForm = event.auth_mode === 'api_key' || oauthNeedsInitFields(event)

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
    outline:         'none',
    width:           '100%',
    boxSizing:       'border-box',
    backgroundColor: 'var(--neutral-white)',
  }

  const logoSrc = connectorLogoSrc(event.connector_slug) ?? connectorLogoSrc(event.display_name)

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- local brand asset, variable path prevents next/image static analysis
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

      {showCredentialForm ? (
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
            <Button
              size="sm"
              variant="default"
              loading={busy}
              disabled={done || !allFilled}
              onClick={() => void (event.auth_mode === 'api_key' ? handleApiKey() : handleOAuth(creds))}
            >
              {done ? 'Connected' : `Connect ${event.display_name}`}
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            size="sm"
            variant="default"
            loading={busy}
            disabled={done}
            onClick={() => void handleOAuth()}
          >
            {done ? 'Connected' : `Connect ${event.display_name}`}
          </Button>
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
  const displayName = prompt.displayName || prompt.connectorSlug || '?'
  return (
    <div style={{
      display:         'flex',
      flexDirection:   'column',
      gap:             12,
      padding:         '16px',
      borderRadius:    16,
      border:          '1px solid var(--neutral-200)',
      backgroundColor: 'var(--color-surface-glass)',
      boxShadow:       'var(--shadow-card-default)',
    }}>
      {/* Header: connector logo + title + tool slug */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- local brand asset, variable path prevents next/image static analysis
          <img
            src={logoSrc}
            alt=""
            width={32}
            height={32}
            style={{ objectFit: 'contain', display: 'block', flexShrink: 0, borderRadius: 8, marginTop: 1 }}
          />
        ) : (
          <span style={{
            width:           32,
            height:          32,
            borderRadius:    8,
            backgroundColor: 'var(--neutral-100)',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            fontFamily:      'var(--font-body)',
            fontSize:        14,
            fontWeight:      600,
            color:           'var(--neutral-600)',
            flexShrink:      0,
            textTransform:   'uppercase',
            userSelect:      'none',
            marginTop:       1,
          }}>
            {displayName.charAt(0)}
          </span>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: '1 0 0', minWidth: 0 }}>
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-body)',
            fontWeight: 'var(--font-weight-medium)',
            lineHeight: 'var(--line-height-body)',
            color:      'var(--neutral-800)',
          }}>
            Allow {displayName} to run this action?
          </span>
          {prompt.toolSlug && (
            <span style={{
              fontFamily:   'var(--font-body)',
              fontSize:     'var(--font-size-caption)',
              lineHeight:   'var(--line-height-caption)',
              color:        'var(--neutral-500)',
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}>
              <code style={{ fontFamily: 'var(--font-code)', fontSize: 'inherit' }}>{prompt.toolSlug}</code>
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 }}>
        {prompt.options.map((opt) => {
          const isPrimary = opt.style === 'primary' || opt.value === 'allow' || opt.value === 'allow_once'
          const isDanger  = opt.style === 'danger'
          const variant = isDanger ? 'danger' : isPrimary ? 'default' : 'secondary'
          return (
            <Button
              key={opt.value}
              size="sm"
              variant={variant}
              disabled={disabled}
              onClick={() => onDecide(opt.value)}
            >
              {opt.label}
            </Button>
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
  | { kind: 'tool';       data: ToolCallPreview;    id: string; status: 'streaming' | 'executing' | 'complete' | 'failed' }
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
              <span style={{
                ...feedMetaStyle,
                ...(item.status === 'failed' ? { color: 'var(--red-500, #DC3545)' } : {}),
              }}>
                {item.status === 'failed' ? 'failed' : item.status === 'complete' ? 'done' : item.status}
              </span>
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
// actual thumbnails with a hover download button. `unoptimized` skips the Next
// image loader so presigned S3 URLs render without remote-pattern config.

/** Best-effort filename from the image URL path; falls back to image-N.png. */
function deriveImageName(url: string, index: number): string {
  try {
    const last = new URL(url).pathname.split('/').pop()
    if (last && /\.(png|jpe?g|webp|gif)$/i.test(last)) return last
  } catch { /* not a parseable URL — use fallback */ }
  return `image-${index + 1}.png`
}

function BrainGeneratedImage({ url, index }: { url: string; index: number }) {
  const [hovered, setHovered] = useState(false)
  const filename = deriveImageName(url, index)
  // /api/download streams the image server-side with Content-Disposition:
  // attachment, so the browser always saves it (a direct link would just open
  // the raw image in a blank-looking tab, and a client fetch fails S3 CORS).
  const downloadHref = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position:     'relative',
        borderRadius: 12,
        overflow:     'hidden',
        border:       '1px solid var(--neutral-200)',
        maxWidth:     360,
      }}
    >
      <Image
        src={url}
        alt="Generated image"
        width={0}
        height={0}
        sizes="100%"
        unoptimized
        style={{ display: 'block', width: '100%', height: 'auto', maxHeight: 360, objectFit: 'cover' }}
      />
      <a
        href={downloadHref}
        download={filename}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Download image"
        title="Download image"
        style={{
          position:       'absolute',
          top:            8,
          right:          8,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          width:          28,
          height:         28,
          borderRadius:   8,
          background:     'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(4px)',
          color:          '#fff',
          textDecoration: 'none',
          opacity:        hovered ? 1 : 0,
          transition:     'opacity 0.15s',
        }}
      >
        <ImageDownloadTwoIcon size={16} />
      </a>
    </div>
  )
}

function MessageImages({ images }: { images: { url: string }[] }) {
  if (images.length === 0) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {images.map((img, i) => (
        <BrainGeneratedImage key={img.url} url={img.url} index={i} />
      ))}
    </div>
  )
}

// ── Inner page ────────────────────────────────────────────────────────────────

function BrainPageInner() {
  const searchParams = useSearchParams()
  const { push, replace } = useRouter()
  const { user, logout, isAuthenticated } = useAuth()
  const { orgId, org, currentUserRole } = useOrg()
  // Individual credit/topup status — hard send-gate when exhausted.
  const creditStatus = useCreditStatus()
  const chatIdFromUrl = searchParams.get('id')

  const displayName = user
    ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.name || ''
    : ''

  const planLabel = orgId
    ? `Teams | ${org?.name ?? 'Teams'}`
    : user?.planType
      ? user.planType.charAt(0).toUpperCase() + user.planType.slice(1)
      : undefined

  const orgBadgeSublabel = orgId && currentUserRole
    ? currentUserRole.charAt(0).toUpperCase() + currentUserRole.slice(1)
    : undefined

  // ── Sidebar collapse state — shared via localStorage with all other pages ─────

  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    typeof window !== 'undefined' ? localStorage.getItem('sidebar_collapsed') === 'true' : false,
  )
  const handleSidebarCollapse = useCallback(() => {
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed
      if (typeof window !== 'undefined') {
        localStorage.setItem('sidebar_collapsed', String(next))
      }
      return next
    })
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
  const [activePlanId, setActivePlanId]           = useState<string | null>(null)
  const [pendingRemapId, setPendingRemapId]       = useState<string | null>(null)
  const [stepStatuses, setStepStatuses]           = useState<Record<string, StepStatus>>({})
  const [streamedContent, setStreamedContent]     = useState('')
  // Extended-thinking / reasoning prose, accumulated per turn and surfaced via
  // BrainNarration. Headings open a section; bodies append. `reasoningActive`
  // drives the live cursor and is cleared once visible content starts.
  const [reasoningText, setReasoningText]         = useState('')
  const [reasoningActive, setReasoningActive]     = useState(false)
  const [streamingComplete, setStreamingComplete] = useState(false)
  const [completedAt, setCompletedAt]             = useState<Date | null>(null)
  const [streamError, setStreamError]             = useState<string | null>(null)

  // ── Counter flow ─────────────────────────────────────────────────────────────

  const [showCounterInput, setShowCounterInput] = useState(false)
  const [counterText, setCounterText]           = useState('')

  // Global search — provided by SearchProvider in (app)/layout.tsx
  const { searchOpen, openSearch } = useSearch()

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
  const activeRunAbortRef = useRef<AbortController | null>(null)
  const activeRunSeqRef   = useRef(0)
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const turnCounterRef   = useRef(0)
  // Set to true when we navigate to a newly-created chat — prevents the thread-change
  // reset effect from wiping the live stream that just started.
  const skipNextResetRef = useRef(false)
  // Same guard for the history-load effect: a freshly-created chat already has its
  // user input in local state, so re-fetching messages would render it twice.
  const skipNextHistoryLoadRef = useRef(false)

  // ── Add-menu feature state ────────────────────────────────────────────────

  const { models, selectModel } = useModelSelectorContext()
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
  // Guard: fetch personas at most once per page load — stale list is fine for chip selection.
  const chipPersonasFetchedRef = useRef(false)
  const [brainAttachments,     setBrainAttachments]     = useState<PendingAttachment[]>([])
  const [userAttachments,      setUserAttachments]      = useState<UserAttachment[]>([])

  // ── Persist file attachment metadata to localStorage for reload recovery ───────
  // BrainMessage from the server carries no input-file info, so we stash the
  // attachment metadata client-side keyed by chatId + message text.

  useEffect(() => {
    if (phase !== 'complete' || !userAttachments.length || !chatId || !userMessage) return
    try {
      const key = `brain_input_files_${chatId}`
      const existing: { userInput: string; attachments: UserAttachment[] }[] =
        JSON.parse(localStorage.getItem(key) ?? '[]')
      if (existing.some(e => e.userInput === userMessage)) return
      localStorage.setItem(key, JSON.stringify([...existing, { userInput: userMessage, attachments: userAttachments }]))
    } catch { /* localStorage unavailable (private mode, quota) */ }
  }, [phase, userAttachments, chatId, userMessage])

  const storedHistoryAttachments = useMemo<Record<string, UserAttachment[]>>(() => {
    if (!chatId) return {}
    try {
      const key = `brain_input_files_${chatId}`
      const stored: { userInput: string; attachments: UserAttachment[] }[] =
        JSON.parse(localStorage.getItem(key) ?? '[]')
      return Object.fromEntries(stored.map(s => [s.userInput, s.attachments]))
    } catch {
      return {}
    }
  }, [chatId])

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
  const [streamFiles,        setStreamFiles]        = useState<GeneratedFileEvent[]>([])
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
  useEffect(() => {
    selectModelRef.current = selectModel
  }, [selectModel])

  // ── Auto-scroll ───────────────────────────────────────────────────────────────
  // threadRef is forwarded to BrainShell's scrollable thread container.
  // isNearBottomRef tracks whether the user is within 120px of the bottom so we
  // don't hijack scroll position when they've intentionally scrolled up to read.

  const threadRef       = useRef<HTMLDivElement>(null)
  const isNearBottomRef = useRef(true)

  // Attach scroll listener once on mount to keep isNearBottomRef in sync.
  useEffect(() => {
    const el = threadRef.current
    if (!el) return
    const onScroll = () => {
      isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // ── ResizeObserver — primary scroll driver ───────────────────────────────────
  // useEffect + rAF only fires when React state changes. Framer-motion step-card
  // height animations are JS-driven DOM updates with NO React state change between
  // frames: scroll gets set once when the card first appears (height ≈ 0), then
  // the card grows for ~300ms with no new scroll — user strands above the bottom.
  //
  // ResizeObserver fires on every frame that the inner content div changes size,
  // including mid-animation DOM updates, giving accurate scrollHeight each frame.
  useEffect(() => {
    const el = threadRef.current
    if (!el) return
    const inner = el.firstElementChild
    if (!inner) return
    const ro = new ResizeObserver(() => {
      if (isNearBottomRef.current) {
        el.scrollTop = el.scrollHeight
      }
    })
    ro.observe(inner)
    return () => ro.disconnect()
  }, [])

  // ── Coalesced rAF scroll — forced / explicit triggers only ────────────────────
  // ResizeObserver handles all content-height-driven scrolls above.
  // This rAF path is kept for cases where we must force-scroll regardless of
  // isNearBottomRef (permission prompts, plan approval cards, phase transitions).
  const scrollRafRef   = useRef(0)
  const scrollForceRef = useRef(false)

  const scrollToBottom = useCallback((force = false) => {
    if (force) scrollForceRef.current = true
    cancelAnimationFrame(scrollRafRef.current)
    scrollRafRef.current = requestAnimationFrame(() => {
      const el = threadRef.current
      if (!el) return
      const shouldForce = scrollForceRef.current
      scrollForceRef.current = false
      if (shouldForce || isNearBottomRef.current) {
        el.scrollTop = el.scrollHeight
      }
    })
  }, [])

  // Phase transitions — force-scroll only when a card needs user action.
  useEffect(() => {
    if (phase === 'idle') return
    if (phase === 'planning' || phase === 'paused' || phase === 'complete') {
      scrollToBottom(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // Connector permission card appeared — always scroll into view.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (toolConnectPrompt) scrollToBottom(true) }, [toolConnectPrompt?.connector_slug])

  // Permission prompt card appeared — always scroll into view.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (activePermissionPrompt) scrollToBottom(true) }, [activePermissionPrompt?.promptId])

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
  }, [selectedPersona, models])

  useEffect(() => {
    if (!personaChipOpen || chipPersonasFetchedRef.current) return
    chipPersonasFetchedRef.current = true
    setLoadingChipPersonas(true)
    fetchPersonas()
      .then(list => setChipPersonas(list.map(p => ({ id: p.id, name: p.name, imageUrl: p.imageUrl, modelId: p.modelId, activeVersionId: p.activeVersionId, systemPrompt: null, temperature: null }))))
      .catch(() => setChipPersonas([]))
      .finally(() => setLoadingChipPersonas(false))
  }, [personaChipOpen])

  useEffect(() => () => {
    if (completeTimerRef.current) clearTimeout(completeTimerRef.current)
    abortRef.current?.abort()
    activeRunAbortRef.current?.abort()
  }, [])

  // ── Sync chatId + full state reset when navigating between brain threads ──────
  useEffect(() => {
    if (skipNextResetRef.current) {
      skipNextResetRef.current = false
      return
    }
    abortRef.current?.abort()
    activeRunAbortRef.current?.abort()
    activeRunAbortRef.current = null
    activeRunSeqRef.current = 0
    setActivePlanId(null)
    setChatId(chatIdFromUrl)
    setPhase('idle')
    setUserMessage('')
    setUserAttachments([])
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
    setReasoningText('')
    setReasoningActive(false)
    setStreamingComplete(false)
    setCompletedAt(null)
    setStreamError(null)
    setPausedAfterLabel(undefined)
    setStreamImages([])
    setStreamFiles([])
    setToolProgress(null)
    setToolConnectPrompt(null)
    setActivePermissionPrompt(null)
    setLiveToolCalls({})
    setTimeline([])
    seenToolIdsRef.current = new Set()
    progressPushedRef.current = false
    pendingPlanIdRef.current = null
    activeRunSeqRef.current = 0
    setActivePlanId(null)
    setPendingRemapId(null)
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
        const latestWithPlan = [...messages].reverse().find((m) => m.plan)
        const latestPlan = latestWithPlan?.plan ?? null
        const restorableStatuses = new Set(['proposed', 'queued', 'running', 'summarizing'])
        const shouldReattach = Boolean(latestPlan && restorableStatuses.has(latestPlan.status))
        setHistoryMessages(shouldReattach && latestWithPlan ? messages.filter((m) => m.id !== latestWithPlan.id) : messages)
        setHistoryLoaded(true)
        if (shouldReattach && latestWithPlan && latestPlan) {
          const steps = mapHistoryPlanSteps(latestPlan)
          setUserMessage(latestWithPlan.input ?? '')
          setActivePlanId(latestPlan.id)
          activeRunSeqRef.current = 0
          setActivePlanSteps(steps)
          setActivePlanSummary(latestPlan.plan_json?.summary ?? '')
          setStepStatuses(Object.fromEntries(steps.map((s) => [s.id, s.status ?? 'pending' as StepStatus])))
          setStreamedContent(latestWithPlan.output ?? '')
          setPhase(
            latestPlan.status === 'proposed'
              ? 'planning'
              : latestPlan.status === 'summarizing'
                ? 'streaming'
                : 'executing',
          )
        }
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
    const seq = typeof d.seq === 'number' ? d.seq : Number(d.seq ?? 0)
    if (Number.isFinite(seq) && seq > 0) {
      if (seq <= activeRunSeqRef.current) return
      activeRunSeqRef.current = seq
    }

    switch (name) {
      case 'plan_proposed': {
        // The event names the DAG nodes `steps` for FE-compat and ships the
        // dependency `edges` alongside — fold both into flow-grouped steps so
        // PlanCard renders parallel branches as "runs at the same time".
        const rawSteps = ((d.steps ?? []) as BackendPlanStep[])
        const steps    = applyFlowGrouping(rawSteps.map(mapBackendStep), d.edges)
        const planId   = typeof d.plan_id === 'string' ? d.plan_id : null
        const summary  = (d.summary as string) ?? ''
        pendingPlanIdRef.current = planId
        setActivePlanId(planId)
        setActivePlanSteps(steps)
        setActivePlanSummary(summary)
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
        const planId = typeof d.plan_id === 'string' ? d.plan_id : null
        if (planId) setActivePlanId(planId)
        setPhase('executing')
        break
      }

      case 'run_queued': {
        const planId = typeof d.plan_id === 'string' ? d.plan_id : null
        if (planId) setActivePlanId(planId)
        setPhase('executing')
        break
      }

      case 'run_started': {
        setPhase('executing')
        break
      }

      case 'run_summarizing': {
        setPhase('streaming')
        break
      }

      case 'run_completed': {
        break
      }

      case 'run_failed': {
        if (completeTimerRef.current) {
          clearTimeout(completeTimerRef.current)
          completeTimerRef.current = null
        }
        const error = typeof d.error === 'string' ? d.error : 'Brain run failed.'
        setStreamError(error)
        setPhase('failed')
        break
      }

      case 'run_cancelled': {
        if (completeTimerRef.current) {
          clearTimeout(completeTimerRef.current)
          completeTimerRef.current = null
        }
        setPhase('cancelled')
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

      case 'step_skipped': {
        // A non-critical node was skipped (it failed and was skipped, or an
        // upstream failed). Render the dashed "skipped" treatment and let the
        // run continue with downstream steps.
        const stepId = d.step_id as string
        setStepStatuses((prev) => ({ ...prev, [stepId]: 'skipped' }))
        break
      }

      case 'message_saved': {
        if (activeRunAbortRef.current) {
          activeRunAbortRef.current = null
        }
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
          const fileEvent: GeneratedFileEvent = { url, s3_key, filename, mime_type }
          setStreamFiles((prev) => [...prev, fileEvent])
          setTimeline((prev) => [...prev, { kind: 'file', id: `file-${++timelineSeqRef.current}`, data: fileEvent }])
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
        // Per-tenant OAuth (Shopify) ships its init fields here so the card can
        // render the credential form inline instead of a bare OAuth popup.
        const api_key_fields = Array.isArray(d.api_key_fields) ? (d.api_key_fields as ApiKeyField[]) : undefined
        if (slug) {
          setToolConnectPrompt({
            connector_slug: slug,
            display_name,
            auth_mode,
            tool_name,
            request_id,
            api_key_fields,
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
    const seq = typeof d.seq === 'number' ? d.seq : Number(d.seq ?? 0)
    if (Number.isFinite(seq) && seq > 0) {
      if (seq <= activeRunSeqRef.current) return
      activeRunSeqRef.current = seq
    }
    const t = d.type

    // Guard against late tokens leaking into a finished turn — only flip
    // phase out of in-flight states. 'executing' is preserved because that's
    // when the ActivityBlock should keep rendering plan steps; the phase
    // flips to 'streaming' only on actual visible content.
    if (t === 'content') {
      const token = (d.content as string) ?? ''
      setStreamedContent((prev) => prev + token)
      // First visible content closes the live reasoning section (cursor off).
      if (token) setReasoningActive(false)
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
      // Only move off 'thinking'; leave 'planning' alone so the plan card stays
      // visible while extended-thinking tokens stream in after plan_proposed.
      setPhase((prev) => prev === 'thinking' ? 'streaming' : prev)
      // Accumulate the reasoning prose so BrainNarration can surface it. A
      // heading opens a new section (rendered on its own line); bodies/legacy
      // deltas append in place.
      const chunk = typeof d.content === 'string' ? d.content : ''
      if (chunk) {
        setReasoningActive(true)
        setReasoningText((prev) => {
          if (t === 'reasoning_heading') {
            return prev ? `${prev}\n\n${chunk}` : chunk
          }
          return prev + chunk
        })
      }
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
    currentAttachments: UserAttachment[] = [],
    currentStreamFiles: GeneratedFileEvent[] = [],
  ) => {
    const key = `turn-${++turnCounterRef.current}`
    setLocalTurns((prev) => [
      ...prev,
      {
        key,
        userInput:      currentUserMessage,
        output:         currentStreamedContent,
        planSteps:      currentPlanSteps.length > 0 ? currentPlanSteps : undefined,
        planSummary:    currentActivePlanSummary || undefined,
        images:         currentStreamImages.length > 0 ? currentStreamImages : undefined,
        generatedFiles: currentStreamFiles.length > 0 ? currentStreamFiles : undefined,
        completedAt:    currentCompletedAt ?? undefined,
        cancelled:      opts.cancelled ?? false,
        attachments:    currentAttachments.length > 0 ? currentAttachments : undefined,
      },
    ])

    // Reset all active-turn state
    setUserMessage('')
    setUserAttachments([])
    setStreamedContent('')
    setReasoningText('')
    setReasoningActive(false)
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
    setStreamFiles([])
    setToolProgress(null)
    setToolConnectPrompt(null)
    setActivePermissionPrompt(null)
    setLiveToolCalls({})
    setTimeline([])
    seenToolIdsRef.current = new Set()
    progressPushedRef.current = false
    pendingPlanIdRef.current = null
    activeRunSeqRef.current = 0
    setActivePlanId(null)
  }, [])

  useEffect(() => {
    if (!activePlanId) return
    if (phase !== 'executing' && phase !== 'streaming' && phase !== 'paused') return
    if (activeRunAbortRef.current) return

    const controller = new AbortController()
    activeRunAbortRef.current = controller
    let closed = false

    void subscribeBrainRun(activePlanId, activeRunSeqRef.current, controller.signal)
      .then((response) => consumeBrainStream(response, {
        onNamed:  handleNamedEvent,
        onInline: handleInlineEvent,
        onClose:  () => {
          closed = true
          if (activeRunAbortRef.current === controller) activeRunAbortRef.current = null
        },
        onError:  (e) => {
          if (e.name === 'AbortError') return
          console.error('[Brain] run stream error:', e)
          setStreamError(e.message || 'Brain run connection lost. Reopen this chat to reconnect.')
          setPhase('failed')
        },
      }))
      .catch((e) => {
        if ((e as Error)?.name === 'AbortError') return
        console.error('[Brain] run subscribe failed:', e)
        setStreamError((e as Error)?.message || 'Failed to subscribe to Brain run.')
        setPhase('failed')
      })

    return () => {
      if (!closed && activeRunAbortRef.current === controller) {
        controller.abort()
        activeRunAbortRef.current = null
      }
    }
  }, [activePlanId, phase, handleNamedEvent, handleInlineEvent])

  // ── Stream runner ─────────────────────────────────────────────────────────────

  const runBrainStream = useCallback(async (
    input:            string,
    existingChatId:   string | null,
    fromScheduleId?:  string,
    files?:           File[],
    displayInput?:    string,  // what shows in the user bubble (defaults to input)
    allDisplayFiles?: File[],  // all files to show as chips (includes text-extracted ones)
  ) => {
    if (completeTimerRef.current) {
      clearTimeout(completeTimerRef.current)
      completeTimerRef.current = null
    }

    // Abort any prior in-flight stream before starting a new turn. Without
    // this, a previously-running consumer can keep pushing events into the
    // new turn's state (e.g., late `content` tokens after the user retries).
    abortRef.current?.abort()
    activeRunAbortRef.current?.abort()
    activeRunAbortRef.current = null
    activeRunSeqRef.current = 0
    setActivePlanId(null)

    setUserMessage(displayInput ?? input)
    setUserAttachments((allDisplayFiles ?? files)?.map(f => ({ file_name: f.name, file_type: f.type, file_size: f.size })) ?? [])
    setPhase('thinking')
    setStreamedContent('')
    setReasoningText('')
    setReasoningActive(false)
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
    setStreamFiles([])
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

      const fileOpts = files?.length ? { files } : {}
      if (!resolvedChatId) {
        const result = await startBrainChat(input, fileOpts, controller.signal)
        resolvedChatId = result.chatId
        response = result.stream
        if (resolvedChatId) {
          skipNextResetRef.current = true
          skipNextHistoryLoadRef.current = true
          setChatId(resolvedChatId)
          if (fromScheduleId) {
            linkScheduleToChat(fromScheduleId, resolvedChatId)
            // If the id looks like a local temp id (not a UUID), flag it for
            // remapping once the stream completes and Brain has persisted the task.
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fromScheduleId)) {
              setPendingRemapId(fromScheduleId)
            }
          }
          replace(`/brain?id=${resolvedChatId}`, { scroll: false })
        } else {
          // Backend forgot to set X-Chat-Id (e.g., a misconfigured proxy
          // stripping the header). The stream will still play, but the chat
          // is unrecoverable on refresh — warn the user.
          console.warn('[Brain] /brain/create returned no X-Chat-Id header — chat is orphaned')
          toast.warning('Chat started but cannot be saved to the URL. Refreshing will lose it.')
        }
      } else {
        response = await continueBrainChat(resolvedChatId, input, fileOpts, controller.signal)
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

  // ── Remap local schedule id → backend task id after stream completes ──────────
  // When a schedule is created via the modal, a local temp id is used until Brain
  // creates the real task. Once the stream finishes, we scan the task list for a
  // task created in the last 5 minutes and remap the localStorage chat link so
  // future edits navigate back to this thread instead of opening a new one.
  useEffect(() => {
    if (phase !== 'complete' || !pendingRemapId) return
    const localId = pendingRemapId
    listTasks()
      .then(tasks => {
        const now = Date.now()
        const recent = tasks
          .filter(t => t.created_at && (now - new Date(t.created_at).getTime()) < 5 * 60 * 1000)
          .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())
        if (recent[0]) remapScheduleLink(localId, recent[0].id)
      })
      .catch(() => {})
      .finally(() => setPendingRemapId(null))
  }, [phase, pendingRemapId])

  // ── Pre-populate input from schedule create ───────────────────────────────────
  // The Schedules page hands off newly-created schedules via ?fromSchedule=<id>
  // with the prompt stashed in memory. We read it once, feed it into BrainShell's
  // input so the user can review and send it, and keep the schedule id around so
  // the first handleSend can still call linkScheduleToChat.
  const [scheduleInitialInput,  setScheduleInitialInput]  = useState('')
  const pendingFromScheduleIdRef = useRef<string | null>(null)
  const handledScheduleIdRef     = useRef<string | null>(null)
  // Holds a local temp schedule ID that needs remapping to a backend UUID once
  // the stream completes (Brain's AI will have created the task by then).
  useEffect(() => {
    const sid = searchParams.get('fromSchedule')
    if (!sid || handledScheduleIdRef.current === sid) return
    handledScheduleIdRef.current = sid
    const prompt = consumePendingPrompt(sid)
    if (!prompt) return
    pendingFromScheduleIdRef.current = sid
    queueMicrotask(() => setScheduleInitialInput(prompt))
  }, [searchParams])

  // ── Send handler ──────────────────────────────────────────────────────────────

  const handleSend = useCallback((value: string) => {
    // Hard-stop: an exhausted credit/topup user cannot send until they top up.
    if (creditStatus.blocked) {
      toast.error("You've used all your credits", {
        description: 'Buy a top-up to continue using Souvenir.',
      })
      window.dispatchEvent(new Event(CREDITS_EXHAUSTED_EVENT))
      return
    }

    const terminalPhases: Phase[] = ['complete', 'cancelled', 'failed']
    if (terminalPhases.includes(phase)) {
      snapshotAndReset(
        { cancelled: phase === 'cancelled' },
        planSteps,
        userMessage,
        streamedContent,
        activePlanSummary,
        completedAt,
        streamImages,
        userAttachments,
        streamFiles,
      )
    }

    const allFiles = brainAttachments.map(a => a.file)
    setBrainAttachments([])

    const doSend = async () => {
      // Extract text from every file we can read client-side (PDF via pdfjs,
      // DOCX/PPTX/XLSX via ZIP+XML, plain text via FileReader). Files whose
      // text we can extract are injected as <document> blocks in the message
      // so the LLM receives the actual content regardless of backend support.
      // Files we cannot extract (raw images) are still sent via FormData.
      const blocks: string[] = []
      const binaryFiles: File[] = []

      await Promise.all(allFiles.map(async f => {
        if (isExtractable(f)) {
          const text = await extractText(f)
          if (text.trim()) {
            blocks.push(`<document name="${f.name}">\n${text.trim()}\n</document>`)
            return
          }
        }
        binaryFiles.push(f)
      }))

      const prefix     = blocks.join('\n\n')
      const apiMessage = prefix
        ? (value.trim() ? `${prefix}\n\n${value}` : prefix)
        : value

      // Consume the pending schedule id once so the new chat gets linked.
      const fromScheduleId = pendingFromScheduleIdRef.current
      pendingFromScheduleIdRef.current = null

      void runBrainStream(
        apiMessage,
        chatId,
        fromScheduleId ?? undefined,
        binaryFiles.length > 0 ? binaryFiles : undefined,
        value,   // shown in user bubble (original text, no injected content)
        allFiles.length > 0 ? allFiles : undefined,  // all files shown as chips (incl. text-extracted)
      )
    }

    void doSend()
  }, [
    phase, chatId, planSteps, userMessage, streamedContent,
    activePlanSummary, completedAt, streamImages, streamFiles, snapshotAndReset, runBrainStream,
    brainAttachments, userAttachments, creditStatus.blocked,
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
    if ((!activePlanId && !promptId) || actionInFlight) return
    setActionInFlight(true)
    const action = activePlanId
      ? approveBrainPlan(activePlanId)
      : respondToPrompt(promptId, { response: { decision: 'approve' } })
    void action
      .then(() => {
        pendingPlanIdRef.current = null
        activeRunSeqRef.current = 0
        setPhase('executing')
      })
      .catch((e: unknown) => {
        console.error('[Brain] approve failed:', e)
        setStreamError(explainPromptError(e, 'approve'))
        setPhase('failed')
      })
      .finally(() => setActionInFlight(false))
  }, [activePlanId, promptId, actionInFlight])

  const handleCounter = useCallback(() => {
    if ((!activePlanId && !promptId) || actionInFlight) return
    setShowCounterInput(true)
  }, [activePlanId, promptId, actionInFlight])

  const handleCounterSend = useCallback(() => {
    const revision = counterText.trim()
    if ((!activePlanId && !promptId) || actionInFlight || !revision) return
    setActionInFlight(true)
    setShowCounterInput(false)
    setCounterText('')
    setPhase('thinking')

    if (activePlanId) {
      const controller = new AbortController()
      abortRef.current = controller
      void counterBrainPlan(activePlanId, revision, controller.signal)
        .then((response) => consumeBrainStream(response, {
          onNamed: handleNamedEvent,
          onInline: handleInlineEvent,
          onClose: () => {},
          onError: (e) => {
            if (e.name === 'AbortError') return
            throw e
          },
        }))
        .catch((e: unknown) => {
          if ((e as Error)?.name === 'AbortError') return
          console.error('[Brain] counter failed:', e)
          setStreamError(explainPromptError(e, 'counter'))
          setPhase('failed')
        })
        .finally(() => setActionInFlight(false))
      return
    }

    void respondToPrompt(promptId, {
      response: { decision: 'counter', counter_text: revision },
    })
      .catch((e: unknown) => {
        console.error('[Brain] legacy counter failed:', e)
        setStreamError(explainPromptError(e, 'counter'))
        setPhase('failed')
      })
      .finally(() => setActionInFlight(false))
  }, [
    activePlanId, promptId, actionInFlight, counterText,
    handleNamedEvent, handleInlineEvent,
  ])

  const handlePlanCancel = useCallback(() => {
    if ((!activePlanId && !promptId) || actionInFlight) return
    setActionInFlight(true)
    const action = activePlanId
      ? cancelBrainPlan(activePlanId)
      : respondToPrompt(promptId, { response: { decision: 'cancel' } })
    void action
      .then(() => setPhase('cancelled'))
      .catch((e: unknown) => {
        console.error('[Brain] cancel failed:', e)
        setStreamError(explainPromptError(e, 'cancel'))
        setPhase('failed')
      })
      .finally(() => setActionInFlight(false))
  }, [activePlanId, promptId, actionInFlight])

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
    if (activePlanId && (phase === 'executing' || phase === 'streaming' || phase === 'paused')) {
      void stopBrainRun(activePlanId).catch(() => {})
    } else {
      abortRef.current?.abort()
      if (chatId) {
        void stopBrainChat(chatId).catch(() => {})
      }
    }
    const completedSteps = planSteps.filter((s) => s.status === 'complete')
    setPausedAfterLabel(completedSteps[completedSteps.length - 1]?.label)
    setPhase('paused')
  }, [activePlanId, phase, chatId, planSteps])

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
      userAttachments,
      streamFiles,
    )
    setPhase('idle')
  }, [phase, planSteps, userMessage, streamedContent, activePlanSummary, completedAt, streamImages, snapshotAndReset, userAttachments, streamFiles])

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
    setUserAttachments([])
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
    setReasoningText('')
    setReasoningActive(false)
    setStreamingComplete(false)
    setCompletedAt(null)
    setStreamError(null)
    setPausedAfterLabel(undefined)
    setStreamImages([])
    setStreamFiles([])
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
    const allAttachments = msg.attachments ?? []
    const images       = allAttachments.filter((a) => a.mime_type?.startsWith('image/'))
    const genFiles     = allAttachments.filter((a) => !a.mime_type?.startsWith('image/') && a.origin === 'generated')
    // msg.input from the backend contains injected <document> blocks — strip them
    // before display and before keying into localStorage (which was stored against
    // the clean user text, not the full injected message).
    const cleanInput = stripDocumentBlocks(msg.input)
    const msgAttachments = storedHistoryAttachments[cleanInput]

    // Map persisted tool_calls into ActivityFeedItem[] for the history view.
    const rawToolCalls = (msg.tool_calls ?? []) as Array<Record<string, unknown>>
    const historyToolItems: ActivityFeedItem[] = rawToolCalls
      .map((tc, idx): ActivityFeedItem | null => {
        const tool = typeof tc.tool === 'string' ? tc.tool : ''
        const args = (tc.args && typeof tc.args === 'object' ? tc.args : {}) as Record<string, unknown>

        if (tool === 'web_search') {
          const query = typeof args.query === 'string' ? args.query : ''
          return { kind: 'web_search', data: { query, links: [] }, id: `${msg.id}-tc-${idx}` }
        }
        if (tool === 'web_read') {
          const url = typeof args.url === 'string' ? args.url : ''
          let hostname = url
          try { hostname = new URL(url).hostname } catch { /* use raw url */ }
          return { kind: 'tool', data: { name: `Read: ${hostname}` }, id: `${msg.id}-tc-${idx}`, status: 'complete' }
        }
        // run_connector_tool / gmail_send_email / list_connector_tools etc
        if (tool === 'list_connectors' || tool === 'list_connector_tools') return null // internal, don't show

        // Display name: prefer args.tool_slug (e.g. GMAIL_SEND_EMAIL → Gmail: Send Email),
        // otherwise humanise the tool function name (gmail_send_email → gmail send email).
        const rawSlug = typeof args.tool_slug === 'string' ? args.tool_slug : tool
        const toolName = formatToolSlug(rawSlug)

        // Detect success/failure from the tool output JSON.
        // `successful === false` or a top-level `error` field means the call failed.
        let toolStatus: 'streaming' | 'executing' | 'complete' | 'failed' = 'complete'
        if (typeof tc.output === 'string') {
          try {
            const parsed = JSON.parse(tc.output)
            if (parsed?.successful === false || (parsed?.error && !parsed?.data?.display_url)) {
              toolStatus = 'failed'
            }
          } catch { /* not JSON, keep as complete */ }
        }
        return { kind: 'tool', data: { name: toolName }, id: `${msg.id}-tc-${idx}`, status: toolStatus }
      })
      .filter((x): x is ActivityFeedItem => x !== null)

    return (
      <m.div key={msg.id} initial={MOUNT_INITIAL} animate={MOUNT_ANIMATE} transition={springs.moderate} style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingTop: 40 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          {msgAttachments && <AttachmentChips attachments={msgAttachments} />}
          <MessageBubble role="user" content={cleanInput} maxWidth="75%" />
        </div>
        {planSteps.length > 0 && (
          <LoopHistoryCard
            steps={planSteps}
            summary={msg.plan?.plan_json?.summary}
            completedAt={msg.created_at ? new Date(msg.created_at) : undefined}
          />
        )}
        {historyToolItems.length > 0 && <ActivityFeed items={historyToolItems} />}
        {images.length > 0 && <MessageImages images={images} />}
        {msg.output && (
          <StreamingMessageBubble content={msg.output} isComplete />
        )}
        {genFiles.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {genFiles.map((f) => (
              <ArtifactCard
                key={f.id}
                title={filenameFromS3Key(f.s3_key)}
                meta={mimeLabel(f.mime_type)}
                onClick={() => window.open(f.url, '_blank', 'noopener')}
              />
            ))}
          </div>
        )}
      </m.div>
    )
  })

  // ── Thread: locally completed turns (same session) ───────────────────────────

  const localTurnElements = localTurns.map((turn) => (
    <m.div key={turn.key} initial={MOUNT_INITIAL} animate={MOUNT_ANIMATE} transition={springs.moderate} style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingTop: 40 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        {turn.attachments && <AttachmentChips attachments={turn.attachments} />}
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
      {turn.generatedFiles && turn.generatedFiles.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {turn.generatedFiles.map((f) => (
            <ArtifactCard
              key={f.url}
              title={f.filename}
              meta={mimeLabel(f.mime_type)}
              onClick={() => window.open(f.url, '_blank', 'noopener')}
            />
          ))}
        </div>
      )}
      {turn.cancelled && !turn.output && (
        <LoopCancelledCard
          completedSteps={turn.planSteps?.filter((s) => s.status === 'complete').length ?? 0}
          totalSteps={turn.planSteps?.length ?? 0}
          onStartNew={handleRestart}
        />
      )}
    </m.div>
  ))

  // ── Thread: active turn ───────────────────────────────────────────────────────

  // Phases that may interleave a clarification/permission prompt without
  // implying the plan has been retracted. While we're in one of these, keep
  // the PlanCard visible so an out-of-band prompt can't wipe the active turn.
  // Whether plan execution is underway (any step has left 'pending').
  // Used to distinguish "clarifying before plan" from "clarifying mid-execution".
  const planExecutionStarted = planSteps.some(
    (s) => s.status === 'executing' || s.status === 'complete' || s.status === 'failed',
  )
  // Show the plan approval card only when we're genuinely waiting for approval
  // (planning or pre-plan clarification). During mid-execution question_prompts
  // the plan is already running, so don't re-surface the approval UI.
  const showPlanCard      = (phase === 'planning' || (phase === 'clarifying-goal' && !planExecutionStarted)) && activePlanSteps.length > 0
  // Keep the step tracker visible when Brain asks a mid-execution question.
  const showActivityBlock = planSteps.length > 0 && (
    phase === 'executing' ||
    phase === 'streaming' ||
    phase === 'paused' ||
    (phase === 'clarifying-goal' && planExecutionStarted)
  )

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
        return (
          <ArtifactCard
            key={item.id}
            title={item.data.filename}
            meta={mimeLabel(item.data.mime_type)}
            onClick={() => window.open(item.data.url, '_blank', 'noopener')}
          />
        )
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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <AttachmentChips attachments={userAttachments} />
        <MessageBubble role="user" content={userMessage} maxWidth="75%" />
      </div>

      {/* Answered clarification Q&As — read-only stacked card, placed right
          after the user message exactly like the Full-thread story. */}
      {answeredClarifications.length > 0 && (
        <Rise><ClarificationSummary items={answeredClarifications} /></Rise>
      )}

      {/* Brain's extended-thinking prose (reasoning_heading/body deltas),
          surfaced as inter-phase narration. Streams live while reasoning is
          active, then stays as a record of how Brain approached the task. */}
      {reasoningText && (
        <Rise><BrainNarration text={reasoningText} isStreaming={reasoningActive} /></Rise>
      )}

      {/* ActivityBlock — plan-step tracker; persists through executing and paused */}
      {showActivityBlock && (
        <ActivityBlock steps={planSteps} interpretation={activePlanSummary} />
      )}

      {/* Complete header sits above the transcript */}
      {phase === 'complete' && (
        <Rise><BrainResultHeader summary={activePlanSummary || 'Analysis complete'} /></Rise>
      )}

      {/* ── Ordered transcript ──────────────────────────────────────────────
          Text segments, tool calls, web searches, files, images, the connector
          permission/link cards — all rendered in the order they streamed in,
          so chat and tools interleave instead of bucketing. Each row rises into
          place as it streams in (consumer-driven KDS mount gesture). */}
      {timeline.map((item, i) => {
        const node = renderTimelineItem(item, i === timeline.length - 1)
        if (!node) return null
        return (
          <m.div key={item.id} initial={MOUNT_INITIAL} animate={MOUNT_ANIMATE} transition={springs.moderate}>
            {node}
          </m.div>
        )
      })}

      {/* Plan card + optional counter input — rendered AFTER the timeline so
          approval UI is always at the bottom regardless of how much content
          has already streamed above it (e.g. a second plan after countering). */}
      {showPlanCard && (
        <>
          <Rise>
            <PlanCard
              steps={planSteps}
              interpretation={activePlanSummary}
              onApprove={handleApprove}
              onCounter={handleCounter}
              onCancel={handlePlanCancel}
              actionsDisabled={(!activePlanId && !promptId) || actionInFlight}
            />
          </Rise>
          <AnimatePresence initial={false}>
            {showCounterInput && (
              <m.div
                key="counter-input"
                initial={MOUNT_INITIAL}
                animate={MOUNT_ANIMATE}
                exit={MOUNT_INITIAL}
                transition={springs.fast}
              >
                <CounterInput
                  value={counterText}
                  onChange={setCounterText}
                  onSend={handleCounterSend}
                  onCancel={() => { setShowCounterInput(false); setCounterText('') }}
                  disabled={(!activePlanId && !promptId) || actionInFlight}
                />
              </m.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* Live cursor — thinking before the first token, composing while tokens
          (or tools) are still arriving. */}
      {phase === 'thinking'  && <StreamingIndicator phase="thinking" />}
      {phase === 'streaming' && <StreamingIndicator phase="streaming" />}

      {/* PauseCard */}
      {phase === 'paused' && (
        <Rise>
          <PauseCard
            pausedAfterStep={pausedAfterLabel}
            onContinue={handleContinue}
            onChangeDirection={handleChangeDirection}
            onCancel={() => setPhase('cancelled')}
          />
        </Rise>
      )}

      {/* Completed plan recap, below the transcript */}
      {phase === 'complete' && planSteps.length > 0 && (
        <Rise><LoopHistoryCard steps={planSteps} completedAt={completedAt ?? undefined} /></Rise>
      )}

      {/* Cancelled */}
      {phase === 'cancelled' && (
        <Rise>
          <LoopCancelledCard
            completedSteps={planSteps.filter((s) => s.status === 'complete').length}
            totalSteps={planSteps.length}
            onStartNew={handleRestart}
          />
        </Rise>
      )}

      {/* Failed */}
      {phase === 'failed' && (
        <Rise><LoopFailedCard errorDetail={streamError ?? undefined} onTryAgain={handleRestart} onRephrase={handleRestart} /></Rise>
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
      icon={<FolderOneIcon size={20} color="var(--chip-text)" variant="static" />}
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
              : <Dropdown.Item label="No agents yet" fluid disabled />
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
      hideStyle
      hidePersona
    />
  )

  const brainIsStreaming = !['idle', 'complete', 'cancelled', 'failed', 'paused'].includes(phase)

  // ── ContextRail data ─────────────────────────────────────────────────────────
  // The right rail surfaces what's active for this conversation:
  //   • Persona  — confirmed by the SSE `context` event; falls back to the
  //                chip selection so the rail isn't empty before the first turn.
  //   • Pins / Files / Connectors — from the SSE event once a turn has run.

  const contextRailData = useMemo<ContextRailData>(() => {
    // Build a persona entry from the chip so we can show it immediately when a
    // persona is selected but no SSE turn has fired yet (or when the event
    // returned no persona field).
    const chipPersona: ContextRailData['persona'] | undefined = selectedPersona
      ? {
          name:     selectedPersona.name,
          handle:   selectedPersona.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
          avatarUrl: selectedPersona.imageUrl ?? undefined,
        }
      : undefined

    if (!liveContext) {
      // No turn has run yet — show the chip persona so the rail opens
      // immediately when the user selects a persona before their first send.
      return chipPersona ? { persona: chipPersona } : {}
    }

    const fmtSize = (bytes?: number): string | null => {
      if (!bytes || bytes <= 0) return null
      if (bytes < 1024) return `${bytes} B`
      if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    return {
      // Prefer what Brain confirmed it loaded (SSE event); fall back to the
      // chip selection so the persona is never missing from the rail.
      persona: liveContext.persona
        ? {
            name:      liveContext.persona.name || liveContext.persona.handler || 'Persona',
            handle:    liveContext.persona.handler || '',
            avatarUrl: liveContext.persona.avatar_url,
          }
        : chipPersona,
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
  }, [liveContext, selectedPersona])

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
      threadRef={threadRef}
      initialInputValue={scheduleInitialInput || undefined}
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
        disabled: brainIsStreaming || creditStatus.blocked,
        onStop: handleStop,
        onFilePaste: (files) => setBrainAttachments((prev) => processFiles(files, prev)),
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
        defaultBodySection: 'brain',
        hideProjects:       true,
        defaultCollapsed:   sidebarCollapsed,
        onCollapse:         handleSidebarCollapse,
        recentItems: (
          <BrainSidebarSections
            activeChatId={chatId}
            onThreadClick={(id) => { replace(`/brain?id=${id}`) }}
          />
        ),
        newChatLabel:    'New brain thread',
        onNewChat:       handleNewChat,
        onChatTabClick:         () => push('/chat'),
        onChatsClick:           () => { toast.info("Opening Chat Board", { id: 'nav' }); push('/chats') },
        onAllBrainThreadsClick: () => push('/brain/threads'),
        onSchedulesClick:       () => push('/brain/schedules'),
        onPersonasClick: () => { toast.info("Opening Agents", { id: 'nav' }); push('/agents') },
        onProjectsClick: () => { toast.info("Opening Projects", { id: 'nav' }); push('/projects') },
        onBrainClick:    () => push('/brain'),
        onSearch:        openSearch,
        searchActive:    searchOpen,
        orgId:           orgId ?? undefined,
        orgName:         orgId ? org.name : undefined,
        showAdmin:       Boolean(orgId) && currentUserRole === 'admin',
        orgBadgeSublabel,
        onOrganisationClick: () => push('/org/general'),
        onAdminSectionClick: (id: string) => {
          const routes: Record<string, string> = {
            general:           '/org/general',
            members:           '/org/members',
            teams:             '/org/teams',
            'plans-usage':     '/org/plans',
            connectors:        '/settings/connectors',
            'model-providers': '/settings/ai',
          }
          const href = routes[id]
          if (href) { push(href); return }
          const coming: Record<string, string> = { folders: 'Folders', websites: 'Websites', triggers: 'Triggers' }
          toast.info(`${coming[id] ?? id} — coming soon`, { id: 'nav' })
        },
        accountMenu: (collapsed) => {
          if (!user) {
            return collapsed ? (
              <div style={{ padding: '12px 8px', display: 'flex', justifyContent: 'center' }}>
                <div className="kaya-skeleton" style={{ width: 32, height: 32, borderRadius: 8 }} />
              </div>
            ) : (
              <div style={{ padding: '8px 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="kaya-skeleton" style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0 }} />
                <div style={{ flex: '1 0 0', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div className="kaya-skeleton" style={{ height: 14, width: '60%', borderRadius: 4 }} />
                  <div className="kaya-skeleton" style={{ height: 11, width: '42%', borderRadius: 4 }} />
                </div>
              </div>
            )
          }
          return (
            <AccountMenu
              name={displayName || 'Account'}
              plan={planLabel}
              credits={user?.creditsRemaining ?? undefined}
              avatarSrc={user?.profilePicture ?? undefined}
              collapsed={collapsed}
              panelWidth={274}
              placement="top-start"
              onProfile={() => push('/settings/account')}
              onUpgradePlan={() => push('/settings/billing')}
              onSettings={() => push('/settings')}
              onHelp={() => push('/settings/help')}
              onLogOut={() => { if (isAuthenticated) { void logout() } else { push('/auth/login') } }}
            />
          )
        },
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
