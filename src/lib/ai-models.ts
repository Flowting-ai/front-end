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
  companyName:
    model.model_provider ??
    model.companyName ??
    model.providerName ??
    model.provider ??
    "Unknown",
  modelName:
    model.model_name ?? model.modelName ?? model.name ?? "Unknown Model",
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
