"use client";

import { MODELS_ALL_ENDPOINT, MODELS_BLOCK_ENDPOINT } from "@/lib/config";
import { apiFetch } from "./client";

export interface LLMModel {
  model_id: string;
  model_name: string;
  model_provider: string;
  model_description: string;
  model_plan_type: string;
  model_context_window: number | null;
  model_output_size: number | null;
  model_inputs: string[];
  model_outputs: string[];
  blocked: boolean;
}

export async function fetchAllModels(): Promise<LLMModel[]> {
  try {
    const res = await apiFetch(MODELS_ALL_ENDPOINT, { method: "GET" });
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    return Array.isArray(data) ? (data as LLMModel[]) : [];
  } catch {
    return [];
  }
}

export async function toggleBlockModel(
  model_id: string,
): Promise<{ blocked: boolean }> {
  const res = await apiFetch(MODELS_BLOCK_ENDPOINT, {
    method: "PATCH",
    body: JSON.stringify({ model_id }),
  });
  if (!res.ok) throw new Error("Failed to update model status");
  return res.json() as Promise<{ blocked: boolean }>;
}
