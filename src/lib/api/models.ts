"use client";

import { MODELS_ALL_ENDPOINT, MODELS_BLOCK_ENDPOINT } from "@/lib/config";
import { apiFetch } from "./client";

export interface LLMModel {
  model_id: string;
  model_name: string;
  model_provider: string;
  model_inputs: string[];
  model_outputs: string[];
  model_context_window: number | null;
  model_output_size: number | null;
  model_input_cost: number | null;
  model_output_cost: number | null;
  model_plan_type: "standard" | "pro" | "power";
  model_description: string;
  blocked: boolean;
}

export async function fetchAllModels(): Promise<LLMModel[]> {
  const response = await apiFetch(MODELS_ALL_ENDPOINT, { method: "GET" });
  if (!response.ok) return [];
  const data = (await response.json()) as unknown;
  return Array.isArray(data) ? (data as LLMModel[]) : [];
}

export async function toggleBlockModel(
  model_id: string,
): Promise<{ blocked: boolean }> {
  const response = await apiFetch(MODELS_BLOCK_ENDPOINT, {
    method: "PATCH",
    body: JSON.stringify({ model_id }),
  });
  if (!response.ok) {
    throw new Error("Failed to update model status.");
  }
  return response.json() as Promise<{ blocked: boolean }>;
}
