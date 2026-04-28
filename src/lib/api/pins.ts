"use client";

import {
  PINS_ENDPOINT,
  PIN_DETAIL_ENDPOINT,
  CREATE_PIN_ENDPOINT,
  PIN_FOLDERS_ENDPOINT,
  PIN_FOLDERS_CREATE_ENDPOINT,
  PIN_MOVE_ENDPOINT,
} from "@/lib/config";
import { apiFetch } from "./client";
import { sanitizeFolderName } from "@/lib/security";

export interface TagResponse {
  id: string;
  tag_name: string;
}

export interface CommentResponse {
  id: string;
  comment_text: string;
  created_at: string;
}

export interface BackendPin {
  id: string;
  title?: string;
  pins_title?: string;
  message_id: string;
  messageId?: string;
  sourceMessageId?: string;
  chat?: string;
  sourceChatId?: string;
  folder_id: string;
  folderId?: string;
  folderName?: string;
  content: string;
  formattedContent?: string;
  tags?: TagResponse[];
  comments?: CommentResponse[];
  created_at: string;
}

const normalizeTagArray = (raw: unknown): TagResponse[] | undefined => {
  const source =
    Array.isArray(raw)
      ? raw
      : typeof raw === "string"
        ? raw
            .split(",")
            .map((item) => item.trim())
            .filter((item) => item.length > 0)
      : [];

  if (!Array.isArray(source) || source.length === 0) return undefined;

  const normalized = source
    .map((item, index) => {
      if (typeof item === "string") {
        return {
          id: String(index),
          tag_name: item,
        } satisfies TagResponse;
      }

      if (!item || typeof item !== "object") return null;

      const candidate = item as {
        id?: unknown;
        tag_name?: unknown;
        name?: unknown;
        label?: unknown;
        text?: unknown;
      };

      const tagName =
        candidate.tag_name ??
        candidate.name ??
        candidate.label ??
        candidate.text;

      if (typeof tagName !== "string" || tagName.trim().length === 0) {
        return null;
      }

      return {
        id: String(candidate.id ?? index),
        tag_name: tagName.trim(),
      } satisfies TagResponse;
    })
    .filter((item): item is TagResponse => Boolean(item));

  return normalized.length > 0 ? normalized : undefined;
};

const normalizeCommentArray = (raw: unknown): CommentResponse[] | undefined => {
  const source =
    Array.isArray(raw)
      ? raw
      : typeof raw === "string"
        ? [raw]
        : [];

  if (!Array.isArray(source) || source.length === 0) return undefined;

  const normalized = source
    .map((item, index) => {
      if (typeof item === "string") {
        const text = item.trim();
        if (!text) return null;
        return {
          id: String(index),
          comment_text: text,
          created_at: new Date().toISOString(),
        } satisfies CommentResponse;
      }

      if (!item || typeof item !== "object") return null;

      const candidate = item as {
        id?: unknown;
        comment_text?: unknown;
        text?: unknown;
        content?: unknown;
        created_at?: unknown;
      };

      const commentText =
        candidate.comment_text ?? candidate.text ?? candidate.content;
      if (typeof commentText !== "string" || commentText.trim().length === 0) {
        return null;
      }

      return {
        id: String(candidate.id ?? index),
        comment_text: commentText.trim(),
        created_at:
          typeof candidate.created_at === "string"
            ? candidate.created_at
            : new Date().toISOString(),
      } satisfies CommentResponse;
    })
    .filter((item): item is CommentResponse => Boolean(item));

  return normalized.length > 0 ? normalized : undefined;
};

const normalizeBackendPin = (raw: unknown): BackendPin => {
  const pin = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(pin.id ?? ""),
    title:
      typeof pin.title === "string"
        ? pin.title
        : typeof pin.pins_title === "string"
          ? pin.pins_title
          : undefined,
    pins_title:
      typeof pin.pins_title === "string"
        ? pin.pins_title
        : typeof pin.title === "string"
          ? pin.title
          : undefined,
    message_id: String(pin.message_id ?? pin.messageId ?? ""),
    messageId: String(pin.messageId ?? pin.message_id ?? ""),
    sourceMessageId: String(
      pin.sourceMessageId ??
        pin.source_message_id ??
        pin.messageId ??
        pin.message_id ??
        "",
    ),
    chat:
      typeof pin.chat === "string"
        ? pin.chat
        : typeof pin.chat_id === "string"
          ? pin.chat_id
          : typeof pin.chatId === "string"
            ? pin.chatId
        : typeof pin.sourceChatId === "string"
          ? pin.sourceChatId
          : typeof pin.source_chat_id === "string"
            ? pin.source_chat_id
          : undefined,
    sourceChatId:
      typeof pin.sourceChatId === "string"
        ? pin.sourceChatId
        : typeof pin.source_chat_id === "string"
          ? pin.source_chat_id
        : typeof pin.chat === "string"
          ? pin.chat
          : typeof pin.chat_id === "string"
            ? pin.chat_id
            : typeof pin.chatId === "string"
              ? pin.chatId
          : undefined,
    folder_id: String(pin.folder_id ?? pin.folderId ?? ""),
    folderId: String(pin.folderId ?? pin.folder_id ?? ""),
    folderName:
      typeof pin.folderName === "string"
        ? pin.folderName
        : typeof pin.folder_name === "string"
          ? pin.folder_name
          : undefined,
    content:
      typeof pin.content === "string"
        ? pin.content
        : typeof pin.formattedContent === "string"
          ? pin.formattedContent
          : typeof pin.text === "string"
            ? pin.text
            : "",
    formattedContent:
      typeof pin.formattedContent === "string"
        ? pin.formattedContent
        : typeof pin.content === "string"
          ? pin.content
          : undefined,
    tags:
      normalizeTagArray(pin.tags) ??
      normalizeTagArray(pin.tag_names) ??
      normalizeTagArray(pin.tagNames) ??
      normalizeTagArray(pin.tag_list),
    comments:
      normalizeCommentArray(pin.comments) ??
      normalizeCommentArray(pin.comment_texts) ??
      normalizeCommentArray(pin.commentTexts) ??
      normalizeCommentArray(pin.notes),
    created_at:
      typeof pin.created_at === "string"
        ? pin.created_at
        : new Date().toISOString(),
  };
};

