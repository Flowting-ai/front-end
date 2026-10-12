'use client'

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { PlusSignIcon, AlertTwoIcon } from '@strange-huge/icons'
import { Button } from '@/components/ui/button'
import { type Persona } from '@/lib/api/personas'
import { can, type AgentViewer } from '@/lib/agent-permissions'
import { useQueryClient } from '@tanstack/react-query'
import { usePersonas, PERSONAS_QUERY_KEY } from '@/lib/queries/personas'
import { normalizeModels } from '@/lib/ai-models'
import { buildModelBlockedMap, modelUnavailableReason as resolveModelUnavailableReason, patchableVersionId, type ModelUnavailableReason } from '@/lib/agent-model-health'
import { useDevNotificationsVersion } from '@/lib/notifications/dev'
import { fetchAllModels } from '@/lib/api/models'
import type { AIModel } from '@/types/ai-model'
import { AGENTS_SEE_ALL_EVENT } from '@/hooks/use-sidebar-events'
import { fetchDashboard, listShares, revokeShare, type PersonaShare } from '@/lib/api/persona-shares'
import { personaTagsKey, personaProfileKey } from '@/lib/storage-keys'
import { AGENTS_ROUTE, AGENTS_NEW_ROUTE, AGENT_EDIT_ROUTE } from '@/lib/routes'
import Tabs from '@/components/Tabs'
import { useAgentFilters, EMPTY_FILTERS } from './_hooks/use-agent-filters'
import { resolveModelName as resolveModelNameFor } from './_lib/agent-models'
import { AgentsToolbar } from './_components/AgentsToolbar'
import { useAgentActions } from './_hooks/use-agent-actions'
import { AgentsGrid } from './_components/AgentsGrid'
import { DeleteAgentDialog } from './_components/DeleteAgentDialog'
import { SuperLinksTab } from './_components/SuperLinksTab'
import { useSuperLinksData } from './_hooks/use-super-links-data'
import { AgentDetailsSidebar } from '@/components/AgentEditor/AgentDetailsSidebar'
import { SuperLinkDrawer, type SuperLinkDrawerLink } from '@/components/SuperLinkDrawer'
import type { UnavailableModelAgent } from '@/components/FixAgentModelsModal'
import dynamic from 'next/dynamic'

// Modals are only needed after a user action — keep them out of the list route's first chunk.
const AgentShareModal = dynamic(() => import('@/components/AgentShareModal').then(m => m.AgentShareModal), { ssr: false })
const ChangeAgentModelModal = dynamic(() => import('@/components/ChangeAgentModelModal').then(m => m.ChangeAgentModelModal), { ssr: false })
const FixAgentModelsModal = dynamic(() => import('@/components/FixAgentModelsModal').then(m => m.FixAgentModelsModal), { ssr: false })
import { usePinboard } from '@/context/pinboard-context'
import { useOrg } from '@/context/org-context'
import { useAuth } from '@/context/auth-context'
import { resolveViewerUserId } from '@/lib/api/teams'
import { toast } from 'sonner'
import { toastAgentDetailsOpened, toastAgentDetailsClosed } from '@/lib/agent-details-toast'

import { toDrawerLink } from './_lib/super-links'

// ── Types ─────────────────────────────────────────────────────────────────────

const EMPTY_PERSONAS: Persona[] = []
const EMPTY_UNPUBLISHED: Record<string, boolean> = {}

type TabId = 'my-personas' | 'super-links'
const TAB_IDS: TabId[] = ['my-personas', 'super-links']

// Team has no backend route left at all, so there's no way to resolve a
// shared persona's real owner any more — isPersonaOwnedByViewer falls back to
// the coarse currentUserRole check for every org-shared persona (accepted
// capability gap). Module-level so its reference stays stable across renders
// instead of invalidating memoized values that depend on it every time.
const EMPTY_PERSONA_OWNER_MAP: Record<string, string> = {}
/** Reads `?tab=` — anything missing or unrecognized falls back to "My Agents". */
function parseTabParam(value: string | null): TabId {
  return (TAB_IDS as string[]).includes(value ?? '') ? (value as TabId) : 'my-personas'
}

// ── Page ──────────────────────────────────────────────────────────────────────

