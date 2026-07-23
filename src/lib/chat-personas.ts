import {
  fetchPersonas,
  isPersonaOwnedByViewer,
  usePersonaRepoDeduped,
  PERSONAS_LIST_UPDATED_EVENT,
  type Persona,
  type PersonaRepoResponse,
} from '@/lib/api/personas'
import { fetchPersonaOwnerMap } from '@/lib/api/teams'

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
}

type CopyPersona = (repoId: string, sourceVersionId?: string | null) => Promise<PersonaRepoResponse>

const copiedPersonaCache = new Map<string, SelectedPersonaInfo>()

function toSelectedPersona(persona: Persona, ownedByViewer: boolean): SelectedPersonaInfo {
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
  return Promise.all(personas.map(async persona => {
    const ownedByViewer = isPersonaOwnedByViewer(persona, ownerMap, viewerUserId, fallbackOwned)
    const base = toSelectedPersona(persona, ownedByViewer)
    if (ownedByViewer) return base

    const cached = copiedPersonaCache.get(persona.id)
    if (cached) return cached

    try {
      const copy = await copyPersona(persona.id, persona.activeVersionId)
      const version = copy.published_version ?? copy.active_version
      const selected: SelectedPersonaInfo = {
        id: copy.id,
        name: persona.name,
        handle: persona.handle,
        imageUrl: version?.image_url ?? persona.imageUrl,
        modelId: version?.model_id ?? persona.modelId,
        activeVersionId: copy.published_version_id ?? null,
        systemPrompt: null,
        temperature: version?.temperature ?? persona.temperature,
        visibility: persona.visibility,
        ownedByViewer: false,
      }
      copiedPersonaCache.set(persona.id, selected)
      return selected
    } catch {
      return base
    }
  }))
}

// 30-second TTL cache + in-flight dedup — the Agents floating panel calls
// fetchSelectableChatPersonas() fresh on every open, which previously re-ran
// fetchPersonas() + fetchPersonaOwnerMap() + the copy-resolution pass every
// single time. Busted whenever the personas list itself is busted (create/
// edit/publish/delete/share), so a real mutation is never masked by a stale
// cache hit.
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
    const personas = allPersonas.filter(persona => persona.status !== 'draft')
    const teamIds = [...new Set(
      personas.flatMap(persona => persona.visibility === 'team' ? persona.teamIds : []),
    )]
    const ownerMap = orgId && teamIds.length > 0
      ? await fetchPersonaOwnerMap(orgId, teamIds)
      : {}

    const resolved = await resolveSelectableChatPersonas(personas, ownerMap, viewerUserId, fallbackOwned)
    _selectableCache.set(key, { data: resolved, time: Date.now() })
    return resolved
  })().finally(() => { _selectableInFlight.delete(key) })

  _selectableInFlight.set(key, promise)
  return promise
}
