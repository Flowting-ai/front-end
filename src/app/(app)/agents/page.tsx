'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRouter, usePathname } from 'next/navigation'
import { AnimatePresence, m } from 'framer-motion'
import {
  PlusSignIcon,
  SearchOneIcon,
  ArrowDownOneIcon,
  ArrowUpRightOneIcon,
  CopyOneIcon,
  PenOneIcon,
  CancelOneIcon,
  FilterMailIcon,
  AlertCircleIcon,
  RedoIcon,
  DeleteTwoIcon,
  TickTwoIcon,
} from '@strange-huge/icons'
import { useMounted } from '@/hooks/use-mounted'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { Spinner } from '@/components/Spinner'
import { Dropdown, DROPDOWN_SCALE_PRESET } from '@/components/Dropdown'
import { Avatar } from '@/components/Avatar'
import { Tooltip } from '@/components/Tooltip'
import { DateRangePill } from '@/components/DateRangePill'
import {
  SettingsTable,
  SettingsTableToolbar,
  SettingsTableViewport,
  SettingsTableHeader,
  SettingsTableHeaderCell,
  SettingsTableRow,
  SettingsTableCell,
} from '@/components/SettingsTable'
import { fetchPersonas, bustPersonasCache, deletePersona, togglePause, usePersonaRepoDeduped, isPersonaOwnedByViewer, PERSONAS_LIST_UPDATED_EVENT, type Persona } from '@/lib/api/personas'
import { fetchModelsWithCache } from '@/lib/ai-models'
import type { AIModel } from '@/types/ai-model'
import { fetchDashboard, listShares, listReceived, revokeShare, type PersonaShare, type ReceivedShareResponse, type ShareDashboardResponse } from '@/lib/api/persona-shares'
import type { SuperLinkDrawerSession } from '@/components/SuperLinkDrawer'
import { Badge } from '@/components/Badge'
import { TokenBudgetBar } from '@/components/TokenBudgetBar'
import { canonicalShareUrl } from '@/lib/share-url'
import { personaTagsKey, personaProfileKey } from '@/lib/storage-keys'
import { AGENTS_TEMPLATES_ROUTE, AGENT_CHAT_ROUTE, AGENT_CONFIGURE_INSTRUCTIONS_ROUTE, AGENT_CONFIGURE_SHARING_ROUTE } from '@/lib/routes'
import Tabs from '@/components/Tabs'
import { PersonaCard } from '@/components/PersonaCard'
import type { SuperLinkStatus } from '@/components/SuperLinkRow'
import { SuperLinkDrawer, type SuperLinkDrawerLink } from '@/components/SuperLinkDrawer'
import { SuperLinksEmpty } from '@/components/SuperLinksEmpty'
import { Sparkline } from '@/components/Sparkline'
import { TeamAgentsTab } from '@/app/(app)/agents/components/TeamAgentsTab'
import { usePinboard } from '@/context/pinboard-context'
import { useOrg } from '@/context/org-context'
import { useAuth } from '@/context/auth-context'
import { fetchPersonaOwnerMap, resolveViewerUserId } from '@/lib/api/teams'
import { toast } from 'sonner'

// ── Types ─────────────────────────────────────────────────────────────────────

type TabId = 'my-personas' | 'team-agents' | 'super-links' | 'community'
type SortKey = 'activity' | 'az' | 'za'

type AgentFilters = {
  status:     Set<'live' | 'draft' | 'paused'>
  visibility: Set<'private' | 'team' | 'community'>
  superLink:  Set<'has-link' | 'no-link'>
  models:     Set<string>
}
const EMPTY_FILTERS: AgentFilters = {
  status: new Set(), visibility: new Set(), superLink: new Set(), models: new Set(),
}

function modelDisplayName(modelId: string | null): string | null {
  if (!modelId) return null
  const id = modelId.toLowerCase()
  if (id.includes('claude')) {
    if (id.includes('opus'))  return 'Claude Opus'
    if (id.includes('haiku')) return 'Claude Haiku'
    return 'Claude Sonnet'
  }
  if (id.includes('gpt')) return (id.includes('3.5') || id.includes('3-5')) ? 'GPT-3.5' : 'GPT-4'
  if (id.includes('gemini'))  return 'Gemini'
  if (id.includes('llama'))   return 'Llama'
  if (id.includes('mistral')) return 'Mistral'
  return modelId
}

// ── Mock recommended personas (community templates) ───────────────────────────

const RECOMMENDED: Persona[] = [
  {
    id: 'rec-1',
    name: 'General Assistant',
    handle: '@general_assistant',
    description: 'Example: The key distinction is that replicants possess artificial intelligence. It\'s all there. Let me walk you through what\'s built.',
    imageUrl: null,
    modelId: null,
    tags: [],
    temperature: 0.5,
    isActive: true,
    isPaused: false,
    status: 'active',
    activeVersionId: null,
    workingVersionId: null,
    publishedAt: null,
    versionCount: 1,
    visibility: 'private',
    teamIds: [],
    hasSystemInstructions: true,
    sourceShareId: null,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'rec-2',
    name: 'Research Analyst',
    handle: '@research_analyst',
    description: 'Example: The key distinction is that replicants possess artificial intelligence. It\'s all there. Let me walk you through what\'s built.',
    imageUrl: null,
    modelId: null,
    tags: [],
    temperature: 0.3,
    isActive: true,
    isPaused: false,
    status: 'active',
    activeVersionId: null,
    workingVersionId: null,
    publishedAt: null,
    versionCount: 1,
    visibility: 'private',
    teamIds: [],
    hasSystemInstructions: true,
    sourceShareId: null,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'rec-3',
    name: 'Code Reviewer',
    handle: '@code_reviewer',
    description: 'Example: The key distinction is that replicants possess artificial intelligence. It\'s all there. Let me walk you through what\'s built.',
    imageUrl: null,
    modelId: null,
    tags: [],
    temperature: 0.3,
    isActive: true,
    isPaused: false,
    status: 'active',
    activeVersionId: null,
    workingVersionId: null,
    publishedAt: null,
    versionCount: 1,
    visibility: 'private',
    teamIds: [],
    hasSystemInstructions: true,
    sourceShareId: null,
    createdAt: '',
    updatedAt: '',
  },
]

// ── PersonaAvatar ─────────────────────────────────────────────────────────────

function PersonaAvatar({ imageUrl, name, size = 65 }: { imageUrl: string | null; name: string; size?: number }) {
  const [error, setError] = useState(false)
  const initials = name.slice(0, 2).toUpperCase()

  if (imageUrl && !error) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 8,
          flexShrink: 0,
          overflow: 'hidden',
          boxShadow: '0px 1.091px 1.09px 0px rgba(59,54,50,0.05), 0px 1.455px 1px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-100)',
          position: 'relative',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- dynamic avatar URL, onError fallback requires HTMLImageElement access */}
        <img
          src={imageUrl}
          alt={name}
          onError={() => setError(true)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
    )
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        flexShrink: 0,
        background: 'var(--neutral-100)',
        boxShadow: '0px 1.091px 1.09px 0px rgba(59,54,50,0.05), 0px 1.455px 1px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-100)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-body)',
        fontWeight: 'var(--font-weight-medium)',
        fontSize: 20,
        color: 'var(--neutral-500)',
      }}
    >
      {initials}
    </div>
  )
}

// ── RecommendedCard ───────────────────────────────────────────────────────────

