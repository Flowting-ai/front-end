'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
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
} from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { Dropdown, DROPDOWN_SCALE_PRESET } from '@/components/Dropdown'
import { fetchPersonas, bustPersonasCache, deletePersona, togglePause, type Persona } from '@/lib/api/personas'
import { listShares, listReceived, revokeShare, getSharePreview, type PersonaShare, type ReceivedShareResponse } from '@/lib/api/persona-shares'
import { Badge } from '@/components/Badge'
import { TokenBudgetBar } from '@/components/TokenBudgetBar'
import { canonicalShareUrl } from '@/lib/share-url'
import Tabs from '@/components/Tabs'
import { PersonaCard } from '@/components/PersonaCard'
import { SuperLinkRow, type SuperLinkStatus } from '@/components/SuperLinkRow'
import { SuperLinkDrawer, type SuperLinkDrawerLink } from '@/components/SuperLinkDrawer'
import { SuperLinksEmpty } from '@/components/SuperLinksEmpty'
import { StatCard } from '@/components/StatCard'
import { Sparkline } from '@/components/Sparkline'
import { DateRangePill } from '@/components/DateRangePill'
import { usePinboard } from '@/context/pinboard-context'
import { toast } from 'sonner'

// ── Types ─────────────────────────────────────────────────────────────────────

