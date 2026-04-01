"use client";

import { apiFetch } from "./client";
import {
  PERSONAS_ENDPOINT,
  PERSONA_DETAIL_ENDPOINT,
  PERSONA_ENHANCE_ENDPOINT,
  PERSONA_TEST_ENDPOINT,
  PERSONA_CHATS_ENDPOINT,
  PERSONA_CHATS_CREATE_ENDPOINT,
  PERSONA_CHAT_MESSAGES_ENDPOINT,
  PERSONA_CHAT_STREAM_ENDPOINT,
  PERSONA_CHAT_STOP_ENDPOINT,
  PERSONA_CHATS_RENAME_ENDPOINT,
  PERSONA_CHAT_DELETE_MESSAGE_ENDPOINT,
} from "@/lib/config";

export type PersonaStatus = "draft" | "test" | "completed";

export interface BackendPersonaDocument {
  id: string;
  filename: string;
  created_at: string;
}

export interface BackendPersona {
  id: string;
  name: string;
  prompt: string;
  status: PersonaStatus;
  is_active: boolean;
  isActive?: boolean;
  model_id: string | null;
  modelId?: string | null;
  model_name?: string | null;
  modelName?: string | null;
  provider_name?: string | null;
  providerName?: string | null;
  image_url: string | null;
  imageUrl?: string | null;
  temperature?: number | null;
  document_filename?: string | null;
  documents?: BackendPersonaDocument[];
  created_at: string;
  createdAt?: string;
  updated_at: string;
  updatedAt?: string;
}

export interface PersonaChat {
  id: string;
  chat_title: string;
  message_count: number;
}

export interface PersonaMessage {
  id: string;
  input: string;
  output: string;
  reasoning?: string | null;
}

export interface PersonaInput {
  name: string;
  model_id: string;
  modelId?: string;
  prompt?: string;
  temperature?: number;
  image?: File;
  files?: File[];
}

export interface PersonaUpdateInput {
  name?: string;
  prompt?: string;
  model_id?: string | null;
  modelId?: string | null;
  status?: PersonaStatus;
  temperature?: number;
  image?: File;
  files?: File[];
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function fetchPersonas(status?: PersonaStatus): Promise<BackendPersona[]> {
  const endpoint = status
    ? `${PERSONAS_ENDPOINT}?status=${encodeURIComponent(status)}`
    : PERSONAS_ENDPOINT;
  const response = await apiFetch(endpoint, { method: "GET" });
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data) ? (data as BackendPersona[]) : [];
}

export async function fetchPersonaById(personaId: string): Promise<BackendPersona | null> {
  const response = await apiFetch(PERSONA_DETAIL_ENDPOINT(personaId), {
    method: "GET",
  });
  if (!response.ok) return null;
  return (await response.json()) as BackendPersona;
}

export async function createPersona(payload: PersonaInput): Promise<BackendPersona> {
  const formData = new FormData();
  formData.append("name", payload.name);
  const modelId = payload.model_id ?? payload.modelId;
  if (modelId) formData.append("model_id", String(modelId));
  if (payload.prompt) formData.append("prompt", payload.prompt);
  if (payload.temperature !== undefined) formData.append("temperature", String(payload.temperature));
  if (payload.image) formData.append("image", payload.image);
  if (payload.files && payload.files.length > 0) {
    payload.files.forEach((file) => {
      formData.append("files", file);
    });
  }

  const response = await apiFetch(PERSONAS_ENDPOINT, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Failed to create persona");
  }
  return (await response.json()) as BackendPersona;
}

export async function updatePersona(
  personaId: string,
  payload: PersonaUpdateInput
): Promise<BackendPersona> {
  const formData = new FormData();
  if (payload.name !== undefined) formData.append("name", payload.name);
  if (payload.prompt !== undefined) formData.append("prompt", payload.prompt);
  if (payload.status !== undefined) formData.append("status", payload.status);
  const updateModelId = payload.model_id ?? payload.modelId;
  if (updateModelId !== undefined && updateModelId !== null)
    formData.append("model_id", String(updateModelId));
  if (payload.temperature !== undefined) formData.append("temperature", String(payload.temperature));
  if (payload.image) formData.append("image", payload.image);
  if (payload.files && payload.files.length > 0) {
    payload.files.forEach((file) => {
      formData.append("files", file);
    });
  }

  const response = await apiFetch(PERSONA_DETAIL_ENDPOINT(personaId), {
    method: "PATCH",
    body: formData,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Failed to update persona");
  }
  return (await response.json()) as BackendPersona;
}

export async function deletePersona(personaId: string): Promise<void> {
  await apiFetch(PERSONA_DETAIL_ENDPOINT(personaId), { method: "DELETE" });
}

export interface PersonaAnalyzeResponse {
  prompt?: string;
  summary?: string;
  tone?: string;
  dos?: string[];
  donts?: string[];
}

/** Analyze a persona prompt, returning structured enhancement data. */
export async function analyzePersona(prompt: string): Promise<PersonaAnalyzeResponse> {
  const body = new URLSearchParams({ prompt });
  const response = await apiFetch(PERSONA_ENHANCE_ENDPOINT, {
    method: "POST",
    body: body.toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Failed to enhance persona prompt");
  }
  const data = await response.json();
  if (typeof data === "string") return { prompt: data };
  return {
    prompt: data?.enhanced_prompt ?? data?.prompt ?? "",
    dos: Array.isArray(data?.dos) ? data.dos : undefined,
    donts: Array.isArray(data?.donts) ? data.donts : undefined,
  };
}

// ── Persona test stream ───────────────────────────────────────────────────────

export interface TestPersonaStreamCallbacks {
  onChunk?: (delta: string) => void;
  onDone?: () => void;
  onError?: (error: string) => void;
}

export async function testPersona(
  personaId: string,
  input: string,
  callbacks: TestPersonaStreamCallbacks
): Promise<() => void> {
  const controller = new AbortController();
  const body = new URLSearchParams({ input });

  const response = await apiFetch(PERSONA_TEST_ENDPOINT(personaId), {
    method: "POST",
    body: body.toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    signal: controller.signal,
  });

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
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const eventChunk of events) {
            const lines = eventChunk.split("\n");
            let eventName = "";
            let dataStr = "";
            for (const line of lines) {
              if (line.startsWith("event:")) eventName = line.slice(6).trim();
              else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
            }
            if (!dataStr) continue;
            let parsed: Record<string, unknown>;
            try { parsed = JSON.parse(dataStr); } catch { continue; }
            if (!eventName && parsed.type) {
              eventName = parsed.type === "content" ? "chunk" : String(parsed.type);
              if (parsed.type === "content" && !("delta" in parsed))
                parsed = { ...parsed, delta: parsed.content };
            }
            if (eventName === "chunk") callbacks.onChunk?.(typeof parsed.delta === "string" ? parsed.delta : "");
            if (eventName === "done") { callbacks.onDone?.(); return; }
            if (eventName === "error") callbacks.onError?.(typeof parsed.error === "string" ? parsed.error : "Stream error");
          }
        }
        if (done) break;
      }
      callbacks.onDone?.();
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        callbacks.onError?.((error as Error).message ?? "Stream error");
      }
    } finally {
      reader.cancel().catch(() => {});
    }
  };

  processStream();
  return () => controller.abort();
}

