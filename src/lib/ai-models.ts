"use client";

import type { AIModel } from "@/types/ai-model";
import { MODELS_ALL_ENDPOINT } from "@/lib/config";
import { ensureFreshToken } from "@/lib/jwt-utils";

type BackendModel = {
  model_id?: string;
  model_name?: string;
  model_provider?: string;
  model_plan_type?: string;
  model_description?: string;
  model_context_window?: number;
  model_output_size?: number;
  model_inputs?: string[];
  model_outputs?: string[];
  blocked?: boolean;
  model_tags?: string[];
  model_thinking_efforts?: string[];
  id?: number | string;
  modelId?: number | string;
  companyName?: string;
  modelName?: string;
  name?: string;
  providerName?: string;
  provider?: string;
  planType?: string;
  plan?: string;
  callType?: string;
  inputLimit?: number;
  outputLimit?: number;
  providerId?: number | string;
  sdkLibrary?: string;
  huggingfaceProvider?: string;
  deploymentName?: string;
  inputModalities?: string[];
  outputModalities?: string[];
  version?: string;
  description?: string;
};

const normalizeModelType = (
  planType?: string,
  callType?: string,
): "free" | "paid" => {
  const normalized = `${planType ?? ""} ${callType ?? ""}`.toLowerCase();
  if (normalized.includes("free")) return "free";
  return "paid";
};

/**
 * Souvenir's user-facing name for each of the 3 real underlying models —
 * there is no separate "Muse algorithm" model, just Anthropic's Claude
 * Haiku/Sonnet/Opus relabeled. Matches by substring on the raw provider name
 * (case-insensitive) so it survives version bumps ("Claude Haiku 4.5",
 * "Claude 3 Haiku", etc. all match); anything that isn't one of the 3 is
 * returned unchanged.
 */
export function toSouvenirModelLabel(rawName: string | null | undefined): string {
  if (!rawName) return rawName ?? "";
  const n = rawName.toLowerCase();
  if (n.includes("haiku")) return "Basic";
  if (n.includes("opus")) return "Advanced";
  if (n.includes("sonnet")) return "Standard";
  return rawName;
}

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeModel = (model: BackendModel): AIModel => ({
  id: model.id ?? model.modelId ?? model.model_id,
  modelId: model.modelId ?? model.model_id ?? model.id,
  blocked: model.blocked,
  companyName:
    model.model_provider ??
    model.companyName ??
    model.providerName ??
    model.provider ??
    "Unknown",
  modelName: toSouvenirModelLabel(
    model.model_name ?? model.modelName ?? model.name ?? "Unknown Model",
  ),
  modelType: normalizeModelType(
    model.model_plan_type ?? model.planType ?? model.plan,
    model.callType,
  ),
  inputLimit: toNumber(model.model_context_window ?? model.inputLimit, 0),
  outputLimit: toNumber(model.model_output_size ?? model.outputLimit, 0),
  version: model.version,
  description: model.model_description ?? model.description,
  planType: model.model_plan_type ?? model.planType ?? model.plan,
  callType: model.callType,
  providerId: model.providerId,
  sdkLibrary: model.sdkLibrary,
  huggingfaceProvider: model.huggingfaceProvider,
  deploymentName: model.deploymentName,
  inputModalities: model.model_inputs ?? model.inputModalities,
  outputModalities: model.model_outputs ?? model.outputModalities,
  tags: model.model_tags,
  thinkingEfforts: model.model_thinking_efforts,
});

export const normalizeModels = (payload: unknown): AIModel[] => {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { results?: unknown[] })?.results)
      ? (payload as { results: unknown[] }).results
      : Array.isArray((payload as { models?: unknown[] })?.models)
        ? (payload as { models: unknown[] }).models
        : [];

  return list.map((model) => normalizeModel(model as BackendModel));
};

// ── Shared in-memory cache ────────────────────────────────────────────────────

let _modelsCache: AIModel[] | null = null;
let _modelsFetchPromise: Promise<AIModel[]> | null = null;
const MODELS_CACHE_TTL = 60_000;
let _modelsCacheTime = 0;

// Fired whenever the cache is busted so already-mounted consumers (the model
// selector is a single instance shared app-wide via ModelSelectorProvider,
// mounted once in the (app) layout) know to refetch instead of keeping their
// already-loaded — now stale — model list for the rest of the SPA session.
export const MODELS_CACHE_BUSTED_EVENT = "models:cache-busted";

/** Force the next fetchModelsWithCache call to bypass the TTL and re-fetch. */
export function bustModelsCache(): void {
  _modelsCache = null;
  _modelsCacheTime = 0;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(MODELS_CACHE_BUSTED_EVENT));
  }
}

