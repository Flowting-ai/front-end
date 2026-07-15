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
  CopyOneIcon,
  PenOneIcon,
  CancelOneIcon,
  FilterMailIcon,
  AlertCircleIcon,
  RedoIcon,
} from '@strange-huge/icons'
import { useMounted } from '@/hooks/use-mounted'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { Spinner } from '@/components/Spinner'
import { Dropdown, DROPDOWN_SCALE_PRESET } from '@/components/Dropdown'
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
import { SuperLinkRow, type SuperLinkStatus } from '@/components/SuperLinkRow'
import { SuperLinkDrawer, type SuperLinkDrawerLink } from '@/components/SuperLinkDrawer'
import { SuperLinksEmpty } from '@/components/SuperLinksEmpty'
import { StatCard } from '@/components/StatCard'
import { Sparkline } from '@/components/Sparkline'
import { DateRangePill } from '@/components/DateRangePill'
import { TeamAgentsTab } from '@/app/(app)/agents/components/TeamAgentsTab'
import { usePinboard } from '@/context/pinboard-context'
import { useOrg } from '@/context/org-context'
import { useAuth } from '@/context/auth-context'
import { fetchPersonaOwnerMap } from '@/lib/api/teams'
import { toast } from 'sonner'

// ── Types ─────────────────────────────────────────────────────────────────────

type TabId = 'my-personas' | 'team-agents' | 'super-links' | 'shared' | 'community'
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

// ── SharedAgentCard ───────────────────────────────────────────────────────────

function SharedAgentCard({
  share,
  persona,
  onUseInChat,
  onDelete,
}: {
  share:       ReceivedShareResponse
  persona:     Persona | undefined
  onUseInChat: () => void
  onDelete:    () => void
}) {
  const status  = receivedShareStatus(share)
  const badge   = RECEIVED_STATUS_BADGE[status]
  const initial = share.shared_by_name.slice(0, 1).toUpperCase()
  const avatarBg = colorFromName(share.shared_by_name)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <PersonaCard
        style={{ width: '100%' }}
        variant="default"
        avatarSeed={share.persona_id}
        name={share.name}
        handle={persona?.handle.replace(/^@/, '') ?? ''}
        description={share.description ?? undefined}
        avatarUrl={share.image_url ?? undefined}
        shared
        tags={persona?.tags}
        paused={persona?.isPaused}
        onUseInChat={onUseInChat}
        onMenuDelete={onDelete}
      />

      {/* ── Share context strip ── */}
      <div style={{
        display:    'flex',
        alignItems: 'center',
        gap:        6,
        padding:    '0 4px',
        flexWrap:   'wrap',
        rowGap:     4,
      }}>
        {/* Sharer initials bubble */}
        <div style={{
          width:           18,
          height:          18,
          borderRadius:    '50%',
          background:      avatarBg,
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          fontSize:        9,
          fontWeight:      600,
          color:           'white',
          flexShrink:      0,
          letterSpacing:   0,
        }}>
          {initial}
        </div>
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize:   12,
          lineHeight: '16px',
          color:      'var(--neutral-600)',
          flexShrink: 0,
        }}>
          {share.shared_by_name}
        </span>
        <span style={{ color: 'var(--neutral-300)', fontSize: 12, flexShrink: 0 }}>·</span>
        <Badge color={badge.color}>{badge.label}</Badge>
        <span style={{
          marginLeft:  'auto',
          fontFamily:  'var(--font-body)',
          fontSize:    11,
          color:       'var(--neutral-400)',
          flexShrink:  0,
        }}>
          {fmtExpiry(share.expires_at)}
        </span>
      </div>

      {/* ── Credit bar — only when a cap is set ── */}
      {share.credit_limit !== null && (
        <div style={{ padding: '0 4px' }}>
          <TokenBudgetBar
            used={share.credit_used}
            limit={share.credit_limit}
            size="sm"
            showLabel
          />
        </div>
      )}
    </div>
  )
}

// ── SharedByMeCard — one card per agent the user has shared with others ───────

