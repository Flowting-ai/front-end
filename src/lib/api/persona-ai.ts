"use client";

import { apiFetchJson } from "./client";
import { enhancePromptSchema, personaStarterSchema, type EnhancePromptResponse, type PersonaStarterResponse } from "./persona-schemas";
import { PERSONA_ENHANCE_ENDPOINT, PERSONA_STARTER_ENDPOINT } from "@/lib/config";
import { enhanceAnswersSchema } from "@/lib/enhance/enhance-request";

export interface PersonaStarterRequest {
  name: string;
  description: string;
  tone?: string;
}

/**
 * POST /persona/starter
 * Generate a starting system instruction, sound, and tags from a persona's
 * name + description. Nothing is saved — the FE uses this to seed the editor.
 */
export async function personaStarter(
  params: PersonaStarterRequest,
): Promise<PersonaStarterResponse> {
  return personaStarterSchema.parse(await apiFetchJson<unknown>(PERSONA_STARTER_ENDPOINT, {
    method: "POST",
    body: JSON.stringify(params),
  }));
}

// ── Enhance prompt ────────────────────────────────────────────────────────────

/** A question the model asked earlier plus the user's answer — the backend's
 *  `EnhanceAnswer` (`services/persona/schemas.py`). */
export interface EnhanceAnswerRequest {
  question: string;
  answer: string;
}

/**
 * POST /persona/enhance-prompt
 * Returns an enhanced draft plus up to 3 clarifying questions (each with options).
 * Earlier answers are sent back as `{ question, answer }` pairs and folded into the
 * next enhancement. Nothing is saved.
 */
export async function enhancePrompt(
  prompt: string,
  answers: EnhanceAnswerRequest[] = [],
  options: { signal?: AbortSignal } = {},
): Promise<EnhancePromptResponse> {
  return enhancePromptSchema.parse(await apiFetchJson<unknown>(PERSONA_ENHANCE_ENDPOINT, {
    method: "POST",
    // Validated against ENHANCE_LIMITS (the backend sets none).
    body: JSON.stringify({ prompt, answers: enhanceAnswersSchema.parse(answers) }),
    signal: options.signal,
  }));
}

