// ── Agent model health ───────────────────────────────────────────────────────
// Whether an agent's configured model can still run. Shared by the /agents
// grid (PersonaCard's unavailable scrim + "Fix N agents"), the agents side
// panel (CompactAgentCard), and the sidebar notification bell, so all three
// agree on exactly which agents are broken and why.
//
// 'blocked' — still in the catalog, but turned off for this account.
// 'retired' — gone from the catalog entirely (deprecated by the provider).

import { isDraftPersona, type Persona } from '@/lib/api/personas'
import { readDevModelOverride } from '@/lib/notifications/dev'
import type { AIModel } from '@/types/ai-model'

export type ModelUnavailableReason = 'retired' | 'blocked'

/** Stable model id → blocked flag, for every model in the full catalog
 *  (`fetchModelsWithCache` / `fetchAllModels`, blocked ones included).
 *  Absence from the map means the model is gone from the catalog. */
export function buildModelBlockedMap(models: readonly AIModel[]): Map<string, boolean> {
  const map = new Map<string, boolean>()
  for (const m of models) {
    const key = String(m.modelId ?? m.id ?? '')
    if (key) map.set(key, !!m.blocked)
  }
  return map
}

/** Stable model id → display name, from the same full catalog. */
export function buildModelNameMap(models: readonly AIModel[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const m of models) {
    const key = String(m.modelId ?? m.id ?? '')
    if (key) map.set(key, m.modelName)
  }
  return map
}

/**
 * Why `modelId` can't be used, or null when it's fine. Returns null until the
 * catalog has loaded at least once (an empty map) — otherwise every agent
 * would flash as broken during the initial fetch.
 *
 * Dev builds also honour the notifications playground's simulated outages
 * (`/dev/notifications`), so the faded cards, the fix modal and the bell can
 * all be exercised against real agents without retiring a real model.
 */
export function modelUnavailableReason(
  modelId: string | null | undefined,
  blockedMap: ReadonlyMap<string, boolean>,
): ModelUnavailableReason | null {
  if (!modelId) return null
  const simulated = readDevModelOverride(modelId)
  if (simulated) return simulated
  if (!blockedMap.size) return null
  const blocked = blockedMap.get(modelId)
  if (blocked === undefined) return 'retired'
  return blocked ? 'blocked' : null
}

/** The version a model reassignment would patch. activeVersionId is the
 *  common case (published agent); workingVersionId covers a paused agent that
 *  was never published. Without either there is nothing to write to. */
export function patchableVersionId(persona: Pick<Persona, 'activeVersionId' | 'workingVersionId'>): string | null {
  return persona.activeVersionId ?? persona.workingVersionId ?? null
}

export interface UnavailableAgentModel {
  persona:   Persona
  versionId: string
  modelId:   string
  reason:    ModelUnavailableReason
}

/**
 * Every agent that can't run because of its model — the same set the /agents
 * cards mark as unavailable. Drafts are skipped (they have their own "finish
 * setup" treatment), as are agents with no version to write a new model to.
 * `isVisible` narrows to the agents the viewer actually sees in their library.
 */
export function findUnavailableAgentModels(
  personas: readonly Persona[],
  blockedMap: ReadonlyMap<string, boolean>,
  isVisible: (persona: Persona) => boolean = () => true,
): UnavailableAgentModel[] {
  const rows: UnavailableAgentModel[] = []
  for (const persona of personas) {
    if (!isVisible(persona) || isDraftPersona(persona) || !persona.modelId) continue
    const reason = modelUnavailableReason(persona.modelId, blockedMap)
    if (!reason) continue
    const versionId = patchableVersionId(persona)
    if (!versionId) continue
    rows.push({ persona, versionId, modelId: persona.modelId, reason })
  }
  return rows
}