function SharedByMeCard({
  persona,
  shares,
  fallbackName,
  onUseInChat,
  onManage,
}: {
  persona:      Persona | undefined
  shares:       PersonaShare[]
  fallbackName: string
  onUseInChat:  () => void
  onManage:     () => void
}) {
  const activeShares = shares.filter(s => s.is_active)
  const isActive     = activeShares.length > 0

  // Aggregate credit usage across shares that carry a cap.
  const capped       = shares.filter(s => s.credit_limit !== null)
  const totalUsed    = capped.reduce((sum, s) => sum + s.credit_used, 0)
  const totalLimit   = capped.reduce((sum, s) => sum + (s.credit_limit ?? 0), 0)

  // Soonest upcoming expiry among active shares (else the latest seen).
  const expiry = (isActive ? activeShares : shares)
    .map(s => s.expires_at)
    .sort()[isActive ? 0 : shares.length - 1]

  const linkLabel = `${shares.length} link${shares.length === 1 ? '' : 's'} shared`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <PersonaCard
        style={{ width: '100%' }}
        variant="default"
        avatarSeed={persona?.activeVersionId ?? shares[0].persona_id}
        name={persona?.name ?? shares[0].persona_name ?? fallbackName}
        handle={persona?.handle.replace(/^@/, '') ?? ''}
        description={persona?.description}
        avatarUrl={persona?.imageUrl ?? undefined}
        shared
        tags={persona?.tags}
        paused={persona?.isPaused}
        onUseInChat={onUseInChat}
        onLink={onManage}
      />

      {/* ── Share context strip ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 4px', flexWrap: 'wrap', rowGap: 4 }}>
        <Badge color={isActive ? 'Green' : 'Neutral'}>{isActive ? 'Active' : 'Inactive'}</Badge>
        <span style={{ color: 'var(--neutral-300)', fontSize: 12, flexShrink: 0 }}>·</span>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: '16px', color: 'var(--neutral-600)', flexShrink: 0 }}>
          {linkLabel}
        </span>
        {expiry && (
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--neutral-400)', flexShrink: 0 }}>
            {fmtExpiry(expiry)}
          </span>
        )}
      </div>

      {/* ── Credit bar — only when at least one share has a cap ── */}
      {capped.length > 0 && totalLimit > 0 && (
        <div style={{ padding: '0 4px' }}>
          <TokenBudgetBar used={totalUsed} limit={totalLimit} size="sm" showLabel />
        </div>
      )}
    </div>
  )
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

