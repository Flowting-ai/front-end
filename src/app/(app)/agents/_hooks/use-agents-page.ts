'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { type Persona } from '@/lib/api/personas'
import { can, type AgentViewer } from '@/lib/agent-permissions'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { usePersonas, PERSONAS_QUERY_KEY } from '@/lib/queries/personas'
import { normalizeModels } from '@/lib/ai-models'
import { buildModelBlockedMap, modelUnavailableReason as resolveModelUnavailableReason, patchableVersionId, type ModelUnavailableReason } from '@/lib/agent-model-health'
import { useDevNotificationsVersion } from '@/lib/notifications/dev'
import { fetchAllModels } from '@/lib/api/models'
import type { AIModel } from '@/types/ai-model'
import { AGENTS_SEE_ALL_EVENT } from '@/hooks/use-sidebar-events'
import { type PersonaShare } from '@/lib/api/persona-shares'
import { personaSharesQuery } from '@/lib/share/share-queries'
import { personaTagsKey, personaProfileKey } from '@/lib/storage-keys'
import { AGENTS_ROUTE } from '@/lib/routes'
import { useAgentFilters } from '../_hooks/use-agent-filters'
import { resolveModelName as resolveModelNameFor } from '../_lib/agent-models'
import { useAgentActions } from '../_hooks/use-agent-actions'
import { useSuperLinksData } from '../_hooks/use-super-links-data'
import { type SuperLinkDrawerLink } from '@/components/SuperLinkDrawer'
import type { UnavailableModelAgent } from '@/components/FixAgentModelsModal'

import { usePinboard } from '@/context/pinboard-context'
import { useOrg } from '@/context/org-context'
import { useAuth } from '@/context/auth-context'
import { resolveViewerUserId } from '@/lib/api/teams'
import { toast } from 'sonner'
import { toastAgentDetailsOpened, toastAgentDetailsClosed } from '@/lib/agent-details-toast'

import { toDrawerLink } from '../_lib/super-links'

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

/** State and actions for PersonasPageInner (moved out of the view unchanged). */
export function useAgentsPage() {
  const { push, replace } = useRouter()
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
    dashboard, sharesLoading, dashboardRefreshing, refreshDashboard: handleRefreshDashboard,
    slRange, setSlRange, slDays, receivedShares, setReceivedShares, receivedLoading,
  } = useSuperLinksData({ active: activeTab === 'super-links' })
  // All shares, for the filter panel and the "has a link" badges (shared query).
  const sharesQ = useQuery(personaSharesQuery(activeTab === 'my-personas'))
  const allSharesForFilter: PersonaShare[] = useMemo(() => sharesQ.data ?? [], [sharesQ.data])
  const [selectedShareId,    setSelectedShareId]    = useState<string | null>(null)
  // The agent whose share modal is open (card Share button, ⋯ → Share, Super Links tab).
  const [shareTarget,        setShareTarget]        = useState<{ repoId: string; name: string } | null>(null)
  // Close the pinboard whenever the personas page is mounted.
  useEffect(() => { closePinboard() }, [closePinboard])

  // Silently load the models once for the filter panel (shares come from sharesQ).
  useEffect(() => {
    if (activeTab !== 'my-personas' || filterSharesLoadedRef.current) return
    filterSharesLoadedRef.current = true
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

  return { push, replace, searchParams, closePinboard, currentUserRole, members, user, viewerUserId, personaOwnerMap, viewer, activeTab, setActiveTabState, setActiveTab, detailsId, openDetails, closeDetails, queryClient, personasData, isLoading, personas, setPersonas, draftAvatarMap, draftTagsMap, unpublishedMap, deleteTarget, setDeleteTarget, changeModelTarget, setChangeModelTarget, fixModelsOpen, setFixModelsOpen, fixModelsMounted, setFixModelsMounted, modelsForNameLookup, setModelsForNameLookup, modelCatalogSettled, setModelCatalogSettled, filterSharesLoadedRef, sharesQ, allSharesForFilter, selectedShareId, setSelectedShareId, shareTarget, setShareTarget, versionToPersona, shares, selectedDrawerLink, personaByRepoId, activeShareRepoIds, visibilityForPersona, createdByForPersona, modelIdToName, resolveModelName, modelIdToBlocked, devNotificationsVersion, modelUnavailableReason, isDraftLike, visiblePersonas, unavailableAgents, fixModelId, personasScrollRef, dashboard, sharesLoading, dashboardRefreshing, handleRefreshDashboard, slRange, setSlRange, slDays, receivedShares, setReceivedShares, receivedLoading, search, setSearch, sort, setSort, filters, setFilters, activeFilterCount, toggleFilter, uniqueModelNames, filtered, pausingIds, handleDelete, handleCopyAndEdit, handleUseInChat, handleUseTeamSharedInChat, handleUseReceivedShareInChat, handlePauseToggle }
}
