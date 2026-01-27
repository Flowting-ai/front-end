"use client";

import { apiFetch } from "./client";
import {
  PERSONAS_ENDPOINT,
  PERSONA_DETAIL_ENDPOINT,
  PERSONA_ANALYZE_ENDPOINT,
  PERSONA_TEST_ENDPOINT,
} from "@/lib/config";

export type PersonaStatus = "test" | "completed";

export interface BackendPersona {
  id: string;
  name: string;
  imageUrl: string | null;
  prompt: string;
  modelId: number | null;
  modelName: string | null;
  providerName: string | null;
  status: PersonaStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PersonaInput {
  name: string;
  prompt: string;
  modelId?: number | string | null;
  status?: PersonaStatus;
  image?: File;
}

export interface PersonaUpdateInput {
  name?: string;
  prompt?: string;
  modelId?: number | string | null;
  status?: PersonaStatus;
  image?: File;
  clearImage?: boolean;
}

export interface TestPersonaInput {
  personaId?: string;
  prompt?: string;
  message: string;
  modelId?: number;
  chatHistory?: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface PersonaAnalyzeResponse {
  tone?: string;
  tone_description?: string;
  dos?: string[];
  donts?: string[];
  summary?: string;
  suggestions?: string[];
  error?: string;
}

const normalizePersona = (persona: BackendPersona) => ({
  id: String(persona.id),
  name: persona.name ?? "Untitled Persona",
  imageUrl: persona.imageUrl ?? null,
  prompt: persona.prompt ?? "",
  modelId: persona.modelId ?? null,
  modelName: persona.modelName ?? null,
  providerName: persona.providerName ?? null,
  status: persona.status ?? "test",
  createdAt: persona.createdAt ?? null,
  updatedAt: persona.updatedAt ?? null,
});

export async function fetchPersonas(status?: PersonaStatus, csrfToken?: string | null) {
  const url = status ? `${PERSONAS_ENDPOINT}?status=${encodeURIComponent(status)}` : PERSONAS_ENDPOINT;
  const response = await apiFetch(url, { method: "GET" }, csrfToken);
  if (!response.ok) {
    throw new Error(`Failed to load personas (${response.status})`);
  }
  const data = await response.json();
  const list = Array.isArray(data)
    ? data
    : Array.isArray((data as { results?: unknown[] })?.results)
    ? ((data as { results: unknown[] }).results as BackendPersona[])
    : [];
  return list.map(normalizePersona);
}

export async function fetchPersonaById(personaId: string, csrfToken?: string | null) {
  const response = await apiFetch(
    PERSONA_DETAIL_ENDPOINT(personaId),
    { method: "GET" },
    csrfToken
  );
  if (!response.ok) {
    throw new Error(`Failed to load persona (${response.status})`);
  }
  const data = (await response.json()) as BackendPersona;
  return normalizePersona(data);
}

const toNumericModelId = (value?: number | string | null) => {
  if (value === null || value === undefined) return undefined;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : undefined;
};

export async function createPersona(payload: PersonaInput, csrfToken?: string | null) {
  let body: FormData | string;
  let headers: Record<string, string> | undefined;

  if (payload.image) {
    // Use FormData when uploading an image
    const formData = new FormData();
    formData.append("name", payload.name);
    formData.append("prompt", payload.prompt);
    const numericModelId = toNumericModelId(payload.modelId);
    if (numericModelId !== undefined) {
      formData.append("modelId", String(numericModelId));
    }
    if (payload.status) {
      formData.append("status", payload.status);
    }
    formData.append("image", payload.image);
    body = formData;
    // Don't set Content-Type - browser will set it with boundary for FormData
  } else {
    // Use JSON when no image
    const numericModelId = toNumericModelId(payload.modelId);
    body = JSON.stringify({
      name: payload.name,
      prompt: payload.prompt,
      modelId: numericModelId !== undefined ? numericModelId : null,
      status: payload.status,
    });
    headers = { "Content-Type": "application/json" };
  }

  const response = await apiFetch(
    PERSONAS_ENDPOINT,
    {
      method: "POST",
      body,
      headers,
    },
    csrfToken
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Failed to create persona");
  }
  const data = (await response.json()) as BackendPersona;
  return normalizePersona(data);
}

export async function updatePersona(
  personaId: string,
  payload: PersonaUpdateInput,
  csrfToken?: string | null
) {
  let body: FormData | string;
  let headers: Record<string, string> | undefined;

  if (payload.image) {
    // Use FormData when uploading a new image
    const formData = new FormData();
    if (payload.name !== undefined) {
      formData.append("name", payload.name);
    }
    if (payload.prompt !== undefined) {
      formData.append("prompt", payload.prompt);
    }
    const numericModelId = toNumericModelId(payload.modelId);
    if (numericModelId !== undefined) {
      formData.append("modelId", String(numericModelId));
    }
    if (payload.status !== undefined) {
      formData.append("status", payload.status);
    }
    formData.append("image", payload.image);
    body = formData;
    // Don't set Content-Type - browser will set it with boundary for FormData
  } else {
    // Use JSON when no image upload
    const jsonPayload: Record<string, unknown> = {};
    if (payload.name !== undefined) jsonPayload.name = payload.name;
    if (payload.prompt !== undefined) jsonPayload.prompt = payload.prompt;
    if (payload.modelId !== undefined) {
      const numericModelId = toNumericModelId(payload.modelId);
      jsonPayload.modelId = numericModelId !== undefined ? numericModelId : null;
    }
    if (payload.status !== undefined) jsonPayload.status = payload.status;
    if (payload.clearImage) jsonPayload.clearImage = true;
    body = JSON.stringify(jsonPayload);
    headers = { "Content-Type": "application/json" };
  }

  const response = await apiFetch(
    PERSONA_DETAIL_ENDPOINT(personaId),
    {
      method: "PATCH",
      body,
      headers,
    },
    csrfToken
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Failed to update persona");
  }
  const data = (await response.json()) as BackendPersona;
  return normalizePersona(data);
}

export async function deletePersona(personaId: string, csrfToken?: string | null) {
  const response = await apiFetch(
    PERSONA_DETAIL_ENDPOINT(personaId),
    { method: "DELETE" },
    csrfToken
  );
  if (!response.ok && response.status !== 204) {
    const text = await response.text();
    throw new Error(text || "Failed to delete persona");
  }
  return true;
}

export async function analyzePersona(
  prompt: string,
  csrfToken?: string | null
) {
  const response = await apiFetch(
    PERSONA_ANALYZE_ENDPOINT,
    {
      method: "POST",
      body: JSON.stringify({ prompt }),
    },
    csrfToken
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Failed to analyze persona");
  }
  return (await response.json()) as PersonaAnalyzeResponse;
}

export interface TestPersonaStreamCallbacks {
  onMetadata?: (data: { modelId: number; modelName: string; provider: string }) => void;
  onStart?: () => void;
  onChunk?: (delta: string) => void;
  onEnd?: () => void;
  onDone?: (data: { response: string; inputTokens: number; outputTokens: number }) => void;
  onError?: (error: string) => void;
}

/**
 * Test a persona with streaming response.
 * Returns a function to abort the stream.
 */
export async function testPersona(
  input: TestPersonaInput,
  callbacks: TestPersonaStreamCallbacks,
  csrfToken?: string | null
): Promise<() => void> {
  const controller = new AbortController();

  const response = await apiFetch(
    PERSONA_TEST_ENDPOINT,
    {
      method: "POST",
      body: JSON.stringify(input),
      signal: controller.signal,
    },
    csrfToken
  );

  if (!response.ok) {
    const text = await response.text();
    callbacks.onError?.(text || "Failed to test persona");
    return () => controller.abort();
  }

  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError?.("No response body");
    return () => controller.abort();
  }

  const decoder = new TextDecoder();
  let buffer = "";

  const processStream = async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let currentEventType = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              switch (currentEventType) {
                case "metadata":
                  callbacks.onMetadata?.(data);
                  break;
                case "start":
                  callbacks.onStart?.();
                  break;
                case "chunk":
                  callbacks.onChunk?.(data.delta);
                  break;
                case "end":
                  callbacks.onEnd?.();
                  break;
                case "done":
                  callbacks.onDone?.(data);
                  break;
                case "error":
                  callbacks.onError?.(data.error);
                  break;
              }
            } catch {
              // Ignore JSON parse errors for incomplete data
            }
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        callbacks.onError?.((error as Error).message || "Stream error");
      }
    }
  };

  processStream();

  return () => controller.abort();
}

// Expose test endpoint constant for backwards compatibility
export const PERSONA_TEST_STREAM_ENDPOINT = PERSONA_TEST_ENDPOINT;