// 90-point dummy sparkline — sliced to the selected range when no real usage exists
const DUMMY_SPARK = [
   45,  82,  61, 110,  94, 140, 128, 175, 163, 145,
  190, 210, 185, 220, 245, 215, 255, 238, 280, 265,
  290, 310, 285, 330, 315, 345, 360, 340, 375, 390,
  410, 385, 425, 445, 420, 460, 478, 455, 490, 510,
  485, 525, 545, 520, 560, 575, 550, 590, 610, 585,
  625, 645, 620, 660, 678, 655, 690, 710, 685, 725,
  745, 720, 760, 778, 755, 790, 810, 785, 825, 845,
  820, 860, 878, 855, 890, 910, 885, 925, 940, 955,
  930, 960, 975, 950, 990,1005, 980,1020,1010,1030,
]

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
  const { currentUserRole, orgId, teams } = useOrg()
  const { user } = useAuth()

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
    return isPersonaOwnedByViewer(persona, personaOwnerMap, user?.id, currentUserRole === 'admin')
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
  const [headerGenOpen, setHeaderGenOpen] = useState(false)
  const [panelGenOpen,  setPanelGenOpen]  = useState(false)

  // Super Links state
  const [dashboard,          setDashboard]          = useState<ShareDashboardResponse | null>(null)
  const [sharesLoading,      setSharesLoading]      = useState(false)
  const [dashboardRefreshing, setDashboardRefreshing] = useState(false)
  const [selectedShareId,    setSelectedShareId]    = useState<string | null>(null)
  const [slRange,            setSlRange]            = useState<'7d' | '30d' | '90d'>('30d')

  // Derived from slRange — used in both the fetch effect and the chart section
  const slDays = slRange === '7d' ? 7 : slRange === '90d' ? 90 : 30

  // Shared tab state — received shares from /persona-shares/received
  const [receivedShares,   setReceivedShares]   = useState<ReceivedShareResponse[]>([])
  const [receivedLoading,  setReceivedLoading]  = useState(false)

  // Shared tab filter — "with-me" (received) vs "with-others" (the user's own shares).
  const [sharedFilter,     setSharedFilter]     = useState<'with-me' | 'with-others'>('with-me')
  const [sharedFilterOpen, setSharedFilterOpen] = useState(false)
  // Shares the user created (GET /persona-shares) — drives the "with-others" view.
  const [sentShares,       setSentShares]       = useState<PersonaShare[]>([])
  const [sentLoading,      setSentLoading]      = useState(false)

  // Close the pinboard whenever the personas page is mounted.
  useEffect(() => { closePinboard() }, [closePinboard])

  // Re-fetch whenever this page becomes the active route so navigating back
  // from configure always shows the latest avatar / state.
  useEffect(() => {
    if (pathname !== '/agents') return
    setIsLoading(true)
    bustPersonasCache()
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
    const handler = () => {
      fetchPersonas()
        .then(list => setPersonas(list))
        .catch(console.error)
    }
    window.addEventListener(PERSONAS_LIST_UPDATED_EVENT, handler)
    return () => window.removeEventListener(PERSONAS_LIST_UPDATED_EVENT, handler)
  }, [pathname])

  // Fetch dashboard whenever the super-links tab is active or the date range changes.
  useEffect(() => {
    if (activeTab !== 'super-links') return
    setSharesLoading(true)
    bustPersonasCache()
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

  // Fetch received shares whenever the shared tab becomes active.
  useEffect(() => {
    if (activeTab !== 'shared') return
    setReceivedLoading(true)
    listReceived()
      .then(setReceivedShares)
      .catch(console.error)
      .finally(() => setReceivedLoading(false))
  }, [activeTab, pathname])

  // Fetch the user's own shares for the "with-others" view. Re-fetches whenever
  // that filter is selected on the shared tab so the list stays fresh; personas
  // (loaded by the main effect) supply the resolved name / handle / avatar.
  useEffect(() => {
    if (activeTab !== 'shared' || sharedFilter !== 'with-others') return
    setSentLoading(true)
    listShares()
      .then(setSentShares)
      .catch(console.error)
      .finally(() => setSentLoading(false))
  }, [activeTab, sharedFilter, pathname])

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

  // "Shared with others" — group the user's own shares by the agent they belong
  // to, so each shared agent shows once even when it has several links/emails.
  const sharedByMeAgents = useMemo(() => {
    const groups = new Map<string, { repoId: string; persona?: Persona; shares: PersonaShare[] }>()
    for (const share of sentShares) {
      const info   = versionToPersona[share.persona_id]
      const repoId = info?.repoId ?? share.persona_id
      const group  = groups.get(repoId) ?? { repoId, persona: personaByRepoId[repoId], shares: [] }
      group.shares.push(share)
      groups.set(repoId, group)
    }
    return Array.from(groups.values())
  }, [sentShares, versionToPersona, personaByRepoId])

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
    [personas, currentUserRole, personaOwnerMap, user?.id],
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
      await deletePersona(id)
      bustPersonasCache()
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

  // Super Links: date-range label for the DateRangePill header
  const _slToday    = new Date()
  const _slFromDate = new Date(_slToday)
  _slFromDate.setDate(_slToday.getDate() - slDays)
  const _fmtSl = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const slDateRangeLabel = `${_fmtSl(_slFromDate)} – ${_fmtSl(_slToday)}`

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
          padding: '36px 12px 24px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{
          width: '100%',
          maxWidth: 967,
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
                <Tabs.Trigger value="shared">Shared with me</Tabs.Trigger>
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
                  : activeTab === 'shared'
                    ? (sharedFilter === 'with-others' ? 'Shared with others' : 'Shared with me')
                    : activeTab === 'team-agents'
                      ? 'Team Agents'
                      : 'Agents'}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {activeTab === 'super-links' && (
                  <DateRangePill label={slDateRangeLabel} />
                )}
                {activeTab === 'super-links' ? (
                  <Dropdown.Float
                    open={headerGenOpen}
                    onOpenChange={setHeaderGenOpen}
                    placement="bottom-end"
                    trigger={
                      <Button variant="default" leftIcon={<PlusSignIcon size={16} />}>
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
                                setHeaderGenOpen(false)
                                push(AGENT_CONFIGURE_SHARING_ROUTE(p.id, { name: p.name, versionId: p.activeVersionId }))
                              }}
                              fluid
                            />
                          ))}
                        </Dropdown.Section>
                      )}
                    </Dropdown>
                  </Dropdown.Float>
                ) : activeTab === 'shared' ? (
                  <Dropdown.Float
                    open={sharedFilterOpen}
                    onOpenChange={setSharedFilterOpen}
                    placement="bottom-end"
                    trigger={
                      <Button variant="secondary" rightIcon={<ArrowDownOneIcon size={16} />}>
                        {sharedFilter === 'with-others' ? 'Shared with others' : 'Shared with me'}
                      </Button>
                    }
                  >
                    <Dropdown style={{ minWidth: 200 }}>
                      <Dropdown.Section>
                        <Dropdown.Item label="Shared with me"     selected={sharedFilter === 'with-me'}     onClick={() => { setSharedFilter('with-me');     setSharedFilterOpen(false) }} fluid />
                        <Dropdown.Item label="Shared with others" selected={sharedFilter === 'with-others'} onClick={() => { setSharedFilter('with-others'); setSharedFilterOpen(false) }} fluid />
                      </Dropdown.Section>
                    </Dropdown>
                  </Dropdown.Float>
                ) : activeTab === 'team-agents' ? null : (
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

          {/* ── Shared tab · Shared with me ── */}
          {activeTab === 'shared' && sharedFilter === 'with-me' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {receivedLoading ? (
                /* Skeleton — card (140px) + strip (~30px) + gap (8px) = ~178px per cell */
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 314px))', justifyContent: 'center', gap: 16 }}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ height: 140, borderRadius: 16, background: 'var(--neutral-100)', animation: 'pulse 0.9s ease-in-out infinite' }} />
                      <div style={{ height: 18, borderRadius: 8, background: 'var(--neutral-100)', animation: 'pulse 0.9s ease-in-out infinite', width: '60%' }} />
                    </div>
                  ))}
                </div>
              ) : receivedShares.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '64px 24px' }}>
                  <p style={{ fontFamily: 'var(--font-title)', fontWeight: 'var(--font-weight-regular)', fontSize: 24, lineHeight: '32px', color: '#1a1916', margin: 0, textAlign: 'center' }}>
                    No shared agents yet
                  </p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, lineHeight: '22px', color: 'var(--neutral-500)', textAlign: 'center', maxWidth: 400, margin: 0 }}>
                    When someone shares a Super Link and you accept it, their agent appears here.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 314px))', justifyContent: 'center', gap: 16 }}>
                  {receivedShares.map(share => {
                    const persona = personaByRepoId[share.persona_repo_id]
                    return (
                      <SharedAgentCard
                        key={share.share_id}
                        share={share}
                        persona={persona}
                        onUseInChat={() => push(AGENT_CHAT_ROUTE(share.persona_repo_id))}
                        onDelete={() => persona && setDeleteTarget(persona)}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Shared tab · Shared with others ── */}
          {activeTab === 'shared' && sharedFilter === 'with-others' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {sentLoading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 314px))', justifyContent: 'center', gap: 16 }}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ height: 140, borderRadius: 16, background: 'var(--neutral-100)', animation: 'pulse 0.9s ease-in-out infinite' }} />
                      <div style={{ height: 18, borderRadius: 8, background: 'var(--neutral-100)', animation: 'pulse 0.9s ease-in-out infinite', width: '60%' }} />
                    </div>
                  ))}
                </div>
              ) : sharedByMeAgents.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '64px 24px' }}>
                  <p style={{ fontFamily: 'var(--font-title)', fontWeight: 'var(--font-weight-regular)', fontSize: 24, lineHeight: '32px', color: '#1a1916', margin: 0, textAlign: 'center' }}>
                    You haven&apos;t shared any agents
                  </p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, lineHeight: '22px', color: 'var(--neutral-500)', textAlign: 'center', maxWidth: 400, margin: 0 }}>
                    Generate a Super Link from any agent to share it with others — shared agents will show up here.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 314px))', justifyContent: 'center', gap: 16 }}>
                  {sharedByMeAgents.map(group => (
                    <SharedByMeCard
                      key={group.repoId}
                      persona={group.persona}
                      shares={group.shares}
                      fallbackName="Agent"
                      onUseInChat={() => push(AGENT_CHAT_ROUTE(group.repoId))}
                      onManage={() => {
                        const p = group.persona
                        push(AGENT_CONFIGURE_SHARING_ROUTE(group.repoId, p ? { name: p.name, versionId: p.activeVersionId } : undefined))
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Super Links tab ── */}
          {activeTab === 'super-links' && (() => {
            const summary      = dashboard?.summary
            const creditsMonth = summary?.credits_this_month ?? 0
            const estimatedCost = parseFloat((creditsMonth / 1_000_000 * 3).toFixed(2))
            const sparkData: number[] = dashboard?.daily.length
              ? dashboard.daily.map(d => d.credits)
              : DUMMY_SPARK.slice(0, slDays)

            function fmtDelta(pct: number | null | undefined): { delta: string; deltaTrend: 'up' | 'down' } | object {
              if (pct == null) return {}
              return {
                delta:      `${pct >= 0 ? '+' : ''}${Math.abs(pct).toFixed(1)}%`,
                deltaTrend: pct >= 0 ? 'up' : 'down',
              }
            }

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* ── Stat grid ── */}
                <section style={{
                  display:             'grid',
                  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                  gap:                 12,
                }}>
                  <StatCard
                    label="Credits this month"
                    value={fmtK(creditsMonth)}
                    {...fmtDelta(summary?.credits_delta_pct)}
                    sub="across all links"
                  />
                  <StatCard
                    label="Conversations"
                    value={summary?.conversations ?? 0}
                    {...fmtDelta(summary?.conversations_delta_pct)}
                    sub="total sessions"
                  />
                  <StatCard
                    label="Active links"
                    value={summary?.active_links ?? 0}
                    sub={`of ${summary?.total_links ?? 0} total`}
                  />
                  <StatCard
                    label="Est. cost"
                    value={`$${estimatedCost.toFixed(2)}`}
                    {...fmtDelta(summary?.credits_delta_pct != null ? -summary.credits_delta_pct : null)}
                    sub="creator-pays"
                  />
                </section>

                {/* ── Main grid: 2fr chart | 1fr links panel ── */}
                <section style={{
                  display:             'grid',
                  gridTemplateColumns: 'minmax(0, 2fr) minmax(320px, 1fr)',
                  gap:                 12,
                  flex:                1,
                  minHeight:           420,
                }}>

                  {/* ── ChartCard ── */}
                  <div style={{
                    display:         'flex',
                    flexDirection:   'column',
                    borderRadius:    16,
                    backgroundColor: 'var(--neutral-white)',
                    border:          '1px solid var(--neutral-100)',
                    boxShadow:       'var(--shadow-surface-card)',
                    overflow:        'hidden',
                  }}>
                    {/* Header */}
                    <div style={{
                      display:        'flex',
                      alignItems:     'flex-start',
                      justifyContent: 'space-between',
                      gap:            16,
                      padding:        '18px 20px 0',
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{
                          fontFamily:    'var(--font-body)',
                          fontSize:      'var(--font-size-caption)',
                          lineHeight:    'var(--line-height-caption)',
                          fontWeight:    500,
                          color:         'var(--neutral-500)',
                          textTransform: 'uppercase' as const,
                          letterSpacing: '0.06em',
                        }}>
                          Credit usage · daily
                        </span>
                        <span style={{
                          fontFamily: 'var(--font-title)',
                          fontSize:   'var(--font-size-heading)',
                          lineHeight: 'var(--line-height-heading)',
                          fontWeight: 'var(--font-weight-medium)',
                          color:      'var(--neutral-900)',
                        }}>
                          {fmtK(creditsMonth)}
                        </span>
                      </div>
                      {/* Range selector */}
                      <Tabs value={slRange} onValueChange={(v) => setSlRange(v as '7d' | '30d' | '90d')}>
                        <Tabs.List size="small">
                          <Tabs.Trigger value="7d">7d</Tabs.Trigger>
                          <Tabs.Trigger value="30d">30d</Tabs.Trigger>
                          <Tabs.Trigger value="90d">90d</Tabs.Trigger>
                        </Tabs.List>
                      </Tabs>
                    </div>

                    {/* Sparkline body */}
                    <div style={{ flex: 1, padding: '16px 20px 20px' }}>
                      {sharesLoading ? (
                        <div style={{ height: 180, borderRadius: 10, background: 'var(--neutral-100)', animation: 'pulse 0.9s ease-in-out infinite' }} />
                      ) : (
                        <Sparkline data={sparkData} height={180} />
                      )}
                    </div>
                  </div>

                  {/* ── LinksSidePanel ── */}
                  <div style={{
                    display:         'flex',
                    flexDirection:   'column',
                    borderRadius:    16,
                    backgroundColor: 'var(--neutral-white)',
                    border:          '1px solid var(--neutral-100)',
                    boxShadow:       'var(--shadow-surface-card)',
                    overflow:        'hidden',
                    alignSelf:       'start',
                  }}>
                    {/* Panel header */}
                    <div style={{
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'space-between',
                      gap:            8,
                      padding:        '12px 16px',
                      borderBottom:   '1px solid var(--neutral-100)',
                      flexShrink:     0,
                    }}>
                      <span style={{
                        fontFamily: 'var(--font-body)',
                        fontSize:   'var(--font-size-caption)',
                        lineHeight: 'var(--line-height-caption)',
                        color:      'var(--neutral-500)',
                      }}>
                        {sharesLoading ? 'Loading…' : `Super Links ${summary?.total_links ?? shares.length}`}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                      </div>
                    </div>

                    {/* Scrollable rows — max 4 visible at once */}
                    <div
                      className="kaya-scrollbar"
                      style={{
                        maxHeight:     424,
                        overflowY:     'auto',
                        padding:       8,
                        display:       'flex',
                        flexDirection: 'column',
                        gap:           6,
                      }}
                    >
                      {/* Skeleton */}
                      {sharesLoading && Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} style={{ height: 96, borderRadius: 14, background: 'var(--neutral-100)', animation: 'pulse 0.9s ease-in-out infinite' }} />
                      ))}

                      {/* Empty state */}
                      {!sharesLoading && shares.length === 0 && (
                        <SuperLinksEmpty onBrowsePersonas={() => setActiveTab('my-personas')} />
                      )}

                      {/* Rows */}
                      {!sharesLoading && shares.map(share => {
                        const personaInfo = versionToPersona[share.persona_id]
                        const name        = share.persona_name ?? personaInfo?.name ?? 'Agent'
                        const imageUrl    = personaInfo?.imageUrl ?? null
                        const repoId      = personaInfo?.repoId ?? ''
                        return (
                          <SuperLinkRow
                            key={share.id}
                            personaName={name}
                            avatarColor={colorFromName(name)}
                            avatarUrl={imageUrl}
                            url={canonicalShareUrl(share.share_url).replace(/^https?:\/\//, '')}
                            tokenUsed={share.credit_used}
                            tokenLimit={share.credit_limit ?? 0}
                            status={shareStatus(share)}
                            selected={selectedShareId === share.id}
                            onClick={() => setSelectedShareId(prev => prev === share.id ? null : share.id)}
                            onConfigure={repoId ? (e) => {
                              e.stopPropagation()
                              push(AGENT_CONFIGURE_SHARING_ROUTE(repoId, { name, versionId: share.persona_id }))
                            } : undefined}
                          />
                        )
                      })}
                    </div>
                  </div>

                </section>
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