function RecommendedCard({ persona }: { persona: Persona }) {
  return (
    <div style={{
      background: 'var(--neutral-white)',
      borderRadius: 16,
      paddingTop: 12,
      paddingLeft: 12,
      paddingRight: 12,
      paddingBottom: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 9,
      boxShadow: '0px 2px 2.8px 0px var(--blue-100, #cadcf1), 0px 0px 0px 1px var(--neutral-100)',
      position: 'relative',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <PersonaAvatar imageUrl={persona.imageUrl} name={persona.name} size={65} />

        <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 'var(--font-weight-regular)',
            fontSize: 16,
            lineHeight: '22px',
            color: 'var(--neutral-900)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            margin: 0,
          }}>
            {persona.name}
          </p>
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 'var(--font-weight-regular)',
            fontSize: 13,
            lineHeight: '16px',
            color: 'var(--neutral-500)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            margin: 0,
          }}>
            {persona.handle}
          </p>
        </div>

        <IconButton
          variant="ghost-2"
          size="sm"
          icon={<CopyOneIcon size={20} />}
          aria-label={`Copy ${persona.name}`}
        />
      </div>

      {/* Description */}
      <p style={{
        fontFamily: 'var(--font-body)',
        fontWeight: 'var(--font-weight-regular)',
        fontSize: 12,
        lineHeight: '16px',
        color: '#857a72',
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        margin: 0,
        minHeight: 32,
      }}>
        {persona.description}
      </p>

      {/* Action bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 4,
      }}>
        <IconButton
          variant="ghost-2"
          size="sm"
          icon={<PenOneIcon size={20} />}
          aria-label={`Edit ${persona.name}`}
        />
        <Button variant="outline" size="sm">
          Use in chat
        </Button>
      </div>
    </div>
  )
}

// ── Received-share helpers ────────────────────────────────────────────────────

type ReceivedStatus = 'active' | 'expired' | 'limit-reached' | 'revoked'

function receivedShareStatus(share: ReceivedShareResponse): ReceivedStatus {
  if (!share.is_active)    return 'revoked'
  if (!share.is_available) return share.credit_limit !== null && share.credit_used >= share.credit_limit ? 'limit-reached' : 'expired'
  return 'active'
}

const RECEIVED_STATUS_BADGE: Record<ReceivedStatus, { color: 'Green' | 'Red' | 'Yellow' | 'Neutral'; label: string }> = {
  'active':        { color: 'Green',   label: 'Active'        },
  'expired':       { color: 'Neutral', label: 'Expired'       },
  'limit-reached': { color: 'Red',     label: 'Limit reached' },
  'revoked':       { color: 'Neutral', label: 'Revoked'       },
}

function fmtExpiry(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Super Links helpers ───────────────────────────────────────────────────────

function fmtK(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}

const SL_COLORS = ['#7C3AED', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#6366F1']

function colorFromName(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return SL_COLORS[h % SL_COLORS.length]
}

function shareStatus(share: PersonaShare): SuperLinkStatus {
  if (!share.is_active) return 'revoked'
  if (share.credit_limit !== null && share.credit_used >= share.credit_limit) return 'limit-reached'
  return 'active'
}

const SENT_STATUS_BADGE: Record<SuperLinkStatus, { color: 'Green' | 'Neutral' | 'Red'; label: string }> = {
  'active':        { color: 'Green',   label: 'Active'        },
  'paused':        { color: 'Neutral', label: 'Paused'        },
  'limit-reached': { color: 'Red',     label: 'Limit reached' },
  'revoked':       { color: 'Neutral', label: 'Revoked'       },
}

function fmtRelative(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diffMin = Math.floor((Date.now() - then) / 60_000)
  if (diffMin < 1)  return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24)  return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 30) return `${diffDay}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Self-contained copy-to-clipboard icon button — owns its own "copied" flash
// state so table rows don't need per-row state tracking in the parent.
function CopyUrlButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    try { void navigator.clipboard?.writeText(url) } catch { /* ignore */ }
    setCopied(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Tooltip content={copied ? 'Copied!' : 'Copy link URL'} side="top">
      <IconButton
        aria-label={copied ? 'Link copied' : 'Copy link URL'}
        size="xs"
        variant="ghost"
        onClick={handleCopy}
        icon={copied ? <TickTwoIcon size={14} /> : <CopyOneIcon size={14} />}
      />
    </Tooltip>
  )
}

// ── /org/plans visual system — mirrored here so the Super Links tab reads as
// one system with the rest of the org settings shell (SectionCard/StatTile,
// same shadow constants, non-uppercase section titles) instead of the
// generic StatCard/var(--shadow-surface-card) chrome used elsewhere. ────────

const SHADOW_CARD = '0px 2px 2.8px 0px rgba(82,75,71,0.12)'                                    // bordered section card
const SHADOW_TILE = '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)' // white inner tile

/** White stat tile — label / value / sub. Ditto /org/plans' StatTile. */
function StatTile({
  label,
  value,
  sub,
}: {
  label:  string
  value?: string | number
  sub?:   string
}) {
  return (
    <div style={{
      background:    'var(--neutral-white, #fff)',
      borderRadius:  8,
      padding:       12,
      boxShadow:     SHADOW_TILE,
      display:       'flex',
      flexDirection: 'column',
      gap:           6,
      flex:          '1 1 200px',
      minWidth:      160,
    }}>
      <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
        {label}
      </p>
      {value !== undefined && (
        <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
          {value}
        </p>
      )}
      {sub && (
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
          {sub}
        </p>
      )}
    </div>
  )
}

/** Bordered section card with a header row (title / subtitle / action). Ditto /org/plans' SectionCard. */
function SectionCard({
  title,
  subtitle,
  action,
  children,
  bodyPadding = '12px 24px',
  bodyGap,
}: {
  title:        string
  subtitle?:    string
  action?:      React.ReactNode
  children:     React.ReactNode
  bodyPadding?: string
  bodyGap?:     number
}) {
  return (
    <div style={{
      border:        '1px solid var(--neutral-200)',
      borderRadius:  16,
      boxShadow:     SHADOW_CARD,
      display:       'flex',
      flexDirection: 'column',
      gap:           12,
      paddingTop:    12,
      paddingBottom: 12,
      overflow:      'hidden',
      width:         '100%',
    }}>
      {/* Header padding-top is 12 (not 0) specifically to offset the outer
          card's own paddingTop:12 above — so the total gap from the card's
          top edge to the title (12+12=24) matches the gap from the title's
          bottom edge to the divider (24), making the title/action row
          actually centered in the header's visual space, not just centered
          relative to whichever sibling (e.g. the Tabs) happens to be taller. */}
      <div style={{
        borderBottom: '1px solid var(--neutral-100)',
        padding:      '12px 24px 24px',
        display:      'flex',
        alignItems:   'center',
        gap:          12,
      }}>
        <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
            {title}
          </p>
          {subtitle && (
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
              {subtitle}
            </p>
          )}
        </div>
        {action}
      </div>
      <div style={{ padding: bodyPadding, display: 'flex', flexDirection: 'column', gap: bodyGap }}>
        {children}
      </div>
    </div>
  )
}