type TabId = 'my-personas' | 'super-links' | 'shared' | 'community'
type SortKey = 'activity' | 'az' | 'za'

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
    versionCount: 1,
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
    versionCount: 1,
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
    versionCount: 1,
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
        {/* eslint-disable-next-line @next/next/no-img-element, react-doctor/nextjs-no-img-element -- dynamic avatar URL, onError fallback requires HTMLImageElement access */}
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
  onEdit,
  onUseInChat,
  onPauseToggle,
  onDelete,
}: {
  share:        ReceivedShareResponse
  persona:      Persona | undefined
  onEdit:       () => void
  onUseInChat:  () => void
  onPauseToggle: () => void
  onDelete:     () => void
}) {
  const status  = receivedShareStatus(share)
  const badge   = RECEIVED_STATUS_BADGE[status]
  const initial = share.shared_by_name.slice(0, 1).toUpperCase()
  const avatarBg = colorFromName(share.shared_by_name)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <PersonaCard
        variant="default"
        name={share.name}
        handle={persona?.handle.replace(/^@/, '') ?? ''}
        description={share.description ?? undefined}
        avatarUrl={share.image_url ?? undefined}
        tags={persona?.tags}
        paused={persona?.isPaused}
        visibility="private"
        onEdit={onEdit}
        onUseInChat={onUseInChat}
        onResume={onPauseToggle}
        onMenuEdit={onEdit}
        onMenuPauseToggle={onPauseToggle}
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

// ── Delete confirmation dialog ────────────────────────────────────────────────

function DeleteDialog({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* eslint-disable-next-line click-events-have-key-events, no-static-element-interactions -- interactive div; keyboard handling delegated to inner elements */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }} onClick={onCancel} />
      <div style={{
        position: 'relative',
        background: 'var(--neutral-white)',
        borderRadius: 16,
        padding: 24,
        width: 380,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        boxShadow: '0px 20px 40px rgba(0,0,0,0.15)',
      }}>
        <h2 style={{ fontFamily: 'var(--font-title)', fontSize: 20, fontWeight: 400, color: 'var(--neutral-900)', margin: 0 }}>Delete Agent</h2>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-600)', margin: 0 }}>
          Are you sure you want to delete &ldquo;{name}&rdquo;? This action cannot be undone.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm}>Delete</Button>
        </div>
      </div>
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
): SuperLinkDrawerLink {
  return {
    id:             share.id,
    personaName,
    avatarColor:    colorFromName(personaName),
    avatarUrl,
    repoId,
    url:            canonicalShareUrl(share.share_url).replace(/^https?:\/\//, ''),
    tokenUsed:      share.credit_used,
    tokenLimit:     share.credit_limit ?? 0,
    conversations:  0,
    uniqueUsers:    0,
    tokensPerConvo: 0,
    lastUsedAt:     share.updated_at,
    status:         shareStatus(share),
    dailyTokens:    [],
    sessions:       [],
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

// eslint-disable-next-line react-doctor/prefer-useReducer -- multiple useState calls; useReducer refactor deferred
export default function PersonasPage() {
  const { push } = useRouter()
  const pathname = usePathname()
  const { close: closePinboard } = usePinboard()

  const [activeTab,    setActiveTab]    = useState<TabId>('my-personas')
  const [personas,     setPersonas]     = useState<Persona[]>([])
  const [draftAvatarMap,   setDraftAvatarMap]   = useState<Record<string, string>>({})
  const [draftTagsMap,     setDraftTagsMap]     = useState<Record<string, string[]>>({})
  const [unpublishedMap,   setUnpublishedMap]   = useState<Record<string, boolean>>({})
  const [isLoading,    setIsLoading]    = useState(true)
  const [search,       setSearch]       = useState('')
  const [sort,         setSort]         = useState<SortKey>('activity')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'paused'>('all')
  const [filterTags,   setFilterTags]   = useState<string[]>([])
  const [sortOpen,      setSortOpen]      = useState(false)
  const [allOpen,       setAllOpen]       = useState(false)
  const [filterOpen,    setFilterOpen]    = useState(false)
  const [deleteTarget,  setDeleteTarget]  = useState<Persona | null>(null)
  const [headerGenOpen, setHeaderGenOpen] = useState(false)
  const [panelGenOpen,  setPanelGenOpen]  = useState(false)

  // Super Links state
  const [shares,          setShares]          = useState<PersonaShare[]>([])
  const [sharesLoading,   setSharesLoading]   = useState(false)
  const [selectedShareId, setSelectedShareId] = useState<string | null>(null)
  const [slRange,         setSlRange]         = useState<'7d' | '30d' | '90d'>('30d')
  // Enriched persona info per share (name + image) fetched from getSharePreview
  const [shareMeta, setShareMeta] = useState<Record<string, { name: string; imageUrl: string | null }>>({})

  // Shared tab state — received shares from /persona-shares/received
  const [receivedShares,   setReceivedShares]   = useState<ReceivedShareResponse[]>([])
  const [receivedLoading,  setReceivedLoading]  = useState(false)

  // Close the pinboard whenever the personas page is mounted.
  useEffect(() => { closePinboard() }, [closePinboard])

  // Re-fetch whenever this page becomes the active route so navigating back
  // from configure always shows the latest avatar / state.
  useEffect(() => {
    if (pathname !== '/personas') return
    setIsLoading(true)
    fetchPersonas()
      .then(list => {
        setPersonas(list)
        // Build draft-avatar overrides from sessionStorage (covers the case
        // where the user uploaded an image but hasn't saved to the API yet).
        const avatarOverrides:     Record<string, string>   = {}
        const tagOverrides:        Record<string, string[]> = {}
        const unpublishedOverrides: Record<string, boolean>  = {}
        for (const p of list) {
          try {
            const raw = sessionStorage.getItem(`persona_profile_${p.id}`)
            const draft = JSON.parse(raw ?? 'null') as Record<string, unknown> | null
            if (typeof draft?.avatarUrl === 'string') avatarOverrides[p.id] = draft.avatarUrl
            if (Array.isArray(draft?.personaTags))   tagOverrides[p.id]    = draft.personaTags as string[]
          } catch { /* ignore quota / parse errors */ }
          try {
            if (localStorage.getItem(`persona_needs_publish_${p.id}`) === '1') {
              unpublishedOverrides[p.id] = true
            }
          } catch { /* ignore quota / storage errors */ }
        }
        setDraftAvatarMap(avatarOverrides)
        setDraftTagsMap(tagOverrides)
        setUnpublishedMap(unpublishedOverrides)
      })
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [pathname])

  // Fetch link shares whenever the super-links tab is active.
  // Strategy:
  //   1. Load shares + fresh personas in parallel (personas needed for revoked-share fallback).
  //   2. For ACTIVE shares: getSharePreview returns persona_name + image_url directly.
  //   3. For REVOKED shares: getSharePreview fails (share is no longer public), so
  //      we fall back to versionToPersona which is built from the fresh personas list.
  useEffect(() => {
    if (activeTab !== 'super-links') return
    setSharesLoading(true)

    // Bust cache so we always get the latest activeVersionId for every persona —
    // this is the key fallback data for revoked shares whose preview endpoint 4xx-es.
    bustPersonasCache()

    Promise.all([listShares(), fetchPersonas()])
      .then(([allShares, allPersonas]) => {
        const linkShares = allShares.filter(s => s.share_type === 'link')
        setShares(linkShares)
        setPersonas(allPersonas)

        // Fire preview requests for all shares; revoked ones will reject —
        // those fall back to versionToPersona (populated from allPersonas above).
        Promise.allSettled(linkShares.map(s => getSharePreview(s.id))).then(results => {
          const meta: Record<string, { name: string; imageUrl: string | null }> = {}
          results.forEach((r, i) => {
            const share = linkShares[i]
            if (r.status === 'fulfilled' && share) {
              meta[share.id] = { name: r.value.persona_name, imageUrl: r.value.image_url }
            }
          })
          setShareMeta(meta)
        })
      })
      .catch(console.error)
      .finally(() => setSharesLoading(false))
  }, [activeTab, pathname])

  // Fetch received shares whenever the shared tab becomes active.
  useEffect(() => {
    if (activeTab !== 'shared') return
    setReceivedLoading(true)
    listReceived()
      .then(setReceivedShares)
      .catch(console.error)
      .finally(() => setReceivedLoading(false))
  }, [activeTab, pathname])

  // Map share persona_id → persona info.
  // Indexed by BOTH activeVersionId (version frozen at publish time) and repo id
  // so a match is found regardless of whether the share was created before or
  // after the last republish.
  const versionToPersona = useMemo(() => {
    const map: Record<string, { name: string; imageUrl: string | null; repoId: string }> = {}
    for (const p of personas) {
      const entry = { name: p.name, imageUrl: p.imageUrl, repoId: p.id }
      // Primary key: version ID (most common match)
      if (p.activeVersionId) map[p.activeVersionId] = entry
      // Fallback key: repo ID (covers shares whose persona_id is the repo ID)
      map[p.id] = entry
    }
    return map
  }, [personas])

  // Build the drawer link object for the currently selected share.
  const selectedDrawerLink = useMemo((): SuperLinkDrawerLink | null => {
    if (!selectedShareId) return null
    const share = shares.find(s => s.id === selectedShareId)
    if (!share) return null
    const preview = shareMeta[share.id]
    const personaInfo = versionToPersona[share.persona_id]
    const name     = preview?.name     ?? personaInfo?.name     ?? 'Persona'
    const imageUrl = preview?.imageUrl ?? personaInfo?.imageUrl ?? null
    const repoId   = personaInfo?.repoId ?? ''
    return toDrawerLink(share, name, imageUrl, repoId)
  }, [selectedShareId, shares, versionToPersona, shareMeta])

  // Filter + sort — split into three chained memos so a sort change doesn't
  // re-run filtering, and a tag/status change doesn't re-run the sort.
  const statusFiltered = useMemo(() => {
    if (filterStatus === 'active') return personas.filter(p => p.isActive && !p.isPaused)
    if (filterStatus === 'paused') return personas.filter(p => p.isPaused)
    return personas
  }, [personas, filterStatus])

  const tagFiltered = useMemo(() => {
    if (filterTags.length === 0) return statusFiltered
    return statusFiltered.filter(p => filterTags.some(t => p.tags.includes(t)))
  }, [statusFiltered, filterTags])

  const filtered = useMemo(() => {
    const searched = search.trim()
      ? tagFiltered.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
      : tagFiltered
    if (sort === 'az') return searched.toSorted((a, b) => a.name.localeCompare(b.name))
    if (sort === 'za') return searched.toSorted((a, b) => b.name.localeCompare(a.name))
    return searched
  }, [tagFiltered, search, sort])

  // Lookup map for shared-tab — keyed by persona repo id for actions/navigation.
  const personaByRepoId = useMemo(() => {
    const map: Record<string, Persona> = {}
    for (const p of personas) map[p.id] = p
    return map
  }, [personas])

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
      toast.success(name ? `"${name}" deleted` : 'Persona deleted')
    } catch (err) {
      console.error('Failed to delete persona:', err)
      toast.error('Failed to delete persona. Please try again.')
    }
  }

  async function handlePauseToggle(id: string, name: string, currentlyPaused: boolean) {
    try {
      await togglePause(id)
      setPersonas(prev => prev.map(p =>
        p.id === id ? { ...p, isPaused: !p.isPaused, isActive: p.isPaused } : p
      ))
      toast.success(currentlyPaused ? `"${name}" resumed` : `"${name}" paused`)
    } catch (err) {
      console.error('Failed to toggle pause:', err)
      toast.error(`Failed to ${currentlyPaused ? 'resume' : 'pause'} persona. Please try again.`)
    }
  }

  // Super Links: date range — computed here so both the page header and chart card share it
  const slDays = slRange === '7d' ? 7 : slRange === '90d' ? 90 : 30
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
                <Tabs.Trigger value="my-personas">My Agents ({personas.length})</Tabs.Trigger>
                <Tabs.Trigger value="super-links">Super Links</Tabs.Trigger>
                <Tabs.Trigger value="shared">Shared{receivedShares.length > 0 ? ` (${receivedShares.length})` : ''}</Tabs.Trigger>
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
                {activeTab === 'super-links' ? 'Super Links' : activeTab === 'shared' ? 'Shared with me' : 'Agents'}
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
                      {personas.length === 0 ? (
                        <Dropdown.Section>
                          <Dropdown.Item label="No agents yet — create one first" disabled fluid />
                        </Dropdown.Section>
                      ) : (
                        <Dropdown.Section label="Select an agent">
                          {personas.map(p => (
                            <Dropdown.Item
                              key={p.id}
                              label={p.name}
                              onClick={() => {
                                setHeaderGenOpen(false)
                                push(`/persona/configure/sharing?repoId=${p.id}&name=${encodeURIComponent(p.name)}${p.activeVersionId ? `&versionId=${p.activeVersionId}` : ''}`)
                              }}
                              fluid
                            />
                          ))}
                        </Dropdown.Section>
                      )}
                    </Dropdown>
                  </Dropdown.Float>
                ) : activeTab === 'shared' ? null : (
                  <Button
                    variant="default"
                    leftIcon={<PlusSignIcon size={16} />}
                    onClick={() => push('/personas/templates')}
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
                        // eslint-disable-next-line react-doctor/no-outline-none -- browser outline suppressed; :focus-visible handled by container or global styles
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

                  {/* Tag filter dropdown */}
                  <Dropdown.Float
                    open={filterOpen}
                    onOpenChange={setFilterOpen}
                    placement="bottom-end"
                    trigger={
                      <Button variant="secondary" disabled leftIcon={<FilterMailIcon animated />}>
                        Filter
                      </Button>
                    }
                  >
                    <Dropdown>
                      <Dropdown.Section label="Tags">
                        {(['Private', 'Research', 'Public', 'Draft'] as const).map(tag => (
                          <Dropdown.Item
                            key={tag}
                            label={tag}
                            selected={filterTags.includes(tag)}
                            onClick={() => setFilterTags(prev =>
                              prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                            )}
                            fluid
                          />
                        ))}
                      </Dropdown.Section>
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
                search.trim() ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
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
                      No agents matching &ldquo;{search}&rdquo;
                    </p>
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
                    <Button variant="default" onClick={() => push('/personas/templates')}>
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
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap:                 16,
                        paddingBottom:       16,
                      }}
                    >
                      {gridRows[vRow.index].map(persona => (
                        <PersonaCard
                          key={persona.id}
                          variant={persona.status === 'draft' || !persona.hasSystemInstructions || unpublishedMap[persona.id] ? 'draft' : 'default'}
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
                          visibility="private"
                          onEdit={() => { toast.success(`Editing "${persona.name}"`); push(`/persona/configure/instructions?repoId=${persona.id}&name=${encodeURIComponent(persona.name)}`) }}
                          onUseInChat={() => push(`/personas/${persona.id}/chat`)}
                          onResume={() => handlePauseToggle(persona.id, persona.name, persona.isPaused)}
                          onMenuEdit={() => { toast.success(`Editing "${persona.name}"`); push(`/persona/configure/instructions?repoId=${persona.id}&name=${encodeURIComponent(persona.name)}`) }}
                          onMenuPauseToggle={() => handlePauseToggle(persona.id, persona.name, persona.isPaused)}
                          onMenuDelete={() => setDeleteTarget(persona)}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Recommended for you ── (hidden) */}

          {/* ── Shared tab ── */}
          {activeTab === 'shared' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {receivedLoading ? (
                /* Skeleton — card (140px) + strip (~30px) + gap (8px) = ~178px per cell */
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  {receivedShares.map(share => {
                    const persona = personaByRepoId[share.persona_repo_id]
                    return (
                      <SharedAgentCard
                        key={share.share_id}
                        share={share}
                        persona={persona}
                        onEdit={() => push(`/persona/configure/instructions?repoId=${share.persona_repo_id}&name=${encodeURIComponent(share.name)}`)}
                        onUseInChat={() => push(`/personas/${share.persona_repo_id}/chat`)}
                        onPauseToggle={() => persona && handlePauseToggle(persona.id, share.name, persona.isPaused)}
                        onDelete={() => persona && setDeleteTarget(persona)}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Super Links tab ── */}
          {activeTab === 'super-links' && (() => {
            const tokensThisMonth  = shares.reduce((s, l) => s + l.credit_used, 0)
            const activeLinksCount = shares.filter(s => shareStatus(s) === 'active').length
            const estimatedCost    = parseFloat((tokensThisMonth / 1_000_000 * 3).toFixed(2))
            // Use real wave data when usage exists, otherwise fall back to dummy for a realistic preview
            const sparkData: number[] = tokensThisMonth > 0
              ? Array.from({ length: slDays }, (_, i) => {
                  const base = tokensThisMonth / slDays
                  return Math.max(0, Math.round(base * (0.4 + 0.65 * Math.abs(Math.sin(i * 0.55 + 1.2)))))
                })
              : DUMMY_SPARK.slice(0, slDays)
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
                    value={fmtK(tokensThisMonth)}
                    delta="+8.2%"
                    deltaTrend="up"
                    sub="across all links"
                  />
                  <StatCard
                    label="Conversations"
                    value={0}
                    delta="+12.4%"
                    deltaTrend="up"
                    sub="total sessions"
                  />
                  <StatCard
                    label="Active links"
                    value={activeLinksCount}
                    delta="+1"
                    deltaTrend="up"
                    sub={`of ${shares.length} total`}
                  />
                  <StatCard
                    label="Est. cost"
                    value={`$${estimatedCost.toFixed(2)}`}
                    delta="-1.1%"
                    deltaTrend="down"
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
                          {fmtK(tokensThisMonth)}
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
                        {sharesLoading ? 'Loading…' : `Super Links ${shares.length}`}
                      </span>
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
                          {personas.length === 0 ? (
                            <Dropdown.Section>
                              <Dropdown.Item label="No agents yet — create one first" disabled fluid />
                            </Dropdown.Section>
                          ) : (
                            <Dropdown.Section label="Select an agent">
                              {personas.map(p => (
                                <Dropdown.Item
                                  key={p.id}
                                  label={p.name}
                                  onClick={() => {
                                    setPanelGenOpen(false)
                                    push(`/persona/configure/sharing?repoId=${p.id}&name=${encodeURIComponent(p.name)}${p.activeVersionId ? `&versionId=${p.activeVersionId}` : ''}`)
                                  }}
                                  fluid
                                />
                              ))}
                            </Dropdown.Section>
                          )}
                        </Dropdown>
                      </Dropdown.Float>
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
                        const preview     = shareMeta[share.id]
                        const personaInfo = versionToPersona[share.persona_id]
                        const name        = preview?.name     ?? personaInfo?.name     ?? 'Persona'
                        const imageUrl    = preview?.imageUrl ?? personaInfo?.imageUrl ?? null
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
                              push(`/persona/configure/sharing?repoId=${repoId}&name=${encodeURIComponent(name)}&versionId=${share.persona_id}`)
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
                setShares(prev => prev.filter(s => s.id !== id))
                setSelectedShareId(null)
                toast.success('Super Link revoked')
              })
              .catch(() => toast.error('Failed to revoke link'))
          }
        }}
      />

      {/* ── Delete confirmation ── */}
      {deleteTarget && (
        <DeleteDialog
          name={deleteTarget.name}
          onConfirm={() => {
            handleDelete(deleteTarget.id, deleteTarget.name)
            setDeleteTarget(null)
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  )
}
