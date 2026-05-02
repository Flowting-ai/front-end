"use client";

import { apiFetch, ApiError } from "./client";
import {
  CHATS_ENDPOINT,
  CHATS_RENAME_ENDPOINT,
  CHAT_MESSAGES_ENDPOINT,
  CHAT_STAR_ENDPOINT,
  DELETE_MESSAGE_ENDPOINT,
} from "@/lib/config";
import type {
  Chat,
  Message,
  ChatsListResponse,
  MessagesListResponse,
} from "@/types/chat";

// ── Chat list ─────────────────────────────────────────────────────────────────

/** Raw shape the backend may return for a single chat. */
interface BackendChat {
  id: string;
  starred?: boolean;
  is_starred?: boolean;
  isStarred?: boolean;
  chat_title?: string;
  title?: string;
  name?: string;
  message_count?: number;
  pins_count?: number;
  pin_count?: number;
  updated_at?: string;
  created_at?: string;
  model?: string;
  last_message_at?: string;
}

/** Normalize a backend chat object into the canonical Chat type. */
function normalizeChat(raw: BackendChat): Chat {
  return {
    id: raw.id,
    title: raw.chat_title ?? raw.title ?? raw.name ?? "Untitled",
    created_at: raw.created_at ?? new Date().toISOString(),
    updated_at: raw.updated_at ?? raw.created_at ?? new Date().toISOString(),
    starred: raw.starred ?? raw.is_starred ?? raw.isStarred ?? false,
    model: raw.model,
    message_count: raw.message_count ?? 0,
    last_message_at: raw.last_message_at,
  };
}

export async function listChats(cursor?: string): Promise<ChatsListResponse> {
  const url = cursor
    ? `${CHATS_ENDPOINT}?cursor=${encodeURIComponent(cursor)}`
    : CHATS_ENDPOINT;

  const response = await apiFetch(url);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      "list_chats_failed",
      "Failed to load chats",
    );
  }

  const data = await response.json();

  // The backend may return:
  //   1. A raw array of chats
  //   2. { results: [...] }
  //   3. { chats: [...], next_cursor?, has_more? }
  let rawChats: BackendChat[] = [];
  let nextCursor: string | null = null;
  let hasMore = false;

  if (Array.isArray(data)) {
    rawChats = data;
  } else if (Array.isArray(data?.results)) {
    rawChats = data.results;
    nextCursor = data.next_cursor ?? null;
    hasMore = data.has_more ?? false;
  } else if (Array.isArray(data?.chats)) {
    rawChats = data.chats;
    nextCursor = data.next_cursor ?? null;
    hasMore = data.has_more ?? false;
  }

  return {
    chats: rawChats.map(normalizeChat),
    next_cursor: nextCursor,
    has_more: hasMore,
  };
}

// ── Chat CRUD ─────────────────────────────────────────────────────────────────

export async function createChat(model?: string): Promise<Chat> {
  // Note: /chats/create is multipart/form-data and streams a response.
  // This function is for sidebar "create" — the actual streaming is handled
  // by the /api/chat proxy route. Here we just return a placeholder.
  const fd = new FormData();
  fd.append("input", ""); // Required field but empty for pre-creation
  if (model) fd.append("model_id", model);

  // For sidebar-only creation, we don't actually call the backend
  // since /chats/create requires input and streams immediately.
  // Instead we return an optimistic chat and let streaming handle creation.
  return {
    id: `temp-${Date.now()}`,
    title: "New chat",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    starred: false,
  };
}

export async function renameChat(chatId: string, title: string): Promise<void> {
  await apiFetch(CHATS_RENAME_ENDPOINT, {
    method: "PATCH",
    body: JSON.stringify({ chat_id: chatId, chat_title: title }),
  });
}

export async function deleteChat(chatId: string): Promise<void> {
  const response = await apiFetch(CHATS_ENDPOINT, {
    method: "DELETE",
    body: JSON.stringify({ chat_id: chatId }),
  });
  if (!response.ok && response.status !== 204) {
    throw new ApiError(
      response.status,
      "delete_chat_failed",
      "Failed to delete chat",
    );
  }
}

