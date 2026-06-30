"use client";

import {
  MODELS_ENDPOINT,
  MODELS_ALL_ENDPOINT,
  MODELS_BLOCK_ENDPOINT,
  MODELS_TEST_ENDPOINT,
} from "@/lib/config";
import { apiFetch, apiFetchJson, ApiError } from "./client";

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
  return apiFetchJson<ModelsResponse>(MODELS_ENDPOINT, { method: "GET" });
}

/** GET /llm/models/all — every model with its blocked flag for this user. */
export async function fetchAllModels(): Promise<GetModelsWithStatus[]> {
  try {
    const res = await apiFetch(MODELS_ALL_ENDPOINT, { method: "GET" });
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    return Array.isArray(data) ? (data as GetModelsWithStatus[]) : [];
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
  return res.json() as Promise<{ blocked: boolean }>;
}

/** POST /llm/models/test — compare 1–3 models on a single prompt. */
export async function testModels(body: TestModelRequest): Promise<unknown> {
  return apiFetchJson<unknown>(MODELS_TEST_ENDPOINT, {
    method: "POST",
    body:   JSON.stringify(body),
  });
}
