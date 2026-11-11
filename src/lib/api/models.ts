"use client";

import {
  MODELS_ENDPOINT,
  MODELS_ALL_ENDPOINT,
  MODELS_BLOCK_ENDPOINT,
  MODELS_TEST_ENDPOINT,
} from "@/lib/config";
import { apiFetch, apiFetchJson, ApiError } from "./client";
import { trackBrowserEvent } from "@/lib/analytics/events";
import { blockResultSchema, modelWireSchema, modelWithStatusSchema, parseModelList } from "./model-schemas";

// ── Schemas (match OpenAPI components.schemas) ────────────────────────────────

export interface GetModels {
  model_id:              string;
  model_name:            string;
  model_provider:        string;
  model_inputs:          string[];
  model_outputs:         string[];
  model_context_window?: number | null;
  model_output_size?:    number | null;
  model_input_cost?:     number | null;
  model_output_cost?:    number | null;
  model_plan_type:          string;
  model_description:        string;
  model_thinking_efforts?:  string[];
  model_tags?:              string[];
}

export interface GetModelsWithStatus extends GetModels {
  blocked: boolean;
}

export interface ModelsResponse {
  all:       GetModels[];
  recent:    GetModels[];
  most_used: GetModels[];
}

export interface BlockModelRequest {
  model_id: string;
}

export interface TestModelRequest {
  /** 1 to 3 model UUIDs to compare. */
  model_ids: string[];
  prompt:    string;
}

// Kept for back-compat with existing callers
export type LLMModel = GetModelsWithStatus;

// ── API functions ─────────────────────────────────────────────────────────────

/** GET /llm/models — bundled all / recent / most-used (already tier-filtered). */
export async function listModels(): Promise<ModelsResponse> {
  const raw = await apiFetchJson<Record<string, unknown>>(MODELS_ENDPOINT, { method: "GET" });
  const list = (value: unknown): GetModels[] =>
    Array.isArray(value) ? parseModelList(modelWireSchema, value).models : [];
  return { all: list(raw?.all), recent: list(raw?.recent), most_used: list(raw?.most_used) };
}

/** GET /llm/models/all — every model with its blocked flag for this user.
 *  Throws ApiError (or a parse error) so a screen can tell "failed" from
 *  "no models". Malformed rows are dropped individually. */
export async function loadAllModels(): Promise<GetModelsWithStatus[]> {
  const raw = await apiFetchJson<unknown>(MODELS_ALL_ENDPOINT, { method: "GET" });
  return parseModelList(modelWithStatusSchema, raw).models;
}

/** As loadAllModels, but never throws: [] on any failure. For callers that
 *  treat the catalogue as optional (agent health, pickers). */
export async function fetchAllModels(): Promise<GetModelsWithStatus[]> {
  try {
    return await loadAllModels();
  } catch {
    return [];
  }
}

/** PATCH /llm/models/block — toggle blocked status for a model. */
export async function toggleBlockModel(model_id: string): Promise<{ blocked: boolean }> {
  const res = await apiFetch(MODELS_BLOCK_ENDPOINT, {
    method: "PATCH",
    body:   JSON.stringify({ model_id } satisfies BlockModelRequest),
  });
  if (!res.ok) throw new ApiError(res.status, "block_model_failed", "Failed to update model status");
  const result = blockResultSchema.parse(await res.json());
  if (result.blocked) trackBrowserEvent("model_toggled_off", { model_id });
  else trackBrowserEvent("model_toggled_on", { model_id });
  return result;
}

/** POST /llm/models/test — compare 1–3 models on a single prompt. */
export async function testModels(body: TestModelRequest): Promise<unknown> {
  return apiFetchJson<unknown>(MODELS_TEST_ENDPOINT, {
    method: "POST",
    body:   JSON.stringify(body),
  });
}
