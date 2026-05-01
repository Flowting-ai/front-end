"use client";

import { apiFetch, apiFetchJson, ApiError } from "./client";
import {
  CHATS_ENDPOINT,
  CHATS_CREATE_ENDPOINT,
  CHATS_RENAME_ENDPOINT,
  CHAT_MESSAGES_ENDPOINT,
  CHAT_STAR_ENDPOINT,
  CHAT_DELETE_ENDPOINT,
  DELETE_MESSAGE_ENDPOINT,
} from "@/lib/config";
import type {
  Chat,
  Message,
  ChatsListResponse,
  MessagesListResponse,
} from "@/types/chat";

// ── Chat list ─────────────────────────────────────────────────────────────────

export async function listChats(cursor?: string): Promise<ChatsListResponse> {
  const url = cursor
    ? `${CHATS_ENDPOINT}?cursor=${encodeURIComponent(cursor)}`
    : CHATS_ENDPOINT;
  return apiFetchJson<ChatsListResponse>(url);
}

// ── Chat CRUD ─────────────────────────────────────────────────────────────────

export async function createChat(model?: string): Promise<Chat> {
  return apiFetchJson<Chat>(CHATS_CREATE_ENDPOINT, {
    method: "POST",
    body: JSON.stringify({ model }),
  });
}

export async function renameChat(chatId: string, title: string): Promise<Chat> {
  return apiFetchJson<Chat>(CHATS_RENAME_ENDPOINT, {
    method: "PATCH",
    body: JSON.stringify({ chat_id: chatId, title }),
  });
}

export async function deleteChat(chatId: string): Promise<void> {
  const response = await apiFetch(CHAT_DELETE_ENDPOINT(chatId), {
    method: "DELETE",
  });
  if (!response.ok && response.status !== 204) {
    throw new ApiError(
      response.status,
      "delete_chat_failed",
      "Failed to delete chat",
    );
  }
}

export async function starChat(chatId: string, starred: boolean): Promise<Chat> {
  return apiFetchJson<Chat>(CHAT_STAR_ENDPOINT(chatId), {
    method: "PATCH",
    body: JSON.stringify({ starred }),
  });
}

// ── Messages ─────────────────────────────────────────────────────────────────

export async function getChatMessages(
  chatId: string,
  cursor?: string,
): Promise<MessagesListResponse> {
  const url = cursor
    ? `${CHAT_MESSAGES_ENDPOINT(chatId)}?cursor=${encodeURIComponent(cursor)}`
    : CHAT_MESSAGES_ENDPOINT(chatId);
  return apiFetchJson<MessagesListResponse>(url);
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
