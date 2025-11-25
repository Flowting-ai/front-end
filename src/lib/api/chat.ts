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
  pin_count?: number;
  pinCount?: number;
  metadata?: {
    messageCount?: number;
    lastMessageAt?: string | null;
    pinCount?: number;
    [key: string]: unknown;
  };
}

export interface BackendMessage {
  id?: number | string;
  sender?: string;
  role?: string;
  content?: string;
  message?: string;
  created_at?: string;
  prompt?: string;
  response?: string;
  model_name?: string;
  provider_name?: string;
  input_tokens?: number;
  output_tokens?: number;
  document_id?: string | number | null;
  document_url?: string | null;
  is_pinned?: boolean;
  pin?: BackendPin | null;
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
    throw new Error(`Failed to load messages for chat ${chatId}`);
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
  model?: Pick<AIModel, "companyName" | "modelName" | "version"> | null;
  user?: AuthUser | null;
}

export interface CreateChatResult {
  chat: BackendChat;
  csrfToken?: string;
  initialResponse?: string | null;
  initialMessageId?: string | null;
}

export async function createChat(
  payload: CreateChatPayload,
  csrfToken?: string | null
): Promise<CreateChatResult> {
  const response = await apiFetch(
    "/chats/",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    csrfToken
  );

  if (!response.ok) {
    const msg = await response.text();
    throw new Error(msg || "Failed to create chat");
  }

  const data = await response.json();
  const chat = (data?.chat ?? data) as BackendChat;
  const initialResponse =
    typeof data?.response === "string"
      ? data.response
      : typeof data?.chat?.response === "string"
      ? data.chat.response
      : undefined;
  const initialMessageId =
    typeof data?.messageId === "string"
      ? data.messageId
      : typeof data?.chat?.messageId === "string"
      ? data.chat.messageId
      : undefined;
  return {
    chat,
    csrfToken: extractCsrfToken(data),
    initialResponse: initialResponse ?? null,
    initialMessageId: initialMessageId ?? null,
  };
}
