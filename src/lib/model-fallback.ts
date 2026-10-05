/**
 * Picks the model to fall back to when the backend refuses the selected one as no
 * longer available (a 409 before anything streamed). The failed model is never
 * offered again; among the rest the closest match wins — same provider, then same
 * pricing tier, then same size class — via `pickReplacementModel`.
 */

import type { AIModel } from '@/types/ai-model'
import { pickReplacementModel } from '@/lib/ai-models'

/** The id a model is addressed by: `modelId` when it has one, else `id`. */
export function modelKey(model: Pick<AIModel, 'modelId' | 'id'>): string | null {
  if (model.modelId != null && String(model.modelId) !== 'undefined') return String(model.modelId)
  if (model.id != null && String(model.id) !== 'undefined') return String(model.id)
  return null
}

export function pickFallbackModel(
  models: readonly AIModel[],
  failedKey: string | null | undefined,
  /** What is known about the failed model, when it's no longer in `models`. */
  failedInfo?: Partial<Pick<AIModel, 'companyName' | 'modelName' | 'modelType'>> | null,
): AIModel | null {
  const failed = failedKey ? models.find((m) => modelKey(m) === failedKey) : undefined
  const usable = models.filter((m) => modelKey(m) !== null && modelKey(m) !== failedKey)
  return pickReplacementModel(usable, failed ?? failedInfo ?? null)
}

export interface StoredSelection {
  /** The model to select, or null when there is nothing to select. */
  model: AIModel | null
  /** True when the stored model was unavailable and `model` is its replacement. */
  replaced: boolean
  /** Name of the model that was replaced, for the message to the user. */
  previousName?: string
}

/**
 * Resolves the model saved from an earlier visit against today's catalog: the same
 * model when it is still there and usable (matched by id, then by name + company);
 * otherwise — retired from the catalog, or blocked — the closest model that is
 * usable, so a chat never opens on a model it can't run. When nothing else is
 * usable the saved model is kept rather than selecting nothing.
 */
export function resolveStoredSelection(
  models: readonly AIModel[],
  stored: string | null,
  cached: Partial<Pick<AIModel, 'modelName' | 'companyName' | 'modelType'>> | null,
): StoredSelection {
  if (!stored || models.length === 0) return { model: null, replaced: false }
  const byKey = models.find(
    (m) => (m.modelId != null && String(m.modelId) === stored) || (m.id != null && String(m.id) === stored),
  )
  const byName = cached?.modelName && cached?.companyName
    ? models.find((m) => m.modelName === cached.modelName && m.companyName === cached.companyName)
    : undefined
  const found = byKey ?? byName
  if (found && !found.blocked) return { model: found, replaced: false }

  const next = pickFallbackModel(models.filter((m) => !m.blocked), found ? modelKey(found) : null, found ?? cached ?? null)
  if (!next) return { model: found ?? null, replaced: false }
  return { model: next, replaced: true, previousName: found?.modelName ?? cached?.modelName }
}
