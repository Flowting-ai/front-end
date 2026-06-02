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
import { listShares, revokeShare, getSharePreview, type PersonaShare } from '@/lib/api/persona-shares'
import Tabs from '@/components/Tabs'
import { PersonaCard } from '@/components/PersonaCard'
import { SuperLinkRow, type SuperLinkStatus } from '@/components/SuperLinkRow'
import { SuperLinkDrawer, type SuperLinkDrawerLink } from '@/components/SuperLinkDrawer'
import { SuperLinksEmpty } from '@/components/SuperLinksEmpty'
import { usePinboard } from '@/context/pinboard-context'
import { toast } from 'sonner'

// ── Types ─────────────────────────────────────────────────────────────────────

type TabId = 'my-personas' | 'shared' | 'super-links' | 'community'
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
        <h2 style={{ fontFamily: 'var(--font-title)', fontSize: 20, fontWeight: 400, color: 'var(--neutral-900)', margin: 0 }}>Delete Persona</h2>
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
    url:            share.share_url.replace(/^https?:\/\//, ''),
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
  const [draftAvatarMap, setDraftAvatarMap] = useState<Record<string, string>>({})
  const [draftTagsMap,   setDraftTagsMap]   = useState<Record<string, string[]>>({})
  const [isLoading,    setIsLoading]    = useState(true)
  const [search,       setSearch]       = useState('')
  const [sort,         setSort]         = useState<SortKey>('activity')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'paused'>('all')
  const [filterTags,   setFilterTags]   = useState<string[]>([])
  const [sortOpen,     setSortOpen]     = useState(false)
  const [allOpen,      setAllOpen]      = useState(false)
  const [filterOpen,   setFilterOpen]   = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Persona | null>(null)

  // Super Links state
  const [shares,         setShares]         = useState<PersonaShare[]>([])
  const [sharesLoading,  setSharesLoading]  = useState(false)
  const [selectedShareId, setSelectedShareId] = useState<string | null>(null)
  // Enriched persona info per share (name + image) fetched from getSharePreview
  const [shareMeta, setShareMeta] = useState<Record<string, { name: string; imageUrl: string | null }>>({})

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
        const avatarOverrides: Record<string, string>   = {}
        const tagOverrides:    Record<string, string[]> = {}
        for (const p of list) {
          try {
            const raw = sessionStorage.getItem(`persona_profile_${p.id}`)
            const draft = JSON.parse(raw ?? 'null') as Record<string, unknown> | null
            if (typeof draft?.avatarUrl === 'string') avatarOverrides[p.id] = draft.avatarUrl
            if (Array.isArray(draft?.personaTags))   tagOverrides[p.id]    = draft.personaTags as string[]
          } catch { /* ignore quota / parse errors */ }
        }
        setDraftAvatarMap(avatarOverrides)
        setDraftTagsMap(tagOverrides)
      })
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [pathname])

  // Fetch link shares whenever the super-links tab is active.
  // Enriches each share with persona name + image via getSharePreview so the
  // display never depends on fragile version-ID cross-matching.
  useEffect(() => {
    if (activeTab !== 'super-links') return
    setSharesLoading(true)
    listShares()
      .then(allShares => {
        const linkShares = allShares.filter(s => s.share_type === 'link')
        setShares(linkShares)
        // Fetch preview data for every share in parallel; failures are silently skipped.
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

            {/* Title row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h1 style={{
                fontFamily: 'var(--font-title)',
                fontWeight: 'var(--font-weight-regular)',
                fontSize: 24,
                lineHeight: '32px',
                color: '#1a1916',
                margin: 0,
              }}>
                Persona
              </h1>
              <Button
                variant="default"
                leftIcon={<PlusSignIcon size={16} />}
                onClick={() => push('/personas/templates')}
              >
                New persona
              </Button>
            </div>

            {/* Tabs + toolbar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)}>
                <Tabs.List>
                  <Tabs.Trigger value="my-personas">My Personas ({personas.length})</Tabs.Trigger>
                  <Tabs.Trigger value="shared" disabled>Shared</Tabs.Trigger>
                  <Tabs.Trigger value="super-links">Super Links</Tabs.Trigger>
                  {/* Disabled community section for now since we don't have a real source of recommended personas yet, and it was causing confusion having the mock data visible in the UI */}
                  {/* <Tabs.Trigger value="community" disabled>Community</Tabs.Trigger> */}
                </Tabs.List>
              </Tabs>

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
                      placeholder="Search persona"
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
                      No personas matching &ldquo;{search}&rdquo;
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
                        No personas yet
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
                        Personas are your custom AI configurations - define behavior, connect knowledge, and share via link.
                      </p>
                    </div>
                    <Button variant="default" onClick={() => push('/personas/templates')}>
                      Create your first persona
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
                          variant={persona.status === 'draft' || !persona.hasSystemInstructions ? 'draft' : 'default'}
                          name={persona.name}
                          handle={persona.handle.replace(/^@/, '')}
                          description={persona.description}
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

          {/* ── Super Links tab ── */}
          {activeTab === 'super-links' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--font-size-caption)',
                  lineHeight: 'var(--line-height-caption)',
                  color: 'var(--neutral-500)',
                }}>
                  {sharesLoading ? 'Loading…' : `${shares.length} link${shares.length === 1 ? '' : 's'}`}
                </span>
              </div>

              {/* Table header */}
              {!sharesLoading && shares.length > 0 && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 120px 160px',
                  padding: '0 16px',
                  gap: 12,
                }}>
                  {(['Persona', 'Status', 'Token budget'] as const).map(col => (
                    <span key={col} style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--font-size-caption)',
                      lineHeight: 'var(--line-height-caption)',
                      fontWeight: 'var(--font-weight-medium)',
                      color: 'var(--neutral-500)',
                      letterSpacing: '0.03em',
                      textTransform: 'uppercase',
                    }}>{col}</span>
                  ))}
                </div>
              )}

              {/* Skeleton */}
              {sharesLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} style={{
                      height: 80,
                      borderRadius: 14,
                      background: 'var(--neutral-100)',
                      animation: 'pulse 0.9s ease-in-out infinite',
                    }} />
                  ))}
                </div>
              )}

              {/* Empty state */}
              {!sharesLoading && shares.length === 0 && (
                <SuperLinksEmpty onBrowsePersonas={() => setActiveTab('my-personas')} />
              )}

              {/* Rows */}
              {!sharesLoading && shares.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {shares.map(share => {
                    const preview     = shareMeta[share.id]
                    const personaInfo = versionToPersona[share.persona_id]
                    // shareMeta (from getSharePreview) is the authoritative name/image source.
                    // versionToPersona provides the repoId needed for navigation.
                    const name     = preview?.name     ?? personaInfo?.name     ?? 'Persona'
                    const imageUrl = preview?.imageUrl ?? personaInfo?.imageUrl ?? null
                    const repoId   = personaInfo?.repoId ?? ''
                    return (
                      <SuperLinkRow
                        key={share.id}
                        personaName={name}
                        avatarColor={colorFromName(name)}
                        avatarUrl={imageUrl}
                        url={share.share_url.replace(/^https?:\/\//, '')}
                        tokenUsed={share.credit_used}
                        tokenLimit={share.credit_limit ?? 0}
                        status={shareStatus(share)}
                        selected={selectedShareId === share.id}
                        onClick={() => setSelectedShareId(share.id)}
                        onConfigure={repoId ? (e) => {
                          e.stopPropagation()
                          push(`/persona/configure/sharing?repoId=${repoId}&name=${encodeURIComponent(name)}&versionId=${share.persona_id}`)
                        } : undefined}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          )}

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
