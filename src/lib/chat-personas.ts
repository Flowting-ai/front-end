import {
  fetchPersonas,
  isPersonaOwnedByViewer,
  usePersonaRepoDeduped,
  PERSONAS_LIST_UPDATED_EVENT,
  type Persona,
  type PersonaRepoResponse,
} from '@/lib/api/personas'

export interface SelectedPersonaInfo {
  id:              string
  name:            string
  handle:          string
  imageUrl:        string | null
  modelId:         string | null
  activeVersionId: string | null
  /** null = not yet fetched from the version; populated by the model-selector effect. */
  systemPrompt:    string | null
  temperature:     number | null
  visibility:      'private' | 'team'
  /** True when the viewer owns this persona outright (not a team-shared copy). */
  ownedByViewer:   boolean
  description:     string
  tags:            string[]
  paused:          boolean
  /** True when this card should show the "shared" badge — mirrors /agents page's logic. */
  shared:          boolean
}

type CopyPersona = (repoId: string, sourceVersionId?: string | null) => Promise<PersonaRepoResponse>

const copiedPersonaCache = new Map<string, SelectedPersonaInfo>()

export function toSelectedPersona(persona: Persona, ownedByViewer: boolean): SelectedPersonaInfo {
  return {
    id: persona.id,
    name: persona.name,
    handle: persona.handle,
    imageUrl: persona.imageUrl,
    modelId: persona.modelId,
    activeVersionId: persona.activeVersionId,
    systemPrompt: null,
    temperature: persona.temperature,
    visibility: persona.visibility,
    ownedByViewer,
    description: persona.description,
    tags: persona.tags,
    paused: persona.isPaused,
    shared: persona.sourceShareId !== null || (persona.visibility === 'team' && !ownedByViewer),
  }
}

/** Maps a freshly-copied repo (from the team-shared "/use" clone flow) into
 *  the same shape — the copy has its own version data, but display fields
 *  (name/handle/description/tags) still come from the original source persona. */
export function toSelectedPersonaFromCopy(copy: PersonaRepoResponse, source: Persona): SelectedPersonaInfo {
  const version = copy.published_version ?? copy.active_version
  return {
    id: copy.id,
    name: source.name,
    handle: source.handle,
    imageUrl: version?.image_url ?? source.imageUrl,
    modelId: version?.model_id ?? source.modelId,
    activeVersionId: copy.published_version_id ?? null,
    systemPrompt: null,
    temperature: version?.temperature ?? source.temperature,
    visibility: source.visibility,
    ownedByViewer: false,
    description: source.description,
    tags: source.tags,
    paused: source.isPaused,
    // Always true here — this path only runs for personas the viewer doesn't own.
    shared: true,
  }
}

/**
 * Convert every backend-visible agent into a chat-selectable agent. Shared agents
 * owned by someone else are copied through the existing `/use` flow because chat
 * execution only accepts a persona version owned by the caller.
 */
export async function resolveSelectableChatPersonas(
  personas: Persona[],
  ownerMap: Record<string, string>,
  viewerUserId: string | number | null | undefined,
  fallbackOwned: boolean,
  copyPersona: CopyPersona = usePersonaRepoDeduped,
): Promise<SelectedPersonaInfo[]> {
  const resolved = await Promise.all(personas.map(async persona => {
    const ownedByViewer = isPersonaOwnedByViewer(persona, ownerMap, viewerUserId, fallbackOwned)
    if (ownedByViewer) return toSelectedPersona(persona, ownedByViewer)

    const cached = copiedPersonaCache.get(persona.id)
    if (cached) return cached

    try {
      const copy = await copyPersona(persona.id, persona.activeVersionId)
      const selected = toSelectedPersonaFromCopy(copy, persona)
      copiedPersonaCache.set(persona.id, selected)
      return selected
    } catch {
      // Do NOT fall back to the original, not-owned persona here — its
      // `activeVersionId` belongs to whoever created it, not the viewer, and
      // chat execution hard-rejects a version id that isn't the caller's own
      // (backend: `persona.user_id != user_id` -> 404 "Persona not found").
      // A chip built from that data looks perfectly normal (name, avatar,
      // model all populate) right up until the user actually sends a
      // message, at which point it fails with a confusing generic error.
      // Dropping it from the selectable list is confusing in a much smaller,
      // more honest way: the agent just doesn't show up until the copy
      // succeeds, instead of showing up broken.
      return null
    }
  }))
  return resolved.filter((p): p is SelectedPersonaInfo => p !== null)
}

// 30-second TTL cache + in-flight dedup — the Agents floating panel calls
// fetchSelectableChatPersonas() fresh on every open, which previously re-ran
// fetchPersonas() + the copy-resolution pass every single time. Busted
// whenever the personas list itself is busted (create/edit/publish/delete/
// share), so a real mutation is never masked by a stale cache hit.
const _selectableCache = new Map<string, { data: SelectedPersonaInfo[]; time: number }>()
const _selectableInFlight = new Map<string, Promise<SelectedPersonaInfo[]>>()
const SELECTABLE_CACHE_TTL = 30_000

if (typeof window !== 'undefined') {
  window.addEventListener(PERSONAS_LIST_UPDATED_EVENT, () => {
    _selectableCache.clear()
    _selectableInFlight.clear()
  })
}

/** The complete set of agents the backend says this viewer may access.
 *  Drafts are excluded — they aren't published/usable yet. */
export function fetchSelectableChatPersonas(
  orgId: string | null | undefined,
  viewerUserId: string | number | null | undefined,
  fallbackOwned: boolean,
): Promise<SelectedPersonaInfo[]> {
  const key = `${orgId ?? ''}:${viewerUserId ?? ''}:${fallbackOwned}`
  const now = Date.now()
  const cached = _selectableCache.get(key)
  if (cached && now - cached.time < SELECTABLE_CACHE_TTL) return Promise.resolve(cached.data)

  const inFlight = _selectableInFlight.get(key)
  if (inFlight) return inFlight

  const promise = (async () => {
    const allPersonas = await fetchPersonas()
    // Workspace-visibility agents are included too now that the Sharing tab's
    // visibility toggle is a real, re-enabled feature — resolveSelectableChatPersonas
    // (below) already handles the eager clone-on-open behavior for anything not
    // owned by the viewer, so a workspace-shared agent gets cloned into the
    // viewer's own account the same way a Super Link/team-shared "use" already
    // does elsewhere. Drafts stay excluded — they aren't published/usable yet.
    const personas = allPersonas.filter(persona => persona.status !== 'draft')
    const resolved = await resolveSelectableChatPersonas(personas, {}, viewerUserId, fallbackOwned)
    _selectableCache.set(key, { data: resolved, time: Date.now() })
    return resolved
  })().finally(() => { _selectableInFlight.delete(key) })

  _selectableInFlight.set(key, promise)
  return promise
}
