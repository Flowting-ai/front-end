"use client";

import type { AuthUser } from "@/context/auth-context";
import type { AIModel } from "@/types/ai-model";
import { apiFetch } from "./client";
import type { BackendPin } from "./pins";

export interface BackendChat {
  id: number | string;
  title?: string;
  name?: string;
  updated_at?: string;
  created_at?: string;
  is_starred?: boolean;
  isStarred?: boolean;
  starMessageId?: string | number | null;
  pin_count?: number;
  pinCount?: number;
  metadata?: {
    messageCount?: number;
    lastMessageAt?: string | null;
    pinCount?: number;
    starred?: boolean;
    starMessageId?: string | number | null;
    [key: string]: unknown;
  };
}

export interface BackendMessage {
  id?: number | string;
  message_id?: number | string;
  chat_id?: number | string;
  sender?: string;
  role?: string;
  content?: string;
  message?: string;
  created_at?: string;
  prompt?: string;
  response?: string;
  model_name?: string;
  modelName?: string;
  llm_model_name?: string;
  provider_name?: string;
  providerName?: string;
  company_name?: string;
  companyName?: string;
  input_tokens?: number;
  output_tokens?: number;
  metadata?: Record<string, unknown>;
  pins_tagged?: unknown[];
  document_id?: string | number | null;
  document_url?: string | null;
  is_pinned?: boolean;
  pin?: BackendPin | null;
  referenced_message_id?: string | number | null;
}

const extractCsrfToken = (data: unknown): string | undefined => {
  if (
    data &&
    typeof data === "object" &&
    "csrfToken" in data &&
    typeof (data as Record<string, unknown>).csrfToken === "string"
  ) {
    return (data as Record<string, string>).csrfToken;
  }
  if (
    data &&
    typeof data === "object" &&
    "csrf_token" in data &&
    typeof (data as Record<string, unknown>).csrf_token === "string"
  ) {
    return (data as Record<string, string>).csrf_token;
  }
  return undefined;
};

export interface FetchChatBoardsResult {
  chats: BackendChat[];
  csrfToken?: string;
}

export async function fetchChatBoards(
  csrfToken?: string | null
): Promise<FetchChatBoardsResult> {
  const response = await apiFetch("/chats/", { method: "GET" }, csrfToken);
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

  return {
    chats,
    csrfToken: extractCsrfToken(data),
  };
}

export async function fetchChatMessages(
  chatId: string | number,
  csrfToken?: string | null
) {
  const response = await apiFetch(
    `/chats/${chatId}/messages/`,
    { method: "GET" },
    csrfToken
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
  user?: AuthUser | null;
  pinIds?: string[];
  file?: File | null;
}

export interface CreateChatResult {
  chat: BackendChat;
  csrfToken?: string;
  initialResponse?: string | null;
  initialMessageId?: string | null;
  initialMessageMetadata?: Record<string, unknown> | null;
  message?: BackendMessage | null;
}

export async function createChat(
  payload: CreateChatPayload,
  csrfToken?: string | null
): Promise<CreateChatResult> {
  const modelId =
    payload.modelId ??
    payload.model?.modelId ??
    (payload.model?.id !== undefined ? payload.model.id : null);

  let body: FormData | string;
  let headers: Record<string, string> | undefined;

  if (payload.file) {
    // Use FormData when uploading a file
    const formData = new FormData();
    formData.append("message", payload.firstMessage);
    if (modelId !== null && modelId !== undefined) {
      formData.append("modelId", String(modelId));
    }
    if (payload.useFramework !== undefined) {
      formData.append("useFramework", String(payload.useFramework));
    }
    if (payload.user) {
      formData.append("user", JSON.stringify(payload.user));
    }
    if (payload.pinIds && payload.pinIds.length > 0) {
      formData.append("pinIds", JSON.stringify(payload.pinIds));
    }
    if (payload.title) {
      formData.append("title", payload.title);
    }
    formData.append("file", payload.file);
    body = formData;
    // Don't set Content-Type - browser sets it with boundary for FormData
  } else {
    // Use JSON when no file
    body = JSON.stringify({
      ...payload,
      message: payload.firstMessage,
      modelId,
    });
    headers = { "Content-Type": "application/json" };
  }

  const response = await apiFetch(
    "/chats/",
    {
      method: "POST",
      body,
      headers,
    },
    csrfToken
  );

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
      : typeof data?.chat?.response === "string"
      ? data.chat.response
      : typeof messagePayload?.response === "string"
      ? messagePayload.response
      : typeof messagePayload?.content === "string"
      ? messagePayload.content
      : typeof messagePayload?.message === "string"
      ? messagePayload.message
      : undefined;
  const initialMessageIdRaw =
    data?.messageId ??
    data?.message_id ??
    data?.chat?.messageId ??
    data?.chat?.message_id ??
    (messagePayload?.message_id ?? messagePayload?.id);
  const initialMessageId =
    initialMessageIdRaw !== undefined && initialMessageIdRaw !== null
      ? String(initialMessageIdRaw)
      : undefined;
  return {
    chat,
    csrfToken: extractCsrfToken(data),
    initialResponse: initialResponse ?? null,
    initialMessageId: initialMessageId ?? null,
    initialMessageMetadata:
      messagePayload && typeof messagePayload.metadata === "object"
        ? (messagePayload.metadata as Record<string, unknown>)
        : null,
    message: messagePayload,
  };
}

export async function renameChat(
  chatId: string,
  newTitle: string,
  csrfToken?: string | null
): Promise<BackendChat> {
  const response = await apiFetch(
    `/chats/${chatId}/rename/`,
    {
      method: "PATCH",
      body: JSON.stringify({ title: newTitle }),
      headers: { "Content-Type": "application/json" },
    },
    csrfToken
  );

  if (!response.ok) {
    const msg = await response.text();
    throw new Error(msg || "Failed to rename chat");
  }

  const data = await response.json();
  return (data?.chat ?? data) as BackendChat;
}