export async function starChat(chatId: string): Promise<void> {
  await apiFetch(CHAT_STAR_ENDPOINT(chatId), {
    method: "PATCH",
  });
}

// ── Messages ─────────────────────────────────────────────────────────────────

/** Raw shape the backend may return for a single message entry. */
interface BackendMessage {
  id?: number | string;
  message_id?: number | string;
  chat_id?: number | string;
  sender?: string;
  role?: string;
  // Paired format: single row contains both user and AI
  input?: string;
  output?: string;
  prompt?: string;
  response?: string;
  // Single-role format
  content?: string;
  message?: string;
  // Metadata
  created_at?: string;
  model_name?: string;
  reasoning?: string | null;
  thinking_content?: string | null;
  image_links?: (string | null)[] | null;
  file_attachments?: Array<{
    file_link?: string | null;
    mime_type?: string | null;
    file_name?: string | null;
  }> | null;
  pin_ids?: (string | null)[] | null;
  metadata?: Record<string, unknown>;
}

/** Normalize a backend message entry into one or two Message objects. */
function normalizeMessages(raw: BackendMessage, chatId: string): Message[] {
  const baseId = String(raw.id ?? raw.message_id ?? `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  const createdAt = raw.created_at ?? new Date().toISOString();

  const userText = raw.input ?? raw.prompt;
  const aiText = raw.output ?? raw.response;

  // Paired format — has both user input and AI output in one row
  if (userText || aiText) {
    const messages: Message[] = [];
    if (userText) {
      messages.push({
        id: `${baseId}-prompt`,
        role: "user",
        content: userText,
        created_at: createdAt,
        chat_id: chatId,
      });
    }
    if (aiText) {
      messages.push({
        id: `${baseId}-response`,
        role: "assistant",
        content: aiText,
        created_at: createdAt,
        chat_id: chatId,
        thinking: raw.reasoning ?? raw.thinking_content ?? undefined,
      });
    }
    return messages;
  }

  // Single-role format (content/message fields)
  const senderRaw = (raw.sender ?? raw.role ?? "user").toLowerCase();
  const role: Message["role"] = (senderRaw === "ai" || senderRaw === "assistant") ? "assistant" : "user";
  const content = raw.content ?? raw.message ?? "";

  return [{
    id: baseId,
    role,
    content,
    created_at: createdAt,
    chat_id: chatId,
    thinking: raw.reasoning ?? raw.thinking_content ?? undefined,
  }];
}

export async function getChatMessages(
  chatId: string,
  cursor?: string,
): Promise<MessagesListResponse> {
  const url = cursor
    ? `${CHAT_MESSAGES_ENDPOINT(chatId)}?cursor=${encodeURIComponent(cursor)}`
    : CHAT_MESSAGES_ENDPOINT(chatId);

  const response = await apiFetch(url);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      "get_messages_failed",
      "Failed to load messages",
    );
  }

  const data = await response.json();

  let rawMessages: BackendMessage[] = [];
  let nextCursor: string | null = null;
  let hasMore = false;

  if (Array.isArray(data)) {
    rawMessages = data;
  } else if (Array.isArray(data?.results)) {
    rawMessages = data.results;
    nextCursor = data.next_cursor ?? null;
    hasMore = data.has_more ?? false;
  } else if (Array.isArray(data?.messages)) {
    rawMessages = data.messages;
    nextCursor = data.next_cursor ?? null;
    hasMore = data.has_more ?? false;
  }

  const messages = rawMessages.flatMap((raw) => normalizeMessages(raw, chatId));

  return {
    messages,
    next_cursor: nextCursor,
    has_more: hasMore,
  };
}

export async function deleteMessage(messageId: string): Promise<void> {
  const response = await apiFetch(DELETE_MESSAGE_ENDPOINT(messageId), {
    method: "DELETE",
  });
  if (!response.ok && response.status !== 204) {
    throw new ApiError(
      response.status,
      "delete_message_failed",
      "Failed to delete message",
    );
  }
}
