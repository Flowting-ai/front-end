import {
  fetchPersonas,
  isPersonaOwnedByViewer,
  usePersonaRepoDeduped,
  type Persona,
  type PersonaRepoResponse,
} from '@/lib/api/personas'
import { fetchPersonaOwnerMap } from '@/lib/api/teams'

export interface SelectedPersonaInfo {
  id:              string
  name:            string
  imageUrl:        string | null
  modelId:         string | null
  activeVersionId: string | null
  /** null = not yet fetched from the version; populated by the model-selector effect. */
  systemPrompt:    string | null
  temperature:     number | null
}

type CopyPersona = (repoId: string, sourceVersionId?: string | null) => Promise<PersonaRepoResponse>

const copiedPersonaCache = new Map<string, SelectedPersonaInfo>()

function toSelectedPersona(persona: Persona): SelectedPersonaInfo {
  return {
    id: persona.id,
    name: persona.name,
    imageUrl: persona.imageUrl,
    modelId: persona.modelId,
    activeVersionId: persona.activeVersionId,
    systemPrompt: null,
    temperature: persona.temperature,
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
    const base = toSelectedPersona(persona)
    if (isPersonaOwnedByViewer(persona, ownerMap, viewerUserId, fallbackOwned)) return base

    const cached = copiedPersonaCache.get(persona.id)
    if (cached) return cached

    try {
      const copy = await copyPersona(persona.id, persona.activeVersionId)
      const version = copy.published_version ?? copy.active_version
      const selected: SelectedPersonaInfo = {
        id: copy.id,
        name: persona.name,
        imageUrl: version?.image_url ?? persona.imageUrl,
        modelId: version?.model_id ?? persona.modelId,
        activeVersionId: copy.published_version_id ?? null,
        systemPrompt: null,
        temperature: version?.temperature ?? persona.temperature,
      }
      copiedPersonaCache.set(persona.id, selected)
      return selected
    } catch {
      return base
    }
  }))
}

/** The complete set of agents the backend says this viewer may access. */
export async function fetchSelectableChatPersonas(
  orgId: string | null | undefined,
  viewerUserId: string | number | null | undefined,
  fallbackOwned: boolean,
): Promise<SelectedPersonaInfo[]> {
  const personas = await fetchPersonas()
  const teamIds = [...new Set(
    personas.flatMap(persona => persona.visibility === 'team' ? persona.teamIds : []),
  )]
  const ownerMap = orgId && teamIds.length > 0
    ? await fetchPersonaOwnerMap(orgId, teamIds)
    : {}

  return resolveSelectableChatPersonas(personas, ownerMap, viewerUserId, fallbackOwned)
}
