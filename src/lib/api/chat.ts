"use client";

import type { AuthUser } from "@/context/auth-context";
import type { AIModel } from "@/types/ai-model";
import { apiFetch } from "./client";
import type { BackendPin } from "./pins";

export interface BackendChat {
  id: string;
  starred: boolean;
  chat_title: string;
  message_count: number;
  pins_count: number;
  // legacy fields kept for compatibility
  title?: string;
  name?: string;
  updated_at?: string;
  created_at?: string;
  is_starred?: boolean;
  isStarred?: boolean;
  pin_count?: number;
  pinCount?: number;
}

export interface BackendMessage {
  id?: number | string;
  message_id?: number | string;
  chat_id?: number | string;
  sender?: string;
  // New API fields (FastAPI backend)
  input?: string;
  output?: string;
  image_links?: (string | null)[] | null;
  generated_images?: (string | null)[] | null;
  file_links?: (string | null)[] | null;
  file_attachments?:
    | Array<{
        file_link?: string | null;
        mime_type?: string | null;
        origin?: string | null;
        file_name?: string | null;
      }>
    | null;
  pin_ids?: (string | null)[] | null;
  reference_id?: string | null;
  // Legacy / common fields
  role?: string;
  content?: string;
  message?: string;
  created_at?: string;
  prompt?: string;
  response?: string;
  model_name?: string;
  modelName?: string;
  provider_name?: string;
  metadata?: Record<string, unknown>;
  pin?: BackendPin | null;
  referenced_message_id?: string | null;
  reasoning?: string | null;
  thinking_content?: string | null;
}


export interface FetchChatBoardsResult {
  chats: BackendChat[];
}

export async function fetchChatBoards(): Promise<FetchChatBoardsResult> {
  const response = await apiFetch("/chats", { method: "GET" });
  if (!response.ok) {
    throw new Error(`Failed to load chats: ${response.statusText}`);
  }
  const data = await response.json();
  let chats: BackendChat[] = [];
  if (Array.isArray(data)) {
    chats = data as BackendChat[];
  } else if (Array.isArray(data?.results)) {
    chats = data.results as BackendChat[];
  } else if (Array.isArray(data?.chats)) {
    chats = data.chats as BackendChat[];
  }

  return { chats };
}

export async function fetchChatMessages(
  chatId: string | number
) {
  const response = await apiFetch(
    `/chats/${chatId}/messages`,
    { method: "GET" }
  );
  if (!response.ok) {
    let body = "";
    try {
      body = await response.text();
    } catch {
      body = "";
    }
    const statusInfo = `${response.status} ${response.statusText}`.trim();
    const detail = body ? `: ${body}` : "";
    throw new Error(
      `Failed to load messages for chat ${chatId} (${statusInfo})${detail}`
    );
  }
  const data = await response.json();
  if (Array.isArray(data)) {
    return data as BackendMessage[];
  }
  if (Array.isArray(data?.results)) {
    return data.results as BackendMessage[];
  }
  if (Array.isArray(data?.messages)) {
    return data.messages as BackendMessage[];
  }
  return [];
}

export interface CreateChatPayload {
  title?: string;
  firstMessage: string;
  message?: string;
  model?:
    | Pick<AIModel, "companyName" | "modelName" | "version" | "modelId" | "id">
    | null;
  modelId?: number | string | null;
  useFramework?: boolean;
  useAlgorithm?: boolean;
  algorithm?: 'base' | 'pro' | null;
  memoryPercentage?: number;
  webSearch?: boolean;
  user?: AuthUser | null;
  pinIds?: string[];
  file?: File | null;
}

export interface CreateChatResult {
  chat: BackendChat;
  initialResponse?: string | null;
  initialMessageId?: string | null;
  initialMessageMetadata?: Record<string, unknown> | null;
  message?: BackendMessage | null;
}

export async function createChat(
  payload: CreateChatPayload
): Promise<CreateChatResult> {
  const modelId =
    payload.modelId ??
    (payload.model?.id !== undefined ? payload.model.id : null) ??
    payload.model?.modelId;
  const useAlgorithm =
    (payload.useAlgorithm ?? payload.useFramework) &&
    (modelId === null || modelId === undefined);
  const algorithmValue = payload.algorithm ?? (useAlgorithm ? 'base' : null);

  const formData = new FormData();
  formData.append("input", payload.firstMessage);
  if (modelId !== null && modelId !== undefined) {
    formData.append("model_id", String(modelId));
  }
  if (algorithmValue) {
    formData.append("algorithm", algorithmValue);
  }
  formData.append("memory_percentage", String(payload.memoryPercentage ?? 0.2));
  if (payload.webSearch) {
    formData.append("web_search", "true");
  }
  if (payload.pinIds && payload.pinIds.length > 0) {
    formData.append("pin_ids", JSON.stringify(payload.pinIds));
  }
  if (payload.file) {
    formData.append("files", payload.file);
  }

  const response = await apiFetch("/chats/create", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const msg = await response.text();
    throw new Error(msg || "Failed to create chat");
  }

  const data = await response.json();
  const chat = (data?.chat ?? data) as BackendChat;
  const messagePayload =
    data?.message && typeof data.message === "object" ? (data.message as BackendMessage) : null;
  const initialResponse =
    typeof data?.response === "string"
      ? data.response
      : typeof messagePayload?.response === "string"
      ? messagePayload.response
      : typeof messagePayload?.content === "string"
      ? messagePayload.content
      : undefined;
  const initialMessageIdRaw =
    data?.message_id ??
    data?.messageId ??
    messagePayload?.message_id ??
    messagePayload?.id;
  const initialMessageId =
    initialMessageIdRaw !== undefined && initialMessageIdRaw !== null
      ? String(initialMessageIdRaw)
      : undefined;
  return {
    chat,
    initialResponse: initialResponse ?? null,
    initialMessageId: initialMessageId ?? null,
    initialMessageMetadata: null,
    message: messagePayload,
  };
}

export async function renameChat(
  chatId: string,
  chat_title: string
): Promise<void> {
  const response = await apiFetch("/chats/rename", {
    method: "PATCH",
    body: JSON.stringify({ chat_id: chatId, chat_title }),
  });

  if (!response.ok) {
    const msg = await response.text();
    throw new Error(msg || "Failed to rename chat");
  }
}
