/**
 * The saved agent as the V2 views see it: one record, read the same way by the
 * editor page, the right-sidebar details and the Advanced Personalize modal.
 */

import type { PersonaRepo } from '@/lib/api/persona-repo'
import { DEFAULT_TEMPERATURE, clampTemperature, type AgentDraft } from '@/lib/agent-draft'

export interface AgentRecord {
  repoId:    string
  /** The version these views read and write: the live one, else the working draft. */
  versionId: string
  /** True when that version is the published one — i.e. chat runs exactly this. */
  isLive:    boolean
  /** `@handle`, allocated by the backend from the name. */
  handle:    string
  isPaused:  boolean
  /** What is saved right now. */
  saved:     AgentDraft
}

/** Null when the agent has no version at all (nothing to show or edit). */
export function recordFromRepo(repo: PersonaRepo): AgentRecord | null {
  const version = repo.currentVersion
  if (!version) return null
  return {
    repoId:    repo.id,
    versionId: version.id,
    isLive:    repo.liveVersionId !== null && repo.liveVersionId === version.id,
    handle:    repo.handle,
    isPaused:  repo.isPaused,
    saved: {
      name:         version.name,
      description:  version.description,
      instructions: version.prompt,
      modelId:      version.modelId,
      temperature:  clampTemperature(version.temperature ?? DEFAULT_TEMPERATURE),
      avatarUrl:    version.imageUrl,
      tags:         version.tags,
    },
  }
}