// ── Persona chats ─────────────────────────────────────────────────────────────

export async function fetchPersonaChats(personaId: string): Promise<PersonaChat[]> {
  const response = await apiFetch(PERSONA_CHATS_ENDPOINT(personaId), {
    method: "GET",
  });
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data) ? (data as PersonaChat[]) : [];
}

export async function createPersonaChat(
  personaId: string,
  input: string
): Promise<{ chatId: string | null; response: Response }> {
  const formData = new FormData();
  formData.append("input", input);
  const response = await apiFetch(PERSONA_CHATS_CREATE_ENDPOINT(personaId), {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Failed to create persona chat");
  }
  const chatId = response.headers.get("X-Chat-Id");
  return { chatId, response };
}

export async function deletePersonaChat(
  personaId: string,
  chatId: string
): Promise<void> {
  await apiFetch(PERSONA_CHATS_ENDPOINT(personaId), {
    method: "DELETE",
    body: JSON.stringify({ chat_id: chatId }),
  });
}

export async function fetchPersonaChatMessages(
  personaId: string,
  chatId: string
): Promise<PersonaMessage[]> {
  const response = await apiFetch(
    PERSONA_CHAT_MESSAGES_ENDPOINT(personaId, chatId),
    { method: "GET" }
  );
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data) ? (data as PersonaMessage[]) : [];
}

export async function streamPersonaMessage(
  personaId: string,
  chatId: string,
  input: string,
  callbacks: TestPersonaStreamCallbacks
): Promise<() => void> {
  const controller = new AbortController();
  const body = new URLSearchParams({ input });

  const response = await apiFetch(
    PERSONA_CHAT_STREAM_ENDPOINT(personaId, chatId),
    {
      method: "POST",
      body: body.toString(),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: controller.signal,
    }
  );

  if (!response.ok) {
    const text = await response.text();
    callbacks.onError?.(text || "Failed to stream message");
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
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const eventChunk of events) {
            const lines = eventChunk.split("\n");
            let eventName = "";
            let dataStr = "";
            for (const line of lines) {
              if (line.startsWith("event:")) eventName = line.slice(6).trim();
              else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
            }
            if (!dataStr) continue;
            let parsed: Record<string, unknown>;
            try { parsed = JSON.parse(dataStr); } catch { continue; }
            if (!eventName && parsed.type) {
              eventName = parsed.type === "content" ? "chunk" : String(parsed.type);
              if (parsed.type === "content" && !("delta" in parsed))
                parsed = { ...parsed, delta: parsed.content };
            }
            if (eventName === "chunk") callbacks.onChunk?.(typeof parsed.delta === "string" ? parsed.delta : "");
            if (eventName === "done") { callbacks.onDone?.(); return; }
            if (eventName === "error") callbacks.onError?.(typeof parsed.error === "string" ? parsed.error : "Stream error");
          }
        }
        if (done) break;
      }
      callbacks.onDone?.();
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        callbacks.onError?.((error as Error).message ?? "Stream error");
      }
    } finally {
      reader.cancel().catch(() => {});
    }
  };

  processStream();
  return () => controller.abort();
}

export async function stopPersonaChat(
  personaId: string,
  chatId: string
): Promise<void> {
  await apiFetch(PERSONA_CHAT_STOP_ENDPOINT(personaId, chatId), {
    method: "POST",
  });
}

export async function renamePersonaChat(
  personaId: string,
  chatId: string,
  chat_title: string
): Promise<void> {
  await apiFetch(PERSONA_CHATS_RENAME_ENDPOINT(personaId), {
    method: "PATCH",
    body: JSON.stringify({ chat_id: chatId, chat_title }),
  });
}

export async function deletePersonaChatMessage(
  personaId: string,
  chatId: string,
  messageId: string
): Promise<void> {
  await apiFetch(
    PERSONA_CHAT_DELETE_MESSAGE_ENDPOINT(personaId, chatId, messageId),
    { method: "DELETE" }
  );
}
