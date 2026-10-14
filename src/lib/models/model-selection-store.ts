import type { AIModel } from '@/types/ai-model'
import { MODEL_SELECTION_CACHE_KEY, MODEL_SELECTION_KEY } from '@/lib/storage-keys'
import { pickDefaultModel } from '@/lib/ai-models'
import { resolveStoredSelection } from '@/lib/model-fallback'

/**
 * The chat model selection: one stable id in localStorage (plus a small display
 * copy for first paint), resolved against the live catalogue every time it
 * changes. A tiny external store so `useSyncExternalStore` readers update
 * together, including across tabs (`storage` event), and logout can clear it.
 */

export type CachedModel = Pick<AIModel, 'id' | 'modelId' | 'modelName' | 'companyName'>
export interface StoredSelection { key: string | null; cached: Partial<CachedModel> | null }

const EMPTY: StoredSelection = { key: null, cached: null }
const listeners = new Set<() => void>()
let snapshot: StoredSelection = EMPTY
let snapshotRaw = ''

function readRaw(): [string | null, string | null] {
  try { return [localStorage.getItem(MODEL_SELECTION_KEY), localStorage.getItem(MODEL_SELECTION_CACHE_KEY)] } catch { return [null, null] }
}

/** Stable snapshot: a new object only when storage actually changed. */
export function getSelectionSnapshot(): StoredSelection {
  if (typeof window === 'undefined') return EMPTY
  const [key, cacheRaw] = readRaw()
  const raw = `${key}\u0000${cacheRaw}`
  if (raw !== snapshotRaw) {
    let cached: Partial<CachedModel> | null = null
    try { cached = cacheRaw ? (JSON.parse(cacheRaw) as Partial<CachedModel>) : null } catch { cached = null }
    snapshot = { key, cached }
    snapshotRaw = raw
  }
  return snapshot
}

export const getServerSelectionSnapshot = (): StoredSelection => EMPTY

function notify() { for (const l of listeners) l() }

export function subscribeSelection(listener: () => void): () => void {
  listeners.add(listener)
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === MODEL_SELECTION_KEY || e.key === MODEL_SELECTION_CACHE_KEY) listener()
  }
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage)
  }
}

/** Prefer the semantic modelId over the numeric database id for stable storage. */
export function stableKey(model: Pick<AIModel, 'modelId' | 'id'>): string | null {
  if (model.modelId != null && String(model.modelId) !== 'undefined') return String(model.modelId)
  if (model.id != null && String(model.id) !== 'undefined') return String(model.id)
  return null
}

const cacheOf = (m: CachedModel): CachedModel => ({ id: m.id, modelId: m.modelId, modelName: m.modelName, companyName: m.companyName })

/** Persist a selection (no-op when nothing would change, so resolving can't loop). */
export function writeSelection(model: CachedModel): void {
  const key = stableKey(model)
  if (!key) return
  const cacheRaw = JSON.stringify(cacheOf(model))
  const [curKey, curCache] = readRaw()
  if (curKey === key && curCache === cacheRaw) return
  try {
    localStorage.setItem(MODEL_SELECTION_KEY, key)
    localStorage.setItem(MODEL_SELECTION_CACHE_KEY, cacheRaw)
  } catch { /* storage unavailable */ }
  notify()
}

/** Forget the selection (logout). */
export function clearSelection(): void {
  try {
    localStorage.removeItem(MODEL_SELECTION_KEY)
    localStorage.removeItem(MODEL_SELECTION_CACHE_KEY)
  } catch { /* storage unavailable */ }
  notify()
}

export interface ResolvedSelection {
  /** What the composer shows: a catalogue model, or the cached copy before/without one. */
  model: AIModel | null
  /** A catalogue model to persist (re-key or default), when storage should change. */
  persist: AIModel | null
  /** The saved model was retired or blocked and replaced by `model`. */
  replacedName: string | null
}

/**
 * Resolve the stored selection against the catalogue: the saved model if still
 * usable (by id, then name + company), else its closest usable replacement;
 * with nothing saved, the catalogue's default. Before the catalogue loads (or
 * when nothing matches), the cached copy keeps the composer from flashing empty.
 */
export function resolveSelection(models: readonly AIModel[], stored: StoredSelection): ResolvedSelection {
  const cachedModel = (stored.cached as AIModel | null) ?? null
  if (models.length === 0) return { model: cachedModel, persist: null, replacedName: null }
  if (stored.key) {
    const resolved = resolveStoredSelection(models, stored.key, stored.cached)
    if (!resolved.model) return { model: cachedModel, persist: null, replacedName: null }
    return {
      model: resolved.model,
      persist: resolved.model,
      replacedName: resolved.replaced ? (resolved.previousName ?? 'Your selected model') : null,
    }
  }
  const fallback = pickDefaultModel([...models]) ?? null
  return { model: fallback, persist: fallback, replacedName: null }
}
