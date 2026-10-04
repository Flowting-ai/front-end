/**
 * Saving an agent in the V2 flow: one record, edited in place, always live.
 *
 * V1.5 forked a new version on every "Save version" and needed a separate
 * Publish. V2 has neither: Finish creates the agent and publishes it in one go,
 * and later edits patch the version chat actually runs (the live one, else the
 * working draft, which is then published). Older versions stay on the backend
 * untouched — they are simply not surfaced any more.
 */

import {
  bustPersonasCache,
  createPersonaRepo,
  publishPersonaVersion,
  updateVersion,
  urlToImageFile,
} from '@/lib/api/personas'
import { fetchPersonaRepo } from '@/lib/api/persona-repo'
import { trackBrowserEvent } from '@/lib/analytics/events'
import { avatarKey, draftProblems, type AgentDraft } from '@/lib/agent-draft'

// ── Avatar → File ─────────────────────────────────────────────────────────────

/** `data:` URL → File, for multipart upload. Returns null for anything malformed. */
export function dataUrlToFile(dataUrl: string, filename: string): File | null {
  const comma = dataUrl.indexOf(',')
  if (!dataUrl.startsWith('data:') || comma < 0) return null
  const header = dataUrl.slice(0, comma)
  const payload = dataUrl.slice(comma + 1)
  const mime = header.match(/^data:([^;,]+)/)?.[1] ?? 'image/jpeg'
  try {
    const bytes = header.includes(';base64')
      ? Uint8Array.from(atob(payload), char => char.charCodeAt(0))
      : new TextEncoder().encode(decodeURIComponent(payload))
    const extension = mime.split('/')[1]?.split('+')[0] || 'jpg'
    return new File([bytes], `${filename}.${extension}`, { type: mime })
  } catch {
    return null
  }
}

/**
 * The avatar as an uploadable file. Static pool paths and stored URLs are fetched;
 * `data:` URLs (a user upload) are decoded locally. Null when there is none or it
 * can't be read — callers decide whether that blocks the save.
 */
export async function avatarToFile(avatarUrl: string | null): Promise<File | null> {
  if (!avatarUrl) return null
  if (avatarUrl.startsWith('data:')) return dataUrlToFile(avatarUrl, 'avatar')
  return urlToImageFile(avatarUrl)
}

// ── Create ────────────────────────────────────────────────────────────────────

export class AgentSaveError extends Error {
  constructor(message: string, readonly reason: 'invalid' | 'avatar' | 'create' | 'update') {
    super(message)
    this.name = 'AgentSaveError'
  }
}

export interface CreatedAgent {
  repoId:    string
  versionId: string
  /** False when the agent was created but publishing failed — it exists as a draft. */
  published: boolean
  imageUrl:  string | null
}

/**
 * Creates the agent and makes it live. Cancel never reaches this: nothing exists
 * on the backend until Finish.
 *
 * If publishing fails after the agent was created, the agent is returned with
 * `published: false` rather than thrown — it exists, and the caller sends the
 * user to its editor, where saving retries the publish.
 */
export async function createAgent(
  draft: AgentDraft,
  options: { templateSlug?: string } = {},
): Promise<CreatedAgent> {
  if (draftProblems(draft).length > 0 || !draft.modelId) {
    throw new AgentSaveError('The agent needs a name, a model and instructions.', 'invalid')
  }

  const image = await avatarToFile(draft.avatarUrl)
  if (draft.avatarUrl && !image) {
    throw new AgentSaveError('The avatar could not be read. Choose a different image.', 'avatar')
  }

  let repo
  try {
    repo = await createPersonaRepo({
      name:        draft.name.trim(),
      modelId:     draft.modelId,
      prompt:      draft.instructions,
      description: draft.description.trim(),
      temperature: draft.temperature,
      tags:        draft.tags,
      image,
    })
  } catch (error) {
    throw new AgentSaveError(error instanceof Error ? error.message : 'Failed to create the agent.', 'create')
  }

  // The create response can come back before the new version is pinned as the
  // agent's active one, so when it carries none the agent is read back once.
  let versionId = repo.active_version?.id ?? repo.active_version_id ?? null
  let imageUrl = repo.active_version?.image_url ?? null
  if (!versionId) {
    try {
      const fresh = await fetchPersonaRepo(repo.id)
      versionId = fresh.workingVersionId ?? fresh.liveVersionId
      imageUrl = fresh.currentVersion?.imageUrl ?? imageUrl
    } catch {
      /* reported below */
    }
  }
  if (!versionId) {
    bustPersonasCache()
    throw new AgentSaveError('The agent was created but couldn’t be finished. Find it in your agents list and open it to finish.', 'create')
  }

  trackBrowserEvent('agent_created', {
    from_template: !!options.templateSlug,
    template_slug: options.templateSlug,
  })

  let published = true
  try {
    await publishPersonaVersion(repo.id, versionId)
  } catch {
    published = false
  }
  bustPersonasCache()

  return { repoId: repo.id, versionId, published, imageUrl }
}

// ── Update ────────────────────────────────────────────────────────────────────

export interface SaveAgentInput {
  repoId:    string
  /** The version being edited: the live one, else the working draft. */
  versionId: string
  /** Whether that version is already the published one. */
  isLive:    boolean
  draft:     AgentDraft
  baseline:  AgentDraft
}

export interface SavedAgent {
  imageUrl:  string | null
  /** False when the changes were saved but publishing failed. */
  published: boolean
}

/** Patches only what changed, in place, and makes sure the agent is live. */
export async function saveAgentChanges(input: SaveAgentInput): Promise<SavedAgent> {
  const { repoId, versionId, isLive, draft, baseline } = input
  if (draftProblems(draft).length > 0 || !draft.modelId) {
    throw new AgentSaveError('The agent needs a name, a model and instructions.', 'invalid')
  }

  const avatarChanged = avatarKey(draft.avatarUrl) !== avatarKey(baseline.avatarUrl)
  let image: File | null = null
  if (avatarChanged) {
    image = await avatarToFile(draft.avatarUrl)
    if (!image) throw new AgentSaveError('The avatar could not be read. Choose a different image.', 'avatar')
  }

  let imageUrl = baseline.avatarUrl
  try {
    const updated = await updateVersion({
      repoId,
      versionId,
      // Always sent, so an avatar-only change still PATCHes a non-empty body.
      name:         draft.name.trim(),
      description:  draft.description.trim() !== baseline.description.trim() ? draft.description.trim() : undefined,
      prompt:       draft.instructions !== baseline.instructions ? draft.instructions : undefined,
      modelId:      draft.modelId !== baseline.modelId ? draft.modelId : undefined,
      temperature:  draft.temperature !== baseline.temperature ? draft.temperature : undefined,
      image,
    })
    imageUrl = updated.image_url ?? imageUrl
  } catch (error) {
    throw new AgentSaveError(error instanceof Error ? error.message : 'Failed to save the agent.', 'update')
  }

  let published = true
  if (!isLive) {
    try {
      await publishPersonaVersion(repoId, versionId)
    } catch {
      published = false
    }
  }
  bustPersonasCache()
  return { imageUrl, published }
}