export interface PinFolder {
  id: string;
  folder_name?: string;
  name: string; // alias for folder_name — for UI compatibility
  pin_count?: number;
  created_at?: string;
}

export async function fetchAllPins(): Promise<BackendPin[]> {
  const response = await apiFetch(PINS_ENDPOINT, { method: "GET" });
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data) ? data.map(normalizeBackendPin) : [];
}

export async function fetchPinById(pinId: string): Promise<BackendPin | null> {
  const response = await apiFetch(PIN_DETAIL_ENDPOINT(pinId), { method: "GET" });
  if (!response.ok) return null;
  return normalizeBackendPin(await response.json());
}

/** Create a pin from a message. Only messageId is used; extra options are ignored by the new backend. */
export async function createPin(
  _chatIdOrMessageId: string,
  messageId?: string,
  options?: { folderId?: string | null; tags?: string[]; comments?: string[]; content?: string }
): Promise<BackendPin> {
  // New API: POST /pins/message/{message_id}
  // If called with (messageId) — single arg form
  // If called with (chatId, messageId, options) — legacy form
  const id = messageId ?? _chatIdOrMessageId;
  const hasOptions =
    options !== undefined &&
    (options.folderId !== undefined ||
      (options.tags?.length ?? 0) > 0 ||
      (options.comments?.length ?? 0) > 0 ||
      (options.content?.trim().length ?? 0) > 0);

  const response = await apiFetch(CREATE_PIN_ENDPOINT(id), {
    method: "POST",
    ...(hasOptions
      ? {
          body: JSON.stringify({
            folder_id: options?.folderId ?? null,
            tags: options?.tags ?? [],
            comments: options?.comments ?? [],
            content: options?.content ?? "",
          }),
        }
      : {}),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Failed to create pin");
  }
  return normalizeBackendPin(await response.json());
}

export async function deletePin(pinId: string): Promise<void> {
  await apiFetch(PIN_DETAIL_ENDPOINT(pinId), { method: "DELETE" });
}

const normalizeFolder = (f: { id: string; folder_name: string; pin_count?: number; created_at: string }): PinFolder => ({
  ...f,
  name: f.folder_name,
});

export async function fetchPinFolders(): Promise<PinFolder[]> {
  const response = await apiFetch(PIN_FOLDERS_ENDPOINT, { method: "GET" });
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data) ? data.map(normalizeFolder) : [];
}

export async function createPinFolder(folder_name: string): Promise<PinFolder> {
  const safeName = sanitizeFolderName(folder_name);
  if (!safeName) throw new Error("Folder name must not be empty.");
  const response = await apiFetch(PIN_FOLDERS_CREATE_ENDPOINT, {
    method: "POST",
    body: JSON.stringify({ folder_name: safeName }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Failed to create pin folder");
  }
  return normalizeFolder(await response.json());
}

export async function movePinToFolder(
  pinId: string,
  folderId: string | null
): Promise<BackendPin> {
  const response = await apiFetch(PIN_MOVE_ENDPOINT(pinId), {
    method: "PATCH",
    body: JSON.stringify({ folder_id: folderId }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Failed to move pin");
  }
  return normalizeBackendPin(await response.json());
}

// Not available in current backend — stubs for UI compatibility
export async function renamePinFolder(
  _folderId: string,
  _name: string
): Promise<PinFolder> {
  // When backend adds rename support: pass sanitizeFolderName(_name) to the API body.
  throw new Error("Rename folder is not supported in the current backend.");
}

export async function deletePinFolder(_folderId: string): Promise<void> {
  throw new Error("Delete folder is not supported in the current backend.");
}

export async function updatePinComments(
  _pinId: string,
  _comments: string[]
): Promise<BackendPin> {
  throw new Error("Pin comments are not supported in the current backend.");
}