function toDrawerLink(
  share: PersonaShare,
  personaName: string,
  avatarUrl: string | null,
  repoId: string,
  dailyTokens: number[],
): SuperLinkDrawerLink {
  const recipients = share.recipients ?? []
  const conversations = recipients.length
  const uniqueUsers = new Set(recipients.map(r => r.recipient_user_id)).size
  const tokensPerConvo = conversations > 0 ? Math.round(share.credit_used / conversations) : 0
  const sessions: SuperLinkDrawerSession[] = recipients.map(r => ({
    id:       r.recipient_user_id,
    time:     r.accepted_at,
    messages: r.message_count,
    tokens:   r.credit_used,
    status:   r.is_active ? 'active' : 'ended',
  }))
  return {
    id:             share.id,
    personaName,
    avatarColor:    colorFromName(personaName),
    avatarUrl,
    repoId,
    url:            canonicalShareUrl(share.share_url).replace(/^https?:\/\//, ''),
    tokenUsed:      share.credit_used,
    tokenLimit:     share.credit_limit ?? 0,
    conversations,
    uniqueUsers,
    tokensPerConvo,
    lastUsedAt:     share.updated_at ?? share.created_at,
    status:         shareStatus(share),
    dailyTokens,
    sessions,
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PersonasPage() {
  const { push } = useRouter()
  const pathname = usePathname()
  const { close: closePinboard } = usePinboard()
  const { currentUserRole, orgId, teams, members } = useOrg()
  const { user } = useAuth()
  // `user?.id` is never populated (see resolveViewerUserId) — resolve the
  // viewer's internal id via the org member list instead, so ownership checks
  // below actually match against `personaOwnerMap`'s id space.
  const viewerUserId = resolveViewerUserId(members, user?.email)

  // repoId -> the persona's actual creator (from the team-persona-shares
  // endpoint, which already tracks this for the "Shared by X" org/teams panel).
  // `currentUserRole` is an ORG-WIDE role, not per-persona ownership — using it
  // alone would treat every admin as if they owned every admin-created
  // team-shared agent, not just their own. Falls back to that coarse check only
  // until this authoritative map has loaded, to avoid a flash for real owners.
  const [personaOwnerMap, setPersonaOwnerMap] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!orgId || teams.length === 0) return
    let cancelled = false
    fetchPersonaOwnerMap(orgId, teams.map(t => t.id)).then(map => { if (!cancelled) setPersonaOwnerMap(map) })
    return () => { cancelled = true }
  }, [orgId, teams])

  function isOwnedByMe(persona: Persona): boolean {
    return isPersonaOwnedByViewer(persona, personaOwnerMap, viewerUserId, currentUserRole === 'admin')
  }

  const [activeTab,    setActiveTab]    = useState<TabId>('my-personas')
  const [personas,     setPersonas]     = useState<Persona[]>([])
  const [draftAvatarMap,   setDraftAvatarMap]   = useState<Record<string, string>>({})
  const [draftTagsMap,     setDraftTagsMap]     = useState<Record<string, string[]>>({})
  const [unpublishedMap,   setUnpublishedMap]   = useState<Record<string, boolean>>({})
  const [isLoading,    setIsLoading]    = useState(true)
  const [search,       setSearch]       = useState('')
  const [sort,         setSort]         = useState<SortKey>('activity')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'paused'>('all')
  const [filters,      setFilters]      = useState<AgentFilters>(EMPTY_FILTERS)
  const [sortOpen,      setSortOpen]      = useState(false)
  const [allOpen,       setAllOpen]       = useState(false)
  const [filterOpen,    setFilterOpen]    = useState(false)
  const [deleteTarget,  setDeleteTarget]  = useState<Persona | null>(null)
  const mounted = useMounted()
  const [allSharesForFilter, setAllSharesForFilter] = useState<PersonaShare[]>([])
  const [availableModels,    setAvailableModels]    = useState<AIModel[]>([])
  const filterSharesLoadedRef = useRef(false)
  const [panelGenOpen,  setPanelGenOpen]  = useState(false)

  // Super Links state
  const [dashboard,          setDashboard]          = useState<ShareDashboardResponse | null>(null)
  // Defaults true (not false) so the tab's zero-links empty state can't flash
  // on first mount before the fetch effect has a chance to set it — dashboard
  // is null and totalLinks resolves to 0 on that very first render otherwise,
  // which would incorrectly read as "confirmed empty" for a frame.
  const [sharesLoading,      setSharesLoading]      = useState(true)
  const [dashboardRefreshing, setDashboardRefreshing] = useState(false)
  const [selectedShareId,    setSelectedShareId]    = useState<string | null>(null)
  const [slRange,            setSlRange]            = useState<'7d' | '30d' | '90d'>('30d')
  // "My Superlinks" (outgoing) vs "Shared Superlinks" (incoming) sub-tab —
  // replaces the old side-by-side two-column layout with a single switchable table.
  const [superLinksView,     setSuperLinksView]     = useState<'mine' | 'shared'>('mine')

  // Derived from slRange — used in both the fetch effect and the chart section
  const slDays = slRange === '7d' ? 7 : slRange === '90d' ? 90 : 30

  // Received shares from /persona-shares/received — rendered as the "Shared
  // with me" section inside the Super Links tab (merged in from the former
  // standalone "Shared" tab; the "with-others" half of that tab was dropped
  // entirely since it only duplicated the Links panel/table already on this
  // page — same underlying GET /persona-shares data, just a simpler card view).
  const [receivedShares,   setReceivedShares]   = useState<ReceivedShareResponse[]>([])
  const [receivedLoading,  setReceivedLoading]  = useState(false)

  // Close the pinboard whenever the personas page is mounted.
  useEffect(() => { closePinboard() }, [closePinboard])

  // Re-fetch whenever this page becomes the active route so navigating back
  // from configure always shows the latest avatar / state. No bustPersonasCache()
  // here — every configure mutation (save/publish/delete/share) already busts
  // the cache at its own call site and that bust already re-fetches via the
  // PERSONAS_LIST_UPDATED_EVENT listener below, so forcing another bust on
  // every mount just re-pays the fetch cost (incl. the owner-map + copy-
  // resolution chain) even when nothing changed. The 30s TTL cache covers the
  // "didn't mutate anything, just navigated back" case.
  useEffect(() => {
    if (pathname !== '/agents') return
    setIsLoading(true)
    ;(async () => {
      try {
        const list = await fetchPersonas()
        setPersonas(list)

        // Build tag/avatar overrides from sessionStorage (current-session edits) with
        // localStorage as cross-session fallback for tags. Only non-empty values are stored
        // so stale empty arrays never shadow real API data via the ?? operator.
        const avatarOverrides:      Record<string, string>   = {}
        const tagOverrides:         Record<string, string[]> = {}
        for (const p of list) {
          try {
            const raw = sessionStorage.getItem(personaProfileKey(p.id))
            const draft = JSON.parse(raw ?? 'null') as Record<string, unknown> | null
            const draftAvatar = draft?.avatarUrl as string | undefined
            let   draftTags   = draft?.personaTags as string[] | undefined
            // sessionStorage clears on tab/session close — fall back to localStorage
            // which the profile tab also writes on every tag change.
            if (!Array.isArray(draftTags) || draftTags.length === 0) {
              try {
                const lsRaw = localStorage.getItem(personaTagsKey(p.id))
                const lsTags = JSON.parse(lsRaw ?? 'null') as string[] | null
                if (Array.isArray(lsTags) && lsTags.length > 0) draftTags = lsTags
              } catch { /* ignore */ }
            }
            if (typeof draftAvatar === 'string' && draftAvatar) avatarOverrides[p.id] = draftAvatar
            if (Array.isArray(draftTags) && draftTags.length > 0) tagOverrides[p.id]  = draftTags
          } catch { /* ignore quota / parse errors */ }
        }
        setDraftAvatarMap(avatarOverrides)
        setDraftTagsMap(tagOverrides)
        setUnpublishedMap({})
      } catch (err) {
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    })()
  }, [pathname])

  // Re-fetch when another part of the app busts the personas cache (e.g. configure tab after save/delete).
  useEffect(() => {
    if (pathname !== '/agents') return
    // Guards against out-of-order responses when multiple busts fire in quick
    // succession (e.g. deleting several agents back-to-back): only the
    // most-recently-triggered fetch's result is ever applied to state, so a
    // slower, earlier response can't clobber a newer one.
    let requestId = 0
    const handler = () => {
      const thisRequest = ++requestId
      fetchPersonas()
        .then(list => { if (thisRequest === requestId) setPersonas(list) })
        .catch(console.error)
    }
    window.addEventListener(PERSONAS_LIST_UPDATED_EVENT, handler)
    return () => window.removeEventListener(PERSONAS_LIST_UPDATED_EVENT, handler)
  }, [pathname])

  // Fetch dashboard whenever the super-links tab is active or the date range changes.
  // No bustPersonasCache() — same reasoning as the mount effect above; the
  // TTL cache and the mutation-triggered event listener already keep
  // `personas` fresh without forcing a full re-fetch on every tab switch.
  useEffect(() => {
    if (activeTab !== 'super-links') return
    setSharesLoading(true)
    Promise.all([fetchDashboard(slDays), fetchPersonas()])
      .then(([dash, allPersonas]) => {
        setDashboard(dash)
        setPersonas(allPersonas)
      })
      .catch(console.error)
      .finally(() => setSharesLoading(false))
  }, [activeTab, pathname, slDays])

  // Manual refresh — usage numbers (credit_used/pct_used) on a recipient's
  // Super Link only change on the backend as they use the shared agent; there's
  // no push/poll here, so this button re-pulls the dashboard on demand.
  const handleRefreshDashboard = useCallback(() => {
    setDashboardRefreshing(true)
    bustPersonasCache()
    fetchDashboard(slDays)
      .then(setDashboard)
      .catch(console.error)
      .finally(() => setDashboardRefreshing(false))
  }, [slDays])

  // Fetch received shares whenever the Super Links tab becomes active — they
  // render as that tab's "Shared with me" section.
  useEffect(() => {
    if (activeTab !== 'super-links') return
    setReceivedLoading(true)
    listReceived()
      .then(setReceivedShares)
      .catch(console.error)
      .finally(() => setReceivedLoading(false))
  }, [activeTab, pathname])

  // Silently load all shares + models once for the filter panel.
  // The super-links tab has its own loading effect that will overwrite shares on activation.
  useEffect(() => {
    if (activeTab !== 'my-personas' || filterSharesLoadedRef.current) return
    filterSharesLoadedRef.current = true
    listShares()
      .then(setAllSharesForFilter)
      .catch(() => {})
    fetchModelsWithCache()
      .then(setAvailableModels)
      .catch(() => {})
  }, [activeTab])

  // Map share persona_id → persona info.
  // Indexed by BOTH activeVersionId (version frozen at publish time) and repo id
  // so a match is found regardless of whether the share was created before or
  // after the last republish.
  const versionToPersona = useMemo(() => {
    const map: Record<string, { name: string; imageUrl: string | null; repoId: string }> = {}
    for (const p of personas) {
      const entry = { name: p.name, imageUrl: p.imageUrl, repoId: p.id }
      if (p.activeVersionId) map[p.activeVersionId] = entry
      map[p.id] = entry
    }
    return map
  }, [personas])

  // Shares derived from the dashboard — already filtered to link-type by the backend.
  const shares = useMemo(
    () => (dashboard?.links ?? []).filter(s => s.share_type === 'link'),
    [dashboard],
  )

  // Build the drawer link object for the currently selected share.
  const selectedDrawerLink = useMemo((): SuperLinkDrawerLink | null => {
    if (!selectedShareId) return null
    const share = shares.find(s => s.id === selectedShareId)
    if (!share) return null
    const personaInfo = versionToPersona[share.persona_id]
    const name     = share.persona_name ?? personaInfo?.name     ?? 'Agent'
    const imageUrl = personaInfo?.imageUrl ?? null
    const repoId   = personaInfo?.repoId ?? ''
    const dailyTokens = (dashboard?.daily ?? []).map(d => d.credits)
    return toDrawerLink(share, name, imageUrl, repoId, dailyTokens)
  }, [selectedShareId, shares, versionToPersona, dashboard])

  // Lookup map for shared-tab — keyed by persona repo id for actions/navigation.
  const personaByRepoId = useMemo(() => {
    const map: Record<string, Persona> = {}
    for (const p of personas) map[p.id] = p
    return map
  }, [personas])

  // Set of persona repo IDs that have at least one active super link.
  const activeShareRepoIds = useMemo(() => {
    const s = new Set<string>()
    for (const share of allSharesForFilter) {
      if (!share.is_active || share.share_type !== 'link') continue
      const info = versionToPersona[share.persona_id]
      if (info?.repoId) s.add(info.repoId)
      else s.add(share.persona_id)
    }
    return s
  }, [allSharesForFilter, versionToPersona])

  // Visibility comes from the persona repo itself. Super Links are a separate
  // sharing surface and are handled by the Super Link filter below.
  const visibilityForPersona = useMemo(() => {
    const map: Record<string, 'private' | 'team' | 'community'> = {}
    for (const p of personas) {
      map[p.id] = p.visibility
    }
    return map
  }, [personas])

  // Map from stable model ID → human-readable model name (from the API models list).
  const modelIdToName = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of availableModels) {
      const key = String(m.modelId ?? m.id ?? '')
      if (key) map.set(key, m.modelName)
    }
    return map
  }, [availableModels])

  function resolveModelName(modelId: string | null): string | null {
    if (!modelId) return null
    return modelIdToName.get(modelId) ?? modelDisplayName(modelId)
  }

  // Unique model display names present in the current persona list.
  const uniqueModelNames = useMemo(() => {
    const names = new Set<string>()
    for (const p of personas) {
      const name = resolveModelName(p.modelId)
      if (name) names.add(name)
    }
    return [...names].sort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personas, modelIdToName])

  const activeFilterCount =
    filters.status.size + filters.visibility.size + filters.superLink.size + filters.models.size

  function toggleFilter<K extends keyof AgentFilters>(key: K, value: string) {
    setFilters(prev => {
      const next = new Set(prev[key]) as Set<string>
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return { ...prev, [key]: next }
    })
  }

  // Team-shared agents the caller doesn't own aren't "theirs" yet — they only
  // belong on this page once cloned (via the project Team panel's "Use" action,
  // or the chat persona picker). Until then they live only in the team panel,
  // not mixed into this personal library.
  const visiblePersonas = useMemo(
    () => personas.filter(p => p.visibility !== 'team' || isOwnedByMe(p)),
    [personas, currentUserRole, personaOwnerMap, viewerUserId],
  )

  // Filter + sort — split into three chained memos so a sort change doesn't
  // re-run filtering, and a filter change doesn't re-run the sort.
  const statusFiltered = useMemo(() => {
    // Pause is a binary backend flag (is_active). "Active" = not paused (covers
    // live + draft that are switched on); "Paused" = is_active false. This is a
    // clean partition and matches the pause toggle exactly.
    if (filterStatus === 'active') return visiblePersonas.filter(p => !p.isPaused)
    if (filterStatus === 'paused') return visiblePersonas.filter(p => p.isPaused)
    return visiblePersonas
  }, [visiblePersonas, filterStatus])

  const filterPanelFiltered = useMemo(() => {
    let result = statusFiltered

    if (filters.status.size > 0) {
      result = result.filter(p => {
        // Paused is exclusive: a paused agent shows only under "Paused", never
        // under Live/Draft (the !hasSystemInstructions heuristic must not leak it).
        if (filters.status.has('live')   && !p.isPaused && p.status === 'active') return true
        if (filters.status.has('draft')  && !p.isPaused && (p.status === 'draft' || !p.hasSystemInstructions)) return true
        if (filters.status.has('paused') && p.isPaused) return true
        return false
      })
    }

    if (filters.visibility.size > 0) {
      result = result.filter(p => filters.visibility.has(visibilityForPersona[p.id] ?? 'private'))
    }

    if (filters.superLink.size > 0) {
      result = result.filter(p => {
        const hasLink = activeShareRepoIds.has(p.id)
        if (filters.superLink.has('has-link') && hasLink)  return true
        if (filters.superLink.has('no-link')  && !hasLink) return true
        return false
      })
    }

    if (filters.models.size > 0) {
      result = result.filter(p => {
        const name = resolveModelName(p.modelId)
        return name !== null && filters.models.has(name)
      })
    }

    return result
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFiltered, filters, visibilityForPersona, activeShareRepoIds, modelIdToName])

  const filtered = useMemo(() => {
    const searched = search.trim()
      ? filterPanelFiltered.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
      : filterPanelFiltered
    if (sort === 'az') return searched.toSorted((a, b) => a.name.localeCompare(b.name))
    if (sort === 'za') return searched.toSorted((a, b) => b.name.localeCompare(a.name))
    return searched
  }, [filterPanelFiltered, search, sort])

  const personasScrollRef = useRef<HTMLDivElement>(null)
  const GRID_COLS = 3
  const gridRows = useMemo(() => {
    const rows: typeof filtered[] = []
    for (let i = 0; i < filtered.length; i += GRID_COLS) rows.push(filtered.slice(i, i + GRID_COLS))
    return rows
  }, [filtered])
  const gridVirtualizer = useVirtualizer({
    count:            gridRows.length,
    getScrollElement: () => personasScrollRef.current,
    estimateSize:     () => 172,
    overscan:         2,
  })

  const sortLabels: Record<SortKey, string> = {
    activity: 'Activity',
    az:       'A to Z',
    za:       'Z to A',
  }

  async function handleDelete(id: string, name?: string) {
    try {
      // deletePersona() already busts the cache itself — a second bust here
      // was redundant and doubled the number of PERSONAS_LIST_UPDATED_EVENT
      // re-fetches fired per delete, making the rapid-delete race easier to
      // hit in the first place.
      await deletePersona(id)
      setPersonas(prev => prev.filter(p => p.id !== id))
      setReceivedShares(prev => prev.filter(s => s.persona_repo_id !== id))
      toast.success(name ? `"${name}" deleted` : 'Agent deleted')
    } catch (err) {
      console.error('Failed to delete persona:', err)
      toast.error('Failed to delete agent. Please try again.')
    }
  }

  async function handleCopyAndEdit(persona: Persona) {
    const toastId = toast.loading(`Copying "${persona.name}"…`)
    try {
      const copy = await usePersonaRepoDeduped(persona.id, persona.activeVersionId)
      toast.dismiss(toastId)
      push(AGENT_CONFIGURE_INSTRUCTIONS_ROUTE(copy.id, { name: persona.name }))
    } catch {
      toast.dismiss(toastId)
      toast.error('Failed to copy agent. Please try again.')
    }
  }

  // Team-shared originals aren't owned by this account, so the dedicated chat
  // route 404s on them directly (backend chat-creation is owner-only). Clone
  // into the member's own account first — same as handleCopyAndEdit — then
  // land on that copy's chat page instead of the original's.
  async function handleUseTeamSharedInChat(persona: Persona) {
    const toastId = toast.loading(`Opening "${persona.name}"…`)
    try {
      const copy = await usePersonaRepoDeduped(persona.id, persona.activeVersionId)
      toast.dismiss(toastId)
      push(AGENT_CHAT_ROUTE(copy.id))
    } catch {
      toast.dismiss(toastId)
      toast.error('Failed to open agent. Please try again.')
    }
  }

  async function handlePauseToggle(id: string, name: string, currentlyPaused: boolean) {
    // Guardrail: only published agents (those with a live version) can be paused.
    // An unpublished draft has nothing live to pause, so block it with guidance.
    if (!currentlyPaused) {
      const target = personas.find(p => p.id === id)
      if (target && !target.activeVersionId) {
        toast.error('Publish this agent before pausing it.')
        return
      }
    }
    try {
      await togglePause(id)
      setPersonas(prev => prev.map(p => {
        if (p.id !== id) return p
        const nextActive = p.isPaused // was paused → resuming
        // Keep status/isPaused in sync so the dropdown + filter panel reflect
        // pause/resume immediately. Paused == !is_active (takes precedence);
        // when resuming, fall back to live/draft based on the published version.
        const nextStatus = !nextActive
          ? 'paused'
          : p.activeVersionId ? 'active' : 'draft'
        return {
          ...p,
          isActive: nextActive,
          // Invariant: isPaused === !isActive === (status === 'paused').
          isPaused: !nextActive,
          status: nextStatus,
        }
      }))
      toast.success(currentlyPaused ? `"${name}" resumed` : `"${name}" paused`)
    } catch (err) {
      console.error('Failed to toggle pause:', err)
      toast.error(`Failed to ${currentlyPaused ? 'resume' : 'pause'} agent. Please try again.`)
    }
  }

  return (
    <>
      <div
        style={{
          background: 'rgba(255,255,255,0.2)',
          border: '1px solid var(--neutral-200)',
          borderRadius: 22,
          flex: '1 1 0',
          minHeight: 0,
          overflow: 'hidden',
          padding: 3,
        }}
      >
      <div
        ref={personasScrollRef}
        className="kaya-scrollbar"
        style={{
          height: '100%',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          paddingTop: 36,
          paddingBottom: 24,
          boxSizing: 'border-box',
        }}
      >
        {/* Horizontal padding lives here, not on the scrolling element above —
            keeps the scrollbar flush with the card's edge. */}
        <div style={{
          width: '100%',
          maxWidth: 991,
          padding: '0 12px',
          boxSizing: 'border-box',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 41,
        }}>

          {/* ── Header + Tabs + Toolbar ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Tabs — always on top */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)}>
              <Tabs.List>
                <Tabs.Trigger value="my-personas">My Agents</Tabs.Trigger>
                <Tabs.Trigger value="team-agents">Team Agents</Tabs.Trigger>
                <Tabs.Trigger value="super-links">Super Links</Tabs.Trigger>
                {/* <Tabs.Trigger value="community" disabled>Community</Tabs.Trigger> */}
              </Tabs.List>
            </Tabs>

            {/* Title row — changes per tab */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h1 style={{
                fontFamily: 'var(--font-title)',
                fontWeight: 'var(--font-weight-regular)',
                fontSize: 24,
                lineHeight: '32px',
                color: '#1a1916',
                margin: 0,
              }}>
                {activeTab === 'super-links'
                  ? 'Super Links'
                  : activeTab === 'team-agents'
                    ? 'Team Agents'
                    : 'Agents'}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Super Links' own "Generate link" trigger now lives with the
                    links list section below (where it's contextually useful),
                    instead of being duplicated here too. */}
                {activeTab === 'super-links' || activeTab === 'team-agents' ? null : (
                  <Button
                    variant="default"
                    leftIcon={<PlusSignIcon size={16} />}
                    onClick={() => push(AGENTS_TEMPLATES_ROUTE)}
                  >
                    New agent
                  </Button>
                )}
              </div>
            </div>

            {/* Toolbar — only shown on My Personas tab */}
            {activeTab === 'my-personas' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* Status filter */}
                  <Dropdown.Float
                    open={allOpen}
                    onOpenChange={setAllOpen}
                    placement="bottom-start"
                    trigger={
                      <Button variant="secondary" rightIcon={<ArrowDownOneIcon size={16} />}>
                        {filterStatus === 'all' ? 'All' : filterStatus === 'active' ? 'Active' : 'Paused'}
                      </Button>
                    }
                  >
                    <Dropdown>
                      <Dropdown.Section>
                        <Dropdown.Item label="All"    selected={filterStatus === 'all'}    onClick={() => { setFilterStatus('all');    setAllOpen(false) }} fluid />
                        <Dropdown.Item label="Active" selected={filterStatus === 'active'} onClick={() => { setFilterStatus('active'); setAllOpen(false) }} fluid />
                        <Dropdown.Item label="Paused" selected={filterStatus === 'paused'} onClick={() => { setFilterStatus('paused'); setAllOpen(false) }} fluid />
                      </Dropdown.Section>
                    </Dropdown>
                  </Dropdown.Float>

                  {/* Search */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    padding: '7px 10px',
                    borderRadius: 10,
                    background: 'white',
                    boxShadow: '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
                    width: 450,
                  }}>
                    <SearchOneIcon size={16} style={{ color: 'var(--neutral-500)', flexShrink: 0 }} />
                    <input
                      type="text"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search agent"
                      style={{
                        flex: '1 0 0',
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        fontFamily: 'var(--font-body)',
                        fontWeight: 'var(--font-weight-regular)',
                        fontSize: 14,
                        lineHeight: '22px',
                        color: 'var(--neutral-600)',
                        padding: '0 2px',
                      }}
                    />
                    {search && (
                      <button
                        type="button"
                        aria-label="Clear search"
                        onClick={() => setSearch('')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'none',
                          border: 'none',
                          padding: 2,
                          cursor: 'pointer',
                          color: 'var(--neutral-400)',
                          flexShrink: 0,
                          borderRadius: 4,
                        }}
                      >
                        <CancelOneIcon size={12} />
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* Sort dropdown */}
                  <Dropdown.Float
                    open={sortOpen}
                    onOpenChange={setSortOpen}
                    placement="bottom-end"
                    trigger={
                      <Button variant="secondary">
                        Sort by : {sortLabels[sort]}
                      </Button>
                    }
                  >
                    <Dropdown>
                      <Dropdown.Section>
                        {(['activity', 'az', 'za'] as SortKey[]).map(k => (
                          <Dropdown.Item
                            key={k}
                            label={sortLabels[k]}
                            selected={sort === k}
                            onClick={() => { setSort(k); setSortOpen(false) }}
                            fluid
                          />
                        ))}
                      </Dropdown.Section>
                    </Dropdown>
                  </Dropdown.Float>

                  {/* Filter dropdown */}
                  <Dropdown.Float
                    open={filterOpen}
                    onOpenChange={setFilterOpen}
                    placement="bottom-end"
                    trigger={
                      <Button
                        variant={activeFilterCount > 0 ? 'default' : 'secondary'}
                        leftIcon={<FilterMailIcon animated />}
                      >
                        {activeFilterCount > 0 ? `Filter (${activeFilterCount})` : 'Filter'}
                      </Button>
                    }
                  >
                    <Dropdown style={{ minWidth: 240 }}>
                      {/* Clear all — only shown when filters are active */}
                      {activeFilterCount > 0 && (
                        <Dropdown.Item
                          label="Clear all filters"
                          fluid
                          onClick={() => setFilters(EMPTY_FILTERS)}
                        />
                      )}

                      {/* Status */}
                      <Dropdown.Section label="Status">
                        {([
                          { id: 'live',   label: 'Live'   },
                          { id: 'draft',  label: 'Draft'  },
                          { id: 'paused', label: 'Paused' },
                        ] as const).map(({ id, label }) => (
                          <Dropdown.Item
                            key={id}
                            label={label}
                            fluid
                            showCheckbox
                            checkboxChecked={filters.status.has(id)}
                            onCheckboxChange={() => toggleFilter('status', id)}
                          />
                        ))}
                      </Dropdown.Section>

                      {/* Visibility */}
                      <Dropdown.Section label="Visibility">
                        {([
                          { id: 'private',   label: 'Private'   },
                          { id: 'team',      label: 'Team'      },
                          { id: 'community', label: 'Community' },
                        ] as const).map(({ id, label }) => (
                          <Dropdown.Item
                            key={id}
                            label={label}
                            fluid
                            showCheckbox
                            checkboxChecked={filters.visibility.has(id)}
                            onCheckboxChange={() => toggleFilter('visibility', id)}
                          />
                        ))}
                      </Dropdown.Section>

                      {/* Super Link */}
                      <Dropdown.Section label="Super Link">
                        {([
                          { id: 'has-link', label: 'Has active link' },
                          { id: 'no-link',  label: 'No link'         },
                        ] as const).map(({ id, label }) => (
                          <Dropdown.Item
                            key={id}
                            label={label}
                            fluid
                            showCheckbox
                            checkboxChecked={filters.superLink.has(id)}
                            onCheckboxChange={() => toggleFilter('superLink', id)}
                          />
                        ))}
                      </Dropdown.Section>

                      {/* Model — only shown when at least one persona has a model */}
                      {uniqueModelNames.length > 0 && (
                        <Dropdown.Section label="Model">
                          {uniqueModelNames.map(name => (
                            <Dropdown.Item
                              key={name}
                              label={name}
                              fluid
                              showCheckbox
                              checkboxChecked={filters.models.has(name)}
                              onCheckboxChange={() => toggleFilter('models', name)}
                            />
                          ))}
                        </Dropdown.Section>
                      )}
                    </Dropdown>
                  </Dropdown.Float>
                </div>
              </div>
              )}
          </div>

          {/* ── Persona grid ── */}
          {activeTab === 'my-personas' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {isLoading ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 314px)',
                  gap: 16,
                }}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} style={{
                      height: 140,
                      borderRadius: 16,
                      background: 'var(--neutral-100)',
                      animation: 'pulse 0.9s ease-in-out infinite',
                    }} />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                (search.trim() || activeFilterCount > 0) ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    padding: '80px 24px',
                  }}>
                    <p style={{
                      fontFamily: 'var(--font-body)',
                      fontWeight: 'var(--font-weight-regular)',
                      fontSize: 14,
                      lineHeight: '22px',
                      color: 'var(--neutral-500)',
                      textAlign: 'center',
                      margin: 0,
                    }}>
                      {search.trim()
                        ? `No agents matching “${search}”${activeFilterCount > 0 ? ' with the current filters' : ''}`
                        : 'No agents match your filters'}
                    </p>
                    {activeFilterCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setFilters(EMPTY_FILTERS)}
                        style={{
                          background: 'none', border: '1px solid var(--neutral-200)',
                          borderRadius: 8, cursor: 'pointer', padding: '6px 14px',
                          fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500,
                          color: 'var(--neutral-600)',
                        }}
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 24,
                    padding: '48px 24px',
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                      <p style={{
                        fontFamily: 'var(--font-title)',
                        fontWeight: 'var(--font-weight-regular)',
                        fontSize: 24,
                        lineHeight: '32px',
                        color: '#1a1916',
                        margin: 0,
                        whiteSpace: 'nowrap',
                      }}>
                        No agents yet
                      </p>
                      <p style={{
                        fontFamily: 'var(--font-body)',
                        fontWeight: 'var(--font-weight-regular)',
                        fontSize: 16,
                        lineHeight: '22px',
                        color: '#1a1916',
                        textAlign: 'center',
                        maxWidth: 427,
                        margin: 0,
                      }}>
                        Agents are your custom AI configurations - define behavior, connect knowledge, and share via link.
                      </p>
                    </div>
                    <Button variant="default" onClick={() => push(AGENTS_TEMPLATES_ROUTE)}>
                      Create your first agent
                    </Button>
                  </div>
                )
              ) : (
                <div style={{ position: 'relative', height: gridVirtualizer.getTotalSize() }}>
                  {gridVirtualizer.getVirtualItems().map((vRow) => (
                    <div
                      key={vRow.index}
                      data-index={vRow.index}
                      ref={gridVirtualizer.measureElement}
                      style={{
                        position:            'absolute',
                        top:                 vRow.start,
                        left:                0,
                        width:               '100%',
                        display:             'grid',
                        // Match may-day: every card is a uniform 314px wide
                        // (caps at 314, shrinks equally on narrow widths) and the
                        // row is centred so cards never stretch unevenly.
                        gridTemplateColumns: 'repeat(3, minmax(0, 314px))',
                        justifyContent:      'center',
                        gap:                 16,
                        paddingBottom:       16,
                      }}
                    >
                      {gridRows[vRow.index].map(persona => (
                        <PersonaCard
                          key={persona.id}
                          // Fill the grid cell (the DS default is a fixed 314px,
                          // which overflows the 1fr cells) and stretch to the
                          // row's height so every card in a row is uniform — this
                          // also keeps the hover action bar over empty space
                          // instead of clipping the description.
                          style={{ width: '100%', height: '100%' }}
                          variant={persona.status === 'draft' || !persona.hasSystemInstructions || unpublishedMap[persona.id] ? 'draft' : 'default'}
                          avatarSeed={persona.activeVersionId ?? persona.workingVersionId ?? persona.id}
                          name={persona.name}
                          handle={persona.handle.replace(/^@/, '')}
                          description={
                            (persona.status === 'draft' || !persona.hasSystemInstructions || unpublishedMap[persona.id]) && !persona.description
                              ? 'Tap Edit to add a system instruction and publish this agent.'
                              : persona.description
                          }
                          avatarUrl={draftAvatarMap[persona.id] ?? persona.imageUrl ?? undefined}
                          tags={draftTagsMap[persona.id] ?? persona.tags}
                          paused={persona.isPaused}
                          shared={persona.sourceShareId !== null || (persona.visibility === 'team' && !isOwnedByMe(persona))}
                          modelVisible={Boolean(resolveModelName(persona.modelId))}
                          modelName={resolveModelName(persona.modelId) ?? undefined}
                          superlink={activeShareRepoIds.has(persona.id)}
                          visibility={visibilityForPersona[persona.id] === 'team' ? 'team' : visibilityForPersona[persona.id] === 'private' ? 'private' : undefined}
                          {...(() => {
                            // Team-shared originals not created by this user (regardless of
                            // their own org role) — they cannot edit/delete/share the
                            // original; they copy it first.
                            const isTeamShared = persona.visibility === 'team' && !isOwnedByMe(persona)
                            if (isTeamShared) return {
                              onEdit:            () => void handleCopyAndEdit(persona),
                              onUseInChat:       () => void handleUseTeamSharedInChat(persona),
                              onMenuDuplicate:   () => void handleCopyAndEdit(persona),
                            }
                            // Owned personas (private copies or admin's own team agents)
                            const isOwned = persona.sourceShareId === null
                            return {
                              onEdit:            isOwned ? () => { toast.success(`Editing "${persona.name}"`); push(AGENT_CONFIGURE_INSTRUCTIONS_ROUTE(persona.id, { name: persona.name })) } : undefined,
                              onLink:            isOwned ? () => { toast.info('Opening sharing settings…'); push(AGENT_CONFIGURE_SHARING_ROUTE(persona.id, { name: persona.name, versionId: persona.activeVersionId })) } : undefined,
                              onUseInChat:       () => push(AGENT_CHAT_ROUTE(persona.id)),
                              onResume:          isOwned ? () => handlePauseToggle(persona.id, persona.name, persona.isPaused) : undefined,
                              onMenuEdit:        isOwned ? () => { toast.success(`Editing "${persona.name}"`); push(AGENT_CONFIGURE_INSTRUCTIONS_ROUTE(persona.id, { name: persona.name })) } : undefined,
                              onMenuShare:       isOwned ? () => { toast.info('Opening sharing settings…'); push(AGENT_CONFIGURE_SHARING_ROUTE(persona.id, { name: persona.name, versionId: persona.activeVersionId })) } : undefined,
                              onMenuPauseToggle: isOwned && (persona.activeVersionId !== null || persona.isPaused) ? () => handlePauseToggle(persona.id, persona.name, persona.isPaused) : undefined,
                              onMenuDelete:      () => setDeleteTarget(persona),
                            }
                          })()}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Team Agents tab ── */}
          {activeTab === 'team-agents' && (
            <TeamAgentsTab />
          )}

          {/* ── Recommended for you ── (hidden) */}

          {/* ── Super Links tab ── */}
          {activeTab === 'super-links' && (() => {
            const summary      = dashboard?.summary
            const creditsMonth = summary?.credits_this_month ?? 0
            const estimatedCost = parseFloat((creditsMonth / 1_000_000 * 3).toFixed(2))
            const totalLinks   = summary?.total_links ?? shares.length
            const isEmpty      = !sharesLoading && totalLinks === 0
            // Honest placeholder when there isn't enough daily granularity yet
            // (Sparkline needs >=2 points) — flat zeros, never fabricated
            // activity. Only reached once the user has at least one real link
            // (the fully-empty case short-circuits to the empty state below).
            const sparkData: number[] = dashboard && dashboard.daily.length >= 2
              ? dashboard.daily.map(d => d.credits)
              : Array(Math.max(slDays, 2)).fill(0)

            // Widths sized to what each cell's content actually needs at
            // minimum (e.g. "Limit reached" badge, "Jul 24, 2026" expiry,
            // a single icon button) rather than arbitrary round numbers —
            // the previous columns were tighter than their own content,
            // which overflowed into neighboring cells instead of eliding.
            const MY_LINKS_COLUMNS = 'minmax(220px, 1.6fr) 116px minmax(150px, 1fr) minmax(150px, 1fr) 112px 64px'
            const SHARED_LINKS_COLUMNS = 'minmax(190px, 1.3fr) minmax(150px, 1fr) 116px minmax(150px, 1fr) 112px 196px'

            // Date-range label for the stat box footer — dropped during the
            // /org/plans revamp when the page-header DateRangePill was
            // removed as a redundant duplicate of the 7d/30d/90d Tabs; it
            // still belongs somewhere as a plain "as of" readout, just not
            // duplicated next to an already-interactive control.
            const slToday    = new Date()
            const slFromDate = new Date(slToday)
            slFromDate.setDate(slToday.getDate() - slDays)
            const fmtSl = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            const slDateRangeLabel = `${fmtSl(slFromDate)} – ${fmtSl(slToday)}`

            // "Most active agent" — fills the space the stat box leaves
            // below it now that it's no longer stretched to match the
            // chart's height. Ranked by conversation count (recipients),
            // same data already used for each table row's activity column.
            const topShare = shares.length > 0
              ? [...shares].sort((a, b) => (b.recipients?.length ?? 0) - (a.recipients?.length ?? 0))[0]
              : null
            const topAgentInfo   = topShare ? versionToPersona[topShare.persona_id] : null
            const topAgentName   = topShare ? (topShare.persona_name ?? topAgentInfo?.name ?? 'Agent') : null
            const topAgentConvos = topShare?.recipients?.length ?? 0

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

                {/* ── Stat tiles (2x2) on the left, chart on the right — "my"
                    outgoing usage summary. Hidden entirely when there are no
                    outgoing links yet, regardless of which sub-tab below is
                    selected. ── */}
                {!isEmpty && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'stretch' }}>
                    {/* Left — one bordered box ditto /org/analytics' Credit
                        Pool/Used/Members row (neutral-200 border, SHADOW_CARD,
                        neutral-50 background, 12px padding), containing BOTH
                        the 4-tile 2x2 grid and the "Most active agent" tile.
                        alignItems: 'stretch' on the outer grid makes this
                        whole box match the chart card's height — the agent
                        tile grows (flex: 1) to absorb the difference instead
                        of the StatTiles themselves being distorted taller. */}
                    <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 16, boxShadow: SHADOW_CARD, overflow: 'hidden', backgroundColor: 'var(--neutral-50)', padding: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 9, flexShrink: 0 }}>
                        <StatTile
                          label="Credits this month"
                          value={fmtK(creditsMonth)}
                          sub="across all links"
                        />
                        <StatTile
                          label="Conversations"
                          value={summary?.conversations ?? 0}
                          sub="total sessions"
                        />
                        <StatTile
                          label="Active links"
                          value={summary?.active_links ?? 0}
                          sub={`of ${summary?.total_links ?? 0} total`}
                        />
                        <StatTile
                          label="Est. cost"
                          value={`$${estimatedCost.toFixed(2)}`}
                          sub="creator-pays"
                        />
                      </div>

                      {topShare && (
                        <div style={{ backgroundColor: 'var(--neutral-white)', borderRadius: 8, padding: 12, boxShadow: SHADOW_TILE, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
                            Most active agent
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            {topAgentInfo?.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element -- remote/user-supplied avatar URL
                              <img src={topAgentInfo.imageUrl} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                            ) : (
                              <Avatar name={topAgentName ?? 'Agent'} color={colorFromName(topAgentName ?? 'Agent')} size="xs" />
                            )}
                            <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {topAgentName}
                            </p>
                          </div>
                          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
                            {topAgentConvos} conversation{topAgentConvos === 1 ? '' : 's'} · {fmtK(topShare.credit_used)} credits
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Right — chart, time-range readout sits in the header
                        space alongside the 7d/30d/90d Tabs. */}
                    <SectionCard
                      title="Credit usage · daily"
                      bodyPadding="0 24px 12px"
                      bodyGap={12}
                      action={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <DateRangePill label={slDateRangeLabel} />
                          <Tabs value={slRange} onValueChange={(v) => setSlRange(v as '7d' | '30d' | '90d')}>
                            <Tabs.List size="small">
                              <Tabs.Trigger value="7d">7d</Tabs.Trigger>
                              <Tabs.Trigger value="30d">30d</Tabs.Trigger>
                              <Tabs.Trigger value="90d">90d</Tabs.Trigger>
                            </Tabs.List>
                          </Tabs>
                        </div>
                      }
                    >
                      <span style={{
                        fontFamily: 'var(--font-title)',
                        fontSize:   'var(--font-size-heading)',
                        lineHeight: 'var(--line-height-heading)',
                        fontWeight: 'var(--font-weight-medium)',
                        color:      'var(--neutral-900)',
                      }}>
                        {fmtK(creditsMonth)}
                      </span>

                      {sharesLoading ? (
                        <div style={{ height: 180, borderRadius: 10, background: 'var(--neutral-100)', animation: 'pulse 0.9s ease-in-out infinite' }} />
                      ) : (
                        <Sparkline data={sparkData} height={180} />
                      )}
                    </SectionCard>
                  </div>
                )}

                {/* ── My Superlinks / Shared Superlinks — replaces the old
                    side-by-side two-column layout with a single switchable
                    table. "Shared Superlinks" stays fully independent of
                    whether you have any outgoing links yourself. ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Tabs value={superLinksView} onValueChange={(v) => setSuperLinksView(v as 'mine' | 'shared')}>
                    <Tabs.List size="small">
                      <Tabs.Trigger value="mine">My Superlinks</Tabs.Trigger>
                      <Tabs.Trigger value="shared">Shared Superlinks</Tabs.Trigger>
                    </Tabs.List>
                  </Tabs>

                  {superLinksView === 'mine' ? (
                    isEmpty ? (
                      <SuperLinksEmpty onBrowsePersonas={() => setActiveTab('my-personas')} />
                    ) : (
                      <SettingsTable columns={MY_LINKS_COLUMNS} columnGap={16}>
                        <SettingsTableToolbar title={sharesLoading ? 'Loading…' : `My Superlinks · ${totalLinks}`}>
                          <IconButton
                            variant="ghost"
                            size="sm"
                            aria-label="Refresh usage"
                            disabled={sharesLoading || dashboardRefreshing}
                            icon={dashboardRefreshing ? <Spinner size={14} /> : <RedoIcon size={14} />}
                            onClick={handleRefreshDashboard}
                          />
                          <Dropdown.Float
                            open={panelGenOpen}
                            onOpenChange={setPanelGenOpen}
                            placement="bottom-end"
                            trigger={
                              <Button size="sm" variant="secondary" leftIcon={<PlusSignIcon size={14} />}>
                                Generate link
                              </Button>
                            }
                          >
                            <Dropdown style={{ minWidth: 220 }}>
                              {visiblePersonas.length === 0 ? (
                                <Dropdown.Section>
                                  <Dropdown.Item label="No agents yet — create one first" disabled fluid />
                                </Dropdown.Section>
                              ) : (
                                <Dropdown.Section label="Select an agent">
                                  {visiblePersonas.map(p => (
                                    <Dropdown.Item
                                      key={p.id}
                                      label={p.name}
                                      onClick={() => {
                                        setPanelGenOpen(false)
                                        push(AGENT_CONFIGURE_SHARING_ROUTE(p.id, { name: p.name, versionId: p.activeVersionId }))
                                      }}
                                      fluid
                                    />
                                  ))}
                                </Dropdown.Section>
                              )}
                            </Dropdown>
                          </Dropdown.Float>
                        </SettingsTableToolbar>
                        <SettingsTableViewport minWidth={900} ariaLabel="My Super Links">
                          <SettingsTableHeader>
                            <SettingsTableHeaderCell>Agent</SettingsTableHeaderCell>
                            <SettingsTableHeaderCell>Status</SettingsTableHeaderCell>
                            <SettingsTableHeaderCell>Usage</SettingsTableHeaderCell>
                            <SettingsTableHeaderCell>Activity</SettingsTableHeaderCell>
                            <SettingsTableHeaderCell>Expires</SettingsTableHeaderCell>
                            <SettingsTableHeaderCell align="end">Actions</SettingsTableHeaderCell>
                          </SettingsTableHeader>

                          {sharesLoading && [0, 1, 2].map(i => (
                            <SettingsTableRow key={i} minHeight={64}>
                              <SettingsTableCell>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: 1 - i * 0.25 }}>
                                  <div className="kaya-skeleton" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                                  <div className="kaya-skeleton" style={{ width: 120, height: 14, borderRadius: 4 }} />
                                </div>
                              </SettingsTableCell>
                              {[0, 1, 2, 3, 4].map(ci => (
                                <SettingsTableCell key={ci}><div className="kaya-skeleton" style={{ width: 70, height: 14, borderRadius: 4, opacity: 1 - i * 0.25 }} /></SettingsTableCell>
                              ))}
                            </SettingsTableRow>
                          ))}

                          {!sharesLoading && shares.length === 0 && (
                            <SettingsTableRow divider={false} minHeight={80}>
                              <SettingsTableCell style={{ gridColumn: '1 / -1' }}>
                                <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-500)', margin: 0 }}>
                                  No Super Links yet — generate one from the button above.
                                </p>
                              </SettingsTableCell>
                            </SettingsTableRow>
                          )}

                          {!sharesLoading && shares.map(share => {
                            const personaInfo = versionToPersona[share.persona_id]
                            const name        = share.persona_name ?? personaInfo?.name ?? 'Agent'
                            const imageUrl    = personaInfo?.imageUrl ?? null
                            const repoId      = personaInfo?.repoId ?? ''
                            const recipients  = share.recipients ?? []
                            const uniqueUsers = new Set(recipients.map(r => r.recipient_user_id)).size
                            const status      = shareStatus(share)
                            const badge       = SENT_STATUS_BADGE[status]
                            const url         = canonicalShareUrl(share.share_url).replace(/^https?:\/\//, '')
                            const pctUsed     = share.credit_limit ? Math.min(100, Math.round((share.credit_used / share.credit_limit) * 100)) : null

                            return (
                              <SettingsTableRow
                                key={share.id}
                                minHeight={64}
                                onClick={() => setSelectedShareId(prev => prev === share.id ? null : share.id)}
                              >
                                <SettingsTableCell>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                    {imageUrl ? (
                                      // eslint-disable-next-line @next/next/no-img-element -- remote/user-supplied avatar URL
                                      <img src={imageUrl} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                                    ) : (
                                      <Avatar name={name} color={colorFromName(name)} size="xs" />
                                    )}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                                      <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '20px', color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {name}
                                      </p>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                                        <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-500)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {url}
                                        </p>
                                        <CopyUrlButton url={url} />
                                      </div>
                                    </div>
                                  </div>
                                </SettingsTableCell>
                                <SettingsTableCell>
                                  <Badge color={badge.color} label={badge.label} />
                                </SettingsTableCell>
                                <SettingsTableCell>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
                                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-500)' }}>
                                      {pctUsed !== null ? `${pctUsed}% used` : `${share.credit_used.toLocaleString()} credits`}
                                    </span>
                                    <TokenBudgetBar used={share.credit_used} limit={share.credit_limit ?? 0} size="sm" />
                                  </div>
                                </SettingsTableCell>
                                <SettingsTableCell>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, width: '100%' }}>
                                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-700)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {recipients.length} conversation{recipients.length === 1 ? '' : 's'} · {uniqueUsers} user{uniqueUsers === 1 ? '' : 's'}
                                    </p>
                                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-400)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {recipients.length > 0 ? `Last used ${fmtRelative(share.updated_at ?? share.created_at)}` : `Created ${fmtRelative(share.created_at)}`}
                                    </p>
                                  </div>
                                </SettingsTableCell>
                                <SettingsTableCell>
                                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-500)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {fmtExpiry(share.expires_at)}
                                  </p>
                                </SettingsTableCell>
                                <SettingsTableCell align="end">
                                  {repoId && (
                                    <Tooltip content="Open sharing settings" side="top">
                                      <IconButton
                                        aria-label={`Open sharing settings for ${name}`}
                                        size="xs"
                                        variant="ghost"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          push(AGENT_CONFIGURE_SHARING_ROUTE(repoId, { name, versionId: share.persona_id }))
                                        }}
                                        icon={<ArrowUpRightOneIcon size={14} />}
                                      />
                                    </Tooltip>
                                  )}
                                </SettingsTableCell>
                              </SettingsTableRow>
                            )
                          })}
                        </SettingsTableViewport>
                      </SettingsTable>
                    )
                  ) : (
                    <SettingsTable columns={SHARED_LINKS_COLUMNS} columnGap={16}>
                      <SettingsTableToolbar title={receivedLoading ? 'Loading…' : `Shared Superlinks · ${receivedShares.length}`} />
                      <SettingsTableViewport minWidth={1000} ariaLabel="Shared with me">
                        <SettingsTableHeader>
                          <SettingsTableHeaderCell>Agent</SettingsTableHeaderCell>
                          <SettingsTableHeaderCell>Shared by</SettingsTableHeaderCell>
                          <SettingsTableHeaderCell>Status</SettingsTableHeaderCell>
                          <SettingsTableHeaderCell>Usage</SettingsTableHeaderCell>
                          <SettingsTableHeaderCell>Expires</SettingsTableHeaderCell>
                          <SettingsTableHeaderCell align="end">Actions</SettingsTableHeaderCell>
                        </SettingsTableHeader>

                        {receivedLoading && [0, 1, 2].map(i => (
                          <SettingsTableRow key={i} minHeight={64}>
                            <SettingsTableCell>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: 1 - i * 0.25 }}>
                                <div className="kaya-skeleton" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                                <div className="kaya-skeleton" style={{ width: 120, height: 14, borderRadius: 4 }} />
                              </div>
                            </SettingsTableCell>
                            {[0, 1, 2, 3, 4].map(ci => (
                              <SettingsTableCell key={ci}><div className="kaya-skeleton" style={{ width: 70, height: 14, borderRadius: 4, opacity: 1 - i * 0.25 }} /></SettingsTableCell>
                            ))}
                          </SettingsTableRow>
                        ))}

                        {!receivedLoading && receivedShares.length === 0 && (
                          <SettingsTableRow divider={false} minHeight={80}>
                            <SettingsTableCell style={{ gridColumn: '1 / -1' }}>
                              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-500)', margin: 0 }}>
                                When someone shares a Super Link and you accept it, their agent appears here.
                              </p>
                            </SettingsTableCell>
                          </SettingsTableRow>
                        )}

                        {!receivedLoading && receivedShares.map(share => {
                          const persona   = personaByRepoId[share.persona_repo_id]
                          const status    = receivedShareStatus(share)
                          const badge     = RECEIVED_STATUS_BADGE[status]
                          const pctUsed   = share.credit_limit ? Math.min(100, Math.round((share.credit_used / share.credit_limit) * 100)) : null

                          return (
                            <SettingsTableRow key={share.share_id} minHeight={64}>
                              <SettingsTableCell>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                  {share.image_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element -- remote/user-supplied avatar URL
                                    <img src={share.image_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                                  ) : (
                                    <Avatar name={share.name} color={colorFromName(share.name)} size="xs" />
                                  )}
                                  <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '20px', color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {share.name}
                                  </p>
                                </div>
                              </SettingsTableCell>
                              <SettingsTableCell>
                                <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-500)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {share.shared_by_name}
                                </p>
                              </SettingsTableCell>
                              <SettingsTableCell>
                                <Badge color={badge.color} label={badge.label} />
                              </SettingsTableCell>
                              <SettingsTableCell>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
                                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-500)' }}>
                                    {pctUsed !== null ? `${pctUsed}% used` : `${share.credit_used.toLocaleString()} credits`}
                                  </span>
                                  <TokenBudgetBar used={share.credit_used} limit={share.credit_limit ?? 0} size="sm" />
                                </div>
                              </SettingsTableCell>
                              <SettingsTableCell>
                                <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-500)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {fmtExpiry(share.expires_at)}
                                </p>
                              </SettingsTableCell>
                              <SettingsTableCell align="end">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <Button size="sm" variant="secondary" onClick={() => push(AGENT_CHAT_ROUTE(share.persona_repo_id))}>
                                    Use in chat
                                  </Button>
                                  <Tooltip content="Remove" side="top">
                                    <IconButton
                                      aria-label={`Remove ${share.name}`}
                                      size="xs"
                                      variant="ghost"
                                      onClick={() => persona && setDeleteTarget(persona)}
                                      icon={<DeleteTwoIcon size={14} />}
                                    />
                                  </Tooltip>
                                </div>
                              </SettingsTableCell>
                            </SettingsTableRow>
                          )
                        })}
                      </SettingsTableViewport>
                    </SettingsTable>
                  )}
                </div>
              </div>
            )
          })()}

        </div>
      </div>
      </div>

      {/* ── Super Link drawer ── */}
      <SuperLinkDrawer
        link={selectedDrawerLink}
        onClose={() => setSelectedShareId(null)}
        onStatusChange={(next) => {
          if (next === 'revoked' && selectedShareId) {
            const id = selectedShareId
            revokeShare(id)
              .then(() => {
                setDashboard(prev => prev ? { ...prev, links: prev.links.filter(s => s.id !== id) } : prev)
                setSelectedShareId(null)
                toast.success('Super Link revoked')
              })
              .catch(() => toast.error('Failed to revoke link'))
          }
        }}
      />

      {/* ── Delete confirmation ── */}
      {mounted && createPortal(
        <AnimatePresence>
          {deleteTarget && (
            <>
              {/* Backdrop */}
              <m.div
                key="delete-agent-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={() => setDeleteTarget(null)}
                style={{
                  position:        'fixed',
                  inset:           0,
                  zIndex:          10000,
                  backgroundColor: 'rgba(0,0,0,0.28)',
                  backdropFilter:  'blur(2px)',
                }}
              />

              {/* Centering wrapper */}
              <div
                style={{
                  position:       'fixed',
                  inset:          0,
                  zIndex:         10001,
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  pointerEvents:  'none',
                }}
              >
                <m.div
                  key="delete-agent-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Delete agent"
                  initial={{ opacity: 0, scale: 0.96, y: 8 }}
                  animate={{ opacity: 1, scale: 1,    y: 0 }}
                  exit={{    opacity: 0, scale: 0.96, y: 8 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    pointerEvents:   'auto',
                    backgroundColor: 'var(--neutral-white)',
                    borderRadius:    16,
                    boxShadow:       '0px 8px 32px 0px rgba(82,75,71,0.18), 0px 0px 0px 1px var(--neutral-100)',
                    width:           480,
                    maxWidth:        'calc(100vw - 32px)',
                    display:         'flex',
                    flexDirection:   'column',
                    overflow:        'hidden',
                  }}
                >
                  {/* Header */}
                  <div
                    style={{
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'space-between',
                      padding:        '20px 20px 16px',
                      borderBottom:   '1px solid var(--neutral-100)',
                      flexShrink:     0,
                    }}
                  >
                    <p
                      style={{
                        fontFamily: 'var(--font-title)',
                        fontWeight: 400,
                        fontSize:   '24px',
                        lineHeight: '32px',
                        color:      'var(--neutral-900)',
                        margin:     0,
                      }}
                    >
                      Delete agent?
                    </p>
                    <IconButton variant="ghost" size="xs" icon={<CancelOneIcon />} aria-label="Close" onClick={() => setDeleteTarget(null)} />
                  </div>

                  {/* Body */}
                  <div
                    style={{
                      padding:       '20px',
                      display:       'flex',
                      flexDirection: 'column',
                      gap:           '12px',
                      flexShrink:    0,
                    }}
                  >
                    {/* Warning tag */}
                    <div
                      style={{
                        display:         'inline-flex',
                        alignSelf:       'flex-start',
                        alignItems:      'center',
                        gap:             5,
                        padding:         '3px 8px 3px 6px',
                        borderRadius:    6,
                        backgroundColor: 'var(--red-400-10)',
                        boxShadow:       '0px 0px 0px 1px rgba(238,48,48,0.22)',
                      }}
                    >
                      <AlertCircleIcon size={13} color="var(--red-500)" />
                      <span
                        style={{
                          fontFamily:    'var(--font-body)',
                          fontWeight:    600,
                          fontSize:      '11px',
                          lineHeight:    '16px',
                          color:         'var(--red-600)',
                          letterSpacing: '0.02em',
                          textTransform: 'uppercase',
                        }}
                      >
                        Warning
                      </span>
                    </div>

                    <p
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontWeight: 'var(--font-weight-regular)',
                        fontSize:   'var(--font-size-body)',
                        lineHeight: 'var(--line-height-body)',
                        color:      'var(--neutral-700)',
                        margin:     0,
                      }}
                    >
                      <><strong>&ldquo;{deleteTarget.name}&rdquo;</strong> will be permanently deleted. This action cannot be undone.</>
                    </p>
                  </div>

                  {/* Footer */}
                  <div
                    style={{
                      display:        'flex',
                      justifyContent: 'flex-end',
                      alignItems:     'center',
                      gap:            8,
                      padding:        '12px 16px 16px',
                      borderTop:      '1px solid var(--neutral-100)',
                      flexShrink:     0,
                    }}
                  >
                    <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
                    <Button variant="danger" onClick={() => { handleDelete(deleteTarget.id, deleteTarget.name); setDeleteTarget(null) }}>Delete</Button>
                  </div>
                </m.div>
              </div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