// Canonical display order for the 3 Souvenir Muse tiers — Advanced, then
// Standard, then Basic — used by every model-selector dropdown in the app
// (the chat/global switcher, the agent Instructions tab, and the Change/Fix
// model modals) so the list order never drifts between surfaces. Anything
// that doesn't match one of the 3 known tier labels (shouldn't happen — see
// toSouvenirModelLabel) sorts last instead of throwing, so an unexpected or
// future model still renders.
const MODEL_TIER_RANK: Record<string, number> = {
  "Advanced": 0,
  "Standard": 1,
  "Basic": 2,
};

export function modelTierRank(modelName: string): number {
  return MODEL_TIER_RANK[modelName] ?? 99;
}

/** Sorts a model list Advanced → Standard → Basic. Stable, non-mutating. */
export function sortModelsByTier<T extends Pick<AIModel, "modelName">>(models: T[]): T[] {
  return [...models].sort((a, b) => modelTierRank(a.modelName) - modelTierRank(b.modelName));
}

/**
 * The model every new chat should start on: the Advanced tier, the
 * strongest of the 3 Souvenir Muse tiers. Falls back to the first model in
 * the list on the off chance the Advanced tier isn't present (shouldn't
 * happen — see toSouvenirModelLabel), so callers always get something
 * rather than nothing.
 */
export function pickDefaultModel<T extends Pick<AIModel, "modelName">>(models: T[]): T | null {
  if (!models.length) return null;
  return models.find(m => m.modelName === "Advanced") ?? models[0];
}

// Tier keywords used only to break ties between same-company candidates —
// e.g. prefer another "Standard"-class model over an "Advanced"/"Basic" one
// so a persona's cost/capability tier survives a forced model swap where
// possible. Matches both the pre-rename provider words (in case a raw name
// ever reaches this function without going through normalizeModel/
// toSouvenirModelLabel first) and the post-rename Souvenir Muse tier words.
const MODEL_TIER_WORDS = ['advanced', 'standard', 'basic', 'opus', 'sonnet', 'haiku', 'pro', 'mini', 'flash']

/**
 * Picks a replacement for a model that's no longer usable (blocked or
 * retired), preferring — in order — the same provider, then the same
 * pricing tier (free/paid), then the same size/tier class (Sonnet vs Opus
 * vs Haiku, etc.) as the model being replaced. Falls back to the first
 * available model when nothing about the original is known.
 */
export function pickReplacementModel(
  available: AIModel[],
  // Partial, not the full triple: a fully retired model is gone from the
  // catalog, so the only thing the caller can still supply about it is the
  // display name cached elsewhere. Each field is scored only when present.
  deprecated?: Partial<Pick<AIModel, 'companyName' | 'modelName' | 'modelType'>> | null,
): AIModel | null {
  if (!available.length) return null
  if (!deprecated) return available[0]

  const dep = deprecated
  const deprecatedName = (dep.modelName ?? '').toLowerCase()
  const deprecatedTier = MODEL_TIER_WORDS.find(w => deprecatedName.includes(w))

  function score(m: AIModel): number {
    let s = 0
    if (dep.companyName && m.companyName === dep.companyName) s += 4
    if (dep.modelType && m.modelType === dep.modelType) s += 2
    if (deprecatedTier && m.modelName.toLowerCase().includes(deprecatedTier)) s += 1
    return s
  }

  return [...available].sort((a, b) => score(b) - score(a))[0]
}

export async function fetchModelsWithCache(
  opts?: { force?: boolean },
): Promise<AIModel[]> {
  const now = Date.now();
  if (
    !opts?.force &&
    _modelsCache &&
    now - _modelsCacheTime < MODELS_CACHE_TTL
  ) {
    return _modelsCache;
  }

  if (_modelsFetchPromise) return _modelsFetchPromise;

  _modelsFetchPromise = (async () => {
    try {
      const token = await ensureFreshToken();
      const authHeaders: Record<string, string> = {};
      if (token) authHeaders.Authorization = `Bearer ${token}`;
      const response = await fetch(MODELS_ALL_ENDPOINT, {
        credentials: "include",
        headers: authHeaders,
      });
      if (!response.ok) return _modelsCache ?? [];
      const data = await response.json();
      // Previously filtered out models the user had blocked in /settings/ai.
      // That page is no longer reachable from nav, so a model someone blocked
      // in the past would otherwise vanish from every picker with no way back —
      // include every model here regardless of its blocked flag. (`blocked`
      // itself is left intact on each AIModel for the surfaces that still use
      // it to show an accurate "this assigned model is disabled" warning.)
      const models = normalizeModels(data);
      _modelsCache = models;
      _modelsCacheTime = Date.now();
      return models;
    } catch {
      return _modelsCache ?? [];
    } finally {
      _modelsFetchPromise = null;
    }
  })();

  return _modelsFetchPromise;
}