function PersonasPageInner() {
  const { push, replace } = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { close: closePinboard } = usePinboard()
  const { currentUserRole, members } = useOrg()
  const { user } = useAuth()
  // `user?.id` is never populated (see resolveViewerUserId) — resolve the
  // viewer's internal id via the org member list instead, so ownership checks
  // below actually match against `personaOwnerMap`'s id space.
  const viewerUserId = resolveViewerUserId(members, user?.email)

  const personaOwnerMap = EMPTY_PERSONA_OWNER_MAP

  const viewer = useMemo<AgentViewer>(
    () => ({ userId: viewerUserId, isAdmin: currentUserRole === 'admin', ownerMap: personaOwnerMap }),
    [viewerUserId, currentUserRole, personaOwnerMap],
  )

  // Seeded from the URL so a reload, a shared link, or Back/Forward lands on
  // the same tab the user was looking at — not always back at "My Agents".
  const [activeTab, setActiveTabState] = useState<TabId>(() => parseTabParam(searchParams.get('tab')))

  // Re-sync any time the URL's ?tab= changes from outside a click on this
  // page's own Tabs (Back/Forward, or a link landing here with a tab param).
  useEffect(() => {
    const urlTab = parseTabParam(searchParams.get('tab'))
    setActiveTabState(prev => (prev === urlTab ? prev : urlTab))
  }, [searchParams])

  // Sets the tab AND keeps the URL's ?tab= in sync, so the current tab
  // survives a reload/back-nav and links to this page can target a specific
  // tab. `replace` (not `push`) — switching tabs isn't a new history entry.
  function setActiveTab(next: TabId) {
    setActiveTabState(next)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', next)
    replace(`${AGENTS_ROUTE}?${params.toString()}`, { scroll: false })
  }

  // The agent whose details panel is open lives in the URL (?agent=<id>) so a
  // reload, a shared link, or landing here right after creating an agent shows it.
  const detailsId = searchParams.get('agent')

  function openDetails(id: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('agent', id)
    replace(`${AGENTS_ROUTE}?${params.toString()}`, { scroll: false })
    const name = personas.find(p => p.id === id)?.name
    toastAgentDetailsOpened(name)
  }

  function closeDetails() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('agent')
    const query = params.toString()
    replace(query ? `${AGENTS_ROUTE}?${query}` : AGENTS_ROUTE, { scroll: false })
    toastAgentDetailsClosed()
  }

  // The sidebar's "See all agents" row emits this while this page is already
  // mounted (a same-URL push wouldn't reset activeTab on its own) — always
  // land back on "My Agents", regardless of which tab was active.
  useEffect(() => {
    const handler = () => setActiveTab('my-personas')
    window.addEventListener(AGENTS_SEE_ALL_EVENT, handler)
    return () => window.removeEventListener(AGENTS_SEE_ALL_EVENT, handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // The list lives in the shared React Query cache (also read by the sidebar and
  // fetchPersonas()). bustPersonasCache() — called by every mutation — refetches it
  // while this page is mounted, and the 30s freshness window covers plain navigation.
  const queryClient = useQueryClient()
  const { data: personasData, isLoading } = usePersonas()
  const personas = personasData ?? EMPTY_PERSONAS
  // Optimistic local edits (pause, delete, model change) patch the shared cache.
  const setPersonas = useCallback((update: (prev: Persona[]) => Persona[]) => {
    queryClient.setQueryData<Persona[]>(PERSONAS_QUERY_KEY, prev => (prev ? update(prev) : prev))
  }, [queryClient])
  // Avatar/tag overrides from sessionStorage (current-session edits) with localStorage as the
  // cross-session fallback for tags. Only non-empty values are kept so stale empty arrays never
  // shadow real API data via the ?? operator.
  const { draftAvatarMap, draftTagsMap } = useMemo(() => {
    const avatarOverrides: Record<string, string>   = {}
    const tagOverrides:    Record<string, string[]> = {}
    for (const p of personas) {
      try {
        const raw = sessionStorage.getItem(personaProfileKey(p.id))
        const draft = JSON.parse(raw ?? 'null') as Record<string, unknown> | null
        const draftAvatar = draft?.avatarUrl as string | undefined
        let   draftTags   = draft?.personaTags as string[] | undefined
        if (!Array.isArray(draftTags) || draftTags.length === 0) {
          try {
            const lsTags = JSON.parse(localStorage.getItem(personaTagsKey(p.id)) ?? 'null') as string[] | null
            if (Array.isArray(lsTags) && lsTags.length > 0) draftTags = lsTags
          } catch { /* ignore */ }
        }
        if (typeof draftAvatar === 'string' && draftAvatar) avatarOverrides[p.id] = draftAvatar
        if (Array.isArray(draftTags) && draftTags.length > 0) tagOverrides[p.id]  = draftTags
      } catch { /* ignore quota / parse errors */ }
    }
    return { draftAvatarMap: avatarOverrides, draftTagsMap: tagOverrides }
  }, [personas])
  const unpublishedMap = EMPTY_UNPUBLISHED
  const [deleteTarget,  setDeleteTarget]  = useState<Persona | null>(null)
  const [changeModelTarget, setChangeModelTarget] = useState<Persona | null>(null)
  const [fixModelsOpen,     setFixModelsOpen]     = useState(false)
  // Latch: mount the lazy modal on first open, then keep it mounted so its state/exit behave as before.
  const [fixModelsMounted,  setFixModelsMounted]  = useState(false)
  if (fixModelsOpen && !fixModelsMounted) setFixModelsMounted(true)
  const [allSharesForFilter, setAllSharesForFilter] = useState<PersonaShare[]>([])
  // Full catalog (blocked models included) so a persona whose model was disabled
  // in Settings, or retired by the provider, still resolves to a real name here
  // instead of falling through to the raw model id.
  const [modelsForNameLookup, setModelsForNameLookup] = useState<AIModel[]>([])
  // Flips once the catalog request above settles (even empty/failed) — the
  // ?fixModel= deep link waits on it so it never decides on a half-loaded page.
  const [modelCatalogSettled, setModelCatalogSettled] = useState(false)
  const filterSharesLoadedRef = useRef(false)

  // Super Links state
  const {
    dashboard, setDashboard, sharesLoading, dashboardRefreshing, refreshDashboard: handleRefreshDashboard,
    slRange, setSlRange, slDays, receivedShares, setReceivedShares, receivedLoading,
  } = useSuperLinksData({ active: activeTab === 'super-links', pathname })
  const [selectedShareId,    setSelectedShareId]    = useState<string | null>(null)
  // The agent whose share modal is open (card Share button, ⋯ → Share, Super Links tab).
  const [shareTarget,        setShareTarget]        = useState<{ repoId: string; name: string } | null>(null)
  // Close the pinboard whenever the personas page is mounted.
  useEffect(() => { closePinboard() }, [closePinboard])

  // Silently load all shares + models once for the filter panel.
  // The super-links tab has its own loading effect that will overwrite shares on activation.
  useEffect(() => {
    if (activeTab !== 'my-personas' || filterSharesLoadedRef.current) return
    filterSharesLoadedRef.current = true
    listShares()
      .then(setAllSharesForFilter)
      .catch(() => {})
    fetchAllModels()
      .then(list => setModelsForNameLookup(normalizeModels(list)))
      .catch(() => {})
      .finally(() => setModelCatalogSettled(true))
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
    const personaInfo = versionToPersona[share.persona_repo_id]
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
      const info = versionToPersona[share.persona_repo_id]
      if (info?.repoId) s.add(info.repoId)
      else s.add(share.persona_repo_id)
    }
    return s
  }, [allSharesForFilter, versionToPersona])

  // Visibility comes from the persona repo itself. Super Links are a separate
  // sharing surface and are handled by the Super Link filter below.
  const visibilityForPersona = useMemo(() => {
    const map: Record<string, 'private' | 'team'> = {}
    for (const p of personas) {
      map[p.id] = p.visibility
    }
    return map
  }, [personas])

  // "Created by" footer attribution — "You" for agents the viewer owns,
  // otherwise the actual owner's name resolved via personaOwnerMap + org members.
  const createdByForPersona = useMemo(() => {
    const map: Record<string, string> = {}
    for (const p of personas) {
      if (can(viewer, 'list', p)) { map[p.id] = 'You'; continue }
      const ownerId = personaOwnerMap[p.id]
      const owner = ownerId ? members.find(m => m.id === ownerId) : undefined
      if (owner) map[p.id] = owner.name
    }
    return map
  }, [personas, personaOwnerMap, members, viewer])

  // Map from stable model ID → human-readable model name (from the full API
  // models list, including blocked ones — see modelsForNameLookup above).
  const modelIdToName = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of modelsForNameLookup) {
      const key = String(m.modelId ?? m.id ?? '')
      if (key) map.set(key, m.modelName)
    }
    return map
  }, [modelsForNameLookup])

  function resolveModelName(modelId: string | null): string | null {
    return resolveModelNameFor(modelIdToName, modelId)
  }

  // Map from stable model ID → whether the user has disabled it in Settings.
  // Absence from the map (rather than false) means it's gone from the catalog
  // entirely — deprecated/retired by the provider.
  const modelIdToBlocked = useMemo(() => buildModelBlockedMap(modelsForNameLookup), [modelsForNameLookup])

  // Dev builds only: re-render when the /dev/notifications playground
  // simulates a model outage, so the cards below pick it up. Always 0 in prod.
  const devNotificationsVersion = useDevNotificationsVersion()

  // Why a persona's configured model can't be used, or null when it's fine.
  // 'blocked' — still in the catalog but turned off for this account.
  // 'retired' — absent from the catalog entirely (deprecated by the provider).
  // The two get different copy, so they can't collapse into one boolean here.
  // Requires the full catalog to have loaded at least once — otherwise every
  // persona would flash as unavailable during the initial fetch. Shared with
  // the sidebar notification bell via lib/agent-model-health.
  function modelUnavailableReason(modelId: string | null): ModelUnavailableReason | null {
    return resolveModelUnavailableReason(modelId, modelIdToBlocked)
  }

  // Draft/unpublished cards already have their own "finish setup" treatment,
  // so they never get the model-unavailable overlay on top of it.
  function isDraftLike(persona: Persona): boolean {
    return persona.status === 'draft' || !persona.hasSystemInstructions || !!unpublishedMap[persona.id]
  }

  // patchableVersionId (the version a model reassignment would write to) now
  // lives in lib/agent-model-health alongside the rest of this logic.

  // Team-shared agents the caller doesn't own aren't "theirs" yet — they only
  // belong on this page once cloned (via the project Team panel's "Use" action,
  // or the chat persona picker). Until then they live only in the team panel,
  // not mixed into this personal library.
  const visiblePersonas = useMemo(
    () => personas.filter(p => can(viewer, 'list', p)),
    [personas, viewer],
  )

  // Every agent that can't run because of its model, in the exact same set the
  // cards mark as unavailable. Deliberately NOT narrowed by the toolbar
  // filters — "3 agents are broken" has to stay true regardless of what the
  // user is currently filtering by. Agents with no patchable version are left
  // out: there'd be nothing to write the replacement to.
  const unavailableAgents = useMemo(() => {
    const rows: UnavailableModelAgent[] = []
    for (const persona of visiblePersonas) {
      if (isDraftLike(persona)) continue
      const reason = modelUnavailableReason(persona.modelId)
      if (!reason) continue
      const versionId = patchableVersionId(persona)
      if (!versionId) continue
      rows.push({
        id:        persona.id,
        name:      persona.name,
        avatarUrl: draftAvatarMap[persona.id] ?? persona.imageUrl,
        versionId,
        modelId:   persona.modelId,
        modelName: resolveModelName(persona.modelId),
        reason,
      })
    }
    return rows
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visiblePersonas, modelIdToBlocked, modelIdToName, unpublishedMap, draftAvatarMap, devNotificationsVersion])

  // ?fixModel=<id> — where the sidebar bell's "<agent> needs attention" rows
  // land. Once the agents and the model catalog have both loaded, open the
  // single-agent Change model modal; if the agent was fixed in the meantime,
  // show its details instead. The param is dropped either way so a reload or
  // Back doesn't reopen the modal.
  const fixModelId = searchParams.get('fixModel')
  useEffect(() => {
    if (!fixModelId || isLoading || !modelCatalogSettled) return
    const params = new URLSearchParams(searchParams.toString())
    params.delete('fixModel')
    const persona = personas.find(p => p.id === fixModelId)
    if (!persona) {
      toast.info('That agent is no longer in your library.')
    } else if (modelUnavailableReason(persona.modelId) && patchableVersionId(persona)) {
      setChangeModelTarget(persona)
    } else {
      toast.success(`${persona.name} is already on an available model.`)
      params.set('agent', persona.id)
    }
    const query = params.toString()
    replace(query ? `${AGENTS_ROUTE}?${query}` : AGENTS_ROUTE, { scroll: false })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixModelId, isLoading, modelCatalogSettled, personas])

  // Search / sort / filter state and the resulting list (see use-agent-filters).
  const {
    search, setSearch, sort, setSort, filters, setFilters,
    activeFilterCount, toggleFilter, uniqueModelNames, filtered,
  } = useAgentFilters({ personas, visiblePersonas, visibilityForPersona, activeShareRepoIds, modelIdToName })

  const personasScrollRef = useRef<HTMLDivElement>(null)
  const {
    pausingIds, handleDelete, handleCopyAndEdit, handleUseInChat,
    handleUseTeamSharedInChat, handleUseReceivedShareInChat, handlePauseToggle,
  } = useAgentActions({
    personas,
    onDeleted: (id) => setReceivedShares(prev => prev.filter(sh => sh.persona_repo_id !== id)),
  })

  return (
    <>
      <div
        style={{
          background: 'var(--color-surface-container)',
          border: '1px solid var(--border-default)',
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
                <Tabs.Trigger value="super-links">Super Links</Tabs.Trigger>
              </Tabs.List>
            </Tabs>

            {/* Title row — changes per tab */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h1 style={{
                fontFamily: 'var(--font-title)',
                fontWeight: 'var(--font-weight-regular)',
                fontSize: 24,
                lineHeight: '32px',
                color: 'var(--legacy-1a1916)',
                margin: 0,
              }}>
                {activeTab === 'super-links' ? 'Super Links' : 'Agents'}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Super Links' own "Generate link" trigger now lives with the
                    links list section below (where it's contextually useful),
                    instead of being duplicated here too. */}
                {activeTab === 'super-links' ? null : (
                  <>
                    {/* Only appears when something is actually broken — a
                        standing button here would read as a permanent chore. */}
                    {unavailableAgents.length > 0 && (
                      <Button
                        variant="secondary"
                        leftIcon={<AlertTwoIcon size={16} color="var(--color-tag-Yellow-text)" />}
                        onClick={() => setFixModelsOpen(true)}
                      >
                        {unavailableAgents.length === 1
                          ? 'Fix 1 agent'
                          : `Fix ${unavailableAgents.length} agents`}
                      </Button>
                    )}
                    <Button
                      variant="default"
                      leftIcon={<PlusSignIcon size={16} />}
                      onClick={() => push(AGENTS_NEW_ROUTE)}
                    >
                      New agent
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Toolbar — only shown on My Personas tab */}
            {activeTab === 'my-personas' && (
              <AgentsToolbar
                search={search}
                setSearch={setSearch}
                sort={sort}
                setSort={setSort}
                filters={filters}
                setFilters={setFilters}
                activeFilterCount={activeFilterCount}
                toggleFilter={toggleFilter}
                uniqueModelNames={uniqueModelNames}
              />
            )}
          </div>

          {/* ── Persona grid ── */}
          {activeTab === 'my-personas' && (
            <AgentsGrid
              scrollRef={personasScrollRef}
              isLoading={isLoading}
              filtered={filtered}
              search={search}
              activeFilterCount={activeFilterCount}
              onClearFilters={() => setFilters(EMPTY_FILTERS)}
              onCreateAgent={() => push(AGENTS_NEW_ROUTE)}
              viewer={viewer}
              activeShareRepoIds={activeShareRepoIds}
              visibilityForPersona={visibilityForPersona}
              createdByForPersona={createdByForPersona}
              draftAvatarMap={draftAvatarMap}
              draftTagsMap={draftTagsMap}
              isDraftLike={isDraftLike}
              modelUnavailableReason={modelUnavailableReason}
              resolveModelName={resolveModelName}
              pausingIds={pausingIds}
              handleCopyAndEdit={handleCopyAndEdit}
              handleUseTeamSharedInChat={handleUseTeamSharedInChat}
              handleUseInChat={handleUseInChat}
              handlePauseToggle={handlePauseToggle}
              onOpenDetails={openDetails}
              onEdit={(id) => push(AGENT_EDIT_ROUTE(id))}
              onShare={setShareTarget}
              onChangeModel={setChangeModelTarget}
              onDelete={setDeleteTarget}
            />
          )}


          {/* ── Recommended for you ── (hidden) */}

          {/* ── Super Links tab ── */}
          {activeTab === 'super-links' && (
            <SuperLinksTab
              dashboard={dashboard}
              sharesLoading={sharesLoading}
              dashboardRefreshing={dashboardRefreshing}
              onRefreshDashboard={handleRefreshDashboard}
              slRange={slRange}
              setSlRange={setSlRange}
              slDays={slDays}
              shares={shares}
              receivedShares={receivedShares}
              receivedLoading={receivedLoading}
              versionToPersona={versionToPersona}
              personaByRepoId={personaByRepoId}
              visiblePersonas={visiblePersonas}
              setSelectedShareId={setSelectedShareId}
              setShareTarget={setShareTarget}
              setDeleteTarget={setDeleteTarget}
              onBrowseAgents={() => setActiveTab('my-personas')}
              onUseReceivedShareInChat={handleUseReceivedShareInChat}
            />
          )}

        </div>
      </div>
      </div>

      {/* ── Agent details (right sidebar) ── */}
      <AgentDetailsSidebar
        repoId={detailsId}
        canEdit={(() => {
          const target = personas.find(p => p.id === detailsId)
          // Unknown yet (e.g. just created, list still refreshing): the panel
          // loads the agent itself, and an agent that isn't the viewer's never loads.
          return target ? can(viewer, 'edit', target) : true
        })()}
        onClose={closeDetails}
      />

      {/* ── Share modal ── */}
      {shareTarget && (
        <AgentShareModal
          open
          repoId={shareTarget.repoId}
          agentName={shareTarget.name}
          onClose={() => setShareTarget(null)}
          onChanged={() => {
            // Links / invites changed: refresh the dashboard + the "has a link" badges.
            fetchDashboard(slDays).then(setDashboard).catch(console.error)
            listShares().then(setAllSharesForFilter).catch(console.error)
          }}
        />
      )}

      {/* ── Super Link drawer ── */}
      <SuperLinkDrawer
        link={selectedDrawerLink}
        onClose={() => setSelectedShareId(null)}
        onStatusChange={async (next) => {
          if (next === 'revoked' && selectedShareId) {
            const id = selectedShareId
            try {
              await revokeShare(id)
              setDashboard(prev => prev ? { ...prev, links: prev.links.filter(s => s.id !== id) } : prev)
              setSelectedShareId(null)
              toast.success('Super Link revoked')
            } catch {
              toast.error('Failed to revoke link')
            }
          }
        }}
      />

      {/* ── Change model — single card ── */}
      {changeModelTarget && patchableVersionId(changeModelTarget) && (
        <ChangeAgentModelModal
          // Fresh instance per agent — the picker's selection is per-agent state.
          key={changeModelTarget.id}
          open
          onClose={() => setChangeModelTarget(null)}
          personaId={changeModelTarget.id}
          versionId={patchableVersionId(changeModelTarget)!}
          agentName={changeModelTarget.name}
          currentModelId={changeModelTarget.modelId}
          currentModelName={resolveModelName(changeModelTarget.modelId)}
          reason={modelUnavailableReason(changeModelTarget.modelId) ?? undefined}
          onSaved={({ modelId }) => {
            setPersonas(prev => prev.map(p => p.id === changeModelTarget.id ? { ...p, modelId } : p))
          }}
        />
      )}

      {/* ── Fix models — every affected agent at once ── */}
      {fixModelsMounted && <FixAgentModelsModal
        open={fixModelsOpen}
        onClose={() => setFixModelsOpen(false)}
        agents={unavailableAgents}
        onSaved={(updates) => {
          const byId = new Map(updates.map(u => [u.id, u.modelId]))
          setPersonas(prev => prev.map(p => byId.has(p.id) ? { ...p, modelId: byId.get(p.id)! } : p))
        }}
      />}

      <DeleteAgentDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={(p) => handleDelete(p.id, p.name)} />
    </>
  )
}

export default function PersonasPage() {
  return (
    <Suspense fallback={null}>
      <PersonasPageInner />
    </Suspense>
  )
}
